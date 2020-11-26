import { Client } from '@josephuspaye/pipe-emitter';
import sade from 'sade';
import path from 'path';
import fs from 'fs';

interface Sessions {
  [id: string]: Session;
}

interface Session {
  id: string;
  origin: string;
  state: {
    metadata: MediaMetadata | null;
    playbackState: MediaSessionPlaybackState;
  };
  actions: string[];
  lastSyncAt: number;
}

const program = sade('cmc').version(require('../../package.json').version);

program.command('ls').describe('List current media sessions').action(ls);

program.command('pause <id>').describe('Pause a media session').action(pause);

program.command('play <id>').describe('Play a media session').action(play);

program
  .command('seek <id> <offset>')
  .describe('Seek a media session to a given time')
  .action(seek);

program
  .command('next <id>')
  .describe('Skip to the next track in a media session')
  .action(next);

program
  .command('previous <id>')
  .describe('Skip to the previous track in a media session')
  .action(previous);

program
  .command('skipad <id>')
  .describe('Skip the ad in a media session')
  .action(skipAd);

program.command('stop <id>').describe('Stop a media session').action(stop);

program
  .command('extension <extension-id>')
  .describe('Allow a Chrome extension to connect to the native host')
  .action(extension);

program.parse(process.argv);

const actionToCommand = {
  play: 'play',
  pause: 'pause',
  seekbackward: 'seek',
  seekforward: 'seek',
  seekto: 'seek',
  previoustrack: 'previous',
  nexttrack: 'next',
  skipad: 'skipad',
  stop: 'stop',
};

function ls() {
  console.log('listing current media sessions');

  const client = new Client('chrome-media-controller', {
    onError(error) {
      console.log('an error occurred while connecting to Chrome', error.type);
      process.exit();
    },
    onConnect() {
      console.log('connected to Chrome, requesting sync');
      client.emit('message', { action: 'request-sync' });
    },
    onDisconnect() {
      console.log('disconnected from Chrome');
      process.exit();
    },
  });

  setTimeout(() => {
    console.log('timed out waiting for response from Chrome');
    process.exit();
  }, 10 * 1000);

  client.on('message', (message) => {
    console.log('message received', message);

    if (message.type === 'sync') {
      const sessions = message.sessions as Sessions;

      if (Object.keys(sessions).length === 0) {
        console.log('no media sessions found');
        process.exit();
      }

      Object.values(sessions)
        .sort((a, z) => {
          return a.lastSyncAt - z.lastSyncAt;
        })
        .forEach((session) => {
          console.log(
            session.id,
            `(${session.state.playbackState.replace('none', 'unknown')})`,
            session.origin
          );

          console.log('  ', session.state.metadata?.title ?? '(no title)');

          if (session.state.metadata?.artist) {
            console.log('  ', session.state.metadata.artist);
          }

          if (session.actions.length > 0) {
            const commands = session.actions.map((action) => {
              return (actionToCommand as any)[action];
            });

            console.log(
              '  ',
              'commands:',
              Array.from(new Set(commands)).join(', ')
            );
          }

          console.log('');
        });

      process.exit();
    }
  });
}

function pause(id: string) {
  console.log('pausing media session', id);
}

function play(id: string) {
  console.log('playing media session', id);
}

function seek(id: string, offset: string) {
  console.log('seeking media session', id, offset);
}

function next(id: string) {
  console.log('skipping to next track', id);
}

function previous(id: string) {
  console.log('skipping to previous track', id);
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
