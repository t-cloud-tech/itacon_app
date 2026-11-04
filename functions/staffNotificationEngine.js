/**
 * functions/staffNotificationEngine.js
 *
 * ITACON Management Portal — Notification Engine (2nd Gen, region: asia-south1)
 *
 * Provides:
 * 1. Instant Event Triggers:
 *    - onClientAssignedNotification: Customer assigned / reassigned / unassigned
 *    - onOrderCreatedNotification: New PO Request (Awaiting Quote) & lastOrderAt updates
 *    - onPaymentSubmissionNotification: Payment submitted (UTR), verified, or rejected
 *    - onLeadAssignedNotification: Admin assigns or reassigns lead to salesperson
 * 2. Scheduled Daily Reminders & Cleanup:
 *    - dailyStaffRemindersScheduled (Every day at 09:00 Asia/Kolkata)
 *    - runNotificationCheck: Admin callable with { dryRun: true }
 * 3. Web Push Notification Trigger:
 *    - sendPushOnStaffNotification (FCM push to staff devices with automatic token pruning)
 */

const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp(process.env.FIREBASE_CONFIG ? undefined : { projectId: 'itacon-app' });
}

const REGION = 'asia-south1';

/**
 * Parses any Firestore timestamp, string, or number to a JavaScript Date object.
 */
function parseDate(val) {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000);
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Returns the current date in Asia/Kolkata timezone formatted as YYYY-MM-DD.
 */
function getKolkataDateString(date = new Date()) {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(date);
}

/**
 * Checks if a user is a staff member.
 */
function isStaffUser(data) {
  if (!data) return false;
  const role = (data.role || '').toLowerCase().trim();
  const cat = (data.userCategory || '').toLowerCase().trim();
  return (
    role === 'salesperson' ||
    role === 'admin' ||
    role === 'manager' ||
    role === 'staff' ||
    role === 'superadmin' ||
    role === 'super_admin' ||
    role === 'designer' ||
    cat === 'salesperson' ||
    cat === 'admin' ||
    cat === 'manager' ||
    Boolean(data.designerId)
  );
}

/**
 * Fetches all active admin UIDs from the users collection.
 */
async function getActiveAdminUids(db) {
  const adminsSnap = await db.collection('users')
    .where('role', 'in', ['admin', 'superadmin', 'super_admin', 'manager'])
    .get();

  const admins = [];
  adminsSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const status = (data.status || 'active').toLowerCase().trim();
    if (status !== 'inactive' && status !== 'blocked') {
      admins.push({
        uid: doc.id,
        name: data.name || data.fullName || 'Administrator',
        role: data.role || 'admin',
      });
    }
  });

  return admins;
}

/**
 * Atomically creates a staff notification document if a duplicate dedupeKey does not exist.
 * Deterministic doc ID: `${recipientUid}_${dedupeKey}` ensures zero duplicate writes.
 */
async function createNotificationIfNew(db, notifData, dryRun = false) {
  if (!notifData.recipientUid || !notifData.dedupeKey) {
    logger.warn('[NotificationEngine] Missing recipientUid or dedupeKey', notifData);
    return null;
  }

  // Safe doc ID: replace slashes and spaces
  const safeDedupe = String(notifData.dedupeKey).replace(/[\/\s]/g, '_');
  const docId = `${notifData.recipientUid}_${safeDedupe}`;
  const notifRef = db.collection('staffNotifications').doc(docId);

  if (dryRun) {
    return { id: docId, ...notifData, isDryRun: true };
  }

  const existingDoc = await notifRef.get();
  if (existingDoc.exists) {
    return null; // Already delivered
  }

  const payload = {
    recipientUid: notifData.recipientUid,
    recipientRole: notifData.recipientRole || 'salesperson',
    type: notifData.type,
    title: notifData.title,
    body: notifData.body,
    link: notifData.link || '/',
    refs: notifData.refs || {},
    priority: notifData.priority || 'normal',
    read: false,
    readAt: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    dedupeKey: notifData.dedupeKey,
    skipIndividualPush: Boolean(notifData.skipIndividualPush),
  };

  await notifRef.set(payload);
  return { id: docId, ...payload };
}

// =============================================================================
// 1. INSTANT FIRESTORE TRIGGERS
// =============================================================================

/**
 * Trigger: onClientAssignedNotification
 * Fires when a customer document in users/{userId} is written.
 * Notifies the assigned salesperson ("New customer: <firm>") or admins if unassigned.
 */
