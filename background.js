/**
 * How this works:
 *
 * We store each media session's play state, metadata, and supported actions immediately when
 * they're changed, by detecting the change in the injected script, and sending it here
 * to the background script via the content script.
 *
 * On each message to this background script, we also clean up any expired sessions. Sessions expire when:
 *    - a 'play' action handler is removed on them
 *    - the tab or frame they're in gets unloaded
 *    - they have not been in the 'playing' state for more than an hour
 */

let port = null;

/**
 * Listen for messages from the content scripts in tabs
 */
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  console.log(
    '[cmc background.js] message received from background page',
    message,
    sender,
  );

  // Handle `get-frame-id` request
  if (message.data.type === 'get-frame-id') {
    sendResponse({ frameId: sender.frameId });
    return;
  }

  // Each media session item is uniquely identified by its tab and frame ID
  const senderId = sender.tab.id + '.' + sender.frameId;

  const contentUnloaded = message.data.type === 'unload';
  const playActionRemoved =
    message.data.type === 'sync' && message.data.actionRemoved === 'play';

  // Remove items that have unloaded or had their play action removed
  if (contentUnloaded || playActionRemoved) {
    chrome.storage.local.remove(
      senderId,
      handleError('unable to remove item: ' + senderId),
    );

    port && port.postMessage({ type: 'remove', senderId });

    return true;
  }

  // Update the item in storage on sync
  if (message.data.type === 'sync') {
    const item = {
      senderId,
      origin: sender.origin,
      state: message.data.state,
      actions: message.data.actions,
      lastSyncAt: Date.now(),
    };

    chrome.storage.local.set(
      { [senderId]: item },
      handleError('unable to set item: ' + senderId),
    );

    port && port.postMessage({ type: 'sync', item });
  }

  // Clean up expired and stale items
  cleanUpStale();

  return true;
});

/**
 * Clean up expired media sessions
 */
function cleanUpStale() {
  chrome.storage.local.get(null, function (items) {
    if (chrome.runtime.lastError) {
      console.log(
        '[cmd background.js] unable to get items for cleanup',
        chrome.runtime.lastError.message,
      );
      return;
    }

    if (!items) {
      return;
    }

    Object.entries(items).forEach(([key, value]) => {
      // Remove items that have not been playing for more than an hour
      if (
        value.state.playbackState !== 'playing' &&
        Date.now() - value.lastSyncAt > 60 * 60 * 1000
      ) {
        chrome.storage.local.remove(
          key,
          handleError('unable to remove item: ' + key),
        );
        port && port.postMessage({ type: 'remove', key });
      } else {
        const [tabId] = key.split('.');

        chrome.tabs.get(Number(tabId), function () {
          if (chrome.runtime.lastError) {
            // tab no longer exists, remove it
            chrome.storage.local.remove(
              key,
              handleError('unable to remove item: ' + key),
            );
            port && port.postMessage({ type: 'remove', key });
          } else {
            // tab exists, do nothing
          }
        });
      }
    });
  });
}

/**
 * Create a function that'll check for and log a chrome.runtime.lastError
 */
function handleError(message) {
  return function () {
    if (chrome.runtime.lastError) {
      console.log(
        '[cmc background.js]',
        message,
        chrome.runtime.lastError.message,
      );
    }
  };
}

function onNativeMessage(message) {
  console.log('native message received', message);

  const [command, arg] = message.command.split(' ');
  const [tab, frame] = arg.split('.');

  console.log({ action: command, tab: Number(tab), frame: Number(frame) });

  chrome.tabs.sendMessage(
    Number(tab),
    { action: command, tabId: tab, frameId: Number(frame) },
    handleError('tabs.sendMessage error'),
  );
}

function connectToNative() {
  const hostName = 'io.github.josephuspaye.chromemediacontroller';

  console.log('connecting to native messaging host ' + hostName + '');

  port = chrome.runtime.connectNative(hostName);
  port.onMessage.addListener(onNativeMessage);

  port.onDisconnect.addListener(() => {
    port = null;
    console.log(
      'unable to connect to native host',
      chrome.runtime.lastError.message,
    );
  });
}

connectToNative();
