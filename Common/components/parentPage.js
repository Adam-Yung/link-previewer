function toggleDisableParentPage(disable) {
  let pauseStyle = null;
  const pageOverlay = document.getElementById('link-preview-page-overlay');
  const previewHost = document.getElementById('link-preview-host');
  const clickInterceptor = previewHost && previewHost.shadowRoot.getElementById('link-preview-click-interceptor');

  if (disable) {
    document.body.style.pointerEvents = 'none'; // Disable pointer events on the main page.
    addPauseStyle();
    if (pageOverlay) {
      // Animate the overlay's opacity for a smooth fade-in effect.
      requestAnimationFrame(() => {
        pageOverlay.style.opacity = '1';
      });
      pageOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    }
    (clickInterceptor) && clickInterceptor.addEventListener('click', closePreview);

    state.originalBodyOverflow = document.body.style.overflow;
    state.originalDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  else {
    document.body.style.pointerEvents = 'auto';
    disablePauseStyle();
    if (pageOverlay) {
      requestAnimationFrame(() => {
        pageOverlay.style.opacity = '0';
      });
      pageOverlay.style.backgroundColor = "transparent";
    }
    (clickInterceptor) && clickInterceptor.removeEventListener('click', closePreview);

    document.body.style.overflow = state.originalBodyOverflow;
    document.documentElement.style.overflow = state.originalDocumentOverflow;
  }

  function addPauseStyle() {
    if (!pauseStyle) {
      pauseStyle = document.createElement('style');
      pauseStyle.id = 'link-preview-animation-pauzer';
      pauseStyle.innerHTML = `
          * {
            animation-play-state: paused !important;
            transition: none !important;
            transition-property: none !important;
            transform: none !important;
            scroll-behavior: auto !important;
          }`;
      document.head.appendChild(pauseStyle);
    }
  }

  function disablePauseStyle() {
    if (pauseStyle) {
      pauseStyle.remove();
      pauseStyle = null;
    }
  }
}