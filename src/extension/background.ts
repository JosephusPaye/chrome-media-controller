// An annoying unhandled promise rejection happens in the webext-dynamic-content-scripts code
window.addEventListener('unhandledrejection', function (event) {
  console.warn(
    'Unhandled rejection (promise: ',
    event.promise,
    ', reason: ',
    event.reason,
    ').'
  );
});

import 'webext-dynamic-content-scripts';
import addDomainPermissionToggle from 'webext-domain-permission-toggle';

addDomainPermissionToggle();

/**
 * How this works:
 *
 * We store each media session's play state, metadata, and supported actions immediately when
 * they're changed, by detecting the change in the injected script, and sending it here
 * to the background script via the content script.
 *
 * On each message to this background script, we also clean up any expired sessions.
 * We consider a session to have expire when:
 *    - a 'play' action handler is removed on it
 *    - the tab or frame it's in gets unloaded or closed
 *    - it has not been in the 'playing' state for more than an hour
 *
 * If the native connection fails, we retry using an exponential backup strategy:
 * 1ms, 10ms, 100ms, 1000ms, etc, up to once every every minute.
 */

import type {
  NativeToChromeMessage,
  ChromeToNativeMessage,
  ContentToBackgroundMessage,
  BackgroundToContentMessage,
} from '../types';

import {
  log,
  error,
  handleLastError,
  exponentialDelay,
} from './background-util';
import { sessionData } from './SessionData';

type SendToContent = (
  tabId: number,
  message: BackgroundToContentMessage,
  responseCallback?: ((response: any) => void) | undefined
) => void;

type SendToNative = (message: ChromeToNativeMessage) => void;

let reconnectionAttempts = 0;
let successfulConnectionTimeout: number | undefined;
let nativePort: chrome.runtime.Port | undefined;

/**
 * Connect to the native host
 */
function connectToNative() {
  const hostName = 'io.github.josephuspaye.chromemediacontroller';

  if (__DEV__) {
    log('connecting to native host', hostName);
  }

  nativePort = chrome.runtime.connectNative(hostName);
  nativePort.onMessage.addListener(onNativeMessage);
  reconnectionAttempts++;

  nativePort.onDisconnect.addListener(() => {
    error('disconnected from native host:', chrome.runtime.lastError?.message);

    // Clear the successful connection timeout,
    // since it resets the reconnection attempts
    if (successfulConnectionTimeout) {
      window.clearTimeout(successfulConnectionTimeout);
    }

    successfulConnectionTimeout = undefined;
    nativePort = undefined;

    const reconnectDelay = exponentialDelay(reconnectionAttempts);

    log(`will attempt to connect to native host again in ${reconnectDelay} ms`);
    setTimeout(connectToNative, reconnectDelay);
  });

  // If onDisconnect() isn't triggered after two seconds, then we had
  // a successful connection, so clear the reconnection attempts
  successfulConnectionTimeout = window.setTimeout(() => {
    successfulConnectionTimeout = undefined;
    reconnectionAttempts = 0;
  }, 2000);
}

/**
 * Send the state of all current media sessions to the native host
 */
function sendSessionsToNative() {
  if (nativePort) {
    const message: ChromeToNativeMessage = {
      type: 'sync',
      sessions: sessionData.getSessions(),
    };
    (nativePort.postMessage as SendToNative)(message);
    if (__DEV__) {
      log('sent sync message', message);
    }
  } else {
    if (__DEV__) {
      log('not sending sync message because native port is not connected');
    }
  }
}

/**
 * Listen for messages from the content scripts in tabs
 */
function onContentScriptMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) {
  if (__DEV__) {
    log(
      'message from content script',
      { type: message.type },
      {
        ...(message.type === 'sync'
          ? {
              ...message.change,
              ...(message.change.type === 'playback-state-changed'
                ? { playbackState: message.state.playbackState }
                : {}),
            }
          : {}),
      },
      {
        session: `${sender.tab?.id}.${sender.frameId}`,
        origin: (sender as any).origin,
      }
    );
  }

  // Handle a `get-frame-id` request
  if (message.type === 'get-frame-id') {
    sendResponse({ frameId: sender.frameId });
    return;
  }

  // Ignore any message without a tab on the sender
  if (!sender.tab) {
    if (__DEV__) {
      log('ignoring message without tab information');
    }
    return;
  }

  // Each media session is uniquely identified by its tab and frame ID
  const id = sender.tab.id + '.' + sender.frameId;

  const contentUnloaded = message.type === 'unloaded';
  const playActionRemoved =
    message.type === 'sync' &&
    message.change.type === 'action-removed' &&
    message.change.action === 'play';

  // Remove sessions that have unloaded or had their play action removed
  if (contentUnloaded || playActionRemoved) {
    if (__DEV__) {
      log(
        'removing unloaded session or session with a removed `play` action',
        id
      );
    }

    sessionData.removeSession(id);
    sendSessionsToNative();

    return;
  }

  // Sync sessions with the native host when getting a 'sync' message
  if (message.type === 'sync') {
    sessionData.addSession(id, {
      id,
      origin: (sender as any).origin,
      state: message.state,
      actions: message.actions,
      lastChange: message.change,
      lastChangeAt: Date.now(),
      hasBeenPlayed: message.hasBeenPlayed,
    });
    sendSessionsToNative();
  }
}

/**
 * Handle a message from the native host
 */
function onNativeMessage(message: NativeToChromeMessage) {
  if (__DEV__) {
    log('native message received', message);
  }

  if (message.action === 'request-sync') {
    if (__DEV__) {
      log('native requested sync, syncing sessions', message);
    }
    sendSessionsToNative();
    return;
  }

  if (__DEV__) {
    log('forwarding action message to content script', message);
  }

  (chrome.tabs.sendMessage as SendToContent)(
    message.tabId,
    message,
    handleLastError('tabs.sendMessage error')
  );
}

function main() {
  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener(onContentScriptMessage);

  // Listen for closed tabs and remove any sessions from them
  chrome.tabs.onRemoved.addListener((tabId) => {
    sessionData.removeSessionsBelongingToTab(tabId);
    sendSessionsToNative();
  });

  // Listen for tab focus change and set `tabLastActivatedAt` for its sessions
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    sessionData.updateTabLastActivatedAt(tabId);
    sendSessionsToNative();
  });

  // Connect to the native host
  connectToNative();
}

main();
