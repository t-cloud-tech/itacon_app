const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const axios = require('axios');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Allowed staff roles permitted to access the web portal.
 */
const ALLOWED_STAFF_ROLES = Object.freeze(['admin', 'manager', 'salesperson']);

/**
 * Normalizes Indian phone numbers according to canonical app behavior:
 * - 9624818477 -> +919624818477
 * - +919624818477 -> +919624818477
 * - 919624818477 -> +919624818477
 * - +91 96248-18477 -> +919624818477
 * Canonical stored format in Firestore is +91XXXXXXXXXX.
 */
function normalizeIndianPhone(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') return '';
  const digits = phoneNumber.replace(/\D/g, '');

  // 12 digits starting with 91: e.g. 919624818477 -> +919624818477
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }

  // 10 digits: e.g. 9624818477 -> +919624818477
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // If already starts with '+' and has digits
  if (phoneNumber.trim().startsWith('+')) {
    return `+${digits}`;
  }

  // Fallback
  return digits ? `+${digits}` : phoneNumber.trim();
}

/**
 * Checks whether the login identifier is an email address.
 */
function isEmailIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return false;
  return identifier.trim().includes('@');
}

/**
 * Normalizes email address safely.
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Validates identity evidence between candidate legacy document and canonical profile.
 * Confirms normalized email/phone overlap to prevent trusting arbitrary userId links.
 */
function isIdentityConsistent(candidateData, canonicalData) {
  let hasCompared = false;

  if (candidateData.email && canonicalData.email) {
    if (normalizeEmail(candidateData.email) !== normalizeEmail(canonicalData.email)) {
      return false;
    }
    hasCompared = true;
  }

  const candPhone = normalizeIndianPhone(candidateData.phone || candidateData.phoneNumber);
  const canonPhone = normalizeIndianPhone(canonicalData.phone || canonicalData.phoneNumber);
  if (candPhone && canonPhone) {
    if (candPhone !== canonPhone) {
      return false;
    }
    hasCompared = true;
  }

  // If both documents have zero overlapping email/phone identifiers, linkage cannot be verified safely
  if (!hasCompared) {
    return false;
  }

  return true;
}

/**
 * Verifies a password against stored SHA-256 salt+hash using constant-time comparison
 * to eliminate timing-attack vulnerabilities.
 * Matches Flutter app & staff seeder: SHA-256("${salt}:${password}")
 */
function verifyPasswordHash(password, salt, storedHash) {
  if (!password || !salt || !storedHash || typeof password !== 'string') return false;

  const computedHashHex = crypto
    .createHash('sha256')
    .update(`${salt}:${password}`)
    .digest('hex');

  const computedBuf = Buffer.from(computedHashHex, 'utf8');
  const storedBuf = Buffer.from(storedHash, 'utf8');

  if (computedBuf.length !== storedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuf, storedBuf);
}

/**
 * Core business logic for staff credential verification.
 * Isolated for unit testing without requiring live GCP Cloud Function emulators.
 */
