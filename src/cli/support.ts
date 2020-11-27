import { Client } from '@josephuspaye/pipe-emitter';
import {
  Sessions,
  Session,
  SessionSource,
  NativeToChromeMessage,
  ChromeToNativeMessage,
} from '../types';

export function connect() {
  const client = new Client<NativeToChromeMessage, ChromeToNativeMessage>(
    'chrome-media-controller',
    {
      onError(error) {
        if (error.type === 'SOCKET_ERROR') {
          console.log(
            'unable to connect to Chrome:',
            error.type,
            '\ncheck that Chrome is running and that the extension is enabled'
          );
        } else {
          console.log('Unable to communicate with Chrome:', error.type);
        }
        process.exit();
      },
      onConnect() {
        client.emit('message', { action: 'request-sync' });
      },
      onDisconnect() {
        console.log('disconnected from Chrome');
        process.exit();
      },
    }
  );

  return client;
}

export type SessionsCallback = (data: {
  client: Client<NativeToChromeMessage, ChromeToNativeMessage>;
  sessions: Sessions;
  sessionsList: Session[];
  session?: Session;
  sessionSource?: SessionSource;
  done: () => void;
}) => void;

export interface WaitForSessionOpts {
  timeout?: { delay: number; message: string };
  getSessionById?: string;
}

export function waitForSessions(callback: SessionsCallback): void;
export function waitForSessions(
  options: WaitForSessionOpts,
  callback: SessionsCallback
): void;
export function waitForSessions(
  optionsOrCallback: WaitForSessionOpts | SessionsCallback,
  callback?: SessionsCallback
): void {
  const { timeout, getSessionById } = Object.assign(
    {},
    {
      timeout: {
        delay: 10,
        message: 'timed out waiting for response from Chrome',
      },
    },
    typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
  );

  // Validate the format of the session id, if applicable
  let sessionSource: SessionSource | undefined;

  if (getSessionById) {
    sessionSource = validateSessionId(getSessionById);
  }

  const client = connect();

  let timeoutRef: NodeJS.Timeout | undefined;

  function cleanUp() {
    client.close();

    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRef = undefined;
    }
  }

  function done() {
    cleanUp();
    process.exit();
  }

  if (timeout.delay > 0) {
    timeoutRef = setTimeout(() => {
      console.log(timeout.message);
      cleanUp();
      process.exit();
    }, timeout.delay * 1000);
  }

  callback =
    typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

  if (callback === undefined) {
    throw new TypeError('callback is undefined');
  }

  client.on('message', (message) => {
    console.log('message received', message);

    if (message?.type === 'sync') {
      const sessions = message.sessions as Sessions;
      let session: Session | undefined;

      // Check that the referenced session exists if applicable
      if (getSessionById) {
        session = sessions[getSessionById];

        if (!session) {
          console.log('media session not found:', getSessionById);
          done();
        }
      }

      const sessionsList = Object.values(sessions).sort(
        (a, z) => a.lastSyncAt - z.lastSyncAt
      );

      callback!({
        client,
        sessions,
        sessionsList,
        session,
        sessionSource,
        done,
      });
    }
  });
}

// https://regexr.com/5h31m
const sessionIdRegex = /(\d+)\.(\d+)/;

/**
 * Parse the given sesison id into tabId and frameId
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

export function validateSessionId(id: string | number): SessionSource {
  const { tabId, frameId } = parseSessionId(id);

  if (tabId === undefined) {
    console.log('invalid session id: missing tab id');
    process.exit();
  } else if (frameId === undefined) {
    console.log('invalid session id: missing frame id');
    process.exit();
  }

  return { tabId, frameId };
}
