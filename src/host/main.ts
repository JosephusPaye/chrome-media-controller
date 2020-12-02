import fs from 'fs';
import path from 'path';
import { Server } from '@josephuspaye/pipe-emitter';
import { ChromeNativeBridge } from '@josephuspaye/chrome-native-bridge';
import { PassThrough } from 'stream';

let stderr: PassThrough | undefined;

if (__DEV__) {
  stderr = new PassThrough();
  stderr.pipe(process.stderr);
  stderr.pipe(fs.createWriteStream(path.join(__dirname, 'log.txt')));
}

function log(data: any, done?: (...args: any[]) => void) {
  if (__DEV__) {
    stderr?.write(JSON.stringify(data, null, '  ') + '\n', done);
  } else {
    done && done();
  }
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

const stdoutMirror = __DEV__
  ? fs.createWriteStream(path.join(__dirname, 'to-chrome.bin'))
  : undefined;
const stdinMirror = __DEV__
  ? fs.createWriteStream(path.join(__dirname, 'from-chrome.bin'))
  : undefined;

let pipe: Server;

const bridge = new ChromeNativeBridge(
  process.argv,
  process.stdin,
  process.stdout,
  {
    mirrorInputTo: stdinMirror,
    mirrorOutputTo: stdoutMirror,

    onMessage(message) {
      if (pipe) {
        pipe.emit('message', message);
      } else {
        log('got message from chrome but no pipe to forward to');
      }
    },

    onError(err) {
      log(['bridge error', err]);
    },

    onEnd() {
      log('stdin ended, exiting', () => {
        process.exit();
      });
    },
  }
);

pipe = new Server('chrome-media-controller', {
  onError(err) {
    log(['server pipe error, exiting', err], () => {
      process.exit();
    });
  },
});

pipe.on('message', (message) => {
  bridge.emit(message);
  fs.fsyncSync(process.stdout.fd); // flush stdout
});

log({
  'host started': new Date().toString(),
  pid: process.pid,
  origin: bridge.origin,
  parentWindow: bridge.parentWindow,
  args: process.argv,
});
