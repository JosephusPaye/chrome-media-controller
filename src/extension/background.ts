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
  log,
  error,
  handleLastError,
  getSessions,
  storeSessions,
  Session,
  removeTabSessions,
  removeStale,
  parseSessionId,
} from './background-support';

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
      chrome.alarms.create('reconnect', { delayInMinutes: 1 });
    } else {
      log('native host connection attempts exhausted');
    }
  });
}

/**
 * Send the state of all current media sessions to the native host
 */
function syncSessions(
  extra?:
    | { type: 'add'; session: Session }
    | { type: 'remove'; session: { id: string } }
) {
  const sessions = removeStale(getSessions() ?? {});

  if (extra) {
    if (extra.type === 'add') {
      sessions[extra.session.id] = extra.session;
    } else if (extra.type === 'remove') {
      delete sessions[extra.session.id];
    }
  }

  nativePort?.postMessage({ type: 'sync', sessions });

  log('sent sync message', { type: 'sync', sessions });

  storeSessions(sessions);
}

/**
 * Listen for messages from the content scripts in tabs
 */
function onContentScriptMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) {
  log('message from content script', message, sender);

  // Handle a `get-frame-id` request
  if (message.data.type === 'get-frame-id') {
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

  const contentUnloaded = message.data.type === 'unload';
  const playActionRemoved =
    message.data.type === 'sync' && message.data.actionRemoved === 'play';

  // Remove sessions that have unloaded or had their play action removed
  if (contentUnloaded || playActionRemoved) {
    log(
      'removing unloaded session or session with a removed `play` action',
      id
    );
    syncSessions({ type: 'remove', session: { id } });
    return;
  }

  if (message.data.type === 'sync') {
    syncSessions({
      type: 'add',
      session: {
        id,
        origin: (sender as any).origin,
        state: message.data.state,
        actions: message.data.actions,
        lastSyncAt: Date.now(),
        hasBeenPlayed: message.data.hasBeenPlayed,
      },
    });
  }
}

/**
 * Handle a message from the native host
 */
function onNativeMessage(message: {
  action: string;
  targetId?: string;
  args: any[];
}) {
  log('native message received', message);

  if (message.action === 'request-sync') {
    log('native requested sync, syncing sessions', message);
    syncSessions();
    return;
  }

  if (!message.targetId) {
    log('ignoring native message with no targetId');
    return;
  }

  const { tabId, frameId } = parseSessionId(message.targetId);

  if (!tabId) {
    log('ignoring native message where targetId has no tabId');
    return;
  }

  const contentMessage = {
    action: message.action,
    tabId,
    frameId,
    args: message.args,
  };

  log('sending action message to content script', contentMessage);

  chrome.tabs.sendMessage(
    contentMessage.tabId,
    contentMessage,
    handleLastError('tabs.sendMessage error')
  );
}

/**
 * Handle the script waking up to an alarm
 */
function onAlarm(alarm: chrome.alarms.Alarm) {
  if (alarm.name === 'reconnect') {
    connectToNative();
  }
}

function main() {
  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener(onContentScriptMessage);

  // Listen for closed tabs and remove any sessions from them
  chrome.tabs.onRemoved.addListener(function (tabId) {
    log('tab closed, removing sessions', tabId);
    removeTabSessions(tabId);
  });

  // Listen for alarms
  chrome.alarms.onAlarm.addListener(onAlarm);

  // Connect to the native host
  connectToNative();
}

main();
