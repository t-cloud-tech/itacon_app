const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const JAVA_PATH = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\java.exe';
const EMULATOR_JAR = 'C:\\Users\\ttirt\\.cache\\firebase\\emulators\\cloud-firestore-emulator-v1.22.0.jar';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

function waitForEmulator(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        clearInterval(interval);
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Emulator failed to start within timeout.'));
        }
      });
    }, 500);
  });
}

async function main() {
  console.log('--- STARTING FIRESTORE EMULATOR ---');
  console.log('Java:', JAVA_PATH);
  console.log('Rules:', RULES_PATH);

  const emulatorProcess = spawn(JAVA_PATH, [
    '-jar', EMULATOR_JAR,
    '--host', '127.0.0.1',
    '--port', '8080',
    '--rules', RULES_PATH,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  emulatorProcess.stdout.on('data', (d) => {
    const s = d.toString();
    if (s.includes('Dev App Server is now running') || s.includes('Running')) {
      console.log('[Emulator stdout]:', s.trim());
    }
  });

  emulatorProcess.stderr.on('data', (d) => {
    const s = d.toString();
    if (!s.includes('SLF4J:')) {
      console.error('[Emulator stderr]:', s.trim());
    }
  });

  try {
    await waitForEmulator(8080);
    console.log('--- EMULATOR READY ON PORT 8080 ---');

    console.log('\n======================================================');
    console.log('RUNNING TEST SUITE: test/registration_security_audit.test.js');
    console.log('======================================================');
    const out1 = execSync('npx mocha --exit --timeout 30000 test/registration_security_audit.test.js', {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log(out1);

    console.log('\n======================================================');
    console.log('RUNNING TEST SUITE: test/registration_rules_verification.test.js');
    console.log('======================================================');
    const out2 = execSync('npx mocha --exit --timeout 30000 test/registration_rules_verification.test.js', {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log(out2);

    console.log('--- ALL TEST SUITES PASSED SUCCESSFULLY ---');
  } finally {
    console.log('--- SHUTTING DOWN EMULATOR ---');
    emulatorProcess.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
