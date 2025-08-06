// utils/settings.js

// --- Initialization ---

// Load user settings from chrome.storage and check if this site is disabled.
chrome.storage.local.get(settings).then(loadedSettings => {
  Object.assign(settings, loadedSettings);
  // Check if the current page's hostname is in the disabled list.
  if (Array.isArray(settings.disabledSites)) {
    state.isCurrentSiteDisabled = settings.disabledSites.includes(window.location.hostname);
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
      state.isCurrentSiteDisabled = settings.disabledSites.includes(window.location.hostname);
    }
  }
});