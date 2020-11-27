import sade from 'sade';
import { ls } from './commands/ls';
import { createActionCommand } from './commands/action';

const version = require('../../package.json').version;

const program = sade('cmc').version(version);

program
  .command('ls')
  .describe('List current media sessions')
  .option(
    '-a, --all',
    'Show all media sessions, includings ones not started yet',
    false
  )
  .action(ls);

program
  .command('pause <id>')
  .describe('Pause a media session')
  .action(createActionCommand('pause', 'pause'));

program
  .command('play <id>')
  .describe('Play a media session')
  .action(createActionCommand('play', 'play'));

program
  .command('next <id>')
  .describe('Skip to the next track in a media session')
  .action(createActionCommand('next', 'nexttrack'));

program
  .command('previous <id>')
  .describe('Skip to the previous track in a media session')
  .action(createActionCommand('previous', 'previoustrack'));

program
  .command('skipad <id>')
  .describe('Skip the ad in a media session')
  .action(createActionCommand('skipad', 'skipad'));

program
  .command('stop <id>')
  .describe('Stop a media session')
  .action(createActionCommand('stop', 'stop'));

program.parse(process.argv);

/*

program
  .command('seek <id> <offset>')
  .describe('Seek a media session to a given time')
  .action(seek);

program
  .command('extension <extension-id>')
  .describe('Allow a Chrome extension to connect to the native host')
  .action(extension);

program.parse(process.argv);

function validateSessionId(id: string) {
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

function pause(id: string) {
  console.log('pausing media session', id);

  const { tabId, frameId } = validateSessionId(id);

  usePipe((client, done) => {
    client.on('message', (message) => {
      console.log('message received', message);

      if (message.type === 'sync') {
        const sessions = message.sessions as Sessions;

        if (Object.keys(sessions).length === 0) {
          console.log('no media sessions found');
          done();
        }

        const session = sessions[id];

        if (!session) {
          console.log('media session not found:', id);
          done();
        }

        if (!session.actions.includes('pause')) {
          console.log(`media session ${id} doesn't support pause command`);
          done();
        }

        client.emit('message', {
          tabId,
          frameId,
          action: 'pause',
        });

        console.log('sent pause command to', id);

        done();
      }
    });
  });
}

function play(id: string) {
  console.log('playing media session', id);

  const { tabId, frameId } = validateSessionId(id);

  usePipe((client, done) => {
    client.on('message', (message) => {
      console.log('message received', message);

      if (message.type === 'sync') {
        const sessions = message.sessions as Sessions;

        if (Object.keys(sessions).length === 0) {
          console.log('no media sessions found');
          done();
        }

        const session = sessions[id];

        if (!session) {
          console.log('media session not found:', id);
          done();
        }

        if (!session.actions.includes('play')) {
          console.log(`media session ${id} doesn't support play command`);
          done();
        }

        client.emit('message', {
          tabId,
          frameId,
          action: 'play',
        });

        console.log('sent play command to', id);

        done();
      }
    });
  });
}

function seek(id: string, offset: string) {
  console.log('seeking media session', id, offset);
}

function next(id: string) {
  console.log('skipping to next track', id);

  const { tabId, frameId } = validateSessionId(id);

  usePipe((client, done) => {
    client.on('message', (message) => {
      console.log('message received', message);

      if (message.type === 'sync') {
        const sessions = message.sessions as Sessions;

        if (Object.keys(sessions).length === 0) {
          console.log('no media sessions found');
          done();
        }

        const session = sessions[id];

        if (!session) {
          console.log('media session not found:', id);
          done();
        }

        if (!session.actions.includes('nexttrack')) {
          console.log(`media session ${id} doesn't support next command`);
          done();
        }

        client.emit('message', {
          tabId,
          frameId,
          action: 'nexttrack',
        });

        console.log('sent next command to', id);

        done();
      }
    });
  });
}

function previous(id: string) {
  console.log('skipping to previous track', id);

  const { tabId, frameId } = validateSessionId(id);

  usePipe((client, done) => {
    client.on('message', (message) => {
      console.log('message received', message);

      if (message.type === 'sync') {
        const sessions = message.sessions as Sessions;

        if (Object.keys(sessions).length === 0) {
          console.log('no media sessions found');
          done();
        }

        const session = sessions[id];

        if (!session) {
          console.log('media session not found:', id);
          done();
        }

        if (!session.actions.includes('previoustrack')) {
          console.log(`media session ${id} doesn't support previous command`);
          done();
        }

        client.emit('message', {
          tabId,
          frameId,
          action: 'previoustrack',
        });

        console.log('sent previous command to', id);

        done();
      }
    });
  });
}

function skipAd(id: string) {
  console.log('skipping ad', id);
}

function stop(id: string) {
  console.log('stopping media session', id);
}

function extension(extensionId: string) {
  const nativeManifestFile = path.resolve(
    __dirname,
    '..',
    'host',
    'manifest.json'
  );

  const manifest = require(nativeManifestFile);

  manifest.allowed_origins = manifest.allowed_origins || [];
  manifest.allowed_origins.push(`chrome-extension://${extensionId}/`);

  fs.writeFileSync(nativeManifestFile, JSON.stringify(manifest, null, '  '));

  console.log('extension allowed', extensionId);
}

*/
