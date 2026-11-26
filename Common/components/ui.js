// components/ui.js

/**
 * Creates the link preview modal: overlay, shadow DOM container, iframe and controls.
 * With `hidden`, everything is built and the page starts loading, but nothing is shown and nothing on the host page changes until
 * revealPreview(); a long press uses this to load during the hold (see docs/code/Common/components/ui.js.md).
 * @param {string} url The URL to be loaded in the preview iframe.
 */
function createPreview(url, { hidden = false } = {}) {
  // Prevent multiple previews (also block during fade-out animation).
  if (state.isPreviewing || state.isClosing) return;
  if (hidden && url.startsWith('http://')) return;
  state.isPreviewing = true;

  // If the link is insecure HTTP, show a warning pop-up instead of a preview
  if (url.startsWith('http://')) {
    createHttpWarningPopup(url);
    return;
  }

  log(`Starting preview for: ${url}`);

  document.body.appendChild(createPageOverlay());

  const previewHost = document.createElement('div');
  previewHost.id = 'link-preview-host';
  document.body.appendChild(previewHost);
  const shadowRoot = previewHost.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('preview_style.css');
  shadowRoot.appendChild(styleLink);

  // Clicking outside the window (on this full-size layer) closes the preview in center stage.
  const clickInterceptor = document.createElement('div');
  clickInterceptor.id = 'link-preview-click-interceptor';
  shadowRoot.appendChild(clickInterceptor);

  const container = document.createElement('div');
  container.id = 'link-preview-container';
  container.classList.add(resolveTheme(settings.theme));
  container.style.pointerEvents = 'none';
  state.container = container;
  applyInitialGeometry(container);
  if (hidden) hideUntilReveal(previewHost, container);
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
        <span class="link-preview-url"></span>
        <button id="link-preview-copy" title="Copy URL">
            ${copyIcon}
            ${tickIcon}
        </button>
      </div>
      <div class="link-preview-controls">
        <button id="link-preview-restore" title="Center Stage Mode">${state.isExpanded ? minimizedIcon : maximizedIcon}</button>
        <button id="link-preview-enlarge" title="Open in new tab">${enlargeIcon}</button>
        <button id="link-preview-close" title="Close preview">${closeIcon}</button>
      </div>
    `;
  addressBar.querySelector('.link-preview-url').textContent = url;
  container.appendChild(addressBar);

  // Attach drag listener once on the address bar. Content element is looked up dynamically.
  addressBar.addEventListener('mousedown', (e) => {
    initDrag(e, container, shadowRoot.getElementById('link-preview-iframe') || shadowRoot.getElementById('link-preview-image'));
  });


  function renderUrl(urlToRender) {
    const urlSpan = shadowRoot.querySelector('.link-preview-url');
    const addressBar = shadowRoot.getElementById('link-preview-address-bar');
    const startTime = Date.now();

    if (urlSpan) {
      urlSpan.textContent = urlToRender;
    }

    const isImage = /\.(jpeg|jpg|gif|png|webp|svg|avif|bmp|ico)(\?|#|$)/i.test(urlToRender);
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
      img.style.pointerEvents = 'none';
      img.src = urlToRender;
      img.onload = () => {
        const remainingTime = Date.now() - startTime;
        setTimeout(() => {
          if (addressBar) {
            addressBar.classList.remove('is-loading', 'ocean-blue', 'ocean-orange', 'ocean-magenta');
          }
        }, Math.max(0, 1000 - remainingTime));
      };
      img.onerror = () => {
        if (addressBar) {
          addressBar.classList.remove('is-loading', 'ocean-blue', 'ocean-orange', 'ocean-magenta');
          addressBar.classList.add('load-failed');
        }
        img.remove();
        // Fallback: load in iframe since the URL might be a page, not an image
        const iframe = document.createElement('iframe');
        iframe.id = 'link-preview-iframe';
        iframe.name = 'link-previewer-frame';
        iframe.style.pointerEvents = 'none';
        container.appendChild(iframe);
        try {
          chrome.runtime.sendMessage({ action: message.prepareToPreview, url: urlToRender })
            .then(response => {
              if (response && response.ready) {
                iframe.src = urlToRender;
                iframe.onload = () => {
                  if (addressBar) {
                    addressBar.classList.remove('load-failed');
                  }
                };
                checkForIframeReady(iframe, shadowRoot);

              // Timeout: if iframe hasn't loaded in 15 seconds, show error
              const loadTimeout = setTimeout(() => {
                if (!iframe.classList.contains('loaded')) {
                  if (iframe._rafId) {
                    cancelAnimationFrame(iframe._rafId);
                    iframe._rafId = null;
                  }
                  iframe.classList.add('loaded');
                  if (addressBar) {
                    addressBar.classList.remove('is-loading', 'ocean-blue', 'ocean-orange', 'ocean-magenta');
                  }
                  const urlSpan = shadowRoot.querySelector('.link-preview-url');
                  if (urlSpan) {
                    urlSpan.textContent = 'Page took too long to load';
                  }
                }
              }, 15000);

              iframe.addEventListener('load', () => clearTimeout(loadTimeout), { once: true });
              }
            }).catch(() => {});
        } catch (e) {}
      };
      container.appendChild(img);
    } else {
      const iframe = document.createElement('iframe');
      iframe.id = 'link-preview-iframe';
      iframe.name = 'link-previewer-frame';
      iframe.style.pointerEvents = 'none';
      container.appendChild(iframe);
      try {
        chrome.runtime.sendMessage({ action: message.prepareToPreview, url: urlToRender })
          .then(response => {
            if (response && response.ready) {
              iframe.src = urlToRender;
              iframe.onload = () => {
                if (iframe._rafId) {
                  cancelAnimationFrame(iframe._rafId);
                  iframe._rafId = null;
                }
                iframe.classList.add('loaded');
                const remainingTime = Date.now() - startTime;
                setTimeout(() => {
                  if (addressBar) {
                    addressBar.classList.remove('is-loading', 'ocean-blue', 'ocean-orange', 'ocean-magenta');
                  }
                }, Math.max(0, 1000 - remainingTime));
              };
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

  function navigateTo(newUrl, oldUrl = "", historyNeedTruncate = true) {
    const currentUrl = oldUrl || state.historyManager.getCurrentUrl();
    if (newUrl.startsWith('http://')) {
      createHttpWarningPopup(newUrl, true);
      return;
    }
    if (historyNeedTruncate) state.historyManager.addNewEntry(newUrl);
    if (!isSameDocument(currentUrl, newUrl)) {
      renderUrl(newUrl);
      return;
    }
    // Only the fragment changed: setting src scrolls the frame to the anchor without reloading it.
    const iframe = shadowRoot.getElementById('link-preview-iframe');
    if (iframe) iframe.src = newUrl;
    const urlSpan = shadowRoot.querySelector('.link-preview-url');
    if (urlSpan) urlSpan.textContent = newUrl;
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
        previewTakeFocus(true);
    };
  };
  chrome.runtime.onMessage.addListener(messageListener);
  state.messageListener = messageListener;


  // Initial render
  renderUrl(url);

  // Create and attach resize handles for all directions.
  const resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  resizeHandles.forEach(dir => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${dir}`;
    container.appendChild(handle);
    handle.addEventListener('mousedown', (e) => {
      initResize(e, container, shadowRoot.getElementById('link-preview-iframe') || shadowRoot.getElementById('link-preview-image'), dir);
    });
  });



  // --- UI Event Listeners ---
  shadowRoot.getElementById('link-preview-close').addEventListener('click', closePreview);
  shadowRoot.getElementById('link-preview-enlarge').addEventListener('click', () => {
    const _url = shadowRoot.getElementById('link-preview-iframe')?.src || url;
    log(`Opening URL in new tab: ${_url}`);
    window.open(_url, '_blank');
    closePreview();
  });
  shadowRoot.getElementById('link-preview-restore').addEventListener('click', () => toggleCenterStage(container, shadowRoot));

  state.historyManager = new HistoryManager(shadowRoot, url, navigateTo);
  attachResizeHandler(container);
  attachContainerFocus(container);

  state.isSpeculative = true;
  if (!hidden) revealPreview();
}

