const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { resolveHsnCategory, hasTileTypeChanged } = require('./hsnMapping');

if (!admin.apps.length) {
  admin.initializeApp();
}

// In-memory cache for config/hsnCodes with a 5-minute TTL to reduce Firestore reads
let cachedHsnCodes = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getHsnCodes() {
  const now = Date.now();
  if (cachedHsnCodes && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedHsnCodes;
  }
  const snap = await admin.firestore().collection('config').doc('hsnCodes').get();
  if (snap.exists) {
    cachedHsnCodes = snap.data() || {};
    cacheTimestamp = now;
    return cachedHsnCodes;
  }
  return null;
}

/**
 * assignHsnCode: 2nd Gen Firestore trigger on products/{id}
 *
 * Automatically assigns hsnCode & hsnCategory from config/hsnCodes when:
 * 1. A new product is created without an hsnCode.
 * 2. An existing product is updated such that its tile type changed,
 *    provided hsnManualOverride is not true.
 *
 * Prevents loops: skips write if hsnCode and hsnCategory already match target values.
 * Also mirrors the two fields to matching tiles/{id} document for consistency.
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

    const isMissingHsn = !afterData.hsnCode || !afterData.hsnCategory;
    const typeChanged = beforeData ? hasTileTypeChanged(beforeData, afterData) : false;
    const hasManualOverride = afterData.hsnManualOverride === true;

    // Only proceed if hsnCode is missing, OR (type changed AND manual override is not enabled)
    if (!isMissingHsn && (!typeChanged || hasManualOverride)) {
      return;
    }

    // 2. Decide HSN category using shared mapping logic
    const category = resolveHsnCategory(afterData, docId);
    if (!category) {
      logger.warn(`[assignHsnCode] Could not determine HSN category for product ${docId}`, {
        name: afterData.name || afterData.productName,
        sku: afterData.sku,
        productType: afterData.productType,
      });
      return;
    }

    // 3. Load active HSN codes from config/hsnCodes
    const hsnCodes = await getHsnCodes();
    if (!hsnCodes) {
      logger.error('[assignHsnCode] config/hsnCodes not found in Firestore. Cannot assign HSN code.');
      return;
    }

    const targetCode = hsnCodes[category];
    if (!targetCode) {
      logger.warn(`[assignHsnCode] No HSN code mapped in config/hsnCodes for category "${category}"`);
      return;
    }

    // 4. Infinite Loop Guard: Skip if already up-to-date
    if (afterData.hsnCode === targetCode && afterData.hsnCategory === category) {
      return;
    }

    logger.info(`[assignHsnCode] Assigning HSN ${targetCode} (${category}) to product ${docId}`);

    const updatePayload = {
      hsnCode: targetCode,
      hsnCategory: category,
    };

    // Update products/{id}
    await event.data.after.ref.update(updatePayload);

    // Also mirror to tiles/{id} if matching doc exists
    try {
      const tileRef = admin.firestore().collection('tiles').doc(docId);
      const tileSnap = await tileRef.get();
      if (tileSnap.exists) {
        const tileData = tileSnap.data() || {};
        if (tileData.hsnCode !== targetCode || tileData.hsnCategory !== category) {
          await tileRef.update(updatePayload);
          logger.info(`[assignHsnCode] Mirrored HSN ${targetCode} (${category}) to tiles/${docId}`);
        }
      }
    } catch (tileErr) {
      logger.warn(`[assignHsnCode] Failed to mirror HSN to tiles/${docId}:`, tileErr);
    }
  }
);

