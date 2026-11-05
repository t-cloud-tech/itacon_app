/**
 * functions/staffNotificationEngine.js
 *
 * ITACON Management Portal — Notification Engine (2nd Gen, region: asia-south1)
 *
 * Provides:
 * 1. RBAC Recipient Resolution:
 *    - resolveRecipients(db, type, refs): Centralized recipient routing adhering to:
 *      * RULE A: Active admins get all notifications across all customers, leads, orders, and payments.
 *      * RULE B: Employees (salespersons) get ONLY their own assigned items.
 *      * RULE C: Designers get NO sales/customer/payment/lead notifications.
 *      * ADMIN-ONLY types: Strictly forbidden for non-admins (enforced with error logging).
 *      * DEDUPLICATION: If an admin is also the assigned salesperson, exactly ONE copy is sent.
 *      * Never broadcasts to "all salespersons" or "all staff".
 * 2. Instant Event Triggers:
 *    - onClientAssignedNotification: Customer assigned / reassigned (NEVER on document CREATE / signup)
 *    - onOrderCreatedNotification: New PO Request (Awaiting Quote) & lastOrderAt updates
 *    - onPaymentSubmissionNotification: Payment submitted (UTR), verified, or rejected
 *    - onLeadAssignedNotification: Admin assigns or reassigns lead to salesperson
 * 3. Scheduled Daily Reminders & Cleanup:
 *    - dailyStaffRemindersScheduled (Every day at 09:00 Asia/Kolkata)
 *    - runNotificationCheck: Admin callable with { dryRun: true }
 * 4. Web Push Notification Trigger:
 *    - sendPushOnStaffNotification: FCM push using production PORTAL_BASE_URL (never localhost),
 *      skipping & pruning localhost tokens, and grouping bursts (>3 within 60s for admins).
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
 * Production Portal Base URL used for push notification deep links.
 * Always absolute production URL for FCM clicks; relative paths stored in Firestore docs.
 */
const PORTAL_BASE_URL = (process.env.PORTAL_BASE_URL || 'https://portal.itacon.in').replace(/\/$/, '');

/**
 * Admin-only notification types that must NEVER be dispatched to any employee or non-admin.
 */
const ADMIN_ONLY_TYPES = new Set([
  'customer_unassigned_24h',
  'payment_action_verify',
  'admin_weekly_summary',
  'system_alert',
]);

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
 * Helper to check whether a role string or category belongs to an admin-level user.
 * Recognizes: admin, superadmin, super_admin, manager.
 */
function isAdminRole(role, userCategory) {
  const r = (role || '').toLowerCase().trim();
  const c = (userCategory || '').toLowerCase().trim();
  return (
    r === 'admin' ||
    r === 'superadmin' ||
    r === 'super_admin' ||
    r === 'manager' ||
    c === 'admin' ||
    c === 'manager'
  );
}

/**
 * Helper to check whether user is a designer.
 * RULE C: Designers get NO sales/customer/payment/lead notifications.
 */
function isDesignerUser(data) {
  if (!data) return false;
  const r = (data.role || '').toLowerCase().trim();
  const c = (data.userCategory || '').toLowerCase().trim();
  return r === 'designer' || c === 'designer' || Boolean(data.designerId);
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
  const usersSnap = await db.collection('users').get();
  const admins = [];

  usersSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const status = (data.status || 'active').toLowerCase().trim();
    if (status !== 'inactive' && status !== 'blocked') {
      if (isAdminRole(data.role, data.userCategory)) {
        admins.push({
          uid: doc.id,
          name: data.name || data.fullName || 'Administrator',
          role: data.role || 'admin',
          audience: 'admin',
        });
      }
    }
  });

  return admins;
}

/**
 * Centralized Recipient Resolution Function used across ALL triggers and daily scheduled jobs.
 *
 * Enforces:
 * - RULE A: Admins get EVERYTHING across all customers, leads, orders, and payments.
 * - RULE B: Employees (salespersons) get ONLY their own assigned items.
 * - RULE C: Designers get NO sales/customer/payment/lead notifications.
 * - ADMIN-ONLY types: Strictly forbidden for non-admins (refuses & logs error).
 * - DEDUPLICATION: If an admin is also the assigned salesperson, exactly ONE copy is delivered.
 * - CURRENT DATA: Always evaluates current salesperson assignment at send time.
 * - NO BROADCAST: Never broadcasts to all salespersons or all staff.
 * - CUSTOMER WITHOUT SALESPERSON: Routes to admins only.
 *
 * @param {admin.firestore.Firestore} db
 * @param {string} type Notification type
 * @param {object} refs Entity references and payload data
 * @returns {Promise<Array<{ uid: string, role: string, audience: 'admin'|'salesperson', name?: string, assignedSpName?: string }>>}
 */
