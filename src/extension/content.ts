import { injectProxy } from './injected';

/**
 * Log the given messages
 */
function log(...messages: any) {
  console.log('[cmc content]', ...messages);
}

/**
 * Send the given data to the injected script
 */
function sendToInjectedScript(data: any) {
  window.postMessage({ from: 'CMC_CONTENT', data }, '*');
}

let extensionContextInvalidated = false;

/**
 * Send the given data to the background script
 */
function sendToBackgroundScript(data: any) {
  if (extensionContextInvalidated) {
    log('not sending to background, extension context invalidated');
    return;
  }

  try {
    chrome.runtime.sendMessage({ from: 'CMC_CONTENT', data });
  } catch (err) {
    log('unable to send to background script', err);
    extensionContextInvalidated = true;
  }
}

// Listen for messages from the injected script
window.addEventListener(
  'message',
  (event) => {
    const message = event.data;

    // Ignore messages not from the injected script
    if (event.source !== window || message.from !== 'CMC_INJECTED') {
      event.returnValue = false;
      return;
    }

    log('message from injected script, forwarding to background', message);

    // Forward the message to the background script
    sendToBackgroundScript(message.data);
  },
  false
);

// Listen for when the content script is unloaded and notify the
// background script. This happens when the underlying page is
// unloaded on navigation or tab close.
window.addEventListener('unload', () => {
  log('unload triggered, sending message to background');
  sendToBackgroundScript({ type: 'unload' });
});

// The current frame's ID. Used to identify multiple
// frames with media sessions on the same page.
let currentFrameId = 0;

// Get the current frame's ID from the background script
chrome.runtime.sendMessage(
  { from: 'CMC_CONTENT', data: { type: 'get-frame-id' } },
  (response) => {
    currentFrameId = response.frameId;
  }
);

// Listen for messages from the background script,
// and forward them to the injected script.
chrome.runtime.onMessage.addListener((message) => {
  if (message.frameId === currentFrameId) {
    log('message from background, forwarding to injected', message);
    sendToInjectedScript(message);
  }

  // Acknowledge handling
  return true;
});

// Inject the proxy into the page
injectProxy();
