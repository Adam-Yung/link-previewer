// dist/utils/ui.js

/**
 * Recursively checks if an iframe's content has finished loading.
 * Once loaded, it adds a 'loaded' class to the iframe and hides the loading spinner.
 * @param {HTMLIFrameElement} frame The iframe element to check.
 * @param {ShadowRoot} shadowRoot The shadow root containing the loader element.
 */
function checkForIframeReady(frame, shadowRoot) {
  const iframeDoc = frame && (frame.contentDocument || (frame.contentWindow && frame.contentWindow.document));

  // Check if the iframe document is fully loaded or interactive.
  if (iframeDoc && (iframeDoc.readyState === 'interactive' || iframeDoc.readyState === 'complete')) {
    frame.classList.add('loaded'); // Add class for fade-in animation.
    // Hide the loader with a small delay to allow the fade-in to be smooth.
    setTimeout(() => {
      const loader = shadowRoot.getElementById('loader-container');
      if (loader) {
        loader.style.display = 'none';
      }
    }, 400);
  } else {
    // If not ready, check again on the next animation frame.
    requestAnimationFrame(() => { checkForIframeReady(frame, shadowRoot) });
  }
}

/**
 * Creates and displays the link preview modal.
 * This includes the overlay, shadow DOM container, iframe, and all UI controls.
 * @param {string} url The URL to be loaded in the preview iframe.
 */
