// options.js

// --- DOM Elements ---
const form = document.getElementById('settings-form');
const themeToggle = document.getElementById('theme-toggle');
const saveButton = document.getElementById('save-button');
const resetButton = document.getElementById('reset-button');
const siteEnableToggle = document.getElementById('site-enable-toggle');
const currentHostnameSpan = document.getElementById('current-hostname');
const closeKeyInput = document.getElementById('closeKey');
// Reference to the scrollable content area
const contentWrapper = document.querySelector('.content-wrapper');

// --- Global State ---
let currentHostname = '';

// --- Default Settings ---
const defaults = {
    duration: 500,
    modifier: 'shiftKey',
    theme: 'light',
    closeKey: 'Escape',
    width: '90vw',
    height: '90vh',
    disabledSites: [], // Now an array of hostnames
    loadingAnimation: 'blue' // Default loading animation
};

/**
 * Applies the selected theme (light/dark) to the options page.
 * @param {string} theme - The theme to apply ('light' or 'dark').
 */
function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.className = isDark ? 'dark-theme' : 'light-theme';
    document.documentElement.className = isDark ? 'dark-theme' : '';
    themeToggle.checked = isDark;
}

/**
 * Saves the general settings.
 * @param {Event} e - The form submission event.
 */
function saveOptions(e) {
  e.preventDefault();
  if (saveButton.classList.contains('is-saved')) return;

  const keyToSave = closeKeyInput.textContent || closeKeyInput.dataset.placeholder;

  const generalSettings = {
    duration: document.getElementById('duration').value,
    modifier: document.getElementById('modifier').value,
    theme: themeToggle.checked ? 'dark' : 'light',
    closeKey: keyToSave,
    width: document.getElementById('width').value,
    height: document.getElementById('height').value,
    loadingAnimation: document.getElementById('loadingAnimation').value
  };

  browser.storage.local.get('disabledSites').then(data => {
      const fullSettings = {
          ...generalSettings,
          disabledSites: data.disabledSites || []
      };

      browser.storage.local.set(fullSettings).then(() => {
        saveButton.classList.add('is-saved');
        setTimeout(() => {
            saveButton.classList.remove('is-saved');
        }, 2000);
      }, (error) => {
        console.error("Error saving settings:", error);
      });
  });
}

/**
 * Resets the form fields to their default values without saving.
 * @param {Event} e - The click event.
 */
function resetSettings(e) {
    e.preventDefault();
    if (resetButton.classList.contains('is-reset')) return;

    // Populate the form with default values
    document.getElementById('duration').value = defaults.duration;
    document.getElementById('modifier').value = defaults.modifier;
    closeKeyInput.textContent = defaults.closeKey;
    document.getElementById('width').value = defaults.width;
    document.getElementById('height').value = defaults.height;
    document.getElementById('loadingAnimation').value = defaults.loadingAnimation;

    // Set theme to light
    applyTheme('light');

    // Re-enable site as default
    siteEnableToggle.checked = true;
    handleSiteToggle();

    // Trigger visual feedback
    resetButton.classList.add('is-reset');
    setTimeout(() => {
        resetButton.classList.remove('is-reset');
    }, 2000);
}


/**
 * Handles the logic for the site-specific enable/disable toggle.
 */
function handleSiteToggle() {
    if (!currentHostname) return;

    browser.storage.local.get({ disabledSites: [] }).then(data => {
        let disabledSites = data.disabledSites;
        const isCurrentlyDisabled = disabledSites.includes(currentHostname);

        if (siteEnableToggle.checked) { // User wants to ENABLE it
            if (isCurrentlyDisabled) {
                disabledSites = disabledSites.filter(site => site !== currentHostname);
            }
        } else { // User wants to DISABLE it
            if (!isCurrentlyDisabled) {
                disabledSites.push(currentHostname);
            }
        }
        
        browser.storage.local.set({ disabledSites });
    });
}


/**
 * Restores all saved settings from storage and populates the form and toggle.
 */
function restoreOptions() {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0] && tabs[0].url) {
        try {
            const url = new URL(tabs[0].url);
            if (url.protocol.startsWith('http')) {
                 currentHostname = url.hostname;
                 currentHostnameSpan.textContent = url.hostname;
            } else {
                currentHostnameSpan.textContent = 'this page';
                document.querySelector('.site-toggle-container').style.display = 'none';
            }
        } catch (e) {
            console.warn("Could not parse URL for current tab:", tabs[0].url);
            currentHostnameSpan.textContent = 'this page';
            document.querySelector('.site-toggle-container').style.display = 'none';
        }
    }

    browser.storage.local.get(defaults).then(items => {
        document.getElementById('duration').value = items.duration;
        document.getElementById('modifier').value = items.modifier;
        
        closeKeyInput.textContent = items.closeKey;
        closeKeyInput.dataset.placeholder = items.closeKey;

        document.getElementById('width').value = items.width;
        document.getElementById('height').value = items.height;
        document.getElementById('loadingAnimation').value = items.loadingAnimation;
        applyTheme(items.theme);

        if (currentHostname) {
            const isSiteDisabled = items.disabledSites.includes(currentHostname);
            siteEnableToggle.checked = !isSiteDisabled;
        }
    });
  });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', restoreOptions);
form.addEventListener('submit', saveOptions);
resetButton.addEventListener('click', resetSettings);
themeToggle.addEventListener('change', (e) => {
    applyTheme(e.target.checked ? 'dark' : 'light');
});
siteEnableToggle.addEventListener('change', handleSiteToggle);

// --- Key Capture Logic ---
closeKeyInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    let key = e.key;
    if (key === ' ') {
        key = 'Space';
    }
    closeKeyInput.textContent = key;
    closeKeyInput.blur(); 
});
closeKeyInput.addEventListener('focus', () => {
    closeKeyInput.dataset.placeholder = closeKeyInput.textContent;
    closeKeyInput.textContent = '';
});
closeKeyInput.addEventListener('blur', () => {
    if (!closeKeyInput.textContent) {
        closeKeyInput.textContent = closeKeyInput.dataset.placeholder;
    }
});