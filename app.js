/**
 * app.js
 * Main application controller for Piccy.
 * Wires upload handling, HEIC conversion, and metadata pipeline.
 */

(async () => {

  /* ── Init UI module ── */
  UI.init();

  const uploadZone = document.getElementById('upload-zone');
  const fileInput  = document.getElementById('file-input');

  /* ── Accepted MIME types ── */
  const ACCEPTED = [
    'image/jpeg', 'image/png', 'image/webp',
    'image/heic', 'image/heif',
    'image/tiff', 'image/bmp'
  ];

  const ACCEPTED_EXT = /\.(jpe?g|png|webp|heic|heif|tiff?|bmp)$/i;

  /* ── Drag & Drop ── */
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', e => {
    if (!uploadZone.contains(e.relatedTarget)) {
      uploadZone.classList.remove('drag-over');
    }
  });

  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  /* ── Click to upload ── */
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  /* ── Main file handler ── */
  async function handleFile(file) {
    UI.hideError();

    // Validate
    const isValid = ACCEPTED.includes(file.type) || ACCEPTED_EXT.test(file.name);
    if (!isValid) {
      UI.showError(`Unsupported file type: "${file.type || file.name}". Please use JPG, PNG, WebP, or HEIC.`);
      return;
    }

    UI.showLoading('Reading file…');

    try {
      let previewFile = file;
      let previewURL;

      // ── HEIC / HEIF conversion for preview ──
      const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' ||
                     /\.(heic|heif)$/i.test(file.name);

      if (isHEIC) {
        UI.showLoading('Converting HEIC preview…');
        try {
          if (typeof heic2any !== 'undefined') {
            const converted = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.85
            });
            const blob = Array.isArray(converted) ? converted[0] : converted;
            previewURL = URL.createObjectURL(blob);
          } else {
            // heic2any not loaded — show placeholder
            previewURL = 'data:image/svg+xml,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
                <rect fill="#1c1c21" width="400" height="400"/>
                <text x="50%" y="50%" fill="#4a4a5a" text-anchor="middle" font-size="14" font-family="monospace">HEIC Preview N/A</text>
              </svg>`
            );
          }
        } catch (e) {
          console.warn('[Piccy] HEIC conversion failed:', e);
          previewURL = 'data:image/svg+xml,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
              <rect fill="#1c1c21" width="400" height="400"/>
              <text x="50%" y="50%" fill="#fb923c" text-anchor="middle" font-size="14" font-family="monospace">HEIC Preview Unavailable</text>
            </svg>`
          );
        }
      } else {
        previewURL = URL.createObjectURL(file);
      }

      // Render preview immediately
      UI.renderPreview(previewURL, file.name, formatSize(file.size));

      // ── Extract metadata ──
      UI.showLoading('Extracting metadata…');
      const meta = await MetadataExtractor.extract(file);

      UI.hideLoading();
      UI.renderMetadata(meta);

    } catch (err) {
      console.error('[Piccy] Error:', err);
      UI.showError(`Failed to process image: ${err.message || 'Unknown error'}`);
      UI.hideLoading();
    }
  }

  /* ── Format file size (shared helper for app.js) ── */
  function formatSize(bytes) {
    if (bytes < 1024)            return `${bytes} B`;
    if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

})();
