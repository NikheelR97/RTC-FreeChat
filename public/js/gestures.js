export function setupGestures() {
  let touchStartX = 0;
  let touchEndX = 0;
  const minSwipeDistance = 75; // px

  const app = document.getElementById('app');
  const drawerOverlay = document.getElementById('drawer-overlay');

  if (!app) return;

  app.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  app.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleGesture();
    },
    { passive: true }
  );

  function handleGesture() {
    const distance = touchEndX - touchStartX;

    if (Math.abs(distance) < minSwipeDistance) return;

    if (distance > 0) {
      // Swipe Right -> Open Left Drawer (if not right drawer open)
      if (!document.body.classList.contains('drawer-open-right')) {
        document.body.classList.add('drawer-open-left');
      }
    } else {
      // Swipe Left -> Open Right Drawer (if not left drawer open)
      // or Close Left Drawer
      if (document.body.classList.contains('drawer-open-left')) {
        document.body.classList.remove('drawer-open-left');
      } else {
        document.body.classList.add('drawer-open-right');
      }
    }
  }

  // Tap overlay to close
  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', () => {
      document.body.classList.remove('drawer-open-left', 'drawer-open-right');
    });
  }

  // Connect buttons too
  document.getElementById('menu-btn')?.addEventListener('click', () => {
    document.body.classList.toggle('drawer-open-left');
  });

  document.getElementById('members-btn')?.addEventListener('click', () => {
    document.body.classList.toggle('drawer-open-right');
  });
}
