/**
 * Checks if the preview container is in the centered, maximized state.
 * @returns {boolean}
 */
function isInCenterStage() {
  const c = state.container;
  if (!c) return false;

  return (
    c.classList.contains('is-centered') ||
    (c.style.width === '90vw' &&
      c.style.height === '90vh' &&
      c.style.top === '50%' &&
      c.style.left === '50%')
  );
}

/**
 * Checks if the preview container is within the viewport boundaries and resizes/repositions it if not.
 * This is useful on window resize events to ensure the container remains fully visible.
 * @param {HTMLElement} element The element to check (the preview container).
 */
function checkIframeInBounds(element) {
  if (!element || element.classList.contains('is-centered')) {
    return;
  }

  const rect = element.getBoundingClientRect();
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;

  let { top, left, width, height } = rect;

  // Reposition if it's outside the viewport
  if (left < 0) left = 0;
  if (top < 0) top = 0;

  // Shrink if it's wider or taller than the viewport
  if (left + width > winWidth) {
    width = winWidth - left;
  }
  if (top + height > winHeight) {
    height = winHeight - top;
  }

  // Apply changes
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
}


/**
 * Converts percentage-based or centered positioning to absolute pixel values.
 * This is necessary before starting a drag or resize operation.
 * @param {HTMLElement} element The element to convert.
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
 * A general handler for mouse drag interactions (both moving and resizing).
 * @param {MouseEvent} e The initial mousedown event.
 * @param {HTMLElement} element The element being interacted with.
 * @param {HTMLElement} contentElement The content inside the element (e.g., iframe).
 * @param {(e: MouseEvent) => void} onMove The function to execute on mousemove.
 * @param {() => void} onEnd The function to execute when the interaction ends.
 */
function initInteraction(e, element, contentElement, onMove, onEnd) {
  state.isDragging = true;
  e.preventDefault();

  if (contentElement) {
    contentElement.style.pointerEvents = 'none';
  }

  const stopInteraction = () => {
    if (contentElement) {
      contentElement.style.pointerEvents = 'auto';
    }
    document.documentElement.removeEventListener('mousemove', onMove);
    document.documentElement.removeEventListener('mouseup', stopInteraction);
    document.documentElement.removeEventListener('mouseleave', stopInteraction);

    onEnd(); // Execute finalization logic (e.g., saving state)
    state.isDragging = false;
    toggleDisableParentPage(isInCenterStage());
  };

  document.documentElement.addEventListener('mousemove', onMove, false);
  document.documentElement.addEventListener('mouseup', stopInteraction, false);
  document.documentElement.addEventListener('mouseleave', stopInteraction, false);
}

/**
 * Initializes dragging for the preview window.
 * @param {MouseEvent} e The mousedown event.
 * @param {HTMLElement} element The element to drag.
 * @param {HTMLElement} contentElement The iframe/image inside.
 */
function initDrag(e, element, contentElement) {
  if (e.button !== 0 || e.target.closest('button')) {
    return;
  }

  convertToPixels(element);

  const offsetX = e.clientX - element.offsetLeft;
  const offsetY = e.clientY - element.offsetTop;

  const doDrag = (moveEvent) => {
    let newLeft = moveEvent.clientX - offsetX;
    let newTop = moveEvent.clientY - offsetY;

    // Constrain position within window bounds
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    const elemWidth = element.offsetWidth;
    const elemHeight = element.offsetHeight;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + elemWidth > winWidth) newLeft = winWidth - elemWidth;
    if (newTop + elemHeight > winHeight) newTop = winHeight - elemHeight;

    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
  };

  const onDragEnd = () => {
    chrome.storage.local.set({
      userTop: element.style.top,
      userLeft: element.style.left,
      isExpanded: false
    });
    state.isExpanded = false;
  };

  initInteraction(e, element, contentElement, doDrag, onDragEnd);
}

/**
 * Initializes resizing for the preview window.
 * @param {MouseEvent} e The mousedown event.
 * @param {HTMLElement} element The element to resize.
 * @param {HTMLElement} contentElement The iframe/image inside.
 * @param {string} dir The resize direction (e.g., 'n', 'se').
 */
function initResize(e, element, contentElement, dir) {
  convertToPixels(element);

  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = element.offsetWidth;
  const startHeight = element.offsetHeight;
  const startLeft = element.offsetLeft;
  const startTop = element.offsetTop;

  const doResize = (moveEvent) => {
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    if (dir.includes('e')) newWidth = startWidth + moveEvent.clientX - startX;
    if (dir.includes('w')) {
      newWidth = startWidth - (moveEvent.clientX - startX);
      newLeft = startLeft + moveEvent.clientX - startX;
    }
    if (dir.includes('s')) newHeight = startHeight + moveEvent.clientY - startY;
    if (dir.includes('n')) {
      newHeight = startHeight - (moveEvent.clientY - startY);
      newTop = startTop + moveEvent.clientY - startY;
    }

    element.style.width = `${newWidth}px`;
    element.style.height = `${newHeight}px`;
    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
  };

  const onResizeEnd = () => {
    chrome.storage.local.set({
      userWidth: element.style.width,
      userHeight: element.style.height,
      userTop: element.style.top,
      userLeft: element.style.left,
      isExpanded: false
    });
    state.isExpanded = false;
  };

  initInteraction(e, element, contentElement, doResize, onResizeEnd);
}

function attachResizeHandler(container) {
  const resizeWrapper = timeoutWrapper(() => {if (container) checkIframeInBounds(container);});

  if (container) {
    window.addEventListener('resize', resizeWrapper);
  }
  else {
    window.removeEventListener('resize', resizeWrapper);
  }
}