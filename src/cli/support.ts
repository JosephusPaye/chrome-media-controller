import { Client } from '@josephuspaye/pipe-emitter';
import {
  Sessions,
  Session,
  SessionSource,
  NativeToChromeMessage,
  ChromeToNativeMessage,
} from '../types';

export function log(...messages: any[]) {
  if (__DEV__) {
    console.log(...messages);
  }
}

export function print(...messages: any[]) {
  console.log(...messages);
}

export function connect() {
  const client = new Client<NativeToChromeMessage, ChromeToNativeMessage>(
    'chrome-media-controller',
    {
      onError(error) {
        if (error.type === 'SOCKET_ERROR') {
          print(
            'unable to communicate with Chrome:',
            error.type,
            '\ncheck that Chrome is running and that the extension is enabled'
          );
        } else {
          print('unable to communicate with Chrome:', error.type);
        }
        process.exit(1);
      },
      onConnect() {
        client.emit('message', { action: 'request-sync' });
      },
      onDisconnect() {
        print('disconnected from Chrome');
        process.exit(1);
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
  quiet?: boolean;
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
  const { timeout, getSessionById, quiet } = Object.assign(
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

  function done(exitCode = 0) {
    cleanUp();
    process.exit(exitCode);
  }

  if (timeout.delay > 0) {
    timeoutRef = setTimeout(() => {
      print(timeout.message);
      cleanUp();
      process.exit(1);
    }, timeout.delay * 1000);
  }

  callback =
    typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

  if (callback === undefined) {
    throw new TypeError('callback is undefined');
  }

  client.on('message', (message) => {
    if (!quiet) {
      log('message received', message);
    }

    if (message?.type === 'sync') {
      const sessions = message.sessions as Sessions;
      let session: Session | undefined;

      // Check that the referenced session exists if applicable
      if (getSessionById) {
        session = sessions[getSessionById];

        if (!session) {
          print('media session not found:', getSessionById);
          done();
        }
      }

      const sessionsList = Object.values(sessions).sort(
        (a, z) => a.lastChangeAt - z.lastChangeAt
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

  if (tabId === undefined || frameId === undefined) {
    print('invalid session id');
    process.exit(1);
  }

  return { tabId, frameId };
}
