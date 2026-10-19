const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Permitted staff and executive roles authorized to run credit/defaulter lookups.
 * Regular customers are strictly forbidden from arbitrary third-party credit checks.
 */
const AUTHORIZED_ROLES = Object.freeze([
  'admin',
  'super_admin',
  'manager',
  'salesperson',
  'staff',
]);

/**
 * Proxy rate-limiting: 30 lookups per 15-minute rolling window per user UID.
 */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOOKUPS_PER_WINDOW = 30;
const userLookupCache = new Map();

/**
 * Normalizes Indian Goods and Services Tax Identification Number (GSTIN).
 * Format: 15 alphanumeric characters.
 */
function normalizeGst(gst) {
  if (!gst || typeof gst !== 'string') return '';
  const cleaned = gst.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned;
}

/**
 * Normalizes Indian mobile phone numbers: extracts digits and standardizes to 10 digits.
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Masks GSTIN for privacy-compliant server-side logging (e.g. 24AA****1Z8).
 */
function maskGst(gst) {
  if (!gst || gst.length < 8) return '****';
  return `${gst.substring(0, 4)}****${gst.substring(gst.length - 3)}`;
}

/**
 * Masks phone number for privacy-compliant server-side logging (e.g. ******1234).
 */
function maskPhone(phone) {
  if (!phone || phone.length < 4) return '****';
  return `******${phone.slice(-4)}`;
}

/**
 * Validates in-memory rate limit for a caller UID.
 */
