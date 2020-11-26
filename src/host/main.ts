import fs from 'fs';
import path from 'path';
import { Server } from '@josephuspaye/pipe-emitter';
import { ChromeNativeBridge } from '@josephuspaye/chrome-native-bridge';

function createLogger() {
  const filePath = path.join(__dirname, 'log.txt');
  return fs.createWriteStream(filePath, { fd: fs.openSync(filePath, 'a') });
}

const logFile = createLogger();

function log(data: any, done?: any) {
  logFile.write(JSON.stringify(data, null, '  '));
  logFile.write('\n', done);
}

function onExit(event: string, ...args: any[]) {
  log(
    {
      'host exiting': new Date().toString(),
      pid: process.pid,
      cause: event,
      args: args,
    },
    () => {
      process.exit();
    }
  );
}

[
  `exit`,
  `SIGINT`,
  `SIGUSR1`,
  `SIGUSR2`,
  `uncaughtException`,
  `SIGTERM`,
].forEach((eventType) => {
  process.on(eventType, onExit.bind(null, eventType));
});

let pipe: Server;

const bridge = new ChromeNativeBridge(
  process.argv,
  process.stdin,
  process.stdout,
  {
    onMessage(message) {
      log(message);

      if (pipe) {
        pipe.emit('message', message);
      } else {
        log('got message but no pipe');
      }
    },

    onError(err) {
      log(['bridge error', err]);
    },

    onEnd() {
      log('stdin ended', () => {
        process.exit();
      });
    },
  }
);

pipe = new Server('chrome-media-controller', {
  onError(err) {
    log(['pipe error', err], () => {
      process.exit();
    });
  },
});

pipe.on('message', (message) => {
  bridge.emit(message);
});

log({
  'host started': new Date().toString(),
  pid: process.pid,
  origin: bridge.origin,
  parentWindow: bridge.parentWindow,
});
