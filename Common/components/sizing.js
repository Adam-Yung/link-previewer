// components/sizing.js

function isInCenterStage() {
  const c = state.container;
  if (!c)
    return false;

  return c.classList.contains('is-centered') || (
    c.style.width === '90vw' &&
    c.style.height === '90vh'&&
    c.style.top === '50%' &&
    c.style.left === '50%'
  )
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
  state.isDragging = true;

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
    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Get window dimensions
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Get element dimensions
    const elemWidth = element.offsetWidth;
    const elemHeight = element.offsetHeight;

    // Constrain the new position
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + elemWidth > winWidth) newLeft = winWidth - elemWidth;
    if (newTop + elemHeight > winHeight) newTop = winHeight - elemHeight;


    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
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
    document.documentElement.removeEventListener('mouseleave', mouseLeaveHandler);

    // Save the new position to user settings.
    chrome.storage.local.set({
      top: element.style.top,
      left: element.style.left
    });

    toggleDisableParentPage(isInCenterStage());
    state.isDragging = false;
  }

  function mouseLeaveHandler(e) {
      log("left window!");
      stopDrag();
  }

  // Add listeners to the document to handle resizing from anywhere on the page.
  document.documentElement.addEventListener('mousemove', doDrag, false);
  document.documentElement.addEventListener('mouseup', stopDrag, false);
  document.documentElement.addEventListener("mouseleave", mouseLeaveHandler);
}


/**
 * Initializes the resizing functionality for the preview window.
 * @param {MouseEvent} e The initial mousedown event.
 * @param {HTMLElement} element The element to be resized (the preview container).
 * @param {HTMLElement} contentElement The iframe or image inside the container.
 * @param {string} dir The direction of the resize (e.g., 'n', 'se', 'w').
 */
function initResize(e, element, contentElement, dir) {
  state.isDragging = true;

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
    document.documentElement.removeEventListener('mouseleave', mouseLeaveHandler);
    // Save the new dimensions and position to user settings.
    chrome.storage.local.set({
      width: element.style.width,
      height: element.style.height,
      top: element.style.top,
      left: element.style.left
    });

    toggleDisableParentPage(isInCenterStage());
    state.isDragging = false;
  }

  function mouseLeaveHandler(e) {
      log("left window!");
      stopDrag();
  }

  // Add listeners to the document to handle resizing from anywhere on the page.
  document.documentElement.addEventListener('mousemove', doDrag, false);
  document.documentElement.addEventListener('mouseup', stopDrag, false);
  document.documentElement.addEventListener("mouseleave", mouseLeaveHandler);
}