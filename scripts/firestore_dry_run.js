const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(PROJECT_ROOT, 'scripts', 'product_image_mapping.csv');

// Helper to fetch all documents from a Firestore collection via REST API
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

// Convert Firestore document fields to plain JS object
function parseFirestoreDoc(doc) {
  const docId = doc.name.split('/').pop();
  const fields = doc.fields || {};
  const res = { _docId: docId };

  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.arrayValue !== undefined) {
      res[k] = (v.arrayValue.values || []).map(val => {
        if (val.stringValue !== undefined) return val.stringValue;
        if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
        return val;
      });
    } else if (v.mapValue !== undefined) {
      res[k] = v.mapValue.fields;
    } else if (v.timestampValue !== undefined) {
      res[k] = v.timestampValue;
    } else if (v.nullValue !== undefined) {
      res[k] = null;
    }
  }
  return res;
}

async function runDryRun() {
  console.log('======================================================================');
  console.log('STEP 3 — FIRESTORE DRY RUN & AUDIT');
  console.log('======================================================================\n');

  // 1. Read CSV
  const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csvRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    records.push({
      sheet: parts[0],
      sku: parts[1],
      designName: parts[2],
      imageType: parts[3],
      imageFilename: parts[4],
      imageOrder: parseInt(parts[5], 10)
    });
  }

  // Group CSV by product SKU
  const csvProductsMap = new Map();
  for (const r of records) {
    if (!csvProductsMap.has(r.sku)) {
      csvProductsMap.set(r.sku, {
        sku: r.sku,
        sheet: r.sheet,
        designName: r.designName,
        mockups: [],
        tileFaces: []
      });
    }
    const p = csvProductsMap.get(r.sku);
    if (r.imageType === 'Mockup') {
      p.mockups.push({ filename: r.imageFilename, order: r.imageOrder });
    } else if (r.imageType === 'Tile Face') {
      p.tileFaces.push({ filename: r.imageFilename, order: r.imageOrder });
    }
  }

  // Sort images by order
  for (const p of csvProductsMap.values()) {
    p.mockups.sort((a, b) => a.order - b.order);
    p.tileFaces.sort((a, b) => a.order - b.order);
  }

  const totalCsvProducts = csvProductsMap.size;
  console.log(`Total CSV Unique Products: ${totalCsvProducts} (Expected: 235)`);
  const sheet2Products = Array.from(csvProductsMap.values()).filter(p => p.sheet === '2');
  const sheet3Products = Array.from(csvProductsMap.values()).filter(p => p.sheet === '3');
  console.log(`Sheet 2 products: ${sheet2Products.length} (Expected: 138)`);
  console.log(`Sheet 3 products: ${sheet3Products.length} (Expected: 97)\n`);

  // 2. Fetch Firestore collections
  console.log('Fetching Firestore "products" collection...');
  let productsDocsRaw = [];
  try {
    productsDocsRaw = await fetchFirestoreCollection('products');
    console.log(`Fetched ${productsDocsRaw.length} documents from "products"`);
  } catch (err) {
    console.error('Error fetching "products":', err.message);
  }

  console.log('Fetching Firestore "tiles" collection...');
  let tilesDocsRaw = [];
  try {
    tilesDocsRaw = await fetchFirestoreCollection('tiles');
    console.log(`Fetched ${tilesDocsRaw.length} documents from "tiles"`);
  } catch (err) {
    console.error('Error fetching "tiles":', err.message);
  }

  const productsParsed = productsDocsRaw.map(parseFirestoreDoc);
  const tilesParsed = tilesDocsRaw.map(parseFirestoreDoc);

  console.log('\n--- MATCHING AUDIT AGAINST "products" COLLECTION ---');
  const auditReport = performMatchingAudit(csvProductsMap, productsParsed, 'products');

  console.log('\n--- MATCHING AUDIT AGAINST "tiles" COLLECTION ---');
  const tilesAuditReport = performMatchingAudit(csvProductsMap, tilesParsed, 'tiles');

  const fullReport = {
    totalCsvProducts,
    sheet2Count: sheet2Products.length,
    sheet3Count: sheet3Products.length,
    productsCollection: auditReport,
    tilesCollection: tilesAuditReport
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'firestore_dry_run_report.json'),
    JSON.stringify(fullReport, null, 2),
    'utf8'
  );
  console.log('\nFull dry run report written to build/firestore_dry_run_report.json');
}

