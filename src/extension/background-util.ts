import type { SessionSource } from '../types';

/**
 * Log the given messages
 */
export function log(...messages: any) {
  console.log('[cmc background]', ...messages);
}

/**
 * Log the given messages as an error
 */
export function error(...messages: any) {
  console.error('[cmc background]', ...messages);
}

/**
 * Create a function that'll check for and log a chrome.runtime.lastError
 */
export function handleLastError(message: any) {
  return function () {
    if (chrome.runtime.lastError) {
      error(message, chrome.runtime.lastError.message);
    }
  };
}

// https://regexr.com/5h31m
const sessionIdRegex = /(\d+)\.(\d+)/;

/**
 * Parse the given session id into tabId and frameId
 */
export function parseSessionId(id: number | string): Partial<SessionSource> {
  const parsed: Partial<SessionSource> = {
    tabId: undefined,
    frameId: undefined,
  };

  if (typeof id === 'number') {
    parsed.tabId = id;
  } else {
    const matches = id.match(sessionIdRegex);

    if (matches) {
      parsed.tabId = Number(matches[1]);
      parsed.frameId = Number(matches[2]);
    }
  }

  return parsed;
}

/**
 * Compute the next reconnection delay for exponential back off,
 * given the total number of connection attempts
 */
function exponentialDelay(totalConnectionAttempts: number) {
  // 1ms, 10ms, 100ms, 1000ms, ..., 1min
  return Math.min(10 ** totalConnectionAttempts, 60 * 1000);
}

/** Convert to the given native host*/
export function connectToNative(nativeHostName: string) {
  return new Promise<chrome.runtime.Port>((resolve, reject) => {
    attemptNativeConnection(nativeHostName, 0, resolve, reject);
  });
}

function attemptNativeConnection(
  hostName: string,
  connectionAttempts: number,
  resolve: (port: chrome.runtime.Port) => void,
  reject: (reason?: any) => void
) {
  if (__DEV__) {
    log('connecting to native host', hostName);
  }

  const nativePort = chrome.runtime.connectNative(hostName);

  // If onDisconnect() isn't triggered after two seconds, then we had
  // a successful connection, so we can clean up and resolve
  const successfulConnectionTimeout = window.setTimeout(() => {
    nativePort.onDisconnect.removeListener(onDisconnect);
    if (__DEV__) {
      log('connected to native host', hostName);
    }
    resolve(nativePort);
  }, 2000);

  const onDisconnect = () => {
    const lastError = chrome.runtime.lastError;
    error('Failed to connect to native host:', lastError?.message);

    nativePort.onDisconnect.removeListener(onDisconnect);
    window.clearTimeout(successfulConnectionTimeout);

    if (connectionAttempts >= 6) {
      reject(
        new Error(
          `Giving up after failing to connect to native host with 6 attempts: ${lastError?.message}`
        )
      );
    } else {
      const reconnectDelay = exponentialDelay(connectionAttempts);

      log(
        `will attempt to connect to native host again in ${reconnectDelay} ms`
      );

      setTimeout(() => {
        attemptNativeConnection(
          hostName,
          connectionAttempts + 1,
          resolve,
          reject
        );
      }, reconnectDelay);
    }
  };

  nativePort.onDisconnect.addListener(onDisconnect);
}