/**
 * Switches between center stage and the pocket window, and remembers the choice.
 */
function toggleCenterStage(container, shadowRoot) {
  state.isExpanded = !state.isExpanded;
  if (state.isExpanded) {
    container.classList.add('is-centered');
    container.classList.remove('rendered');
    Object.assign(container.style, { width: '90vw', height: '90vh', top: '50%', left: '50%' });
    // Switch to non-transform centering once the class change has rendered.
    requestAnimationFrame(() => requestAnimationFrame(() => container.classList.add('rendered')));
  } else {
    container.classList.remove('is-centered', 'rendered');
    Object.assign(container.style, { width: settings.userWidth, height: settings.userHeight, top: settings.userTop, left: settings.userLeft });
  }
  shadowRoot.getElementById('link-preview-restore').innerHTML = state.isExpanded ? minimizedIcon : maximizedIcon;
  chrome.storage.local.set({ isExpanded: state.isExpanded });
  toggleDisableParentPage(state.isExpanded);
}

/**
 * The full-page layer that dims the host page in center stage. Outside the shadow root so it covers the page's own stacking contexts.
 */
function createPageOverlay() {
  const pageOverlay = document.createElement('div');
  pageOverlay.id = 'link-preview-page-overlay';
  Object.assign(pageOverlay.style, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: '2147483646',
    opacity: '0',
    transition: 'opacity 0.3s ease'
  });
  return pageOverlay;
}

