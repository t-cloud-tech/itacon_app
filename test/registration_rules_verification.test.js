/**
 * ITACON GRANITO — Registration Security Rules Verification Tests
 * ===============================================================
 * Validates Section 2 requirements:
 * 1. Allow: users/TEST_UID creation/update
 * 2. Allow: category/TEST_UID creation (dealers, architects, builders, wholesalers, retailers)
 * 3. Deny: users/OTHER_UID (cross-UID)
 * 4. Deny: category/OTHER_UID (cross-UID)
 * 5. Deny: credential fields inside category mirrors
 * 6. Deny: staff-only assignment collections from normal customer
 * 7. Real registration WriteBatch (users/{uid} + category/{uid}) succeeds under current rules
 */

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { describe, before, after, beforeEach, it } = require('mocha');

const PROJECT_ID = 'itacon-app';
const RULES_FILE = resolve(__dirname, '../firestore.rules');

const TEST_UID = 'TEST_CUSTOMER_UID_101';
const OTHER_UID = 'OTHER_CUSTOMER_UID_999';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_FILE, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function asUser(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function asGuest() {
  return testEnv.unauthenticatedContext().firestore();
}

describe('SECTION 2: FIRESTORE RULES VERIFICATION FOR CUSTOMER REGISTRATION', function () {
  this.timeout(30000);

  it('1. Allow: users/TEST_UID creation with canonical payload (no sensitive plaintext fields)', async () => {
    const db = asUser(TEST_UID);
    const userPayload = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Ramesh Patel',
      username: 'ramesh patel',
      phone: '+919876543210',
      countryCode: '+91',
      rawPhone: '9876543210',
      role: 'dealer',
      userCategory: 'Dealer',
      status: 'active',
      passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      passwordSalt: 'abc123salt',
      salesPersonId: 'SP_001',
      assignedSalespersonId: 'SP_001',
      isVerified: true,
      phoneVerified: true,
      emailVerified: true,
      whatsappVerified: true,
    };

    await assertSucceeds(
      db.collection('users').doc(TEST_UID).set(userPayload)
    );
  });

  it('2. Allow: Real WriteBatch for Dealer -> dealers/{uid} (PASS)', async () => {
    const db = asUser(TEST_UID);
    const batch = db.batch();

    const masterDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Dealer User',
      phone: '+919876543210',
      userCategory: 'Dealer',
      role: 'dealer',
      passwordHash: 'hash123',
      passwordSalt: 'salt123',
    };
    const categoryDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Dealer User',
      phone: '+919876543210',
      userCategory: 'Dealer',
      role: 'dealer',
      categoryLabel: 'Dealer',
    };

    batch.set(db.collection('users').doc(TEST_UID), masterDoc);
    batch.set(db.collection('dealers').doc(TEST_UID), categoryDoc);
    await assertSucceeds(batch.commit());
  });

  it('3. Allow: Real WriteBatch for Architect / Interior Designer -> architects/{uid} (PASS)', async () => {
    const db = asUser(TEST_UID);
    const batch = db.batch();

    const masterDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Architect User',
      phone: '+919876543210',
      userCategory: 'Architect / Interior Designer',
      role: 'architect',
      passwordHash: 'hash123',
      passwordSalt: 'salt123',
    };
    const categoryDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Architect User',
      phone: '+919876543210',
      userCategory: 'Architect / Interior Designer',
      role: 'architect',
      categoryLabel: 'Architect / Interior Designer',
    };

    batch.set(db.collection('users').doc(TEST_UID), masterDoc);
    batch.set(db.collection('architects').doc(TEST_UID), categoryDoc);
    await assertSucceeds(batch.commit());
  });

  it('4. Allow: Real WriteBatch for Builder / Contractor -> builders/{uid} (PASS)', async () => {
    const db = asUser(TEST_UID);
    const batch = db.batch();

    const masterDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Builder User',
      phone: '+919876543210',
      userCategory: 'Builder / Contractor',
      role: 'builder',
      passwordHash: 'hash123',
      passwordSalt: 'salt123',
    };
    const categoryDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Builder User',
      phone: '+919876543210',
      userCategory: 'Builder / Contractor',
      role: 'builder',
      categoryLabel: 'Builder / Contractor',
    };

    batch.set(db.collection('users').doc(TEST_UID), masterDoc);
    batch.set(db.collection('builders').doc(TEST_UID), categoryDoc);
    await assertSucceeds(batch.commit());
  });

  it('5. Allow: Real WriteBatch for Wholesaler -> wholesalers/{uid} (PASS)', async () => {
    const db = asUser(TEST_UID);
    const batch = db.batch();

    const masterDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Wholesaler User',
      phone: '+919876543210',
      userCategory: 'Wholesaler',
      role: 'wholesaler',
      passwordHash: 'hash123',
      passwordSalt: 'salt123',
    };
    const categoryDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Wholesaler User',
      phone: '+919876543210',
      userCategory: 'Wholesaler',
      role: 'wholesaler',
      categoryLabel: 'Wholesaler',
    };

    batch.set(db.collection('users').doc(TEST_UID), masterDoc);
    batch.set(db.collection('wholesalers').doc(TEST_UID), categoryDoc);
    await assertSucceeds(batch.commit());
  });

  it('6. Allow: Real WriteBatch for Retailer -> retailers/{uid} (PASS)', async () => {
    const db = asUser(TEST_UID);
    const batch = db.batch();

    const masterDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Retailer User',
      phone: '+919876543210',
      userCategory: 'Retailer',
      role: 'retailer',
      passwordHash: 'hash123',
      passwordSalt: 'salt123',
    };
    const categoryDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Retailer User',
      phone: '+919876543210',
      userCategory: 'Retailer',
      role: 'retailer',
      categoryLabel: 'Retailer',
    };

    batch.set(db.collection('users').doc(TEST_UID), masterDoc);
    batch.set(db.collection('retailers').doc(TEST_UID), categoryDoc);
    await assertSucceeds(batch.commit());
  });

  it('7. Deny: Missing category / unmapped category mirror is BLOCKED', async () => {
    const db = asUser(TEST_UID);
    // Writing to an unmapped/arbitrary collection without explicit rule is denied by default
    await assertFails(
      db.collection('contractors').doc(TEST_UID).set({
        userId: TEST_UID,
        name: 'Invalid Mirror',
      })
    );
  });

  it('8. Deny: Invalid category collection name is BLOCKED', async () => {
    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('random_category').doc(TEST_UID).set({
        userId: TEST_UID,
        name: 'Invalid Category',
      })
    );
  });

  it('9. Deny: users/OTHER_UID cross-UID creation attempt is BLOCKED', async () => {
    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('users').doc(OTHER_UID).set({
        userId: OTHER_UID,
        uid: OTHER_UID,
        name: 'Attacker Impersonator',
        phone: '+919876543210',
        role: 'dealer',
      })
    );
  });

  it('10. Deny: category/OTHER_UID cross-UID creation attempt is BLOCKED', async () => {
    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('dealers').doc(OTHER_UID).set({
        userId: OTHER_UID,
        uid: OTHER_UID,
        name: 'Attacker In Category',
      })
    );
  });

  it('11. Deny: Staff/admin role injection in users/{uid} is BLOCKED', async () => {
    const db = asUser(TEST_UID);

    // Customer cannot inject role: 'admin'
    await assertFails(
      db.collection('users').doc(TEST_UID).set({
        userId: TEST_UID,
        uid: TEST_UID,
        name: 'Malicious User',
        role: 'admin',
      })
    );

    // Customer cannot inject role: 'salesperson'
    await assertFails(
      db.collection('users').doc(TEST_UID).set({
        userId: TEST_UID,
        uid: TEST_UID,
        name: 'Malicious User',
        role: 'salesperson',
      })
    );
  });

  it('12. Deny: Credential fields inside category mirror is BLOCKED', async () => {
    const db = asUser(TEST_UID);
    
    // Check plaintext password denial in category mirror
    await assertFails(
      db.collection('dealers').doc(TEST_UID).set({
        userId: TEST_UID,
        password: 'PlaintextPassword123!',
      })
    );

    // Check token denial in category mirror
    await assertFails(
      db.collection('dealers').doc(TEST_UID).set({
        userId: TEST_UID,
        token: 'secret_jwt_token',
      })
    );
  });

  it('13. Deny: Staff-only assignment collections from normal customer is BLOCKED', async () => {
    const db = asUser(TEST_UID);

    // a. client_assignments
    await assertFails(
      db.collection('client_assignments').doc(`ASGN_${TEST_UID}`).set({
        clientId: TEST_UID,
        salespersonId: 'SP_001',
      })
    );

    // b. Auto_Assign_User
    await assertFails(
      db.collection('Auto_Assign_User').doc(TEST_UID).set({
        clientId: TEST_UID,
        salespersonId: 'SP_001',
      })
    );

    // c. salesPersons/{spId}/assigned_clients
    await assertFails(
      db.collection('salesPersons').doc('SP_001').collection('assigned_clients').doc(TEST_UID).set({
        clientId: TEST_UID,
      })
    );
  });

});
