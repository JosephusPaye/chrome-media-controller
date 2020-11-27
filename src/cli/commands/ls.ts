import { waitForSessions } from '../support';

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

export function ls(options: { all: boolean }) {
  waitForSessions(({ done, sessionsList }) => {
    const list = sessionsList.filter((session) => {
      return options.all ? true : session.hasBeenPlayed;
    });

    if (list.length === 0) {
      console.log('no media sessions found');
      done();
    }

    list.forEach((session) => {
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
          return actionToCommand[action];
        });

        console.log(
          '  ',
          'commands:',
          Array.from(new Set(commands)).join(', ')
        );
      }

      console.log('');
    });

    done();
  });
}
