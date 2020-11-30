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
 *    - the tab or frame it's in gets unloaded
 *    - it has not been in the 'playing' state for more than an hour
 *
 * If the native connection fails, we retry every minute up to 5 times.
 */

import {
  NativeToChromeMessage,
  ChromeToNativeMessage,
  ContentToBackgroundMessage,
  BackgroundToContentMessage,
  Optional,
  Session,
} from '../types';

import {
  log,
  error,
  handleLastError,
  getSessions,
  storeSessions,
  removeTabSessions,
  updateTabLastActivatedAt,
  removeStale,
} from './background-support';

type SendToContent = (
  tabId: number,
  message: BackgroundToContentMessage,
  responseCallback?: ((response: any) => void) | undefined
) => void;

type SendToNative = (message: ChromeToNativeMessage) => void;

const MAX_CONNECTION_ATTEMPTS = 5;

let totalConnectionAttempts = 0;
let nativePort: chrome.runtime.Port | undefined;

/**
 * Connect to the native host
 */
function connectToNative() {
  const hostName = 'io.github.josephuspaye.chromemediacontroller';

  log('connecting to native host', hostName);

  nativePort = chrome.runtime.connectNative(hostName);
  nativePort.onMessage.addListener(onNativeMessage);
  totalConnectionAttempts++;

  nativePort.onDisconnect.addListener(() => {
    error('disconnected from native host', chrome.runtime.lastError?.message);

    nativePort = undefined;

    if (totalConnectionAttempts <= MAX_CONNECTION_ATTEMPTS) {
      log('will attempt to connect to native host again in 1 minute');
      setTimeout(connectToNative, 1 * 60 * 1000);
    } else {
      log('native host connection attempts exhausted');
    }
  });
}

/**
 * Send the state of all current media sessions to the native host
 */
function syncSessions(
  change?:
    | { type: 'add'; session: Optional<Session, 'tabLastActivatedAt'> }
    | { type: 'remove'; session: { id: string } }
) {
  const sessions = removeStale(getSessions() ?? {});

  if (change) {
    if (change.type === 'add') {
      const session = sessions[change.session.id] ?? { tabLastActivatedAt: -1 };
      sessions[change.session.id] = Object.assign({}, session, change.session);
    } else if (change.type === 'remove') {
      delete sessions[change.session.id];
    }
  }

  if (nativePort) {
    (nativePort.postMessage as SendToNative)({ type: 'sync', sessions });
  }

  log('sent sync message', { type: 'sync', sessions });

  storeSessions(sessions);
}

/**
 * Listen for messages from the content scripts in tabs
 */
function onContentScriptMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) {
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

  // Handle a `get-frame-id` request
  if (message.type === 'get-frame-id') {
    sendResponse({ frameId: sender.frameId });
    return;
  }

  // Ignore any message without a tab on the sender
  if (!sender.tab) {
    log('ignoring message without tab information');
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
    log(
      'removing unloaded session or session with a removed `play` action',
      id
    );
    syncSessions({ type: 'remove', session: { id } });
    return;
  }

  // Sync sessions with the native host when getting a 'sync' message
  if (message.type === 'sync') {
    syncSessions({
      type: 'add',
      session: {
        id,
        origin: (sender as any).origin,
        state: message.state,
        actions: message.actions,
        lastChange: message.change,
        lastChangeAt: Date.now(),
        hasBeenPlayed: message.hasBeenPlayed,
      },
    });
  }
}

/**
 * Handle a message from the native host
 */
function onNativeMessage(message: NativeToChromeMessage) {
  log('native message received', message);

  if (message.action === 'request-sync') {
    log('native requested sync, syncing sessions', message);
    syncSessions();
    return;
  }

  log('forwarding action message to content script', message);

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
    removeTabSessions(tabId);
  });

  // Listen for tab focus change and set `tabLastActivatedAt` for its sessions
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    updateTabLastActivatedAt(tabId);
  });

  // Connect to the native host
  connectToNative();
}

main();
