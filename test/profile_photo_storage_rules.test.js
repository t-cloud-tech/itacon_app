const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { describe, before, after, it } = require('mocha');

const PROJECT_ID = 'itacon-app';
const FIRESTORE_RULES = resolve(__dirname, '../firestore.rules');
const STORAGE_RULES = resolve(__dirname, '../storage.rules');

const CUSTOMER_ALICE_UID = 'cust_alice_101';
const CUSTOMER_BOB_UID = 'cust_bob_102';
const ADMIN_UID = 'admin_super_901';
const MANAGER_UID = 'mgr_priya_301';
const UNPRIVILEGED_IMPERSONATOR_UID = 'cust_evil_999';

let testEnv;

describe('ITACON Firebase Storage Profile Photo Rules Security Audit', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync(FIRESTORE_RULES, 'utf8'),
      },
      storage: {
        host: '127.0.0.1',
        port: 9199,
        rules: readFileSync(STORAGE_RULES, 'utf8'),
      },
    });

    // Seed Firestore profiles with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const storage = ctx.storage();

      // Normal customer Alice
      await db.collection('users').doc(CUSTOMER_ALICE_UID).set({
        userId: CUSTOMER_ALICE_UID,
        role: 'dealer',
        userCategory: 'dealer',
      });

      // Normal customer Bob
      await db.collection('users').doc(CUSTOMER_BOB_UID).set({
        userId: CUSTOMER_BOB_UID,
        role: 'architect',
        userCategory: 'architect',
      });

      // Admin user
      await db.collection('users').doc(ADMIN_UID).set({
        userId: ADMIN_UID,
        role: 'admin',
        userCategory: 'admin',
      });

      // Manager user
      await db.collection('users').doc(MANAGER_UID).set({
        userId: MANAGER_UID,
        role: 'manager',
        userCategory: 'manager',
      });

      // Evil impersonator: regular customer document with NO admin role
      await db.collection('users').doc(UNPRIVILEGED_IMPERSONATOR_UID).set({
        userId: UNPRIVILEGED_IMPERSONATOR_UID,
        role: 'retailer',
        userCategory: 'retailer',
      });

      // Seed an existing profile photo for Alice in storage
      const existingRef = storage.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
      await existingRef.put(Buffer.from('existing alice photo bytes'), {
        contentType: 'image/jpeg',
      });
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  // Test Case 1: Customer uploads own JPEG photo — ALLOW
  it('1. Customer uploads own JPEG photo — ALLOW', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();
    const ref = storageAlice.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertSucceeds(
      ref.put(Buffer.from('valid jpeg image bytes'), {
        contentType: 'image/jpeg',
      })
    );
  });

  // Test Case 2: Customer uploads own PNG/WebP photo — ALLOW
  it('2. Customer uploads own PNG/WebP photo — ALLOW', async () => {
    const storageBob = testEnv.authenticatedContext(CUSTOMER_BOB_UID).storage();

    // PNG
    const pngRef = storageBob.ref(`user_profiles/${CUSTOMER_BOB_UID}_photo.png`);
    await assertSucceeds(
      pngRef.put(Buffer.from('valid png image bytes'), {
        contentType: 'image/png',
      })
    );

    // WebP
    const webpRef = storageBob.ref(`user_profiles/${CUSTOMER_BOB_UID}_photo.webp`);
    await assertSucceeds(
      webpRef.put(Buffer.from('valid webp image bytes'), {
        contentType: 'image/webp',
      })
    );
  });

  // Test Case 3: Customer overwrites another user's photo — DENY
  it('3. Customer overwrites another user\'s photo — DENY', async () => {
    const storageBob = testEnv.authenticatedContext(CUSTOMER_BOB_UID).storage();
    const alicePhotoRef = storageBob.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertFails(
      alicePhotoRef.put(Buffer.from('malicious overwrite bytes'), {
        contentType: 'image/jpeg',
      })
    );
  });

  // Test Case 4: Unauthenticated upload — DENY
  it('4. Unauthenticated upload — DENY', async () => {
    const storageUnauth = testEnv.unauthenticatedContext().storage();
    const ref = storageUnauth.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertFails(
      ref.put(Buffer.from('anonymous photo bytes'), {
        contentType: 'image/jpeg',
      })
    );
  });

  // Test Case 5: Upload exceeding 5 MB — DENY
  it('5. Upload exceeding 5 MB — DENY', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();
    const ref = storageAlice.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    // 5 MB + 10 bytes
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 10);
    await assertFails(
      ref.put(oversizedBuffer, {
        contentType: 'image/jpeg',
      })
    );
  });

  // Test Case 6: Unsupported file type — DENY
  it('6. Unsupported file type (PDF, EXE, HTML, text) — DENY', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();

    // PDF disguised as profile photo
    const refPdf = storageAlice.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertFails(
      refPdf.put(Buffer.from('%PDF-1.4 file content'), {
        contentType: 'application/pdf',
      })
    );

    // Executable
    const refExe = storageAlice.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.exe`);
    await assertFails(
      refExe.put(Buffer.from('MZ binary executable content'), {
        contentType: 'application/octet-stream',
      })
    );

    // Text / HTML
    const refHtml = storageAlice.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.png`);
    await assertFails(
      refHtml.put(Buffer.from('<html><body>xss</body></html>'), {
        contentType: 'text/html',
      })
    );
  });

  // Test Case 7: Existing profile photo read — ALLOW
  it('7. Existing profile photo read — ALLOW', async () => {
    // Both unauthenticated and authenticated users can view profile photos
    const storageUnauth = testEnv.unauthenticatedContext().storage();
    const ref = storageUnauth.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertSucceeds(ref.getDownloadURL());

    const storageBob = testEnv.authenticatedContext(CUSTOMER_BOB_UID).storage();
    const refBobView = storageBob.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertSucceeds(refBobView.getDownloadURL());
  });

  // Test Case 8: Customer deletes own photo — follow existing app policy (ALLOW for owner)
  it('8. Customer deletes own photo — ALLOW', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();
    const ownPhotoRef = storageAlice.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertSucceeds(ownPhotoRef.delete());
  });

  // Test Case 9: Customer deletes another user's photo — DENY
  it('9. Customer deletes another user\'s photo — DENY', async () => {
    // Re-seed Alice's photo first
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const storage = ctx.storage();
      const existingRef = storage.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
      await existingRef.put(Buffer.from('existing alice photo bytes'), {
        contentType: 'image/jpeg',
      });
    });

    const storageBob = testEnv.authenticatedContext(CUSTOMER_BOB_UID).storage();
    const alicePhotoRef = storageBob.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertFails(alicePhotoRef.delete());
  });

  // Test Case 10: Authorized admin or manager operation — ALLOW only where intended
  it('10. Authorized admin or manager operation — ALLOW', async () => {
    // Admin using token claim
    const storageAdmin = testEnv.authenticatedContext(ADMIN_UID, { admin: true }).storage();
    const adminRef = storageAdmin.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertSucceeds(
      adminRef.put(Buffer.from('admin moderation photo update'), {
        contentType: 'image/jpeg',
      })
    );

    // Manager using Firestore profile
    const storageManager = testEnv.authenticatedContext(MANAGER_UID, { role: 'manager' }).storage();
    const managerRef = storageManager.ref(`user_profiles/${CUSTOMER_BOB_UID}_photo.jpg`);
    await assertSucceeds(
      managerRef.put(Buffer.from('manager moderation photo update'), {
        contentType: 'image/jpeg',
      })
    );
  });

  // Test Case 10b: Administrator CANNOT upload unsupported MIME type (e.g. PDF/EXE) — DENY
  it('10b. Administrator CANNOT upload unsupported MIME type — DENY', async () => {
    const storageAdmin = testEnv.authenticatedContext(ADMIN_UID, { admin: true }).storage();
    const adminRef = storageAdmin.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertFails(
      adminRef.put(Buffer.from('%PDF-1.4 admin malicious pdf'), {
        contentType: 'application/pdf',
      })
    );
  });

  // Test Case 10c: Administrator CANNOT upload file exceeding 5 MB — DENY
  it('10c. Administrator CANNOT upload file exceeding 5 MB — DENY', async () => {
    const storageAdmin = testEnv.authenticatedContext(ADMIN_UID, { admin: true }).storage();
    const adminRef = storageAdmin.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 10);
    await assertFails(
      adminRef.put(oversizedBuffer, {
        contentType: 'image/jpeg',
      })
    );
  });

  // Test Case 11: Unprivileged customer impersonating admin — DENY
  it('11. Unprivileged customer impersonating admin — DENY', async () => {
    // Attacker sends arbitrary claim or attempts to modify another's photo without Firestore admin record
    const storageAttacker = testEnv.authenticatedContext(UNPRIVILEGED_IMPERSONATOR_UID).storage();
    const targetRef = storageAttacker.ref(`user_profiles/${CUSTOMER_ALICE_UID}_photo.jpg`);
    await assertFails(
      targetRef.put(Buffer.from('hacker overwrite'), {
        contentType: 'image/jpeg',
      })
    );
    await assertFails(targetRef.delete());
  });
});
