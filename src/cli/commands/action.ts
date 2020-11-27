import { CliCommand, SimpleActionMessage } from '../../types';
import { waitForSessions } from '../support';

/**
 * Create a CLI command handler that can take action on a media session.
 * Useful for actions like play, pause, nexttrack, etc
 *
 * @param command  The CLI command
 * @param action   The media session action
 */
export function createActionCommand(
  command: CliCommand,
  action: SimpleActionMessage['action']
) {
  return function (id: string) {
    waitForSessions(
      { getSessionById: id },
      ({ client, done, session, sessionSource }) => {
        if (session?.actions.includes(action) === false) {
          console.log(`media session ${id} doesn't support ${command} command`);
          done();
        }

        client.emit('message', {
          tabId: sessionSource!.tabId,
          frameId: sessionSource!.frameId,
          action,
          actionArgs: undefined,
        });

        console.log(`${command} command sent to media session ${id}`);

        done();
      }
    );
  };
}
