const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Allowed customer categories/roles permitted to log into the mobile app.
 */
const ALLOWED_CUSTOMER_ROLES = Object.freeze([
  'dealer', 'dealers', 'tile dealer / showroom',
  'architect', 'architects', 'architect / interior designer', 'architect/interior designer',
  'builder', 'builders', 'builder / contractor', 'builder/contractor',
  'wholesaler', 'wholesalers', 'wholesaler / distributor', 'wholesaler/distributor',
  'retailer', 'retailers',
  'trader', 'traders',
  'customer'
]);

/**
 * Explicit staff roles strictly forbidden from customer mobile login
 * to prevent portal cross-confusion and enforce principle of least privilege.
 */
const FORBIDDEN_STAFF_ROLES = Object.freeze([
  'admin', 'manager', 'salesperson', 'staff', 'super_admin'
]);

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_COLLECTION = 'auth_rate_limits';

/**
 * In-memory L1 cache to fast-path rate limiting within the same Cloud Function instance.
 */
const localAttemptMap = new Map();

/**
 * Generates a deterministic, privacy-safe hash key for rate-limiting an identifier.
 */
function getRateLimitDocId(normalizedIdentifier) {
  return crypto
    .createHash('sha256')
    .update(`customer:${normalizedIdentifier}`)
    .digest('hex');
}

/**
 * Distributed rate limiter check across all Cloud Function instances.
 * Reads authoritative state from Firestore collection `auth_rate_limits`.
 */
async function checkRateLimitDistributed({ firestoreDb, normalizedUser }) {
  const docId = getRateLimitDocId(normalizedUser);
  const now = Date.now();

  // Authoritative L2 Firestore check across all instances
  try {
    const docRef = firestoreDb.collection(RATE_LIMIT_COLLECTION).doc(docId);
    const snap = await docRef.get();

    if (snap.exists) {
      const data = snap.data() || {};
      if (data.lockedUntil && data.lockedUntil > now) {
        const waitSeconds = Math.ceil((data.lockedUntil - now) / 1000);
        localAttemptMap.set(docId, { lockedUntil: data.lockedUntil });
        return {
          allowed: false,
          waitSeconds: Math.max(waitSeconds, 1),
        };
      } else {
        // Lockout expired
        localAttemptMap.delete(docId);
      }
    } else {
      localAttemptMap.delete(docId);
    }
  } catch (err) {
    // Graceful fallback to local cache if Firestore read fails
    const localRecord = localAttemptMap.get(docId);
    if (localRecord && localRecord.lockedUntil && localRecord.lockedUntil > now) {
      const waitSeconds = Math.ceil((localRecord.lockedUntil - now) / 1000);
      return {
        allowed: false,
        waitSeconds: Math.max(waitSeconds, 1),
      };
    }
  }

  return { allowed: true };
}

/**
 * Records a failed login attempt transactionally across all Cloud Function instances.
 */
async function recordFailedAttemptDistributed({ firestoreDb, normalizedUser }) {
  const docId = getRateLimitDocId(normalizedUser);
  const now = Date.now();

  try {
    const docRef = firestoreDb.collection(RATE_LIMIT_COLLECTION).doc(docId);
    await firestoreDb.runTransaction(async (t) => {
      const snap = await t.get(docRef);
      let failedCount = 1;
      let firstFailedAt = now;
      let lockedUntil = null;

      if (snap.exists) {
        const data = snap.data() || {};
        // If the last failure is older than the window, reset the counter
        if (data.lastFailedAt && (now - data.lastFailedAt > LOCKOUT_WINDOW_MS)) {
          failedCount = 1;
          firstFailedAt = now;
        } else {
          failedCount = (data.failedCount || 0) + 1;
          firstFailedAt = data.firstFailedAt || now;
        }
      }

      if (failedCount >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = now + LOCKOUT_WINDOW_MS;
        localAttemptMap.set(docId, { lockedUntil });
      }

      t.set(docRef, {
        identifierHash: docId,
        failedCount,
        firstFailedAt,
        lastFailedAt: now,
        lockedUntil,
        expiresAt: now + (24 * 60 * 60 * 1000), // 24-hour retention for auto-cleanup
      }, { merge: true });
    });
  } catch (err) {
    // If distributed write fails, update local cache
    const current = localAttemptMap.get(docId) || { count: 0 };
    current.count = (current.count || 0) + 1;
    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.lockedUntil = now + LOCKOUT_WINDOW_MS;
    }
    localAttemptMap.set(docId, current);
  }
}

