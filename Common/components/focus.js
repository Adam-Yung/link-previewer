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


function attachContainerFocus(container) {
  let previewTakeFocusTO = timeoutWrapper(previewTakeFocus);
  if (container) {
    container.addEventListener('mouseleave', () => {previewTakeFocusTO(false)});
    container.addEventListener('mouseenter', () => {previewTakeFocusTO(true)});
  }
}