async function resolveRecipients(db, type, refs = {}) {
  const recipientsMap = new Map();

  // 1. RULE A — Admins get everything
  const activeAdmins = await getActiveAdminUids(db);
  for (const adminUser of activeAdmins) {
    recipientsMap.set(adminUser.uid, {
      uid: adminUser.uid,
      role: adminUser.role,
      audience: 'admin',
      name: adminUser.name,
    });
  }

  // 2. Admin-only notification type check
  if (ADMIN_ONLY_TYPES.has(type)) {
    if (refs.salespersonId || refs.salesPersonId || refs.newSpId) {
      logger.error(`[resolveRecipients] Security violation: Attempted to send admin-only notification '${type}' to employee (${refs.salespersonId || refs.salesPersonId || refs.newSpId}). Blocked.`);
    }
    return Array.from(recipientsMap.values());
  }

  // 3. RULE B — Resolve the CURRENT assigned salesperson for this specific entity
  let spId = '';

  if (refs.newSpId) {
    spId = String(refs.newSpId).trim();
  } else if (refs.salespersonId || refs.salesPersonId) {
    spId = String(refs.salespersonId || refs.salesPersonId).trim();
  } else if (refs.customerData) {
    spId = String(refs.customerData.salesPersonId || refs.customerData.assignedSalespersonId || '').trim();
  } else if (refs.customerId) {
    try {
      const cDoc = await db.collection('users').doc(refs.customerId).get();
      if (cDoc.exists) {
        const cData = cDoc.data() || {};
        spId = String(cData.salesPersonId || cData.assignedSalespersonId || '').trim();
      }
    } catch (err) {
      logger.warn(`[resolveRecipients] Error fetching customer ${refs.customerId}:`, err);
    }
  } else if (refs.orderData) {
    // Current customer assignment takes precedence if order belongs to a customer
    const custId = refs.orderData.userId || refs.orderData.customerId;
    if (custId) {
      try {
        const cDoc = await db.collection('users').doc(custId).get();
        if (cDoc.exists) {
          const cData = cDoc.data() || {};
          spId = String(cData.salesPersonId || cData.assignedSalespersonId || '').trim();
        }
      } catch (err) {
        logger.warn(`[resolveRecipients] Error fetching customer ${custId} for order:`, err);
      }
    }
    if (!spId) {
      spId = String(refs.orderData.salesPersonId || refs.orderData.salespersonId || '').trim();
    }
  } else if (refs.orderId) {
    try {
      const oDoc = await db.collection('orders').doc(refs.orderId).get();
      if (oDoc.exists) {
        const oData = oDoc.data() || {};
        const custId = oData.userId || oData.customerId;
        if (custId) {
          const cDoc = await db.collection('users').doc(custId).get();
          if (cDoc.exists) {
            const cData = cDoc.data() || {};
            spId = String(cData.salesPersonId || cData.assignedSalespersonId || '').trim();
          }
        }
        if (!spId) {
          spId = String(oData.salesPersonId || oData.salespersonId || '').trim();
        }
      }
    } catch (err) {
      logger.warn(`[resolveRecipients] Error fetching order ${refs.orderId}:`, err);
    }
  } else if (refs.leadData) {
    spId = String(refs.leadData.assignedSalespersonId || refs.leadData.salesPersonId || refs.leadData.salespersonId || '').trim();
  } else if (refs.leadId) {
    try {
      const lDoc = await db.collection('leads').doc(refs.leadId).get();
      if (lDoc.exists) {
        const lData = lDoc.data() || {};
        spId = String(lData.assignedSalespersonId || lData.salesPersonId || lData.salespersonId || '').trim();
      }
    } catch (err) {
      logger.warn(`[resolveRecipients] Error fetching lead ${refs.leadId}:`, err);
    }
  } else if (refs.followUpData) {
    spId = String(refs.followUpData.salespersonId || refs.followUpData.salesPersonId || '').trim();
  } else if (refs.followUpId) {
    try {
      const fuDoc = await db.collection('followUps').doc(refs.followUpId).get();
      if (fuDoc.exists) {
        const fuData = fuDoc.data() || {};
        spId = String(fuData.salespersonId || fuData.salesPersonId || '').trim();
      }
    } catch (err) {
      logger.warn(`[resolveRecipients] Error fetching followUp ${refs.followUpId}:`, err);
    }
  }

  // If customer or entity has no salesperson assigned -> admins only!
  if (!spId) {
    return Array.from(recipientsMap.values());
  }

  // If the assigned salesperson is ALREADY an admin -> ONE copy (no duplicate)
  if (recipientsMap.has(spId)) {
    return Array.from(recipientsMap.values());
  }

  // 4. Validate salesperson account in Firestore
  try {
    const spDoc = await db.collection('users').doc(spId).get();
    if (spDoc.exists) {
      const spData = spDoc.data() || {};
      const status = (spData.status || 'active').toLowerCase().trim();

      if (status === 'inactive' || status === 'blocked') {
        logger.info(`[resolveRecipients] Salesperson ${spId} is ${status}; skipping notification.`);
        return Array.from(recipientsMap.values());
      }

      // RULE C — Designers get NO sales/customer/payment/lead notifications
      if (isDesignerUser(spData)) {
        logger.warn(`[resolveRecipients] User ${spId} is a designer; designers cannot receive ${type} notifications.`);
        return Array.from(recipientsMap.values());
      }

      const spName = spData.name || spData.fullName || 'Sales Representative';

      // Propagate assigned salesperson name to admin notification copies
      for (const adminEntry of recipientsMap.values()) {
        adminEntry.assignedSpName = spName;
      }

      recipientsMap.set(spId, {
        uid: spId,
        role: spData.role || 'salesperson',
        audience: 'salesperson',
        name: spName,
      });
    } else {
      logger.warn(`[resolveRecipients] Salesperson ${spId} user doc does not exist.`);
    }
  } catch (err) {
    logger.error(`[resolveRecipients] Error verifying salesperson ${spId}:`, err);
  }

  return Array.from(recipientsMap.values());
}

