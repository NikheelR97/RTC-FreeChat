export const lightbox = {
  overlay: document.getElementById('lightbox-overlay'),
  image: document.getElementById('lightbox-image'),
  filename: document.getElementById('lightbox-filename'),
  closeBtn: document.getElementById('lightbox-close'),
  downloadBtn: document.getElementById('lightbox-download'),
  currentUrl: null,
  currentName: null,
};

export function setupLightbox() {
  // Expose for inline onclick handlers
  window.openLightbox = (url, name) => {
    if (!lightbox.overlay) return;
    lightbox.currentUrl = url;
    lightbox.currentName = name;

    lightbox.image.src = url;
    if (lightbox.filename) lightbox.filename.textContent = name;

    lightbox.overlay.classList.remove('hidden');
  };

  if (lightbox.closeBtn) {
    lightbox.closeBtn.onclick = () => {
      lightbox.overlay.classList.add('hidden');
      lightbox.image.src = '';
    };
  }

  if (lightbox.overlay) {
    lightbox.overlay.onclick = (e) => {
      if (e.target === lightbox.overlay) {
        lightbox.overlay.classList.add('hidden');
        lightbox.image.src = '';
      }
    };
  }

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.overlay && !lightbox.overlay.classList.contains('hidden')) {
      lightbox.overlay.classList.add('hidden');
      lightbox.image.src = '';
    }
  });

  if (lightbox.downloadBtn) {
    lightbox.downloadBtn.onclick = (e) => {
      e.stopPropagation();
      if (lightbox.currentUrl) {
        const link = document.createElement('a');
        link.href = lightbox.currentUrl;
        link.download = lightbox.currentName || 'download';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
  }
}

// Auto-run setup on import? Or export a setup function?
// Existing code had it attached at bottom of file.
// We will call setupLightbox() at end of file to mimic side-effect behavior of module import
setupLightbox();