function createPreview(url) {
  // Prevent multiple previews.
  if (state.isPreviewing) return;
  state.isPreviewing = true;
  clearTimeout(state.longClickTimer); // Cancel any pending long-click timer.

  // If the link is insecure HTTP, show a warning pop-up instead of a preview
  if (url.startsWith('http://')) {
    createHttpWarningPopup(url);
    return;
  }

  log(`Starting preview for: ${url}`);
  // NEW: Save scroll position before applying any styles
  state.scrollX = window.scrollX;
  state.scrollY = window.scrollY;


  // Store original page overflow styles and then disable scrolling on the main page.
  state.originalBodyOverflow = document.body.style.overflow;
  state.originalDocumentOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // Clear any previous states
  state.originalVisibilityStates = [];

  // Create a full-page overlay to dim the background.
  const pageOverlay = document.createElement('div');
  pageOverlay.id = 'link-preview-page-overlay';
  Object.assign(pageOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: '2147483646', // High z-index to be on top of most elements.
    opacity: '0',
    transition: 'opacity 0.3s ease'
  });
  document.body.appendChild(pageOverlay);

  // Inject a style tag to pause all animations and transitions on the host page.
  // This improves performance and prevents distracting movements in the background.
  const pauseStyle = document.createElement('style');
  pauseStyle.id = 'link-preview-animation-pauzer';
  pauseStyle.innerHTML = `
    /* Hide GIFs to prevent them from constantly redrawing */
    img[src$=".gif"] {
      visibility: hidden !important;
    }
    /* Pause all CSS animations and transitions */
    * {
      animation-play-state: paused !important;
      transition: none !important;
      transition-property: none !important;
      transform: none !important;
      scroll-behavior: auto !important;
    }`;
  document.head.appendChild(pauseStyle);
  document.body.style.pointerEvents = 'none'; // Disable pointer events on the main page.

  // Create the host element for the shadow DOM.
  const previewHost = document.createElement('div');
  previewHost.id = 'link-preview-host';
  previewHost.style.pointerEvents = 'auto'; // Re-enable pointer events for the preview itself.
  // Add the host to the body BEFORE hiding other elements
  document.body.appendChild(previewHost);

  // Save original states and then hide elements
  for (const child of document.body.children) {
    if (child.id !== 'link-preview-host' && child.tagName !== 'SCRIPT') {
      // Save the original value (even if it's empty)
      state.originalVisibilityStates.push({
        element: child,
        originalValue: child.style.getPropertyValue('content-visibility')
      });
      // Now, set the new value
      child.style.setProperty('content-visibility', 'auto', 'important');
    }
  }

  // Animate the overlay's opacity for a smooth fade-in effect.
  requestAnimationFrame(() => {
    pageOverlay.style.opacity = '1';
  });

  // Attach a shadow root to encapsulate the preview's styles and DOM.
  const shadowRoot = previewHost.attachShadow({ mode: 'open' });

  // Link the external stylesheet for the preview UI inside the shadow DOM.
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('preview_style.css');
  shadowRoot.appendChild(styleLink);

  // Create a click interceptor inside the shadow DOM to close the preview when clicking outside the container.
  const clickInterceptor = document.createElement('div');
  clickInterceptor.id = 'link-preview-click-interceptor';
  shadowRoot.appendChild(clickInterceptor);

  // Create the main container for the preview window.
  const container = document.createElement('div');
  container.id = 'link-preview-container';
  container.classList.add(settings.theme);

  // Apply size and position from settings.
  container.style.width = settings.width;
  container.style.height = settings.height;
  container.style.top = settings.top;
  container.style.left = settings.left;

  // If using percentage-based positioning, add a class for CSS transform-based centering.
  if (settings.top.includes('%') || settings.left.includes('%')) {
    container.classList.add('is-centered');
  }

  shadowRoot.appendChild(container);

  // History for back/forward functionality
  let history = [url];
  let historyIndex = 0;

  // Create the address bar with URL display and control buttons.
  const addressBar = document.createElement('div');
  addressBar.id = 'link-preview-address-bar';
  addressBar.innerHTML = `
      <div class="link-preview-nav-controls">
        <button id="link-preview-back" title="Go back" disabled>${backIcon}</button>
        <button id="link-preview-forward" title="Go forward" disabled>${forwardIcon}</button>
      </div>
      <div class="url-container">
        <span class="link-preview-url">${url}</span>
        <button id="link-preview-copy" title="Copy URL">
            ${copyIcon}
            ${tickIcon}
        </button>
      </div>
      <div class="link-preview-controls">
        <button id="link-preview-restore" title="Restore default size and position">${restoreIcon}</button>
        <button id="link-preview-enlarge" title="Open in new tab">${enlargeIcon}</button>
        <button id="link-preview-close" title="Close preview">${closeIcon}</button>
      </div>
    `;
  container.appendChild(addressBar);

  const backButton = shadowRoot.getElementById('link-preview-back');
  const forwardButton = shadowRoot.getElementById('link-preview-forward');
  const copyButton = shadowRoot.getElementById('link-preview-copy');

  function updateNavButtons() {
    backButton.disabled = historyIndex === 0;
    forwardButton.disabled = historyIndex >= history.length - 1;
  }

  // Create the loading spinner.
  const loader = document.createElement('div');
  loader.id = 'loader-container';
  loader.innerHTML = `<div class="loader"></div>`;
  container.appendChild(loader);

  function renderUrl(urlToRender) {
    const urlSpan = shadowRoot.querySelector('.link-preview-url');
    const addressBar = shadowRoot.getElementById('link-preview-address-bar');
    const startTime = Date.now();

    if (urlSpan) {
      urlSpan.textContent = urlToRender;
    }

    const isImage = /.*\.(jpeg|jpg|gif|png)$/i.test(urlToRender);
    const existingIframe = shadowRoot.getElementById('link-preview-iframe');
    const existingImage = shadowRoot.getElementById('link-preview-image');

    if (existingIframe) existingIframe.remove();
    if (existingImage) existingImage.remove();

    if (addressBar && settings.loadingAnimation !== 'off') {
      addressBar.classList.add('is-loading', `ocean-${settings.loadingAnimation}`);
    }

    const loader = shadowRoot.getElementById('loader-container');
    if (loader) loader.style.display = 'flex';


    if (isImage) {
      log("Previewing an image!");
      const img = document.createElement('img');
      img.id = 'link-preview-image';
      img.src = urlToRender;
      img.onload = () => {
        if (loader) {
          loader.style.display = 'none';
        }
        const remainingTime = Date.now() - startTime;
        setTimeout(() => {
          if (addressBar) {
            addressBar.classList.remove('is-loading', 'ocean-blue', 'ocean-orange', 'ocean-magenta');
          }
        }, Math.max(0, 1000 - remainingTime));
      };
      container.appendChild(img);
      addressBar.addEventListener('mousedown', (e) => initDrag(e, container, img));
    } else {
      const iframe = document.createElement('iframe');
      iframe.id = 'link-preview-iframe';
      container.appendChild(iframe);
      addressBar.addEventListener('mousedown', (e) => initDrag(e, container, iframe));
      try {
        chrome.runtime.sendMessage({ action: 'prepareToPreview', url: urlToRender })
          .then(response => {
            if (response && response.ready) {
              iframe.src = urlToRender;
              iframe.onload = () => {
                const remainingTime = Date.now() - startTime;
                setTimeout(() => {
                  if (addressBar) {
                    addressBar.classList.remove('is-loading', 'ocean-blue', 'ocean-orange', 'ocean-magenta');
                  }
                }, Math.max(0, 1000 - remainingTime));
              }
              checkForIframeReady(iframe, shadowRoot);
            } else {
              log('Background script not ready.', LOGGING.ERROR);
              showContextExpiredPopup();
            }
          }).catch(error => {
            log(`Error sending prepareToPreview message: ${error}`, LOGGING.ERROR);
            showContextExpiredPopup();
          });
      } catch (error) {
        log(`Error: ${error}`, LOGGING.ERROR);
        showContextExpiredPopup();
      }
    }
  }

  function truncateHistory(newUrl) {
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    history.push(newUrl);
    historyIndex = history.length - 1;
    updateNavButtons();
  }

  function navigateTo(newUrl, oldUrl = "", historyNeedTruncate=true) {
    const currentUrl = oldUrl || history[historyIndex];
    const currentUrlObj = new URL(currentUrl);
    const newUrlObj = new URL(newUrl);

    // Check if it's an in-page navigation (same origin and pathname, different hash)
    if (currentUrlObj.origin === newUrlObj.origin && currentUrlObj.pathname === newUrlObj.pathname) {
      const iframe = shadowRoot.getElementById('link-preview-iframe');
      if (iframe) {
        // Just updating the src with a new hash is efficient.
        // The browser will scroll to the new anchor without a full reload.
        iframe.src = newUrl;
      }

      if (historyNeedTruncate) truncateHistory(newUrl);

      const urlSpan = shadowRoot.querySelector('.link-preview-url');
      if (urlSpan) {
        urlSpan.textContent = newUrl;
      }
      return; // Exit here to prevent calling renderUrl
    }

    // If we are navigating from a point in history, truncate the future history
    if (historyNeedTruncate) truncateHistory(newUrl);

    renderUrl(newUrl);
  }

  backButton.addEventListener('click', () => {
    if (historyIndex > 0) {
      const old_url = history[historyIndex];
      historyIndex--;
      navigateTo(history[historyIndex], old_url, false);
      updateNavButtons();
    }
  });

  forwardButton.addEventListener('click', () => {
    if (historyIndex < history.length - 1) {
      const old_url = history[historyIndex];
      historyIndex++;
      navigateTo(history[historyIndex], old_url, false);
      updateNavButtons();
    }
  });

  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(history[historyIndex]).then(() => {
      if (!copyButton.classList.contains('copied')) {
        copyButton.classList.add('copied');
        setTimeout(() => copyButton.classList.remove('copied'), 1500);
      }
    });
  });

  const messageListener = (request) => {
    if (request.action === 'updatePreviewUrl') {
      navigateTo(request.url);
    }
    else if (request.action === 'closePreviewFromIframe') {
      closePreview();
    }

  };
  chrome.runtime.onMessage.addListener(messageListener);


  // Initial render
  renderUrl(url);

  // Create and attach resize handles for all directions.
  const resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  resizeHandles.forEach(dir => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${dir}`;
    container.appendChild(handle);
    handle.addEventListener('mousedown', (e) => initResize(e, container, container.querySelector('iframe, img'), dir));
  });



  // --- UI Event Listeners ---
  shadowRoot.getElementById('link-preview-close').addEventListener('click', closePreview);
  shadowRoot.getElementById('link-preview-enlarge').addEventListener('click', () => {
    const _url = shadowRoot.getElementById('link-preview-iframe')?.src || url;
    log(`Opening URL in new tab: ${_url}`);
    window.open(_url, '_blank');
    closePreview();
  });
  // Restore the preview window to its default size and position and save it.
  shadowRoot.getElementById('link-preview-restore').addEventListener('click', () => {
    container.style.width = '90vw';
    container.style.height = '90vh';
    container.style.top = '50%';
    container.style.left = '50%';
    container.classList.add('is-centered');
    // Save the restored state to storage.
    chrome.storage.local.set({
      width: container.style.width,
      height: container.style.height,
      top: container.style.top,
      left: container.style.left
    });
  });

  clickInterceptor.addEventListener('click', closePreview);
  document.addEventListener('keydown', handleEsc);
}

/**
* Creates a generic, styled pop-up for warnings or information.
* @param {object} options - Configuration for the popup.
* @param {string} options.id - The ID for the popup element.
* @param {string} options.icon - SVG string for the icon.
* @param {string} options.title - The title of the popup.
* @param {string} options.message - The main message body.
* @param {Array<object>} options.buttons - Array of button configurations.
* - {string} id - The ID for the button.
* - {string} text - The text content of the button.
* - {function} onClick - The click handler for the button.
*/
function createWarningPopup({ id, icon, title, message, buttons }) {
  // Create a full-page overlay to dim the background.
  const overlay = document.createElement('div');
  overlay.id = `${id}-overlay`;
  overlay.className = 'link-preview-warning-overlay';
  document.body.appendChild(overlay);

  // Create the pop-up container
  const popup = document.createElement('div');
  popup.id = id;
  popup.className = 'link-preview-warning-popup';
  popup.classList.add(settings.theme); // Add theme class for styling

  // Generate button HTML
  const buttonsHTML = buttons.map(btn => `<button id="${btn.id}">${btn.text}</button>`).join('');

  // Set the complete inner HTML for the popup.
  popup.innerHTML = `
        <div class="popup-header">
            ${icon}
            <h3>${title}</h3>
        </div>
        <p>${message}</p>
        <div class="link-preview-popup-buttons">
            ${buttonsHTML}
        </div>
    `;
  document.body.appendChild(popup);

  // --- Event Handlers & Cleanup ---
  const closePopup = () => {
    popup.remove();
    overlay.remove();
    document.removeEventListener('keydown', handleWarningEsc);
    state.isPreviewing = false; // Reset the flag to allow new previews.
  };

  const handleWarningEsc = (e) => {
    if (e.key === settings.closeKey) {
      closePopup();
    }
  };

  // Attach event listeners
  buttons.forEach(btnConfig => {
    popup.querySelector(`#${btnConfig.id}`).addEventListener('click', () => {
      btnConfig.onClick();
      closePopup(); // Close popup after any button click
    });
  });

  overlay.addEventListener('click', closePopup);
  document.addEventListener('keydown', handleWarningEsc);
}

