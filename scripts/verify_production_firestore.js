const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(PROJECT_ROOT, 'scripts', 'product_image_mapping.csv');

async function fetchAllDocs(collectionName) {
  let allDocs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/${collectionName}?pageSize=100${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(b));
          } else {
            reject(new Error(`Failed to fetch ${collectionName}: HTTP ${res.statusCode}: ${b}`));
          }
        });
      }).on('error', reject);
    });
    if (data.documents) {
      allDocs = allDocs.concat(data.documents);
      console.log(`[${collectionName}] Fetched page: +${data.documents.length} (Total: ${allDocs.length})`);
    }
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
    } else if (v.mapValue !== undefined) {
      res[k] = v.mapValue.fields;
    }
  }
  return res;
}

async function runAudit() {
  console.log('======================================================================');
  console.log('POST-WRITE PRODUCTION FIRESTORE AUDIT & VERIFICATION');
  console.log('======================================================================\n');

  // Fetch production collections
  console.log('Fetching production "products" collection...');
  const productsRaw = await fetchAllDocs('products');
  console.log(`Fetched ${productsRaw.length} documents from "products"`);

  console.log('Fetching production "tiles" collection...');
  const tilesRaw = await fetchAllDocs('tiles');
  console.log(`Fetched ${tilesRaw.length} documents from "tiles"\n`);

  const products = productsRaw.map(parseDoc);
  const tiles = tilesRaw.map(parseDoc);

  const productMap = new Map();
  products.forEach(p => productMap.set(p.sku, p));

  const tileMap = new Map();
  tiles.forEach(t => tileMap.set(t.sku, t));

  // Read CSV
  const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csvRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const s2Csv = new Map();
  const s3Csv = new Map();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    const sheet = parts[0];
    const sku = parts[1];
    const designName = parts[2];
    const type = parts[3];
    const filename = parts[4];
    const order = parseInt(parts[5], 10);

    if (sheet === '2') {
      s2Csv.set(sku, { sku, designName, filename });
    } else if (sheet === '3') {
      if (!s3Csv.has(sku)) {
        s3Csv.set(sku, { sku, designName, mockups: [], faces: [] });
      }
      const entry = s3Csv.get(sku);
      if (type === 'Mockup') entry.mockups.push({ filename, order });
      if (type === 'Tile Face') entry.faces.push({ filename, order });
    }
  }

  // 1. Audit Sheet 2 (138 products)
  console.log('--- AUDITING 138 SHEET 2 PRODUCTS IN FIRESTORE ---');
  let s2VerifiedCount = 0;
  let s2PrimaryMockupCorrect = 0;
  let s2RoomImagesPreserved = 0;
  let s2ImagesPreserved = 0;
  let s2TilesMirrorCount = 0;

  for (const [sku, item] of s2Csv.entries()) {
    const pDoc = productMap.get(sku);
    const tDoc = tileMap.get(sku);

    if (pDoc) {
      s2VerifiedCount++;
      const expectedPrimary = `products/mockups/${item.filename}`;
      if (Array.isArray(pDoc.mockupImages) && pDoc.mockupImages[0] === expectedPrimary) {
        s2PrimaryMockupCorrect++;
      }
      if (Array.isArray(pDoc.mockupImages) && pDoc.mockupImages.length > 1) {
        s2RoomImagesPreserved++;
      }
      if (Array.isArray(pDoc.images) && pDoc.images.length > 0) {
        s2ImagesPreserved++;
      }
    }
    if (tDoc) {
      s2TilesMirrorCount++;
    }
  }

  console.log(`Sheet 2 products present in "products": ${s2VerifiedCount} / 138`);
  console.log(`Sheet 2 products present in "tiles": ${s2TilesMirrorCount} / 138`);
  console.log(`Sheet 2 products with newly approved mockup as primary: ${s2PrimaryMockupCorrect} / 138`);
  console.log(`Sheet 2 products with legacy room images preserved: ${s2RoomImagesPreserved} / 138`);
  console.log(`Sheet 2 products with existing images array preserved: ${s2ImagesPreserved} / 138\n`);

  // 2. Audit Sheet 3 (97 products)
  console.log('--- AUDITING 97 SHEET 3 PRODUCTS IN FIRESTORE ---');
  let s3ProductsFound = 0;
  let s3TilesFound = 0;
  let s3MockupPopulated = 0;
  let s3FacePopulated = 0;
  let s3ImagesPopulated = 0;
  let s3TotalFaceReferences = 0;
  const s3FaceDistribution = {};
  let s3MetadataComplete = 0;

  for (const [sku, item] of s3Csv.entries()) {
    const pDoc = productMap.get(sku);
    const tDoc = tileMap.get(sku);

    if (pDoc) {
      s3ProductsFound++;
      if (Array.isArray(pDoc.mockupImages) && pDoc.mockupImages.length === 1) {
        s3MockupPopulated++;
      }
      if (Array.isArray(pDoc.faceImages) && pDoc.faceImages.length === item.faces.length) {
        s3FacePopulated++;
        s3TotalFaceReferences += pDoc.faceImages.length;
        const faceCount = pDoc.faceImages.length;
        s3FaceDistribution[`${faceCount} Faces`] = (s3FaceDistribution[`${faceCount} Faces`] || 0) + 1;
      }
      if (Array.isArray(pDoc.images) && pDoc.images.length > 0) {
        s3ImagesPopulated++;
      }
      if (pDoc.basePrice > 0 && pDoc.moq > 0 && pDoc.size && pDoc.surface && pDoc.pcsPerBox) {
        s3MetadataComplete++;
      }
    }
    if (tDoc) {
      s3TilesFound++;
    }
  }

  console.log(`Sheet 3 products present in "products": ${s3ProductsFound} / 97`);
  console.log(`Sheet 3 products present in "tiles": ${s3TilesFound} / 97`);
  console.log(`Sheet 3 mockupImages populated: ${s3MockupPopulated} / 97`);
  console.log(`Sheet 3 faceImages populated: ${s3FacePopulated} / 97`);
  console.log(`Sheet 3 total face image references: ${s3TotalFaceReferences} (Expected: 360)`);
  console.log(`Sheet 3 images compatibility arrays populated: ${s3ImagesPopulated} / 97`);
  console.log(`Sheet 3 products with complete metadata: ${s3MetadataComplete} / 97`);
  console.log('Sheet 3 face distribution in production Firestore:', s3FaceDistribution);

  const auditSummary = {
    totalProductsInProductsCollection: products.length,
    totalProductsInTilesCollection: tiles.length,
    sheet2: {
      expected: 138,
      verifiedInProducts: s2VerifiedCount,
      verifiedInTiles: s2TilesMirrorCount,
      primaryMockupCorrect: s2PrimaryMockupCorrect,
      legacyRoomImagesPreserved: s2RoomImagesPreserved,
      imagesPreserved: s2ImagesPreserved
    },
    sheet3: {
      expected: 97,
      verifiedInProducts: s3ProductsFound,
      verifiedInTiles: s3TilesFound,
      mockupPopulated: s3MockupPopulated,
      facePopulated: s3FacePopulated,
      totalFaceReferences: s3TotalFaceReferences,
      imagesPopulated: s3ImagesPopulated,
      metadataComplete: s3MetadataComplete,
      faceDistribution: s3FaceDistribution
    }
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'production_firestore_audit.json'),
    JSON.stringify(auditSummary, null, 2),
    'utf8'
  );
  console.log('\nProduction Firestore audit report written to build/production_firestore_audit.json');
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