exports.onClientAssignedNotification = onDocumentWritten(
  {
    document: 'users/{userId}',
    region: REGION,
  },
  async (event) => {
    if (!event.data) return;
    const db = admin.firestore();
    const userId = event.params.userId;
    const after = event.data.after.data();
    const before = event.data.before ? event.data.before.data() : null;

    if (!after || isStaffUser(after)) {
      return; // Skip staff profiles
    }

    const newSpId = (after.salesPersonId || after.assignedSalespersonId || '').toString().trim();
    const oldSpId = before ? (before.salesPersonId || before.assignedSalespersonId || '').toString().trim() : '';

    const firmName = after.companyName || after.businessName || after.firmName || after.name || after.fullName || 'New Client';
    const isNew = !before;
    const hasSpChanged = isNew ? Boolean(newSpId) : (newSpId && newSpId !== oldSpId);

    if (hasSpChanged) {
      await createNotificationIfNew(db, {
        recipientUid: newSpId,
        recipientRole: 'salesperson',
        type: 'customer_assigned',
        title: 'New Customer Assigned',
        body: `New customer: ${firmName}`,
        link: `/customers/${userId}`,
        refs: { customerId: userId },
        priority: 'normal',
        dedupeKey: `custAssigned_${userId}_${newSpId}`,
      });
      logger.info(`[NotificationEngine:CustomerAssigned] Notified salesperson ${newSpId} for customer ${userId}`);
    } else if (isNew && !newSpId) {
      // Customer registered with no salesperson -> notify admins
      const admins = await getActiveAdminUids(db);
      for (const adminUser of admins) {
        await createNotificationIfNew(db, {
          recipientUid: adminUser.uid,
          recipientRole: adminUser.role,
          type: 'customer_assigned',
          title: 'New Unassigned Customer',
          body: `New customer with no salesperson: ${firmName}`,
          link: `/customers/${userId}`,
          refs: { customerId: userId },
          priority: 'normal',
          dedupeKey: `custUnassigned_${userId}`,
        });
      }
      logger.info(`[NotificationEngine:CustomerAssigned] Notified admins for unassigned customer ${userId}`);
    }
  }
);

/**
 * Trigger: onOrderCreatedNotification
 * Fires when an order in orders/{orderId} is written.
 * 1. If Awaiting Quote (pending_rate / submitted / pending_quote): notifies salesperson + admins.
 * 2. Updates customer's lastOrderAt field.
 */
exports.onOrderCreatedNotification = onDocumentWritten(
  {
    document: 'orders/{orderId}',
    region: REGION,
  },
  async (event) => {
    if (!event.data) return;
    const db = admin.firestore();
    const orderId = event.params.orderId;
    const after = event.data.after.data();
    const before = event.data.before ? event.data.before.data() : null;

    if (!after) return;

    const customerId = (after.userId || after.customerId || '').trim();
    const orderRef = after.orderReference || after.poNumber || orderId;
    const clientName = after.companyName || after.customerName || after.name || 'Valued Client';
    const status = (after.status || 'pending_rate').toLowerCase().trim();
    const oldStatus = before ? (before.status || '').toLowerCase().trim() : '';

    // 1. Maintain customer's lastOrderAt field
    if (customerId) {
      const orderDate = parseDate(after.createdAt) || new Date();
      try {
        const userRef = db.collection('users').doc(customerId);
        const userDoc = await userRef.get();
        if (userDoc.exists && !isStaffUser(userDoc.data())) {
          const currentLast = parseDate(userDoc.data().lastOrderAt);
          if (!currentLast || orderDate > currentLast) {
            await userRef.update({
              lastOrderAt: orderDate.toISOString(),
            });
            logger.info(`[NotificationEngine:lastOrderAt] Updated customer ${customerId} lastOrderAt = ${orderDate.toISOString()}`);
          }
        }
      } catch (err) {
        logger.warn(`[NotificationEngine:lastOrderAt] Failed to update lastOrderAt for ${customerId}:`, err);
      }
    }

    // 2. Client PO Request (Awaiting Quote) notification
    const isAwaitingQuote = status === 'pending_rate' || status === 'submitted' || status === 'pending_quote';
    const transitionedToAwaiting = !before || (isAwaitingQuote && oldStatus !== status);

    if (isAwaitingQuote && transitionedToAwaiting) {
      const spId = (after.salesPersonId || after.salespersonId || '').toString().trim();
      const dedupeKey = `poRequest_${orderId}_awaitingQuote`;

      // Notify assigned salesperson
      if (spId) {
        await createNotificationIfNew(db, {
          recipientUid: spId,
          recipientRole: 'salesperson',
          type: 'po_request',
          title: 'New PO Request',
          body: `PO Request for ${clientName} (${orderRef}) — Awaiting Quote`,
          link: `/orders?search=${encodeURIComponent(orderRef)}`,
          refs: { orderId, customerId },
          priority: 'normal',
          dedupeKey,
        });
      }

      // Notify admins
      const admins = await getActiveAdminUids(db);
      for (const adminUser of admins) {
        await createNotificationIfNew(db, {
          recipientUid: adminUser.uid,
          recipientRole: adminUser.role,
          type: 'po_request',
          title: 'New Client PO Request',
          body: `New PO from ${clientName} (${orderRef}) — Awaiting Quote`,
          link: `/orders?search=${encodeURIComponent(orderRef)}`,
          refs: { orderId, customerId },
          priority: 'normal',
          dedupeKey,
        });
      }
      logger.info(`[NotificationEngine:PORequest] Dispatched awaiting quote notification for order ${orderId}`);
    }
  }
);