/**
 * Atomically creates a staff notification document if a duplicate dedupeKey does not exist.
 * Enforces audience tags, relative links only, and admin-only type protection.
 */
async function createNotificationIfNew(db, notifData, dryRun = false) {
  if (!notifData.recipientUid || !notifData.dedupeKey) {
    logger.warn('[NotificationEngine] Missing recipientUid or dedupeKey', notifData);
    return null;
  }

  const audience = notifData.audience || (isAdminRole(notifData.recipientRole) ? 'admin' : 'salesperson');

  // Enforce admin-only type protection
  if (audience !== 'admin' && ADMIN_ONLY_TYPES.has(notifData.type)) {
    logger.error(`[NotificationEngine:Security] Attempted to create admin-only notification '${notifData.type}' for non-admin recipient ${notifData.recipientUid}. Blocked.`);
    return null;
  }

  // Enforce strictly RELATIVE links only (never full URLs, never localhost)
  let relativeLink = (notifData.link || '/').replace(/^https?:\/\/[^\/]+/, '');
  if (!relativeLink.startsWith('/')) relativeLink = '/' + relativeLink;

  // Safe doc ID: replace slashes and spaces
  const safeDedupe = String(notifData.dedupeKey).replace(/[\/\s]/g, '_');
  const docId = `${notifData.recipientUid}_${safeDedupe}`;
  const notifRef = db.collection('staffNotifications').doc(docId);

  if (dryRun) {
    return { id: docId, ...notifData, link: relativeLink, audience, isDryRun: true };
  }

  const existingDoc = await notifRef.get();
  if (existingDoc.exists) {
    return null; // Already delivered
  }

  const payload = {
    recipientUid: notifData.recipientUid,
    recipientRole: notifData.recipientRole || (audience === 'admin' ? 'admin' : 'salesperson'),
    audience,
    type: notifData.type,
    title: notifData.title,
    body: notifData.body,
    link: relativeLink,
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
 * Fires when a customer document in users/{userId} is updated.
 *
 * RULES:
 * 1. Do NOT send any notification when a user document is CREATED (customer is onboarding).
 * 2. Send "New customer assigned: <firm>" ONLY when salesperson field changes from empty -> salesperson,
 *    or on reassignment (Salesperson A -> Salesperson B).
 * 3. On reassignment, ONLY the new salesperson is notified (+ all admins). Old salesperson gets nothing.
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

    // RULE 1.1: Do NOT send any notification when a user document is CREATED
    if (!before || !after) {
      return;
    }

    if (isStaffUser(after)) {
      return; // Skip staff profiles
    }

    const newSpId = (after.salesPersonId || after.assignedSalespersonId || '').toString().trim();
    const oldSpId = (before.salesPersonId || before.assignedSalespersonId || '').toString().trim();

    // RULE 1.2: Send ONLY when salesperson link is actually set (empty -> salesperson, or reassigned)
    const hasSpChanged = Boolean(newSpId) && newSpId !== oldSpId;
    if (!hasSpChanged) {
      return;
    }

    const firmName = after.companyName || after.businessName || after.firmName || after.name || after.fullName || 'New Client';
    const isReassigned = Boolean(oldSpId);

    const recipients = await resolveRecipients(db, 'customer_assigned', {
      customerId: userId,
      customerData: after,
      newSpId,
    });

    for (const r of recipients) {
      const isAdmin = r.audience === 'admin';
      const title = isAdmin
        ? (isReassigned ? 'Customer Reassigned' : 'New Customer Assigned')
        : (isReassigned ? 'Customer Reassigned to You' : 'New Customer Assigned');

      const body = isAdmin
        ? (isReassigned
            ? `Customer ${firmName} reassigned to ${r.uid === newSpId ? 'you' : (r.assignedSpName || 'salesperson')}`
            : `New customer assigned: ${firmName} (${r.assignedSpName || 'salesperson'})`)
        : (isReassigned
            ? `Customer ${firmName} reassigned to you`
            : `New customer: ${firmName}`);

      await createNotificationIfNew(db, {
        recipientUid: r.uid,
        recipientRole: r.role,
        audience: r.audience,
        type: 'customer_assigned',
        title,
        body,
        link: `/customers/${userId}`,
        refs: { customerId: userId },
        priority: 'normal',
        dedupeKey: `custAssigned_${userId}_${newSpId}`,
      });
    }

    logger.info(`[NotificationEngine:CustomerAssigned] Notified ${recipients.length} recipients for customer ${userId} assigned to ${newSpId}`);
  }
);

