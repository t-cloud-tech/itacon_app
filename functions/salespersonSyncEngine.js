const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Determines whether a client profile is considered "active".
 * A client is active if:
 * 1. Not explicitly inactive or blocked (isActive !== false && status !== 'inactive' && status !== 'blocked')
 * 2. Explicitly marked active (isActive === true || status === 'active')
 * 3. Default to true for standard registered clients unless pending verification
 */
function isClientActive(data) {
  if (!data) return false;
  if (data.isActive === false || data.status === 'inactive' || data.status === 'blocked') {
    return false;
  }
  if (data.isActive === true || data.status === 'active') {
    return true;
  }
  if (data.status === 'pending_salesperson_verification' || data.status === 'pending') {
    return false;
  }
  return true;
}

/**
 * Checks if a user document represents a staff member (not a client).
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
    role === 'super_admin' ||
    cat === 'salesperson' ||
    cat === 'admin' ||
    cat === 'manager'
  );
}

/**
 * Normalizes referral code strings for case-insensitive and punctuation/whitespace-insensitive matching.
 * e.g., " sales - 107 " -> "SALES107", "SALES101" -> "SALES101"
 */
function normalizeReferralCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/[-\s]/g, '');
}

/**
 * Resolves the linked salesperson document for a client.
 * Searches by salesperson ID first, then referralCode (case-insensitive and trimmed).
 */
async function resolveSalespersonDoc(db, clientData) {
  if (!clientData) return null;

  // 1. Direct doc ID lookup in salesPersons collection
  const spId = (clientData.salesPersonId || clientData.assignedSalespersonId || '').toString().trim();
  if (spId) {
    const spDoc = await db.collection('salesPersons').doc(spId).get();
    if (spDoc.exists) {
      return { id: spDoc.id, data: spDoc.data() };
    }
  }

  // 2. Lookup by referral code
  const rawCode = (
    clientData.salespersonReferralCode ||
    clientData.referralCodeEntered ||
    clientData.referredByCode ||
    clientData.referralCode ||
    ''
  ).toString().trim();

  if (rawCode) {
    const trimmedCode = rawCode.toUpperCase();
    const normalizedCode = normalizeReferralCode(rawCode);

    // Exact query first
    const exactQuery = await db.collection('salesPersons')
      .where('referralCode', '==', trimmedCode)
      .limit(1)
      .get();

    if (!exactQuery.empty) {
      const doc = exactQuery.docs[0];
      return { id: doc.id, data: doc.data() };
    }

    // Scan salesPersons collection for normalized/case-insensitive match
    const allSpSnap = await db.collection('salesPersons').get();
    for (const doc of allSpSnap.docs) {
      const spData = doc.data() || {};
      const spCode = (spData.referralCode || '').toString().trim();
      if (!spCode) continue;

      if (spCode.toUpperCase() === trimmedCode || normalizeReferralCode(spCode) === normalizedCode) {
        return { id: doc.id, data: spData };
      }
    }

    // 3. Fallback: check users collection for staff with role === 'salesperson'
    const userSpQuery = await db.collection('users')
      .where('role', '==', 'salesperson')
      .get();

    for (const doc of userSpQuery.docs) {
      const uData = doc.data() || {};
      const uCode = (uData.referralCode || '').toString().trim();
      if (uCode.toUpperCase() === trimmedCode || normalizeReferralCode(uCode) === normalizedCode) {
        return { id: doc.id, data: uData };
      }
    }
  }

  // If spId was given but doc was not in salesPersons, check if it's in users
  if (spId) {
    const userSpDoc = await db.collection('users').doc(spId).get();
    if (userSpDoc.exists) {
      return { id: userSpDoc.id, data: userSpDoc.data() };
    }
  }

  return null;
}

/**
 * Core business logic for handling client creation.
 */
