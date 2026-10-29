/**
 * scripts/applyHsnCodes.js
 *
 * Bulk HSN Code Assignment Script for ITACON Products & Tiles
 *
 * Usage:
 *   node scripts/applyHsnCodes.js
 *   node scripts/applyHsnCodes.js --category=vitrified --overwrite
 *   node scripts/applyHsnCodes.js --category=tileAdhesive --overwrite
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');
const {
  FIELDS_USED_FOR_TYPE_DETECTION,
  resolveHsnCategory,
} = require('../functions/hsnMapping');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}
const db = admin.firestore();

function parseArgs() {
  const args = process.argv.slice(2);
  let category = null;
  let overwrite = false;

  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      category = arg.split('=')[1].trim();
    } else if (arg === '--overwrite') {
      overwrite = true;
    }
  }

  return { category, overwrite };
}

async function main() {
  const { category: filterCategory, overwrite } = parseArgs();

  console.log('====================================================');
  console.log('ITACON GRANITO — Bulk Product HSN Code Assignment');
  console.log('====================================================');
  if (filterCategory) {
    console.log(`Targeting category: ${filterCategory}`);
    console.log(`Overwrite mode: ${overwrite ? 'ENABLED' : 'DISABLED'}`);
  } else {
    console.log('Targeting: ALL CATEGORIES (Initial migration)');
  }

  // 1. Read config/hsnCodes from Firestore (single source of truth)
  console.log('\n[1/5] Reading HSN configuration from config/hsnCodes...');
  const configDoc = await db.collection('config').doc('hsnCodes').get();
  if (!configDoc.exists) {
    throw new Error('config/hsnCodes document not found in Firestore. Please initialize it first.');
  }
  const hsnConfig = configDoc.data() || {};
  console.log('Active HSN Codes:', {
    vitrified: hsnConfig.vitrified,
    ceramicFloor: hsnConfig.ceramicFloor,
    ceramicWall: hsnConfig.ceramicWall,
    tileAdhesive: hsnConfig.tileAdhesive,
  });

  const validCategories = ['vitrified', 'ceramicFloor', 'ceramicWall', 'tileAdhesive'];
  if (filterCategory && !validCategories.includes(filterCategory)) {
    throw new Error(`Invalid category "${filterCategory}". Valid options are: ${validCategories.join(', ')}`);
  }

  // 2. Fetch all products and tiles
  console.log('\n[2/5] Fetching products and tiles collections...');
  const productsSnap = await db.collection('products').get();
  const tilesSnap = await db.collection('tiles').get();

  const totalProducts = productsSnap.size;
  console.log(`Found ${totalProducts} products and ${tilesSnap.size} tiles in Firestore.`);

  const tilesIdSet = new Set(tilesSnap.docs.map(d => d.id));

  // 3. Create JSON backup of doc IDs and existing HSN data before writing
  console.log('\n[3/5] Creating pre-write backup in scripts/backup/...');
  const backupDir = path.join(__dirname, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `hsn_backup_${timestamp}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);

  const backupData = {
    createdAt: new Date().toISOString(),
    filterCategory: filterCategory || 'ALL',
    overwrite,
    totalProducts,
    products: productsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || d.productName || '',
        sku: d.sku || '',
        productType: d.productType || '',
        tileCategory: d.tileCategory || '',
        hsnCode: d.hsnCode || null,
        hsnCategory: d.hsnCategory || null,
      };
    }),
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Backup saved to: ${backupFilePath}`);

  // 4. Categorize products and prepare batch writes
  console.log('\n[4/5] Evaluating products and preparing writes...');
  const counts = {
    total: totalProducts,
    vitrified: 0,
    ceramicFloor: 0,
    ceramicWall: 0,
    tileAdhesive: 0,
    unmapped: 0,
    alreadyHadHsn: 0,
    updated: 0,
    skipped: 0,
  };

  const unmappedList = [];
  const samplesPerCategory = {
    vitrified: [],
    ceramicFloor: [],
    ceramicWall: [],
    tileAdhesive: [],
  };

  const pendingWrites = []; // Array of { ref, data }

  for (const doc of productsSnap.docs) {
    const d = doc.data();
    const docId = doc.id;
    const existingHsn = d.hsnCode;

    if (existingHsn) {
      counts.alreadyHadHsn++;
    }

    const category = resolveHsnCategory(d, docId);

    if (!category) {
      counts.unmapped++;
      unmappedList.push({
        id: docId,
        name: d.name || d.productName || 'Unnamed',
        sku: d.sku || 'No SKU',
        typeFieldValue: d.productType || d.type || d.tileCategory || 'None',
      });
      continue;
    }

    counts[category]++;
    const targetCode = hsnConfig[category];

    // Collect samples
    if (samplesPerCategory[category].length < 5) {
      samplesPerCategory[category].push({
        id: docId,
        name: d.name || d.productName || d.title || docId,
        sku: d.sku || '',
        hsnCode: targetCode,
        hsnCategory: category,
      });
    }

    // Check category filter
    if (filterCategory && category !== filterCategory) {
      counts.skipped++;
      continue;
    }

    // Check existing HSN code overwrite rule
    if (existingHsn && !(filterCategory && overwrite)) {
      counts.skipped++;
      continue;
    }

    // Prepare write payload (ONLY hsnCode and hsnCategory)
    const updatePayload = {
      hsnCode: targetCode,
      hsnCategory: category,
    };

    pendingWrites.push({
      ref: doc.ref,
      payload: updatePayload,
      docId,
    });

    // Also update mirror tile doc if present
    if (tilesIdSet.has(docId)) {
      pendingWrites.push({
        ref: db.collection('tiles').doc(docId),
        payload: updatePayload,
        docId: `tiles/${docId}`,
      });
    }

    counts.updated++;
  }

  // 5. Execute batched writes (max 400 operations per batch)
  console.log(`\n[5/5] Executing ${pendingWrites.length} write operations in batches of 400...`);
  const BATCH_SIZE = 400;
  let batchCount = 0;

  for (let i = 0; i < pendingWrites.length; i += BATCH_SIZE) {
    const chunk = pendingWrites.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const write of chunk) {
      batch.update(write.ref, write.payload);
    }

    await batch.commit();
    batchCount++;
    console.log(`  Committed batch ${batchCount} (${chunk.length} operations)...`);
  }

  console.log('\n====================================================');
  console.log('EXECUTION COMPLETED SUCCESSFULLY');
  console.log('====================================================');

  console.log('\n--- 1. Fields Used for Tile Type Detection ---');
  console.log(FIELDS_USED_FOR_TYPE_DETECTION.join(', '));

  console.log('\n--- 2. Counts Summary ---');
  console.log(`Total Products:       ${counts.total}`);
  console.log(`Vitrified:            ${counts.vitrified}`);
  console.log(`Ceramic Floor:        ${counts.ceramicFloor}`);
  console.log(`Ceramic Wall:         ${counts.ceramicWall}`);
  console.log(`Tile Adhesive:        ${counts.tileAdhesive}`);
  console.log(`UNMAPPED:             ${counts.unmapped}`);
  console.log(`Already had hsnCode:  ${counts.alreadyHadHsn}`);
  console.log(`Products Updated:     ${counts.updated}`);
  console.log(`Products Skipped:     ${counts.skipped}`);

  console.log('\n--- 3. UNMAPPED Products List ---');
  if (unmappedList.length === 0) {
    console.log('None.');
  } else {
    console.log('Doc ID | Name | SKU | Type Field Value');
    console.log('----------------------------------------------------');
    unmappedList.forEach(item => {
      console.log(`${item.id} | ${item.name} | ${item.sku} | ${item.typeFieldValue}`);
    });
  }

  console.log('\n--- 4. 5 Sample Docs Per Category ---');
  for (const [cat, samples] of Object.entries(samplesPerCategory)) {
    console.log(`\nCategory: ${cat} (HSN: ${hsnConfig[cat] || 'N/A'}) - Total: ${counts[cat]}`);
    if (samples.length === 0) {
      console.log('  (No products currently in database for this category)');
    } else {
      samples.forEach((s, idx) => {
        console.log(`  [${idx + 1}] ${s.name} (${s.sku}) -> hsnCode: "${s.hsnCode}"`);
      });
    }
  }

  console.log('\n--- 5. Backup File Path ---');
  console.log(backupFilePath);

  console.log('\n--- 6. Re-apply Command (if a code changes later) ---');
  console.log('To re-apply a specific category when config/hsnCodes is updated:');
  console.log('  node scripts/applyHsnCodes.js --category=vitrified --overwrite');
  console.log('  node scripts/applyHsnCodes.js --category=tileAdhesive --overwrite');
  console.log('  node scripts/applyHsnCodes.js --category=ceramicWall --overwrite');
  console.log('  node scripts/applyHsnCodes.js --category=ceramicFloor --overwrite');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});

