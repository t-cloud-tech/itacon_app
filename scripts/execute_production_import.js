/**
 * ITACON GRANITO — Production Import & Live Verification Script
 *
 * Implements Phase 7:
 * 1. Parallel Upload of 547 Originals + 547 WebP Thumbnails (1,094 objects total) to Firebase Storage
 * 2. Idempotent Upsert of 138 Tile Products to Firestore `products` and `tiles` collections
 * 3. Live Storage & Firestore read-back verification
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const XLSX = require('./node_modules/xlsx');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = 'D:/Itacon Product (2) (1) (2).xlsx';
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'build', 'glossy_thumbnails_manifest.json');
const STORAGE_BUCKET = 'itacon-app.firebasestorage.app';
const FIREBASE_API_KEY = 'AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ';
const FIREBASE_PROJECT_ID = 'itacon-app';

function getCliAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config.tokens.access_token;
}

// ----------------------------------------------------------------------
// Storage Upload Helpers
// ----------------------------------------------------------------------
function uploadFileToStorage(token, localFilePath, destinationPath, contentType) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(localFilePath);
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(destinationPath)}`;

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': fileData.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (_) {
            resolve({ raw: body });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function uploadInParallel(token, uploadTasks, concurrency = 10, label = 'Files') {
  let index = 0;
  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;
  const failures = [];
  const total = uploadTasks.length;

  console.log(`Starting parallel upload of ${total} ${label} (concurrency: ${concurrency})...`);

  async function worker() {
    while (index < total) {
      const task = uploadTasks[index++];
      if (task.alreadyExists) {
        skippedCount++;
        continue;
      }

      let attempt = 0;
      let uploaded = false;
      while (attempt < 3 && !uploaded) {
        attempt++;
        try {
          await uploadFileToStorage(token, task.localPath, task.destinationPath, task.contentType);
          uploaded = true;
          successCount++;
          if ((successCount + skippedCount) % 50 === 0 || (successCount + skippedCount) === total) {
            console.log(`  [${label}] Uploaded ${successCount + skippedCount}/${total} (${(((successCount + skippedCount) / total) * 100).toFixed(1)}%)...`);
          }
        } catch (err) {
          if (attempt >= 3) {
            failCount++;
            failures.push({ task, error: err.message });
            console.error(`  ERROR on ${task.destinationPath}:`, err.message);
          } else {
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return { successCount, skippedCount, failCount, failures };
}

// ----------------------------------------------------------------------
// Firestore Upsert Helpers (REST API with API Key)
// ----------------------------------------------------------------------
function convertToFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(convertToFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function writeFirestoreDocument(collection, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      fields[k] = convertToFirestoreValue(v);
    }

    const payload = JSON.stringify({ fields });
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;

    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('======================================================================');
  console.log('PHASE 7 — PRODUCTION IMPORT TO FIREBASE STORAGE & FIRESTORE');
  console.log('======================================================================\n');

  const token = getCliAccessToken();
  if (!token) {
    console.error('FATAL: Could not get Firebase CLI access token from firebase-tools.json.');
    process.exit(1);
  }

  // 1. Load Thumbnail Manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`FATAL: Manifest not found at ${MANIFEST_PATH}. Run generate_glossy_thumbnails.js first.`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  console.log(`Loaded image manifest: ${manifest.length} images.`);

  // 2. Query Existing Storage Files to Skip Existing
  console.log('\nChecking existing objects in Firebase Storage bucket...');
  let existingStorageObjects = new Set();
  let pageToken = '';
  try {
    do {
      const url = `https://storage.googleapis.com/storage/v1/b/${STORAGE_BUCKET}/o?maxResults=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
      const data = await new Promise((resolve, reject) => {
        https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(body));
            } else {
              resolve({ items: [] });
            }
          });
        }).on('error', () => resolve({ items: [] }));
      });

      if (data.items) {
        data.items.forEach(i => existingStorageObjects.add(i.name));
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.warn('Warning during storage enumeration:', err.message);
  }
  console.log(`Current objects in bucket: ${existingStorageObjects.size}`);

  // 3. Prepare Upload Tasks
  const originalTasks = [];
  const thumbnailTasks = [];

  for (const item of manifest) {
    const ext = path.extname(item.localSourcePath).toLowerCase();
    const origContentType = ext === '.png' ? 'image/png' : 'image/jpeg';

    originalTasks.push({
      localPath: item.localSourcePath,
      destinationPath: item.finalOriginalStoragePath,
      contentType: origContentType,
      alreadyExists: existingStorageObjects.has(item.finalOriginalStoragePath)
    });

    thumbnailTasks.push({
      localPath: item.localThumbPath,
      destinationPath: item.finalThumbnailStoragePath,
      contentType: 'image/webp',
      alreadyExists: existingStorageObjects.has(item.finalThumbnailStoragePath)
    });
  }

  // 4. Upload Originals (547)
  console.log('\n--- UPLOADING ORIGINAL HIGH-RES IMAGES ---');
  const origResults = await uploadInParallel(token, originalTasks, 12, 'Originals');
  if (origResults.failCount > 0) {
    console.error(`FATAL: ${origResults.failCount} originals failed to upload!`);
    process.exit(1);
  }
  console.log(`Originals Upload Complete: ${origResults.successCount} uploaded, ${origResults.skippedCount} skipped, 0 failures.`);

  // 5. Upload WebP Thumbnails (547)
  console.log('\n--- UPLOADING WEBP THUMBNAILS ---');
  const thumbResults = await uploadInParallel(token, thumbnailTasks, 12, 'Thumbnails');
  if (thumbResults.failCount > 0) {
    console.error(`FATAL: ${thumbResults.failCount} thumbnails failed to upload!`);
    process.exit(1);
  }
  console.log(`Thumbnails Upload Complete: ${thumbResults.successCount} uploaded, ${thumbResults.skippedCount} skipped, 0 failures.`);

  // 6. Parse Excel Products & Map Images
  console.log('\n--- PREPARING FIRESTORE PRODUCTS (138 Excel Tile Products) ---');
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet2 = wb.Sheets['2'];
  const rawRows = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' });
  const productRows = rawRows.slice(2).filter(r => r && r[1] && String(r[1]).trim().length > 0);

  // Group images by SKU
  const imagesBySku = new Map();
  for (const item of manifest) {
    if (!imagesBySku.has(item.sku)) {
      imagesBySku.set(item.sku, { faces: [], mockups: [] });
    }
    const entry = imagesBySku.get(item.sku);
    if (item.isRoomMockup) {
      entry.mockups.push({ path: item.finalOriginalStoragePath, sequence: item.sequence });
    } else {
      entry.faces.push({ path: item.finalOriginalStoragePath, sequence: item.sequence });
    }
  }

  const firestoreBatchProducts = [];
  for (let i = 0; i < productRows.length; i++) {
    const row = productRows[i];
    const sku = String(row[1]).trim();
    const designName = String(row[9]).trim();
    const shortCode = String(row[8]).trim();
    const surface = String(row[5]).trim() || 'Glossy';
    const collection = String(row[6]).trim() || 'Marble - Random';
    const baseColor = String(row[7]).trim() || 'White Statuario';
    const sizeRaw = String(row[3]).trim();
    const size = sizeRaw === '60X120' ? '600x1200 mm' : (sizeRaw.includes('x') || sizeRaw.includes('X') ? `${sizeRaw} mm` : sizeRaw);
    const thickness = Number(row[4]) || 8.5;
    const boxWeight = Number(row[11]) || 27.0;
    const pcsPerBox = parseInt(row[12], 10) || 2;
    const sqFtPerBox = Number(row[13]) || 15.5;
    const price = Number(row[14]) || 35.0;
    const moq = parseInt(row[15], 10) || 100;
    const stockStatusRaw = String(row[16]).trim().toUpperCase();
    const stockQty = parseInt(row[17], 10) || 100;
    const spacesRaw = String(row[10]).trim();

    const docId = 'PROD_' + sku.replace(/[^a-zA-Z0-9]/g, '_');

    // Retrieve images for this SKU
    const imgData = imagesBySku.get(sku) || { faces: [], mockups: [] };
    imgData.faces.sort((a, b) => a.sequence - b.sequence);
    imgData.mockups.sort((a, b) => a.sequence - b.sequence);

    const facePaths = imgData.faces.map(f => f.path);
    const mockupPaths = imgData.mockups.map(m => m.path);
    const allImages = facePaths.length > 0 ? [...facePaths] : [...mockupPaths];

    const firestoreData = {
      id: docId,
      productId: docId,
      sku,
      name: designName,
      shortCode,
      surface,
      finish: surface,
      collection,
      baseColor,
      baseColour: baseColor,
      size,
      thickness: `${thickness} mm`,
      thicknessMm: thickness,
      boxWeightKg: boxWeight,
      pcsPerBox,
      sqFtPerBox,
      basePrice: price,
      moq,
      stockStatus: (stockStatusRaw === 'AVAILABLE' || stockStatusRaw === 'AVAILABLE_NOW') ? 'available_now' : 'available',
      inStock: true,
      availableQuantity: stockQty,
      currentStock: stockQty,
      reservedStock: 0,
      availableStock: stockQty,
      spaces: spacesRaw.toLowerCase().includes('wall')
        ? ['Living Room', 'Bedroom', 'Bath Room', 'Commercial', 'Wall']
        : ['Living Room', 'Bedroom', 'Bath Room', 'Commercial'],
      shape: 'rectangle',
      aspectRatio: '0.5',
      aspectRatioValue: 0.5,
      randomPattern: collection.toLowerCase().includes('random') ? '4 Faces' : 'Endless Pattern',
      priceCategory: 'Premium',
      shade: 'Light',
      productLine: 'tiles',
      productType: 'Vitrified',
      bodyType: 'Porcelain',
      categoryId: 'CAT_VITRIFIED',
      categoryName: 'Vitrified Tiles',
      isActive: true,
      isComingSoon: false,
      images: allImages,
      faceImages: facePaths.length > 0 ? facePaths : null,
      mockupImages: mockupPaths.length > 0 ? mockupPaths : null,
      lifestyleImages: [],
      packingDetails: {
        boxWeight: `${boxWeight} kg`,
        sqmPerBox: (sqFtPerBox * 0.092903).toFixed(2),
        piecesPerBox: pcsPerBox,
        boxesPerPallet: 40
      }
    };

    firestoreBatchProducts.push(firestoreData);
  }

  console.log(`Total products prepared for Firestore: ${firestoreBatchProducts.length}`);

  // 7. Write to Firestore `products` and `tiles` in batches
  console.log('\n--- WRITING TO FIRESTORE (products & tiles collections) ---');
  let productsSuccess = 0;
  let tilesSuccess = 0;
  let firestoreFails = [];

  for (let i = 0; i < firestoreBatchProducts.length; i++) {
    const p = firestoreBatchProducts[i];
    try {
      // 1. Write to 'products' collection
      await writeFirestoreDocument('products', p.id, p);
      productsSuccess++;

      // 2. Write to 'tiles' collection
      await writeFirestoreDocument('tiles', p.id, p);
      tilesSuccess++;

      if ((i + 1) % 25 === 0 || (i + 1) === firestoreBatchProducts.length) {
        console.log(`  Imported ${i + 1}/${firestoreBatchProducts.length} products to both collections...`);
      }
    } catch (err) {
      console.error(`  ERROR importing ${p.name} (${p.id}):`, err.message);
      firestoreFails.push({ id: p.id, name: p.name, error: err.message });
    }
  }

  console.log(`\nFirestore Import Complete:`);
  console.log(`  'products' collection: ${productsSuccess} written, ${firestoreFails.length} failed.`);
  console.log(`  'tiles' collection:    ${tilesSuccess} written, ${firestoreFails.length} failed.`);

  // 8. POST-IMPORT LIVE VERIFICATION
  console.log('\n======================================================================');
  console.log('STEP 8 — POST-IMPORT VERIFICATION (READ BACK FROM LIVE CLOUD)');
  console.log('======================================================================\n');

  // Verify Storage
  console.log('Verifying Firebase Storage live inventory...');
  let liveStorageObjects = new Set();
  let vToken = '';
  do {
    const url = `https://storage.googleapis.com/storage/v1/b/${STORAGE_BUCKET}/o?maxResults=1000${vToken ? '&pageToken=' + vToken : ''}`;
    const data = await new Promise((resolve) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => {
          try { resolve(JSON.parse(b)); } catch (_) { resolve({ items: [] }); }
        });
      }).on('error', () => resolve({ items: [] }));
    });
    if (data.items) {
      data.items.forEach(i => liveStorageObjects.add(i.name));
    }
    vToken = data.nextPageToken;
  } while (vToken);

  console.log(`Total live storage objects now in bucket: ${liveStorageObjects.size}`);

  let verifiedOriginals = 0;
  let verifiedThumbnails = 0;
  let missingStorageFiles = [];

  for (const item of manifest) {
    if (liveStorageObjects.has(item.finalOriginalStoragePath)) {
      verifiedOriginals++;
    } else {
      missingStorageFiles.push(item.finalOriginalStoragePath);
    }

    if (liveStorageObjects.has(item.finalThumbnailStoragePath)) {
      verifiedThumbnails++;
    } else {
      missingStorageFiles.push(item.finalThumbnailStoragePath);
    }
  }

  console.log(`Live Originals verified in bucket:  ${verifiedOriginals} / 547`);
  console.log(`Live Thumbnails verified in bucket: ${verifiedThumbnails} / 547`);
  console.log(`Missing Storage files:              ${missingStorageFiles.length}`);

  // Verify Firestore
  console.log('\nVerifying Firestore live collections...');
  async function fetchLiveDocs(col) {
    let all = [];
    let pToken = '';
    do {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${col}?pageSize=300${pToken ? '&pageToken=' + pToken : ''}&key=${FIREBASE_API_KEY}`;
      const data = await new Promise((resolve) => {
        https.get(url, (res) => {
          let b = '';
          res.on('data', c => b += c);
          res.on('end', () => {
            try { resolve(JSON.parse(b)); } catch (_) { resolve({}); }
          });
        }).on('error', () => resolve({}));
      });
      if (data.documents) {
        all = all.concat(data.documents);
      }
      pToken = data.nextPageToken;
    } while (pToken);
    return all;
  }

  const liveProducts = await fetchLiveDocs('products');
  const liveTiles = await fetchLiveDocs('tiles');

  console.log(`Live documents in 'products': ${liveProducts.length}`);
  console.log(`Live documents in 'tiles':    ${liveTiles.length}`);

  // Check special cases
  const telerInLiveProducts = liveProducts.find(d => d.name.endsWith('/PROD_VIT_60120_8_50_GLO_MAR_WHIT_182'));
  const topazInLiveProducts = liveProducts.find(d => d.fields && d.fields.name && d.fields.name.stringValue === 'TOPAZ BROWN');

  console.log(`TELER CREMA verified present in Firestore: ${!!telerInLiveProducts}`);
  if (telerInLiveProducts) {
    const imagesField = telerInLiveProducts.fields.images;
    const imgCount = imagesField && imagesField.arrayValue && imagesField.arrayValue.values ? imagesField.arrayValue.values.length : 0;
    console.log(`TELER CREMA image count: ${imgCount} (Expected: 0)`);
  }
  console.log(`TOPAZ BROWN verified excluded from Firestore: ${!topazInLiveProducts}`);

  const liveReport = {
    timestamp: new Date().toISOString(),
    status: (missingStorageFiles.length === 0 && firestoreFails.length === 0 && liveProducts.length >= 138)
      ? 'IMPORT_VERIFIED_SUCCESSFULLY'
      : 'IMPORT_COMPLETED_WITH_ISSUES',
    storage: {
      totalObjectsBefore: existingStorageObjects.size,
      totalObjectsAfter: liveStorageObjects.size,
      originalsUploaded: origResults.successCount,
      originalsSkipped: origResults.skippedCount,
      thumbnailsUploaded: thumbResults.successCount,
      thumbnailsSkipped: thumbResults.skippedCount,
      missingFiles: missingStorageFiles.length
    },
    firestore: {
      productsWritten: productsSuccess,
      tilesWritten: tilesSuccess,
      failures: firestoreFails.length,
      liveProductsCount: liveProducts.length,
      liveTilesCount: liveTiles.length
    },
    specialCases: {
      telerCremaVerified: !!telerInLiveProducts,
      topazBrownExcluded: !topazInLiveProducts
    }
  };

  fs.writeFileSync(path.join(PROJECT_ROOT, 'build', 'live_import_verification.json'), JSON.stringify(liveReport, null, 2), 'utf8');

  console.log('\n======================================================================');
  console.log(`FINAL RESULT: ${liveReport.status}`);
  console.log('======================================================================\n');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
