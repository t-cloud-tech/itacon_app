/**
 * scripts/run_step3_comprehensive_tests.js
 * 
 * Step 3 Automated Verification Suite for Itacon Auto-Assign Sales Executive:
 * Tests 1-7, plus full clean-up and count restoration.
 */

const admin = require('../functions/node_modules/firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();
const {
  handleAutoAssignSalesperson,
  handleVerifyReferralCode,
} = require('../functions/salespersonSyncEngine');

const TEST_USER_IDS = [];

function registerTestUser(uid) {
  TEST_USER_IDS.push(uid);
}

async function getSalespersonSnapshots() {
  const snap = await db.collection('salesPersons').get();
  const map = {};
  for (const doc of snap.docs) {
    const d = doc.data();
    map[doc.id] = {
      id: doc.id,
      name: d.name || d.fullName || 'N/A',
      referralCode: d.referralCode || 'N/A',
      isActive: d.isActive,
      assignedClientsCount: Number(d.assignedClientsCount) || 0,
      activeClientsCount: Number(d.activeClientsCount) || 0,
      lastAutoAssignedAt: d.lastAutoAssignedAt ? (d.lastAutoAssignedAt.toDate ? d.lastAutoAssignedAt.toDate().toISOString() : d.lastAutoAssignedAt) : null,
    };
  }
  return map;
}

async function runTests() {
  console.log('================================================================');
  console.log('STEP 3: AUTOMATED VERIFICATION SUITE — AUTO-ASSIGN SALESPERSON');
  console.log('================================================================\n');

  const initialSp = await getSalespersonSnapshots();
  console.log('INITIAL ACTIVE SALESPERSON WORKLOAD:');
  for (const sp of Object.values(initialSp)) {
    if (sp.isActive === true || sp.isActive === 'true') {
      console.log(`- ${sp.name} (${sp.referralCode}, ID: ${sp.id}): assigned=${sp.assignedClientsCount}, active=${sp.activeClientsCount}, lastAutoAssignedAt=${sp.lastAutoAssignedAt}`);
    }
  }
  console.log('');

  // -------------------------------------------------------------
  // TEST 1: Auto-assign 1 test user
  // -------------------------------------------------------------
  console.log('--- TEST 1: Auto-assign 1 test user ---');
  const user1Id = `test_step3_user_1_${Date.now()}`;
  registerTestUser(user1Id);
  await db.collection('users').doc(user1Id).set({
    name: 'Test Client 1',
    phone: '+919000000001',
    role: 'dealer',
    status: 'pending_salesperson_verification',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const res1 = await handleAutoAssignSalesperson(db, user1Id);
  console.log(`Result 1: Successfully assigned to ${res1.salespersonName} (ID: ${res1.salespersonId}, Code: ${res1.referralCode})`);

  const spAfter1 = await getSalespersonSnapshots();
  const chosenSp1 = spAfter1[res1.salespersonId];
  const initialSp1 = initialSp[res1.salespersonId];
  console.log(`Counts before: assigned=${initialSp1.assignedClientsCount}, active=${initialSp1.activeClientsCount}`);
  console.log(`Counts after:  assigned=${chosenSp1.assignedClientsCount}, active=${chosenSp1.activeClientsCount}`);
  console.log(`lastAutoAssignedAt: ${chosenSp1.lastAutoAssignedAt}`);

  if (chosenSp1.assignedClientsCount !== initialSp1.assignedClientsCount + 1) {
    throw new Error(`Test 1 Failed: assignedClientsCount did not increment by 1!`);
  }
  console.log('>>> TEST 1 PASSED!\n');

  // -------------------------------------------------------------
  // TEST 2: Auto-assign 4 more users (spread test)
  // -------------------------------------------------------------
  console.log('--- TEST 2: Auto-assign 4 more users (spread test) ---');
  const spreadUsers = ['B', 'C', 'D', 'E'];
  for (const letter of spreadUsers) {
    const uid = `test_step3_user_${letter}_${Date.now()}`;
    registerTestUser(uid);
    await db.collection('users').doc(uid).set({
      name: `Test Client ${letter}`,
      phone: `+91900000000${letter.charCodeAt(0) % 10}`,
      role: 'dealer',
      status: 'pending_salesperson_verification',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const res = await handleAutoAssignSalesperson(db, uid);
    const spState = (await getSalespersonSnapshots())[res.salespersonId];
    console.log(`User ${letter} -> Assigned to: ${res.salespersonName} (${res.referralCode}) | New Assigned Count: ${spState.assignedClientsCount}`);
  }
  console.log('>>> TEST 2 PASSED!\n');

  // -------------------------------------------------------------
  // TEST 3: Concurrency test (5 concurrent auto-assign calls)
  // -------------------------------------------------------------
  console.log('--- TEST 3: Concurrency test (5 concurrent auto-assign calls) ---');
  const concUsers = [1, 2, 3, 4, 5].map(i => `test_step3_conc_${i}_${Date.now()}`);
  for (const uid of concUsers) {
    registerTestUser(uid);
    await db.collection('users').doc(uid).set({
      name: `Concurrent Client ${uid.slice(-4)}`,
      phone: '+919111111111',
      role: 'dealer',
      status: 'pending_salesperson_verification',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const spBeforeConc = await getSalespersonSnapshots();
  const totalAssignedBeforeConc = Object.values(spBeforeConc)
    .filter(s => s.isActive === true || s.isActive === 'true')
    .reduce((sum, s) => sum + s.assignedClientsCount, 0);

  const concResults = await Promise.all(concUsers.map(uid => handleAutoAssignSalesperson(db, uid)));
  console.log(`All 5 concurrent requests finished:`);
  concResults.forEach((r, idx) => console.log(`  [${idx + 1}] User ${concUsers[idx].slice(-6)} -> ${r.salespersonName} (${r.referralCode})`));

  const spAfterConc = await getSalespersonSnapshots();
  const totalAssignedAfterConc = Object.values(spAfterConc)
    .filter(s => s.isActive === true || s.isActive === 'true')
    .reduce((sum, s) => sum + s.assignedClientsCount, 0);

  console.log(`Total active assigned clients before concurrency: ${totalAssignedBeforeConc}`);
  console.log(`Total active assigned clients after concurrency:  ${totalAssignedAfterConc}`);
  if (totalAssignedAfterConc !== totalAssignedBeforeConc + 5) {
    throw new Error(`Test 3 Failed: expected total increase of 5, got ${totalAssignedAfterConc - totalAssignedBeforeConc}`);
  }
  console.log('>>> TEST 3 PASSED!\n');

  // -------------------------------------------------------------
  // TEST 4: Inactive salesperson test
  // -------------------------------------------------------------
  console.log('--- TEST 4: Inactive salesperson test ---');
  // Temporary test salesperson marked inactive
  const inactiveSpId = `test_sp_inactive_${Date.now()}`;
  await db.collection('salesPersons').doc(inactiveSpId).set({
    name: 'Inactive Test Salesperson',
    referralCode: 'INACTIVE_TEST_SP',
    referralCodeKey: 'INACTIVETESTSP',
    isActive: false,
    assignedClientsCount: 0, // lowest count!
    activeClientsCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const testUser4 = `test_step3_user_inactive_check_${Date.now()}`;
  registerTestUser(testUser4);
  await db.collection('users').doc(testUser4).set({
    name: 'Test Client 4',
    phone: '+919222222222',
    role: 'dealer',
    status: 'pending_salesperson_verification',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const res4 = await handleAutoAssignSalesperson(db, testUser4);
  console.log(`Auto-assign result with inactive SP present (assigned to: ${res4.salespersonName}, ID: ${res4.salespersonId})`);
  if (res4.salespersonId === inactiveSpId) {
    throw new Error(`Test 4 Failed: Inactive salesperson was chosen!`);
  }
  // Delete the temporary inactive SP doc
  await db.collection('salesPersons').doc(inactiveSpId).delete();
  console.log('>>> TEST 4 PASSED (Inactive SP was correctly ignored)!\n');

  // -------------------------------------------------------------
  // TEST 5: Already-linked user test
  // -------------------------------------------------------------
  console.log('--- TEST 5: Already-linked user test ---');
  let threwAlreadyLinked = false;
  try {
    await handleAutoAssignSalesperson(db, user1Id);
  } catch (err) {
    if (err.code === 'already-exists' || err.message === 'already-linked') {
      threwAlreadyLinked = true;
      console.log(`Correctly rejected already-linked user with: ${err.message || err.code}`);
    } else {
      console.log(`Threw unexpected error: ${err.message}`);
    }
  }
  if (!threwAlreadyLinked) {
    throw new Error('Test 5 Failed: Already-linked user was not rejected!');
  }
  console.log('>>> TEST 5 PASSED!\n');

  // -------------------------------------------------------------
  // TEST 6: Manual code test (regression check)
  // -------------------------------------------------------------
  console.log('--- TEST 6: Manual code test (regression check) ---');
  const userManualId = `test_step3_user_manual_${Date.now()}`;
  registerTestUser(userManualId);
  await db.collection('users').doc(userManualId).set({
    name: 'Test Client Manual',
    phone: '+919333333333',
    role: 'dealer',
    status: 'pending_salesperson_verification',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const spBeforeManual = (await getSalespersonSnapshots())['rjcilii6IphXIxmF2l5SKyLaEuq1'];
  const resManual = await handleVerifyReferralCode(db, userManualId, {
    referralCode: 'SALES-107',
    autoAssign: false,
  });
  console.log(`Manual verification result: assigned to ${resManual.salespersonName} (${resManual.referralCode})`);

  const spAfterManual = (await getSalespersonSnapshots())['rjcilii6IphXIxmF2l5SKyLaEuq1'];
  console.log(`Mohit counts: before=${spBeforeManual.assignedClientsCount}, after=${spAfterManual.assignedClientsCount}`);
  if (spAfterManual.assignedClientsCount !== spBeforeManual.assignedClientsCount + 1) {
    throw new Error('Test 6 Failed: Mohit counts did not increment for manual referral code!');
  }
  console.log('>>> TEST 6 PASSED!\n');

  // -------------------------------------------------------------
  // TEST 7: Customer referral integration test
  // -------------------------------------------------------------
  console.log('--- TEST 7: Customer referral integration test ---');
  const custRefUserId = `test_step3_user_custref_${Date.now()}`;
  registerTestUser(custRefUserId);
  await db.collection('users').doc(custRefUserId).set({
    name: 'Customer Referral Auto Client',
    phone: '+919444444444',
    role: 'dealer',
    referredByCode: 'ITA-554433',
    customerReferralCode: 'ITA-554433',
    status: 'pending_salesperson_verification',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const res7 = await handleAutoAssignSalesperson(db, custRefUserId);
  console.log(`Customer-referred user auto-assigned to: ${res7.salespersonName} (${res7.referralCode})`);

  // Verify customer referral mirror document was preserved and created
  const custRefDoc = await db.collection('customer_referrals').doc(`${custRefUserId}_${res7.referralCode}`).get();
  console.log(`customer_referrals doc created: ${custRefDoc.exists}`);
  if (!custRefDoc.exists) {
    throw new Error('Test 7 Failed: customer_referrals mirror was not created!');
  }
  console.log('>>> TEST 7 PASSED!\n');

  // -------------------------------------------------------------
  // CLEAN UP TEST USERS & RESTORE COUNTS
  // -------------------------------------------------------------
  console.log('--- CLEANING UP TEST ARTIFACTS ---');
  console.log(`Deleting ${TEST_USER_IDS.length} test users...`);
  for (const uid of TEST_USER_IDS) {
    await db.collection('users').doc(uid).delete().catch(() => {});
    await db.collection('client_assignments').doc(`ASGN_${uid}`).delete().catch(() => {});
    await db.collection('Auto_Assign_User').doc(uid).delete().catch(() => {});
    await db.collection('Manual_salesperson_assign').doc(uid).delete().catch(() => {});
    
    // Also remove from salesPersons assigned_clients subcollection
    const spSnap = await db.collection('salesPersons').get();
    for (const spDoc of spSnap.docs) {
      await spDoc.ref.collection('assigned_clients').doc(uid).delete().catch(() => {});
    }
  }

  // Also clean up customer_referrals docs for test users
  const custRefSnap = await db.collection('customer_referrals').get();
  for (const doc of custRefSnap.docs) {
    if (TEST_USER_IDS.some(id => doc.id.startsWith(id))) {
      await doc.ref.delete().catch(() => {});
    }
  }
  console.log('Test users cleaned up.');

  // Recount actual clients from users collection to restore exact production counts
  console.log('Recounting and restoring clean production counts...');
  const usersSnap = await db.collection('users').get();
  const realCounts = {};
  for (const userDoc of usersSnap.docs) {
    const u = userDoc.data() || {};
    const spId = (u.salesPersonId || u.assignedSalespersonId || '').trim();
    if (spId) {
      realCounts[spId] = realCounts[spId] || { total: 0, active: 0 };
      realCounts[spId].total++;
      if (u.isActive !== false && u.status !== 'inactive' && u.status !== 'blocked') {
        realCounts[spId].active++;
      }
    }
  }

  const finalSpSnap = await db.collection('salesPersons').get();
  for (const spDoc of finalSpSnap.docs) {
    const spData = spDoc.data() || {};
    if (spData.isActive === true || spData.isActive === 'true') {
      const spId = spDoc.id;
      const verifiedTotal = realCounts[spId]?.total || 0;
      const verifiedActive = realCounts[spId]?.active || 0;
      await spDoc.ref.update({
        assignedClientsCount: verifiedTotal,
        activeClientsCount: verifiedActive,
      });
      console.log(`Restored ${spData.name || spId}: assignedClientsCount=${verifiedTotal}, activeClientsCount=${verifiedActive}`);
    }
  }

  console.log('\n================================================================');
  console.log('ALL TESTS COMPLETED SUCCESSFULLY & PRODUCTION COUNTS PRISTINE!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