async function processStaffVerification({
  firestoreDb,
  authAdmin,
  httpClient,
  apiKey,
  identifier,
  password,
}) {
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Please enter your email or registered phone number.'
    );
  }

  if (!password || typeof password !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Please enter your password.'
    );
  }

  const trimmedIdent = identifier.trim();
  const isEmail = isEmailIdentifier(trimmedIdent);
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

  // 1. Multi-candidate identity lookup in authoritative users collection (no arbitrary limit(1))
  if (isEmail) {
    const cleanEmail = normalizeEmail(trimmedIdent);
    const snap = await usersRef.where('email', '==', cleanEmail).limit(10).get();
    addCandidates(snap);
  } else {
    const canonicalPhone = normalizeIndianPhone(trimmedIdent);
    const rawDigits = trimmedIdent.replace(/\D/g, '');

    // Canonical phone lookup
    const snap1 = await usersRef.where('phone', '==', canonicalPhone).limit(10).get();
    addCandidates(snap1);

    // Fallback if stored without + prefix
    if (rawDigits && rawDigits !== canonicalPhone) {
      const snap2 = await usersRef.where('phone', '==', rawDigits).limit(10).get();
      addCandidates(snap2);
    }

    // Fallback if stored with raw trimmed value
    if (trimmedIdent !== canonicalPhone && trimmedIdent !== rawDigits) {
      const snap3 = await usersRef.where('phone', '==', trimmedIdent).limit(10).get();
      addCandidates(snap3);
    }

    // Legacy staff fallback to phoneNumber field if present
    const snap4 = await usersRef.where('phoneNumber', '==', canonicalPhone).limit(10).get();
    addCandidates(snap4);
    if (rawDigits && rawDigits !== canonicalPhone) {
      const snap5 = await usersRef.where('phoneNumber', '==', rawDigits).limit(10).get();
      addCandidates(snap5);
    }
  }

  // 2. Reject nonexistent accounts generically to prevent user enumeration
  if (candidateDocsMap.size === 0) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Invalid login credentials.'
    );
  }

  // 3. Resolve canonical identities and validate legacy links
  // Map of canonicalUid -> { canonicalDoc, candidates: [] }
  const canonicalResolutions = new Map();

  for (const [docId, candidateDoc] of candidateDocsMap.entries()) {
    const candidateData = candidateDoc.data() || {};
    const linkedUid = candidateData.userId || candidateData.uid;

    if (linkedUid && linkedUid !== docId) {
      // Legacy document linking to a canonical profile
      const linkedDocSnap = await usersRef.doc(linkedUid).get();
      if (!linkedDocSnap.exists) {
        console.warn(`[StaffAuth] Invalid link: doc ${docId} references nonexistent canonical UID ${linkedUid}`);
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Invalid login credentials.'
        );
      }

      const canonicalData = linkedDocSnap.data() || {};

      // Validate identity evidence between candidate and canonical document
      if (!isIdentityConsistent(candidateData, canonicalData)) {
        console.warn(`[StaffAuth] Identity mismatch between legacy doc ${docId} and canonical UID ${linkedUid}`);
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Invalid login credentials.'
        );
      }

      if (!canonicalResolutions.has(linkedUid)) {
        canonicalResolutions.set(linkedUid, {
          canonicalDoc: linkedDocSnap,
          candidates: [],
        });
      }
      canonicalResolutions.get(linkedUid).candidates.push(candidateDoc);
    } else {
      // Candidate itself is treated as canonical identity candidate
      if (!canonicalResolutions.has(docId)) {
        canonicalResolutions.set(docId, {
          canonicalDoc: candidateDoc,
          candidates: [],
        });
      }
      canonicalResolutions.get(docId).candidates.push(candidateDoc);
    }
  }

  // 4. Multiple Match Ambiguity Safety: Candidates must resolve to exactly ONE canonical identity
  if (canonicalResolutions.size === 0) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Invalid login credentials.'
    );
  }

  if (canonicalResolutions.size > 1) {
    console.warn(
      `[StaffAuth] AMBIGUOUS_STAFF_IDENTITY: identifier matches conflicting canonical identities (${[...canonicalResolutions.keys()].join(', ')})`
    );
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Invalid login credentials.'
    );
  }

  // Extract the single authoritative canonical identity
  const [canonicalUid, { canonicalDoc, candidates }] = [...canonicalResolutions.entries()][0];
  const canonicalUserData = canonicalDoc.data() || {};

  // 5. Canonical Profile Role Authorization (Staff only: admin, manager, salesperson)
  // Authoritative role MUST come from the CANONICAL profile; legacy role cannot override it.
  const canonicalRole = String(canonicalUserData.role || canonicalUserData.userCategory || '').toLowerCase().trim();
  if (!ALLOWED_STAFF_ROLES.includes(canonicalRole)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Access Denied: This web portal is restricted to authorized staff accounts.'
    );
  }

  // 6. Canonical Profile Account Status Validation
  const canonicalStatus = String(canonicalUserData.status || 'active').toLowerCase().trim();
  if (
    canonicalStatus === 'inactive' ||
    canonicalStatus === 'blocked' ||
    canonicalStatus === 'disabled' ||
    canonicalUserData.isActive === false
  ) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Your account has been deactivated or blocked. Please contact admin.'
    );
  }

  // 7. Credential Verification across associated candidate documents & Firebase Auth
  let passwordValid = false;

  // Path A: Check all candidate documents linked to this canonical identity (e.g. legacy seeded credential record)
  for (const candDoc of candidates) {
    const cData = candDoc.data() || {};
    if (cData.passwordHash && cData.passwordSalt) {
      if (verifyPasswordHash(password, cData.passwordSalt, cData.passwordHash)) {
        passwordValid = true;
        break;
      }
    }
  }

  // Path B: If not verified, fallback to standard Firebase Auth password verification for canonical email
  if (!passwordValid && canonicalUserData.email && httpClient && apiKey) {
    try {
      const response = await httpClient.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          email: canonicalUserData.email,
          password,
          returnSecureToken: true,
        }
      );
      if (
        response &&
        response.data &&
        (response.data.localId === canonicalUid ||
          normalizeEmail(response.data.email) === normalizeEmail(canonicalUserData.email))
      ) {
        passwordValid = true;
      }
    } catch (_) {
      passwordValid = false;
    }
  }

  if (!passwordValid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Invalid login credentials.'
    );
  }

  // 8. Generate Firebase Custom Token for the CANONICAL UID (never legacy document ID)
  const customToken = await authAdmin.createCustomToken(canonicalUid);

  // Return strictly minimal token payload - NEVER return hashes, salts, or user doc
  return {
    customToken,
  };
}

/**
 * Callable Cloud Function: verifyStaffCredentials
 * Provides secure server-side authentication for ITACON enterprise staff portal.
 */
const verifyStaffCredentials = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
  const firestoreDb = admin.firestore();
  const authAdmin = admin.auth();
  const apiKey = process.env.FIREBASE_WEB_API_KEY || "AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ";

  const { identifier, password } = data || {};

  return processStaffVerification({
    firestoreDb,
    authAdmin,
    httpClient: axios,
    apiKey,
    identifier,
    password,
  });
});

module.exports = {
  verifyStaffCredentials,
  normalizeIndianPhone,
  isEmailIdentifier,
  verifyPasswordHash,
  ALLOWED_STAFF_ROLES,
  processStaffVerification,
};
