const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('./node_modules/adm-zip');
const XLSX = require('./node_modules/xlsx');
const sharp = require('./node_modules/sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(__dirname, 'ITACON_56_Mockup_Upload_Manifest.csv');
const XLSX_PATH = path.join(__dirname, 'ITACON_56_Verified_Mockup_Mapping.xlsx');
const ZIP_PATH = 'D:\\PRASHANTBHAI.zip';

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
let cfg = {};
if (fs.existsSync(configPath)) {
  cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

async function refreshAccessTokenIfNeeded() {
  const expiresAt = cfg.tokens?.expires_at || 0;
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
}

async function queryFirestoreCollection(colName) {
  await refreshAccessTokenIfNeeded();
  const token = cfg.tokens.access_token;
  const projectId = 'itacon-app';
  let docs = [];
  let pageToken = '';

  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colName}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      }).on('error', reject);
    });

    if (data.documents) {
      docs = docs.concat(data.documents);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return docs;
}

async function listStorageFiles(prefix) {
  await refreshAccessTokenIfNeeded();
  const token = cfg.tokens.access_token;
  const bucket = 'itacon-app.firebasestorage.app';
  let items = [];
  let pageToken = '';

  do {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}&maxResults=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Storage list HTTP ${res.statusCode}: ${body}`));
          }
        });
      }).on('error', reject);
    });

    if (data.items) {
      items = items.concat(data.items);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

async function main() {
  console.log('=== STEP 1: PARSING CSV MANIFEST ===');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const csvLines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = csvLines[0].split(',');
  console.log('Manifest Header:', header);

  const manifestRecords = [];
  for (let i = 1; i < csvLines.length; i++) {
    // Handle CSV line splitting properly
    const line = csvLines[i];
    // Simple split if no escaped commas in filenames
    const parts = line.split(',');
    manifestRecords.push({
      excelRow: parseInt(parts[0], 10),
      sku: parts[1].trim(),
      designName: parts[2].trim(),
      filename: parts[3].trim(),
      zipPath: parts[4].trim()
    });
  }
  console.log(`Loaded ${manifestRecords.length} records from manifest (expected 56).`);

  console.log('\n=== STEP 2: VERIFYING AGAINST EXCEL WORKBOOK (SHEET 2: "2") ===');
  const workbook = XLSX.readFile(XLSX_PATH);
  console.log('Sheet names:', workbook.SheetNames);
  const sheet = workbook.Sheets['2'];
  if (!sheet) {
    throw new Error('Sheet "2" not found in Excel workbook!');
  }
  const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Sheet 2 total rows (including header): ${sheetData.length}`);

  // Header row in sheet 2:
  const s2Header = sheetData[0];
  console.log('Sheet 2 Column B (index 1):', s2Header[1]);
  console.log('Sheet 2 Column J (index 9):', s2Header[9]);
  console.log('Sheet 2 Column X (index 23):', s2Header[23]);

  // Map sheet rows by row number (1-based index in Excel)
  let sheetMatchCount = 0;
  let sheetMismatchCount = 0;
  for (const rec of manifestRecords) {
    const rowIdx = rec.excelRow - 1; // 0-based
    const row = sheetData[rowIdx];
    if (!row) {
      console.warn(`Row ${rec.excelRow} does not exist in Sheet 2!`);
      sheetMismatchCount++;
      continue;
    }
    const excelSku = (row[1] || '').toString().trim();
    const excelDesign = (row[9] || '').toString().trim();
    const excelMockup = (row[23] || '').toString().trim();

    const skuMatch = excelSku.toUpperCase() === rec.sku.toUpperCase();
    const designMatch = excelDesign.toUpperCase() === rec.designName.toUpperCase();
    const fileMatch = excelMockup.toUpperCase() === rec.filename.toUpperCase();

    if (skuMatch && designMatch && fileMatch) {
      sheetMatchCount++;
    } else {
      console.warn(`Mismatch on Excel Row ${rec.excelRow}:`, {
        manifest: rec,
        excel: { excelSku, excelDesign, excelMockup }
      });
      sheetMismatchCount++;
    }
  }
  console.log(`Excel Verification Result: ${sheetMatchCount} perfectly matched, ${sheetMismatchCount} mismatched.`);

  console.log('\n=== STEP 3: VERIFYING ZIP ARCHIVE ENTRIES & READABILITY ===');
  const zip = new AdmZip(ZIP_PATH);
  const zipEntries = zip.getEntries();
  console.log(`Total ZIP entries: ${zipEntries.length}`);

  const zipEntryMap = new Map();
  for (const entry of zipEntries) {
    if (entry.isDirectory || entry.entryName.includes('__MACOSX') || entry.name.startsWith('._')) {
      continue;
    }
    zipEntryMap.set(entry.entryName, entry);
    // Also index by basename
    zipEntryMap.set(entry.name, entry);
  }

  let zipFoundCount = 0;
  let zipMissingCount = 0;
  let imageValidCount = 0;
  const imageVerificationDetails = [];

  for (const rec of manifestRecords) {
    // Check by full zipPath or by basename
    let entry = zipEntryMap.get(rec.zipPath) || zipEntryMap.get(rec.filename);
    if (!entry) {
      console.error(`MISSING IN ZIP: ${rec.filename} (Path: ${rec.zipPath})`);
      zipMissingCount++;
      continue;
    }
    zipFoundCount++;

    // Test extraction & read buffer with sharp
    const buf = entry.getData();
    try {
      const meta = await sharp(buf).metadata();
      imageValidCount++;
      imageVerificationDetails.push({
        sku: rec.sku,
        designName: rec.designName,
        filename: rec.filename,
        zipPath: entry.entryName,
        sizeBytes: buf.length,
        width: meta.width,
        height: meta.height,
        format: meta.format
      });
    } catch (err) {
      console.error(`INVALID IMAGE: ${rec.filename} - ${err.message}`);
    }
  }
  console.log(`ZIP Check: ${zipFoundCount} found, ${zipMissingCount} missing, ${imageValidCount} valid readable images.`);

  console.log('\n=== STEP 4: INSPECTING FIRESTORE PRODUCTS & TILES ===');
  const productDocs = await queryFirestoreCollection('products');
  const tileDocs = await queryFirestoreCollection('tiles');
  console.log(`Firestore "products" count: ${productDocs.length}`);
  console.log(`Firestore "tiles" count: ${tileDocs.length}`);

  const productBySku = new Map();
  for (const d of productDocs) {
    const sku = d.fields?.sku?.stringValue?.trim().toUpperCase();
    if (sku) productBySku.set(sku, d);
  }

  const tilesBySku = new Map();
  for (const d of tileDocs) {
    const sku = d.fields?.sku?.stringValue?.trim().toUpperCase();
    if (sku) tilesBySku.set(sku, d);
  }

  let productsFoundInFirestore = 0;
  let tilesFoundInFirestore = 0;
  const firestoreAnalysis = [];

  for (const rec of manifestRecords) {
    const cleanSku = rec.sku.toUpperCase();
    const pDoc = productBySku.get(cleanSku);
    const tDoc = tilesBySku.get(cleanSku);

    if (pDoc) productsFoundInFirestore++;
    if (tDoc) tilesFoundInFirestore++;

    const pDocId = pDoc ? pDoc.name.split('/').pop() : null;
    const currentMockups = pDoc?.fields?.mockupImages?.arrayValue?.values?.map(v => v.stringValue) || [];
    const currentFaceImages = pDoc?.fields?.faceImages?.arrayValue?.values?.map(v => v.stringValue) || [];
    const currentImages = pDoc?.fields?.images?.arrayValue?.values?.map(v => v.stringValue) || [];

    firestoreAnalysis.push({
      sku: rec.sku,
      designName: rec.designName,
      foundInProducts: !!pDoc,
      foundInTiles: !!tDoc,
      docId: pDocId,
      currentMockupCount: currentMockups.length,
      currentMockups: currentMockups,
      currentFaceImagesCount: currentFaceImages.length,
      currentImagesCount: currentImages.length
    });
  }

  console.log(`Firestore Matches: ${productsFoundInFirestore}/56 found in "products", ${tilesFoundInFirestore}/56 found in "tiles".`);

  console.log('\n=== STEP 5: INSPECTING FIREBASE STORAGE ===');
  console.log('Listing products/mockups/ in Storage...');
  const storageMockupFiles = await listStorageFiles('products/mockups/');
  console.log(`Storage files under products/mockups/: ${storageMockupFiles.length}`);

  const storageFileNames = new Set(storageMockupFiles.map(f => {
    // extract filename after 'products/mockups/'
    return f.name.replace(/^products\/mockups\//, '');
  }));

  let storageAlreadyExistsCount = 0;
  let storageMissingCount = 0;
  const storageStatus = [];

  for (const rec of manifestRecords) {
    const expectedStoragePath = `products/mockups/${rec.filename}`;
    const exists = storageFileNames.has(rec.filename);
    if (exists) {
      storageAlreadyExistsCount++;
    } else {
      storageMissingCount++;
    }
    storageStatus.push({
      sku: rec.sku,
      filename: rec.filename,
      expectedStoragePath,
      existsInStorage: exists
    });
  }

  console.log(`Storage Status: ${storageAlreadyExistsCount}/56 already exist in Firebase Storage, ${storageMissingCount}/56 need to be uploaded.`);

  const fullReport = {
    totalManifestCount: manifestRecords.length,
    excelMatchedCount: sheetMatchCount,
    zipValidImagesCount: imageValidCount,
    firestoreProductsMatched: productsFoundInFirestore,
    firestoreTilesMatched: tilesFoundInFirestore,
    storageAlreadyExistsCount,
    storageMissingCount,
    records: manifestRecords.map((m, idx) => ({
      ...m,
      imageDetails: imageVerificationDetails[idx],
      firestore: firestoreAnalysis[idx],
      storage: storageStatus[idx]
    }))
  };

  fs.writeFileSync(
    path.join(__dirname, '56_mockups_analysis_report.json'),
    JSON.stringify(fullReport, null, 2),
    'utf8'
  );
  console.log('\nAnalysis completed! Full report saved to scripts/56_mockups_analysis_report.json');
}

main().catch(err => {
  console.error('Fatal analysis error:', err);
  process.exit(1);
});
