// components/ui.js

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

  // Create the host element for the shadow DOM.
  const previewHost = document.createElement('div');
  previewHost.id = 'link-preview-host';

  // Add the host to the body BEFORE hiding other elements
  document.body.appendChild(previewHost);

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
  container.style.pointerEvents = 'auto';
  state.container = container;

  // Apply size and position from settings.
  container.style.width = settings.width;
  container.style.height = settings.height;
  container.style.top = settings.top;
  container.style.left = settings.left;

  // If using percentage-based positioning, add a class for CSS transform-based centering.
  if (settings.top.includes('%') || settings.left.includes('%')) {
    container.classList.add('is-centered');
  }
  container.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if ((button) && (button.id === "link-preview-close" )) return;
    chrome.runtime.sendMessage({ action: message.focusPreview });
  })

  shadowRoot.appendChild(container);

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
        <button id="link-preview-restore" title="Center Stage Mode">${maximizedIcon}</button>
        <button id="link-preview-enlarge" title="Open in new tab">${enlargeIcon}</button>
        <button id="link-preview-close" title="Close preview">${closeIcon}</button>
      </div>
    `;
  container.appendChild(addressBar);


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


    if (isImage) {
      log("Previewing an image!");
      const img = document.createElement('img');
      img.id = 'link-preview-image';
      img.src = urlToRender;
      img.onload = () => {
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
        chrome.runtime.sendMessage({ action: message.prepareToPreview, url: urlToRender })
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


  function previewFocusHandler() {
    if (state.isPreviewFocused) {
      log(`Preview is being focused, disabling parent webpage overflow!`);
      scrollLockParentPage(true);
    }
    else {
      log(`Parent is being focused, enabling parent webpage overflow!`);
      scrollLockParentPage(false);
    }
  }
  window.addEventListener('focus', () => {
    state.isPreviewFocused = false;
    previewFocusHandler();
  });


  function navigateTo(newUrl, oldUrl = "", historyNeedTruncate = true) {
    const currentUrl = oldUrl || state.historyManager.getCurrentUrl();
    const currentUrlObj = new URL(currentUrl);
    const newUrlObj = new URL(newUrl);

    if (url.startsWith('http://')) {
      createHttpWarningPopup(url, true);
      return;
    }

    // Check if it's an in-page navigation (same origin and pathname, different hash)
    if (currentUrlObj.origin === newUrlObj.origin && currentUrlObj.pathname === newUrlObj.pathname) {
      const iframe = shadowRoot.getElementById('link-preview-iframe');
      if (iframe) {
        // Just updating the src with a new hash is efficient.
        // The browser will scroll to the new anchor without a full reload.
        iframe.src = newUrl;
      }

      if (historyNeedTruncate) state.historyManager.addNewEntry(newUrl);

      const urlSpan = shadowRoot.querySelector('.link-preview-url');
      if (urlSpan) {
        urlSpan.textContent = newUrl;
      }
      return; // Exit here to prevent calling renderUrl
    }

    // If we are navigating from a point in history, truncate the future history
    if (historyNeedTruncate) state.historyManager.addNewEntry(newUrl);

    renderUrl(newUrl);
  }

  const messageListener = (request) => {
    switch (request.action) {
      case message.updatePreviewUrl:
        navigateTo(request.url);
        break;
      case message.closePreviewFromIframe:
        closePreview();
        break;
      case message.iFrameHasFocus:
        state.isPreviewFocused = true;
        previewFocusHandler();
    };
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
    toggleDisableParentPage(true);
  });

  state.historyManager = new HistoryManager(shadowRoot, url, navigateTo)

  document.addEventListener('keydown', handleEsc);

  toggleDisableParentPage(isInCenterStage());
}

/**
 * Closes the preview window and cleans up all related elements and event listeners.
 */
function closePreview() {
  if (!state.isPreviewing) return;

  toggleDisableParentPage(false);

  const previewHost = document.getElementById('link-preview-host');
  const pageOverlay = document.getElementById('link-preview-page-overlay');

  // Trigger fade-out animations.
  if (previewHost) {
    const container = previewHost.shadowRoot.getElementById('link-preview-container');
    if (container) {
      container.style.animation = 'fadeOut 0.3s forwards ease-out';
    }
  }

  // After the animations, remove elements and restore the page state.
  setTimeout(() => {
    if (previewHost) previewHost.remove();
    if (pageOverlay) pageOverlay.remove();

    // Clean up global listeners and state.
    document.removeEventListener('keydown', handleEsc);
    chrome.runtime.sendMessage({ action: message.clearPreview }); // Tell background to clean up.
    state.isPreviewing = false;
    window.focus();
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
  } else {
    // If not ready, check again on the next animation frame.
    requestAnimationFrame(() => { checkForIframeReady(frame, shadowRoot) });
  }
}