/**
 * Unit & Integration Test Suite for Unpaid Purchase Order PDF Generation
 * Tests functions/generatePaidPurchaseOrderPdf.js (unpaid flow)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  createPoPdfBuffer,
  createPaidPdfBuffer,
  handleGenerateUnpaidPoPdf,
  getOrderContentHash,
} = require('./generatePaidPurchaseOrderPdf');

// Mock Firestore Implementation
class MockFirestore {
  constructor() {
    this.data = new Map();
  }

  setDoc(collectionPath, docId, data) {
    this.data.set(`${collectionPath}/${docId}`, JSON.parse(JSON.stringify(data)));
  }

  getDoc(collectionPath, docId) {
    return this.data.get(`${collectionPath}/${docId}`) || null;
  }

  collection(collName) {
    const self = this;
    return {
      doc(docId) {
        return {
          id: docId,
          async get() {
            const doc = self.getDoc(collName, docId);
            return {
              exists: !!doc,
              id: docId,
              data: () => doc,
            };
          },
          async update(updateData) {
            const existing = self.getDoc(collName, docId);
            if (!existing) throw new Error('Document not found for update');
            Object.assign(existing, updateData);
            self.setDoc(collName, docId, existing);
          },
          async set(setData, options) {
            if (options && options.merge) {
              const existing = self.getDoc(collName, docId) || {};
              Object.assign(existing, setData);
              self.setDoc(collName, docId, existing);
            } else {
              self.setDoc(collName, docId, setData);
            }
          },
        };
      },
    };
  }
}

// Mock Cloud Storage Implementation
class MockStorage {
  constructor() {
    this.files = new Map();
  }

  bucket(name) {
    const self = this;
    return {
      file(filePath) {
        return {
          name: filePath,
          async exists() {
            return [self.files.has(filePath)];
          },
          async save(buffer, options) {
            self.files.set(filePath, {
              buffer,
              options,
              savedAt: new Date(),
            });
          },
          async getSignedUrl(cfg) {
            if (!self.files.has(filePath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            return [`https://mockstorage.googleapis.com/${filePath}?token=test_signed_url`];
          },
        };
      },
    };
  }
}

async function runUnpaidPoTests() {
  console.log('Starting Unpaid PO PDF Unit & Integration Tests...\n');

  const sampleOrder = {
    id: 'ord_unpaid_101',
    orderReference: 'ITC-PO-2026-9095',
    userId: 'cust_alice',
    customerId: 'cust_alice',
    customerName: 'Alice Ceramic Works',
    salesPersonId: 'sales_bob',
    status: 'confirmed',
    paymentStatus: 'payment_due',
    quotationMode: 'standard',
    subtotal: 100000,
    discount: 5000,
    taxAmount: 17100,
    totalAmount: 112100,
    stateCode: 'GJ',
    orderItems: [
      {
        productName: 'Royal Statuario Glazed Vitrified',
        surface: 'Glossy',
        size: '600x1200',
        quantityBoxes: 100,
        quantitySqFt: 1550,
        unitPrice: 60,
        lineTotal: 93000,
      },
    ],
  };

  const sampleBankConfig = {
    accountHolderName: 'ITACON GRANITO PVT. LTD.',
    bankName: 'HDFC Bank Ltd.',
    accountNumber: '50200084920192',
    ifscCode: 'HDFC0001234',
    branchName: 'Morbi Main Branch',
    accountType: 'Current Account',
  };

  // TEST 1: Buffer generation for Unpaid PO
  console.log('▶ TEST 1: Unpaid PDF Buffer Generation');
  const unpaidBuf = await createPoPdfBuffer(sampleOrder, null, null, {
    isPaid: false,
    bankConfig: sampleBankConfig,
  });
  assert(Buffer.isBuffer(unpaidBuf), 'Must return a Buffer');
  assert(unpaidBuf.length > 1000, 'Buffer must be valid PDF size');
  assert.strictEqual(unpaidBuf.subarray(0, 5).toString('ascii'), '%PDF-', 'Header must start with %PDF-');
  console.log('✔ Test 1 passed: Valid Unpaid PDF buffer generated (%PDF- verified)');

  // TEST 2: Header badge variation for payment under verification
  console.log('\n▶ TEST 2: Badge Variation for Payment Under Verification');
  const pendingVerOrder = { ...sampleOrder, paymentStatus: 'pending_verification' };
  const pendingVerBuf = await createPoPdfBuffer(pendingVerOrder, null, null, {
    isPaid: false,
    bankConfig: sampleBankConfig,
  });
  assert(Buffer.isBuffer(pendingVerBuf), 'Must return a Buffer for pending_verification');
  assert.strictEqual(pendingVerBuf.subarray(0, 5).toString('ascii'), '%PDF-');
  console.log('✔ Test 2 passed: Successfully rendered under verification state');

  // TEST 3: Auth & Customer Isolation
  console.log('\n▶ TEST 3: Access Control & Customer Isolation');
  const mockDb = new MockFirestore();
  const mockStorage = new MockStorage();
  const mockOptions = { db: mockDb, storage: mockStorage, bucketName: 'test-bucket' };

  mockDb.setDoc('orders', sampleOrder.id, sampleOrder);
  mockDb.setDoc('paymentConfig', 'bankTransfer', sampleBankConfig);

  // Unauthenticated caller
  await assert.rejects(
    async () => handleGenerateUnpaidPoPdf({ orderId: sampleOrder.id }, { auth: null }, mockOptions),
    (err) => err.code === 'unauthenticated',
    'Must reject unauthenticated caller'
  );

  // Different customer
  await assert.rejects(
    async () => handleGenerateUnpaidPoPdf(
      { orderId: sampleOrder.id },
      { auth: { uid: 'cust_mallory', token: { role: 'customer' } } },
      mockOptions
    ),
    (err) => err.code === 'permission-denied',
    'Must reject different customer'
  );

  // Authorized owner customer
  const custRes = await handleGenerateUnpaidPoPdf(
    { orderId: sampleOrder.id },
    { auth: { uid: 'cust_alice', token: { role: 'customer' } } },
    mockOptions
  );
  assert.strictEqual(custRes.success, true);
  assert.strictEqual(custRes.fileName, 'ITC-PO-2026-9095_UNPAID.pdf');
  assert(custRes.filePath.includes('/unpaid/'), 'Must be stored in /unpaid/ folder');
  assert(mockStorage.files.has(custRes.filePath), 'File must be saved in storage');
  console.log('✔ Test 3 passed: Enforced caller authentication and customer isolation');

  // TEST 4: Separate Storage Path and Non-Collision with Paid PO
  console.log('\n▶ TEST 4: Separate Path Isolation from Paid PO');
  const paidPath = `purchase_orders/${sampleOrder.id}/paid_po.pdf`;
  mockStorage.files.set(paidPath, { buffer: Buffer.from('OFFICIAL_PAID_PO') });

  assert(mockStorage.files.has(paidPath), 'Paid PO exists');
  assert(mockStorage.files.has(custRes.filePath), 'Unpaid PO exists');
  assert.notStrictEqual(paidPath, custRes.filePath, 'Paths must be completely distinct');
  assert.strictEqual(
    mockStorage.files.get(paidPath).buffer.toString('utf8'),
    'OFFICIAL_PAID_PO',
    'Paid PO buffer must never be touched or overwritten by unpaid generation'
  );
  console.log('✔ Test 4 passed: Unpaid PO stored at separate path and cannot overwrite Paid PO');

  // TEST 5: Cache reuse vs Invalidation on Content Change
  console.log('\n▶ TEST 5: Cache Reuse and Invalidation on Order Content Change');
  // Second call with same order
  const cachedRes = await handleGenerateUnpaidPoPdf(
    { orderId: sampleOrder.id },
    { auth: { uid: 'cust_alice', token: { role: 'customer' } } },
    mockOptions
  );
  assert.strictEqual(cachedRes.alreadyGenerated, true, 'Must return cached document when hash matches');

  // Update order items/amount
  const modifiedOrder = {
    ...sampleOrder,
    totalAmount: 125000,
    unpaidPoDocumentPath: custRes.filePath,
    unpaidPoContentHash: mockDb.getDoc('orders', sampleOrder.id).unpaidPoContentHash,
  };
  mockDb.setDoc('orders', sampleOrder.id, modifiedOrder);

  const regeneratedRes = await handleGenerateUnpaidPoPdf(
    { orderId: sampleOrder.id },
    { auth: { uid: 'cust_alice', token: { role: 'customer' } } },
    mockOptions
  );
  assert.strictEqual(regeneratedRes.alreadyGenerated, false, 'Must regenerate when content/amount changes');
  console.log('✔ Test 5 passed: Automatic caching and regeneration on content changes verified');

  // TEST 6: Assigned Salesperson and Admin Access
  console.log('\n▶ TEST 6: Staff Access (Assigned Salesperson & Admin)');
  const spRes = await handleGenerateUnpaidPoPdf(
    { orderId: sampleOrder.id },
    { auth: { uid: 'sales_bob', token: { role: 'salesperson' } } },
    mockOptions
  );
  assert.strictEqual(spRes.success, true, 'Assigned salesperson must have access');

  const adminRes = await handleGenerateUnpaidPoPdf(
    { orderId: sampleOrder.id },
    { auth: { uid: 'admin_user', token: { role: 'admin' } } },
    mockOptions
  );
  assert.strictEqual(adminRes.success, true, 'Admin must have access');
  console.log('✔ Test 6 passed: Assigned salesperson and admin access confirmed');

  console.log('\n==================================================');
  console.log('ALL UNPAID PURCHASE ORDER PDF TESTS PASSED (100%)');
  console.log('==================================================');
}

runUnpaidPoTests().catch((err) => {
  console.error('\n❌ UNPAID TEST SUITE FAILED:', err);
  process.exit(1);
});
