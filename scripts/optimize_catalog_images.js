/**
 * scripts/optimize_catalog_images.js
 * 
 * End-to-end Image Optimization Pipeline for ITACON Catalog:
 * 1. Backs up image path fields for all docs in `products` and `tiles`.
 * 2. Compresses all images under products/ > 200 KB to WebP:
 *    - Adhesives: max 800 px on long side, WebP quality 80 (target < 120 KB, preserves alpha).
 *    - Mockups & tiles: max 1200 px wide, WebP quality 78 (target < 200 KB).
 *    - Uploads with cacheControl "public, max-age=31536000".
 *    - Verifies HTTP 200 without login.
 * 3. Updates Firestore `products` and `tiles` with the verified .webp paths using batched writes.
 * 4. Runs automated verification, with auto-rollback on failure.
 * 5. Generates comprehensive audit report.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('../functions/node_modules/firebase-admin');
const sharp = require('./node_modules/sharp');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'itacon-app',
    storageBucket: 'itacon-app.firebasestorage.app'
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

const BACKUP_DIR = path.join(__dirname, 'backup');
const BACKUP_FILE = path.join(BACKUP_DIR, 'image_paths_backup_20261023.json');
const CONCURRENCY = 8;

// Build exhaustive local index of image files
function buildLocalIndex() {
  console.log('Building local disk file index...');
  const localIndex = new Map();
  function scan(dir) {
    try {
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of list) {
        if (e.isDirectory()) {
          if (!['.git', 'node_modules', 'build', '.dart_tool', 'android', 'ios', 'windows', 'linux', 'macos'].includes(e.name)) {
            scan(path.join(dir, e.name));
          }
        } else {
          const ext = path.extname(e.name).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            localIndex.set(e.name.toLowerCase().trim(), path.join(dir, e.name));
          }
        }
      }
    } catch (_) {}
  }
  scan('.');
  console.log(`Local index built: ${localIndex.size} files.`);
  return localIndex;
}

// Step 1: Backup
async function backupFirestoreImagePaths() {
  console.log('\n=== STEP 1: BACKUP FIRESTORE IMAGE PATHS ===');
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const pSnap = await db.collection('products').get();
  const tSnap = await db.collection('tiles').get();

  const backupData = {
    timestamp: new Date().toISOString(),
    products: [],
    tiles: []
  };

  pSnap.forEach(d => {
    const data = d.data();
    backupData.products.push({
      id: d.id,
      images: data.images || [],
      mockupImages: data.mockupImages || [],
      faceImages: data.faceImages || []
    });
  });

  tSnap.forEach(d => {
    const data = d.data();
    backupData.tiles.push({
      id: d.id,
      images: data.images || [],
      mockupImages: data.mockupImages || [],
      faceImages: data.faceImages || []
    });
  });

  if (backupData.products.length !== 303 || backupData.tiles.length !== 303) {
    throw new Error(`Backup validation failed: products=${backupData.products.length}, tiles=${backupData.tiles.length} (expected 303 each)`);
  }

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2), 'utf8');
  const stats = fs.statSync(BACKUP_FILE);
  console.log(`Backup successfully written to: ${BACKUP_FILE} (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log(`Verified ${backupData.products.length} products and ${backupData.tiles.length} tiles backed up.`);
  return backupData;
}

// HTTP 200 verify helper without login
function verifyUrlHttp200(destPath) {
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destPath)}?alt=media`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// Step 2: Optimize
async function optimizeImages(localIndex) {
  console.log('\n=== STEP 2: SCANNING STORAGE FOR IMAGES > 200 KB ===');
  const [files] = await bucket.getFiles({ prefix: 'products/' });
  console.log(`Total files in products/: ${files.length}`);

  const candidates = [];
  let skippedSmall = 0;
  const beforeFolderSizes = {};
  const afterFolderSizes = {};

  for (const f of files) {
    if (f.name.endsWith('/')) continue;
    const size = parseInt(f.metadata.size || 0, 10);
    const parts = f.name.split('/');
    const folder = parts.length > 2 ? parts[0] + '/' + parts[1] : parts[0];
    beforeFolderSizes[folder] = (beforeFolderSizes[folder] || 0) + size;

    if (size > 200 * 1024) {
      candidates.push({ file: f, name: f.name, size, folder });
    } else {
      skippedSmall++;
      afterFolderSizes[folder] = (afterFolderSizes[folder] || 0) + size;
    }
  }

  console.log(`Candidates > 200 KB to optimize: ${candidates.length}`);
  console.log(`Skipped <= 200 KB: ${skippedSmall}`);

  const successfulUploads = new Map(); // oldPath -> newWebpPath
  let processedCount = 0;
  let totalOptimizedBytes = 0;

  // Worker queue for concurrency
  async function processCandidate(item) {
    const ext = path.extname(item.name);
    const destPath = item.name.slice(0, -ext.length) + '.webp';
    const isAdhesive = item.name.includes('products/adhesives');

    try {
      // 1. Check if dest WebP already exists in storage and is valid
      const destFile = bucket.file(destPath);
      const [destExists] = await destFile.exists();
      if (destExists) {
        const [meta] = await destFile.getMetadata();
        const destSize = parseInt(meta.size || 0, 10);
        if (destSize > 0 && destSize < item.size) {
          const ok = await verifyUrlHttp200(destPath);
          if (ok) {
            successfulUploads.set(item.name, destPath);
            afterFolderSizes[item.folder] = (afterFolderSizes[item.folder] || 0) + destSize;
            totalOptimizedBytes += destSize;
            processedCount++;
            if (processedCount % 50 === 0 || processedCount === candidates.length) {
              console.log(`[${processedCount}/${candidates.length}] ${destPath} verified (${(destSize / 1024).toFixed(1)} KB)`);
            }
            return;
          }
        }
      }

      // 2. Read source image buffer (from local disk if available, else download from storage)
      let srcBuffer;
      const baseName = path.basename(item.name).toLowerCase().trim();
      if (localIndex.has(baseName)) {
        srcBuffer = fs.readFileSync(localIndex.get(baseName));
      } else {
        const [downloaded] = await item.file.download();
        srcBuffer = downloaded;
      }

      // 3. Compress using sharp
      let webpBuffer;
      if (isAdhesive) {
        webpBuffer = await sharp(srcBuffer)
          .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80, alphaQuality: 80 })
          .toBuffer();
      } else {
        webpBuffer = await sharp(srcBuffer)
          .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
      }

      // 4. Upload to storage
      await destFile.save(webpBuffer, {
        metadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000'
        }
      });

      // 5. Verify public HTTP 200 without login
      const verified = await verifyUrlHttp200(destPath);
      if (verified) {
        successfulUploads.set(item.name, destPath);
        afterFolderSizes[item.folder] = (afterFolderSizes[item.folder] || 0) + webpBuffer.length;
        totalOptimizedBytes += webpBuffer.length;
      } else {
        console.warn(`[WARNING] Verification failed for ${destPath}. Keeping original.`);
        afterFolderSizes[item.folder] = (afterFolderSizes[item.folder] || 0) + item.size;
      }
    } catch (err) {
      console.error(`[ERROR] Processing ${item.name}: ${err.message}. Keeping original.`);
      afterFolderSizes[item.folder] = (afterFolderSizes[item.folder] || 0) + item.size;
    }

    processedCount++;
    if (processedCount % 50 === 0 || processedCount === candidates.length) {
      console.log(`Progress: ${processedCount}/${candidates.length} images processed (${successfulUploads.size} successful)...`);
    }
  }

  // Execute queue with concurrency limit
  console.log(`Starting optimization with concurrency pool of ${CONCURRENCY}...`);
  const queue = [...candidates];
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) await processCandidate(item);
      }
    })());
  }
  await Promise.all(workers);

  console.log(`\nOptimization finished: ${successfulUploads.size} images uploaded & verified HTTP 200.`);
  return {
    successfulUploads,
    beforeFolderSizes,
    afterFolderSizes,
    candidatesCount: candidates.length,
    skippedSmall
  };
}

// Step 3: Update Firestore
async function updateFirestore(successfulUploads) {
  console.log('\n=== STEP 3: UPDATING FIRESTORE PRODUCTS AND TILES ===');
  function mapPath(p) {
    if (typeof p !== 'string') return p;
    const clean = p.startsWith('/') ? p.substring(1) : p;
    if (successfulUploads.has(clean)) {
      return successfulUploads.get(clean);
    }
    // Also try with leading slash if present
    if (successfulUploads.has('/' + clean)) {
      return successfulUploads.get('/' + clean);
    }
    return p;
  }

  let updatedProductsCount = 0;
  let updatedTilesCount = 0;

  // Update products collection
  const pSnap = await db.collection('products').get();
  let pBatch = db.batch();
  let pBatchOps = 0;

  for (const doc of pSnap.docs) {
    const data = doc.data();
    const oldImages = data.images || [];
    const oldMockups = data.mockupImages || [];
    const oldFaces = data.faceImages || [];

    const newImages = oldImages.map(mapPath);
    const newMockups = oldMockups.map(mapPath);
    const newFaces = oldFaces.map(mapPath);

    const changed = JSON.stringify(oldImages) !== JSON.stringify(newImages) ||
                    JSON.stringify(oldMockups) !== JSON.stringify(newMockups) ||
                    JSON.stringify(oldFaces) !== JSON.stringify(newFaces);

    if (changed) {
      pBatch.update(doc.ref, {
        images: newImages,
        mockupImages: newMockups,
        faceImages: newFaces
      });
      pBatchOps++;
      updatedProductsCount++;

      if (pBatchOps >= 400) {
        await pBatch.commit();
        pBatch = db.batch();
        pBatchOps = 0;
      }
    }
  }
  if (pBatchOps > 0) {
    await pBatch.commit();
  }
  console.log(`Updated ${updatedProductsCount} docs in 'products' collection.`);

  // Update tiles collection
  const tSnap = await db.collection('tiles').get();
  let tBatch = db.batch();
  let tBatchOps = 0;

  for (const doc of tSnap.docs) {
    const data = doc.data();
    const oldImages = data.images || [];
    const oldMockups = data.mockupImages || [];
    const oldFaces = data.faceImages || [];

    const newImages = oldImages.map(mapPath);
    const newMockups = oldMockups.map(mapPath);
    const newFaces = oldFaces.map(mapPath);

    const changed = JSON.stringify(oldImages) !== JSON.stringify(newImages) ||
                    JSON.stringify(oldMockups) !== JSON.stringify(newMockups) ||
                    JSON.stringify(oldFaces) !== JSON.stringify(newFaces);

    if (changed) {
      tBatch.update(doc.ref, {
        images: newImages,
        mockupImages: newMockups,
        faceImages: newFaces
      });
      tBatchOps++;
      updatedTilesCount++;

      if (tBatchOps >= 400) {
        await tBatch.commit();
        tBatch = db.batch();
        tBatchOps = 0;
      }
    }
  }
  if (tBatchOps > 0) {
    await tBatch.commit();
  }
  console.log(`Updated ${updatedTilesCount} docs in 'tiles' collection.`);

  return { updatedProductsCount, updatedTilesCount };
}

// Step 4: Verification
async function verifyPipeline() {
  console.log('\n=== STEP 4: VERIFYING INTEGRITY ===');
  const pCountSnap = await db.collection('products').count().get();
  const tCountSnap = await db.collection('tiles').count().get();

  const pCount = pCountSnap.data().count;
  const tCount = tCountSnap.data().count;

  console.log(`Products count: ${pCount} (expected 303)`);
  console.log(`Tiles count: ${tCount} (expected 303)`);

  if (pCount !== 303 || tCount !== 303) {
    throw new Error(`Integrity check failed: products=${pCount}, tiles=${tCount}`);
  }

  // Check 5 sample docs in products to verify images are .webp and return 200
  const sampleDocs = [
    'PROD_ADH_LX01',
    'PROD_ADH_LX04W',
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_001',
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_003',
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_010'
  ];

  for (const docId of sampleDocs) {
    const snap = await db.collection('products').doc(docId).get();
    if (!snap.exists) continue;
    const data = snap.data();
    const testPath = (data.images && data.images[0]) || (data.mockupImages && data.mockupImages[0]);
    if (testPath) {
      const ok = await verifyUrlHttp200(testPath.startsWith('/') ? testPath.substring(1) : testPath);
      console.log(`Sample doc ${docId}: image ${testPath} -> HTTP 200: ${ok}`);
      if (!ok) {
        throw new Error(`Sample doc ${docId} image failed HTTP 200: ${testPath}`);
      }
    }
  }

  console.log('All verification checks passed successfully!');
}

// Auto Rollback
async function rollback() {
  console.error('\n!!! ROLLING BACK ALL CHANGES FROM BACKUP !!!');
  const restoreScript = require('./restore_image_paths');
  // Or run child process
  const { execSync } = require('child_process');
  execSync(`node scripts/restore_image_paths.js "${BACKUP_FILE}"`, { stdio: 'inherit' });
  console.log('Rollback finished.');
}

async function run() {
  const startTime = Date.now();
  let backupData;

  try {
    // 1. Backup
    backupData = await backupFirestoreImagePaths();

    // 2. Build local index
    const localIndex = buildLocalIndex();

    // 3. Optimize
    const optResult = await optimizeImages(localIndex);

    // 4. Update Firestore
    const updateResult = await updateFirestore(optResult.successfulUploads);

    // 5. Verification
    await verifyPipeline();

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    // 6. Report
    console.log('\n================================================================');
    console.log('                OPTIMIZATION COMPLETE REPORT                    ');
    console.log('================================================================');
    console.log(`Execution Time: ${durationSec} seconds`);
    console.log(`Images Optimized: ${optResult.successfulUploads.size}`);
    console.log(`Images Skipped (<= 200 KB): ${optResult.skippedSmall}`);
    console.log(`Docs Updated: products=${updateResult.updatedProductsCount}, tiles=${updateResult.updatedTilesCount}`);
    console.log('\nFolder Sizes (Before vs After):');
    for (const folder of Object.keys(optResult.beforeFolderSizes)) {
      const beforeMb = (optResult.beforeFolderSizes[folder] / (1024 * 1024)).toFixed(2);
      const afterMb = ((optResult.afterFolderSizes[folder] || 0) / (1024 * 1024)).toFixed(2);
      const reduction = (100 - (optResult.afterFolderSizes[folder] / optResult.beforeFolderSizes[folder]) * 100).toFixed(1);
      console.log(`  ${folder}: ${beforeMb} MB -> ${afterMb} MB (${reduction}% reduction)`);
    }

    console.log('\nUndo Command:');
    console.log(`  node scripts/restore_image_paths.js "${BACKUP_FILE}"`);
    console.log('\nNOTE: The original large image files have been preserved in Firebase Storage.');
    console.log('They should only be deleted after user confirmation, at least 7 days post-launch.');
    console.log('================================================================');

  } catch (err) {
    console.error('\n[FATAL ERROR] Pipeline failed:', err.message);
    try {
      await rollback();
    } catch (rbErr) {
      console.error('[FATAL ERROR] Rollback error:', rbErr.message);
    }
    process.exit(1);
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