/**
 * Shows a specific warning popup for insecure HTTP links.
 * @param {string} url - The insecure URL.
 */
function createHttpWarningPopup(url) {
  createWarningPopup({
    id: 'link-preview-http-warning',
    icon: warningIcon,
    title: 'Insecure Link',
    message: 'Previews are disabled for non-encrypted (HTTP) pages for your security.',
    buttons: [
      { id: 'warning-cancel', text: 'Cancel', onClick: () => { } },
      { id: 'warning-open', text: 'Open in New Tab', onClick: () => window.open(url, '_blank') }
    ]
  });
}

/**
 * Shows a popup informing the user that the extension context is lost and the page needs to be reloaded.
 */
function showContextExpiredPopup() {
  // First, ensure any existing preview elements are cleaned up.
  closePreview();

  createWarningPopup({
    id: 'link-preview-context-warning',
    icon: expiredIcon,
    title: 'Context Expired',
    message: 'Link Previewer needs to be re-initialized. Please reload the page to continue using previews.',
    buttons: [
      { id: 'context-cancel', text: 'Dismiss', onClick: () => { } },
      { id: 'context-reload', text: 'Reload Page', onClick: () => window.location.reload() }
    ]
  });
}


/**
 * Closes the preview window and cleans up all related elements and event listeners.
 */
