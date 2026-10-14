const { spawn } = require('child_process');
const path = require('path');

const JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio\\jbr';

console.log('--- STARTING FIREBASE EMULATOR (FIRESTORE + STORAGE) ---');

const proc = spawn('cmd.exe', ['/c', 'firebase', 'emulators:start', '--only', 'firestore,storage'], {
  cwd: path.resolve(__dirname, '..'),
  env: {
    ...process.env,
    JAVA_HOME: JAVA_HOME,
    PATH: `${JAVA_HOME}\\bin;${process.env.PATH}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

proc.stdout.on('data', (d) => {
  console.log('[stdout]', d.toString().trim());
});

proc.stderr.on('data', (d) => {
  console.error('[stderr]', d.toString().trim());
});

setTimeout(() => {
  console.log('Sending kill...');
  proc.kill('SIGINT');
}, 15000);
