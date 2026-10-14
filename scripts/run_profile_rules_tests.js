const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const JAVA_PATH = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\java.exe';
const EMULATOR_JAR = 'C:\\Users\\ttirt\\.cache\\firebase\\emulators\\cloud-firestore-emulator-v1.22.0.jar';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules.proposed');

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
  console.log('--- STARTING FIRESTORE EMULATOR WITH PROPOSED RULES ---');
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
      // quiet debug logs
    }
  });

  try {
    await waitForEmulator(8080);
    console.log('--- EMULATOR READY ON PORT 8080 ---');

    console.log('\n======================================================');
    console.log('RUNNING TEST SUITE: test/mandatory_profile_completion_rules.test.js');
    console.log('======================================================');
    const out = execSync('npx mocha --exit --timeout 30000 test/mandatory_profile_completion_rules.test.js', {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log(out);

    console.log('--- ALL 11 TESTS PASSED SUCCESSFULLY ---');
  } finally {
    console.log('--- SHUTTING DOWN EMULATOR ---');
    emulatorProcess.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
