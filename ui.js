/**
 * ui.js
 * Handles all DOM rendering and UI interactions.
 * Separated from metadata logic for clean architecture.
 */

const UI = (() => {

  /* ── DOM refs ── */
  const uploadZone    = document.getElementById('upload-zone');
  const fileInput     = document.getElementById('file-input');
  const loadingEl     = document.getElementById('loading');
  const errorEl       = document.getElementById('error-msg');
  const resultsEl     = document.getElementById('results');
  const previewImg    = document.getElementById('preview-img');
  const previewName   = document.getElementById('preview-name');
  const previewSize   = document.getElementById('preview-size');
  const metadataPanel = document.getElementById('metadata-panel');
  const btnCopy       = document.getElementById('btn-copy');
  const btnDownload   = document.getElementById('btn-download');
  const btnNewUpload  = document.getElementById('btn-new-upload');

  /* ── State ── */
  let currentMeta = null;

  /* ── Show / hide helpers ── */
  function showLoading(msg = 'Parsing metadata…') {
    loadingEl.querySelector('.loading-text').textContent = msg;
    loadingEl.classList.add('visible');
    resultsEl.classList.remove('visible');
    errorEl.classList.remove('visible');
  }

  function hideLoading() {
    loadingEl.classList.remove('visible');
  }

  function showError(msg) {
    errorEl.textContent = `⚠ ${msg}`;
    errorEl.classList.add('visible');
    hideLoading();
  }

  function hideError() {
    errorEl.classList.remove('visible');
  }

  /* ── Render image preview ── */
  function renderPreview(objectURL, filename, size) {
    previewImg.src = objectURL;
    previewName.textContent = filename;
    previewSize.textContent = size;
  }

  /* ── Build a metadata section card ── */
  function buildSection(iconClass, iconEmoji, title, rows) {
    const hasData = rows.some(r => r.value != null && r.value !== '');
    if (!hasData) return null;

    const section = document.createElement('div');
    section.className = 'meta-section';

    const header = document.createElement('div');
    header.className = 'meta-section-header';
    header.innerHTML = `
      <div class="meta-section-icon ${iconClass}">${iconEmoji}</div>
      <span class="meta-section-title">${title}</span>
    `;
    section.appendChild(header);

    const table = document.createElement('table');
    table.className = 'meta-table';

    rows.forEach(({ label, value, highlight }) => {
      if (value == null || value === '') return;
      const tr = document.createElement('tr');
      const valClass = highlight ? 'meta-value-highlight' : '';
      tr.innerHTML = `
        <td>${label}</td>
        <td class="${valClass}">${escapeHTML(String(value))}</td>
      `;
      table.appendChild(tr);
    });

    section.appendChild(table);
    return section;
  }

  /* ── Build GPS section (special: includes map) ── */
  function buildGPSSection(gps) {
    if (!gps) {
      const section = document.createElement('div');
      section.className = 'meta-section';
      section.innerHTML = `
        <div class="meta-section-header">
          <div class="meta-section-icon icon-gps">📍</div>
          <span class="meta-section-title">Location Data</span>
        </div>
        <p class="no-gps">No GPS data found in this image.</p>
      `;
      return section;
    }

    const section = document.createElement('div');
    section.className = 'meta-section';

    const mapsURL = `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`;
    const mapImgURL = `https://maps.googleapis.com/maps/api/staticmap?center=${gps.latitude},${gps.longitude}&zoom=13&size=600x200&maptype=roadmap&markers=color:red%7C${gps.latitude},${gps.longitude}&style=feature:all|element:geometry|color:0x1a1a2e&style=feature:all|element:labels.text.fill|color:0x8a8a9a`;

    // Use OpenStreetMap tile as privacy-friendly fallback
    const osmURL = `https://www.openstreetmap.org/export/embed.html?bbox=${gps.longitude - 0.01},${gps.latitude - 0.01},${gps.longitude + 0.01},${gps.latitude + 0.01}&layer=mapnik&marker=${gps.latitude},${gps.longitude}`;

    section.innerHTML = `
      <div class="meta-section-header">
        <div class="meta-section-icon icon-gps">📍</div>
        <span class="meta-section-title">Location Data</span>
      </div>
      <table class="meta-table">
        <tr><td>Latitude</td><td>${escapeHTML(gps.latDMS)}</td></tr>
        <tr><td>Longitude</td><td>${escapeHTML(gps.lonDMS)}</td></tr>
        <tr><td>Decimal</td><td>${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}</td></tr>
        ${gps.altitude ? `<tr><td>Altitude</td><td>${escapeHTML(gps.altitude)}</td></tr>` : ''}
      </table>
      <div class="map-preview">
        <iframe
          src="${osmURL}"
          width="100%"
          height="180"
          style="border:none;display:block;filter:invert(0.85) hue-rotate(180deg);"
          loading="lazy"
          title="Map location"
        ></iframe>
      </div>
      <div class="map-link-row">
        <a href="${mapsURL}" target="_blank" rel="noopener" class="map-link">
          ↗ Open in Google Maps
        </a>
      </div>
    `;
    return section;
  }

  /* ── Render full metadata panel ── */
  function renderMetadata(meta) {
    currentMeta = meta;
    metadataPanel.innerHTML = '';

    // File Information
    const fileSection = buildSection('icon-file', '📄', 'File Information', [
      { label: 'File Name',     value: meta.file.name },
      { label: 'File Size',     value: meta.file.size,     highlight: true },
      { label: 'File Type',     value: meta.file.type },
      { label: 'Last Modified', value: meta.file.lastModified }
    ]);
    if (fileSection) metadataPanel.appendChild(fileSection);

    // Camera Information
    const cameraSection = buildSection('icon-camera', '📷', 'Camera Information', [
      { label: 'Brand',    value: meta.camera.make,     highlight: true },
      { label: 'Model',    value: meta.camera.model,    highlight: true },
      { label: 'Lens',     value: meta.camera.lens },
      { label: 'Software', value: meta.camera.software }
    ]);
    if (cameraSection) metadataPanel.appendChild(cameraSection);

    // Photo Details
    const w = meta.photo.width, h = meta.photo.height;
    const res = (w && h) ? `${w} × ${h} px` : null;
    const mp  = (w && h) ? `${((w * h) / 1_000_000).toFixed(1)} MP` : null;

    const photoSection = buildSection('icon-photo', '🖼', 'Photo Details', [
      { label: 'Dimensions',   value: res,                   highlight: true },
      { label: 'Megapixels',   value: mp },
      { label: 'Width',        value: w  ? `${w}px`  : null },
      { label: 'Height',       value: h  ? `${h}px`  : null },
      { label: 'Orientation',  value: meta.photo.orientation },
      { label: 'Color Space',  value: meta.photo.colorSpace },
      { label: 'Resolution',   value: meta.photo.resolution }
    ]);
    if (photoSection) metadataPanel.appendChild(photoSection);

    // Capture Data
    const captureSection = buildSection('icon-capture', '⚙️', 'Capture Data', [
      { label: 'Date Taken',     value: meta.capture.dateTaken,    highlight: true },
      { label: 'Exposure',       value: meta.capture.exposure },
      { label: 'Aperture',       value: meta.capture.aperture },
      { label: 'ISO',            value: meta.capture.iso ? `ISO ${meta.capture.iso}` : null },
      { label: 'Focal Length',   value: meta.capture.focalLength },
      { label: 'White Balance',  value: meta.capture.whiteBalance },
      { label: 'Flash',          value: meta.capture.flash },
      { label: 'Exposure Mode',  value: meta.capture.exposureMode },
      { label: 'Metering Mode',  value: meta.capture.meteringMode }
    ]);
    if (captureSection) metadataPanel.appendChild(captureSection);

    // GPS / Location
    metadataPanel.appendChild(buildGPSSection(meta.gps));

    // Show results
    resultsEl.classList.add('visible');
  }

  /* ── Copy metadata to clipboard ── */
  function copyMetadata() {
    if (!currentMeta) return;
    const text = formatMetaAsText(currentMeta);
    navigator.clipboard.writeText(text).then(() => {
      btnCopy.textContent = '✓ Copied';
      btnCopy.classList.add('copied');
      setTimeout(() => {
        btnCopy.textContent = 'Copy';
        btnCopy.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  /* ── Download metadata as JSON ── */
  function downloadJSON() {
    if (!currentMeta) return;
    const clean = buildCleanJSON(currentMeta);
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${currentMeta.file.name.replace(/\.[^.]+$/, '')}_metadata.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Format metadata as plain text ── */
  function formatMetaAsText(meta) {
    const lines = ['PICCY — IMAGE METADATA', '='.repeat(40)];

    const push = (section, obj) => {
      lines.push('', `[ ${section} ]`);
      Object.entries(obj).forEach(([k, v]) => {
        if (v != null) lines.push(`  ${k}: ${v}`);
      });
    };

    push('File', { Name: meta.file.name, Size: meta.file.size, Type: meta.file.type });
    push('Camera', meta.camera);
    push('Photo', meta.photo);
    push('Capture', meta.capture);
    if (meta.gps) push('GPS', { Latitude: meta.gps.latDMS, Longitude: meta.gps.lonDMS, Altitude: meta.gps.altitude });
    else push('GPS', { Note: 'No GPS data found' });

    return lines.join('\n');
  }

  /* ── Build clean JSON for download ── */
  function buildCleanJSON(meta) {
    const out = {
      file:    Object.fromEntries(Object.entries(meta.file).filter(([, v]) => v != null)),
      camera:  Object.fromEntries(Object.entries(meta.camera).filter(([, v]) => v != null)),
      photo:   Object.fromEntries(Object.entries(meta.photo).filter(([, v]) => v != null)),
      capture: Object.fromEntries(Object.entries(meta.capture).filter(([, v]) => v != null))
    };
    if (meta.gps) {
      out.gps = Object.fromEntries(Object.entries(meta.gps).filter(([, v]) => v != null));
    }
    return out;
  }

  /* ── HTML escape ── */
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Reset to upload state ── */
  function reset() {
    resultsEl.classList.remove('visible');
    hideError();
    previewImg.src = '';
    metadataPanel.innerHTML = '';
    currentMeta = null;
    fileInput.value = '';
  }

  /* ── Wire up events ── */
  function init() {
    btnCopy.addEventListener('click', copyMetadata);
    btnDownload.addEventListener('click', downloadJSON);
    btnNewUpload.addEventListener('click', reset);
  }

  return {
    init,
    showLoading,
    hideLoading,
    showError,
    hideError,
    renderPreview,
    renderMetadata,
    reset
  };
})();
