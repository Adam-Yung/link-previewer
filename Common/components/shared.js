/**
 * Message Names shared between background.js and frontend code
 */
const message = {
  prepareToPreview: 'prepareToPreview',
  clearPreview: 'clearPreview',
  preconnect: 'preconnect',
  iFrameHasFocus: 'iFrameHasFocus',
  focusPreview: 'focusPreview',
  updatePreviewUrl: 'updatePreviewUrl',
  closePreviewFromIframe: 'closePreviewFromIframe'
}


/**
 * Debugging Code
 */

const ALLOW_DEBUGGING = true;

const LOGGING = {
  INFO: 0,
  LOG: 1,
  ERROR: 2,
};

// A simple function to format the date
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function log(msg, level = LOGGING.LOG) {
  if (!ALLOW_DEBUGGING) return;
  const time = new Date();
  const message = `${formatDate(time)}: [${getCallerName()}]\n${msg}`;
  switch (level) {
    case LOGGING.INFO:
      console.info(message);
      break;
    case LOGGING.LOG:
      console.log(message);
      break;
    case LOGGING.ERROR:
      console.error(message);
      break;
  }
  function getCallerName() {
    const stack = new Error().stack.split("\n");
    return stack[3]?.trim().slice(0, 20); // 0: Error, 1: getCallerName, 2: log, 3: TARGET!
  }
}
