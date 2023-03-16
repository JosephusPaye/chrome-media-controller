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
export function exponentialDelay(totalConnectionAttempts: number) {
  // 1ms, 10ms, 100ms, 1000ms, ..., 1min
  return Math.min(10 ** totalConnectionAttempts, 60 * 1000);
}
