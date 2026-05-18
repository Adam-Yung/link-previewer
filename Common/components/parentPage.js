/**
 * A helper function to find an element by its ID. Throws a descriptive error if not found.
 * @param {string} id - The ID of the element to find.
 * @param {Document|ShadowRoot} [parent=document] - The document or shadow DOM to search within.
 * @returns {HTMLElement} The found element.
 * @throws {Error} If the element is not found.
 */
function findRequiredElement(id, parent = document) {
  const element = parent.getElementById(id);
  if (!element) {
    throw new Error(`Required DOM element with ID '#${id}' was not found.`);
  }
  return element;
}

const scrollLockState = {
  isLocked: false,
  parentOverflow: ''
};

function scrollLock(disable) {
  if (disable === scrollLockState.isLocked) {
    return;
  }
  const htmlElement = document.documentElement;
  log(`scrollLock Called! locking: ${disable}`);

  if (disable) {
    scrollLockState.parentOverflow = htmlElement.style.overflow;
    htmlElement.style.overflow = 'hidden';
  } else {
    htmlElement.style.overflow = scrollLockState.parentOverflow;
  }
  scrollLockState.isLocked = disable;
}


let pauseStyle = null;

function toggleDisableParentPage(disable) {
  if (!disable) {
    // Teardown path: use non-throwing lookups since elements may already be removed
    document.body.style.pointerEvents = 'auto';
    disablePauseStyle();

    const pageOverlay = document.getElementById('link-preview-page-overlay');
    const previewHost = document.getElementById('link-preview-host');

    if (pageOverlay) {
      requestAnimationFrame(() => { pageOverlay.style.opacity = '0'; });
      pageOverlay.style.backgroundColor = "transparent";
      pageOverlay.style.pointerEvents = 'none';
    }

    if (previewHost) {
      previewHost.style.pointerEvents = 'none';
      const clickInterceptor = previewHost.shadowRoot?.getElementById('link-preview-click-interceptor');
      if (clickInterceptor) {
        clickInterceptor.style.pointerEvents = 'none';
        clickInterceptor.removeEventListener('click', closePreview);
      }
    }
    return;
  }

  // Enable path: elements must exist
  const pageOverlay = findRequiredElement('link-preview-page-overlay');
  const previewHost = findRequiredElement('link-preview-host');

  if (!previewHost.shadowRoot) {
    throw new Error("The '#link-preview-host' element does not have a shadowRoot.");
  }
  const clickInterceptor = findRequiredElement('link-preview-click-interceptor', previewHost.shadowRoot);

  if (!document.body) throw new Error("document.body is not available.");
  if (!document.head) throw new Error("document.head is not available for adding styles.");

  log("Disabling Parent Page");

  document.body.style.pointerEvents = 'none';
  addPauseStyle();

  requestAnimationFrame(() => {
    pageOverlay.style.opacity = '1';
  });
  pageOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  pageOverlay.style.pointerEvents = 'auto';

  previewHost.style.pointerEvents = 'auto';
  clickInterceptor.style.pointerEvents = 'auto';
  clickInterceptor.addEventListener('click', closePreview);

  function addPauseStyle() {
    if (!pauseStyle) {
      pauseStyle = document.createElement('style');
      pauseStyle.id = 'link-preview-animation-pauzer';
      pauseStyle.innerHTML = `
              body *:not(#link-preview-host):not(#link-preview-host *) {
                animation-play-state: paused !important;
                transition: none !important;
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