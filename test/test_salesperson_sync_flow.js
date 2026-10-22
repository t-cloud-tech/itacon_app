/**
 * test/test_salesperson_sync_flow.js
 * 
 * Comprehensive end-to-end test suite for Step 4:
 * 1. Starts Firestore emulator on 127.0.0.1:8080
 * 2. Creates a test salesperson
 * 3. Signs up 3 test clients with its code:
 *    - Client 1: exact referral code ("SALES-107")
 *    - Client 2: lowercase referral code ("sales-107")
 *    - Client 3: referral code with extra spaces ("  SALES-107  ")
 * 4. Verifies initial creation and sync (assigned=3, active=3)
 * 5. Deactivates one client (Client 2 -> inactive)
 *    Verifies active count decrements (assigned=3, active=2)
 * 6. Deletes one client (Client 3 deleted)
 *    Verifies assigned & active counts decrement and subdoc removed (assigned=2, active=1)
 * 7. Tests the recalculateSalespersonCounts.js admin script in --dry-run and --apply modes
 * 8. Shuts down the emulator
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const assert = require('assert');

const JAVA_PATH = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\java.exe';
const EMULATOR_JAR = 'C:\\Users\\ttirt\\.cache\\firebase\\emulators\\cloud-firestore-emulator-v1.22.0.jar';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

function waitForEmulator(port, maxAttempts = 90) {
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

async function runTestSuite() {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = 'itacon-app';

  const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'itacon-app' });
  }
  const db = admin.firestore();

  const {
    handleClientCreated,
    handleClientUpdated,
    handleClientDeleted,
  } = require('../functions/salespersonSyncEngine');

  console.log('\n--- STEP 4: RUNNING EMULATOR INTEGRATION TESTS ---\n');

  const SP_ID = 'SP_TEST_FLOW_001';
  const spRef = db.collection('salesPersons').doc(SP_ID);

  // 1. Create a test salesperson
  console.log(`[Test 1] Creating test salesperson (${SP_ID}) with referralCode="SALES-107"...`);
  await spRef.set({
    salesPersonId: SP_ID,
    employeeId: 'EMP-TEST-107',
    name: 'Mohit Test',
    fullName: 'Mohit Test',
    email: 'mohit.test@itacon.com',
    phone: '+919998620524',
    referralCode: 'SALES-107',
    status: 'active',
    isActive: true,
    assignedClientsCount: 0,
    activeClientsCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const spInitialSnap = await spRef.get();
  assert.strictEqual(spInitialSnap.data().assignedClientsCount, 0);
  assert.strictEqual(spInitialSnap.data().activeClientsCount, 0);
  console.log('✔ Test salesperson created with initial counts (assigned=0, active=0)');

  // Helper to execute client creation and trigger handler
  async function triggerClientCreated(userId, clientData) {
    const userRef = db.collection('users').doc(userId);
    await userRef.set(clientData);
    await handleClientCreated(db, userId, clientData);
  }

  // Helper to execute client update and trigger handler
  async function triggerClientUpdated(userId, updateData) {
    const userRef = db.collection('users').doc(userId);
    const beforeSnap = await userRef.get();
    const beforeData = beforeSnap.data() || {};
    await userRef.set(updateData, { merge: true });
    const afterSnap = await userRef.get();
    const afterData = afterSnap.data() || {};
    await handleClientUpdated(db, userId, beforeData, afterData);
  }

  // Helper to execute client deletion and trigger handler
  async function triggerClientDeleted(userId) {
    const userRef = db.collection('users').doc(userId);
    const beforeSnap = await userRef.get();
    const deletedData = beforeSnap.data() || {};
    await userRef.delete();
    await handleClientDeleted(db, userId, deletedData);
  }

  // 2. Sign up 3 test clients
  console.log('\n[Test 2] Signing up Client 1 with EXACT code ("SALES-107")...');
  const CLIENT_1 = 'CLIENT_TEST_001';
  await triggerClientCreated(CLIENT_1, {
    userId: CLIENT_1,
    name: 'Client Exact',
    phone: '+919876500001',
    email: 'client1@test.com',
    role: 'dealer',
    salespersonReferralCode: 'SALES-107',
    status: 'active',
    isActive: true,
  });

  let spSnap = await spRef.get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 1, 'Client 1 should increment assignedClientsCount to 1');
  assert.strictEqual(spSnap.data().activeClientsCount, 1, 'Client 1 should increment activeClientsCount to 1');
  let subdoc1 = await spRef.collection('assigned_clients').doc(CLIENT_1).get();
  assert.strictEqual(subdoc1.exists, true, 'Subcollection doc for Client 1 must exist');
  assert.strictEqual(subdoc1.data().isActive, true);
  console.log('✔ Client 1 processed: counts are assigned=1, active=1, subdoc created.');

  console.log('\n[Test 3] Signing up Client 2 with LOWERCASE code ("sales-107")...');
  const CLIENT_2 = 'CLIENT_TEST_002';
  await triggerClientCreated(CLIENT_2, {
    userId: CLIENT_2,
    name: 'Client Lowercase',
    phone: '+919876500002',
    email: 'client2@test.com',
    role: 'architect',
    salespersonReferralCode: 'sales-107',
    status: 'active',
    isActive: true,
  });

  spSnap = await spRef.get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 2, 'Client 2 should increment assignedClientsCount to 2');
  assert.strictEqual(spSnap.data().activeClientsCount, 2, 'Client 2 should increment activeClientsCount to 2');
  let subdoc2 = await spRef.collection('assigned_clients').doc(CLIENT_2).get();
  assert.strictEqual(subdoc2.exists, true, 'Subcollection doc for Client 2 must exist');
  console.log('✔ Client 2 (lowercase code) processed: counts are assigned=2, active=2, subdoc created.');

  console.log('\n[Test 4] Signing up Client 3 with EXTRA SPACES ("  SALES-107  ")...');
  const CLIENT_3 = 'CLIENT_TEST_003';
  await triggerClientCreated(CLIENT_3, {
    userId: CLIENT_3,
    name: 'Client Extra Spaces',
    phone: '+919876500003',
    email: 'client3@test.com',
    role: 'builder',
    salespersonReferralCode: '  SALES-107  ',
    status: 'active',
    isActive: true,
  });

  spSnap = await spRef.get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 3, 'Client 3 should increment assignedClientsCount to 3');
  assert.strictEqual(spSnap.data().activeClientsCount, 3, 'Client 3 should increment activeClientsCount to 3');
  let subdoc3 = await spRef.collection('assigned_clients').doc(CLIENT_3).get();
  assert.strictEqual(subdoc3.exists, true, 'Subcollection doc for Client 3 must exist');
  console.log('✔ Client 3 (extra spaces) processed: counts are assigned=3, active=3, subdoc created.');

  // 3. Test idempotency (re-triggering creation should not double count)
  console.log('\n[Test 5] Testing Idempotency (re-triggering Client 1 creation)...');
  const user1Snap = await db.collection('users').doc(CLIENT_1).get();
  await handleClientCreated(db, CLIENT_1, user1Snap.data());
  spSnap = await spRef.get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 3, 'Duplicate create must NOT increment assigned count');
  assert.strictEqual(spSnap.data().activeClientsCount, 3, 'Duplicate create must NOT increment active count');
  console.log('✔ Idempotency verified: counts remained assigned=3, active=3.');

  // 4. Deactivate Client 2
  console.log('\n[Test 6] Deactivating Client 2 (status="inactive", isActive=false)...');
  await triggerClientUpdated(CLIENT_2, {
    status: 'inactive',
    isActive: false,
  });

  spSnap = await spRef.get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 3, 'Assigned count must remain 3 after deactivation');
  assert.strictEqual(spSnap.data().activeClientsCount, 2, 'Active count must decrement to 2 after deactivation');
  subdoc2 = await spRef.collection('assigned_clients').doc(CLIENT_2).get();
  assert.strictEqual(subdoc2.data().isActive, false, 'Subcollection doc isActive must be updated to false');
  console.log('✔ Client 2 deactivated: counts are assigned=3, active=2, subdoc.isActive=false.');

  // 5. Delete Client 3
  console.log('\n[Test 7] Deleting Client 3...');
  await triggerClientDeleted(CLIENT_3);

  spSnap = await spRef.get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 2, 'Assigned count must decrement to 2 after deletion');
  assert.strictEqual(spSnap.data().activeClientsCount, 1, 'Active count must decrement to 1 after deletion');
  subdoc3 = await spRef.collection('assigned_clients').doc(CLIENT_3).get();
  assert.strictEqual(subdoc3.exists, false, 'Subcollection doc for Client 3 must be deleted');
  console.log('✔ Client 3 deleted: counts are assigned=2, active=1, subdoc removed.');

  // 6. Test Backfill Script against this Emulator State
  console.log('\n[Test 8] Testing backfill script in DRY-RUN mode against emulator data...');
  const dryRunOutput = execSync('node scripts/recalculateSalespersonCounts.js --dry-run', {
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
  });
  console.log(dryRunOutput);
  assert(dryRunOutput.includes('DRY-RUN COMPLETED'), 'Dry run must complete successfully');

  console.log('\n[Test 9] Testing backfill script in APPLY mode against emulator data...');
  const applyOutput = execSync('node scripts/recalculateSalespersonCounts.js --apply', {
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
  });
  console.log(applyOutput);
  assert(applyOutput.includes('SUCCESS: Applied all'), 'Apply run must complete successfully');

  // Verify final counts after backfill
  spSnap = await spRef.get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 2, 'Final assignedClientsCount must be 2');
  assert.strictEqual(spSnap.data().activeClientsCount, 1, 'Final activeClientsCount must be 1');

  const finalSubDocs = await spRef.collection('assigned_clients').get();
  assert.strictEqual(finalSubDocs.size, 2, 'Final subcollection must contain exactly 2 clients');

  console.log('========================================================================');
  console.log('🎉 ALL STEP 4 EMULATOR TESTS PASSED WITH 100% SUCCESS!');
  console.log('   Final Salesperson Counts Verified: assigned=2, active=1');
  console.log('   Subcollection Verified: 2 documents (1 active, 1 inactive)');
  console.log('========================================================================\n');
}

async function main() {
  console.log('Starting Firestore Emulator on 127.0.0.1:8080...');
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
    console.log('Firestore emulator ready on port 8080.\n');
    await runTestSuite();
  } finally {
    console.log('Shutting down emulator...');
    emulatorProcess.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