function performMatchingAudit(csvProductsMap, firestoreDocs, collectionName) {
  // Index firestore docs by docId, by sku, and by name
  const docById = new Map();
  const docBySku = new Map(); // sku -> list of docs
  const docByName = new Map(); // name -> list of docs

  for (const d of firestoreDocs) {
    docById.set(d._docId, d);

    if (d.sku) {
      const cleanSku = String(d.sku).trim().toUpperCase();
      if (!docBySku.has(cleanSku)) docBySku.set(cleanSku, []);
      docBySku.get(cleanSku).push(d);
    }

    if (d.name) {
      const cleanName = String(d.name).trim().toUpperCase();
      if (!docByName.has(cleanName)) docByName.set(cleanName, []);
      docByName.get(cleanName).push(d);
    }
  }

  let foundCount = 0;
  let missingCount = 0;
  let multipleMatchesCount = 0;
  let designMismatchesCount = 0;

  const foundList = [];
  const missingList = [];
  const multipleList = [];
  const designMismatches = [];

  const existingMockupsPopulated = [];
  const existingFacesPopulated = [];
  const existingImagesPopulated = [];

  for (const [sku, csvProd] of csvProductsMap.entries()) {
    const expectedDocId = 'PROD_' + sku.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanSku = sku.trim().toUpperCase();

    // Check by SKU first
    const skuMatches = docBySku.get(cleanSku) || [];
    let matchedDoc = null;

    if (skuMatches.length === 1) {
      matchedDoc = skuMatches[0];
    } else if (skuMatches.length > 1) {
      multipleMatchesCount++;
      multipleList.push({ sku, matches: skuMatches.map(m => m._docId) });
      matchedDoc = skuMatches[0]; // pick primary
    } else {
      // Try direct docId match
      if (docById.has(expectedDocId)) {
        matchedDoc = docById.get(expectedDocId);
      } else {
        // Try design name match
        const nameMatches = docByName.get(csvProd.designName.trim().toUpperCase()) || [];
        if (nameMatches.length === 1) {
          matchedDoc = nameMatches[0];
        } else if (nameMatches.length > 1) {
          multipleMatchesCount++;
          multipleList.push({ sku, designName: csvProd.designName, nameMatches: nameMatches.map(m => m._docId) });
          matchedDoc = nameMatches[0];
        }
      }
    }

    if (matchedDoc) {
      foundCount++;
      const fsName = matchedDoc.name || '';
      const csvName = csvProd.designName;
      let nameMatches = (fsName.trim().toUpperCase() === csvName.trim().toUpperCase());
      // Handle approved special mapping DYNA FANTASTICO
      if (csvProd.designName === 'DYNA FANTASTICO') {
        nameMatches = true;
      }
      if (!nameMatches) {
        designMismatchesCount++;
        designMismatches.push({
          sku,
          csvDesignName: csvName,
          firestoreDocId: matchedDoc._docId,
          firestoreName: fsName
        });
      }

      // Check existing image fields in Firestore document
      const hasMockups = Array.isArray(matchedDoc.mockupImages) && matchedDoc.mockupImages.length > 0;
      const hasFaces = Array.isArray(matchedDoc.faceImages) && matchedDoc.faceImages.length > 0;
      const hasImages = Array.isArray(matchedDoc.images) && matchedDoc.images.length > 0;

      if (hasMockups) existingMockupsPopulated.push({ docId: matchedDoc._docId, sku, count: matchedDoc.mockupImages.length, sample: matchedDoc.mockupImages[0] });
      if (hasFaces) existingFacesPopulated.push({ docId: matchedDoc._docId, sku, count: matchedDoc.faceImages.length, sample: matchedDoc.faceImages[0] });
      if (hasImages) existingImagesPopulated.push({ docId: matchedDoc._docId, sku, count: matchedDoc.images.length, sample: matchedDoc.images[0] });

      foundList.push({
        sku,
        docId: matchedDoc._docId,
        designName: csvProd.designName,
        sheet: csvProd.sheet,
        existingFields: {
          mockupImagesCount: hasMockups ? matchedDoc.mockupImages.length : 0,
          faceImagesCount: hasFaces ? matchedDoc.faceImages.length : 0,
          imagesCount: hasImages ? matchedDoc.images.length : 0
        },
        newProposedFields: {
          mockupImages: csvProd.mockups.map(m => `products/mockups/${m.filename}`),
          faceImages: csvProd.tileFaces.map(f => `products/tiles/${f.filename}`),
          // Preserving existing legacy images
          preservedImagesCount: hasImages ? matchedDoc.images.length : 0
        }
      });
    } else {
      missingCount++;
      missingList.push({
        sku,
        expectedDocId,
        designName: csvProd.designName,
        sheet: csvProd.sheet
      });
    }
  }

  console.log(`Collection: "${collectionName}" (Total docs in collection: ${firestoreDocs.length})`);
  console.log(`- Products Found: ${foundCount} / ${csvProductsMap.size}`);
  console.log(`- Products Missing: ${missingCount}`);
  console.log(`- Duplicate SKU Matches: ${multipleMatchesCount}`);
  console.log(`- Design Name Mismatches: ${designMismatchesCount}`);
  console.log(`- Existing mockupImages populated: ${existingMockupsPopulated.length}`);
  console.log(`- Existing faceImages populated: ${existingFacesPopulated.length}`);
  console.log(`- Existing images populated: ${existingImagesPopulated.length}`);

  return {
    collectionName,
    totalCollectionDocs: firestoreDocs.length,
    foundCount,
    missingCount,
    multipleMatchesCount,
    designMismatchesCount,
    designMismatches,
    missingList,
    multipleList,
    existingMockupsPopulatedCount: existingMockupsPopulated.length,
    existingFacesPopulatedCount: existingFacesPopulated.length,
    existingImagesPopulatedCount: existingImagesPopulated.length,
    sampleFoundProducts: foundList.slice(0, 5)
  };
}

runDryRun().catch(err => {
  console.error('Firestore dry run error:', err);
  process.exit(1);
});