function checkProxyRateLimit(uid) {
  const now = Date.now();
  const entry = userLookupCache.get(uid);

  if (!entry || now - entry.startTime > RATE_LIMIT_WINDOW_MS) {
    userLookupCache.set(uid, { count: 1, startTime: now });
    return { allowed: true };
  }

  if (entry.count >= MAX_LOOKUPS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((entry.startTime + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  entry.count += 1;
  return { allowed: true };
}

const DEFAULT_PROD_API_BASE_URL = 'https://api.businessdefaulters.com/api/external';

/**
 * Resolves external API configuration from environment variables or Firebase config.
 */
function getApiConfig() {
  const envUrl = process.env.BUSINESS_DEFAULTERS_API_URL;
  const envKey = process.env.BUSINESS_DEFAULTERS_API_KEY;

  let configUrl;
  let configKey;
  try {
    const fbConfig = functions.config();
    if (fbConfig && fbConfig.business_defaulters) {
      configUrl = fbConfig.business_defaulters.api_url;
      configKey = fbConfig.business_defaulters.api_key;
    }
  } catch (_) {
    // functions.config() may not be initialized in non-deployed/local environments
  }

  const rawUrl = envUrl || configUrl || DEFAULT_PROD_API_BASE_URL;
  const rawKey = envKey || configKey;

  return {
    apiUrl: rawUrl ? rawUrl.replace(/\/+$/, '') : null,
    apiKey: rawKey || null,
  };
}

/**
 * Core business defaulters lookup business logic.
 * Decoupled from Firebase Callable wrapper to enable comprehensive unit and integration testing.
 */
async function processDefaulterCheck({
  data,
  callerUid,
  firestoreDb,
  httpClient = axios,
  configOverride = null,
}) {
  if (!callerUid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication is required to query the business defaulter registry.'
    );
  }

  // 1. Fetch caller profile to verify explicit role authorization
  const db = firestoreDb || admin.firestore();
  const userDoc = await db.collection('users').doc(callerUid).get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Caller account profile not found.'
    );
  }

  const userData = userDoc.data() || {};
  const userRole = (userData.role || '').toLowerCase().trim();
  const rawStatus = userData.status;
  const userStatus = typeof rawStatus === 'string' ? rawStatus.toLowerCase().trim() : '';

  // Enforce status requirement: status must be explicitly 'active'.
  // Accounts that are blocked, suspended, inactive, or missing status are strictly denied.
  if (!userStatus || userStatus !== 'active') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Account status is inactive, suspended, or unverified. Access to the business defaulter registry is restricted.'
    );
  }

  // Enforce role authorization: only authorized staff roles can access the API.
  const isStaffRole = AUTHORIZED_ROLES.includes(userRole);
  const hasExplicitManagementOverride = Boolean(
    userData.canCheckDefaulters && userData.managementAuthorizedDefaulterAccess === true
  );

  // Customer accounts cannot gain access merely through canCheckDefaulters unless explicitly authorized by management
  if (!isStaffRole && !hasExplicitManagementOverride) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Access denied. Business Defaulter verification is strictly restricted to authorized sales and management staff.'
    );
  }

  // 2. Validate and sanitize inputs
  const rawGst = data?.gst;
  const rawPhone = data?.phone;

  const normalizedGst = normalizeGst(rawGst);
  const normalizedPhone = normalizePhone(rawPhone);

  if (!normalizedGst && !normalizedPhone) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      "Please provide at least one search field: valid 'gst' or 'phone'."
    );
  }

  if (normalizedGst && normalizedGst.length !== 15) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid GSTIN format. A valid Indian GSTIN must contain exactly 15 alphanumeric characters.'
    );
  }

  if (normalizedPhone && normalizedPhone.length !== 10) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid phone format. Please provide a valid 10-digit mobile number.'
    );
  }

  // 3. Enforce proxy rate limiting
  const rateLimitStatus = checkProxyRateLimit(callerUid);
  if (!rateLimitStatus.allowed) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Lookup rate limit reached. Please retry in ${rateLimitStatus.retryAfterSec} seconds.`
    );
  }

  // 4. Resolve API configuration
  const config = configOverride || getApiConfig();
  if (!config.apiUrl || !config.apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Business Defaulters API is not configured on this server environment. Missing production API credentials.'
    );
  }

  // 5. Construct payload and dispatch secure HTTPS request
  const requestPayload = {};
  if (normalizedGst) requestPayload.gst = normalizedGst;
  if (normalizedPhone) requestPayload.phone = normalizedPhone;

  const targetEndpoint = config.apiUrl.endsWith('/check-defaulter')
    ? config.apiUrl
    : `${config.apiUrl}/check-defaulter`;

  try {
    const response = await httpClient.post(targetEndpoint, requestPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      timeout: 10000,
    });

    const resData = response.data || {};

    // 6. Whitelist and sanitize returned fields for the Flutter UI
    const parties = Array.isArray(resData.parties)
      ? resData.parties.map((p) => ({
          id: String(p.id || ''),
          companyName: String(p.companyName || ''),
          gst: String(p.gst || ''),
          city: String(p.city || ''),
          state: String(p.state || ''),
          address: String(p.address || ''),
          phone: String(p.phone || ''),
        }))
      : [];

    const rawRisk = (resData.riskLevel || '').toUpperCase();
    const validRisks = ['HIGH', 'MEDIUM', 'LOW', 'CLEAN', 'SAFE'];
    const sanitizedRisk = validRisks.includes(rawRisk)
      ? rawRisk
      : resData.exists
      ? (resData.isDefaulter ? 'HIGH' : 'CLEAN')
      : 'SAFE';

    const reportCount = resData.reportCount || {};
    const sanitizedReportCount = {
      total: Number(reportCount.total) || 0,
      verified: Number(reportCount.verified) || 0,
      pending: Number(reportCount.pending) || 0,
      closed: Number(reportCount.closed) || 0,
    };

    return {
      success: true,
      exists: Boolean(resData.exists),
      isDefaulter: Boolean(resData.isDefaulter),
      riskLevel: sanitizedRisk,
      matchedCount: Number(resData.matchedCount) || parties.length,
      reportCount: sanitizedReportCount,
      parties,
      message: resData.message || (resData.exists ? 'Matching record located.' : 'No matching record found in the database.'),
      disclaimer:
        'SAFE indicates no negative records exist in the database; it does not certify financial health. Pending reports are unverified creditor claims under review.',
    };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    if (error.response) {
      const status = error.response.status;
      const apiMsg = error.response.data?.message || 'External credit check service error.';

      if (status === 400) {
        throw new functions.https.HttpsError('invalid-argument', apiMsg);
      }
      if (status === 401) {
        throw new functions.https.HttpsError(
          'internal',
          'External partner authentication failed. Please contact administrator.'
        );
      }
      if (status === 403) {
        throw new functions.https.HttpsError(
          'unavailable',
          'External partner API key has been deactivated. Please contact support.'
        );
      }
      if (status === 429) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'External partner rate limit exceeded. Please wait a few minutes before retrying.'
        );
      }
      if (status >= 500) {
        throw new functions.https.HttpsError(
          'unavailable',
          'Business Defaulters verification service is currently experiencing upstream issues.'
        );
      }

      throw new functions.https.HttpsError('internal', apiMsg);
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'Verification request timed out. Please verify connectivity and try again.'
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      'An unexpected network error occurred while communicating with the verification service.'
    );
  }
}

/**
 * Callable Firebase Cloud Function: checkBusinessDefaulterCallable
 * Region: asia-south1
 * Binds Google Cloud Secret Manager secret: BUSINESS_DEFAULTERS_API_KEY
 */
const checkBusinessDefaulterCallable = functions
  .region('asia-south1')
  .runWith({
    secrets: ['BUSINESS_DEFAULTERS_API_KEY'],
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    return processDefaulterCheck({
      data,
      callerUid: context?.auth?.uid,
    });
  });

module.exports = {
  checkBusinessDefaulterCallable,
  processDefaulterCheck,
  normalizeGst,
  normalizePhone,
  maskGst,
  maskPhone,
  checkProxyRateLimit,
  AUTHORIZED_ROLES,
  userLookupCache,
};
