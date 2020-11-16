// @ts-check

const readline = require('readline');
const { Server } = require('@josephuspaye/pipe-emitter');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function startPrompt() {
  while (true) {
    const command = await ask('> ');
    server.emit('message', { command });
  }
}

const server = new Server('chrome-media-controller-pipe', {
  onError(err) {
    console.log('\nserver error', err);
  },
  onConnect() {
    console.log('\nconnected to host\n');
    startPrompt();
  },
  onDisconnect() {
    console.log('\ndisconnected from host');
    process.exit();
  },
});

server.on('message', (message) => {
  console.log(`\n`, message, '\n');
  process.stdout.write('> ');
});

console.log('waiting for host to connect...');
