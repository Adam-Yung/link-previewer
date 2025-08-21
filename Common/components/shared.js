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

const ALLOW_DEBUGGING = false;
const LOGGING = {
  INFO: 'info',
  LOG: 'log',
  ERROR: 'error',
};
// ---------------------------------------------

/**
 * Parses different stack trace string formats to extract key information.
 * This function is now defined outside of `log` to be in the correct scope.
 * @param {string} errorString The raw string from a line in the stack trace.
 * @returns {object|null} An object containing the parsed data or null if no match is found.
 */
function parseErrorString(errorString) {
  if (!errorString) return null;
  errorString = errorString.trim();
  // Regex for V8 (Chrome, Node.js, Edge) format: "at functionName (filepath:line:column)"
  const v8Regex = /at (?:(.*)\s\()?(.+?):(\d+):(\d+)\)?/;
  let matches = v8Regex.exec(errorString);

  if (matches) {
    let filePath = matches[2];
    // Optional: Strip browser extension hash for cleaner logs
    const chromeHashRegex = /(chrome-extension:\/\/)[a-z]{32}\//;
    filePath = filePath.replace(chromeHashRegex, '$1.../');

    return {
      functionName: matches[1] || 'anonymous',
      // Get just the file name from the path for brevity
      filePath: filePath.split('/').pop(),
      lineNumber: parseInt(matches[3], 10),
      columnNumber: parseInt(matches[4], 10),
    };
  }

  // Regex for Gecko (Firefox) format: "timeoutWrapper/</<@moz-extension://8729ae3a-bb4d-4bb2-801d-5105ad8ad9a8/components/global.js:44:12"
  const geckoRegex = /^(.*)@(.+?):(\d+):(\d+)$/;
  matches = geckoRegex.exec(errorString);

  if (matches) {
    let filePath = matches[2];
    // Optional: Strip browser extension hash for cleaner logs
    const mozHashRegex = /(moz-extension:\/\/)[a-f0-9-]{36}\//;
    filePath = filePath.replace(mozHashRegex, '$1.../');

    return {
      functionName: matches[1].replace(/[\W]/g, '') || 'anonymous',
      filePath: filePath.split('/').pop(),
      lineNumber: parseInt(matches[3], 10),
      columnNumber: parseInt(matches[4], 10),
    };
  }

  // If no known format matches, return null.
  return null;
}

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

/**
 * A logging function that includes caller information.
 * @param {string} msg The message to log.
 * @param {string} [level=LOGGING.LOG] The logging level (e.g., 'info', 'log', 'error').
 */
function log(msg, level = LOGGING.LOG) {
  if (!ALLOW_DEBUGGING) return;
  const time = new Date();

  // Get caller function and line number.
  // The call stack is retrieved from a new Error object.
  const stack = new Error().stack.split('\n');

  // stack[0] is "Error"
  // stack[1] is the current function's frame (`log`)
  // stack[2] is the caller's frame (what we want!)
  const callerData = parseErrorString(stack[2]);

  // Construct a more informative message with file and line number.
  const location = callerData ? `${callerData.filePath}:${callerData.lineNumber}` : 'unknown file';
  const funcName = callerData?.functionName || 'unknown function';
  const message = `${formatDate(time)} [${location}] (${funcName})\n${msg}`;

  switch (level) {
    case LOGGING.INFO:
      console.info(message);
      break;
    case LOGGING.ERROR:
      console.error(message);
      break;
    case LOGGING.LOG:
    default:
      console.log(message);
      break;
  }
}