/**
 * Hidden elements are not hit-tested, so a speculative preview cannot catch the click the user may still be making. The fade-in is
 * held back so it plays on reveal.
 */
function hideUntilReveal(previewHost, container) {
  document.getElementById('link-preview-page-overlay').style.visibility = 'hidden';
  previewHost.style.visibility = 'hidden';
  container.style.animation = 'none';
}

/**
 * Size and position from settings: center stage, or the user's last pocket geometry.
 */
function applyInitialGeometry(container) {
  state.isExpanded = settings.isExpanded;
  if (!state.isExpanded) {
    Object.assign(container.style, { width: settings.userWidth, height: settings.userHeight, top: settings.userTop, left: settings.userLeft });
    return;
  }
  Object.assign(container.style, { width: settings.width, height: settings.height, top: settings.top, left: settings.left });
  container.classList.add('is-centered');
  // After the fade-in, switch to margin-based centering: transform-based centering renders text blurry at sub-pixel offsets.
  container.addEventListener('animationend', () => {
    if (container.classList.contains('is-centered')) container.classList.add('rendered');
  }, { once: true });
}

/**
 * Shows a preview built by createPreview() and takes over the host page (close key, center-stage dimming).
 */
function revealPreview() {
  if (!state.isSpeculative) return;
  state.isSpeculative = false;
  clearTimeout(state.longClickTimer);
  const pageOverlay = document.getElementById('link-preview-page-overlay');
  const previewHost = document.getElementById('link-preview-host');
  if (pageOverlay) pageOverlay.style.visibility = '';
  if (previewHost) previewHost.style.visibility = '';
  state.container.style.animation = '';
  document.addEventListener('keydown', handleEsc);
  toggleDisableParentPage(isInCenterStage());
  checkIframeInBounds(state.container);
}

/**
 * Drops a preview that was never shown (the press ended early). Returns whether there was one.
 */
function discardSpeculativePreview() {
  if (!state.isSpeculative) return false;
  state.isSpeculative = false;
  attachResizeHandler();
  document.getElementById('link-preview-host')?.remove();
  document.getElementById('link-preview-page-overlay')?.remove();
  if (state.messageListener) {
    chrome.runtime.onMessage.removeListener(state.messageListener);
    state.messageListener = null;
  }
  chrome.runtime.sendMessage({ action: message.clearPreview }).catch(() => {});
  state.isPreviewing = false;
  return true;
}

/**
 * Whether two URLs differ only in their fragment. Unparseable URLs are never the same document.
 */
function isSameDocument(a, b) {
  try {
    const from = new URL(a);
    const to = new URL(b);
    return from.origin === to.origin && from.pathname === to.pathname && from.search === to.search;
  } catch {
    return false;
  }
}

/**
 * Closes the preview window and cleans up all related elements and event listeners.
 */
function closePreview() {
  if (!state.isPreviewing) return;

  state.isPreviewing = false;
  state.isClosing = true;

  toggleDisableParentPage(false);
  attachResizeHandler();
  scrollLock(false);

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
    if (state.messageListener) {
      chrome.runtime.onMessage.removeListener(state.messageListener);
      state.messageListener = null;
    }
    chrome.runtime.sendMessage({ action: message.clearPreview }).catch(() => {});
    state.isClosing = false;
  }, 200); // Delay should be slightly less than animation duration.
}


/**
 * Handles the keydown event to close the preview on 'Escape'.
 * @param {KeyboardEvent} e The keydown event.
 */
function handleEsc(e) {
  if (isCloseKey(e, settings.closeKey)) {
    closePreview();
  }
}

/**
 * Checks if an iframe's content has finished loading.
 * For cross-origin iframes, falls back to a timeout since contentDocument is inaccessible.
 * @param {HTMLIFrameElement} frame The iframe element to check.
 * @param {ShadowRoot} shadowRoot The shadow root containing the loader element.
 */
function checkForIframeReady(frame, shadowRoot) {
  let attempts = 0;
  const maxAttempts = 300; // ~5 seconds at 60fps

  function check() {
    attempts++;
    try {
      const iframeDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
      if (iframeDoc && (iframeDoc.readyState === 'interactive' || iframeDoc.readyState === 'complete')) {
        frame.classList.add('loaded');
        frame._rafId = null;
        return;
      }
    } catch (e) {
      // Cross-origin: can't access contentDocument, rely on onload event
      frame.classList.add('loaded');
      frame._rafId = null;
      return;
    }

    if (attempts < maxAttempts) {
      frame._rafId = requestAnimationFrame(check);
    } else {
      frame.classList.add('loaded');
      frame._rafId = null;
    }
  }

  frame._rafId = requestAnimationFrame(check);
}