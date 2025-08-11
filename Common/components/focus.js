function parentMouseLeave(e) {
  log(`Mouse left parent, mouseX: ${e.clientX}, mouseY: ${e.clientY}`);
}
function parentMouseEnter(e) {
  log(`Mouse entered parent, mouseX: ${e.clientX}, mouseY: ${e.clientY}`);
}
function previewMouseLeave(e) {
  log(`Mouse left preview, mouseX: ${e.clientX}, mouseY: ${e.clientY}`);
}
function previewMouseEnter(e) {
  log(`Mouse entered preview, mouseX: ${e.clientX}, mouseY: ${e.clientY}`);
}

function attachFocusParent(ele) {
  let target = ele || document.documentElement;
  target.addEventListener('mouseleave', parentMouseLeave);
  target.addEventListener('mouseenter', parentMouseEnter);
}
function detachFocusParent() {
  let target = ele || document.documentElement;
  target.removeEventListener('mouseleave', parentMouseLeave);
  target.removeEventListener('mouseenter', parentMouseEnter);
}
function attachFocusPreview() {
  let target = ele || document.documentElement;
  target.addEventListener('mouseleave', previewMouseLeave);
  target.addEventListener('mouseenter', previewMouseEnter);
}
function detachFocusPreview() {
  let target = ele || document.documentElement;
  target.removeEventListener('mouseleave', previewMouseLeave);
  target.removeEventListener('mouseenter', previewMouseEnter);
}

function previewFocusHandler() {
  if (state.isPreviewFocused) {
    log(`Preview is being focused, disabling parent webpage overflow!`);
    scrollLockParentPage(true);
  }
  else {
    log(`Parent is being focused, enabling parent webpage overflow!`);
    scrollLockParentPage(false);
  }
}
function previewFocused() {
  state.isPreviewFocused = false;
  previewFocusHandler();
}

function attachFocusListener(init) {
  (init) && window.addEventListener('focus', previewFocused) || window.removeEventListener('focus', previewFocused);
}
