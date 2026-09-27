const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(PROJECT_ROOT, 'scripts', 'product_image_mapping.csv');

// Fetch all documents from collection via REST
async function fetchFirestoreCollection(collectionName) {
  let allDocs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/${collectionName}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Failed to fetch ${collectionName}: HTTP ${res.statusCode}: ${body}`));
          }
        });
      }).on('error', reject);
    });

    if (data.documents) {
      allDocs = allDocs.concat(data.documents);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allDocs;
}

// Surgical PATCH to update ONLY mockupImages field
function patchMockupImages(collectionName, docId, mockupImages) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/${collectionName}/${docId}?updateMask.fieldPaths=mockupImages`;
    const payload = JSON.stringify({
      fields: {
        mockupImages: {
          arrayValue: {
            values: mockupImages.map(img => ({ stringValue: img }))
          }
        }
      }
    });

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
          reject(new Error(`PATCH failed for ${collectionName}/${docId} (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runUpdate() {
  console.log('======================================================================');
  console.log('PHASE 4B — UPDATE EXISTING SHEET 2 PRODUCTS IN FIRESTORE');
  console.log('======================================================================\n');

  // 1. Read CSV and filter Sheet 2
  const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csvRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const s2Map = new Map(); // sku -> mockupFilename

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    if (parts[0] === '2' && parts[3] === 'Mockup') {
      s2Map.set(parts[1], {
        sku: parts[1],
        designName: parts[2],
        filename: parts[4] // Exact filename preserved
      });
    }
  }

  console.log(`Sheet 2 products in CSV: ${s2Map.size} (Expected: 138)`);

  // 2. Fetch existing products from Firestore
  console.log('Fetching Firestore "products" collection...');
  const productsDocs = await fetchFirestoreCollection('products');
  console.log(`Fetched ${productsDocs.length} documents from "products"`);

  console.log('Fetching Firestore "tiles" collection...');
  const tilesDocs = await fetchFirestoreCollection('tiles');
  console.log(`Fetched ${tilesDocs.length} documents from "tiles"`);

  // Index by SKU
  const productDocBySku = new Map();
  for (const d of productsDocs) {
    const sku = d.fields && d.fields.sku && d.fields.sku.stringValue ? d.fields.sku.stringValue.trim().toUpperCase() : null;
    if (sku) productDocBySku.set(sku, d);
  }

  const tilesDocBySku = new Map();
  for (const d of tilesDocs) {
    const sku = d.fields && d.fields.sku && d.fields.sku.stringValue ? d.fields.sku.stringValue.trim().toUpperCase() : null;
    if (sku) tilesDocBySku.set(sku, d);
  }

  const results = {
    totalSheet2Expected: s2Map.size,
    productsUpdated: 0,
    tilesUpdated: 0,
    failures: [],
    updatedList: []
  };

  for (const [sku, s2Item] of s2Map.entries()) {
    const approvedMockupPath = `products/mockups/${s2Item.filename}`;
    const cleanSku = sku.toUpperCase();

    const pDoc = productDocBySku.get(cleanSku);
    if (!pDoc) {
      console.error(`ERROR: Product not found in "products" for SKU: ${sku}`);
      results.failures.push({ sku, error: 'Not found in products' });
      continue;
    }

    const pDocId = pDoc.name.split('/').pop();
    const existingMockups = (pDoc.fields.mockupImages && pDoc.fields.mockupImages.arrayValue && pDoc.fields.mockupImages.arrayValue.values)
      ? pDoc.fields.mockupImages.arrayValue.values.map(v => v.stringValue).filter(Boolean)
      : [];

    // Intelligent merge: approved mockup path is primary ([0]), existing room mockups preserved after it, deduplicated
    const newMockupList = [approvedMockupPath, ...existingMockups.filter(p => p !== approvedMockupPath)];

    try {
      await patchMockupImages('products', pDocId, newMockupList);
      results.productsUpdated++;
    } catch (err) {
      console.error(`Failed to update products/${pDocId}:`, err.message);
      results.failures.push({ sku, docId: pDocId, collection: 'products', error: err.message });
    }

    // Also update mirror tiles collection if document exists there
    const tDoc = tilesDocBySku.get(cleanSku);
    if (tDoc) {
      const tDocId = tDoc.name.split('/').pop();
      try {
        await patchMockupImages('tiles', tDocId, newMockupList);
        results.tilesUpdated++;
      } catch (err) {
        console.error(`Failed to update tiles/${tDocId}:`, err.message);
        results.failures.push({ sku, docId: tDocId, collection: 'tiles', error: err.message });
      }
    }

    results.updatedList.push({
      sku,
      pDocId,
      designName: s2Item.designName,
      approvedMockupPath,
      previousMockupCount: existingMockups.length,
      newMockupCount: newMockupList.length,
      primaryMockup: newMockupList[0]
    });
  }

  console.log(`\n--- SHEET 2 UPDATE SUMMARY ---`);
  console.log(`Sheet 2 products updated in "products": ${results.productsUpdated} / 138`);
  console.log(`Sheet 2 products updated in "tiles": ${results.tilesUpdated} / 138`);
  console.log(`Failures: ${results.failures.length}`);

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'sheet2_update_report.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('Sheet 2 update report written to build/sheet2_update_report.json');
}

runUpdate().catch(err => {
  console.error('Fatal Sheet 2 update error:', err);
  process.exit(1);
});
