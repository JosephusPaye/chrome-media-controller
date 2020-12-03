import { waitForSessions, print } from '../support';

export function json() {
  waitForSessions({ quiet: true }, ({ done, sessionsList }) => {
    print(JSON.stringify({ sessions: sessionsList }));
    done();
  });
}
