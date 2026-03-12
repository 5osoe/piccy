/**
 * metadata.js
 * Handles EXIF/metadata extraction via exifr library.
 * Returns a structured metadata object for display.
 */

const MetadataExtractor = (() => {

  /**
   * Convert GPS decimal degrees to DMS string
   */
  function toDMS(decimal, isLat) {
    const abs = Math.abs(decimal);
    const deg = Math.floor(abs);
    const minFull = (abs - deg) * 60;
    const min = Math.floor(minFull);
    const sec = ((minFull - min) * 60).toFixed(1);
    const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
    return `${deg}° ${min}' ${sec}" ${dir}`;
  }

  /**
   * Format shutter speed as a fraction if < 1s
   */
  function formatExposure(val) {
    if (!val) return null;
    if (val >= 1) return `${val}s`;
    const denom = Math.round(1 / val);
    return `1/${denom}s`;
  }

  /**
   * Format aperture as f/N
   */
  function formatAperture(val) {
    if (!val) return null;
    return `f/${Number(val).toFixed(1)}`;
  }

  /**
   * Format focal length
   */
  function formatFocal(val) {
    if (!val) return null;
    return `${Number(val).toFixed(1)}mm`;
  }

  /**
   * Format file size
   */
  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Format orientation value
   */
  function formatOrientation(val) {
    const map = {
      1: 'Normal (0°)',
      2: 'Mirrored',
      3: 'Rotated 180°',
      4: 'Mirrored + 180°',
      5: 'Mirrored + 270°',
      6: 'Rotated 90° CW',
      7: 'Mirrored + 90°',
      8: 'Rotated 270° CW'
    };
    return map[val] || `${val}`;
  }

  /**
   * Format color space
   */
  function formatColorSpace(val) {
    if (val === 1) return 'sRGB';
    if (val === 65535) return 'Uncalibrated';
    return `${val}`;
  }

  /**
   * Parse date string from EXIF
   */
  function formatDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
      return val.toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    // Handle "YYYY:MM:DD HH:MM:SS" format
    if (typeof val === 'string') {
      const cleaned = val.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const d = new Date(cleaned);
      if (!isNaN(d)) {
        return d.toLocaleString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      }
      return val;
    }
    return null;
  }

  /**
   * Main extraction function.
   * @param {File} file - The image file
   * @returns {Promise<Object>} - Structured metadata object
   */
  async function extract(file) {
    // Basic file info always available
    const fileInfo = {
      name: file.name,
      size: formatSize(file.size),
      rawSize: file.size,
      type: file.type || 'Unknown',
      lastModified: file.lastModified
        ? new Date(file.lastModified).toLocaleString()
        : null
    };

    let exif = {};

    try {
      // exifr handles JPG, PNG, HEIC, WebP, TIFF, etc.
      const raw = await window.exifr.parse(file, {
        tiff: true,
        xmp: true,
        icc: false,
        iptc: false,
        jfif: false,
        ihdr: true,
        gps: true,
        translateKeys: true,
        translateValues: true,
        reviveValues: true,
        mergeOutput: true
      });

      if (raw) exif = raw;
    } catch (e) {
      console.warn('[Piccy] EXIF parse warning:', e.message);
    }

    // Also extract image dimensions from the DOM image (reliable fallback)
    const dims = await getImageDimensions(file);

    // Build structured output
    return {
      file: fileInfo,
      camera: {
        make:     exif.Make       || null,
        model:    exif.Model      || null,
        lens:     exif.LensModel  || exif.Lens || null,
        software: exif.Software   || null
      },
      photo: {
        width:       exif.ImageWidth  || exif.PixelXDimension || dims.width  || null,
        height:      exif.ImageHeight || exif.PixelYDimension || dims.height || null,
        orientation: exif.Orientation ? formatOrientation(exif.Orientation) : null,
        colorSpace:  exif.ColorSpace  ? formatColorSpace(exif.ColorSpace)   : null,
        resolution:  (exif.XResolution && exif.YResolution)
                       ? `${exif.XResolution} × ${exif.YResolution} dpi` : null
      },
      capture: {
        dateTaken:    formatDate(exif.DateTimeOriginal || exif.DateTime || exif.CreateDate) || null,
        exposure:     formatExposure(exif.ExposureTime) || null,
        aperture:     formatAperture(exif.FNumber || exif.ApertureValue) || null,
        iso:          exif.ISO || exif.ISOSpeedRatings || null,
        focalLength:  formatFocal(exif.FocalLength) || null,
        whiteBalance: exif.WhiteBalance || null,
        flash:        exif.Flash       || null,
        exposureMode: exif.ExposureMode || null,
        meteringMode: exif.MeteringMode || null
      },
      gps: (exif.latitude != null && exif.longitude != null) ? {
        latitude:     exif.latitude,
        longitude:    exif.longitude,
        latDMS:       toDMS(exif.latitude, true),
        lonDMS:       toDMS(exif.longitude, false),
        altitude:     exif.GPSAltitude ? `${Number(exif.GPSAltitude).toFixed(1)}m` : null
      } : null,
      raw: exif
    };
  }

  /**
   * Get image dimensions by loading into an <img> element
   */
  function getImageDimensions(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload  = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null }); };
      img.src = url;
    });
  }

  return { extract };
})();
