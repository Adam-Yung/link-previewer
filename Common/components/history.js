/**
 * Manages navigation history (back, forward, copy) for a component.
 */
class HistoryManager {
  // Private fields to encapsulate state and prevent outside modification
  #history;
  #currentIndex;
  #backButton;
  #forwardButton;
  #copyButton;
  #onNavigate; // Callback function to trigger actual content navigation

  /**
   * @param {ShadowRoot | HTMLElement} rootElement The root element containing the buttons.
   * @param {string} initialUrl The first URL to add to the history.
   * @param {(url: string) => void} onNavigateCallback A function to call with the new URL when navigating back or forward.
   */
  constructor(rootElement, initialUrl, onNavigateCallback) {
    if (!rootElement || !(rootElement instanceof Node)) {
      throw new Error("A valid root DOM element must be provided.");
    }
    if (typeof onNavigateCallback !== 'function') {
      throw new Error("A valid 'onNavigateCallback' function must be provided.");
    }

    this.#history = [initialUrl];
    this.#currentIndex = 0;
    this.#onNavigate = onNavigateCallback;

    // Find and store DOM elements
    this.#backButton = rootElement.getElementById('link-preview-back');
    this.#forwardButton = rootElement.getElementById('link-preview-forward');
    this.#copyButton = rootElement.getElementById('link-preview-copy');

    if (!this.#backButton || !this.#forwardButton || !this.#copyButton) {
      throw new Error("Could not find all required navigation buttons within the root element.");
    }

    this.#attachEventListeners();
    this.#updateNavButtons();
  }

  /**
   * Attaches click event listeners to the navigation buttons.
   * @private
   */
  #attachEventListeners() {
    this.#backButton.addEventListener('click', () => this.goBack());
    this.#forwardButton.addEventListener('click', () => this.goForward());
    this.#copyButton.addEventListener('click', () => this.copyCurrentUrl());
  }

  /**
   * Enables or disables the back/forward buttons based on the current history state.
   * @private
   */
  #updateNavButtons() {
    this.#backButton.disabled = this.#currentIndex === 0;
    this.#forwardButton.disabled = this.#currentIndex >= this.#history.length - 1;
  }

  /**
   * Navigates back one step in the history.
   */
  goBack() {
    if (this.#currentIndex > 0) {
      let old_url = this.#history[this.#currentIndex];
      this.#currentIndex--;
      this.#onNavigate(this.#history[this.#currentIndex], old_url, false);
      this.#updateNavButtons();
    }
  }

  /**
   * Navigates forward one step in the history.
   */
  goForward() {
    if (this.#currentIndex < this.#history.length - 1) {
      let old_url = this.#history[this.#currentIndex];
      this.#currentIndex++;
      this.#onNavigate(this.#history[this.#currentIndex], old_url, false);
      this.#updateNavButtons();
    }
  }

  /**
   * Copies the current URL to the clipboard and provides visual feedback.
   */
  copyCurrentUrl() {
    const currentUrl = this.#history[this.#currentIndex];
    navigator.clipboard.writeText(currentUrl).then(() => {
      // Prevent re-triggering animation if already active
      if (!this.#copyButton.classList.contains('copied')) {
        this.#copyButton.classList.add('copied');
        setTimeout(() => this.#copyButton.classList.remove('copied'), 1500);
      }
    }).catch(err => {
      console.error('Failed to copy URL to clipboard:', err);
    });
  }

  /**
   * Adds a new URL to the history, typically after user-initiated navigation.
   * This action clears any "forward" history.
   * @param {string} url The new URL to add to the history.
   */
  addNewEntry(url) {
    // Do nothing if the new URL is the same as the current one
    if (url === this.#history[this.#currentIndex]) {
      return;
    }

    // If we have navigated back, the "forward" history must be cleared.
    if (this.#currentIndex < this.#history.length - 1) {
      this.#history = this.#history.slice(0, this.#currentIndex + 1);
    }

    this.#history.push(url);
    this.#currentIndex++;
    this.#updateNavButtons();
  }

  getCurrentUrl() {
    return this.#history[this.#currentIndex];
  }
}