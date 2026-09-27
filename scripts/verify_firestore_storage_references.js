const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUCKET = 'itacon-app.firebasestorage.app';

async function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const expiresAt = cfg.tokens.expires_at || 0;
  if (Date.now() + 5 * 60 * 1000 > expiresAt) {
    const api = require('C:\\Users\\ttirt\\AppData\\Roaming\\npm\\node_modules\\firebase-tools\\lib\\api');
    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      refresh_token: cfg.tokens.refresh_token
    }).toString();

    await new Promise((resolve, reject) => {
      const req = https.request('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const data = JSON.parse(body);
          if (data.access_token) {
            cfg.tokens.access_token = data.access_token;
            cfg.tokens.expires_at = Date.now() + data.expires_in * 1000;
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
            resolve();
          } else {
            reject(new Error('Token refresh failed: ' + body));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
  return cfg.tokens.access_token;
}

// Fetch all docs from Firestore collection
async function fetchAllFirestoreDocs(collectionName) {
  let allDocs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/${collectionName}?pageSize=100${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.documents) allDocs = allDocs.concat(data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return allDocs;
}

function parseDoc(doc) {
  const docId = doc.name.split('/').pop();
  const f = doc.fields || {};
  const res = { _docId: docId };
  for (const [k, v] of Object.entries(f)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.arrayValue !== undefined) {
      res[k] = (v.arrayValue.values || []).map(val => val.stringValue || val.integerValue || val);
    }
  }
  return res;
}

// Fetch all Storage objects in bucket
async function fetchStorageInventory(token) {
  const storageMap = new Map();
  let pageToken = '';
  do {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?maxResults=1000${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.items) {
      data.items.forEach(i => storageMap.set(i.name, { size: parseInt(i.size, 10), updated: i.updated }));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return storageMap;
}

function deriveThumbnailPath(originalPath) {
  if (originalPath.startsWith('products/mockups/')) {
    const filename = originalPath.substring('products/mockups/'.length);
    const lastDot = filename.lastIndexOf('.');
    const base = lastDot !== -1 ? filename.substring(0, lastDot) : filename;
    return `products/thumbnails/mockups/${base}.webp`;
  }
  if (originalPath.startsWith('products/tiles/')) {
    const filename = originalPath.substring('products/tiles/'.length);
    const lastDot = filename.lastIndexOf('.');
    const base = lastDot !== -1 ? filename.substring(0, lastDot) : filename;
    return `products/thumbnails/tiles/${base}.webp`;
  }
  return null;
}

async function runComprehensiveVerification() {
  console.log('======================================================================');
  console.log('PRODUCTION FIRESTORE & STORAGE FINAL VERIFICATION');
  console.log('======================================================================\n');

  const token = await getAccessToken();

  console.log('1. Loading Storage inventory from itacon-app.firebasestorage.app...');
  const storageMap = await fetchStorageInventory(token);
  console.log(`   Found ${storageMap.size} total objects in bucket.`);

  console.log('\n2. Loading Firestore "products" collection...');
  const rawProducts = await fetchAllFirestoreDocs('products');
  const products = rawProducts.map(parseDoc);
  console.log(`   Found ${products.length} products in "products".`);

  console.log('\n3. Loading Firestore "tiles" mirror collection...');
  const rawTiles = await fetchAllFirestoreDocs('tiles');
  const tiles = rawTiles.map(parseDoc);
  console.log(`   Found ${tiles.length} products in "tiles".`);

  // Load CSV mapping as source of truth
  const csvContent = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'product_image_mapping.csv'), 'utf8');
  const csvLines = csvContent.trim().split('\n').filter(l => l.trim().length > 0).slice(1);
  const csvRows = csvLines.map(line => {
    const parts = line.split(',').map(s => s.trim());
    return {
      sheet: parts[0],
      sku: parts[1],
      designName: parts[2],
      imageType: parts[3],
      imageFilename: parts[4],
      imageOrder: parseInt(parts[5], 10)
    };
  });

  const s2MockupsCsv = csvRows.filter(r => (r.sheet === '2' || r.sheet === 'Sheet2') && r.imageType === 'Mockup');
  const s3MockupsCsv = csvRows.filter(r => (r.sheet === '3' || r.sheet === 'Sheet3') && r.imageType === 'Mockup');
  const s3FacesCsv = csvRows.filter(r => (r.sheet === '3' || r.sheet === 'Sheet3') && r.imageType === 'Tile Face');

  console.log(`\nCSV Expectations:`);
  console.log(`   Sheet 2 Mockups: ${s2MockupsCsv.length}`);
  console.log(`   Sheet 3 Mockups: ${s3MockupsCsv.length}`);
  console.log(`   Sheet 3 Tile Faces: ${s3FacesCsv.length}`);
  console.log(`   Total Target Originals: ${csvRows.length}`);
  console.log(`   Total Target Thumbnails: ${csvRows.length}`);
  console.log(`   Total Expected Storage Objects: ${csvRows.length * 2}`);

  // Audit Storage target objects
  let verifiedOriginals = 0;
  let missingOriginals = [];
  let verifiedThumbnails = 0;
  let missingThumbnails = [];

  for (const row of csvRows) {
    const isMockup = row.imageType === 'Mockup';
    const origPath = isMockup ? `products/mockups/${row.imageFilename}` : `products/tiles/${row.imageFilename}`;
    const thumbPath = deriveThumbnailPath(origPath);

    if (storageMap.has(origPath)) {
      verifiedOriginals++;
    } else {
      missingOriginals.push(origPath);
    }

    if (storageMap.has(thumbPath)) {
      verifiedThumbnails++;
    } else {
      missingThumbnails.push(thumbPath);
    }
  }

  // Check special files
  const adigeOrig = 'products/mockups/ADIGE GREY .jpg';
  const adigeThumb = 'products/thumbnails/mockups/ADIGE GREY .webp';
  const adigeOrigOk = storageMap.has(adigeOrig);
  const adigeThumbOk = storageMap.has(adigeThumb);

  // Separate Sheet 2 and Sheet 3 products
  const productsBySku = new Map();
  const duplicateSkus = [];
  products.forEach(p => {
    if (productsBySku.has(p.sku)) {
      duplicateSkus.push(p.sku);
    } else {
      productsBySku.set(p.sku, p);
    }
  });

  const tilesBySku = new Map();
  tiles.forEach(t => tilesBySku.set(t.sku, t));

  // Identify Sheet 3 products: SKUs ending in 204 through 300
  const sheet3Products = [];
  const sheet2Products = [];
  for (const p of products) {
    const m = p.sku && p.sku.match(/VIT-60120-8\.50-GLO-MAR-WHIT-(\d+)/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= 204 && num <= 300) {
        sheet3Products.push(p);
        continue;
      }
    }
    sheet2Products.push(p);
  }

  // Audit Sheet 3 products
  const s3ExpectedSkus = [];
  for (let i = 204; i <= 300; i++) {
    s3ExpectedSkus.push(`VIT-60120-8.50-GLO-MAR-WHIT-${i}`);
  }
  const s3MissingSkus = s3ExpectedSkus.filter(sku => !productsBySku.has(sku));

  let s3MockupCount = 0;
  let s3FaceCount = 0;
  let s3MockupBroken = [];
  let s3FaceBroken = [];
  let s3CompatImagesBroken = [];
  const faceDistribution = {};

  for (const p of sheet3Products) {
    // Check mirror doc in tiles
    const tileMirror = tilesBySku.get(p.sku);
    if (!tileMirror) {
      console.warn(`Missing mirror tile for SKU ${p.sku}`);
    }

    // Check mockupImages
    if (Array.isArray(p.mockupImages) && p.mockupImages.length > 0) {
      s3MockupCount++;
      const mPath = p.mockupImages[0];
      if (!storageMap.has(mPath)) {
        s3MockupBroken.push({ sku: p.sku, path: mPath });
      }
    }

    // Check faceImages
    const faces = Array.isArray(p.faceImages) ? p.faceImages : [];
    s3FaceCount += faces.length;
    const count = faces.length;
    faceDistribution[count] = (faceDistribution[count] || 0) + 1;

    for (const fPath of faces) {
      if (!storageMap.has(fPath)) {
        s3FaceBroken.push({ sku: p.sku, path: fPath });
      }
    }

    // Check compatibility images array
    if (!Array.isArray(p.images) || p.images[0] !== p.mockupImages[0]) {
      s3CompatImagesBroken.push({ sku: p.sku, images0: p.images ? p.images[0] : null, mockup0: p.mockupImages ? p.mockupImages[0] : null });
    }
  }

  // Audit Sheet 2 products
  let s2MockupCount = 0;
  let s2MockupBroken = [];
  let s2LegacyImagesPreserved = 0;

  for (const p of sheet2Products) {
    if (Array.isArray(p.mockupImages) && p.mockupImages.length > 0) {
      s2MockupCount++;
      const mPath = p.mockupImages[0];
      if (!storageMap.has(mPath)) {
        s2MockupBroken.push({ sku: p.sku, path: mPath });
      }
      // Check legacy preservation
      if (p.mockupImages.length > 1) {
        s2LegacyImagesPreserved++;
      }
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    firestore: {
      totalProducts: products.length,
      totalTiles: tiles.length,
      sheet2Count: sheet2Products.length,
      sheet3Count: sheet3Products.length,
      s3MissingSkus,
      duplicateSkus,
      s3MirrorTilesMatch: sheet3Products.every(p => tilesBySku.has(p.sku)),
    },
    images: {
      expectedOriginals: csvRows.length,
      verifiedOriginals,
      missingOriginalsCount: missingOriginals.length,
      missingOriginals,
      expectedThumbnails: csvRows.length,
      verifiedThumbnails,
      missingThumbnailsCount: missingThumbnails.length,
      missingThumbnails,
      expectedStorageObjects: csvRows.length * 2,
      totalBucketObjects: storageMap.size,
      adigeGreyOriginalVerified: adigeOrigOk,
      adigeGreyThumbnailVerified: adigeThumbOk
    },
    sheet2: {
      verifiedProducts: sheet2Products.length,
      verifiedMockups: s2MockupCount,
      brokenMockups: s2MockupBroken,
      legacyRoomsPreserved: s2LegacyImagesPreserved
    },
    sheet3: {
      verifiedProducts: sheet3Products.length,
      verifiedMockups: s3MockupCount,
      brokenMockups: s3MockupBroken,
      verifiedFaceImages: s3FaceCount,
      brokenFaceImages: s3FaceBroken,
      faceDistribution,
      compatImagesPreserved: sheet3Products.length - s3CompatImagesBroken.length,
      compatImagesBroken: s3CompatImagesBroken
    }
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'final_verification_audit.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log('\n======================================================================');
  console.log('AUDIT SUMMARY');
  console.log('======================================================================');
  console.log(`Firestore "products": ${report.firestore.totalProducts} (Sheet 2: ${report.firestore.sheet2Count}, Sheet 3: ${report.firestore.sheet3Count})`);
  console.log(`Firestore "tiles":    ${report.firestore.totalTiles}`);
  console.log(`Sheet 3 Mirror Match: ${report.firestore.s3MirrorTilesMatch}`);
  console.log(`Duplicate SKUs:       ${report.firestore.duplicateSkus.length}`);
  console.log(`Missing S3 SKUs:      ${report.firestore.s3MissingSkus.length}`);
  console.log(`Originals in Storage: ${report.images.verifiedOriginals} / ${report.images.expectedOriginals}`);
  console.log(`Thumbnails in Storage:${report.images.verifiedThumbnails} / ${report.images.expectedThumbnails}`);
  console.log(`ADIGE GREY .jpg:      ${report.images.adigeGreyOriginalVerified}`);
  console.log(`ADIGE GREY .webp:     ${report.images.adigeGreyThumbnailVerified}`);
  console.log(`Sheet 3 Mockups:      ${report.sheet3.verifiedMockups} (Broken: ${report.sheet3.brokenMockups.length})`);
  console.log(`Sheet 3 Tile Faces:   ${report.sheet3.verifiedFaceImages} (Broken: ${report.sheet3.brokenFaceImages.length})`);
  console.log(`Sheet 3 Face Dist:    `, report.sheet3.faceDistribution);
  console.log(`Sheet 2 Mockups:      ${report.sheet2.verifiedMockups} (Broken: ${report.sheet2.brokenMockups.length})`);
  console.log('======================================================================\n');

  return report;
}

runComprehensiveVerification().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
