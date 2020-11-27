import { SeekAbsoluteMessage, SeekRelativeMessage } from '../../types';
import { waitForSessions } from '../support';

export function createSeekCommand(
  command: 'seekb' | 'seekf' | 'seek',
  action: 'seekbackward' | 'seekforward' | 'seekto'
) {
  return function (id: string, offsetInput: string = '15') {
    const offset = parseTimeString(offsetInput);

    if (!offset) {
      console.log('invalid seek offset:', offsetInput);
      return;
    }

    waitForSessions(
      { getSessionById: id },
      ({ client, done, session, sessionSource }) => {
        if (session?.actions.includes(action) === false) {
          console.log(`media session ${id} doesn't support ${command} command`);
          done();
        }

        if (action === 'seekto') {
          const message: SeekAbsoluteMessage = {
            tabId: sessionSource!.tabId,
            frameId: sessionSource!.frameId,
            action: 'seekto',
            actionArgs: {
              seekTime: offset,
              fastSeek: true,
            },
          };

          client.emit('message', message);

          console.log(`seek sent to media session ${id}`, message);
        } else {
          const message: SeekRelativeMessage = {
            tabId: sessionSource!.tabId,
            frameId: sessionSource!.frameId,
            action,
            actionArgs: {
              seekOffset: offset,
            },
          };

          client.emit('message', message);

          console.log(`seek sent to media session ${id}`, message);
        }

        done();
      }
    );
  };
}

const timeFactors = [
  1, // seconds in a second
  60, // seconds in a minute
  60 * 60, // seconds in an hour
];

const timeRegex = /^(\d+)(:\d+)?(:\d+)?$/;

function parseTimeString(timeString: string): number | undefined {
  if (!timeRegex.exec(timeString)) {
    return undefined;
  }

  const parts = timeString
    .split(':') // split on colon delimiter
    .map((part) => Number(part.trim())) // trim parts and convert to number
    .reverse(); // Reverse for [seconds, minutes, ...]

  const totalSeconds = parts
    .slice(0, 3) // working with only seconds, minutes, and hours
    .reduce((total, currentPart, index) => {
      return total + currentPart * timeFactors[index];
    }, 0);

  return totalSeconds;
}