/**
 * Clears rate limiting upon successful credential verification.
 */
async function clearRateLimitDistributed({ firestoreDb, normalizedUser }) {
  const docId = getRateLimitDocId(normalizedUser);
  localAttemptMap.delete(docId);

  try {
    const docRef = firestoreDb.collection(RATE_LIMIT_COLLECTION).doc(docId);
    await docRef.delete();
  } catch (err) {
    // Non-blocking cleanup
  }
}

/**
 * Normalizes username safely: trims and converts to lowercase.
 */
function normalizeUsername(username) {
  if (!username || typeof username !== 'string') return '';
  return username.trim().toLowerCase();
}

/**
 * Verifies a password against stored SHA-256 salt+hash using constant-time comparison.
 * Supports primary canonical ITACON format: SHA-256("${salt}:${password}")
 * and backward-compatible legacy format: SHA-256("${salt}_${password}")
 */
function verifySha256Hash(password, salt, storedHash) {
  if (!password || !salt || !storedHash || typeof password !== 'string') return false;

  const storedBuf = Buffer.from(storedHash, 'utf8');

  // 1. Primary canonical ITACON separator: ":"
  const colonHashHex = crypto
    .createHash('sha256')
    .update(`${salt}:${password}`)
    .digest('hex');
  const colonBuf = Buffer.from(colonHashHex, 'utf8');

  if (colonBuf.length === storedBuf.length && crypto.timingSafeEqual(colonBuf, storedBuf)) {
    return true;
  }

  // 2. Backward-compatible legacy separator: "_"
  const underscoreHashHex = crypto
    .createHash('sha256')
    .update(`${salt}_${password}`)
    .digest('hex');
  const underscoreBuf = Buffer.from(underscoreHashHex, 'utf8');

  if (underscoreBuf.length === storedBuf.length && crypto.timingSafeEqual(underscoreBuf, storedBuf)) {
    return true;
  }

  return false;
}

/**
 * Verifies password using modern memory-hard password-based KDF (scrypt).
 */
