const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const {
  resolveHsnCategory,
  hasTileTypeChanged,
  resolveProductGrade,
} = require('./hsnMapping');

if (!admin.apps.length) {
  admin.initializeApp();
}

// In-memory cache for config/hsnCodes with a 5-minute TTL to reduce Firestore reads
let cachedHsnCodes = null;
let hsnCacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getHsnCodes() {
  const now = Date.now();
  if (cachedHsnCodes && (now - hsnCacheTimestamp < CACHE_TTL_MS)) {
    return cachedHsnCodes;
  }
  const snap = await admin.firestore().collection('config').doc('hsnCodes').get();
  if (snap.exists) {
    cachedHsnCodes = snap.data() || {};
    hsnCacheTimestamp = now;
    return cachedHsnCodes;
  }
  return null;
}

// In-memory cache for config/productGrades with a 5-minute TTL
let cachedProductGrades = null;
let gradeCacheTimestamp = 0;

async function getProductGrades() {
  const now = Date.now();
  if (cachedProductGrades && (now - gradeCacheTimestamp < CACHE_TTL_MS)) {
    return cachedProductGrades;
  }
  const snap = await admin.firestore().collection('config').doc('productGrades').get();
  if (snap.exists) {
    cachedProductGrades = snap.data() || {};
    gradeCacheTimestamp = now;
    return cachedProductGrades;
  }
  return null;
}

/**
 * assignHsnCode: 2nd Gen Firestore trigger on products/{id}
 *
 * Automatically assigns hsnCode, hsnCategory, grade, & gradeLabel when:
 * 1. A new product is created.
 * 2. An existing product is updated such that its tile type or surface finish changed,
 *    provided manual overrides (hsnManualOverride, gradeManualOverride) are not true.
 *
 * Prevents loops: skips write if target values already match existing document fields.
 * Also mirrors updated fields to matching tiles/{id} document for consistency.
 */
exports.assignHsnCode = onDocumentWritten(
  {
    document: 'products/{id}',
    region: 'asia-south1',
  },
  async (event) => {
    // 1. If document was deleted, nothing to do
    if (!event.data || !event.data.after.exists) {
      return;
    }

    const docId = event.params.id;
    const afterData = event.data.after.data() || {};
    const beforeData = event.data.before.exists ? event.data.before.data() : null;

    const updatePayload = {};

    // =========================================================================
    // A. HSN Code Assignment
    // =========================================================================
    const hasHsnManualOverride = afterData.hsnManualOverride === true;
    if (!hasHsnManualOverride) {
      const isMissingHsn = !afterData.hsnCode || !afterData.hsnCategory;
      const typeChanged = beforeData ? hasTileTypeChanged(beforeData, afterData) : false;

      if (isMissingHsn || typeChanged) {
        const category = resolveHsnCategory(afterData, docId);
        if (category) {
          const hsnCodes = await getHsnCodes();
          if (hsnCodes && hsnCodes[category]) {
            const targetCode = hsnCodes[category];
            if (afterData.hsnCode !== targetCode || afterData.hsnCategory !== category) {
              updatePayload.hsnCode = targetCode;
              updatePayload.hsnCategory = category;
            }
          }
        }
      }
    }

    // =========================================================================
    // B. Product Grade Assignment
    // =========================================================================
    const hasGradeManualOverride = afterData.gradeManualOverride === true;
    if (!hasGradeManualOverride) {
      const isMissingGrade = !afterData.grade || !afterData.gradeLabel;
      const surfaceChanged = beforeData
        ? (beforeData.surface !== afterData.surface || beforeData.finish !== afterData.finish)
        : false;

      if (isMissingGrade || surfaceChanged) {
        const productGrades = await getProductGrades();
        if (productGrades) {
          const resolvedGrade = resolveProductGrade(afterData, productGrades);
          if (resolvedGrade) {
            if (
              afterData.grade !== resolvedGrade.grade ||
              afterData.gradeLabel !== resolvedGrade.gradeLabel
            ) {
              updatePayload.grade = resolvedGrade.grade;
              updatePayload.gradeLabel = resolvedGrade.gradeLabel;
            }
          }
        }
      }
    }

    // 4. Infinite Loop Guard: Skip write if nothing changed
    if (Object.keys(updatePayload).length === 0) {
      return;
    }

    logger.info(`[assignHsnCode] Updating product ${docId} with:`, updatePayload);

    // Update products/{id}
    await event.data.after.ref.update(updatePayload);

    // Also mirror to tiles/{id} if matching doc exists
    try {
      const tileRef = admin.firestore().collection('tiles').doc(docId);
      const tileSnap = await tileRef.get();
      if (tileSnap.exists) {
        const tileData = tileSnap.data() || {};
        const tileUpdates = {};
        for (const [k, v] of Object.entries(updatePayload)) {
          if (tileData[k] !== v) {
            tileUpdates[k] = v;
          }
        }
        if (Object.keys(tileUpdates).length > 0) {
          await tileRef.update(tileUpdates);
          logger.info(`[assignHsnCode] Mirrored updates to tiles/${docId}:`, tileUpdates);
        }
      }
    } catch (tileErr) {
      logger.warn(`[assignHsnCode] Failed to mirror updates to tiles/${docId}:`, tileErr);
    }
  }
);
