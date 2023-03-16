import type { Session, Sessions } from '../types';

import { log } from './background-util';

class SessionData {
  private sessions: Sessions = {};

  constructor() {
    // for debugging
    (window as any).cmcSessionData = this;
  }

  /** Get the stored sessions */
  getSessions(): Sessions {
    return this.sessions;
  }

  /** Add the given session */
  addSession(id: string, session: Session) {
    this.sessions[id] = Object.assign({ tabLastActivatedAt: -1 }, this.sessions[id], session);
  }

  /** Remove the given session */
  removeSession(id: string) {
    delete this.sessions[id];
  }

  /** Remove the sessions that have expired */
  removeStaleSessions() {
    const nonStale: Sessions = {};

    Object.entries(this.sessions).forEach(([id, session]) => {
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

    this.sessions = nonStale;
  }

  /** Remove all sessions from the given tab */
  removeSessionsBelongingToTab(tabId: number) {
    if (__DEV__) {
      log('removing sessions for tab', tabId);
    }

    Object.keys(this.sessions).forEach((key) => {
      if (key.startsWith(tabId + '.')) {
        delete this.sessions[key];
      }
    });
  }

  /** Remove all sessions from the given tab */
  updateTabLastActivatedAt(tabId: number) {
    if (__DEV__) {
      log('updating tabLastActivatedAt sessions for tab', tabId);
    }

    const now = Date.now();

    Object.keys(this.sessions).forEach((key) => {
      if (key.startsWith(tabId + '.')) {
        this.sessions[key].tabLastActivatedAt = now;
      }
    });
  }
}

export const sessionData = new SessionData();
