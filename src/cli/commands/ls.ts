import k from 'kleur';
import { CliCommand } from '../../types';
import { waitForSessions, print } from '../support';

export const actionToCommand = {
  play: 'play',
  pause: 'pause',
  seekto: 'seek',
  seekbackward: 'seekb',
  seekforward: 'seekf',
  previoustrack: 'prev',
  nexttrack: 'next',
  skipad: 'skipad',
  stop: 'stop',
};

const commandsOrder: CliCommand[] = [
  'pause',
  'play',
  'prev',
  'next',
  'seekb',
  'seekf',
  'seek',
  'skipad',
  'stop',
];

export function ls(options: { all: boolean }) {
  waitForSessions(({ done, sessionsList }) => {
    const list = sessionsList.filter((session) => {
      return options.all ? true : session.hasBeenPlayed;
    });

    if (list.length === 0) {
      print('no media sessions found');
      done();
    }

    const sessions = list.map((session) => {
      const status = [
        k.green(session.id),
        k.green(`(${session.state.playbackState.replace('none', 'unknown')})`),
      ];

      const commands =
        session.actions.length > 0
          ? session.actions
              .map((action) => {
                return actionToCommand[action];
              })
              .sort((a, z) => {
                return (
                  commandsOrder.indexOf(a as CliCommand) -
                  commandsOrder.indexOf(z as CliCommand)
                );
              })
          : [];

      if (commands.length > 0) {
        status[1] += k.green(':');
        status.push(k.cyan(commands.join(', ')));
      }

      const metadata = [session.state.metadata?.title ?? '(no title)'];

      if (session.state.metadata?.artist) {
        metadata.push(session.state.metadata.artist);
      }

      metadata.push(session.origin);

      return [status.join(' '), ...metadata.map((meta) => '  ' + meta)].join(
        '\n'
      );
    });

    print(sessions.join('\n\n'));

    done();
  });
}
