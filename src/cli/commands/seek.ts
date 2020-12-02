import { SeekAbsoluteMessage, SeekRelativeMessage } from '../../types';
import { waitForSessions, print, log } from '../support';

export function createSeekCommand(
  command: 'seekb' | 'seekf' | 'seek',
  action: 'seekbackward' | 'seekforward' | 'seekto'
) {
  return function (id: string, offsetInput: string = '15') {
    const offset = parseTimeString(offsetInput);

    if (!offset) {
      print('invalid seek offset:', offsetInput);
      return;
    }

    waitForSessions(
      { getSessionById: id },
      ({ client, done, session, sessionSource }) => {
        if (session?.actions.includes(action) === false) {
          print(`${id} doesn't support ${command}`);
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

          log('seek message', message);

          client.emit('message', message);
          print(`${command} sent to ${id}`);
        } else {
          const message: SeekRelativeMessage = {
            tabId: sessionSource!.tabId,
            frameId: sessionSource!.frameId,
            action,
            actionArgs: {
              seekOffset: offset,
            },
          };

          log('seek message', message);

          client.emit('message', message);
          print(`${command} sent to ${id}`);
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