/**
 * Trigger: onOrderCreatedNotification
 * Fires when an order in orders/{orderId} is written.
 * 1. If Awaiting Quote (pending_rate / submitted / pending_quote): notifies assigned salesperson + all admins.
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
      const recipients = await resolveRecipients(db, 'po_request', {
        orderId,
        customerId,
        orderData: after,
      });

      const dedupeKey = `poRequest_${orderId}_awaitingQuote`;
      for (const r of recipients) {
        const isAdmin = r.audience === 'admin';
        const title = isAdmin ? 'New Client PO Request' : 'New PO Request';
        const body = isAdmin
          ? `New PO from ${clientName} (${orderRef}) — Awaiting Quote`
          : `PO Request for ${clientName} (${orderRef}) — Awaiting Quote`;

        await createNotificationIfNew(db, {
          recipientUid: r.uid,
          recipientRole: r.role,
          audience: r.audience,
          type: 'po_request',
          title,
          body,
          link: `/orders?search=${encodeURIComponent(orderRef)}`,
          refs: { orderId, customerId },
          priority: 'normal',
          dedupeKey,
        });
      }

      logger.info(`[NotificationEngine:PORequest] Dispatched awaiting quote notification for order ${orderId} to ${recipients.length} recipients`);
    }
  }
);

/**
 * Trigger: onPaymentSubmissionNotification
 * Fires when paymentSubmissions/{subId} is written.
 * - Created / pending_verification: Assigned salesperson ('payment_submitted') + Admins ('payment_action_verify' high priority)
 * - Status verified: Assigned salesperson + Admins ('payment_verified')
 * - Status rejected: Assigned salesperson + Admins ('payment_rejected' high priority)
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
    const paymentLink = `/orders?tab=payments&search=${encodeURIComponent(utr)}`;

    // CASE 1: Payment Submitted (Newly created or entered pending_verification)
    if (status === 'pending_verification' && (!before || oldStatus !== 'pending_verification')) {
      const recipients = await resolveRecipients(db, 'payment_submitted', {
        orderId,
        customerId: after.customerId,
        salespersonId: spId,
      });

      for (const r of recipients) {
        const isAdmin = r.audience === 'admin';
        // Admins receive the high-priority action alert to verify payment
        const title = isAdmin ? 'Verify Payment' : 'Payment Submitted';
        const body = isAdmin
          ? `₹${amount} submitted for ${customerName} (UTR: ${utr}). Please verify.`
          : `Payment of ₹${amount} (UTR: ${utr}) submitted for Order ${orderRef}`;
        const type = isAdmin ? 'payment_action_verify' : 'payment_submitted';
        const priority = isAdmin ? 'high' : 'normal';
        const dedupeKey = isAdmin ? `paySubmittedAdmin_${subId}` : `paySubmitted_${subId}`;

        await createNotificationIfNew(db, {
          recipientUid: r.uid,
          recipientRole: r.role,
          audience: r.audience,
          type,
          title,
          body,
          link: paymentLink,
          refs: { orderId, customerId: after.customerId },
          priority,
          dedupeKey,
        });
      }
      logger.info(`[NotificationEngine:Payment] Notified payment submission ${subId} to ${recipients.length} recipients`);
    }

    // CASE 2: Payment Verified
    if (status === 'verified' && oldStatus !== 'verified') {
      const recipients = await resolveRecipients(db, 'payment_verified', {
        orderId,
        customerId: after.customerId,
        salespersonId: spId,
      });

      for (const r of recipients) {
        await createNotificationIfNew(db, {
          recipientUid: r.uid,
          recipientRole: r.role,
          audience: r.audience,
          type: 'payment_verified',
          title: 'Payment Verified',
          body: `Payment of ₹${amount} verified for Order ${orderRef}`,
          link: paymentLink,
          refs: { orderId, customerId: after.customerId },
          priority: 'normal',
          dedupeKey: `payVerified_${subId}`,
        });
      }
      logger.info(`[NotificationEngine:PaymentVerified] Notified payment verification ${subId} to ${recipients.length} recipients`);
    }

    // CASE 3: Payment Rejected
    if (status === 'rejected' && oldStatus !== 'rejected') {
      const reason = after.rejectionReason ? ` Reason: ${after.rejectionReason}` : '';
      const recipients = await resolveRecipients(db, 'payment_rejected', {
        orderId,
        customerId: after.customerId,
        salespersonId: spId,
      });

      for (const r of recipients) {
        await createNotificationIfNew(db, {
          recipientUid: r.uid,
          recipientRole: r.role,
          audience: r.audience,
          type: 'payment_rejected',
          title: 'Payment Rejected',
          body: `Payment of ₹${amount} rejected for Order ${orderRef}.${reason}`,
          link: paymentLink,
          refs: { orderId, customerId: after.customerId },
          priority: 'high',
          dedupeKey: `payRejected_${subId}`,
        });
      }
      logger.info(`[NotificationEngine:PaymentRejected] Notified payment rejection ${subId} to ${recipients.length} recipients`);
    }
  }
);

/**
 * Trigger: onLeadAssignedNotification
 * Fires when leads/{leadId} is written.
 * Notifies the new salesperson when a lead is assigned or reassigned (+ all admins).
 * Old salesperson gets nothing.
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

      const recipients = await resolveRecipients(db, 'lead_assigned', {
        leadId,
        leadData: after,
        newSpId,
      });

      for (const r of recipients) {
        const isAdmin = r.audience === 'admin';
        const title = isAdmin
          ? (isReassigned ? 'Lead Reassigned' : 'New Lead Assigned')
          : (isReassigned ? 'Lead Reassigned to You' : 'New Lead Assigned');
        const body = isAdmin
          ? `Lead: ${leadName}${company} (assigned to ${r.assignedSpName || 'salesperson'})`
          : `Lead: ${leadName}${company}`;

        await createNotificationIfNew(db, {
          recipientUid: r.uid,
          recipientRole: r.role,
          audience: r.audience,
          type: 'lead_assigned',
          title,
          body,
          link: `/leads/${leadId}`,
          refs: { leadId },
          priority: 'normal',
          dedupeKey: `leadAssign_${leadId}_${newSpId}`,
        });
      }

      logger.info(`[NotificationEngine:LeadAssigned] Notified ${recipients.length} recipients for lead ${leadId} assigned to ${newSpId}`);
    }
  }
);

// =============================================================================
// 2. DAILY REMINDERS CORE ENGINE & SCHEDULER
// =============================================================================

/**
 * Core daily reminder checks implementation.
 * Runs during scheduled 09:00 IST invocation AND via the runNotificationCheck callable.
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
    customerUnassigned24h: 0,
    poApprovedUnpaid: 0,
    paymentOverdue: 0,
    customerInactive: 0,
    noFirstOrder: 0,
    followUpDue: 0,
    adminWeeklySummary: 0,
    total: 0,
  };

  // ---------------------------------------------------------------------------
  // 0. Customers registered > 24 hours ago who are STILL unassigned (ADMINS ONLY)
  // ---------------------------------------------------------------------------
  try {
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const usersSnap = await db.collection('users').get();

    for (const doc of usersSnap.docs) {
      const user = doc.data() || {};
      if (isStaffUser(user)) continue;

      const spId = (user.salesPersonId || user.assignedSalespersonId || '').toString().trim();
      if (spId) continue; // Already assigned

      const createdDate = parseDate(user.createdAt);
      if (!createdDate || createdDate > twentyFourHoursAgo) continue; // Under 24h old

      const custId = doc.id;
      const firm = user.companyName || user.businessName || user.firmName || user.name || 'Client';

      const recipients = await resolveRecipients(db, 'customer_unassigned_24h', {
        customerId: custId,
        customerData: user,
      });

      for (const r of recipients) {
        const n = await createNotificationIfNew(db, {
          recipientUid: r.uid,
          recipientRole: r.role,
          audience: r.audience,
          type: 'customer_unassigned_24h',
          title: 'Customer Still Unassigned (24h+)',
          body: `Customer ${firm} registered 24h+ ago with no salesperson assigned.`,
          link: `/customers/${custId}`,
          refs: { customerId: custId },
          priority: 'normal',
          dedupeKey: `custUnassigned24h_${custId}`,
          skipIndividualPush: true,
        }, dryRun);

        if (n) {
          generatedNotifications.push(n);
          counts.customerUnassigned24h++;
        }
      }
    }
  } catch (err) {
    logger.error('[DailyNotificationCheck:Unassigned24h] Error:', err);
  }

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
      const orderRef = order.orderReference || order.poNumber || doc.id;
      const firm = order.companyName || order.customerName || 'Client';

      if (settings.paymentPendingDays.includes(elapsedDays)) {
        const isEscalation = elapsedDays >= settings.adminPaymentEscalationDay;
        const priority = isEscalation ? 'high' : 'normal';

        const recipients = await resolveRecipients(db, 'po_approved_unpaid', {
          orderId: doc.id,
          customerId: order.userId || order.customerId,
          orderData: order,
        });

        for (const r of recipients) {
          const isAdmin = r.audience === 'admin';
          const title = isAdmin && isEscalation
            ? `Payment Pending Escalation (Day ${elapsedDays})`
            : `Payment Pending (Day ${elapsedDays})`;

          const n = await createNotificationIfNew(db, {
            recipientUid: r.uid,
            recipientRole: r.role,
            audience: r.audience,
            type: 'po_approved_unpaid',
            title,
            body: `Order ${orderRef} for ${firm} approved ${elapsedDays} days ago; payment not received.`,
            link: `/orders?search=${encodeURIComponent(orderRef)}`,
            refs: { orderId: doc.id, customerId: order.userId || order.customerId },
            priority,
            dedupeKey: isAdmin ? `payPendingAdmin_${doc.id}_day${elapsedDays}` : `payPending_${doc.id}_day${elapsedDays}`,
            skipIndividualPush: true,
          }, dryRun);

          if (n) {
            generatedNotifications.push(n);
            counts.poApprovedUnpaid++;
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

        const recipients = await resolveRecipients(db, 'payment_overdue', {
          orderId: doc.id,
          customerId: order.userId || order.customerId,
          orderData: order,
        });

        for (const r of recipients) {
          const n = await createNotificationIfNew(db, {
            recipientUid: r.uid,
            recipientRole: r.role,
            audience: r.audience,
            type: 'payment_overdue',
            title: 'Payment Overdue',
            body: `Payment overdue: ₹${unpaidAmount} since ${dueDateFormatted} (${overdueDays} days late) for ${firm}`,
            link: `/orders?search=${encodeURIComponent(orderRef)}`,
            refs: { orderId: doc.id, customerId: order.userId || order.customerId },
            priority: 'high',
            dedupeKey: `overdue_${doc.id}_${todayYmd}`,
            skipIndividualPush: true,
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
          const recipients = await resolveRecipients(db, 'customer_inactive', {
            customerId: custId,
            customerData: user,
          });

          for (const r of recipients) {
            const n = await createNotificationIfNew(db, {
              recipientUid: r.uid,
              recipientRole: r.role,
              audience: r.audience,
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
            const recipients = await resolveRecipients(db, 'no_first_order', {
              customerId: custId,
              customerData: user,
            });

            for (const r of recipients) {
              const n = await createNotificationIfNew(db, {
                recipientUid: r.uid,
                recipientRole: r.role,
                audience: r.audience,
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

      const target = fu.targetName || 'Client Follow-up';
      const type = (fu.type || 'activity').toUpperCase();
      const time = fu.dueTime ? ` at ${fu.dueTime}` : '';

      const recipients = await resolveRecipients(db, 'follow_up_due', {
        followUpId: doc.id,
        followUpData: fu,
      });

      for (const r of recipients) {
        const n = await createNotificationIfNew(db, {
          recipientUid: r.uid,
          recipientRole: r.role,
          audience: r.audience,
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
    }
  } catch (err) {
    logger.error('[DailyNotificationCheck:FollowUps] Error:', err);
  }

  // ---------------------------------------------------------------------------
  // E. Mondays: Admin Weekly Account Digest Summary (ADMINS ONLY)
  // ---------------------------------------------------------------------------
  const kolkataDay = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay();
  const isMonday = kolkataDay === 1;

  if (isMonday) {
    const summaryText = `${inactiveCustomersCount} customers inactive 30+ days, ${overdueOrdersCount} payments overdue`;
    const recipients = await resolveRecipients(db, 'admin_weekly_summary', {});

    for (const r of recipients) {
      const n = await createNotificationIfNew(db, {
        recipientUid: r.uid,
        recipientRole: r.role,
        audience: r.audience,
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

        // Skip any token registered from localhost / 127.0.0.1
        const validTokens = [];
        const invalidTokens = [];

        for (const tDoc of tokensSnap.docs) {
          const tData = tDoc.data() || {};
          const origin = (tData.origin || '').toLowerCase();
          const hostname = (tData.hostname || '').toLowerCase();
          if (
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            hostname.includes('localhost') ||
            hostname.includes('127.0.0.1')
          ) {
            invalidTokens.push(tDoc.id);
          } else {
            validTokens.push(tDoc.id);
          }
        }

        if (invalidTokens.length > 0) {
          const batch = db.batch();
          invalidTokens.forEach((tId) => {
            batch.delete(db.collection('staffDevices').doc(uid).collection('tokens').doc(tId));
          });
          await batch.commit();
          logger.info(`[DailyNotificationCheck:FCM] Pruned ${invalidTokens.length} localhost tokens for user ${uid}`);
        }

        if (validTokens.length === 0) continue;

        const count = notifs.length;
        const highPriority = notifs.some((n) => n.priority === 'high');

        const pushTitle = count === 1 ? notifs[0].title : `You have ${count} reminders today`;
        const pushBody = count === 1
          ? notifs[0].body
          : notifs.map((n) => n.title).slice(0, 3).join(' • ') + (count > 3 ? ` (+${count - 3} more)` : '');

        const message = {
          tokens: validTokens,
          notification: {
            title: pushTitle,
            body: pushBody,
          },
          data: {
            link: '/notifications',
            clickUrl: `${PORTAL_BASE_URL}/notifications`,
            type: 'daily_reminder_digest',
            priority: highPriority ? 'high' : 'normal',
          },
          webpush: {
            headers: {
              Urgency: highPriority ? 'high' : 'normal',
            },
            fcmOptions: {
              link: `${PORTAL_BASE_URL}/notifications`,
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
              await db.collection('staffDevices').doc(uid).collection('tokens').doc(validTokens[idx]).delete();
              logger.info(`[NotificationEngine:FCM] Pruned invalid token ${validTokens[idx]} for user ${uid}`);
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
    generatedNotifications,
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
 * - Deep link clickUrl uses production PORTAL_BASE_URL (never localhost).
 * - Skips and prunes any tokens registered from localhost or 127.0.0.1.
 * - Groups notifications for admins if > 3 arrive within 60 seconds.
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

      // Filter out and delete tokens registered from localhost or 127.0.0.1
      const validTokens = [];
      const invalidTokenIds = [];

      for (const tDoc of tokensSnap.docs) {
        const tData = tDoc.data() || {};
        const origin = (tData.origin || '').toLowerCase();
        const hostname = (tData.hostname || '').toLowerCase();

        if (
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          hostname.includes('localhost') ||
          hostname.includes('127.0.0.1')
        ) {
          invalidTokenIds.push(tDoc.id);
        } else {
          validTokens.push(tDoc.id);
        }
      }

      // Prune localhost tokens immediately
      if (invalidTokenIds.length > 0) {
        const batch = db.batch();
        invalidTokenIds.forEach((tId) => {
          batch.delete(db.collection('staffDevices').doc(uid).collection('tokens').doc(tId));
        });
        await batch.commit();
        logger.info(`[NotificationEngine:FCM] Pruned ${invalidTokenIds.length} localhost tokens for user ${uid}`);
      }

      if (validTokens.length === 0) {
        return;
      }

      const isHigh = notif.priority === 'high';
      const relativeLink = notif.link || '/';
      const fullClickUrl = `${PORTAL_BASE_URL}${relativeLink}`;

      // Admin Push Grouping:
      // Group many alerts (e.g. "8 new notifications") instead of one pop-up each,
      // when more than 3 arrive within a minute for an admin.
      let pushTitle = notif.title || 'ITACON Management';
      let pushBody = notif.body || '';
      let clickUrl = fullClickUrl;

      if (notif.audience === 'admin' || notif.recipientRole === 'admin') {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const recentSnap = await db.collection('staffNotifications')
          .where('recipientUid', '==', uid)
          .where('createdAt', '>=', oneMinuteAgo)
          .get();

        if (recentSnap.size > 3) {
          pushTitle = `${recentSnap.size} new notifications`;
          pushBody = `Latest: ${notif.title} — ${notif.body} (+${recentSnap.size - 1} more)`;
          clickUrl = `${PORTAL_BASE_URL}/notifications`;
        }
      }

      const message = {
        tokens: validTokens,
        notification: {
          title: pushTitle,
          body: pushBody,
        },
        data: {
          notifId: notifId,
          link: relativeLink,
          clickUrl: clickUrl,
          type: notif.type || 'general',
          priority: notif.priority || 'normal',
        },
        webpush: {
          headers: {
            Urgency: isHigh ? 'high' : 'normal',
          },
          fcmOptions: {
            link: clickUrl,
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
            await db.collection('staffDevices').doc(uid).collection('tokens').doc(validTokens[idx]).delete();
            logger.info(`[NotificationEngine:FCM] Pruned invalid token ${validTokens[idx]} for user ${uid}`);
          }
        }
      });

      logger.info(`[NotificationEngine:FCM] Sent instant push for ${notifId} to ${response.successCount}/${validTokens.length} devices.`);
    } catch (err) {
      logger.error(`[NotificationEngine:FCM] Failed sending push for ${notifId}:`, err);
    }
  }
);

// Export core functions and helpers for direct invocation by tests or CLI
exports.executeDailyNotificationCheck = executeDailyNotificationCheck;
exports.resolveRecipients = resolveRecipients;
exports.isAdminRole = isAdminRole;
exports.isDesignerUser = isDesignerUser;
exports.createNotificationIfNew = createNotificationIfNew;
