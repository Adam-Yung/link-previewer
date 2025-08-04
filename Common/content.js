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
        if (urlSpan) {
            urlSpan.textContent = urlToRender;
        }

        const isImage = /.*\.(jpeg|jpg|gif|png)$/i.test(urlToRender);
        const existingIframe = shadowRoot.getElementById('link-preview-iframe');
        const existingImage = shadowRoot.getElementById('link-preview-image');

        if (existingIframe) existingIframe.remove();
        if (existingImage) existingImage.remove();

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
            };
            container.appendChild(img);
            addressBar.addEventListener('mousedown', (e) => initDrag(e, container, img));
        } else {
            const iframe = document.createElement('iframe');
            iframe.id = 'link-preview-iframe';
            if (typeof browser !== 'undefined') {
                iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation';
            }
            container.appendChild(iframe);
            addressBar.addEventListener('mousedown', (e) => initDrag(e, container, iframe));
            try {
                chrome.runtime.sendMessage({ action: 'prepareToPreview', url: urlToRender })
                    .then(response => {
                        if (response && response.ready) {
                            iframe.src = urlToRender;
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

    function navigateTo(newUrl) {
        // If we are navigating from a point in history, truncate the future history
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(newUrl);
        historyIndex = history.length - 1;
        updateNavButtons();
        renderUrl(newUrl);
    }

    backButton.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            updateNavButtons();
            renderUrl(history[historyIndex]);
        }
    });

    forwardButton.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            updateNavButtons();
            renderUrl(history[historyIndex]);
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
        isPreviewing = false; // Reset the flag to allow new previews.
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
        icon: `
            <svg class="warning-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>`,
        title: 'Insecure Link',
        message: 'Previews are disabled for non-encrypted (HTTP) pages for your security.',
        buttons: [
            { id: 'warning-cancel', text: 'Cancel', onClick: () => {} },
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
        icon: `
            <svg class="warning-icon" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 512 512">
                <path d="M449.9 315.9c-2.4-6.4-8.9-10.4-15.6-9.3s-12.2 7.7-11.1 14.4c13.2 80.3-33.9 159.2-114.2 172.4S150.6 460 137.4 379.7s33.9-159.2 114.2-172.4c6.7-1.1 11.1-7.5 9.9-14.2s-7.5-11.1-14.2-9.9C167.3 200.5 89.2 284.2 102.5 364.5s89.2 137.8 169.5 124.5C352.2 475.8 430.3 392 417 311.7c-1.1-6.7 2.1-13.2 8.8-15.6s13.2-2.1 15.6 4.6c15.8 88-34.8 174.9-122.8 190.7S123.3 456.4 107.5 368.4s34.8-174.9 122.8-190.7c86.4-15.5 168.3 32.7 186.7 116.5c1.4 6.7-2.1 13.5-8.8 15.1s-13.5 2.1-15.1-1.4z"/>
            </svg>`,
        title: 'Context Expired',
        message: 'Link Previewer needs to be re-initialized. Please reload the page to continue using previews.',
        buttons: [
            { id: 'context-cancel', text: 'Dismiss', onClick: () => {} },
            { id: 'context-reload', text: 'Reload Page', onClick: () => window.location.reload() }
        ]
    });
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