const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { describe, before, after, beforeEach, it } = require('mocha');

const PROJECT_ID = 'itacon-app';
const FIRESTORE_RULES = resolve(__dirname, '../firestore.rules');
const STORAGE_RULES = resolve(__dirname, '../storage.rules');

const CUSTOMER_ALICE_UID = 'cust_alice_101';
const CUSTOMER_BOB_UID = 'cust_bob_102';
const ASSIGNED_SALESPERSON_UID = 'sp_raj_201';
const UNASSIGNED_SALESPERSON_UID = 'sp_sam_202';
const MANAGER_UID = 'mgr_priya_301';

const ORDER_ALICE_ID = 'ORD_ALICE_1001';
const SUBMISSION_ID = 'sub_ORD_ALICE_1001_1710000000000';

let testEnv;

describe('ITACON Firebase Storage Rules Pre-Deployment Security Audit', () => {
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

    // Seed Firestore base order document with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Alice's order assigned to sp_raj_201
      await db.collection('orders').doc(ORDER_ALICE_ID).set({
        id: ORDER_ALICE_ID,
        userId: CUSTOMER_ALICE_UID,
        customerId: CUSTOMER_ALICE_UID,
        salesPersonId: ASSIGNED_SALESPERSON_UID,
        status: 'confirmed',
        paymentStatus: 'payment_due',
        totalAmount: 50000,
      });

      // Staff profiles in users collection
      await db.collection('users').doc(ASSIGNED_SALESPERSON_UID).set({
        userId: ASSIGNED_SALESPERSON_UID,
        role: 'salesperson',
      });
      await db.collection('users').doc(UNASSIGNED_SALESPERSON_UID).set({
        userId: UNASSIGNED_SALESPERSON_UID,
        role: 'salesperson',
      });
      await db.collection('users').doc(MANAGER_UID).set({
        userId: MANAGER_UID,
        role: 'manager',
      });
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  // 1. Customer uploads 1–5 permitted attachments
  it('ALLOW: Customer Alice can upload 1 to 5 permitted attachments with valid types and sizes', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();
    const validFiles = [
      { name: 'receipt.jpg', contentType: 'image/jpeg' },
      { name: 'receipt_1.png', contentType: 'image/png' },
      { name: 'receipt_2.webp', contentType: 'image/webp' },
      { name: 'receipt_3.pdf', contentType: 'application/pdf' },
      { name: 'receipt_4.jpeg', contentType: 'image/jpeg' },
    ];

    for (const f of validFiles) {
      const ref = storageAlice.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/${f.name}`);
      await assertSucceeds(
        ref.put(Buffer.from('mock receipt data content'), {
          contentType: f.contentType,
        })
      );
    }
  });

  // 2. Customer cannot upload to another customer's order
  it('DENY: Customer Bob cannot upload receipt to Alice\'s order', async () => {
    const storageBob = testEnv.authenticatedContext(CUSTOMER_BOB_UID).storage();
    const ref = storageBob.ref(`payment_proofs/${ORDER_ALICE_ID}/sub_bob_hack/receipt.jpg`);
    await assertFails(
      ref.put(Buffer.from('malicious receipt'), {
        contentType: 'image/jpeg',
      })
    );
  });

  // 3. Unassigned salesperson cannot read receipts
  it('DENY: Unassigned salesperson cannot read Alice\'s payment receipts', async () => {
    const storageUnassigned = testEnv.authenticatedContext(UNASSIGNED_SALESPERSON_UID, {
      role: 'salesperson',
    }).storage();
    const ref = storageUnassigned.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt.jpg`);
    await assertFails(ref.getDownloadURL());
  });

  // 4. Assigned salesperson can read receipts
  it('ALLOW: Assigned salesperson can read Alice\'s payment receipts', async () => {
    const storageAssigned = testEnv.authenticatedContext(ASSIGNED_SALESPERSON_UID, {
      role: 'salesperson',
    }).storage();
    const ref = storageAssigned.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt.jpg`);
    await assertSucceeds(ref.getDownloadURL());
  });

  // 5. Manager / Admin can read receipts
  it('ALLOW: Manager / Admin staff can read payment receipts', async () => {
    const storageManager = testEnv.authenticatedContext(MANAGER_UID, {
      role: 'manager',
    }).storage();
    const ref = storageManager.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt.jpg`);
    await assertSucceeds(ref.getDownloadURL());
  });

  // 6. Unauthorized users cannot overwrite or delete receipts
  it('DENY: Metadata update and delete are strictly forbidden (immutable audit trail)', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();
    const ref = storageAlice.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt.jpg`);

    // Customer cannot modify metadata (allow update: if false)
    await assertFails(
      ref.updateMetadata({
        customMetadata: { tampered: 'true' },
      })
    );

    // Customer Bob cannot modify or overwrite Alice's file
    const storageBob = testEnv.authenticatedContext(CUSTOMER_BOB_UID).storage();
    const refBob = storageBob.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt.jpg`);
    await assertFails(
      refBob.put(Buffer.from('bob overwrite attempt'), {
        contentType: 'image/jpeg',
      })
    );
    await assertFails(
      refBob.updateMetadata({
        customMetadata: { hackedBy: 'bob' },
      })
    );

    // Customer cannot delete uploaded proof (allow delete: if false)
    await assertFails(ref.delete());
    await assertFails(refBob.delete());
  });

  // 7. Invalid filenames, MIME types, and oversized files are rejected
  it('DENY: Invalid filename (e.g. invoice.pdf, receipt_5.jpg, receipt.exe) rejected', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();

    // Out of index boundary (> 4)
    const ref5 = storageAlice.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt_5.jpg`);
    await assertFails(ref5.put(Buffer.from('data'), { contentType: 'image/jpeg' }));

    // Non-standard filename
    const refInvoice = storageAlice.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/invoice.pdf`);
    await assertFails(refInvoice.put(Buffer.from('data'), { contentType: 'application/pdf' }));

    // Dangerous extension
    const refExe = storageAlice.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt.exe`);
    await assertFails(refExe.put(Buffer.from('data'), { contentType: 'application/octet-stream' }));
  });

  it('DENY: Invalid MIME type rejected (e.g. text/html, application/zip)', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();
    const refHtml = storageAlice.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt_1.png`);
    await assertFails(
      refHtml.put(Buffer.from('<html>hacked</html>'), {
        contentType: 'text/html',
      })
    );
  });

  it('DENY: Oversized files (> 10 MB) rejected', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();
    const refOversized = storageAlice.ref(`payment_proofs/${ORDER_ALICE_ID}/${SUBMISSION_ID}/receipt_2.webp`);
    // Create buffer slightly larger than 10 MB (10 * 1024 * 1024 + 10 bytes)
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 10);
    await assertFails(
      refOversized.put(oversizedBuffer, {
        contentType: 'image/webp',
      })
    );
  });

  // 8. Existing legacy single-receipt access remains functional
  it('ALLOW: Existing legacy single-receipt path (receipt.jpg / receipt.pdf) fully functional', async () => {
    const storageAlice = testEnv.authenticatedContext(CUSTOMER_ALICE_UID).storage();
    const legacySubId = 'sub_legacy_1700000000000';
    const legacyRef = storageAlice.ref(`payment_proofs/${ORDER_ALICE_ID}/${legacySubId}/receipt.jpg`);
    await assertSucceeds(
      legacyRef.put(Buffer.from('legacy receipt content'), {
        contentType: 'image/jpeg',
      })
    );
    await assertSucceeds(legacyRef.getDownloadURL());
  });
});
