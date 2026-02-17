export function setupDragDrop(onFileDrop) {
  const dropOverlay = document.getElementById('drop-overlay');
  const app = document.getElementById('app');

  if (!dropOverlay || !app) return;

  let dragCounter = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (e.dataTransfer.types && e.dataTransfer.types[0] === 'Files') {
      dropOverlay.classList.remove('hidden');
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      dropOverlay.classList.add('hidden');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropOverlay.classList.add('hidden');

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (onFileDrop) onFileDrop(file);
    }
  });
}