/**
 * Trigger: onPaymentSubmissionNotification
 * Fires when paymentSubmissions/{subId} is written.
 * - Created (pending_verification): Salesperson + Admins (High priority for admins: "Verify payment")
 * - Status verified: Salesperson
 * - Status rejected: Salesperson (High priority)
 */
exports.onPaymentSubmissionNotification = onDocumentWritten(
  {
    document: 'paymentSubmissions/{subId}',
    region: REGION,
  },
  async (event) => {
    if (!event.data) return;
    const db = admin.firestore();
    const subId = event.params.subId;
    const after = event.data.after.data();
    const before = event.data.before ? event.data.before.data() : null;

    if (!after) return;

    const orderId = after.orderId;
    let orderRef = after.orderReference || orderId;
    let spId = (after.salesPersonId || '').toString().trim();
    let customerName = after.customerName || 'Customer';

    // Lookup order to get accurate salesperson and customer details
    if (orderId && (!spId || !orderRef)) {
      try {
        const oDoc = await db.collection('orders').doc(orderId).get();
        if (oDoc.exists) {
          const oData = oDoc.data() || {};
          orderRef = oData.orderReference || oData.poNumber || orderId;
          spId = spId || (oData.salesPersonId || oData.salespersonId || '').toString().trim();
          customerName = oData.companyName || oData.customerName || customerName;
        }
      } catch (err) {
        logger.warn('[NotificationEngine:PaymentSub] Order lookup error:', err);
      }
    }

    const amount = Number(after.submittedAmount || after.expectedAmount || 0).toLocaleString('en-IN');
    const utr = after.utrNumber || after.utrNormalized || 'UTR';
    const status = (after.status || 'pending_verification').toLowerCase().trim();
    const oldStatus = before ? (before.status || '').toLowerCase().trim() : '';

    // CASE 1: Payment Submitted (Newly created or entered pending_verification)
    if (status === 'pending_verification' && (!before || oldStatus !== 'pending_verification')) {
      const link = `/orders?tab=payments&search=${encodeURIComponent(utr)}`;

      // 1. Notify salesperson
      if (spId) {
        await createNotificationIfNew(db, {
          recipientUid: spId,
          recipientRole: 'salesperson',
          type: 'payment_submitted',
          title: 'Payment Submitted',
          body: `Payment of ₹${amount} (UTR: ${utr}) submitted for Order ${orderRef}`,
          link,
          refs: { orderId, customerId: after.customerId },
          priority: 'normal',
          dedupeKey: `paySubmitted_${subId}`,
        });
      }

      // 2. Notify admins (high priority)
      const admins = await getActiveAdminUids(db);
      for (const adminUser of admins) {
        await createNotificationIfNew(db, {
          recipientUid: adminUser.uid,
          recipientRole: adminUser.role,
          type: 'payment_submitted',
          title: 'Verify Payment',
          body: `₹${amount} submitted for ${customerName} (UTR: ${utr}). Please verify.`,
          link,
          refs: { orderId, customerId: after.customerId },
          priority: 'high',
          dedupeKey: `paySubmittedAdmin_${subId}`,
        });
      }
      logger.info(`[NotificationEngine:Payment] Notified payment submission ${subId}`);
    }

    // CASE 2: Payment Verified
    if (status === 'verified' && oldStatus !== 'verified') {
      if (spId) {
        await createNotificationIfNew(db, {
          recipientUid: spId,
          recipientRole: 'salesperson',
          type: 'payment_verified',
          title: 'Payment Verified',
          body: `Payment of ₹${amount} verified for Order ${orderRef}`,
          link: `/orders?tab=payments&search=${encodeURIComponent(utr)}`,
          refs: { orderId, customerId: after.customerId },
          priority: 'normal',
          dedupeKey: `payVerified_${subId}`,
        });
      }
      logger.info(`[NotificationEngine:PaymentVerified] Notified salesperson ${spId} for ${subId}`);
    }

    // CASE 3: Payment Rejected
    if (status === 'rejected' && oldStatus !== 'rejected') {
      const reason = after.rejectionReason ? ` Reason: ${after.rejectionReason}` : '';
      if (spId) {
        await createNotificationIfNew(db, {
          recipientUid: spId,
          recipientRole: 'salesperson',
          type: 'payment_rejected',
          title: 'Payment Rejected',
          body: `Payment of ₹${amount} rejected for Order ${orderRef}.${reason}`,
          link: `/orders?tab=payments&search=${encodeURIComponent(utr)}`,
          refs: { orderId, customerId: after.customerId },
          priority: 'high',
          dedupeKey: `payRejected_${subId}`,
        });
      }
      logger.info(`[NotificationEngine:PaymentRejected] Notified salesperson ${spId} for ${subId}`);
    }
  }
);

