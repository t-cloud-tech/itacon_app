const fs = require('fs');
const path = require('path');
const https = require('https');
const XLSX = require('./node_modules/xlsx');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = 'D:/Itacon Product (2) (1) (2).xlsx';
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
    } else if (v.mapValue !== undefined) {
      res[k] = v.mapValue.fields;
    }
  }
  return res;
}

// Fetch all Storage objects in bucket
async function fetchStorageInventory(token) {
  const storageMap = new Map();
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
      data.items.forEach(i => storageMap.set(i.name, { size: parseInt(i.size, 10), updated: i.updated }));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return storageMap;
}

async function runAudit() {
  console.log('======================================================================');
  console.log('COMPREHENSIVE READ-ONLY CATALOGUE DISCREPANCY AUDIT');
  console.log('======================================================================\n');

  // 1. INSPECT MASTER EXCEL WORKBOOK
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Master Excel file not found at ${EXCEL_PATH}`);
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log('Workbook Sheet Names:', wb.SheetNames);

  // Inspect each sheet
  const excelData = {};
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log(`\n--- Sheet "${sheetName}" ---`);
    console.log(`Raw rows: ${rawRows.length}`);
    if (rawRows.length > 0) {
      console.log(`Row 0:`, JSON.stringify(rawRows[0].slice(0, 15)));
    }
    if (rawRows.length > 1) {
      console.log(`Row 1 (Headers):`, JSON.stringify(rawRows[1].slice(0, 15)));
    }
    if (rawRows.length > 2) {
      console.log(`Row 2 (Sample data):`, JSON.stringify(rawRows[2].slice(0, 15)));
    }

    // Determine header row and product rows
    let headerRowIdx = 1;
    // Check if row 0 has headers or row 1
    if (rawRows[0] && rawRows[0].some(c => String(c).toLowerCase().includes('sku'))) {
      headerRowIdx = 0;
    }

    const headers = rawRows[headerRowIdx] || [];
    const skuColIdx = headers.findIndex(h => String(h).toLowerCase().includes('sku'));
    const designColIdx = headers.findIndex(h => String(h).toLowerCase().includes('design') || String(h).toLowerCase().includes('name'));

    console.log(`Detected SKU col index: ${skuColIdx} (${headers[skuColIdx]}), Design col index: ${designColIdx} (${headers[designColIdx]})`);

    const dataRows = rawRows.slice(headerRowIdx + 1);
    const validRows = [];
    const blankRows = [];
    const duplicateSkus = [];
    const seenSkus = new Set();
    const missingSkus = [];
    const missingDesignNames = [];

    dataRows.forEach((r, idx) => {
      const rowIndex = headerRowIdx + 1 + idx + 1; // 1-based Excel row number
      const skuVal = (skuColIdx !== -1 && r[skuColIdx]) ? String(r[skuColIdx]).trim() : '';
      const designVal = (designColIdx !== -1 && r[designColIdx]) ? String(r[designColIdx]).trim() : '';

      const isCompletelyEmpty = r.every(c => String(c).trim() === '');
      if (isCompletelyEmpty) {
        blankRows.push(rowIndex);
        return;
      }

      if (!skuVal && !designVal) {
        blankRows.push(rowIndex);
        return;
      }

      if (!skuVal) {
        missingSkus.push({ row: rowIndex, designName: designVal });
      }
      if (!designVal) {
        missingDesignNames.push({ row: rowIndex, sku: skuVal });
      }

      if (skuVal) {
        if (seenSkus.has(skuVal)) {
          duplicateSkus.push({ row: rowIndex, sku: skuVal, designName: designVal });
        } else {
          seenSkus.add(skuVal);
        }
      }

      validRows.push({
        excelRow: rowIndex,
        sku: skuVal,
        designName: designVal,
        raw: r
      });
    });

    excelData[sheetName] = {
      sheetName,
      rawRowCount: rawRows.length,
      validProductCount: validRows.length,
      blankRowCount: blankRows.length,
      skuRange: {
        first: validRows[0]?.sku,
        last: validRows[validRows.length - 1]?.sku
      },
      duplicateSkus,
      missingSkus,
      missingDesignNames,
      products: validRows
    };

    console.log(`Sheet "${sheetName}": Valid Products = ${validRows.length}, Duplicates = ${duplicateSkus.length}, Missing SKUs = ${missingSkus.length}, Missing Design Names = ${missingDesignNames.length}`);
    console.log(`SKU Range: ${validRows[0]?.sku} -> ${validRows[validRows.length - 1]?.sku}`);
  }

  // 2. FETCH PRODUCTION FIRESTORE
  console.log('\n2. Fetching Production Firestore...');
  const [productsRaw, tilesRaw] = await Promise.all([
    fetchAllFirestoreDocs('products'),
    fetchAllFirestoreDocs('tiles')
  ]);
  const products = productsRaw.map(parseDoc);
  const tiles = tilesRaw.map(parseDoc);
  console.log(`Firestore "products" count: ${products.length}`);
  console.log(`Firestore "tiles" count: ${tiles.length}`);

  // Fetch Storage
  console.log('\n3. Fetching Storage Inventory...');
  const token = await getAccessToken();
  const storageMap = await fetchStorageInventory(token);
  console.log(`Storage objects in bucket: ${storageMap.size}`);

  // Save intermediate data for deep inspection
  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'audit_intermediate.json'),
    JSON.stringify({ excelData, productsCount: products.length, tilesCount: tiles.length }, null, 2),
    'utf8'
  );
  console.log('\nIntermediate data saved to build/audit_intermediate.json');

  return { excelData, products, tiles, storageMap };
}

runAudit().catch(err => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