function closePreview() {
  if (!state.isPreviewing) return;

  const previewHost = document.getElementById('link-preview-host');
  const pageOverlay = document.getElementById('link-preview-page-overlay');
  const pauseStyle = document.getElementById('link-preview-animation-pauzer');

  // Trigger fade-out animations.
  if (previewHost) {
    const container = previewHost.shadowRoot.getElementById('link-preview-container');
    if (container) {
      container.style.animation = 'fadeOut 0.3s forwards ease-out';
    }
  }
  if (pageOverlay) { pageOverlay.style.opacity = '0'; }

  // After the animations, remove elements and restore the page state.
  setTimeout(() => {
    if (previewHost) previewHost.remove();
    if (pageOverlay) pageOverlay.remove();
    if (pauseStyle) pauseStyle.remove();

    // Restore the original content-visibility states
    for (const s of state.originalVisibilityStates) {
      s.element.style.setProperty('content-visibility', s.originalValue);
    }
    // Clean up the array
    state.originalVisibilityStates = [];

    // Restore page functionality.
    document.body.style.pointerEvents = 'auto';
    document.body.style.overflow = state.originalBodyOverflow;
    document.documentElement.style.overflow = state.originalDocumentOverflow;

    // NEW: Restore scroll position
    window.scrollTo(state.scrollX, state.scrollY);

    // Clean up global listeners and state.
    document.removeEventListener('keydown', handleEsc);
    chrome.runtime.sendMessage({ action: 'clearPreview' }); // Tell background to clean up.
    state.isPreviewing = false;
  }, 200); // Delay should be slightly less than animation duration.
}


/**
 * Handles the keydown event to close the preview on 'Escape'.
 * @param {KeyboardEvent} e The keydown event.
 */
function handleEsc(e) {
  if (e.key === settings.closeKey) {
    closePreview();
  }
}