/**
 * Trigger: onLeadAssignedNotification
 * Fires when leads/{leadId} is written.
 * Notifies the new salesperson when a lead is assigned or reassigned.
 */
exports.onLeadAssignedNotification = onDocumentWritten(
  {
    document: 'leads/{leadId}',
    region: REGION,
  },
  async (event) => {
    if (!event.data) return;
    const db = admin.firestore();
    const leadId = event.params.leadId;
    const after = event.data.after.data();
    const before = event.data.before ? event.data.before.data() : null;

    if (!after) return;

    const newSpId = (after.assignedSalespersonId || '').toString().trim();
    const oldSpId = before ? (before.assignedSalespersonId || '').toString().trim() : '';

    if (!newSpId) return;

    const isNew = !before;
    const isReassigned = before && newSpId !== oldSpId;

    if (isNew || isReassigned) {
      const leadName = after.name || 'New Lead';
      const company = after.companyName ? ` (${after.companyName})` : '';

      await createNotificationIfNew(db, {
        recipientUid: newSpId,
        recipientRole: 'salesperson',
        type: 'lead_assigned',
        title: isReassigned ? 'Lead Reassigned to You' : 'New Lead Assigned',
        body: `Lead: ${leadName}${company}`,
        link: `/leads/${leadId}`,
        refs: { leadId },
        priority: 'normal',
        dedupeKey: `leadAssign_${leadId}_${newSpId}`,
      });
      logger.info(`[NotificationEngine:LeadAssigned] Notified salesperson ${newSpId} for lead ${leadId}`);
    }
  }
);

// =============================================================================
// 2. DAILY REMINDERS CORE ENGINE & SCHEDULER
// =============================================================================

/**
 * Core daily reminder checks implementation.
 * Runs both during scheduled 09:00 IST invocation AND via the runNotificationCheck callable.
 */
