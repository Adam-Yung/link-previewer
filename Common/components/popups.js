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
function createWarningPopup({ id, icon, title, message, buttons, fromIframe }) {
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
    if (!fromIframe) state.isPreviewing = false; // Reset the flag to allow new previews.
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
function createHttpWarningPopup(url, fromIframe = false) {
  createWarningPopup({
    id: 'link-preview-http-warning',
    icon: warningIcon,
    title: 'Insecure Link',
    message: 'Previews are disabled for non-encrypted (HTTP) pages for your security.',
    buttons: [
      { id: 'warning-cancel', text: 'Cancel', onClick: () => { } },
      { id: 'warning-open', text: 'Open in New Tab', onClick: () => window.open(url, '_blank') }
    ],
    fromIframe: fromIframe
  });
}

/**
 * Shows a popup informing the user that the extension context is lost and the page needs to be reloaded.
 */
function showContextExpiredPopup(fromIframe = false) {
  createWarningPopup({
    id: 'link-preview-context-warning',
    icon: expiredIcon,
    title: 'Context Expired',
    message: 'Link Previewer needs to be re-initialized. Please reload the page to continue using previews.',
    buttons: [
      { id: 'context-cancel', text: 'Dismiss', onClick: () => { } },
      { id: 'context-reload', text: 'Reload Page', onClick: () => window.location.reload() }
    ],
    fromIframe: fromIframe
  });
}

