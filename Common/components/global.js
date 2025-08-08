// Global state object
const state = {
  longClickTimer: null,
  isPreviewing: false,
  isCurrentSiteDisabled: false,
  isCenterStageMode: false,
  isPreviewFocused: false,
  historyManager: null,
  container: null,
  isDragging: null,
  overflow: {
    enabled: false,
    originalBodyOverflow: '',
    originalDocumentOverflow: '',
  }
};

// Default settings for the preview window.
let settings = {
  duration: 500,       // Milliseconds for a long press to trigger the preview.
  modifier: 'shiftKey',// Modifier key (e.g., 'shiftKey', 'ctrlKey', 'altKey') to trigger preview on click.
  theme: 'light',      // The color theme for the preview window ('light' or 'dark').
  closeKey: 'Escape',  // Key to close the preview window.
  width: '90vw',       // Default width of the preview window.
  height: '90vh',      // Default height of the preview window.
  top: '50%',          // Default top position.
  left: '50%',          // Default left position.
  disabledSites: [],   // Array of disabled hostnames.
  loadingAnimation: 'blue'
};
