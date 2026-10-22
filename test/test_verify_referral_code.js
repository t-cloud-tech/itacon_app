/**
 * test/test_verify_referral_code.js
 * 
 * End-to-end integration test suite for STEP 3:
 * 1. Valid referral code "SALES-107"
 * 2. Lowercase code "sales-107"
 * 3. Code with spaces "  SALES-107  "
 * 4. Code without hyphen "SALES107" (matches SALES-107)
 * 5. Invalid code (asserts throws not-found / invalid-code)
 * 6. Inactive salesperson's code (asserts throws failed-precondition / inactive-code)
 * 7. Same user verifying twice (asserts idempotent, counts do NOT increase twice)
 * 8. User already linked to different salesperson (asserts throws already-exists / already-linked)
 * 9. Auto-Assign mode (autoAssign: true) assigns active salesperson with lowest workload and increments counts
 */

const { spawn } = require('child_process');
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
    handleVerifyReferralCode,
    handleClientCreated,
    handleClientUpdated,
    computeReferralCodeKey,
  } = require('../functions/salespersonSyncEngine');

  console.log('\n======================================================');
  console.log('--- RUNNING STEP 3: VERIFY REFERRAL CODE & AUTO-ASSIGN TESTS ---');
  console.log('======================================================\n');

  // SETUP: Create Active Salesperson SALES-107
  const SP_ACTIVE_ID = 'SP_ACTIVE_107';
  await db.collection('salesPersons').doc(SP_ACTIVE_ID).set({
    salesPersonId: SP_ACTIVE_ID,
    name: 'Vraj Shah',
    fullName: 'Vraj Shah',
    email: 'vraj.shah@itacon.com',
    phone: '+919998887770',
    referralCode: 'SALES-107',
    referralCodeKey: computeReferralCodeKey('SALES-107'),
    status: 'active',
    isActive: true,
    assignedClientsCount: 0,
    activeClientsCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // SETUP: Create Inactive Salesperson SALES-999
  const SP_INACTIVE_ID = 'SP_INACTIVE_999';
  await db.collection('salesPersons').doc(SP_INACTIVE_ID).set({
    salesPersonId: SP_INACTIVE_ID,
    name: 'Inactive Rep',
    fullName: 'Inactive Rep',
    email: 'inactive@itacon.com',
    phone: '+919998887779',
    referralCode: 'SALES-999',
    referralCodeKey: computeReferralCodeKey('SALES-999'),
    status: 'inactive',
    isActive: false,
    assignedClientsCount: 0,
    activeClientsCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('✔ Seeded test salespersons: active "SALES-107" and inactive "SALES-999"');

  // TEST 1: Valid Code "SALES-107"
  console.log('\n[TEST 1] Verifying valid code "SALES-107" for user_001...');
  const res1 = await handleVerifyReferralCode(db, 'user_001', { referralCode: 'SALES-107' });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.salespersonId, SP_ACTIVE_ID);
  assert.strictEqual(res1.referralCode, 'SALES-107');
  assert.strictEqual(res1.salespersonName, 'Vraj Shah');

  // Verify user_001 document in users collection
  const user1Doc = await db.collection('users').doc('user_001').get();
  assert.strictEqual(user1Doc.data().salesPersonId, SP_ACTIVE_ID);
  assert.strictEqual(user1Doc.data().status, 'active');
  assert.strictEqual(user1Doc.data().isVerified, true);

  // Verify salesperson counts (assigned=1, active=1)
  let spSnap = await db.collection('salesPersons').doc(SP_ACTIVE_ID).get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 1);
  assert.strictEqual(spSnap.data().activeClientsCount, 1);
  console.log('✔ TEST 1 PASSED: "SALES-107" linked successfully, counts: assigned=1, active=1');

  // TEST 2: Lowercase Code "sales-107"
  console.log('\n[TEST 2] Verifying lowercase code "sales-107" for user_002...');
  const res2 = await handleVerifyReferralCode(db, 'user_002', { referralCode: 'sales-107' });
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.salespersonId, SP_ACTIVE_ID);

  spSnap = await db.collection('salesPersons').doc(SP_ACTIVE_ID).get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 2);
  assert.strictEqual(spSnap.data().activeClientsCount, 2);
  console.log('✔ TEST 2 PASSED: "sales-107" linked successfully, counts: assigned=2, active=2');

  // TEST 3: Code with spaces "  SALES-107  "
  console.log('\n[TEST 3] Verifying code with spaces "  SALES-107  " for user_003...');
  const res3 = await handleVerifyReferralCode(db, 'user_003', { referralCode: '  SALES-107  ' });
  assert.strictEqual(res3.success, true);
  assert.strictEqual(res3.salespersonId, SP_ACTIVE_ID);

  spSnap = await db.collection('salesPersons').doc(SP_ACTIVE_ID).get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 3);
  assert.strictEqual(spSnap.data().activeClientsCount, 3);
  console.log('✔ TEST 3 PASSED: Code with spaces trimmed and linked, counts: assigned=3, active=3');

  // TEST 4: Code without hyphen "SALES107"
  console.log('\n[TEST 4] Verifying code without hyphen "SALES107" for user_004...');
  const res4 = await handleVerifyReferralCode(db, 'user_004', { referralCode: 'SALES107' });
  assert.strictEqual(res4.success, true);
  assert.strictEqual(res4.salespersonId, SP_ACTIVE_ID);

  spSnap = await db.collection('salesPersons').doc(SP_ACTIVE_ID).get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 4);
  assert.strictEqual(spSnap.data().activeClientsCount, 4);
  console.log('✔ TEST 4 PASSED: Hyphen-less code "SALES107" matched, counts: assigned=4, active=4');

  // TEST 5: Invalid Code
  console.log('\n[TEST 5] Verifying invalid code "NON_EXISTENT_999"...');
  let threwInvalid = false;
  try {
    await handleVerifyReferralCode(db, 'user_invalid', { referralCode: 'NON_EXISTENT_999' });
  } catch (err) {
    threwInvalid = true;
    assert(err.message === 'invalid-code' || err.code === 'not-found');
  }
  assert.strictEqual(threwInvalid, true, 'Expected invalid code to throw error');
  console.log('✔ TEST 5 PASSED: Invalid code rejected with error');

  // TEST 6: Inactive Salesperson's Code "SALES-999"
  console.log('\n[TEST 6] Verifying inactive salesperson code "SALES-999"...');
  let threwInactive = false;
  try {
    await handleVerifyReferralCode(db, 'user_inactive', { referralCode: 'SALES-999' });
  } catch (err) {
    threwInactive = true;
    assert(err.message === 'inactive-code' || err.code === 'failed-precondition');
  }
  assert.strictEqual(threwInactive, true, 'Expected inactive code to throw error');
  console.log('✔ TEST 6 PASSED: Inactive salesperson rejected with error');

  // TEST 7: Idempotency (Same user verifying twice)
  console.log('\n[TEST 7] Verifying user_001 verifying "SALES-107" a second time (idempotency)...');
  const resIdempotent = await handleVerifyReferralCode(db, 'user_001', { referralCode: 'SALES-107' });
  assert.strictEqual(resIdempotent.success, true);
  assert.strictEqual(resIdempotent.alreadyLinked, true);

  spSnap = await db.collection('salesPersons').doc(SP_ACTIVE_ID).get();
  assert.strictEqual(spSnap.data().assignedClientsCount, 4, 'Assigned count must NOT increase on duplicate verification');
  assert.strictEqual(spSnap.data().activeClientsCount, 4, 'Active count must NOT increase on duplicate verification');
  console.log('✔ TEST 7 PASSED: Duplicate verification is idempotent; counts remained at assigned=4, active=4');

  // TEST 8: Already linked to different salesperson
  console.log('\n[TEST 8] Verifying user_001 trying to link to a different salesperson code...');
  // Create another active salesperson
  await db.collection('salesPersons').doc('SP_OTHER').set({
    salesPersonId: 'SP_OTHER',
    name: 'Other Rep',
    referralCode: 'SALES-202',
    status: 'active',
    isActive: true,
    assignedClientsCount: 0,
    activeClientsCount: 0,
  });

  let threwAlreadyLinked = false;
  try {
    await handleVerifyReferralCode(db, 'user_001', { referralCode: 'SALES-202' });
  } catch (err) {
    threwAlreadyLinked = true;
    assert(err.message === 'already-linked' || err.code === 'already-exists');
  }
  assert.strictEqual(threwAlreadyLinked, true, 'Expected reassignment attempt to be rejected');
  console.log('✔ TEST 8 PASSED: Reassignment rejected with "already-linked"');

  // TEST 9: Auto-Assign
  console.log('\n[TEST 9] Testing Auto-Assign for user_auto...');
  // SP_OTHER has assignedClientsCount: 0, while SP_ACTIVE_107 has 4.
  // Auto-assign should select SP_OTHER because it has the lowest workload.
  const resAuto = await handleVerifyReferralCode(db, 'user_auto', { autoAssign: true });
  assert.strictEqual(resAuto.success, true);
  assert.strictEqual(resAuto.salespersonId, 'SP_OTHER');
  assert.strictEqual(resAuto.referralCode, 'SALES-202');

  const otherSnap = await db.collection('salesPersons').doc('SP_OTHER').get();
  assert.strictEqual(otherSnap.data().assignedClientsCount, 1);
  assert.strictEqual(otherSnap.data().activeClientsCount, 1);
  console.log('✔ TEST 9 PASSED: Auto-assign picked least-assigned salesperson (SP_OTHER) and incremented counts');

  console.log('\n======================================================');
  console.log('🎉 ALL 9 INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('======================================================\n');
}

async function main() {
  console.log('Starting Cloud Firestore emulator on port 8080...');
  const emulatorProcess = spawn(JAVA_PATH, [
    '-jar',
    EMULATOR_JAR,
    '--host=127.0.0.1',
    '--port=8080',
    `--rules=${RULES_PATH}`,
  ], { stdio: 'pipe' });

  emulatorProcess.stderr.on('data', (d) => {
    // console.error(`[Emulator ERR] ${d}`);
  });

  try {
    await waitForEmulator(8080);
    console.log('Firestore emulator ready on 127.0.0.1:8080.');
    await runTestSuite();
  } catch (err) {
    console.error('Test suite failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('Shutting down Firestore emulator...');
    emulatorProcess.kill('SIGKILL');
  }
}

main();