async function handleClientCreated(db, userId, clientData) {
  if (!clientData || isStaffUser(clientData)) {
    return { skipped: true, reason: 'staff_or_empty' };
  }

  const salesperson = await resolveSalespersonDoc(db, clientData);

  if (!salesperson) {
    const code = clientData.salespersonReferralCode || clientData.referralCodeEntered || clientData.referredByCode || '';
    const spId = clientData.salesPersonId || clientData.assignedSalespersonId || '';
    logger.warn(`[SalespersonSync:Created] Salesperson not found for new client ${userId} (spId: "${spId}", code: "${code}").`);
    return { skipped: true, reason: 'salesperson_not_found' };
  }

  const spId = salesperson.id;
  const isActive = isClientActive(clientData);

  return await db.runTransaction(async (transaction) => {
    const spRef = db.collection('salesPersons').doc(spId);
    const subdocRef = spRef.collection('assigned_clients').doc(userId);

    const [spDoc, subDoc] = await Promise.all([
      transaction.get(spRef),
      transaction.get(subdocRef),
    ]);

    if (subDoc.exists) {
      logger.info(`[SalespersonSync:Created] Client ${userId} already in assigned_clients of salesperson ${spId}. No-op for idempotency.`);
      return { noop: true, spId };
    }

    const subdocData = {
      clientId: userId,
      name: clientData.name || clientData.fullName || '',
      phone: clientData.phone || clientData.phoneNumber || '',
      email: clientData.email || '',
      createdAt: clientData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      isActive: isActive,
    };

    transaction.set(subdocRef, subdocData);

    const currentData = spDoc.exists ? (spDoc.data() || {}) : {};
    const currentAssigned = Number(currentData.assignedClientsCount) || 0;
    const currentActive = Number(currentData.activeClientsCount) || 0;

    const newAssigned = currentAssigned + 1;
    const newActive = isActive ? currentActive + 1 : currentActive;

    transaction.set(spRef, {
      assignedClientsCount: newAssigned,
      activeClientsCount: newActive,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    logger.info(`[SalespersonSync:Created] Count updated for salesperson ${spId}: assignedClientsCount=${newAssigned}, activeClientsCount=${newActive} (added client ${userId})`);
    return { success: true, spId, assignedClientsCount: newAssigned, activeClientsCount: newActive };
  });
}

/**
 * Core business logic for handling client update.
 */
async function handleClientUpdated(db, userId, beforeData, afterData) {
  if (!beforeData || !afterData || isStaffUser(afterData)) {
    return { skipped: true, reason: 'staff_or_empty' };
  }

  const wasActive = isClientActive(beforeData);
  const isActive = isClientActive(afterData);
  const statusChanged = wasActive !== isActive;

  const oldSp = await resolveSalespersonDoc(db, beforeData);
  const newSp = await resolveSalespersonDoc(db, afterData);

  const oldSpId = oldSp ? oldSp.id : null;
  const newSpId = newSp ? newSp.id : null;
  const spChanged = oldSpId !== newSpId;

  if (!spChanged && !statusChanged) {
    if (newSpId) {
      const subdocRef = db.collection('salesPersons').doc(newSpId).collection('assigned_clients').doc(userId);
      const subDoc = await subdocRef.get();
      if (subDoc.exists) {
        await subdocRef.set({
          name: afterData.name || afterData.fullName || '',
          phone: afterData.phone || afterData.phoneNumber || '',
          email: afterData.email || '',
          isActive: isActive,
        }, { merge: true });
      }
    }
    return { noop: true };
  }

  return await db.runTransaction(async (transaction) => {
    // CASE 1: Linked salesperson changed
    if (spChanged) {
      if (oldSpId) {
        const oldSpRef = db.collection('salesPersons').doc(oldSpId);
        const oldSubdocRef = oldSpRef.collection('assigned_clients').doc(userId);

        const [oldSpDoc, oldSubDoc] = await Promise.all([
          transaction.get(oldSpRef),
          transaction.get(oldSubdocRef),
        ]);

        if (oldSubDoc.exists) {
          transaction.delete(oldSubdocRef);
        }

        if (oldSpDoc.exists) {
          const oldData = oldSpDoc.data() || {};
          const currentAssigned = Number(oldData.assignedClientsCount) || 0;
          const currentActive = Number(oldData.activeClientsCount) || 0;

          const newAssigned = Math.max(0, currentAssigned - 1);
          const newActive = wasActive ? Math.max(0, currentActive - 1) : currentActive;

          transaction.set(oldSpRef, {
            assignedClientsCount: newAssigned,
            activeClientsCount: newActive,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          logger.info(`[SalespersonSync:Updated] Count updated for old salesperson ${oldSpId}: assignedClientsCount=${newAssigned}, activeClientsCount=${newActive} (removed client ${userId})`);
        }
      }

      if (newSpId) {
        const newSpRef = db.collection('salesPersons').doc(newSpId);
        const newSubdocRef = newSpRef.collection('assigned_clients').doc(userId);

        const [newSpDoc, newSubDoc] = await Promise.all([
          transaction.get(newSpRef),
          transaction.get(newSubdocRef),
        ]);

        const subdocData = {
          clientId: userId,
          name: afterData.name || afterData.fullName || '',
          phone: afterData.phone || afterData.phoneNumber || '',
          email: afterData.email || '',
          createdAt: afterData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          isActive: isActive,
        };
        transaction.set(newSubdocRef, subdocData);

        if (newSpDoc.exists && !newSubDoc.exists) {
          const newData = newSpDoc.data() || {};
          const currentAssigned = Number(newData.assignedClientsCount) || 0;
          const currentActive = Number(newData.activeClientsCount) || 0;

          const newAssigned = currentAssigned + 1;
          const newActive = isActive ? currentActive + 1 : currentActive;

          transaction.set(newSpRef, {
            assignedClientsCount: newAssigned,
            activeClientsCount: newActive,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          logger.info(`[SalespersonSync:Updated] Count updated for new salesperson ${newSpId}: assignedClientsCount=${newAssigned}, activeClientsCount=${newActive} (transferred client ${userId})`);
        }
      }
      return { success: true, transferred: true, oldSpId, newSpId };
    }
    // CASE 2: Same salesperson, but active status changed
    else if (statusChanged && newSpId) {
      const spRef = db.collection('salesPersons').doc(newSpId);
      const subdocRef = spRef.collection('assigned_clients').doc(userId);

      const [spDoc, subDoc] = await Promise.all([
        transaction.get(spRef),
        transaction.get(subdocRef),
      ]);

      if (subDoc.exists) {
        transaction.update(subdocRef, { isActive: isActive });
      } else {
        transaction.set(subdocRef, {
          clientId: userId,
          name: afterData.name || afterData.fullName || '',
          phone: afterData.phone || afterData.phoneNumber || '',
          email: afterData.email || '',
          createdAt: afterData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          isActive: isActive,
        });
      }

      if (spDoc.exists) {
        const spData = spDoc.data() || {};
        const currentActive = Number(spData.activeClientsCount) || 0;
        const delta = isActive ? 1 : -1;
        const newActive = Math.max(0, currentActive + delta);

        transaction.set(spRef, {
          activeClientsCount: newActive,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        logger.info(`[SalespersonSync:Updated] Count updated for salesperson ${newSpId}: activeClientsCount=${newActive} (client ${userId} status changed to isActive=${isActive})`);
        return { success: true, spId: newSpId, activeClientsCount: newActive };
      }
    }
    return { noop: true };
  });
}

/**
 * Core business logic for handling client deletion.
 */
async function handleClientDeleted(db, userId, deletedData) {
  if (!deletedData || isStaffUser(deletedData)) {
    return { skipped: true, reason: 'staff_or_empty' };
  }

  const salesperson = await resolveSalespersonDoc(db, deletedData);
  if (!salesperson) {
    logger.warn(`[SalespersonSync:Deleted] No linked salesperson found for deleted client ${userId}.`);
    return { skipped: true, reason: 'salesperson_not_found' };
  }

  const spId = salesperson.id;
  const wasActive = isClientActive(deletedData);

  return await db.runTransaction(async (transaction) => {
    const spRef = db.collection('salesPersons').doc(spId);
    const subdocRef = spRef.collection('assigned_clients').doc(userId);

    const [spDoc, subDoc] = await Promise.all([
      transaction.get(spRef),
      transaction.get(subdocRef),
    ]);

    if (subDoc.exists) {
      transaction.delete(subdocRef);
    }

    if (spDoc.exists) {
      const spData = spDoc.data() || {};
      const currentAssigned = Number(spData.assignedClientsCount) || 0;
      const currentActive = Number(spData.activeClientsCount) || 0;

      const newAssigned = Math.max(0, currentAssigned - 1);
      const newActive = wasActive ? Math.max(0, currentActive - 1) : currentActive;

      transaction.set(spRef, {
        assignedClientsCount: newAssigned,
        activeClientsCount: newActive,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      logger.info(`[SalespersonSync:Deleted] Count updated for salesperson ${spId}: assignedClientsCount=${newAssigned}, activeClientsCount=${newActive} (deleted client ${userId})`);
      return { success: true, spId, assignedClientsCount: newAssigned, activeClientsCount: newActive };
    }
    return { noop: true };
  });
}

/**
 * 2nd-gen Cloud Function triggers for Cloud Eventarc
 */
exports.syncSalespersonOnClientCreated = onDocumentCreated(
  {
    document: 'users/{userId}',
    region: 'asia-south1',
  },
  async (event) => {
    if (!event.data) return;
    const db = admin.firestore();
    await handleClientCreated(db, event.params.userId, event.data.data());
  }
);

exports.syncSalespersonOnClientUpdated = onDocumentUpdated(
  {
    document: 'users/{userId}',
    region: 'asia-south1',
  },
  async (event) => {
    if (!event.data) return;
    const db = admin.firestore();
    await handleClientUpdated(db, event.params.userId, event.data.before.data(), event.data.after.data());
  }
);

exports.syncSalespersonOnClientDeleted = onDocumentDeleted(
  {
    document: 'users/{userId}',
    region: 'asia-south1',
  },
  async (event) => {
    if (!event.data) return;
    const db = admin.firestore();
    await handleClientDeleted(db, event.params.userId, event.data.data());
  }
);

/**
 * Computes normalized referralCodeKey: strips hyphens and spaces, then uppercases.
 * e.g., "SALES-107" -> "SALES107", " sales 101 " -> "SALES101"
 */
function computeReferralCodeKey(code) {
  if (!code || typeof code !== 'string') return '';
  return code.replace(/[-\s]/g, '').toUpperCase().trim();
}

/**
 * 2nd-gen Firestore Trigger: onSalesPersonWrite
 * Whenever a document in salesPersons/{id} is created or updated,
 * automatically computes and sets referralCodeKey if referralCode is present.
 * Prevents loops by checking if referralCodeKey is already set to the expected key.
 */
exports.onSalesPersonWrite = onDocumentWritten(
  {
    document: 'salesPersons/{id}',
    region: 'asia-south1',
  },
  async (event) => {
    if (!event.data || !event.data.after || !event.data.after.exists) {
      return; // Document deleted
    }

    const afterData = event.data.after.data() || {};
    const referralCode = afterData.referralCode;
    if (!referralCode || typeof referralCode !== 'string') {
      return;
    }

    const expectedKey = computeReferralCodeKey(referralCode);
    const currentKey = afterData.referralCodeKey;

    if (currentKey === expectedKey) {
      return; // Already synchronized, no-op to prevent infinite loop
    }

    const db = admin.firestore();
    await db.collection('salesPersons').doc(event.params.id).set(
      {
        referralCodeKey: expectedKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    logger.info(`[onSalesPersonWrite] Set referralCodeKey="${expectedKey}" for salesPersons/${event.params.id} (referralCode="${referralCode}")`);
  }
);

/**
 * Core business logic for verifying a referral code or auto-assigning a salesperson.
 * - Authenticated caller only.
 * - Queries referralCodeKey == key, with fallbacks to referralCode == trimmedInput / trimmedInput.toUpperCase().
 * - Treats active as: isActive === true OR isActive === "true".
 * - Returns separate error codes: "invalid-code", "inactive-code", "already-linked", "internal".
 * - Logs received input, computed key, docs found count, and failure reasons.
 */
/**
 * Core business logic for auto-assigning an active salesperson to a user.
 * - Authenticated caller only.
 * - Eligible salespersons: ONLY docs in salesPersons where isActive === true || isActive === "true".
 * - Selection: sorted in code by:
 *     a) assignedClientsCount ascending (missing = 0)
 *     b) tie -> lastAutoAssignedAt ascending (missing = oldest, timestamp 0)
 *     c) tie -> doc ID (stable order)
 * - Atomic Firestore transaction:
 *     - Re-reads candidate salespersons, user doc, and subdoc inside transaction.
 *     - If user is already assigned -> rejects with "already-linked" and makes no changes.
 *     - Sets identical user fields as verifyReferralCode: salesPersonId, assignedSalespersonId, etc., status: 'active'.
 *     - Creates salesPersons/{spId}/assigned_clients/{userId} (assignmentType: 'auto_assigned').
 *     - Atomically updates assignedClientsCount + 1, activeClientsCount + 1, and lastAutoAssignedAt = serverTimestamp().
 *     - Writes mirror docs: client_assignments, Auto_Assign_User, customer_referrals.
 */
async function handleAutoAssignSalesperson(db, uid) {
  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  // 1. Fetch all docs from salesPersons to identify active candidates
  const allSpSnap = await db.collection('salesPersons').get();
  const eligibleCandidateIds = [];

  for (const doc of allSpSnap.docs) {
    const data = doc.data() || {};
    if (data.isActive === true || data.isActive === 'true') {
      eligibleCandidateIds.push(doc.id);
    }
  }

  if (eligibleCandidateIds.length === 0) {
    logger.warn('[autoAssignSalesperson] No active salespersons found.');
    throw new HttpsError('failed-precondition', 'no-salesperson-available');
  }

  const userRef = db.collection('users').doc(uid);

  // 2. Run assignment atomically inside a Firestore transaction
  return await db.runTransaction(async (transaction) => {
    // 2.1 Re-read user doc inside transaction
    const userDoc = await transaction.get(userRef);
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const existingSpId = (userData.salesPersonId || userData.assignedSalespersonId || '').toString().trim();

    if (existingSpId) {
      logger.warn(`[autoAssignSalesperson] User ${uid} already assigned to ${existingSpId}`);
      throw new HttpsError('already-exists', 'already-linked');
    }

    // 2.2 Re-read all active salesperson docs inside transaction for fresh counts and timestamps
    const spDocs = await Promise.all(
      eligibleCandidateIds.map((id) => transaction.get(db.collection('salesPersons').doc(id)))
    );

    const activeCandidates = [];
    for (const spSnap of spDocs) {
      if (spSnap.exists) {
        const data = spSnap.data() || {};
        if (data.isActive === true || data.isActive === 'true') {
          activeCandidates.push({ id: spSnap.id, ref: spSnap.ref, data });
        }
      }
    }

    if (activeCandidates.length === 0) {
      logger.warn('[autoAssignSalesperson] No active salespersons found inside transaction.');
      throw new HttpsError('failed-precondition', 'no-salesperson-available');
    }

    // 2.3 Sort candidates:
    // a) assignedClientsCount ascending (missing = 0)
    // b) tie -> lastAutoAssignedAt ascending (missing = 0 / oldest)
    // c) tie -> doc ID, for a stable order
    activeCandidates.sort((a, b) => {
      const countA = Number(a.data.assignedClientsCount) || 0;
      const countB = Number(b.data.assignedClientsCount) || 0;
      if (countA !== countB) return countA - countB;

      let timeA = 0;
      if (a.data.lastAutoAssignedAt) {
        if (typeof a.data.lastAutoAssignedAt.toMillis === 'function') {
          timeA = a.data.lastAutoAssignedAt.toMillis();
        } else if (a.data.lastAutoAssignedAt._seconds !== undefined) {
          timeA = a.data.lastAutoAssignedAt._seconds * 1000;
        } else {
          timeA = new Date(a.data.lastAutoAssignedAt).getTime() || 0;
        }
      }

      let timeB = 0;
      if (b.data.lastAutoAssignedAt) {
        if (typeof b.data.lastAutoAssignedAt.toMillis === 'function') {
          timeB = b.data.lastAutoAssignedAt.toMillis();
        } else if (b.data.lastAutoAssignedAt._seconds !== undefined) {
          timeB = b.data.lastAutoAssignedAt._seconds * 1000;
        } else {
          timeB = new Date(b.data.lastAutoAssignedAt).getTime() || 0;
        }
      }

      if (timeA !== timeB) return timeA - timeB;

      return a.id.localeCompare(b.id);
    });

    const chosenSp = activeCandidates[0];
    const spId = chosenSp.id;
    const spData = chosenSp.data;
    const curAssigned = Number(spData.assignedClientsCount) || 0;
    const curActive = Number(spData.activeClientsCount) || 0;

    logger.info(
      `[autoAssignSalesperson] Selected salesperson: ${spId} (${spData.name || spData.fullName || 'N/A'}, code: ${spData.referralCode || 'N/A'}) with current assignedClientsCount=${curAssigned}, activeClientsCount=${curActive}`
    );

    const spCode = (spData.referralCode || 'SALES101').toString().trim();
    const spName = spData.name || spData.fullName || 'Sales Executive';
    const spPhone = spData.phone || spData.phoneNumber || '+919998887770';

    const clientName = userData.name || userData.fullName || 'Client';
    const clientPhone = userData.phone || userData.phoneNumber || '';
    const clientCategory = userData.role || userData.userCategory || 'dealer';
    const companyName = userData.companyName || '';

    // 2.4 Re-read subdoc inside transaction
    const subdocRef = chosenSp.ref.collection('assigned_clients').doc(uid);
    const subSnap = await transaction.get(subdocRef);

    // 1. Authoritatively update users/{uid}
    transaction.set(
      userRef,
      {
        salesPersonId: spId,
        assignedSalespersonId: spId,
        salespersonName: spName,
        salespersonPhone: spPhone,
        salespersonReferralCode: spCode,
        status: 'active',
        isVerified: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 2. Set subdoc on salesPersons/{spId}/assigned_clients/{uid}
    if (!subSnap.exists) {
      transaction.set(
        subdocRef,
        {
          clientId: uid,
          userId: uid,
          name: clientName,
          clientName,
          phone: clientPhone,
          clientPhone,
          phoneNumber: clientPhone,
          clientCategory,
          userCategory: clientCategory,
          companyName,
          assignmentType: 'auto_assigned',
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: true,
        },
        { merge: true }
      );

      // 3. Increment counts and set lastAutoAssignedAt
      transaction.set(
        chosenSp.ref,
        {
          assignedClientsCount: curAssigned + 1,
          activeClientsCount: curActive + 1,
          lastAutoAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // 4. Auxiliary mirrors
    const assignmentId = `ASGN_${uid}`;
    const assignmentData = {
      assignmentId,
      clientId: uid,
      clientName,
      clientPhone,
      clientCategory,
      salespersonId: spId,
      salespersonName: spName,
      salespersonPhone: spPhone,
      salespersonReferralCode: spCode,
      companyName,
      assignmentType: 'auto_assigned',
      status: 'active',
      assignedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.set(db.collection('client_assignments').doc(assignmentId), assignmentData, { merge: true });
    transaction.set(db.collection('Auto_Assign_User').doc(uid), assignmentData, { merge: true });
    transaction.set(
      db.collection('customer_referrals').doc(`${uid}_${spCode}`),
      {
        referralCode: spCode,
        userId: uid,
        clientId: uid,
        userName: clientName,
        clientName,
        userPhone: clientPhone,
        clientPhone,
        userCategory: clientCategory,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        enteredAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      success: true,
      salespersonId: spId,
      salespersonName: spName,
      referralCode: spCode,
    };
  });
}

/**
 * Core business logic for verifying referral code and linking client.
 * - Authenticated caller only.
 * - Queries referralCodeKey == key, with fallbacks to referralCode == trimmedInput / trimmedInput.toUpperCase().
 * - Treats active as: isActive === true OR isActive === "true".
 * - Returns separate error codes: "invalid-code", "inactive-code", "already-linked", "internal".
 * - Logs received input, computed key, docs found count, and failure reasons.
 */
async function handleVerifyReferralCode(db, uid, data = {}) {
  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const autoAssign = data.autoAssign === true;
  const referralCode = data.referralCode;

  if (autoAssign) {
    return await handleAutoAssignSalesperson(db, uid);
  }

  let targetSp = null;
    // Manual referral code validation
    if (!referralCode || typeof referralCode !== 'string' || referralCode.trim().length === 0) {
      logger.warn('[verifyReferralCode] Validation failed: empty referral code received.');
      throw new HttpsError('invalid-argument', 'invalid-code');
    }

    const rawInput = referralCode;
    const trimmedInput = referralCode.trim();
    const key = computeReferralCodeKey(trimmedInput);

    logger.info(`[verifyReferralCode] Received input: "${rawInput}", computedKey: "${key}"`);

    // 1. Primary Query: referralCodeKey == key in salesPersons
    let matchQuery = await db.collection('salesPersons')
      .where('referralCodeKey', '==', key)
      .limit(1)
      .get();

    // 2. Fallback Query A: referralCode == trimmedInput
    if (matchQuery.empty) {
      matchQuery = await db.collection('salesPersons')
        .where('referralCode', '==', trimmedInput)
        .limit(1)
        .get();
    }

    // 3. Fallback Query B: referralCode == trimmedInput.toUpperCase()
    if (matchQuery.empty) {
      matchQuery = await db.collection('salesPersons')
        .where('referralCode', '==', trimmedInput.toUpperCase())
        .limit(1)
        .get();
    }

    logger.info(`[verifyReferralCode] salesPersons query matched docs: ${matchQuery.size}`);

    if (!matchQuery.empty) {
      const doc = matchQuery.docs[0];
      targetSp = { id: doc.id, data: doc.data() || {} };
    } else {
      // 4. Fallback: check users collection for staff with role == 'salesperson'
      let userQuery = await db.collection('users')
        .where('role', '==', 'salesperson')
        .where('referralCodeKey', '==', key)
        .limit(1)
        .get();

      if (userQuery.empty) {
        userQuery = await db.collection('users')
          .where('role', '==', 'salesperson')
          .where('referralCode', '==', trimmedInput)
          .limit(1)
          .get();
      }

      if (userQuery.empty) {
        userQuery = await db.collection('users')
          .where('role', '==', 'salesperson')
          .where('referralCode', '==', trimmedInput.toUpperCase())
          .limit(1)
          .get();
      }

      logger.info(`[verifyReferralCode] users fallback query matched docs: ${userQuery.size}`);

      if (!userQuery.empty) {
        const doc = userQuery.docs[0];
        targetSp = { id: doc.id, data: doc.data() || {} };
      }
    }

    if (!targetSp) {
      logger.warn(`[verifyReferralCode] Check failed: code not found for key="${key}", input="${rawInput}"`);
      throw new HttpsError('not-found', 'invalid-code');
    }

    const spData = targetSp.data || {};
    // Treat active as: isActive === true OR isActive === "true"
    const isActive = spData.isActive === true || spData.isActive === 'true';

    if (!isActive) {
      logger.warn(`[verifyReferralCode] Check failed: salesperson ${targetSp.id} is inactive (isActive=${spData.isActive})`);
      throw new HttpsError('failed-precondition', 'inactive-code');
    }

  const spId = targetSp.id;
  const spCode = (spData.referralCode || referralCode || 'SALES101').toString().trim();
  const spName = spData.name || spData.fullName || 'Sales Executive';
  const spPhone = spData.phone || spData.phoneNumber || '+919998887770';

  // Check if user is already assigned
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? (userDoc.data() || {}) : {};

  const existingSpId = (userData.salesPersonId || userData.assignedSalespersonId || '').toString().trim();
  if (existingSpId) {
    if (existingSpId === spId) {
      logger.info(`[verifyReferralCode] User ${uid} already assigned to salesperson ${spId}. Idempotent return.`);
      return {
        success: true,
        salespersonId: spId,
        salespersonName: spName,
        referralCode: spCode,
        alreadyLinked: true,
      };
    }
    logger.warn(`[verifyReferralCode] Check failed: User ${uid} already assigned to ${existingSpId}, attempted reassignment to ${spId}`);
    throw new HttpsError('already-exists', 'already-linked');
  }

  const clientName = userData.name || userData.fullName || 'Client';
  const clientPhone = userData.phone || userData.phoneNumber || '';
  const clientCategory = userData.role || userData.userCategory || 'dealer';
  const companyName = userData.companyName || '';

  // 1. Authoritatively update users/{uid}
  const userUpdateData = {
    salesPersonId: spId,
    assignedSalespersonId: spId,
    salespersonName: spName,
    salespersonPhone: spPhone,
    salespersonReferralCode: spCode,
    status: 'active',
    isVerified: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await userRef.set(userUpdateData, { merge: true });

  // 2. Auxiliary assignment mirrors
  const assignmentId = `ASGN_${uid}`;
  const assignmentData = {
    assignmentId,
    clientId: uid,
    clientName,
    clientPhone,
    clientCategory,
    salespersonId: spId,
    salespersonName: spName,
    salespersonPhone: spPhone,
    salespersonReferralCode: spCode,
    companyName,
    assignmentType: autoAssign ? 'auto_assigned' : 'manual_referral',
    status: 'active',
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const mirrorWrites = [
    db.collection('client_assignments').doc(assignmentId).set(assignmentData, { merge: true }),
    db.collection('Auto_Assign_User').doc(uid).set(assignmentData, { merge: true }),
    db.collection('customer_referrals').doc(`${uid}_${spCode}`).set({
      referralCode: spCode,
      userId: uid,
      clientId: uid,
      userName: clientName,
      clientName,
      userPhone: clientPhone,
      clientPhone,
      userCategory: clientCategory,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      enteredAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),
  ];

  if (!autoAssign) {
    mirrorWrites.push(db.collection('Manual_salesperson_assign').doc(uid).set(assignmentData, { merge: true }));
  }

  await Promise.all(mirrorWrites);

  // 3. Atomically update salesperson assigned_clients subcollection and counts (idempotent)
  const spRef = db.collection('salesPersons').doc(spId);
  const subdocRef = spRef.collection('assigned_clients').doc(uid);

  await db.runTransaction(async (transaction) => {
    const [spSnap, subSnap] = await Promise.all([
      transaction.get(spRef),
      transaction.get(subdocRef),
    ]);

    if (!subSnap.exists) {
      transaction.set(subdocRef, {
        clientId: uid,
        userId: uid,
        name: clientName,
        clientName,
        phone: clientPhone,
        clientPhone,
        phoneNumber: clientPhone,
        clientCategory,
        userCategory: clientCategory,
        companyName,
        assignmentType: autoAssign ? 'auto_assigned' : 'manual_referral',
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
      }, { merge: true });

      if (spSnap.exists) {
        const curSpData = spSnap.data() || {};
        const curAssigned = Number(curSpData.assignedClientsCount) || 0;
        const curActive = Number(curSpData.activeClientsCount) || 0;

        transaction.set(spRef, {
          assignedClientsCount: curAssigned + 1,
          activeClientsCount: curActive + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  });

  return {
    success: true,
    salespersonId: spId,
    salespersonName: spName,
    referralCode: spCode,
  };
}

/**
 * 2nd-gen Callable Cloud Function: autoAssignSalesperson
 * Region: asia-south1
 */
exports.autoAssignSalesperson = onCall(
  {
    region: 'asia-south1',
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const db = admin.firestore();
    return await handleAutoAssignSalesperson(db, request.auth.uid);
  }
);

/**
 * 2nd-gen Callable Cloud Function: verifyReferralCode
 * Region: asia-south1
 */
exports.verifyReferralCode = onCall(
  {
    region: 'asia-south1',
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const db = admin.firestore();
    return await handleVerifyReferralCode(db, request.auth.uid, request.data);
  }
);

/**
 * Normalizes customer referral codes:
 * 1. Trim, uppercase, strip all whitespace.
 * 2. If matching /^ITA\d{6}$/ (e.g. "ITA554433"), converts to "ITA-554433".
 */
function normalizeCustomerReferralCode(code) {
  if (!code || typeof code !== 'string') return '';
  let clean = code.trim().toUpperCase().replace(/\s+/g, '');
  if (/^ITA\d{6}$/.test(clean)) {
    clean = 'ITA-' + clean.substring(3);
  }
  return clean;
}

/**
 * Basic abuse protection: limit customer referral verification attempts
 * to max 10 attempts per 10 minutes per phone number or IP.
 */
async function checkCustomerReferralRateLimit(db, identifier) {
  if (!identifier) return true;
  const safeId = String(identifier).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 64);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxAttempts = 10;
  const ref = db.collection('rate_limits').doc(`cust_ref_${safeId}`);

  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) {
        t.set(ref, { count: 1, resetAt: now + windowMs });
        return true;
      }
      const data = snap.data() || {};
      if (now > (data.resetAt || 0)) {
        t.set(ref, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if ((data.count || 0) >= maxAttempts) {
        return false;
      }
      t.update(ref, { count: admin.firestore.FieldValue.increment(1) });
      return true;
    });
  } catch (err) {
    logger.warn('[verifyCustomerReferralCode] Rate limit check error (allowing request):', err.message);
    return true;
  }
}

/**
 * Validates a customer referral code.
 * Strict Security Rules:
 * - Returns ONLY { valid: true } or { valid: false, reason: "not-found" | "self-referral" | "invalid-format" }
 * - NEVER exposes the referrer's name, phone, UID, or document data.
 * - Checks phone number from applicant to prevent self-referral.
 */
async function handleVerifyCustomerReferralCode(db, data, context = {}) {
  const rawCode = data ? data.referralCode : null;
  if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
    return { valid: false, reason: 'invalid-format' };
  }

  const cleanCode = normalizeCustomerReferralCode(rawCode);

  // Validate format: must be ITA- followed by alphanumeric code
  if (!/^ITA-[A-Z0-9]{3,12}$/.test(cleanCode)) {
    return { valid: false, reason: 'invalid-format' };
  }

  // Rate limiting by applicant phone or IP
  const applicantPhone = (data.phoneNumber || '').toString().replace(/[^0-9]/g, '');
  const callerIp = context.rawRequest?.ip || 'anon';
  const rateLimitKey = applicantPhone || callerIp;

  const isAllowed = await checkCustomerReferralRateLimit(db, rateLimitKey);
  if (!isAllowed) {
    logger.warn(`[verifyCustomerReferralCode] Rate limit exceeded for ${rateLimitKey}`);
    return { valid: false, reason: 'invalid-format' };
  }

  // Lookup in users collection
  const userSnap = await db.collection('users')
    .where('referralCode', '==', cleanCode)
    .limit(1)
    .get();

  if (userSnap.empty) {
    return { valid: false, reason: 'not-found' };
  }

  const referrerDoc = userSnap.docs[0];
  const referrerData = referrerDoc.data() || {};

  // Self-referral prevention:
  // 1. If caller is authenticated and matches referrer UID
  if (context.auth && context.auth.uid && context.auth.uid === referrerDoc.id) {
    return { valid: false, reason: 'self-referral' };
  }

  // 2. If applicant phone matches referrer's phone
  const referrerPhone = (referrerData.phone || referrerData.rawPhone || '').toString().replace(/[^0-9]/g, '');
  if (applicantPhone.length >= 10 && referrerPhone.length >= 10) {
    const appLast10 = applicantPhone.slice(-10);
    const refLast10 = referrerPhone.slice(-10);
    if (appLast10 === refLast10) {
      return { valid: false, reason: 'self-referral' };
    }
  }

  // Return ONLY valid: true. NO sensitive referrer data.
  return { valid: true };
}

/**
 * 2nd-gen Callable Cloud Function: verifyCustomerReferralCode
 * Region: asia-south1
 */
exports.verifyCustomerReferralCode = onCall(
  {
    region: 'asia-south1',
  },
  async (request) => {
    const db = admin.firestore();
    return await handleVerifyCustomerReferralCode(db, request.data, request);
  }
);

module.exports = {
  isClientActive,
  isStaffUser,
  normalizeReferralCode,
  computeReferralCodeKey,
  normalizeCustomerReferralCode,
  resolveSalespersonDoc,
  handleClientCreated,
  handleClientUpdated,
  handleClientDeleted,
  handleVerifyReferralCode,
  handleVerifyCustomerReferralCode,
  handleAutoAssignSalesperson,
  autoAssignSalesperson: exports.autoAssignSalesperson,
  verifyReferralCode: exports.verifyReferralCode,
  verifyCustomerReferralCode: exports.verifyCustomerReferralCode,
  onSalesPersonWrite: exports.onSalesPersonWrite,
  syncSalespersonOnClientCreated: exports.syncSalespersonOnClientCreated,
  syncSalespersonOnClientUpdated: exports.syncSalespersonOnClientUpdated,
  syncSalespersonOnClientDeleted: exports.syncSalespersonOnClientDeleted,
};
