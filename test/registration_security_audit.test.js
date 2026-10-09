/**
 * ITACON GRANITO — Registration Security Rules Emulator Tests
 * ============================================================
 * Tests the specific registration permission scenarios requested:
 * 1. Existing stub with welcomeBonusGranted can complete registration.
 * 2. Customer cannot add or change loyaltyPoints.
 * 3. Customer cannot add or change lifetimePoints.
 * 4. Customer cannot add or change welcomeBonusGranted.
 * 5. Customer cannot add or change referredBy.
 * 6. Customer cannot assign themselves an unauthorized salesperson (change pre-assigned).
 * 7. Customer cannot modify another user's document.
 * 8. Legitimate customer profile updates still work.
 * 9. Category mirror writes (dealers/{uid}, etc.) succeed.
 * 10. Real WriteBatch (users/{uid} + dealers/{uid}) on existing stub succeeds.
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

const TEST_UID = 'test_user_3zdYNxT4uiOjtZx3hQdieEEKlJ32';
const OTHER_UID = 'other_user_999999999999999999999';

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

describe('ITACON REGISTRATION SECURITY RULES VALIDATION', () => {

  it('1. Existing stub with welcomeBonusGranted can complete registration (PASS)', async () => {
    // Setup pre-existing stub created by backend / loyalty / FCM trigger
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        fcmToken: 'sample_token_123',
        welcomeBonusGranted: true,
        fcmTokenUpdatedAt: new Date().toISOString(),
      });
    });

    const db = asUser(TEST_UID);
    const registrationPayload = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Ramesh Patel',
      phone: '+919624818477',
      role: 'dealer',
      userCategory: 'dealer',
      status: 'active',
      isVerified: true,
      phoneVerified: true,
      welcomeBonusGranted: true, // unchanged
      fcmToken: 'sample_token_123',
    };

    await assertSucceeds(
      db.collection('users').doc(TEST_UID).set(registrationPayload, { merge: true })
    );
  });

  it('2. Customer cannot add or change loyaltyPoints (DENY)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        fcmToken: 'sample_token_123',
        welcomeBonusGranted: true,
      });
    });

    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('users').doc(TEST_UID).set({
        role: 'dealer',
        userCategory: 'dealer',
        loyaltyPoints: 100, // Attacker smuggling loyalty points
      }, { merge: true })
    );
  });

  it('3. Customer cannot add or change lifetimePoints (DENY)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        fcmToken: 'sample_token_123',
        welcomeBonusGranted: true,
      });
    });

    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('users').doc(TEST_UID).set({
        role: 'dealer',
        userCategory: 'dealer',
        lifetimePoints: 500, // Attacker smuggling lifetime points
      }, { merge: true })
    );
  });

  it('4. Customer cannot add or change welcomeBonusGranted (DENY)', async () => {
    // Case 4a: Stub without welcomeBonusGranted, customer tries to add it
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        fcmToken: 'sample_token_123',
      });
    });

    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('users').doc(TEST_UID).set({
        role: 'dealer',
        userCategory: 'dealer',
        welcomeBonusGranted: true, // Attempting to grant bonus themselves
      }, { merge: true })
    );

    // Case 4b: Stub with welcomeBonusGranted: false, customer tries to flip it to true
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        fcmToken: 'sample_token_123',
        welcomeBonusGranted: false,
      });
    });

    await assertFails(
      db.collection('users').doc(TEST_UID).set({
        role: 'dealer',
        userCategory: 'dealer',
        welcomeBonusGranted: true, // Flipping false -> true
      }, { merge: true })
    );
  });

  it('5. Customer cannot add or change referredBy (DENY)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        fcmToken: 'sample_token_123',
        welcomeBonusGranted: true,
      });
    });

    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('users').doc(TEST_UID).set({
        role: 'dealer',
        userCategory: 'dealer',
        referredBy: 'FORGED_REF_CODE_999',
      }, { merge: true })
    );
  });

  it('6. Customer cannot assign themselves an unauthorized salesperson (DENY)', async () => {
    // Stub was pre-assigned to SP_STAFF_1
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        salesPersonId: 'SP_STAFF_1',
        assignedSalespersonId: 'SP_STAFF_1',
      });
    });

    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('users').doc(TEST_UID).set({
        role: 'dealer',
        userCategory: 'dealer',
        salesPersonId: 'SP_MALICIOUS_OVERRIDE',
        assignedSalespersonId: 'SP_MALICIOUS_OVERRIDE',
      }, { merge: true })
    );
  });

  it('7. Customer cannot modify another user doc (DENY)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(OTHER_UID).set({
        name: 'Bob',
        role: 'dealer',
        userCategory: 'dealer',
      });
    });

    const db = asUser(TEST_UID);
    await assertFails(
      db.collection('users').doc(OTHER_UID).update({
        name: 'Hacked by Alice',
      })
    );
  });

  it('8. Legitimate customer profile updates still work (PASS)', async () => {
    // Setup fully registered user
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        name: 'Ramesh Patel',
        phone: '+919624818477',
        role: 'dealer',
        userCategory: 'dealer',
        status: 'active',
        fcmToken: 'token_old',
      });
    });

    const db = asUser(TEST_UID);
    await assertSucceeds(
      db.collection('users').doc(TEST_UID).update({
        name: 'Ramesh Patel Updated',
        fcmToken: 'token_new',
      })
    );
  });

  it('9. Category mirror write dealers/{uid} succeeds (PASS)', async () => {
    const db = asUser(TEST_UID);
    await assertSucceeds(
      db.collection('dealers').doc(TEST_UID).set({
        userId: TEST_UID,
        name: 'Ramesh Patel',
        role: 'dealer',
        userCategory: 'dealer',
      })
    );
  });

  it('10. Full registration WriteBatch on existing stub with welcomeBonusGranted succeeds (PASS)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(TEST_UID).set({
        fcmToken: 'sample_token_123',
        welcomeBonusGranted: true,
        fcmTokenUpdatedAt: new Date().toISOString(),
      });
    });

    const db = asUser(TEST_UID);
    const batch = db.batch();

    const masterDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Ramesh Patel',
      phone: '+919624818477',
      role: 'dealer',
      userCategory: 'dealer',
      status: 'active',
      isVerified: true,
      phoneVerified: true,
      welcomeBonusGranted: true, // unchanged
      fcmToken: 'sample_token_123',
    };

    const categoryDoc = {
      userId: TEST_UID,
      uid: TEST_UID,
      name: 'Ramesh Patel',
      phone: '+919624818477',
      role: 'dealer',
      userCategory: 'dealer',
    };

    batch.set(db.collection('users').doc(TEST_UID), masterDoc, { merge: true });
    batch.set(db.collection('dealers').doc(TEST_UID), categoryDoc, { merge: true });

    await assertSucceeds(batch.commit());
  });

});
