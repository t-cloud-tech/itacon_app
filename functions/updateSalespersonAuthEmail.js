const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const ADMIN_ROLES = ['admin', 'superadmin', 'super_admin'];

/**
 * Admin-only: changes the Firebase Auth email of a salesperson.
 * Returns { updated: boolean } - updated=false when the salesperson has no Auth account
 * (staff created with a fallback uid), in which case only Firestore needs the new email.
 */
async function processUpdateEmail({ firestoreDb, authAdmin, callerUid, data }) {
  if (!callerUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  }
  const callerSnap = await firestoreDb.collection('users').doc(callerUid).get();
  const role = String((callerSnap.exists && callerSnap.data().role) || '').toLowerCase().trim();
  if (!ADMIN_ROLES.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can change a salesperson email.');
  }

  const salesPersonId = typeof data.salesPersonId === 'string' ? data.salesPersonId.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!salesPersonId) {
    throw new functions.https.HttpsError('invalid-argument', 'salesPersonId is required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter a valid email address.');
  }

  try {
    await authAdmin.updateUser(salesPersonId, { email });
    return { updated: true };
  } catch (err) {
    if (err.code === 'auth/user-not-found') return { updated: false };
    if (err.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Another account already uses this email.');
    }
    if (err.code === 'auth/invalid-email') {
      throw new functions.https.HttpsError('invalid-argument', 'Enter a valid email address.');
    }
    throw new functions.https.HttpsError('internal', 'Could not update the login email. Please try again.');
  }
}

const updateSalespersonAuthEmail = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => processUpdateEmail({
    firestoreDb: admin.firestore(),
    authAdmin: admin.auth(),
    callerUid: context.auth && context.auth.uid,
    data: data || {},
  }));

module.exports = { updateSalespersonAuthEmail, processUpdateEmail };
