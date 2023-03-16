import type { Sessions, SessionSource } from '../types';

export const data: { sessions: Sessions } = {
  sessions: {},
};

// for debugging
(window as any).cmcData = data;

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

/**
 * Get the sessions data
 */
export function getSessions(): Sessions {
  return data.sessions;
}

/**
 * Store the given sessions
 */
export function storeSessions(newSessions: Sessions) {
  data.sessions = newSessions;
}

/**
 * Remove expired media sessions from the given object of sessions
 */
export function removeStale(sessions: Sessions): Sessions {
  const nonStale: Sessions = {};

  Object.entries(sessions).forEach(([id, session]) => {
    nonStale[id] = session;

    // Remove sessions that have not been playing for more than an hour
    if (
      session.state.playbackState !== 'playing' &&
      Date.now() - session.lastChangeAt > 60 * 60 * 1000
    ) {
      delete nonStale[id];

      if (__DEV__) {
        log(
          `removed session that hasn't been playing for more than an hour`,
          id
        );
      }
    }
  });

  return nonStale;
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
 * Remove all sessions from the given tab
 */
export function removeTabSessions(tabId: number) {
  if (__DEV__) {
    log('removing sessions for tab', tabId);
  }

  const sessions = getSessions();

  Object.keys(sessions).forEach((key) => {
    if (key.startsWith(tabId + '.')) {
      delete sessions[key];
    }
  });

  storeSessions(sessions);
}

/**
 * Remove all sessions from the given tab
 */
export function updateTabLastActivatedAt(tabId: number) {
  if (__DEV__) {
    log('updating tabLastActivatedAt sessions for tab', tabId);
  }

  const now = Date.now();
  const sessions = getSessions();

  Object.keys(sessions).forEach((key) => {
    if (key.startsWith(tabId + '.')) {
      sessions[key].tabLastActivatedAt = now;
    }
  });

  storeSessions(sessions);
}
