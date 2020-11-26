import { spawn } from 'child_process';
import path from 'path';

if (process.platform === 'win32') {
  console.log('Removing native messaging host from registry...');

  const installerPath = path.win32.join(__dirname, 'host', 'uninstall.bat');
  const cmd = spawn('cmd.exe', ['/c', installerPath]);

  cmd.stdout.on('data', (data: Buffer) => {
    console.log(data.toString());
  });

  cmd.stderr.on('data', (data: Buffer) => {
    console.error(data.toString());
  });
} else {
  console.log('platform', process.platform, 'not supported yet');
}
