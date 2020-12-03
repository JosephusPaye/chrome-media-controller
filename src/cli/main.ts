import sade from 'sade';
import { createActionCommand } from './commands/action';
import { extension } from './commands/extension';
import { json } from './commands/json';
import { ls } from './commands/ls';
import { createSeekCommand } from './commands/seek';

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
  .command('prev <id>')
  .describe('Skip to the previous track in a media session')
  .action(createActionCommand('prev', 'previoustrack'));

program
  .command('seek <id> <offset>')
  .describe('Seek a media session to a given time')
  .action(createSeekCommand('seek', 'seekto'));

program
  .command('seekb <id> [offset]')
  .describe('Seek a media session backward by a given time')
  .action(createSeekCommand('seekb', 'seekbackward'));

program
  .command('seekf <id> [offset]')
  .describe('Seek a media session forward by a given time')
  .action(createSeekCommand('seekf', 'seekforward'));

program
  .command('skipad <id>')
  .describe('Skip the ad in a media session')
  .action(createActionCommand('skipad', 'skipad'));

program
  .command('stop <id>')
  .describe('Stop a media session')
  .action(createActionCommand('stop', 'stop'));

program
  .command('json')
  .describe('Dump the list of current media sessions in JSON format')
  .action(json);

program
  .command('extension <extension-id>')
  .describe('Allow a Chrome extension to connect to the native host')
  .action(extension);

program.parse(process.argv);
