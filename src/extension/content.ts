import {
  BackgroundToContentMessage,
  ContentToBackgroundMessage,
  InjectedToContentMessage,
  ContentToInjectedMessage,
} from '../types';

import { injectProxy } from './injected';

// The current frame's ID. Used to identify multiple
// frames with media sessions in the same tab.
let currentFrameId = 0;

// Whether or not the content script still has a connection to the
// background script. The extension context is invalidated when
// the background page is closed or reloaded, leaving content
// and injected scripts with an invalidated context.
let extensionContextInvalidated = false;

/**
 * Log the given messages
 */
function log(...messages: any) {
  if (__DEV__) {
    console.log('[cmc content]', ...messages);
  }
}

/**
 * Send the given data to the injected script
 */
function sendToInjectedScript(data: ContentToInjectedMessage['data']) {
  window.postMessage({ from: 'CMC_CONTENT', data }, '*');
}

/**
 * Send the given data to the background script
 */
function sendToBackgroundScript(
  message: ContentToBackgroundMessage,
  responseCallback?: (response: any) => void
) {
  if (extensionContextInvalidated) {
    log('not sending to background, extension context invalidated');
    return;
  }

  try {
    chrome.runtime.sendMessage(message, responseCallback);
  } catch (err) {
    log('unable to send to background script', err);
    extensionContextInvalidated = true;
  }
}

/**
 * Handle messages from the injected script by forwarding
 * them to the background script
 */
function onInjectScriptMessage(event: MessageEvent<InjectedToContentMessage>) {
  const message = event.data;

  // Since we're using the public window.postMessage, messages could
  // come from any source on the page. So here we ignore messages
  // not from the injected script
  if (event.source !== window || message.from !== 'CMC_INJECTED') {
    event.returnValue = false;
    return;
  }

  log('message from injected script, forwarding to background', message);

  // Forward the message to the background script
  sendToBackgroundScript(message.data);

  // Acknowledge handling
  event.returnValue = true;
}

/**
 * Handle messages from the background script by forwarding them
 * to the injected script
 */
function onBackgroundScriptMessage(
  message: BackgroundToContentMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) {
  if (message.frameId === currentFrameId) {
    log('message from background, forwarding to injected', message);
    sendToInjectedScript(message);
    sendResponse({ handled: true });
  } else {
    sendResponse({ handled: false });
  }
}

function main() {
  // Listen for messages from the injected script
  window.addEventListener('message', onInjectScriptMessage, false);

  // Listen for when the content script is unloaded and notify the
  // background script. This happens when the underlying page is
  // unloaded on navigation or tab close.
  window.addEventListener('unload', () => {
    log('unload triggered, sending message to background');
    sendToBackgroundScript({ type: 'unloaded' });
  });

  // Get the current frame's ID from the background script
  sendToBackgroundScript({ type: 'get-frame-id' }, (response) => {
    currentFrameId = response.frameId;
  });

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener(onBackgroundScriptMessage);

  // Inject the mediaSession API proxy into the page
  injectProxy();
}

main();
