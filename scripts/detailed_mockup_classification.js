const fs = require('fs');
const path = require('path');
const https = require('https');
const XLSX = require('./node_modules/xlsx');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = 'D:/Itacon Product (2) (1) (2).xlsx';
const BUCKET = 'itacon-app.firebasestorage.app';

function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cfg.tokens.access_token;
}

// Fetch all Storage objects in bucket
async function fetchStorageInventory(token) {
  const storageSet = new Set();
  let pageToken = '';
  do {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?maxResults=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.items) {
      data.items.forEach(i => storageSet.add(i.name));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return storageSet;
}

async function runDetailedAudit() {
  const token = getAccessToken();
  const storageSet = await fetchStorageInventory(token);
  console.log(`Loaded ${storageSet.size} storage objects.`);

  // 1. Read Master Excel
  const wb = XLSX.readFile(EXCEL_PATH);
  
  // Sheet 1 Excel products
  const ws1 = wb.Sheets['1'];
  const r1 = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });
  const s1ExcelProducts = [];
  for (let i = 2; i < r1.length; i++) {
    const row = r1[i];
    if (row && row[1]) {
      s1ExcelProducts.push({
        row: i + 1,
        sku: String(row[1]).trim(),
        designName: String(row[9]).trim(),
        surface: String(row[5]).trim(),
        collection: String(row[6]).trim(),
        color: String(row[7]).trim()
      });
    }
  }

  // Sheet 2 Excel products
  const ws2 = wb.Sheets['2'];
  const r2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
  const s2ExcelProducts = [];
  for (let i = 2; i < r2.length; i++) {
    const row = r2[i];
    if (row && row[1]) {
      s2ExcelProducts.push({
        row: i + 1,
        sku: String(row[1]).trim(),
        designName: String(row[9]).trim(),
        surface: String(row[5]).trim(),
        collection: String(row[6]).trim(),
        color: String(row[7]).trim()
      });
    }
  }

  // Sheet 3 Excel products
  const ws3 = wb.Sheets['3'];
  const r3 = XLSX.utils.sheet_to_json(ws3, { header: 1, defval: '' });
  const s3ExcelProducts = [];
  for (let i = 2; i < r3.length; i++) {
    const row = r3[i];
    if (row && row[1]) {
      s3ExcelProducts.push({
        row: i + 1,
        sku: String(row[1]).trim(),
        designName: String(row[9]).trim(),
        surface: String(row[5]).trim(),
        collection: String(row[6]).trim(),
        color: String(row[7]).trim()
      });
    }
  }

  console.log(`Excel Counts: Sheet 1 = ${s1ExcelProducts.length}, Sheet 2 = ${s2ExcelProducts.length}, Sheet 3 = ${s3ExcelProducts.length}`);

  // Read Sheet 1 from ProductCatalogService
  const sheet1Static = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'build', 'sheet1_parsed_products.json'), 'utf8'));
  const s1StaticMap = new Map();
  sheet1Static.forEach(p => s1StaticMap.set(p.sku, p));

  // Read Firestore complete audit
  const auditReport = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'build', 'complete_catalogue_audit.json'), 'utf8'));

  // Fetch Firestore products directly
  // Load products from final_verification_audit or fetch again
  // We can fetch from local cache or firestore
  const fetchAllFirestoreDocs = async (collectionName) => {
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
  };

  const parseDoc = (doc) => {
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
  };

  const rawDocs = await fetchAllFirestoreDocs('products');
  const firestoreProducts = rawDocs.map(parseDoc);
  const firestoreBySku = new Map();
  firestoreProducts.forEach(p => firestoreBySku.set(p.sku, p));

  console.log(`Loaded ${firestoreProducts.length} Firestore products.`);

  // Audit Sheet 1
  const sheet1AuditResults = [];
  for (const exp of s1ExcelProducts) {
    const inFirestore = firestoreBySku.has(exp.sku);
    const fireDoc = firestoreBySku.get(exp.sku);
    const staticDoc = s1StaticMap.get(exp.sku);

    const mockupImages = fireDoc?.mockupImages || staticDoc?.mockupImages || [];
    const images = fireDoc?.images || staticDoc?.images || [];
    const faceImages = fireDoc?.faceImages || staticDoc?.faceImages || [];

    const primaryMockup = mockupImages.length > 0 ? mockupImages[0] : null;
    const primaryMockupInStorage = primaryMockup ? storageSet.has(primaryMockup) : false;

    const primaryLegacy = images.length > 0 ? images[0] : null;
    const primaryLegacyInStorage = primaryLegacy ? storageSet.has(primaryLegacy) : false;

    const primaryFace = faceImages.length > 0 ? faceImages[0] : null;
    const primaryFaceInStorage = primaryFace ? storageSet.has(primaryFace) : false;

    let classification = 'G';
    let reason = '';
    let recommendedFix = '';

    if (!inFirestore) {
      reason = 'Product completely missing from Firestore collections (only present in static ProductCatalogService code).';
      recommendedFix = 'Import product document into Firestore "products" and "tiles" collections with verified image paths.';
    }

    if (primaryMockup && primaryMockupInStorage) {
      classification = inFirestore ? 'A' : 'A-StaticOnly';
    } else if (primaryMockup && !primaryMockupInStorage) {
      classification = 'D';
      reason = `Mockup path ${primaryMockup} does not exist in Firebase Storage.`;
      recommendedFix = 'Upload missing mockup image to Firebase Storage.';
    } else if (mockupImages.length === 0) {
      if (primaryLegacyInStorage) {
        classification = 'F';
        reason = `No mockup image defined; only legacy image (${primaryLegacy}) available in Storage.`;
        recommendedFix = 'Generate/assign room mockup for product and update mockupImages.';
      } else if (primaryFaceInStorage) {
        classification = 'F';
        reason = `No mockup image defined; only tile face (${primaryFace}) available in Storage.`;
        recommendedFix = 'Generate/assign room mockup for product and update mockupImages.';
      } else {
        classification = 'G';
        reason = 'No usable product image found in Storage or payload.';
        recommendedFix = 'Source and upload tile face and room mockup.';
      }
    }

    sheet1AuditResults.push({
      sheet: 1,
      sku: exp.sku,
      designName: exp.designName,
      inFirestore,
      inStaticCatalog: !!staticDoc,
      mockupImages,
      primaryMockupInStorage,
      legacyImages: images,
      primaryLegacyInStorage,
      faceImages,
      primaryFaceInStorage,
      classification,
      reason,
      recommendedFix
    });
  }

  // Audit Sheet 2
  const sheet2AuditResults = [];
  for (const exp of s2ExcelProducts) {
    const inFirestore = firestoreBySku.has(exp.sku);
    const fireDoc = firestoreBySku.get(exp.sku);

    const mockupImages = fireDoc?.mockupImages || [];
    const images = fireDoc?.images || [];
    const faceImages = fireDoc?.faceImages || [];

    const primaryMockup = mockupImages.length > 0 ? mockupImages[0] : null;
    const primaryMockupInStorage = primaryMockup ? storageSet.has(primaryMockup) : false;

    const primaryLegacy = images.length > 0 ? images[0] : null;
    const primaryLegacyInStorage = primaryLegacy ? storageSet.has(primaryLegacy) : false;

    let classification = 'A';
    let reason = '';
    let recommendedFix = '';

    if (!inFirestore) {
      classification = 'Missing';
      reason = 'Missing from Firestore';
    } else if (!primaryMockup) {
      classification = 'C';
      reason = 'mockupImages is empty';
      recommendedFix = 'Assign primary mockup image';
    } else if (!primaryMockupInStorage) {
      classification = 'D';
      reason = `Storage path ${primaryMockup} not found in bucket.`;
      recommendedFix = 'Upload missing file';
    } else {
      classification = 'A';
    }

    sheet2AuditResults.push({
      sheet: 2,
      sku: exp.sku,
      designName: exp.designName,
      inFirestore,
      mockupImages,
      primaryMockupInStorage,
      classification,
      reason,
      recommendedFix
    });
  }

  // Audit Sheet 3
  const sheet3AuditResults = [];
  for (const exp of s3ExcelProducts) {
    const inFirestore = firestoreBySku.has(exp.sku);
    const fireDoc = firestoreBySku.get(exp.sku);

    const mockupImages = fireDoc?.mockupImages || [];
    const images = fireDoc?.images || [];
    const faceImages = fireDoc?.faceImages || [];

    const primaryMockup = mockupImages.length > 0 ? mockupImages[0] : null;
    const primaryMockupInStorage = primaryMockup ? storageSet.has(primaryMockup) : false;

    let allFacesInStorage = true;
    const brokenFaces = [];
    faceImages.forEach(f => {
      if (!storageSet.has(f)) {
        allFacesInStorage = false;
        brokenFaces.push(f);
      }
    });

    let classification = 'A';
    let reason = '';
    let recommendedFix = '';

    if (!inFirestore) {
      classification = 'Missing';
      reason = 'Missing from Firestore';
    } else if (!primaryMockup) {
      classification = 'C';
      reason = 'mockupImages is empty';
      recommendedFix = 'Assign primary mockup image';
    } else if (!primaryMockupInStorage) {
      classification = 'D';
      reason = `Storage path ${primaryMockup} not found in bucket.`;
      recommendedFix = 'Upload missing file';
    } else {
      classification = 'A';
    }

    sheet3AuditResults.push({
      sheet: 3,
      sku: exp.sku,
      designName: exp.designName,
      inFirestore,
      mockupImages,
      primaryMockupInStorage,
      faceCount: faceImages.length,
      allFacesInStorage,
      brokenFaces,
      classification,
      reason,
      recommendedFix
    });
  }

  // Classification summary
  const summary = {
    sheet1: {
      total: sheet1AuditResults.length,
      inFirestore: sheet1AuditResults.filter(r => r.inFirestore).length,
      missingFromFirestore: sheet1AuditResults.filter(r => !r.inFirestore).length,
      inStaticCatalog: sheet1AuditResults.filter(r => r.inStaticCatalog).length,
      workingMockupsInStorage: sheet1AuditResults.filter(r => r.primaryMockupInStorage).length,
      missingMockups: sheet1AuditResults.filter(r => !r.primaryMockupInStorage).length,
      missingMockupDetails: sheet1AuditResults.filter(r => !r.primaryMockupInStorage)
    },
    sheet2: {
      total: sheet2AuditResults.length,
      inFirestore: sheet2AuditResults.filter(r => r.inFirestore).length,
      workingMockupsInStorage: sheet2AuditResults.filter(r => r.primaryMockupInStorage).length,
      missingMockups: sheet2AuditResults.filter(r => !r.primaryMockupInStorage).length,
      missingMockupDetails: sheet2AuditResults.filter(r => !r.primaryMockupInStorage)
    },
    sheet3: {
      total: sheet3AuditResults.length,
      inFirestore: sheet3AuditResults.filter(r => r.inFirestore).length,
      workingMockupsInStorage: sheet3AuditResults.filter(r => r.primaryMockupInStorage).length,
      allFacesInStorage: sheet3AuditResults.filter(r => r.allFacesInStorage).length,
      missingMockups: sheet3AuditResults.filter(r => !r.primaryMockupInStorage).length,
      missingMockupDetails: sheet3AuditResults.filter(r => !r.primaryMockupInStorage)
    }
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'detailed_mockup_classification.json'),
    JSON.stringify({ summary, sheet1AuditResults, sheet2AuditResults, sheet3AuditResults }, null, 2),
    'utf8'
  );

  console.log('\n--- DETAILED AUDIT RESULTS ---');
  console.log('Sheet 1:', JSON.stringify(summary.sheet1, null, 2));
  console.log('Sheet 2:', JSON.stringify(summary.sheet2, null, 2));
  console.log('Sheet 3:', JSON.stringify(summary.sheet3, null, 2));
}

runDetailedAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
