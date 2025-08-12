// Global state object
const state = {
  longClickTimer: null,
  isPreviewing: false,
  isCurrentSiteDisabled: false,
  isCenterStageMode: false,
  historyManager: null,
  container: null,
  isDragging: null,
  isExpanded: false, // To track the expanded state of the preview
  timeoutIDs: new Map()
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
  userWidth: '640px', // User-defined width
  userHeight: '800px',// User-defined height
  userTop: '10%',
  userLeft: '50%',
  isExpanded: false,
  disabledSites: [],   // Array of disabled hostnames.
  loadingAnimation: 'blue'
};

function timeoutWrapper(func, ms = 100) {
  // Return a new function that will be used as the event handler
  return function(...args) {
    // 'func' is the key to ensure the same timer is cleared and reset
    let timeoutID = state.timeoutIDs.get(func);
    if (timeoutID) {
      clearTimeout(timeoutID);
    }

    // Use the captured 'args' from when the returned function was called
    state.timeoutIDs.set(func, setTimeout(() => {
      func.apply(this, args);
    }, ms));
  };
}