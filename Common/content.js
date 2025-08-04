// content.js

/**
 * Debugging Code
 */

const ALLOW_DEBUGGING = true;

const LOGGING = {
  INFO: 0,
  LOG: 1,
  ERROR: 2,
};

// A simple function to format the date
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function log(msg, level = LOGGING.LOG) {
  if (!ALLOW_DEBUGGING) return;
  const time = new Date();
  const message = `${formatDate(time)}:\n[CONTENT] ${msg}`;
  switch (level) {
    case LOGGING.INFO:
      console.info(message);
      break;
    case LOGGING.LOG:
      console.log(message);
      break;
    case LOGGING.ERROR:
      console.error(message);
      break;
  }
}


// Check if this script is running inside an iframe
if (window.self !== window.top) {
  // Listen for 'mousedown' to initiate either a long-press or a modifier-key preview.
  // Using the capture phase (true) to catch the event early.
  document.addEventListener('mousedown', e => {
    const link = e.target.closest('a');
    // Check if the target is a valid link to preview.
    if (link && link.href && !link.href.startsWith('javascript:')) {
      const url = link.href;
      log(`User clicked a link inside of the iFrame: ${url}`);
      chrome.runtime.sendMessage({ action: 'updatePreviewUrl', url: url })
    }
  }, true);
}
else {
  // Timer for detecting a long click on a link.
  let longClickTimer;
  // Flag to prevent multiple previews from opening simultaneously.
  let isPreviewing = false;
  // Default settings for the preview window. These can be overridden by user settings from chrome.storage.
  let settings = {
    duration: 500,       // Milliseconds for a long press to trigger the preview.
    modifier: 'shiftKey',// Modifier key (e.g., 'shiftKey', 'ctrlKey', 'altKey') to trigger preview on click.
    theme: 'light',      // The color theme for the preview window ('light' or 'dark').
    closeKey: 'Escape',  // Key to close the preview window.
    width: '90vw',       // Default width of the preview window.
    height: '90vh',      // Default height of the preview window.
    top: '50%',          // Default top position.
    left: '50%',          // Default left position.
    disabledSites: []    // Array of disabled hostnames.
  };

  // Variables to store the original overflow styles of the page to restore them later.
  let originalBodyOverflow;
  let originalDocumentOverflow;
  let originalVisibilityStates = [];
  let isCurrentSiteDisabled = false;
  // NEW: Variables to store scroll position
  let scrollX = 0;
  let scrollY = 0;


  // --- Initialization ---

  // Load user settings from chrome.storage and check if this site is disabled.
  chrome.storage.local.get(settings).then(loadedSettings => {
    Object.assign(settings, loadedSettings);
    // Check if the current page's hostname is in the disabled list.
    if (Array.isArray(settings.disabledSites)) {
      isCurrentSiteDisabled = settings.disabledSites.includes(window.location.hostname);
    }
  });

  // Listen for changes in storage and update the local settings object in real-time.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      let settingsChanged = false;
      for (let key in changes) {
        if (settings.hasOwnProperty(key)) {
          settings[key] = changes[key].newValue;
          settingsChanged = true;
        }
      }
      if (settingsChanged && Array.isArray(settings.disabledSites)) {
        isCurrentSiteDisabled = settings.disabledSites.includes(window.location.hostname);
      }
    }
  });


  /**
   * Recursively checks if an iframe's content has finished loading.
   * Once loaded, it adds a 'loaded' class to the iframe and hides the loading spinner.
   * @param {HTMLIFrameElement} frame The iframe element to check.
   * @param {ShadowRoot} shadowRoot The shadow root containing the loader element.
   */
  function checkForIframeReady(frame, shadowRoot) {
    const iframeDoc = frame.contentDocument || frame.contentWindow.document;

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
    if (isPreviewing) return;
    isPreviewing = true;
    clearTimeout(longClickTimer); // Cancel any pending long-click timer.

    // If the link is insecure HTTP, show a warning pop-up instead of a preview
    if (url.startsWith('http://')) {
      createHttpWarningPopup(url);
      return;
    }

    log(`Starting preview for: ${url}`);
    // NEW: Save scroll position before applying any styles
    scrollX = window.scrollX;
    scrollY = window.scrollY;


    // Store original page overflow styles and then disable scrolling on the main page.
    originalBodyOverflow = document.body.style.overflow;
    originalDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Clear any previous states
    originalVisibilityStates = [];

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
        originalVisibilityStates.push({
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

    // Create the address bar with URL display and control buttons.
    const addressBar = document.createElement('div');
    addressBar.id = 'link-preview-address-bar';
    addressBar.innerHTML = `
    <span class="link-preview-url">${url}</span>
    <div class="link-preview-controls">
      <button id="link-preview-restore" title="Restore default size and position">&#x26F6;</button>
      <button id="link-preview-enlarge" title="Open in new tab">↗</button>
      <button id="link-preview-close" title="Close preview">×</button>
    </div>
  `;
    container.appendChild(addressBar);

    // Create the loading spinner.
    const loader = document.createElement('div');
    loader.id = 'loader-container';
    loader.innerHTML = `<div class="loader"></div>`;
    container.appendChild(loader);

    // Check if the URL is an image.
    log("Checking if link is an image!");
    if (/.*\.(jpeg|jpg|gif|png)$/i.test(url)) {
      log("Previewing an image!");
      const img = document.createElement('img');
      img.id = 'link-preview-image';
      img.src = url;
      img.onload = () => {
        // Hide the loader when the image is loaded.
        const loader = shadowRoot.getElementById('loader-container');
        if (loader) {
          loader.style.display = 'none';
        }
      };
      container.appendChild(img);
      addressBar.addEventListener('mousedown', (e) => initDrag(e, container, img));
    } else {
      // Create the iframe where the link content will be loaded.
      const iframe = document.createElement('iframe');
      iframe.id = 'link-preview-iframe';
      // Add the sandbox attribute specifically for Firefox
      if (typeof browser !== 'undefined') {
        iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation';
      }
      container.appendChild(iframe);
      window.scrollTo(scrollX, scrollY);
      // Enable dragging of the preview window via the address bar.
      addressBar.addEventListener('mousedown', (e) => initDrag(e, container, iframe));

      // Send a message to the background script to prepare for the preview (e.g., modify headers).
      chrome.runtime.sendMessage({ action: 'prepareToPreview', url: url })
        .then(response => {
          if (response && response.ready) {
            // Once the background script is ready, set the iframe source.
            iframe.src = url;
            checkForIframeReady(iframe, shadowRoot);
          } else {
            log('Background script not ready.', LOGGING.ERROR);
            closePreview();
          }
        });
    }

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
      window.open(url, '_blank');
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
   * Creates a sleek, styled pop-up to warn users about insecure HTTP links.
   * This pop-up provides options to either cancel the action or open the link in a new tab.
   * @param {string} url The insecure URL that triggered the warning.
   */
  function createHttpWarningPopup(url) {
    // Create a full-page overlay to dim the background.
    const overlay = document.createElement('div');
    overlay.id = 'link-preview-warning-overlay';
    document.body.appendChild(overlay);

    // Create the pop-up container
    const popup = document.createElement('div');
    popup.id = 'link-preview-http-warning-popup';
    popup.classList.add(settings.theme); // Add theme class for styling

    // Define the SVG icon for the warning.
    const warningIconSVG = `
    <svg class="warning-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  `;

    // Set the complete inner HTML for the popup.
    popup.innerHTML = `
    ${warningIconSVG}
    <h3>Insecure Link</h3>
    <p>Link Previewer thinks non-encrypted (HTTP) connections are scary</p>
    <div class="link-preview-popup-buttons">
      <button id="warning-cancel">Cancel</button>
      <button id="warning-open">Open in New Tab</button>
    </div>
  `;
    document.body.appendChild(popup);

    // --- Event Handlers & Cleanup ---

    // Define a single function to close the popup and clean up listeners.
    const closeWarningPopup = () => {
      popup.remove();
      overlay.remove();
      document.removeEventListener('keydown', handleWarningEsc);
      isPreviewing = false; // Reset the flag to allow new previews.
    };

    // Handler for the 'Escape' key.
    const handleWarningEsc = (e) => {
      if (e.key === settings.closeKey) {
        closeWarningPopup();
      }
    };

    // Attach all event listeners.
    popup.querySelector('#warning-cancel').addEventListener('click', closeWarningPopup);
    popup.querySelector('#warning-open').addEventListener('click', () => {
      window.open(url, '_blank');
      closeWarningPopup();
    });
    overlay.addEventListener('click', closeWarningPopup);
    document.addEventListener('keydown', handleWarningEsc);
  }


  /**
   * Converts percentage-based or centered positioning to absolute pixel values.
   * This is necessary before starting a drag or resize operation to ensure smooth interaction.
   * @param {HTMLElement} element The element to convert (the preview container).
   */
  function convertToPixels(element) {
    // If the element is centered using transforms, calculate its absolute pixel position.
    if (element.classList.contains('is-centered')) {
      const rect = element.getBoundingClientRect();
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      element.style.width = `${rect.width}px`;
      element.style.height = `${rect.height}px`;
      element.classList.remove('is-centered'); // Remove the class that applies the transform.
      element.style.animation = 'none'; // Disable animations that might interfere.
    }
  }

  /**
   * Initializes the dragging functionality for the preview window.
   * @param {MouseEvent} e The initial mousedown event.
   * @param {HTMLElement} element The element to be dragged (the preview container).
   * @param {HTMLElement} contentElement The iframe or image inside the container.
   */
  function initDrag(e, element, contentElement) {
    // Only allow dragging with the primary mouse button and not on control buttons.
    if (e.button !== 0 || e.target.closest('button')) {
      return;
    }
    e.preventDefault();
    convertToPixels(element); // Ensure positioning is in pixels.

    // Calculate the initial offset of the mouse from the element's top-left corner.
    const offsetX = e.clientX - element.offsetLeft;
    const offsetY = e.clientY - element.offsetTop;

    // Disable pointer events on the content element to prevent it from capturing mouse events during drag.
    if (contentElement) {
      contentElement.style.pointerEvents = 'none';
    }

    /**
     * Updates the element's position as the mouse moves.
     * @param {MouseEvent} e The mousemove event.
     */
    function doDrag(e) {
      element.style.left = `${e.clientX - offsetX}px`;
      element.style.top = `${e.clientY - offsetY}px`;
    }

    /**
     * Cleans up event listeners and saves the final position when dragging stops.
     */
    function stopDrag() {
      // Re-enable pointer events on the content element.
      if (contentElement) {
        contentElement.style.pointerEvents = 'auto';
      }
      document.documentElement.removeEventListener('mousemove', doDrag, false);
      document.documentElement.removeEventListener('mouseup', stopDrag, false);

      // Save the new position to user settings.
      chrome.storage.local.set({
        top: element.style.top,
        left: element.style.left
      });
    }

    // Add the listeners to the entire document to handle mouse movement anywhere on the page.
    document.documentElement.addEventListener('mousemove', doDrag, false);
    document.documentElement.addEventListener('mouseup', stopDrag, false);
  }


  /**
   * Initializes the resizing functionality for the preview window.
   * @param {MouseEvent} e The initial mousedown event.
   * @param {HTMLElement} element The element to be resized (the preview container).
   * @param {HTMLElement} contentElement The iframe or image inside the container.
   * @param {string} dir The direction of the resize (e.g., 'n', 'se', 'w').
   */
  function initResize(e, element, contentElement, dir) {
    e.preventDefault();
    convertToPixels(element); // Ensure dimensions and position are in pixels.
    if (contentElement) {
      contentElement.style.pointerEvents = 'none'; // Disable content interaction during resize.
    }


    // Store initial dimensions and mouse position.
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.offsetWidth;
    const startHeight = element.offsetHeight;
    const startLeft = element.offsetLeft;
    const startTop = element.offsetTop;

    /**
     * Updates the element's size and position as the mouse moves.
     * @param {MouseEvent} e The mousemove event.
     */
    function doDrag(e) {
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      // Calculate new width, height, and position based on the resize direction.
      if (dir.includes('e')) { newWidth = startWidth + e.clientX - startX; }
      if (dir.includes('w')) {
        newWidth = startWidth - (e.clientX - startX);
        newLeft = startLeft + e.clientX - startX;
      }
      if (dir.includes('s')) { newHeight = startHeight + e.clientY - startY; }
      if (dir.includes('n')) {
        newHeight = startHeight - (e.clientY - startY);
        newTop = startTop + e.clientY - startY;
      }

      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
    }

    /**
     * Cleans up event listeners and saves the final size and position when resizing stops.
     */
    function stopDrag() {
      if (contentElement) {
        contentElement.style.pointerEvents = 'auto'; // Re-enable content interaction.
      }
      document.documentElement.removeEventListener('mousemove', doDrag, false);
      document.documentElement.removeEventListener('mouseup', stopDrag, false);

      // Save the new dimensions and position to user settings.
      chrome.storage.local.set({
        width: element.style.width,
        height: element.style.height,
        top: element.style.top,
        left: element.style.left
      });
    }
    // Add listeners to the document to handle resizing from anywhere on the page.
    document.documentElement.addEventListener('mousemove', doDrag, false);
    document.documentElement.addEventListener('mouseup', stopDrag, false);
  }

  /**
   * Closes the preview window and cleans up all related elements and event listeners.
   */
  function closePreview() {
    if (!isPreviewing) return;

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
      for (const state of originalVisibilityStates) {
        state.element.style.setProperty('content-visibility', state.originalValue);
      }
      // Clean up the array
      originalVisibilityStates = [];

      // Restore page functionality.
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalDocumentOverflow;

      // NEW: Restore scroll position
      window.scrollTo(scrollX, scrollY);

      // Clean up global listeners and state.
      document.removeEventListener('keydown', handleEsc);
      chrome.runtime.sendMessage({ action: 'clearPreview' }); // Tell background to clean up.
      isPreviewing = false;
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


  // --- Global Event Listeners for Triggering Previews ---

  // Listen for 'mousedown' to initiate either a long-press or a modifier-key preview.
  // Using the capture phase (true) to catch the event early.
  document.addEventListener('mousedown', e => {
    // Check if the current site is disabled
    if (isCurrentSiteDisabled) {
      return;
    }
    // Don't do anything if a preview is already active.
    if (isPreviewing) return;
    const link = e.target.closest('a');
    // Check if the target is a valid link to preview.
    if (link && link.href && !link.href.startsWith('javascript:')) {
      // If the modifier key is pressed, create the preview immediately.
      if (e[settings.modifier]) {
        e.preventDefault();
        e.stopPropagation();
        createPreview(link.href);
        return;
      }
      // Otherwise, start a timer for a long press.
      longClickTimer = setTimeout(() => {
        createPreview(link.href);
      }, settings.duration);
    }
  }, true);

  // Listen for 'mouseup' to cancel the long-press timer if the mouse is released early.
  document.addEventListener('mouseup', () => {
    clearTimeout(longClickTimer);
  }, true);

  // Listen for 'click' with the modifier key to prevent the default navigation action.
  document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link && e[settings.modifier]) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);


  // --- Preconnect Optimization ---

  let hoverTimer = null;
  let lastHoveredUrl = null;

  // When a user hovers over a link, send a message to the background script to preconnect.
  // This can speed up the eventual loading of the page in the preview.
  document.addEventListener('mouseover', e => {
    // Check if the current site is disabled
    if (isCurrentSiteDisabled) {
      return;
    }
    const link = e.target.closest('a');
    if (link && link.href && link.href !== lastHoveredUrl) {
      lastHoveredUrl = link.href;
      clearTimeout(hoverTimer); // Debounce the event.
      // Wait a moment before preconnecting to avoid doing it for every link the mouse passes over.
      hoverTimer = setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'preconnect', url: link.href });
      }, 100);
    }
  });

  // When the mouse leaves a link, clear the preconnect timer.
  document.addEventListener('mouseout', e => {
    const link = e.target.closest('a');
    if (link) {
      clearTimeout(hoverTimer);
      lastHoveredUrl = null;
    }
  });
}