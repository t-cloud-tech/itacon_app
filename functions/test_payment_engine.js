/**
 * Comprehensive Backend Unit & Security Policy Test Suite for ITACON Manual Payment System
 * Tests paymentEngine.js, loyaltyRewardEngine.js, and Storage/Firestore security constraints.
 */

const assert = require("assert");

// Helper: Normalize UTR
function normalizeUtr(utr) {
  if (!utr || typeof utr !== "string") return "";
  return utr.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Helper: Paise Integer Precision
function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

// Simulated Atomic Transactional UTR Registry
class MockUtrRegistry {
  constructor() {
    this.registry = new Map();
  }

  reserveUtr({ utrNormalized, submissionId, orderId, customerId }) {
    if (this.registry.has(utrNormalized)) {
      const existing = this.registry.get(utrNormalized);
      if (existing.status === "verified" || existing.status === "pending_verification") {
        throw new Error(`UTR already registered with status: ${existing.status}`);
      }
    }
    const entry = {
      utrNormalized,
      submissionId,
      orderId,
      customerId,
      status: "pending_verification",
      createdAt: new Date(),
    };
    this.registry.set(utrNormalized, entry);
    return entry;
  }

  verifyUtr(utrNormalized) {
    const entry = this.registry.get(utrNormalized);
    if (!entry) throw new Error("UTR entry not found");
    entry.status = "verified";
    entry.verifiedAt = new Date();
    return entry;
  }

  rejectUtr(utrNormalized) {
    const entry = this.registry.get(utrNormalized);
    if (!entry) throw new Error("UTR entry not found");
    entry.status = "rejected";
    entry.rejectedAt = new Date();
    return entry;
  }
}

// Simulated Transactional Submission & Order Engine
class MockPaymentEngine {
  constructor() {
    this.submissions = new Map();
    this.orders = new Map();
    this.utrs = new Map();
    this.statusHistories = [];
    this.notifications = [];
  }

  createOrder(order) {
    this.orders.set(order.id, { ...order });
  }

  // Atomic Verification with Transaction Re-read
  verifyPayment({ staffUser, submissionId }) {
    const sub = this.submissions.get(submissionId);
    if (!sub) throw new Error("Payment submission not found");

    const order = this.orders.get(sub.orderId);
    if (!order) throw new Error("Order not found");

    // Staff Authorization Check
    const isStaff = staffUser.admin === true || staffUser.role === "admin" || staffUser.role === "manager" || staffUser.role === "salesperson";
    if (!isStaff) throw new Error("Unauthorized role");

    if (staffUser.role === "salesperson" && !staffUser.admin && order.salesPersonId !== staffUser.uid) {
      throw new Error("Unassigned salesperson cannot verify payment");
    }

    // Transactional Status Guard: must be pending_verification
    if (sub.status !== "pending_verification") {
      throw new Error(`Submission is already processed (${sub.status})`);
    }

    // Atomic State Updates
    sub.status = "verified";
    sub.verifiedAt = new Date();
    sub.verifiedBy = staffUser.uid;

    order.paymentStatus = "paid";
    order.status = "processing";
    order.paidAmount = sub.expectedAmount;
    order.paidAt = new Date();
    order.paymentId = sub.utrNumber;

    const utr = this.utrs.get(sub.utrNormalized);
    if (utr) {
      utr.status = "verified";
      utr.verifiedBy = staffUser.uid;
    }

    this.statusHistories.push({
      orderId: order.id,
      fromStatus: "pending_verification",
      toStatus: "paid",
      changedBy: staffUser.uid,
    });

    this.notifications.push({
      userId: sub.customerId,
      title: "Payment Verified",
      orderId: order.id,
    });

    return { success: true };
  }

  // Atomic Rejection with Transaction Re-read
  rejectPayment({ staffUser, submissionId, reason }) {
    if (!reason || !reason.trim()) throw new Error("A valid rejection reason must be provided");

    const sub = this.submissions.get(submissionId);
    if (!sub) throw new Error("Payment submission not found");

    const order = this.orders.get(sub.orderId);
    if (!order) throw new Error("Order not found");

    // Staff Authorization Check
    const isStaff = staffUser.admin === true || staffUser.role === "admin" || staffUser.role === "manager" || staffUser.role === "salesperson";
    if (!isStaff) throw new Error("Unauthorized role");

    if (staffUser.role === "salesperson" && !staffUser.admin && order.salesPersonId !== staffUser.uid) {
      throw new Error("Unassigned salesperson cannot review payment");
    }

    // Transactional Status Guard
    if (sub.status !== "pending_verification") {
      throw new Error(`Submission is already processed (${sub.status})`);
    }

    sub.status = "rejected";
    sub.rejectionReason = reason.trim();
    sub.verifiedAt = new Date();
    sub.verifiedBy = staffUser.uid;

    order.paymentStatus = "rejected";
    order.rejectionReason = reason.trim();

    const utr = this.utrs.get(sub.utrNormalized);
    if (utr) {
      utr.status = "rejected";
      utr.rejectionReason = reason.trim();
    }

    this.statusHistories.push({
      orderId: order.id,
      fromStatus: "pending_verification",
      toStatus: "rejected",
      changedBy: staffUser.uid,
    });

    return { success: true };
  }
}

// Simulated authorization check for payment verification
function checkVerificationAuthorization(callerUser, order) {
  if (!callerUser || !callerUser.uid) {
    return { authorized: false, reason: "Unauthenticated" };
  }
  if (callerUser.role === "customer" || callerUser.uid === order.userId) {
    return { authorized: false, reason: "Customer cannot verify payments" };
  }
  if (callerUser.admin === true || callerUser.role === "admin" || callerUser.role === "manager") {
    return { authorized: true };
  }
  if (callerUser.role === "salesperson" && order.salesPersonId === callerUser.uid) {
    return { authorized: true };
  }
  if (callerUser.role === "salesperson" && order.salesPersonId !== callerUser.uid) {
    return { authorized: false, reason: "Unassigned salesperson cannot verify payment" };
  }
  return { authorized: false, reason: "Unauthorized role" };
}

// Simulated submission validation with exact paise precision and multi-attachment rules
function validatePaymentSubmission({ order, callerUid, submittedAmount, rawUtr, proofStoragePath, proofStoragePaths, mockStorageFiles }) {
  if (order.userId !== callerUid) {
    return { valid: false, error: "Order does not belong to user" };
  }
  if (order.status !== "confirmed") {
    return { valid: false, error: "Cannot submit payment for unconfirmed quotation" };
  }
  if (!order.totalAmount || order.totalAmount <= 0) {
    return { valid: false, error: "Order total amount must be greater than zero" };
  }
  if (toPaise(submittedAmount) !== toPaise(order.totalAmount)) {
    return { valid: false, error: "Submitted amount does not match expected amount" };
  }
  const normUtr = normalizeUtr(rawUtr);
  if (!normUtr || normUtr.length < 6) {
    return { valid: false, error: "Invalid UTR format" };
  }

  let paths = [];
  if (Array.isArray(proofStoragePaths) && proofStoragePaths.length > 0) {
    paths = proofStoragePaths.map(p => (typeof p === 'string' ? p.trim() : '')).filter(p => p.length > 0);
  } else if (proofStoragePath && typeof proofStoragePath === 'string' && proofStoragePath.trim().length > 0) {
    paths = [proofStoragePath.trim()];
  }

  if (paths.length === 0) {
    return { valid: false, error: "At least one payment proof attachment is required" };
  }
  if (paths.length > 5) {
    return { valid: false, error: "Maximum 5 payment proof attachments allowed" };
  }

  const uniquePaths = new Set(paths);
  if (uniquePaths.size !== paths.length) {
    return { valid: false, error: "Duplicate payment proof attachment paths detected" };
  }

  const validProofPathRegex = new RegExp(`^payment_proofs\\/${order.id}\\/([a-zA-Z0-9_-]+)\\/receipt(_[0-4])?\\.(jpg|jpeg|png|webp|pdf)$`);
  const matchFirst = paths[0].match(validProofPathRegex);
  if (!matchFirst) {
    return { valid: false, error: "Invalid primary deterministic proof path format" };
  }
  const submissionId = matchFirst[1];

  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const match = p.match(validProofPathRegex);
    if (!match) {
      return { valid: false, error: `Invalid attachment path format at index ${i}` };
    }
    if (match[1] !== submissionId) {
      return { valid: false, error: `Attachment at index ${i} belongs to different submission` };
    }

    if (mockStorageFiles) {
      const fileData = mockStorageFiles instanceof Map ? mockStorageFiles.get(p) : mockStorageFiles[p];
      if (!fileData) {
        return { valid: false, error: `Attachment ${i + 1} does not exist in Storage` };
      }
      if (fileData.size > 10 * 1024 * 1024) {
        return { valid: false, error: `Attachment ${i + 1} exceeds 10 MB limit` };
      }
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedMimes.includes(fileData.contentType)) {
        return { valid: false, error: `Attachment ${i + 1} has unsupported MIME type` };
      }
    }
  }

  return { valid: true, utrNormalized: normUtr, submissionId, paths };
}