function verifyScryptHash(password, salt, storedHash) {
  if (!password || !salt || !storedHash || typeof password !== 'string') return false;

  try {
    const computedBuf = crypto.scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (computedBuf.length !== storedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Computes a modern scrypt password hash.
 */
function hashPasswordScrypt(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * Multi-algorithm password verifier supporting legacy SHA-256 and modern scrypt.
 */
function verifyPassword(password, salt, storedHash, algorithm = 'sha256') {
  // Defensive auto-detection based on hash length:
  // SHA-256 hex is exactly 64 characters (32 bytes).
  // Scrypt hex is exactly 128 characters (64 bytes).
  if (storedHash && storedHash.length === 64) {
    const isSha256 = verifySha256Hash(password, salt, storedHash);
    if (isSha256) return true;
  }

  if (algorithm === 'scrypt' || (storedHash && storedHash.length === 128)) {
    return verifyScryptHash(password, salt, storedHash);
  }

  return verifySha256Hash(password, salt, storedHash);
}

/**
 * Safely migrates a legacy SHA-256 password hash to scrypt without service disruption.
 * Strictly non-blocking: failure to migrate will NOT prevent the customer from logging in.
 */
async function migratePasswordHashIfNeeded({
  userDocRef,
  password,
  currentAlgorithm,
  enableMigration = false,
}) {
  if (!enableMigration || currentAlgorithm === 'scrypt') {
    return;
  }

  try {
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPasswordScrypt(password, newSalt);

    await userDocRef.update({
      passwordHash: newHash,
      passwordSalt: newSalt,
      passwordAlgorithm: 'scrypt',
      passwordMigratedAt: Date.now(),
    });
  } catch (err) {
    // Catch safely — never crash login and never log credentials
  }
}

/**
 * Core business logic for customer credential verification.
 */
async function processCustomerVerification({
  firestoreDb,
  authAdmin,
  username,
  password,
  clientIp,
  enablePasswordMigration = false,
}) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Please enter your username.'
    );
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Please enter your password.'
    );
  }

  const rawUsername = username.trim();
  const normalizedUser = normalizeUsername(rawUsername);

  // 1. Distributed Rate Limiting Check (Shared across all Cloud Function instances)
  const rateLimit = await checkRateLimitDistributed({
    firestoreDb,
    normalizedUser,
  });

  if (!rateLimit.allowed) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Too many failed login attempts. Please wait ${Math.ceil(rateLimit.waitSeconds / 60)} minute(s) before trying again.`
    );
  }

  const usersRef = firestoreDb.collection('users');
  const candidateDocsMap = new Map();

  function addCandidates(snapshot) {
    if (snapshot && !snapshot.empty) {
      for (const d of snapshot.docs) {
        if (!candidateDocsMap.has(d.id)) {
          candidateDocsMap.set(d.id, d);
        }
      }
    }
  }

  // 2. Query candidates by username (canonical lower-case)
  const snapUsername = await usersRef.where('username', '==', normalizedUser).limit(10).get();
  addCandidates(snapUsername);

  if (candidateDocsMap.size === 0) {
    const snapUserNameCamel = await usersRef.where('userName', '==', normalizedUser).limit(10).get();
    addCandidates(snapUserNameCamel);
  }

  // Case-sensitive exact match if user entered mixed casing
  if (candidateDocsMap.size === 0 && rawUsername !== normalizedUser) {
    const snapRawUsername = await usersRef.where('username', '==', rawUsername).limit(10).get();
    addCandidates(snapRawUsername);
  }

  // Fallback: Query by name / fullName ONLY if username query produced 0 matches
  if (candidateDocsMap.size === 0) {
    const snapName = await usersRef.where('name', '==', rawUsername).limit(10).get();
    if (snapName && !snapName.empty) {
      for (const d of snapName.docs) {
        const dData = d.data() || {};
        const explicitUsername = normalizeUsername(dData.username || dData.userName);
        // Security guard: If account has an explicit username that differs from input,
        // display name fallback is NOT permitted to hijack or resolve the account.
        if (!explicitUsername || explicitUsername === normalizedUser) {
          candidateDocsMap.set(d.id, d);
        }
      }
    }

    if (candidateDocsMap.size === 0) {
      const snapFullName = await usersRef.where('fullName', '==', rawUsername).limit(10).get();
      if (snapFullName && !snapFullName.empty) {
        for (const d of snapFullName.docs) {
          const dData = d.data() || {};
          const explicitUsername = normalizeUsername(dData.username || dData.userName);
          if (!explicitUsername || explicitUsername === normalizedUser) {
            candidateDocsMap.set(d.id, d);
          }
        }
      }
    }
  }

  // Fallback: If user entered phone number as username
  const cleanDigits = rawUsername.replace(/\D/g, '');
  if (candidateDocsMap.size === 0 && cleanDigits.length >= 10) {
    const formattedPhone = cleanDigits.length === 10 ? `+91${cleanDigits}` : (rawUsername.startsWith('+') ? rawUsername : `+${cleanDigits}`);
    const snapPhone = await usersRef.where('phone', '==', formattedPhone).limit(10).get();
    addCandidates(snapPhone);

    if (candidateDocsMap.size === 0) {
      const snapRawPhone = await usersRef.where('rawPhone', '==', cleanDigits).limit(10).get();
      addCandidates(snapRawPhone);
    }
  }

  // 3. Resolve canonical identities from candidates
  const canonicalResolutions = new Map();

  for (const candidateDoc of candidateDocsMap.values()) {
    const cData = candidateDoc.data() || {};
    const canonicalUid = cData.userId || cData.uid || candidateDoc.id;

    if (canonicalUid) {
      if (!canonicalResolutions.has(canonicalUid)) {
        canonicalResolutions.set(canonicalUid, {
          canonicalDoc: candidateDoc,
          candidates: [],
        });
      }
      canonicalResolutions.get(canonicalUid).candidates.push(candidateDoc);
    }
  }

  // 4. Ambiguity & Missing Account Safety
  if (canonicalResolutions.size === 0) {
    await recordFailedAttemptDistributed({ firestoreDb, normalizedUser });
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Invalid username or password. Please check your credentials and try again.'
    );
  }

  if (canonicalResolutions.size > 1) {
    await recordFailedAttemptDistributed({ firestoreDb, normalizedUser });
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Multiple accounts match this identifier. Please contact support or sign in with your mobile number.'
    );
  }

  const [canonicalUid, { canonicalDoc }] = [...canonicalResolutions.entries()][0];
  const canonicalUserData = canonicalDoc.data() || {};

  // 5. Role Authorization: Customer roles only, reject staff
  const canonicalRole = String(canonicalUserData.role || canonicalUserData.userCategory || '').toLowerCase().trim();

  if (FORBIDDEN_STAFF_ROLES.includes(canonicalRole)) {
    await recordFailedAttemptDistributed({ firestoreDb, normalizedUser });
    throw new functions.https.HttpsError(
      'permission-denied',
      'Access Denied: Staff accounts must use the official staff web portal.'
    );
  }

  const isAllowedCustomer = ALLOWED_CUSTOMER_ROLES.some((allowed) =>
    canonicalRole.toLowerCase().includes(allowed)
  );

  if (!isAllowedCustomer && canonicalRole !== '') {
    await recordFailedAttemptDistributed({ firestoreDb, normalizedUser });
    throw new functions.https.HttpsError(
      'permission-denied',
      'Access Denied: This account is not registered as an authorized customer.'
    );
  }

  // 6. Account Status Validation
  const canonicalStatus = String(canonicalUserData.status || 'active').toLowerCase().trim();
  if (
    ['inactive', 'blocked', 'suspended', 'disabled'].includes(canonicalStatus) ||
    canonicalUserData.isActive === false
  ) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Your account is currently inactive or blocked. Please contact support.'
    );
  }

  // 7. Password Verification
  const storedHash = canonicalUserData.passwordHash;
  const storedSalt = canonicalUserData.passwordSalt;
  const storedAlgorithm = canonicalUserData.passwordAlgorithm || 'sha256';

  if (!storedHash || !storedSalt) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Account setup incomplete. Please reset your password or contact support.'
    );
  }

  const isPasswordValid = verifyPassword(password, storedSalt, storedHash, storedAlgorithm);

  if (!isPasswordValid) {
    await recordFailedAttemptDistributed({ firestoreDb, normalizedUser });
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Invalid username or password. Please check your credentials and try again.'
    );
  }

  // 8. Successful Verification: Clear distributed rate limit
  await clearRateLimitDistributed({ firestoreDb, normalizedUser });

  // 9. Backward-compatible Password Migration (if enabled)
  if (storedAlgorithm !== 'scrypt') {
    await migratePasswordHashIfNeeded({
      userDocRef: canonicalDoc.ref,
      password,
      currentAlgorithm: storedAlgorithm,
      enableMigration: enablePasswordMigration,
    });
  }

  // 10. Generate Firebase Custom Token for the canonical UID
  const customToken = await authAdmin.createCustomToken(canonicalUid);

  return {
    customToken,
  };
}

/**
 * Callable Cloud Function: verifyCustomerCredentials
 * Provides secure server-side customer authentication for ITACON mobile application.
 */
const verifyCustomerCredentials = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const firestoreDb = admin.firestore();
    const authAdmin = admin.auth();
    const { username, password } = data || {};
    const clientIp = context?.rawRequest?.ip || '';

    return processCustomerVerification({
      firestoreDb,
      authAdmin,
      username,
      password,
      clientIp,
      enablePasswordMigration: false, // Default off in production until authorized
    });
  });

module.exports = {
  verifyCustomerCredentials,
  processCustomerVerification,
  normalizeUsername,
  verifyPassword,
  verifySha256Hash,
  verifyScryptHash,
  hashPasswordScrypt,
  migratePasswordHashIfNeeded,
  checkRateLimitDistributed,
  recordFailedAttemptDistributed,
  clearRateLimitDistributed,
  getRateLimitDocId,
  ALLOWED_CUSTOMER_ROLES,
  FORBIDDEN_STAFF_ROLES,
};