async function executeDailyNotificationCheck(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const db = admin.firestore();
  const now = new Date();
  const todayYmd = getKolkataDateString(now);
  const currentMonthYm = todayYmd.slice(0, 7); // YYYY-MM

  logger.info(`[DailyNotificationCheck] Starting check for ${todayYmd} (dryRun: ${dryRun})`);

  // 1. Load config/notificationSettings
  let settings = {
    inactiveDays: [30, 60, 90],
    firstOrderDays: 7,
    paymentPendingDays: [2, 5, 7],
    adminPaymentEscalationDay: 7,
    retentionDays: 90,
  };

  try {
    const sDoc = await db.collection('config').doc('notificationSettings').get();
    if (sDoc.exists) {
      settings = { ...settings, ...sDoc.data() };
    }
  } catch (err) {
    logger.warn('[DailyNotificationCheck] Could not load settings doc, using defaults', err);
  }

  const generatedNotifications = [];
  const counts = {
    poApprovedUnpaid: 0,
    paymentOverdue: 0,
    customerInactive: 0,
    noFirstOrder: 0,
    followUpDue: 0,
    adminWeeklySummary: 0,
    total: 0,
  };

  const admins = await getActiveAdminUids(db);

  // ---------------------------------------------------------------------------
  // A. PO approved but no payment submitted for 2, 5, or 7 days
  // ---------------------------------------------------------------------------
  try {
    const ordersSnap = await db.collection('orders').get();

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const status = (order.status || '').toLowerCase().trim();
      const paymentStatus = (order.paymentStatus || '').toLowerCase().trim();

      const isApproved = status === 'approved' || status === 'confirmed' || status === 'pending_salesperson_review';
      const isUnpaid = paymentStatus !== 'paid';

      if (!isApproved || !isUnpaid) continue;

      const orderDate = parseDate(order.adminApprovedAt) || parseDate(order.createdAt) || parseDate(order.confirmedAt);
      if (!orderDate) continue;

      const elapsedDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      const spId = (order.salesPersonId || order.salespersonId || '').toString().trim();
      const orderRef = order.orderReference || order.poNumber || doc.id;
      const firm = order.companyName || order.customerName || 'Client';

      if (settings.paymentPendingDays.includes(elapsedDays)) {
        const isEscalation = elapsedDays >= settings.adminPaymentEscalationDay;
        const priority = isEscalation ? 'high' : 'normal';

        // Notify Salesperson
        if (spId) {
          const n = await createNotificationIfNew(db, {
            recipientUid: spId,
            recipientRole: 'salesperson',
            type: 'po_approved_unpaid',
            title: `Payment Pending (Day ${elapsedDays})`,
            body: `Order ${orderRef} for ${firm} approved ${elapsedDays} days ago; payment not received.`,
            link: `/orders?search=${encodeURIComponent(orderRef)}`,
            refs: { orderId: doc.id, customerId: order.userId || order.customerId },
            priority,
            dedupeKey: `payPending_${doc.id}_day${elapsedDays}`,
            skipIndividualPush: true,
          }, dryRun);

          if (n) {
            generatedNotifications.push(n);
            counts.poApprovedUnpaid++;
          }
        }

        // Notify Admins on Day 7 escalation
        if (isEscalation) {
          for (const a of admins) {
            const n = await createNotificationIfNew(db, {
              recipientUid: a.uid,
              recipientRole: a.role,
              type: 'po_approved_unpaid',
              title: `Payment Pending Escalation (Day ${elapsedDays})`,
              body: `Order ${orderRef} for ${firm} approved ${elapsedDays} days ago and unpaid.`,
              link: `/orders?search=${encodeURIComponent(orderRef)}`,
              refs: { orderId: doc.id, customerId: order.userId || order.customerId },
              priority: 'high',
              dedupeKey: `payPendingAdmin_${doc.id}_day${elapsedDays}`,
              skipIndividualPush: true,
            }, dryRun);

            if (n) {
              generatedNotifications.push(n);
              counts.poApprovedUnpaid++;
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error('[DailyNotificationCheck:POApprovedUnpaid] Error:', err);
  }

  // ---------------------------------------------------------------------------
  // B. Credit-term orders past the due date and unpaid
  // ---------------------------------------------------------------------------
  let overdueOrdersCount = 0;
  try {
    const ordersSnap = await db.collection('orders').get();

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const terms = (order.paymentTerms || '').toLowerCase();
      const paymentStatus = (order.paymentStatus || '').toLowerCase().trim();

      if (paymentStatus === 'paid') continue;

      let termDays = 0;
      if (terms.includes('30')) termDays = 30;
      else if (terms.includes('45')) termDays = 45;
      else if (terms.includes('60')) termDays = 60;

      if (termDays === 0) continue;

      const baseDate = parseDate(order.confirmedAt) || parseDate(order.createdAt);
      if (!baseDate) continue;

      const dueDate = new Date(baseDate.getTime() + termDays * 24 * 60 * 60 * 1000);
      if (now > dueDate) {
        overdueOrdersCount++;
        const overdueDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const dueDateFormatted = dueDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
        const unpaidAmount = Number(order.grandTotal || order.totalAmount || 0).toLocaleString('en-IN');
        const orderRef = order.orderReference || order.poNumber || doc.id;
        const firm = order.companyName || order.customerName || 'Client';
        const spId = (order.salesPersonId || order.salespersonId || '').toString().trim();

        const notifPayload = {
          type: 'payment_overdue',
          title: 'Payment Overdue',
          body: `Payment overdue: ₹${unpaidAmount} since ${dueDateFormatted} (${overdueDays} days late) for ${firm}`,
          link: `/orders?search=${encodeURIComponent(orderRef)}`,
          refs: { orderId: doc.id, customerId: order.userId || order.customerId },
          priority: 'high',
          dedupeKey: `overdue_${doc.id}_${todayYmd}`,
          skipIndividualPush: true,
        };

        // Notify salesperson
        if (spId) {
          const n = await createNotificationIfNew(db, {
            ...notifPayload,
            recipientUid: spId,
            recipientRole: 'salesperson',
          }, dryRun);
          if (n) {
            generatedNotifications.push(n);
            counts.paymentOverdue++;
          }
        }

        // Notify admins
        for (const a of admins) {
          const n = await createNotificationIfNew(db, {
            ...notifPayload,
            recipientUid: a.uid,
            recipientRole: a.role,
          }, dryRun);
          if (n) {
            generatedNotifications.push(n);
            counts.paymentOverdue++;
          }
        }
      }
    }
  } catch (err) {
    logger.error('[DailyNotificationCheck:PaymentOverdue] Error:', err);
  }

  // ---------------------------------------------------------------------------
  // C. Inactive Customers (30 / 60 / 90 days) & No First Order (7 days)
  // ---------------------------------------------------------------------------
  let inactiveCustomersCount = 0;
  try {
    const usersSnap = await db.collection('users').get();

    for (const doc of usersSnap.docs) {
      const user = doc.data() || {};
      if (isStaffUser(user)) continue;

      const custId = doc.id;
      const firm = user.companyName || user.businessName || user.firmName || user.name || 'Client';
      const spId = (user.salesPersonId || user.assignedSalespersonId || '').toString().trim();
      const recipients = spId ? [{ uid: spId, role: 'salesperson' }] : admins;

      const lastOrderDate = parseDate(user.lastOrderAt);

      if (lastOrderDate) {
        // Customer has placed orders in the past -> check inactivity
        const inactiveDays = Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));

        if (inactiveDays >= 30) {
          inactiveCustomersCount++;
        }

        // Determine applicable milestone: 90, 60, 30
        let milestone = 0;
        if (inactiveDays >= 90) milestone = 90;
        else if (inactiveDays >= 60) milestone = 60;
        else if (inactiveDays >= 30) milestone = 30;

        if (milestone > 0) {
          for (const r of recipients) {
            const n = await createNotificationIfNew(db, {
              recipientUid: r.uid,
              recipientRole: r.role,
              type: 'customer_inactive',
              title: `No Order in ${milestone} Days`,
              body: `No order in ${milestone} days: ${firm}`,
              link: `/customers/${custId}`,
              refs: { customerId: custId },
              priority: 'normal',
              dedupeKey: `inactive_${milestone}_${custId}_${currentMonthYm}`,
              skipIndividualPush: true,
            }, dryRun);

            if (n) {
              generatedNotifications.push(n);
              counts.customerInactive++;
            }
          }
        }
      } else {
        // Customer has no order -> check 7 days after joining
        const createdDate = parseDate(user.createdAt);
        if (createdDate) {
          const joinedDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          // Between day 7 and day 14
          if (joinedDays >= settings.firstOrderDays && joinedDays < settings.firstOrderDays + 7) {
            for (const r of recipients) {
              const n = await createNotificationIfNew(db, {
                recipientUid: r.uid,
                recipientRole: r.role,
                type: 'no_first_order',
                title: 'No First Order Yet',
                body: `No first order yet: ${firm}`,
                link: `/customers/${custId}`,
                refs: { customerId: custId },
                priority: 'normal',
                dedupeKey: `noFirstOrder_${custId}`,
                skipIndividualPush: true,
              }, dryRun);

              if (n) {
                generatedNotifications.push(n);
                counts.noFirstOrder++;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error('[DailyNotificationCheck:Customers] Error:', err);
  }

  // ---------------------------------------------------------------------------
  // D. Follow-ups Due Today
  // ---------------------------------------------------------------------------
  try {
    const fuSnap = await db.collection('followUps')
      .where('dueDate', '==', todayYmd)
      .get();

    for (const doc of fuSnap.docs) {
      const fu = doc.data();
      const status = (fu.status || 'scheduled').toLowerCase().trim();
      if (status !== 'scheduled') continue;

      const spId = (fu.salespersonId || '').toString().trim();
      if (!spId) continue;

      const target = fu.targetName || 'Client Follow-up';
      const type = (fu.type || 'activity').toUpperCase();
      const time = fu.dueTime ? ` at ${fu.dueTime}` : '';

      const n = await createNotificationIfNew(db, {
        recipientUid: spId,
        recipientRole: 'salesperson',
        type: 'follow_up_due',
        title: 'Follow-up Due Today',
        body: `${type}: ${target}${time}`,
        link: '/follow-ups',
        refs: { followUpId: doc.id },
        priority: 'normal',
        dedupeKey: `followUp_${doc.id}_${todayYmd}`,
        skipIndividualPush: true,
      }, dryRun);

      if (n) {
        generatedNotifications.push(n);
        counts.followUpDue++;
      }
    }
  } catch (err) {
    logger.error('[DailyNotificationCheck:FollowUps] Error:', err);
  }

  // ---------------------------------------------------------------------------
  // E. Mondays: Admin Weekly Account Digest Summary
  // ---------------------------------------------------------------------------
  const kolkataDay = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay();
  const isMonday = kolkataDay === 1;

  if (isMonday) {
    const summaryText = `${inactiveCustomersCount} customers inactive 30+ days, ${overdueOrdersCount} payments overdue`;
    for (const a of admins) {
      const n = await createNotificationIfNew(db, {
        recipientUid: a.uid,
        recipientRole: a.role,
        type: 'admin_weekly_summary',
        title: 'Weekly Account Digest',
        body: summaryText,
        link: '/customers',
        refs: {},
        priority: 'normal',
        dedupeKey: `adminWeekly_${todayYmd}`,
        skipIndividualPush: true,
      }, dryRun);

      if (n) {
        generatedNotifications.push(n);
        counts.adminWeeklySummary++;
      }
    }
  }

  // Total counts
  counts.total = generatedNotifications.length;

  // ---------------------------------------------------------------------------
  // F. Retention Cleanup (delete notifications older than retentionDays)
  // ---------------------------------------------------------------------------
  if (!dryRun) {
    try {
      const retentionDays = Number(settings.retentionDays) || 90;
      const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

      const oldSnap = await db.collection('staffNotifications')
        .where('createdAt', '<', cutoffDate)
        .limit(200)
        .get();

      if (!oldSnap.empty) {
        const batch = db.batch();
        oldSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        logger.info(`[DailyNotificationCheck:Cleanup] Purged ${oldSnap.size} notifications older than ${retentionDays} days.`);
      }
    } catch (err) {
      logger.warn('[DailyNotificationCheck:Cleanup] Error cleaning retention:', err);
    }

    // -------------------------------------------------------------------------
    // G. Grouped Push Notifications for Daily Reminders
    // -------------------------------------------------------------------------
    // Instead of sending 5 individual pushes, send ONE consolidated push per recipient
    const recipientGroups = new Map();
    generatedNotifications.forEach((notif) => {
      const uid = notif.recipientUid;
      if (!recipientGroups.has(uid)) recipientGroups.set(uid, []);
      recipientGroups.get(uid).push(notif);
    });

    for (const [uid, notifs] of recipientGroups.entries()) {
      if (notifs.length === 0) continue;
      try {
        const tokensSnap = await db.collection('staffDevices').doc(uid).collection('tokens').get();
        if (tokensSnap.empty) continue;

        const tokens = tokensSnap.docs.map((d) => d.id);
        const count = notifs.length;
        const highPriority = notifs.some((n) => n.priority === 'high');

        const pushTitle = count === 1 ? notifs[0].title : `You have ${count} reminders today`;
        const pushBody = count === 1
          ? notifs[0].body
          : notifs.map((n) => n.title).slice(0, 3).join(' • ') + (count > 3 ? ` (+${count - 3} more)` : '');

        const message = {
          tokens,
          notification: {
            title: pushTitle,
            body: pushBody,
          },
          data: {
            link: '/notifications',
            type: 'daily_reminder_digest',
            priority: highPriority ? 'high' : 'normal',
          },
          webpush: {
            headers: {
              Urgency: highPriority ? 'high' : 'normal',
            },
            fcmOptions: {
              link: '/notifications',
            },
          },
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Prune invalid tokens
        response.responses.forEach(async (res, idx) => {
          if (!res.success) {
            const errCode = res.error?.code;
            if (
              errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/invalid-registration-token'
            ) {
              await db.collection('staffDevices').doc(uid).collection('tokens').doc(tokens[idx]).delete();
              logger.info(`[NotificationEngine:FCM] Pruned invalid token ${tokens[idx]} for user ${uid}`);
            }
          }
        });
      } catch (fcmErr) {
        logger.warn(`[DailyNotificationCheck:FCM] Failed to send digest push to ${uid}:`, fcmErr);
      }
    }
  }

  logger.info(`[DailyNotificationCheck] Completed check for ${todayYmd}. Generated ${counts.total} notifications.`);

  return {
    dryRun,
    date: todayYmd,
    counts,
    summary: {
      inactiveCustomersCount,
      overdueOrdersCount,
      isMonday,
    },
    sampleNotifications: generatedNotifications.slice(0, 5),
  };
}

/**
 * Scheduled Cloud Function: dailyStaffRemindersScheduled
 * Runs every day at 09:00 Asia/Kolkata
 */
exports.dailyStaffRemindersScheduled = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'Asia/Kolkata',
    region: REGION,
  },
  async () => {
    await executeDailyNotificationCheck({ dryRun: false });
  }
);

/**
 * Admin-only Callable: runNotificationCheck
 * Usage from client or test script:
 *   const result = await runNotificationCheck({ dryRun: true });
 */
exports.runNotificationCheck = onCall(
  {
    region: REGION,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const callerUid = request.auth.uid;
    const db = admin.firestore();

    // Verify admin role
    const userDoc = await db.collection('users').doc(callerUid).get();
    const userData = userDoc.data() || {};
    const role = (userData.role || '').toLowerCase().trim();
    const isAdmin = ['admin', 'superadmin', 'super_admin', 'manager'].includes(role) || request.auth.token.admin === true;

    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Only administrators can run notification checks.');
    }

    const dryRun = request.data?.dryRun !== false;
    return await executeDailyNotificationCheck({ dryRun });
  }
);

// =============================================================================
// 3. PUSH NOTIFICATION TRIGGER (FCM WEB PUSH)
// =============================================================================

/**
 * Trigger: sendPushOnStaffNotification
 * Fires when a new notification is added to staffNotifications/{notifId}.
 * Sends instant push notification to recipient's registered web devices.
 */
exports.sendPushOnStaffNotification = onDocumentCreated(
  {
    document: 'staffNotifications/{notifId}',
    region: REGION,
  },
  async (event) => {
    if (!event.data) return;
    const notif = event.data.data();
    const notifId = event.params.notifId;

    if (!notif || !notif.recipientUid) return;

    // If daily reminders were already grouped into a single digest push, skip individual push
    if (notif.skipIndividualPush === true) {
      return;
    }

    const db = admin.firestore();
    const uid = notif.recipientUid;

    try {
      const tokensSnap = await db.collection('staffDevices').doc(uid).collection('tokens').get();
      if (tokensSnap.empty) {
        return; // User has no registered devices for web push
      }

      const tokens = tokensSnap.docs.map((d) => d.id);
      const isHigh = notif.priority === 'high';

      const message = {
        tokens,
        notification: {
          title: notif.title || 'ITACON Management',
          body: notif.body || '',
        },
        data: {
          notifId: notifId,
          link: notif.link || '/',
          type: notif.type || 'general',
          priority: notif.priority || 'normal',
        },
        webpush: {
          headers: {
            Urgency: isHigh ? 'high' : 'normal',
          },
          fcmOptions: {
            link: notif.link || '/',
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Clean up invalid / unregistered tokens
      response.responses.forEach(async (res, idx) => {
        if (!res.success) {
          const errCode = res.error?.code;
          if (
            errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token'
          ) {
            await db.collection('staffDevices').doc(uid).collection('tokens').doc(tokens[idx]).delete();
            logger.info(`[NotificationEngine:FCM] Pruned invalid token ${tokens[idx]} for user ${uid}`);
          }
        }
      });

      logger.info(`[NotificationEngine:FCM] Sent instant push for ${notifId} to ${response.successCount}/${tokens.length} devices.`);
    } catch (err) {
      logger.error(`[NotificationEngine:FCM] Failed sending push for ${notifId}:`, err);
    }
  }
);

// Export core function for direct invocation by tests or CLI
exports.executeDailyNotificationCheck = executeDailyNotificationCheck;