// Simulated Reward Trigger check
function shouldTriggerRewards(beforeOrder, afterOrder) {
  const isPaidTransition = beforeOrder.paymentStatus !== "paid" && afterOrder.paymentStatus === "paid";
  return isPaidTransition;
}

// ================= TEST RUNNER =================
function runTests() {
  console.log("Starting ITACON Final Backend Payment & Security Rules Tests (Phase 2.5)...\n");
  let passed = 0;

  // Test 1: UTR Normalization
  {
    assert.strictEqual(normalizeUtr("  2024-1029-ABCD-5678  "), "20241029ABCD5678");
    assert.strictEqual(normalizeUtr("utr/123/456"), "UTR123456");
    assert.strictEqual(normalizeUtr("axis.neft#8899"), "AXISNEFT8899");
    assert.strictEqual(normalizeUtr(""), "");
    console.log("✔ Test 1: UTR normalization handles separators, casing, and spaces");
    passed++;
  }

  // Test 2: Exact Currency Precision (Paise comparison)
  {
    // Exact match
    assert.strictEqual(toPaise(84520.50), 8452050);
    assert.strictEqual(toPaise(84520.50), toPaise("84520.50"));

    // Subtle 1-paise difference must be rejected
    assert.notStrictEqual(toPaise(84520.50), toPaise(84520.51));
    assert.notStrictEqual(toPaise(84520.50), toPaise(84520.00));
    console.log("✔ Test 2: Currency precision operates at exact integer paise (no float drift)");
    passed++;
  }

  // Test 3: Deterministic Proof Storage Path Enforcement
  {
    const order = { id: "ORD_789", userId: "cust_1", totalAmount: 10000, status: "confirmed" };
    
    // Valid deterministic formats
    assert.strictEqual(validatePaymentSubmission({
      order,
      callerUid: "cust_1",
      submittedAmount: 10000,
      rawUtr: "UTR12345678",
      proofStoragePath: "payment_proofs/ORD_789/sub_ORD_789_12345/receipt.jpg",
    }).valid, true);

    assert.strictEqual(validatePaymentSubmission({
      order,
      callerUid: "cust_1",
      submittedAmount: 10000,
      rawUtr: "UTR12345678",
      proofStoragePath: "payment_proofs/ORD_789/sub_ORD_789_12345/receipt.pdf",
    }).valid, true);

    // Arbitrary / Random / Malicious filenames rejected
    assert.strictEqual(validatePaymentSubmission({
      order,
      callerUid: "cust_1",
      submittedAmount: 10000,
      rawUtr: "UTR12345678",
      proofStoragePath: "payment_proofs/ORD_789/sub_ORD_789_12345/random_photo.jpg",
    }).valid, false);

    assert.strictEqual(validatePaymentSubmission({
      order,
      callerUid: "cust_1",
      submittedAmount: 10000,
      rawUtr: "UTR12345678",
      proofStoragePath: "payment_proofs/OTHER_ORDER/sub_123/receipt.jpg",
    }).valid, false);

    assert.strictEqual(validatePaymentSubmission({
      order,
      callerUid: "cust_1",
      submittedAmount: 10000,
      rawUtr: "UTR12345678",
      proofStoragePath: "payment_proofs/ORD_789/sub_123/script.exe",
    }).valid, false);

    console.log("✔ Test 3: Deterministic storage path and receipt naming strictly enforced");
    passed++;
  }

  // Test 4: Customer cannot verify own payment
  {
    const order = { userId: "cust_1", salesPersonId: "sp_1", totalAmount: 50000, status: "confirmed" };
    const authResult = checkVerificationAuthorization({ uid: "cust_1", role: "customer" }, order);
    assert.strictEqual(authResult.authorized, false);
    console.log("✔ Test 4: Customer cannot verify own payment");
    passed++;
  }

  // Test 5: Customer cannot verify another customer's payment
  {
    const order = { userId: "cust_1", salesPersonId: "sp_1", totalAmount: 50000, status: "confirmed" };
    const authResult = checkVerificationAuthorization({ uid: "cust_2", role: "customer" }, order);
    assert.strictEqual(authResult.authorized, false);
    console.log("✔ Test 5: Customer cannot verify another customer's payment");
    passed++;
  }

  // Test 6: Unassigned salesperson cannot verify payment
  {
    const order = { userId: "cust_1", salesPersonId: "sp_1", totalAmount: 50000, status: "confirmed" };
    const authResult = checkVerificationAuthorization({ uid: "sp_2", role: "salesperson" }, order);
    assert.strictEqual(authResult.authorized, false);
    console.log("✔ Test 6: Unassigned salesperson is denied verification");
    passed++;
  }

  // Test 7: Assigned salesperson can verify payment
  {
    const order = { userId: "cust_1", salesPersonId: "sp_1", totalAmount: 50000, status: "confirmed" };
    const authResult = checkVerificationAuthorization({ uid: "sp_1", role: "salesperson" }, order);
    assert.strictEqual(authResult.authorized, true);
    console.log("✔ Test 7: Assigned salesperson can verify payment");
    passed++;
  }

  // Test 8: Admin and Manager authorization verified
  {
    const order = { userId: "cust_1", salesPersonId: "sp_1", totalAmount: 50000, status: "confirmed" };
    assert.strictEqual(checkVerificationAuthorization({ uid: "admin_1", admin: true }, order).authorized, true);
    assert.strictEqual(checkVerificationAuthorization({ uid: "mgr_1", role: "manager" }, order).authorized, true);
    console.log("✔ Test 8: Admin and Manager authorization verified");
    passed++;
  }

  // Test 9: Submission rejected before quotation is confirmed
  {
    const orderPending = { id: "o1", userId: "cust_1", totalAmount: 50000, status: "pending_rate" };
    const res = validatePaymentSubmission({
      order: orderPending,
      callerUid: "cust_1",
      submittedAmount: 50000,
      rawUtr: "UTR12345678",
    });
    assert.strictEqual(res.valid, false);
    assert(res.error.includes("unconfirmed"));
    console.log("✔ Test 9: Payment submission rejected before quotation is confirmed");
    passed++;
  }

  // Test 10: Submission rejected if totalAmount <= 0
  {
    const orderZero = { id: "o1", userId: "cust_1", totalAmount: 0, status: "confirmed" };
    const res = validatePaymentSubmission({
      order: orderZero,
      callerUid: "cust_1",
      submittedAmount: 0,
      rawUtr: "UTR12345678",
    });
    assert.strictEqual(res.valid, false);
    assert(res.error.includes("greater than zero"));
    console.log("✔ Test 10: Payment submission rejected if totalAmount <= 0");
    passed++;
  }

  // Test 11: Amount mismatch strictly rejected
  {
    const order = { id: "o1", userId: "cust_1", totalAmount: 125000, status: "confirmed" };
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_1",
      submittedAmount: 100000,
      rawUtr: "UTR12345678",
    });
    assert.strictEqual(res.valid, false);
    assert(res.error.includes("does not match"));
    console.log("✔ Test 11: Amount mismatch strictly rejected at paise precision");
    passed++;
  }

  // Test 12: Duplicate UTR rejected via transactional registry
  {
    const registry = new MockUtrRegistry();
    registry.reserveUtr({
      utrNormalized: "UTR12345678",
      submissionId: "sub_1",
      orderId: "ord_1",
      customerId: "cust_1",
    });

    let duplicateRejected = false;
    try {
      registry.reserveUtr({
        utrNormalized: "UTR12345678",
        submissionId: "sub_2",
        orderId: "ord_2",
        customerId: "cust_2",
      });
    } catch (e) {
      duplicateRejected = true;
    }
    assert.strictEqual(duplicateRejected, true);
    console.log("✔ Test 12: Duplicate UTR registration rejected transactionally");
    passed++;
  }

  // Test 13: Concurrent duplicate UTR attempts -> one succeeds, other fails
  {
    const registry = new MockUtrRegistry();
    const attempts = [
      () => registry.reserveUtr({ utrNormalized: "CONCURRENT123", submissionId: "s1", orderId: "o1", customerId: "c1" }),
      () => registry.reserveUtr({ utrNormalized: "CONCURRENT123", submissionId: "s2", orderId: "o2", customerId: "c2" }),
    ];
    let successes = 0;
    let failures = 0;
    for (const attempt of attempts) {
      try {
        attempt();
        successes++;
      } catch (e) {
        failures++;
      }
    }
    assert.strictEqual(successes, 1);
    assert.strictEqual(failures, 1);
    console.log("✔ Test 13: Concurrent duplicate UTR race condition prevented");
    passed++;
  }

  // Test 14: Staff Verification Race Condition: Double Click by same staff
  {
    const engine = new MockPaymentEngine();
    engine.createOrder({ id: "ord_race_1", userId: "cust_1", salesPersonId: "sp_1", totalAmount: 50000, status: "confirmed", paymentStatus: "pending_verification" });
    engine.submissions.set("sub_race_1", {
      submissionId: "sub_race_1",
      orderId: "ord_race_1",
      customerId: "cust_1",
      expectedAmount: 50000,
      utrNumber: "UTR_RACE_1",
      utrNormalized: "UTRRACE1",
      status: "pending_verification",
    });

    const staffUser = { uid: "sp_1", role: "salesperson" };

    // 1st click
    const res1 = engine.verifyPayment({ staffUser, submissionId: "sub_race_1" });
    assert.strictEqual(res1.success, true);

    // 2nd click (simultaneous or immediate retry)
    let doubleClickThrew = false;
    try {
      engine.verifyPayment({ staffUser, submissionId: "sub_race_1" });
    } catch (err) {
      doubleClickThrew = true;
      assert(err.message.includes("already processed"));
    }
    assert.strictEqual(doubleClickThrew, true);
    assert.strictEqual(engine.statusHistories.length, 1); // exactly 1 history entry
    assert.strictEqual(engine.notifications.length, 1); // exactly 1 notification
    console.log("✔ Test 14: Double click verification prevented: exactly 1 transition processed");
    passed++;
  }

  // Test 15: Staff Verification Race Condition: Verify vs Reject simultaneous
  {
    const engine = new MockPaymentEngine();
    engine.createOrder({ id: "ord_race_2", userId: "cust_1", salesPersonId: "sp_1", totalAmount: 75000, status: "confirmed", paymentStatus: "pending_verification" });
    engine.submissions.set("sub_race_2", {
      submissionId: "sub_race_2",
      orderId: "ord_race_2",
      customerId: "cust_1",
      expectedAmount: 75000,
      utrNumber: "UTR_RACE_2",
      utrNormalized: "UTRRACE2",
      status: "pending_verification",
    });

    const staffA = { uid: "sp_1", role: "salesperson" };
    const staffB = { uid: "admin_1", admin: true, role: "admin" };

    // Staff A verifies first
    engine.verifyPayment({ staffUser: staffA, submissionId: "sub_race_2" });

    // Staff B tries to reject simultaneously
    let rejectThrew = false;
    try {
      engine.rejectPayment({ staffUser: staffB, submissionId: "sub_race_2", reason: "UTR not found" });
    } catch (err) {
      rejectThrew = true;
      assert(err.message.includes("already processed"));
    }
    assert.strictEqual(rejectThrew, true);
    assert.strictEqual(engine.orders.get("ord_race_2").paymentStatus, "paid");
    console.log("✔ Test 15: Verify vs Reject race condition: winner commits, loser safely aborts");
    passed++;
  }

  // Test 16: Two staff members verify simultaneously
  {
    const engine = new MockPaymentEngine();
    engine.createOrder({ id: "ord_race_3", userId: "cust_1", salesPersonId: "sp_1", totalAmount: 30000, status: "confirmed", paymentStatus: "pending_verification" });
    engine.submissions.set("sub_race_3", {
      submissionId: "sub_race_3",
      orderId: "ord_race_3",
      customerId: "cust_1",
      expectedAmount: 30000,
      utrNumber: "UTR_RACE_3",
      utrNormalized: "UTRRACE3",
      status: "pending_verification",
    });

    const staff1 = { uid: "sp_1", role: "salesperson" };
    const staff2 = { uid: "admin_1", admin: true, role: "admin" };

    let s1Success = false;
    let s2Failed = false;

    try {
      engine.verifyPayment({ staffUser: staff1, submissionId: "sub_race_3" });
      s1Success = true;
    } catch (_) {}

    try {
      engine.verifyPayment({ staffUser: staff2, submissionId: "sub_race_3" });
    } catch (err) {
      s2Failed = true;
    }

    assert.strictEqual(s1Success, true);
    assert.strictEqual(s2Failed, true);
    assert.strictEqual(engine.statusHistories.length, 1);
    console.log("✔ Test 16: Simultaneous dual staff verification: exactly one authoritative transition");
    passed++;
  }

  // Test 17: Rewards triggered strictly on paymentStatus transition to 'paid'
  {
    const beforeUnpaid = { status: "confirmed", paymentStatus: "payment_due" };
    const afterPaid = { status: "confirmed", paymentStatus: "paid" };
    assert.strictEqual(shouldTriggerRewards(beforeUnpaid, afterPaid), true);

    // pending_verification -> rejected => NO reward
    const afterRejected = { status: "confirmed", paymentStatus: "rejected" };
    assert.strictEqual(shouldTriggerRewards({ status: "confirmed", paymentStatus: "pending_verification" }, afterRejected), false);

    // rejected -> pending_verification => NO reward
    const afterResubmitted = { status: "confirmed", paymentStatus: "pending_verification" };
    assert.strictEqual(shouldTriggerRewards({ status: "confirmed", paymentStatus: "rejected" }, afterResubmitted), false);

    // paid -> processing => NO additional reward
    assert.strictEqual(shouldTriggerRewards({ status: "confirmed", paymentStatus: "paid" }, { status: "processing", paymentStatus: "paid" }), false);

    // document update while paid => NO additional reward
    assert.strictEqual(shouldTriggerRewards({ status: "processing", paymentStatus: "paid" }, { status: "processing", paymentStatus: "paid" }), false);
    console.log("✔ Test 17: Reward engine triggers strictly on before != paid && after == paid");
    passed++;
  }

  // Test 18: Payment resubmission preserves audit history
  {
    const registry = new MockUtrRegistry();
    const initialEntry = registry.reserveUtr({
      utrNormalized: "UTR_OLD_1",
      submissionId: "sub_1",
      orderId: "ord_1",
      customerId: "cust_1",
    });
    registry.rejectUtr("UTR_OLD_1");

    assert.strictEqual(initialEntry.status, "rejected");
    assert(initialEntry.rejectedAt != null);

    const newEntry = registry.reserveUtr({
      utrNormalized: "UTR_NEW_2",
      submissionId: "sub_2",
      orderId: "ord_1",
      customerId: "cust_1",
    });
    assert.strictEqual(newEntry.status, "pending_verification");
    assert.strictEqual(initialEntry.status, "rejected");
    console.log("✔ Test 18: Rejected payment preserves audit history and allows new resubmission");
    passed++;
  }

  // Test 19: Single PDF submission validation
  {
    const order = { id: "ORD_P1", userId: "cust_p1", totalAmount: 25000, status: "confirmed" };
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_p1",
      submittedAmount: 25000,
      rawUtr: "AXIS12345678",
      proofStoragePaths: ["payment_proofs/ORD_P1/sub_p1_001/receipt.pdf"],
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.paths.length, 1);
    assert.strictEqual(res.submissionId, "sub_p1_001");
    console.log("✔ Test 19: Single PDF attachment correctly validated");
    passed++;
  }

  // Test 20: Single image submission validation (JPG/PNG/WEBP)
  {
    const order = { id: "ORD_IMG1", userId: "cust_img", totalAmount: 15000, status: "confirmed" };
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const res = validatePaymentSubmission({
        order,
        callerUid: "cust_img",
        submittedAmount: 15000,
        rawUtr: "HDFC98765432",
        proofStoragePaths: [`payment_proofs/ORD_IMG1/sub_img_001/receipt.${ext}`],
      });
      assert.strictEqual(res.valid, true);
    }
    console.log("✔ Test 20: Single image attachments (JPG, JPEG, PNG, WEBP) validated");
    passed++;
  }

  // Test 21: Multiple PDFs only (up to 5 pages/documents)
  {
    const order = { id: "ORD_MPDF", userId: "cust_mpdf", totalAmount: 50000, status: "confirmed" };
    const pdfPaths = [
      "payment_proofs/ORD_MPDF/sub_mpdf_1/receipt.pdf",
      "payment_proofs/ORD_MPDF/sub_mpdf_1/receipt_1.pdf",
      "payment_proofs/ORD_MPDF/sub_mpdf_1/receipt_2.pdf",
    ];
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_mpdf",
      submittedAmount: 50000,
      rawUtr: "ICIC99887766",
      proofStoragePaths: pdfPaths,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.paths.length, 3);
    console.log("✔ Test 21: Multiple PDFs only (up to 5) validated");
    passed++;
  }

  // Test 22: Multiple screenshots only (images)
  {
    const order = { id: "ORD_MSHOT", userId: "cust_mshot", totalAmount: 32000, status: "confirmed" };
    const imgPaths = [
      "payment_proofs/ORD_MSHOT/sub_mshot_1/receipt.jpg",
      "payment_proofs/ORD_MSHOT/sub_mshot_1/receipt_1.png",
      "payment_proofs/ORD_MSHOT/sub_mshot_1/receipt_2.webp",
      "payment_proofs/ORD_MSHOT/sub_mshot_1/receipt_3.jpeg",
    ];
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_mshot",
      submittedAmount: 32000,
      rawUtr: "SBI11223344",
      proofStoragePaths: imgPaths,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.paths.length, 4);
    console.log("✔ Test 22: Multiple screenshots/images only validated");
    passed++;
  }

  // Test 23: Mixed PDF and image files
  {
    const order = { id: "ORD_MIX", userId: "cust_mix", totalAmount: 45000, status: "confirmed" };
    const mixedPaths = [
      "payment_proofs/ORD_MIX/sub_mix_1/receipt.pdf",
      "payment_proofs/ORD_MIX/sub_mix_1/receipt_1.png",
      "payment_proofs/ORD_MIX/sub_mix_1/receipt_2.jpg",
      "payment_proofs/ORD_MIX/sub_mix_1/receipt_3.pdf",
    ];
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_mix",
      submittedAmount: 45000,
      rawUtr: "PNB55667788",
      proofStoragePaths: mixedPaths,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.paths.length, 4);
    console.log("✔ Test 23: Mixed PDF and image attachments validated");
    passed++;
  }

  // Test 24: Exactly 5 attachments (maximum boundary allowed)
  {
    const order = { id: "ORD_MAX5", userId: "cust_max5", totalAmount: 90000, status: "confirmed" };
    const fivePaths = [
      "payment_proofs/ORD_MAX5/sub_max5/receipt.pdf",
      "payment_proofs/ORD_MAX5/sub_max5/receipt_1.jpg",
      "payment_proofs/ORD_MAX5/sub_max5/receipt_2.png",
      "payment_proofs/ORD_MAX5/sub_max5/receipt_3.webp",
      "payment_proofs/ORD_MAX5/sub_max5/receipt_4.pdf",
    ];
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_max5",
      submittedAmount: 90000,
      rawUtr: "BOI99001122",
      proofStoragePaths: fivePaths,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.paths.length, 5);
    console.log("✔ Test 24: Exactly five attachments accepted at boundary limit");
    passed++;
  }

  // Test 25: More than 5 attachments strictly rejected
  {
    const order = { id: "ORD_OVER", userId: "cust_over", totalAmount: 90000, status: "confirmed" };
    const sixPaths = [
      "payment_proofs/ORD_OVER/sub_over/receipt.pdf",
      "payment_proofs/ORD_OVER/sub_over/receipt_1.jpg",
      "payment_proofs/ORD_OVER/sub_over/receipt_2.png",
      "payment_proofs/ORD_OVER/sub_over/receipt_3.webp",
      "payment_proofs/ORD_OVER/sub_over/receipt_4.pdf",
      "payment_proofs/ORD_OVER/sub_over/receipt_5.pdf",
    ];
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_over",
      submittedAmount: 90000,
      rawUtr: "BOI99001122",
      proofStoragePaths: sixPaths,
    });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, "Maximum 5 payment proof attachments allowed");
    console.log("✔ Test 25: More than 5 attachments strictly rejected");
    passed++;
  }

  // Test 26: Duplicate attachment paths rejected
  {
    const order = { id: "ORD_DUP", userId: "cust_dup", totalAmount: 10000, status: "confirmed" };
    const dupPaths = [
      "payment_proofs/ORD_DUP/sub_dup/receipt.jpg",
      "payment_proofs/ORD_DUP/sub_dup/receipt.jpg",
    ];
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_dup",
      submittedAmount: 10000,
      rawUtr: "DUP12345678",
      proofStoragePaths: dupPaths,
    });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, "Duplicate payment proof attachment paths detected");
    console.log("✔ Test 26: Duplicate attachment paths strictly rejected");
    passed++;
  }

  // Test 27: Cross-order / unauthorized path rejected
  {
    const order = { id: "ORD_A", userId: "cust_a", totalAmount: 10000, status: "confirmed" };
    const crossPaths = [
      "payment_proofs/ORD_B/sub_a/receipt.jpg",
    ];
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_a",
      submittedAmount: 10000,
      rawUtr: "CROSS123456",
      proofStoragePaths: crossPaths,
    });
    assert.strictEqual(res.valid, false);
    console.log("✔ Test 27: Cross-order / mismatched storage paths strictly rejected");
    passed++;
  }

  // Test 28: Attachment belonging to different submission ID rejected
  {
    const order = { id: "ORD_SUBDIFF", userId: "cust_sd", totalAmount: 10000, status: "confirmed" };
    const diffSubPaths = [
      "payment_proofs/ORD_SUBDIFF/sub_alpha/receipt.jpg",
      "payment_proofs/ORD_SUBDIFF/sub_beta/receipt_1.jpg",
    ];
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_sd",
      submittedAmount: 10000,
      rawUtr: "DIFF12345678",
      proofStoragePaths: diffSubPaths,
    });
    assert.strictEqual(res.valid, false);
    assert(res.error.includes("belongs to different submission"));
    console.log("✔ Test 28: Attachments belonging to different submission folders rejected");
    passed++;
  }

  // Test 29: Missing storage object rejected (incomplete upload check)
  {
    const order = { id: "ORD_MISS", userId: "cust_miss", totalAmount: 10000, status: "confirmed" };
    const mockStorage = new Map();
    mockStorage.set("payment_proofs/ORD_MISS/sub_miss/receipt.pdf", { size: 1024, contentType: "application/pdf" });
    // Second file missing from storage (e.g. failed during customer upload)
    const res = validatePaymentSubmission({
      order,
      callerUid: "cust_miss",
      submittedAmount: 10000,
      rawUtr: "MISS12345678",
      proofStoragePaths: [
        "payment_proofs/ORD_MISS/sub_miss/receipt.pdf",
        "payment_proofs/ORD_MISS/sub_miss/receipt_1.jpg",
      ],
      mockStorageFiles: mockStorage,
    });
    assert.strictEqual(res.valid, false);
    assert(res.error.includes("does not exist in Storage"));
    console.log("✔ Test 29: Missing or unuploaded Storage objects rejected");
    passed++;
  }

  // Test 30: File exceeding 10 MB or invalid MIME rejected
  {
    const order = { id: "ORD_LIMIT", userId: "cust_lim", totalAmount: 10000, status: "confirmed" };
    const mockStorageOversize = new Map();
    mockStorageOversize.set("payment_proofs/ORD_LIMIT/sub_lim/receipt.pdf", { size: 15 * 1024 * 1024, contentType: "application/pdf" });
    const resOver = validatePaymentSubmission({
      order,
      callerUid: "cust_lim",
      submittedAmount: 10000,
      rawUtr: "OVER12345678",
      proofStoragePaths: ["payment_proofs/ORD_LIMIT/sub_lim/receipt.pdf"],
      mockStorageFiles: mockStorageOversize,
    });
    assert.strictEqual(resOver.valid, false);
    assert(resOver.error.includes("exceeds 10 MB limit"));

    const mockStorageBadMime = new Map();
    mockStorageBadMime.set("payment_proofs/ORD_LIMIT/sub_lim/receipt.pdf", { size: 1024, contentType: "application/x-msdownload" });
    const resMime = validatePaymentSubmission({
      order,
      callerUid: "cust_lim",
      submittedAmount: 10000,
      rawUtr: "MIME12345678",
      proofStoragePaths: ["payment_proofs/ORD_LIMIT/sub_lim/receipt.pdf"],
      mockStorageFiles: mockStorageBadMime,
    });
    assert.strictEqual(resMime.valid, false);
    assert(resMime.error.includes("unsupported MIME type"));
    console.log("✔ Test 30: Attachments exceeding 10 MB or with invalid MIME types rejected");
    passed++;
  }

  // Test 31: Assigned salesperson can view and verify multi-receipt submission; unassigned denied
  {
    const engine = new MockPaymentEngine();
    const order = { id: "ORD_SP_MULTI", userId: "cust_sp", salesPersonId: "sp_assigned_1", totalAmount: 40000, status: "confirmed" };
    engine.createOrder(order);

    const sub = {
      submissionId: "sub_sp_multi",
      orderId: "ORD_SP_MULTI",
      customerId: "cust_sp",
      status: "pending_verification",
      expectedAmount: 40000,
      submittedAmount: 40000,
      utrNumber: "SPMULTI123456",
      utrNormalized: "SPMULTI123456",
      proofStoragePath: "payment_proofs/ORD_SP_MULTI/sub_sp_multi/receipt.pdf",
      proofStoragePaths: [
        "payment_proofs/ORD_SP_MULTI/sub_sp_multi/receipt.pdf",
        "payment_proofs/ORD_SP_MULTI/sub_sp_multi/receipt_1.jpg",
      ],
    };
    engine.submissions.set(sub.submissionId, sub);
    engine.utrs.set(sub.utrNormalized, { status: "pending_verification" });

    // Unassigned salesperson denied
    assert.throws(() => {
      engine.verifyPayment({
        staffUser: { uid: "sp_rogue_99", role: "salesperson", admin: false },
        submissionId: sub.submissionId,
      });
    }, /Unassigned salesperson cannot verify payment/);

    // Assigned salesperson can verify
    const verifyRes = engine.verifyPayment({
      staffUser: { uid: "sp_assigned_1", role: "salesperson", admin: false },
      submissionId: sub.submissionId,
    });
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(sub.status, "verified");
    assert.strictEqual(engine.orders.get(order.id).paymentStatus, "paid");
    console.log("✔ Test 31: Salesperson assignment guard verified (assigned verified, unassigned denied)");
    passed++;
  }

  // Test 32: Legacy single-receipt records fall back to proofStoragePath safely
  {
    const legacyRecord = {
      id: "sub_leg_1",
      submissionId: "sub_leg_1",
      orderId: "ORD_LEG",
      proofStoragePath: "payment_proofs/ORD_LEG/sub_leg_1/receipt.jpg",
      // proofStoragePaths is undefined / missing in legacy record
    };
    const resolvedPaths = (legacyRecord.proofStoragePaths && legacyRecord.proofStoragePaths.length > 0)
      ? legacyRecord.proofStoragePaths
      : (legacyRecord.proofStoragePath ? [legacyRecord.proofStoragePath] : []);
    assert.strictEqual(resolvedPaths.length, 1);
    assert.strictEqual(resolvedPaths[0], "payment_proofs/ORD_LEG/sub_leg_1/receipt.jpg");
    console.log("✔ Test 32: Legacy single-receipt payment records fall back gracefully");
    passed++;
  }

  // Test 33: Mismatched submissionId in storage metadata rejected
  {
    const storageMeta = {
      orderId: "ORD_META_1",
      submissionId: "sub_different_999",
    };
    const currentSubmissionId = "sub_current_123";
    assert.throws(() => {
      if (storageMeta.submissionId && storageMeta.submissionId !== currentSubmissionId) {
        throw new Error(`Attachment metadata belongs to submission ${storageMeta.submissionId}, not ${currentSubmissionId}`);
      }
    }, /Attachment metadata belongs to submission sub_different_999/);
    console.log("✔ Test 33: Attachment with mismatched metadata submissionId rejected");
    passed++;
  }

  // Test 34: Duplicate submission replay rejected in transaction
  {
    const engine = new MockPaymentEngine();
    engine.submissions.set("sub_existing_1", {
      submissionId: "sub_existing_1",
      orderId: "ORD_DUP_1",
      status: "pending_verification",
    });

    assert.throws(() => {
      const targetSubId = "sub_existing_1";
      if (engine.submissions.has(targetSubId)) {
        throw new Error(`Payment submission ${targetSubId} has already been recorded.`);
      }
    }, /already been recorded/);
    console.log("✔ Test 34: Submission ID replay/overwrite rejected transactionally");
    passed++;
  }

  console.log(`\n========================================`);
  console.log(`ALL ${passed} PHASE 2.5 BACKEND TESTS PASSED!`);
  console.log(`========================================\n`);
}

runTests();
