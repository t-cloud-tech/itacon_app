const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Customer category ids -> { label, mirror collection } as used by the mobile app
 * (FirestoreService.getCategoryCollectionName / UserCategory).
 */
const CATEGORIES = Object.freeze({
  dealer: { label: 'Tile Dealer / Showroom', collection: 'dealers' },
  architect: { label: 'Architect / Interior Designer', collection: 'architects' },
  builder: { label: 'Builder / Contractor', collection: 'builders' },
  wholesaler: { label: 'Wholesaler / Distributor', collection: 'wholesalers' },
  retailer: { label: 'Retailer', collection: 'retailers' },
  trader: { label: 'Trader', collection: 'traders' },
});

const PASSWORD_SPECIALS = '!@#$%^&*';

function normalizeIndianPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return '';
}

/** Mirrors AuthService.validatePassword in the mobile app. */
function validatePassword(password) {
  if (typeof password !== 'string' || password.trim().length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  const p = password.trim();
  if (!/[A-Z]/.test(p)) return 'Password must contain at least 1 uppercase letter (A-Z).';
  if (!/[a-z]/.test(p)) return 'Password must contain at least 1 lowercase letter (a-z).';
  if (!/[0-9]/.test(p)) return 'Password must contain at least 1 number (0-9).';
  if (!/[!@#$%^&*]/.test(p)) return 'Password must contain at least 1 special character (!@#$%^&*).';
  return null;
}

function randomFrom(chars) {
  return chars[crypto.randomInt(chars.length)];
}

function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const chars = [
    randomFrom(upper), randomFrom(lower), randomFrom(digits), randomFrom(PASSWORD_SPECIALS),
  ];
  while (chars.length < 10) chars.push(randomFrom(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function slugUsername(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'customer';
}

/** App password format: base64url salt, SHA-256("salt:password"). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return { salt, hash };
}

function str(v, max = 200) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

async function resolveCaller({ firestoreDb, uid }) {
  const snap = await firestoreDb.collection('users').doc(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  const role = String(data.role || '').toLowerCase().trim();
  if (!['admin', 'manager', 'salesperson'].includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins and salespersons can add customers.');
  }
  const status = String(data.status || 'active').toLowerCase();
  if (['inactive', 'blocked', 'suspended', 'disabled'].includes(status) || data.isActive === false) {
    throw new functions.https.HttpsError('permission-denied', 'Your account is inactive.');
  }
  return { role, data };
}

async function resolveSalesperson({ firestoreDb, salesPersonId }) {
  const spSnap = await firestoreDb.collection('salesPersons').doc(salesPersonId).get();
  const userSnap = await firestoreDb.collection('users').doc(salesPersonId).get();
  const sp = spSnap.exists ? spSnap.data() || {} : null;
  const u = userSnap.exists ? userSnap.data() || {} : null;
  if (!sp && !(u && String(u.role).toLowerCase() === 'salesperson')) {
    throw new functions.https.HttpsError('invalid-argument', 'Selected salesperson was not found.');
  }
  const d = sp || u;
  return {
    id: salesPersonId,
    name: str(d.name || d.fullName || (u && (u.name || u.fullName)) || 'Salesperson'),
    phone: str(d.phone || d.phoneNumber || (u && (u.phone || u.phoneNumber)) || ''),
    referralCode: str(d.referralCode || (u && u.referralCode) || '').toUpperCase(),
  };
}

async function processCreateCustomer({ firestoreDb, authAdmin, callerUid, data }) {
  if (!callerUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  }
  const caller = await resolveCaller({ firestoreDb, uid: callerUid });

  const name = str(data.name, 100);
  const companyName = str(data.companyName, 150);
  const categoryId = str(data.category).toLowerCase();
  const phone = normalizeIndianPhone(data.phone);
  const email = str(data.email, 150).toLowerCase();

  if (!name) throw new functions.https.HttpsError('invalid-argument', 'Customer name is required.');
  if (!CATEGORIES[categoryId]) throw new functions.https.HttpsError('invalid-argument', 'Please select a valid customer category.');
  if (!phone) throw new functions.https.HttpsError('invalid-argument', 'Enter a valid 10-digit mobile number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter a valid email address.');
  }

  // Salesperson: always themselves. Admin/manager: must pick one.
  let salesPersonId = caller.role === 'salesperson'
    ? callerUid
    : str(data.salesPersonId);
  if (caller.role === 'salesperson') {
    salesPersonId = str(caller.data.salesPersonId) || callerUid;
  }
  if (!salesPersonId) {
    throw new functions.https.HttpsError('invalid-argument', 'Please assign a salesperson.');
  }
  const sp = await resolveSalesperson({ firestoreDb, salesPersonId });

  // Credentials
  let password = typeof data.password === 'string' && data.password.trim() ? data.password.trim() : generatePassword();
  const pwError = validatePassword(password);
  if (pwError) throw new functions.https.HttpsError('invalid-argument', pwError);

  const usersRef = firestoreDb.collection('users');

  // Duplicate phone guard (Firestore + Auth)
  const phoneDup = await usersRef.where('phone', '==', phone).limit(1).get();
  if (!phoneDup.empty) {
    throw new functions.https.HttpsError('already-exists', 'A customer with this mobile number already exists.');
  }

  let username = str(data.username, 40).toLowerCase();
  if (username) {
    if (!/^[a-z0-9._]{4,40}$/.test(username)) {
      throw new functions.https.HttpsError('invalid-argument', 'Username must be 4-40 characters: letters, numbers, dot or underscore.');
    }
    const dup = await usersRef.where('username', '==', username).limit(1).get();
    if (!dup.empty) throw new functions.https.HttpsError('already-exists', 'This username is already taken.');
  } else {
    const base = slugUsername(name);
    for (let i = 0; i < 10 && !username; i++) {
      const candidate = `${base}${crypto.randomInt(1000, 10000)}`;
      const dup = await usersRef.where('username', '==', candidate).limit(1).get();
      if (dup.empty) username = candidate;
    }
    if (!username) throw new functions.https.HttpsError('aborted', 'Could not generate a unique username. Try again.');
  }

  // Firebase Auth user keyed by phone so the customer's OTP login resolves to the same uid.
  let uid;
  let createdAuthUser = false;
  try {
    const existing = await authAdmin.getUserByPhoneNumber(phone);
    const existingDoc = await usersRef.doc(existing.uid).get();
    if (existingDoc.exists) {
      throw new functions.https.HttpsError('already-exists', 'A customer with this mobile number already exists.');
    }
    uid = existing.uid;
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await authAdmin.createUser({ phoneNumber: phone, displayName: name });
    uid = created.uid;
    createdAuthUser = true;
  }

  const cat = CATEGORIES[categoryId];
  const { salt, hash } = hashPassword(password);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const address = {
    line1: str(data.address, 300),
    city: str(data.city, 80),
    state: str(data.state, 80),
    pincode: str(data.pincode, 10),
  };

  const docData = {
    userId: uid,
    uid,
    name,
    username,
    companyName,
    phone,
    countryCode: '+91',
    rawPhone: phone.slice(3),
    email,
    gstNumber: str(data.gstNumber, 20).toUpperCase(),
    // Plain category id (e.g. "dealer"): accepted by the app's category helpers and
    // security rules, and rendered correctly by the staff portal.
    userCategory: categoryId,
    role: categoryId,
    salesPersonId: sp.id,
    assignedSalespersonId: sp.id,
    salespersonName: sp.name,
    salespersonPhone: sp.phone,
    salespersonReferralCode: sp.referralCode,
    referralCode: `ITA-${crypto.randomInt(100000, 1000000)}`,
    status: 'active',
    phoneVerified: true,
    emailVerified: false,
    whatsappVerified: false,
    isVerified: true,
    address,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    passwordHash: hash,
    passwordSalt: salt,
    passwordAlgorithm: 'sha256',
    createdBy: callerUid,
    createdByRole: caller.role,
    createdAt: now,
    updatedAt: now,
  };

  // Category mirror: public business metadata only (no credentials / allocation fields).
  const mirror = { ...docData };
  [
    'salesPersonId', 'assignedSalespersonId', 'salespersonName', 'salespersonPhone',
    'salespersonReferralCode', 'passwordHash', 'passwordSalt', 'passwordAlgorithm',
    'username', 'createdBy', 'createdByRole',
  ].forEach((k) => delete mirror[k]);
  mirror.categoryLabel = cat.label;

  try {
    const batch = firestoreDb.batch();
    batch.set(usersRef.doc(uid), docData, { merge: true });
    batch.set(firestoreDb.collection(cat.collection).doc(uid), mirror, { merge: true });
    await batch.commit();
  } catch (err) {
    if (createdAuthUser) {
      try { await authAdmin.deleteUser(uid); } catch (_) { /* best effort rollback */ }
    }
    throw new functions.https.HttpsError('internal', 'Could not save the customer. Please try again.');
  }

  return {
    customerId: uid,
    username,
    password,
    salespersonName: sp.name,
  };
}

const createCustomerByStaff = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => processCreateCustomer({
    firestoreDb: admin.firestore(),
    authAdmin: admin.auth(),
    callerUid: context.auth && context.auth.uid,
    data: data || {},
  }));

module.exports = {
  createCustomerByStaff,
  processCreateCustomer,
  validatePassword,
  generatePassword,
  normalizeIndianPhone,
  hashPassword,
};
