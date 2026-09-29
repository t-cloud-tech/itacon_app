const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Normalizes a transaction reference / UTR number:
 * Trims whitespace, converts to uppercase, removes non-alphanumeric characters.
 */
function normalizeUtr(utr) {
  if (!utr || typeof utr !== 'string') return '';
  return utr.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Converts INR rupees to exact integer paise to eliminate floating point imprecision.
 */
function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/**
 * Callable Cloud Function: initiatePaymentSubmissionCallable
 *
 * Stage A & B of Upload-Intent architecture:
 * Authorizes customer payment submission intent, validates amounts,
 * reserves UTR, and generates deterministic authorized storage path.
 */
exports.initiatePaymentSubmissionCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();
  const { orderId, submittedAmount, utrNumber, paymentDate, fileExtension } = data || {};

  if (!orderId || typeof orderId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid orderId.');
  }

  const numSubmittedAmount = Number(submittedAmount);
  if (isNaN(numSubmittedAmount) || numSubmittedAmount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid submitted payment amount.');
  }

  const utrNormalized = normalizeUtr(utrNumber);
  if (!utrNormalized || utrNormalized.length < 6) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid UTR/Transaction Reference. Minimum 6 alphanumeric characters required.'
    );
  }

  const safeExt = (fileExtension || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  if (!allowedExts.includes(safeExt)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid file extension. Allowed: jpg, jpeg, png, webp, pdf.');
  }

  // 1. Fetch Order and Verify Ownership
  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Order document does not exist.');
  }

  const orderData = orderDoc.data() || {};
  const orderOwnerId = orderData.userId || orderData.customerId;
  if (orderOwnerId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'You are not authorized for this order.');
  }

  if (orderData.status !== 'confirmed') {
    throw new functions.https.HttpsError('failed-precondition', 'Payment only accepted for confirmed purchase orders.');
  }

  const currentPaymentStatus = (orderData.paymentStatus || '').toLowerCase();
  if (currentPaymentStatus === 'paid') {
    throw new functions.https.HttpsError('already-exists', 'This order has already been paid and verified.');
  }

  if (currentPaymentStatus === 'pending_verification') {
    throw new functions.https.HttpsError('failed-precondition', 'A payment submission is already pending verification.');
  }

  // 2. Exact Integer Paise Validation
  const expectedAmount = Number(orderData.totalAmount || orderData.total || 0);
  if (expectedAmount <= 0) {
    throw new functions.https.HttpsError('failed-precondition', 'Order total has not been confirmed yet.');
  }

  if (toPaise(numSubmittedAmount) !== toPaise(expectedAmount)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Payment amount (₹${numSubmittedAmount.toFixed(2)}) must exactly match confirmed total (₹${expectedAmount.toFixed(2)}).`
    );
  }

  // 3. Generate Deterministic Submission ID
  const timestamp = Date.now();
  const submissionId = `sub_${orderId}_${timestamp}`;
  const authorizedStoragePath = `payment_proofs/${orderId}/${submissionId}/receipt.${safeExt}`;

  // 4. Reserve UTR & Record Intent in Firestore
  const utrRef = db.collection('payment_utrs').doc(utrNormalized);
  const submissionRef = db.collection('paymentSubmissions').doc(submissionId);

  await db.runTransaction(async (transaction) => {
    const utrDoc = await transaction.get(utrRef);
    if (utrDoc.exists) {
      const existing = utrDoc.data() || {};
      if (existing.status === 'verified') {
        throw new functions.https.HttpsError('already-exists', `UTR ${utrNormalized} already verified for another order.`);
      }
      if (existing.status === 'pending_verification' && existing.orderId !== orderId) {
        throw new functions.https.HttpsError('already-exists', `UTR ${utrNormalized} already pending for another order.`);
      }
    }

    transaction.set(utrRef, {
      utr: String(utrNumber).trim(),
      utrNormalized,
      orderId,
      submissionId,
      customerId: userId,
      status: 'intent_created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(submissionRef, {
      submissionId,
      orderId,
      orderReference: orderData.orderReference || orderId,
      customerId: userId,
      customerName: orderData.customerName || 'Customer',
      salesPersonId: orderData.salesPersonId || orderData.salespersonId || '',
      paymentMethod: 'bank_transfer',
      expectedAmount,
      submittedAmount: numSubmittedAmount,
      utrNumber: String(utrNumber).trim(),
      utrNormalized,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      proofStoragePath: authorizedStoragePath,
      status: 'intent_created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    success: true,
    submissionId,
    authorizedStoragePath,
  };
});

/**
 * Callable Cloud Function: finalizePaymentSubmissionCallable
 *
 * Stage D of Upload-Intent architecture:
 * Finalizes submission after client finishes uploading receipt to authorizedStoragePath.
 */
exports.finalizePaymentSubmissionCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();
  const { submissionId } = data || {};

  if (!submissionId || typeof submissionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing submissionId.');
  }

  const subRef = db.collection('paymentSubmissions').doc(submissionId);
  const subDoc = await subRef.get();
  if (!subDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Payment submission intent not found.');
  }

  const subData = subDoc.data() || {};
  if (subData.customerId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized access to submission.');
  }

  if (subData.status !== 'intent_created') {
    throw new functions.https.HttpsError('failed-precondition', `Invalid status for finalization: ${subData.status}`);
  }

  const orderId = subData.orderId;
  const orderRef = db.collection('orders').doc(orderId);
  const utrRef = db.collection('payment_utrs').doc(subData.utrNormalized);

  await db.runTransaction(async (transaction) => {
    transaction.update(subRef, {
      status: 'pending_verification',
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(utrRef, {
      status: 'pending_verification',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(orderRef, {
      paymentStatus: 'pending_verification',
      paymentSubmissionId: submissionId,
      proofStoragePath: subData.proofStoragePath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const historyRef = orderRef.collection('orderStatusHistory').doc();
    transaction.set(historyRef, {
      fromStatus: 'payment_due',
      toStatus: 'pending_verification',
      changedBy: userId,
      changedByRole: 'customer',
      remarks: `Customer uploaded receipt and finalized payment submission. UTR: ${subData.utrNormalized}, Amount: ₹${subData.submittedAmount}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // Push notifications
  try {
    const orderRefDisplay = subData.orderReference || orderId;
    await db.collection('users').doc(userId).collection('notifications').add({
      title: 'Payment Submitted',
      message: `Your payment details for PO #${orderRefDisplay} were submitted for verification.`,
      type: 'payment_submitted',
      orderId,
      submissionId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const spId = subData.salesPersonId;
    if (spId && typeof spId === 'string' && spId.trim().length > 0) {
      await db.collection('users').doc(spId).collection('notifications').add({
        title: 'Payment Verification Required',
        message: `${subData.customerName || 'Customer'} submitted payment details for PO #${orderRefDisplay} (UTR: ${subData.utrNormalized}).`,
        type: 'payment_verification_required',
        orderId,
        submissionId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('[PaymentEngine] Error sending notifications:', err);
  }

  return { success: true, submissionId, status: 'pending_verification' };
});

/**
 * Callable Cloud Function: submitPaymentProofCallable
 *
 * Full atomic submission (supports both direct and two-phase workflows).
 */
exports.submitPaymentProofCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();
  const { orderId, submittedAmount, utrNumber, paymentDate, proofStoragePath } = data || {};

  if (!orderId || typeof orderId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid orderId.');
  }

  const numSubmittedAmount = Number(submittedAmount);
  if (isNaN(numSubmittedAmount) || numSubmittedAmount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid submitted payment amount.');
  }

  const utrNormalized = normalizeUtr(utrNumber);
  if (!utrNormalized || utrNormalized.length < 6) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid UTR/Transaction Reference. Minimum 6 alphanumeric characters required.'
    );
  }

  const validProofPathRegex = new RegExp(`^payment_proofs\\/${orderId}\\/[a-zA-Z0-9_-]+\\/receipt\\.(jpg|jpeg|png|webp|pdf)$`);
  if (!proofStoragePath || !validProofPathRegex.test(proofStoragePath)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid payment proof storage path. Must match payment_proofs/${orderId}/<submissionId>/receipt.<ext>.`
    );
  }

  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Order document does not exist.');
  }

  const orderData = orderDoc.data() || {};
  const orderOwnerId = orderData.userId || orderData.customerId;
  if (orderOwnerId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'You are not authorized for this order.');
  }

  if (orderData.status !== 'confirmed') {
    throw new functions.https.HttpsError('failed-precondition', 'Payment only accepted for confirmed purchase orders.');
  }

  const currentPaymentStatus = (orderData.paymentStatus || '').toLowerCase();
  if (currentPaymentStatus === 'paid') {
    throw new functions.https.HttpsError('already-exists', 'This order has already been paid and verified.');
  }

  if (currentPaymentStatus === 'pending_verification') {
    throw new functions.https.HttpsError('failed-precondition', 'A payment submission is already pending verification.');
  }

  // Exact Integer Paise Validation
  const expectedAmount = Number(orderData.totalAmount || orderData.total || 0);
  if (expectedAmount <= 0) {
    throw new functions.https.HttpsError('failed-precondition', 'Order total has not been confirmed yet.');
  }

  if (toPaise(numSubmittedAmount) !== toPaise(expectedAmount)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Payment amount (₹${numSubmittedAmount.toFixed(2)}) must exactly match confirmed total (₹${expectedAmount.toFixed(2)}).`
    );
  }

  // Extract submissionId from deterministic path
  const pathParts = proofStoragePath.split('/');
  const submissionId = pathParts[2] || `sub_${orderId}_${Date.now()}`;

  let customerName = orderData.customerName || '';
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const uData = userDoc.data() || {};
      customerName = uData.name || uData.companyName || customerName;
    }
  } catch (_) {}

  const utrRef = db.collection('payment_utrs').doc(utrNormalized);
  const submissionRef = db.collection('paymentSubmissions').doc(submissionId);
  const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

  await db.runTransaction(async (transaction) => {
    const utrDoc = await transaction.get(utrRef);
    if (utrDoc.exists) {
      const existing = utrDoc.data() || {};
      if (existing.status === 'verified') {
        throw new functions.https.HttpsError('already-exists', `UTR ${utrNormalized} already verified for another order.`);
      }
      if (existing.status === 'pending_verification' && existing.orderId !== orderId) {
        throw new functions.https.HttpsError('already-exists', `UTR ${utrNormalized} already pending for another order.`);
      }
    }

    transaction.set(utrRef, {
      utr: String(utrNumber).trim(),
      utrNormalized,
      orderId,
      submissionId,
      customerId: userId,
      status: 'pending_verification',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(submissionRef, {
      submissionId,
      orderId,
      orderReference: orderData.orderReference || orderId,
      customerId: userId,
      customerName: customerName || 'Customer',
      salesPersonId: orderData.salesPersonId || orderData.salespersonId || '',
      paymentMethod: 'bank_transfer',
      expectedAmount,
      submittedAmount: numSubmittedAmount,
      utrNumber: String(utrNumber).trim(),
      utrNormalized,
      paymentDate: admin.firestore.Timestamp.fromDate(parsedPaymentDate),
      proofStoragePath,
      status: 'pending_verification',
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedAt: null,
      verifiedBy: null,
      rejectionReason: null,
    });

    transaction.update(orderRef, {
      paymentStatus: 'pending_verification',
      paymentSubmissionId: submissionId,
      proofStoragePath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const historyRef = orderRef.collection('orderStatusHistory').doc();
    transaction.set(historyRef, {
      fromStatus: 'payment_due',
      toStatus: 'pending_verification',
      changedBy: userId,
      changedByRole: 'customer',
      remarks: `Customer submitted payment details via Bank Transfer. UTR: ${utrNormalized}, Amount: ₹${numSubmittedAmount.toFixed(2)}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  try {
    const orderRefDisplay = orderData.orderReference || orderId;
    await db.collection('users').doc(userId).collection('notifications').add({
      title: 'Payment Submitted',
      message: `Your payment details for PO #${orderRefDisplay} were submitted for verification.`,
      type: 'payment_submitted',
      orderId,
      submissionId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const spId = orderData.salesPersonId || orderData.salespersonId;
    if (spId && typeof spId === 'string' && spId.trim().length > 0) {
      await db.collection('users').doc(spId).collection('notifications').add({
        title: 'Payment Verification Required',
        message: `${customerName || 'Customer'} submitted payment details for PO #${orderRefDisplay} (UTR: ${utrNormalized}).`,
        type: 'payment_verification_required',
        orderId,
        submissionId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('[PaymentEngine] Error sending notifications:', err);
  }

  return { success: true, submissionId, status: 'pending_verification' };
});

/**
 * Callable Cloud Function: verifyPaymentCallable
 *
 * Transaction-isolated verification: prevents race conditions between simultaneous
 * verify calls or verify vs reject calls.
 */
exports.verifyPaymentCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Staff authentication required.');
  }

  const staffUid = context.auth.uid;
  const db = admin.firestore();
  const { submissionId } = data || {};

  if (!submissionId || typeof submissionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing submissionId.');
  }

  // 1. Resolve Staff Role via Trusted Database Record
  const staffDoc = await db.collection('users').doc(staffUid).get();
  if (!staffDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Staff profile not found.');
  }

  const staffData = staffDoc.data() || {};
  const role = (staffData.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'manager' || context.auth.token.admin === true;
  const isSalesperson = role === 'salesperson';

  if (!isAdmin && !isSalesperson) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized role.');
  }

  const subRef = db.collection('paymentSubmissions').doc(submissionId);
  let resolvedOrderId = '';
  let resolvedExpectedAmount = 0;
  let resolvedCustomerId = '';
  let resolvedOrderRef = '';

  // 2. Atomic Transaction (reads inside transaction to prevent race conditions)
  await db.runTransaction(async (transaction) => {
    const subDoc = await transaction.get(subRef);
    if (!subDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment submission not found.');
    }

    const subData = subDoc.data() || {};
    if (subData.status !== 'pending_verification') {
      throw new functions.https.HttpsError('failed-precondition', `Submission is already processed (${subData.status}).`);
    }

    resolvedOrderId = subData.orderId;
    resolvedExpectedAmount = subData.expectedAmount;
    resolvedCustomerId = subData.customerId;
    resolvedOrderRef = subData.orderReference || subData.orderId;

    const orderRef = db.collection('orders').doc(resolvedOrderId);
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Associated order not found.');
    }

    const orderData = orderDoc.data() || {};
    if (isSalesperson && !isAdmin) {
      const assignedSpId = orderData.salesPersonId || orderData.salespersonId;
      if (assignedSpId !== staffUid) {
        throw new functions.https.HttpsError('permission-denied', 'You may only verify payments for your assigned orders.');
      }
    }

    const utrNormalized = subData.utrNormalized || normalizeUtr(subData.utrNumber);
    const utrRef = db.collection('payment_utrs').doc(utrNormalized);

    transaction.update(subRef, {
      status: 'verified',
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy: staffUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(utrRef, {
      status: 'verified',
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy: staffUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(orderRef, {
      paymentStatus: 'paid',
      paidAmount: subData.expectedAmount,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentId: subData.utrNumber,
      status: 'processing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const histRef = orderRef.collection('orderStatusHistory').doc();
    transaction.set(histRef, {
      fromStatus: 'pending_verification',
      toStatus: 'paid',
      changedBy: staffUid,
      changedByRole: role,
      remarks: `Payment verified by staff. Amount ₹${subData.expectedAmount} credited via UTR ${subData.utrNumber}.`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // 3. Send Notification to Customer
  try {
    await db.collection('users').doc(resolvedCustomerId).collection('notifications').add({
      title: 'Payment Verified 🎉',
      message: `Your payment of ₹${resolvedExpectedAmount.toFixed(2)} for PO #${resolvedOrderRef} has been verified. Production is scheduled.`,
      type: 'payment_verified',
      orderId: resolvedOrderId,
      submissionId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[PaymentEngine] Error sending verification notification:', err);
  }

  return { success: true, orderId: resolvedOrderId, status: 'paid' };
});

/**
 * Callable Cloud Function: rejectPaymentCallable
 *
 * Transaction-isolated rejection: requires reason and prevents race conditions.
 */
exports.rejectPaymentCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Staff authentication required.');
  }

  const staffUid = context.auth.uid;
  const db = admin.firestore();
  const { submissionId, reason } = data || {};

  if (!submissionId || typeof submissionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing submissionId.');
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid rejection reason must be provided.');
  }

  const trimmedReason = reason.trim();

  // 1. Resolve Staff Role
  const staffDoc = await db.collection('users').doc(staffUid).get();
  if (!staffDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Staff profile not found.');
  }

  const staffData = staffDoc.data() || {};
  const role = (staffData.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'manager' || context.auth.token.admin === true;
  const isSalesperson = role === 'salesperson';

  if (!isAdmin && !isSalesperson) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized role.');
  }

  const subRef = db.collection('paymentSubmissions').doc(submissionId);
  let resolvedOrderId = '';
  let resolvedCustomerId = '';
  let resolvedOrderRef = '';

  // 2. Atomic Transaction
  await db.runTransaction(async (transaction) => {
    const subDoc = await transaction.get(subRef);
    if (!subDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment submission not found.');
    }

    const subData = subDoc.data() || {};
    if (subData.status !== 'pending_verification') {
      throw new functions.https.HttpsError('failed-precondition', `Submission is already processed (${subData.status}).`);
    }

    resolvedOrderId = subData.orderId;
    resolvedCustomerId = subData.customerId;
    resolvedOrderRef = subData.orderReference || subData.orderId;

    const orderRef = db.collection('orders').doc(resolvedOrderId);
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Associated order not found.');
    }

    const orderData = orderDoc.data() || {};
    if (isSalesperson && !isAdmin) {
      const assignedSpId = orderData.salesPersonId || orderData.salespersonId;
      if (assignedSpId !== staffUid) {
        throw new functions.https.HttpsError('permission-denied', 'You may only review payments for your assigned orders.');
      }
    }

    const utrNormalized = subData.utrNormalized || normalizeUtr(subData.utrNumber);
    const utrRef = db.collection('payment_utrs').doc(utrNormalized);

    transaction.update(subRef, {
      status: 'rejected',
      rejectionReason: trimmedReason,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy: staffUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(utrRef, {
      status: 'rejected',
      rejectionReason: trimmedReason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(orderRef, {
      paymentStatus: 'rejected',
      rejectionReason: trimmedReason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const histRef = orderRef.collection('orderStatusHistory').doc();
    transaction.set(histRef, {
      fromStatus: 'pending_verification',
      toStatus: 'rejected',
      changedBy: staffUid,
      changedByRole: role,
      remarks: `Payment proof rejected: ${trimmedReason}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // 3. Send Notification to Customer
  try {
    await db.collection('users').doc(resolvedCustomerId).collection('notifications').add({
      title: 'Payment Verification Rejected ⚠️',
      message: `Payment proof for PO #${resolvedOrderRef} could not be verified: ${trimmedReason}. Please check and resubmit.`,
      type: 'payment_rejected',
      orderId: resolvedOrderId,
      submissionId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[PaymentEngine] Error sending rejection notification:', err);
  }

  return { success: true, orderId: resolvedOrderId, status: 'rejected' };
});
