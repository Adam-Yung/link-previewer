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


function toggleParentPageOverflow(disable) {
  // Ensure body and documentElement exist before trying to access their style.
  if (!document.body || !document.documentElement) {
    throw new Error("Cannot toggle page overflow: document.body or document.documentElement is not available.");
  }

  if (disable === state.overflow.enabled) return;

  if (disable) {
    state.overflow.scrollPosition = window.scrollY || document.documentElement.scrollTop;
    document.body.style.position = 'fixed';
    document.body.style.overflow = 'hidden';
    // document.documentElement.style.overflow = 'hidden';
    document.body.style.top = `-${state.overflow.scrollPosition}px`;
    document.body.style.width = '100%';
  } else {
    document.body.style.removeProperty('overflow');
    // document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('width');
    window.scrollTo(0, state.overflow.scrollPosition);
  }
  state.overflow.enabled = disable;
}

function toggleDisableParentPage(disable) {
  // Find all required elements upfront. If any are missing, the function will stop and throw an error.
  const pageOverlay = findRequiredElement('link-preview-page-overlay');
  const previewHost = findRequiredElement('link-preview-host');

  // Ensure the host has a shadowRoot before searching within it.
  if (!previewHost.shadowRoot) {
    throw new Error("The '#link-preview-host' element does not have a shadowRoot.");
  }
  const clickInterceptor = findRequiredElement('link-preview-click-interceptor', previewHost.shadowRoot);

  // Check for document.body and document.head, which are critical for this function's operation.
  if (!document.body) throw new Error("document.body is not available.");
  if (!document.head) throw new Error("document.head is not available for adding styles.");

  let pauseStyle = null; // This remains managed within the closure.

  log(disable ? "Disabling Parent Page" : "Enabling Parent Page");

  if (disable) {
    document.body.style.pointerEvents = 'none';
    addPauseStyle();

    // Animate the overlay's opacity for a smooth fade-in effect.
    requestAnimationFrame(() => {
      pageOverlay.style.opacity = '1';
    });
    pageOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    pageOverlay.style.pointerEvents = 'auto';

    previewHost.style.pointerEvents = 'auto';
    clickInterceptor.style.pointerEvents = 'auto';
    clickInterceptor.addEventListener('click', closePreview);
  } else {
    document.body.style.pointerEvents = 'auto';
    disablePauseStyle();

    requestAnimationFrame(() => {
      pageOverlay.style.opacity = '0';
    });
    pageOverlay.style.backgroundColor = "transparent";
    pageOverlay.style.pointerEvents = 'none';

    previewHost.style.pointerEvents = 'none';
    clickInterceptor.style.pointerEvents = 'none';
    clickInterceptor.removeEventListener('click', closePreview);
  }

  toggleParentPageOverflow(disable);

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
    // No need to check for pauseStyle here because findRequiredElement on document.head would have already caught it.
    const styleElement = document.getElementById('link-preview-animation-pauzer');
    if (styleElement) {
      styleElement.remove();
      pauseStyle = null;
    }
  }
}