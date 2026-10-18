const { spawn } = require('child_process');
const path = require('path');

const FIREBASE_CMD = 'C:\\Users\\ttirt\\AppData\\Roaming\\npm\\firebase.cmd';
const JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio\\jbr';

console.log('=== STARTING FIREBASE EMULATORS FOR STORAGE & FIRESTORE SECURITY TESTS ===');

const env = {
  ...process.env,
  JAVA_HOME: JAVA_HOME,
  PATH: `${JAVA_HOME}\\bin;${process.env.PATH}`,
};

const proc = spawn('cmd.exe', [
  '/c',
  'firebase emulators:exec --only firestore,storage "npx mocha test/storage_rules_audit.test.js"'
], {
  cwd: path.resolve(__dirname, '..'),
  env: env,
  stdio: 'inherit',
});

proc.on('close', (code) => {
  console.log(`\n=== FIREBASE EMULATOR TESTS COMPLETED WITH EXIT CODE: ${code} ===`);
  process.exit(code);
});
