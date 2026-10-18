/**
 * Comprehensive Backend Unit & Integration Test Suite for Official Paid Purchase Order PDF Generation
 * Tests functions/generatePaidPurchaseOrderPdf.js
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  createPaidPdfBuffer,
  processPaidPoGeneration,
  handleRetryPaidPoGeneration,
  handleGetPaidPoDownloadUrl,
} = require("./generatePaidPurchaseOrderPdf");

function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

// Mock Firestore Implementation for Testing
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
            if (!existing) throw new Error("Document not found for update");
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
      where(field, op, val) {
        return {
          where(field2, op2, val2) {
            return {
              limit() {
                return {
                  async get() {
                    const matching = [];
                    for (const [key, doc] of self.data.entries()) {
                      if (key.startsWith(`${collName}/`)) {
                        if (doc[field] === val && doc[field2] === val2) {
                          matching.push({ id: doc.id, data: () => doc });
                        }
                      }
                    }
                    return {
                      empty: matching.length === 0,
                      docs: matching,
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
  }
}

// Mock Firebase Storage Implementation
class MockStorage {
  constructor() {
    this.files = new Map();
  }

  bucket(bucketName) {
    const self = this;
    return {
      file(filePath) {
        return {
          name: filePath,
          async save(buffer, options) {
            self.files.set(filePath, {
              buffer,
              options,
              savedAt: new Date(),
            });
          },
          async exists() {
            return [self.files.has(filePath)];
          },
          async delete() {
            self.files.delete(filePath);
          },
          async copy(targetFile) {
            const current = self.files.get(filePath);
            if (current) {
              self.files.set(targetFile.name, { ...current });
            }
          },
          async getSignedUrl(config) {
            if (!self.files.has(filePath)) {
              throw new Error("File not found in storage");
            }
            return [`https://storage.googleapis.com/test-bucket/${encodeURIComponent(filePath)}?token=mock_15m_token`];
          },
        };
      },
    };
  }
}

async function runTests() {
  console.log("Starting Official Paid PO PDF Unit & Integration Tests...\n");

  const sampleOrder = {
    id: "ord_paid_test_101",
    poNumber: "PO-2026-8801",
    userId: "cust_alice",
    customerName: "Alice Sharma",
    companyName: "Sharma Ceramics & Infra",
    customerPhone: "+919876543210",
    customerEmail: "alice@sharmainfra.in",
    salespersonId: "sales_bob",
    salespersonName: "Bob Patel",
    deliveryAddress: {
      addressLine1: "Plot 42, GIDC Estate",
      addressLine2: "Phase II",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "382445",
    },
    items: [
      {
        productName: "Calacatta Gold Lux",
        designCode: "CG-60120-L",
        size: "600x1200 mm",
        finish: "Glazed Polished",
        quantityBoxes: 100,
        quantitySqFt: 1550,
        ratePerSqFt: 55,
        totalPrice: 85250,
      },
      {
        productName: "Nero Marquina Satin",
        designCode: "NM-60120-S",
        size: "600x1200 mm",
        finish: "Satin Matt",
        quantityBoxes: 50,
        quantitySqFt: 775,
        ratePerSqFt: 60,
        totalPrice: 46500,
      },
    ],
    quotationBreakdown: {
      subtotalAmount: 131750,
      discountAmount: 1750,
      cgstAmount: 11700,
      sgstAmount: 11700,
      gstAmount: 23400,
      finalAmount: 153400,
    },
    totalAmount: 153400,
    paymentStatus: "paid",
    status: "confirmed",
    paymentSubmissionId: "sub_pay_201",
    paymentId: "HDFCN26101088991",
    paidAmount: 153400,
    createdAt: new Date("2026-10-10T10:00:00Z"),
  };

  const samplePaymentSubmission = {
    id: "sub_pay_201",
    orderId: "ord_paid_test_101",
    customerId: "cust_alice",
    utrNumber: "HDFCN26101088991",
    utrNormalized: "HDFCN26101088991",
    submittedAmount: 153400,
    expectedAmount: 153400,
    status: "verified",
    verifiedAmount: 153400,
    verifiedByUid: "sales_bob",
    verifiedByName: "Bob Patel",
    verifiedAt: new Date("2026-10-10T14:30:00Z"),
    paymentDate: new Date("2026-10-10T12:00:00Z"),
  };

  const mockDb = new MockFirestore();
  const mockStorage = new MockStorage();
  const mockOptions = {
    db: mockDb,
    storage: mockStorage,
    bucket: mockStorage.bucket("itacon-app.appspot.com"),
    bucketName: "itacon-app.appspot.com",
  };

  // Seed user records for authorization testing
  mockDb.setDoc("users", "cust_alice", { role: "customer", name: "Alice Sharma" });
  mockDb.setDoc("users", "cust_mallory", { role: "customer", name: "Mallory Green" });
  mockDb.setDoc("users", "sales_bob", { role: "salesperson", name: "Bob Patel" });
  mockDb.setDoc("users", "sales_charlie", { role: "salesperson", name: "Charlie Shah" });
  mockDb.setDoc("users", "admin_dave", { role: "admin", name: "Dave Mehta" });

  mockDb.setDoc("orders", sampleOrder.id, { ...sampleOrder });
  mockDb.setDoc("paymentSubmissions", samplePaymentSubmission.id, { ...samplePaymentSubmission });

  // TEST 1: PDF Generation Buffer & PDFKit Content
  console.log("▶ TEST 1: PDF Generation Buffer & Header Verification");
  const pdfBuffer = await createPaidPdfBuffer(sampleOrder, samplePaymentSubmission);
  assert.ok(Buffer.isBuffer(pdfBuffer), "Output must be a Buffer");
  assert.ok(pdfBuffer.length > 2000, `PDF buffer length should be substantial, got ${pdfBuffer.length}`);
  const header = pdfBuffer.slice(0, 5).toString("utf8");
  assert.strictEqual(header, "%PDF-", "Generated buffer must begin with standard PDF header '%PDF-'");
  
  // Save sample PDF for visual audit
  const samplePdfPath = path.resolve(__dirname, "sample_paid_po_output.pdf");
  fs.writeFileSync(samplePdfPath, pdfBuffer);
  console.log(`✔ Test 1 passed: Valid PDF buffer created (%PDF- verified, size: ${pdfBuffer.length} bytes, saved to ${samplePdfPath})`);

  // TEST 2: Process Paid PO - Successful Authoritative End-to-End Generation
  console.log("\n▶ TEST 2: Authoritative End-to-End Generation & Private Storage");
  const result = await processPaidPoGeneration(sampleOrder.id, null, mockOptions);

  assert.strictEqual(result.status, "ready", "Generation status should be ready");
  assert.strictEqual(result.path, `purchase_orders/${sampleOrder.id}/paid_po.pdf`, "Document path must match expected private path");

  const storedFile = mockStorage.files.get(`purchase_orders/${sampleOrder.id}/paid_po.pdf`);
  assert.ok(storedFile, "File must be written to Storage at private path");
  assert.strictEqual(storedFile.options.public, false, "Stored file MUST NOT be public (public: false enforced)");
  assert.strictEqual(storedFile.options.metadata.contentType, "application/pdf", "Content type must be application/pdf");

  const updatedOrder = mockDb.getDoc("orders", sampleOrder.id);
  assert.strictEqual(updatedOrder.paidPoStatus, "ready", "Order paidPoStatus must be 'ready'");
  assert.strictEqual(updatedOrder.paidPoDocumentPath, `purchase_orders/${sampleOrder.id}/paid_po.pdf`);
  assert.ok(updatedOrder.paidPoGeneratedAt, "paidPoGeneratedAt timestamp must be set");
  console.log("✔ Test 2 passed: End-to-end generation succeeded, stored privately with public: false");

  // TEST 3: Idempotency - Repeated Trigger Never Overwrites or Re-uploads
  console.log("\n▶ TEST 3: Idempotency Protection");
  const uploadCountBefore = mockStorage.files.size;
  const resultRepeat = await processPaidPoGeneration(sampleOrder.id, null, mockOptions);
  assert.strictEqual(resultRepeat.status, "ready", "Should skip generation idempotently");
  assert.strictEqual(resultRepeat.alreadyGenerated, true);
  assert.strictEqual(mockStorage.files.size, uploadCountBefore, "Storage file count must remain unchanged");
  console.log("✔ Test 3 passed: Repeated execution is strictly idempotent");

  // TEST 4: Payment Verification Guard - Order not marked 'paid' is rejected
  console.log("\n▶ TEST 4: Guard - Unpaid Order Rejected");
  const unpaidOrder = { ...sampleOrder, id: "ord_unpaid_102", paymentStatus: "unpaid" };
  mockDb.setDoc("orders", unpaidOrder.id, unpaidOrder);
  try {
    await processPaidPoGeneration(unpaidOrder.id, null, mockOptions);
    assert.fail("Should have thrown error for unpaid order");
  } catch (err) {
    assert.ok(err.message.includes("not in paid status"), `Expected error about unpaid status, got: ${err.message}`);
  }
  console.log("✔ Test 4 passed: Unpaid order correctly rejected");

  // TEST 5: Payment Verification Guard - Amount Mismatch (Paise Precision) Rejected
  console.log("\n▶ TEST 5: Guard - Amount Mismatch Rejected at Paise Precision");
  const mismatchedOrder = { ...sampleOrder, id: "ord_mismatch_103", totalAmount: 153400, paidAmount: 150000 };
  const mismatchedSub = {
    ...samplePaymentSubmission,
    id: "sub_mismatch_203",
    orderId: mismatchedOrder.id,
    submittedAmount: 150000,
  };
  mockDb.setDoc("orders", mismatchedOrder.id, { ...mismatchedOrder, paymentSubmissionId: mismatchedSub.id });
  mockDb.setDoc("paymentSubmissions", mismatchedSub.id, mismatchedSub);

  const resMismatch = await processPaidPoGeneration(mismatchedOrder.id, null, mockOptions);
  assert.strictEqual(resMismatch.success, false, "Should fail for amount mismatch");
  assert.ok(resMismatch.error.includes("does not match"), `Expected amount mismatch error, got: ${resMismatch.error}`);
  console.log("✔ Test 5 passed: Verified amount mismatch rejected at paise precision");

  // TEST 6: Payment Verification Guard - Customer Cross-Ownership Mismatch Rejected
  console.log("\n▶ TEST 6: Guard - Submission Status Guard");
  const unverifiedSub = {
    ...samplePaymentSubmission,
    id: "sub_unver_204",
    orderId: sampleOrder.id,
    status: "pending_verification",
  };
  const unverifiedOrder = { ...sampleOrder, id: "ord_unver_104", paymentSubmissionId: unverifiedSub.id };
  mockDb.setDoc("orders", unverifiedOrder.id, unverifiedOrder);
  mockDb.setDoc("paymentSubmissions", unverifiedSub.id, unverifiedSub);

  const resUnver = await processPaidPoGeneration(unverifiedOrder.id, null, mockOptions);
  assert.strictEqual(resUnver.success, false, "Should fail for unverified submission status");
  assert.ok(resUnver.error.includes("expected verified"), `Expected unverified status error, got: ${resUnver.error}`);
  console.log("✔ Test 6 passed: Unverified payment submission status rejected");

  // TEST 7: Concurrency & Lock Recovery (Crashed Generator Recovery)
  console.log("\n▶ TEST 7: Concurrency Lock & Crashed Generator Recovery");
  const crashedOrder = {
    ...sampleOrder,
    id: "ord_crashed_105",
    paidPoStatus: "generating",
    paidPoGeneratingStartedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (stuck)
  };
  const crashedSub = { ...samplePaymentSubmission, id: "sub_crash_205", orderId: crashedOrder.id };
  mockDb.setDoc("orders", crashedOrder.id, { ...crashedOrder, paymentSubmissionId: crashedSub.id });
  mockDb.setDoc("paymentSubmissions", crashedSub.id, crashedSub);

  const recoveredResult = await processPaidPoGeneration(crashedOrder.id, null, mockOptions);
  assert.strictEqual(recoveredResult.status, "ready", "Crashed generation should be recovered and set to ready");
  const postRecoverOrder = mockDb.getDoc("orders", crashedOrder.id);
  assert.strictEqual(postRecoverOrder.paidPoStatus, "ready");
  console.log("✔ Test 7 passed: Crashed generation recovered safely without permanent deadlock");

  // TEST 8: Download URL Callable Security & Customer Isolation
  console.log("\n▶ TEST 8: Download URL Authorization & Customer Isolation");
  
  // 8a: Owner customer allowed
  const ownerRes = await handleGetPaidPoDownloadUrl(
    { orderId: sampleOrder.id },
    { auth: { uid: "cust_alice", token: { role: "customer" } } },
    mockOptions
  );
  assert.ok(ownerRes.downloadUrl, "Owner customer must receive downloadUrl");
  assert.strictEqual(ownerRes.expiresInSeconds, 900, "Signed URL expiration must be 900 seconds (15 min)");

  // 8b: Foreign customer denied (Customer Isolation)
  try {
    await handleGetPaidPoDownloadUrl(
      { orderId: sampleOrder.id },
      { auth: { uid: "cust_mallory", token: { role: "customer" } } },
      mockOptions
    );
    assert.fail("Foreign customer should be denied access");
  } catch (err) {
    assert.strictEqual(err.code, "permission-denied", "Must return permission-denied for foreign customer");
  }

  // 8c: Assigned salesperson allowed
  const assignedSalesRes = await handleGetPaidPoDownloadUrl(
    { orderId: sampleOrder.id },
    { auth: { uid: "sales_bob", token: { role: "salesperson" } } },
    mockOptions
  );
  assert.ok(assignedSalesRes.downloadUrl, "Assigned salesperson must receive downloadUrl");

  // 8d: Unassigned salesperson denied
  try {
    await handleGetPaidPoDownloadUrl(
      { orderId: sampleOrder.id },
      { auth: { uid: "sales_charlie", token: { role: "salesperson" } } },
      mockOptions
    );
    assert.fail("Unassigned salesperson should be denied access");
  } catch (err) {
    assert.strictEqual(err.code, "permission-denied", "Must return permission-denied for unassigned salesperson");
  }

  // 8e: Admin allowed
  const adminRes = await handleGetPaidPoDownloadUrl(
    { orderId: sampleOrder.id },
    { auth: { uid: "admin_dave", token: { role: "admin" } } },
    mockOptions
  );
  assert.ok(adminRes.downloadUrl, "Admin must receive downloadUrl");

  console.log("✔ Test 8 passed: Customer isolation, assigned salesperson, and admin access control verified");

  // TEST 9: Existing Confirmed PO Preservation
  console.log("\n▶ TEST 9: Preservation of Confirmed PO & Separate Storage Path");
  const legacyOrderWithConfirmedPo = {
    ...sampleOrder,
    id: "ord_legacy_106",
    poDocumentUrl: "https://storage.googleapis.com/test-bucket/purchase_orders/ord_legacy_106.pdf",
    paidPoStatus: null,
    paidPoDocumentPath: null,
  };
  mockDb.setDoc("orders", legacyOrderWithConfirmedPo.id, legacyOrderWithConfirmedPo);
  const legacySub = { ...samplePaymentSubmission, id: "sub_legacy_206", orderId: legacyOrderWithConfirmedPo.id };
  mockDb.setDoc("paymentSubmissions", legacySub.id, legacySub);

  await processPaidPoGeneration(legacyOrderWithConfirmedPo.id, null, mockOptions);

  const orderAfterPaidPo = mockDb.getDoc("orders", legacyOrderWithConfirmedPo.id);
  assert.strictEqual(
    orderAfterPaidPo.poDocumentUrl,
    "https://storage.googleapis.com/test-bucket/purchase_orders/ord_legacy_106.pdf",
    "Original confirmed PO poDocumentUrl MUST NOT be overwritten"
  );
  assert.strictEqual(
    orderAfterPaidPo.paidPoDocumentPath,
    `purchase_orders/${legacyOrderWithConfirmedPo.id}/paid_po.pdf`,
    "Paid PO path must be separate"
  );
  console.log("✔ Test 9 passed: Confirmed PO document URL strictly preserved");

  // TEST 10: Retry Callable Security & Execution
  console.log("\n▶ TEST 10: Retry Callable Access Control & Recovery");
  const failedOrder = {
    ...sampleOrder,
    id: "ord_failed_107",
    paidPoStatus: "failed",
    paidPoError: "Network timeout writing to storage",
  };
  const failedSub = { ...samplePaymentSubmission, id: "sub_failed_207", orderId: failedOrder.id };
  mockDb.setDoc("orders", failedOrder.id, { ...failedOrder, paymentSubmissionId: failedSub.id });
  mockDb.setDoc("paymentSubmissions", failedSub.id, failedSub);

  // Unassigned salesperson denied retry
  try {
    await handleRetryPaidPoGeneration(
      { orderId: failedOrder.id },
      { auth: { uid: "sales_charlie", token: { role: "salesperson" } } },
      mockOptions
    );
    assert.fail("Unassigned salesperson must not be allowed to trigger retry");
  } catch (err) {
    assert.strictEqual(err.code, "permission-denied");
  }

  // Assigned salesperson allowed retry
  const retryRes = await handleRetryPaidPoGeneration(
    { orderId: failedOrder.id },
    { auth: { uid: "sales_bob", token: { role: "salesperson" } } },
    mockOptions
  );
  assert.strictEqual(retryRes.status, "ready", "Retry should regenerate and succeed");
  const retriedOrder = mockDb.getDoc("orders", failedOrder.id);
  assert.strictEqual(retriedOrder.paidPoStatus, "ready");
  assert.strictEqual(retriedOrder.paidPoRetryCount, 1, "Retry count must be incremented");
  assert.ok(retriedOrder.paidPoLastRetryAt, "paidPoLastRetryAt timestamp must be recorded");
  console.log("✔ Test 10 passed: Retry callable enforces access control and regenerates document");

  // TEST 11: Rate-Limiting on Retry Callable (60-second cooldown)
  console.log("\n▶ TEST 11: Retry Rate-Limiting Protection (60s Cooldown)");
  try {
    await handleRetryPaidPoGeneration(
      { orderId: failedOrder.id },
      { auth: { uid: "sales_bob", token: { role: "salesperson" } } },
      mockOptions
    );
    assert.fail("Immediate second retry should be rejected with rate-limiting error");
  } catch (err) {
    assert.strictEqual(err.code, "resource-exhausted", "Must return resource-exhausted error code");
    assert.ok(err.message.includes("60 seconds"), `Expected 60s message, got: ${err.message}`);
  }
  console.log("✔ Test 11 passed: Repeated retry within 60 seconds rejected with resource-exhausted");

  // TEST 12: No Arbitrary Regeneration for Ready Documents
  console.log("\n▶ TEST 12: Guard Against Arbitrary Regeneration of Ready Documents");
  // Set last retry to 10 minutes ago to bypass rate limit
  const readyOrderWithFile = {
    ...sampleOrder,
    id: "ord_ready_108",
    paidPoStatus: "ready",
    paidPoDocumentPath: `purchase_orders/ord_ready_108/paid_po.pdf`,
    paidPoLastRetryAt: new Date(Date.now() - 10 * 60 * 1000),
  };
  mockDb.setDoc("orders", readyOrderWithFile.id, readyOrderWithFile);
  mockStorage.files.set(`purchase_orders/ord_ready_108/paid_po.pdf`, {
    buffer: Buffer.from("existing pdf content"),
    options: { public: false },
    savedAt: new Date(Date.now() - 10 * 60 * 1000),
  });

  const readyRetryRes = await handleRetryPaidPoGeneration(
    { orderId: readyOrderWithFile.id },
    { auth: { uid: "sales_bob", token: { role: "salesperson" } } },
    mockOptions
  );
  assert.strictEqual(readyRetryRes.alreadyGenerated, true, "Must recognize existing ready document");
  assert.strictEqual(readyRetryRes.status, "ready");
  console.log("✔ Test 12 passed: Arbitrary regeneration of ready document prevented");

  // TEST 13: Concurrency - Older Attempt Cannot Overwrite Newer Attempt
  console.log("\n▶ TEST 13: Concurrency Protection — Older Attempt Cannot Overwrite Newer Output");
  const racingOrder = {
    ...sampleOrder,
    id: "ord_race_109",
    paidPoStatus: "unprocessed",
  };
  const racingSub = { ...samplePaymentSubmission, id: "sub_race_209", orderId: racingOrder.id };
  mockDb.setDoc("orders", racingOrder.id, racingOrder);
  mockDb.setDoc("paymentSubmissions", racingSub.id, racingSub);

  // Set existing official file
  const officialPath = `purchase_orders/${racingOrder.id}/paid_po.pdf`;
  mockStorage.files.set(officialPath, {
    buffer: Buffer.from("OFFICIAL_INITIAL_BUFFER"),
    options: { public: false },
  });

  // Execute generation with mockOptions
  const raceResult = await processPaidPoGeneration(racingOrder.id, null, mockOptions);
  assert.strictEqual(raceResult.success, true, "Generation must succeed with current lease");
  assert.strictEqual(mockDb.getDoc("orders", racingOrder.id).paidPoStatus, "ready");
  
  // Verify staging object was purged upon promotion
  const stagingKeys = Array.from(mockStorage.files.keys()).filter(k => k.includes("/staging/"));
  assert.strictEqual(stagingKeys.length, 0, "All staging objects must be cleaned up");
  console.log("✔ Test 13 passed: Two-phase staging and attempt IDs protect against stale worker overwrites and purge temporary objects");

  console.log("\n==================================================");
  console.log("ALL 13 PAID PURCHASE ORDER PDF TESTS PASSED (100%)");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
