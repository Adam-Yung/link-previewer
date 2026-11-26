# Common/components/popups.js

Modal notices on the host page: the HTTP warning (previews refuse plain HTTP pages) and "context expired" (the extension was reloaded or
updated under a live page, so `chrome.runtime` is gone until the page reloads).

- Built with `innerHTML` from constant strings only; never pass page or URL text into `title`, `message` or button text.
- Closing a popup that replaced a preview resets `state.isPreviewing` so the next long press works; a popup raised from inside a preview
  (`fromIframe`) leaves the open preview's state alone.
