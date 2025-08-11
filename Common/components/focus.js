function previewTakeFocus(isTrue) {
  if (isTrue) {
    log(`Preview is being focused, disabling parent webpage overflow!`);
    scrollLock(true);
  }
  else {
    log(`Parent is being focused, enabling parent webpage overflow!`);
    if (!isInCenterStage()) scrollLock(false);
  }
}


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

function attachContainerFocus(container) {
  let previewTakeFocusTO = timeoutWrapper(previewTakeFocus);
  if (container) {
    container.addEventListener('mouseleave', () => {previewTakeFocusTO(false)});
    container.addEventListener('mouseenter', () => {previewTakeFocusTO(true)});
  }
}