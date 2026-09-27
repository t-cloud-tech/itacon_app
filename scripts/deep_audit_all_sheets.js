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

async function runDeepAudit() {
  console.log('Reading Master Excel...');
  const wb = XLSX.readFile(EXCEL_PATH);

  // 1. Audit Sheets 1, 2, 3
  const sheetsAudit = {};
  for (const sheetName of ['1', '2', '3']) {
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    
    // Find header row
    let headerRowIdx = 1;
    if (rawRows[0] && rawRows[0].some(c => String(c).toLowerCase().includes('sku'))) {
      headerRowIdx = 0;
    }
    const headers = rawRows[headerRowIdx] || [];
    
    // Find exact column indices
    let skuColIdx = -1;
    let designColIdx = -1;
    headers.forEach((h, idx) => {
      const lower = String(h).toLowerCase().trim();
      if (lower === 'sku code' || lower === 'sku') skuColIdx = idx;
      if (lower === 'design name') designColIdx = idx;
    });

    console.log(`Sheet ${sheetName}: SKU Col = ${skuColIdx} ("${headers[skuColIdx]}"), Design Col = ${designColIdx} ("${headers[designColIdx]}")`);

    const dataRows = rawRows.slice(headerRowIdx + 1);
    const validProducts = [];
    const blankRows = [];
    const duplicateSkus = [];
    const duplicateDesignNames = [];
    const seenSkus = new Map();
    const seenDesignNames = new Map();
    const missingSkus = [];
    const missingDesignNames = [];

    dataRows.forEach((r, idx) => {
      const excelRow = headerRowIdx + 1 + idx + 1;
      const sku = (skuColIdx !== -1 && r[skuColIdx]) ? String(r[skuColIdx]).trim() : '';
      const designName = (designColIdx !== -1 && r[designColIdx]) ? String(r[designColIdx]).trim() : '';

      const isAllBlank = r.every(cell => String(cell).trim() === '');
      if (isAllBlank) {
        blankRows.push(excelRow);
        return;
      }

      if (!sku && !designName) {
        blankRows.push(excelRow);
        return;
      }

      if (!sku) {
        missingSkus.push({ row: excelRow, designName });
      }
      if (!designName) {
        missingDesignNames.push({ row: excelRow, sku });
      }

      if (sku) {
        if (seenSkus.has(sku)) {
          duplicateSkus.push({ row: excelRow, sku, designName, firstSeenRow: seenSkus.get(sku) });
        } else {
          seenSkus.set(sku, excelRow);
        }
      }

      if (designName) {
        if (seenDesignNames.has(designName.toUpperCase())) {
          duplicateDesignNames.push({ row: excelRow, sku, designName, firstSeenRow: seenDesignNames.get(designName.toUpperCase()) });
        } else {
          seenDesignNames.set(designName.toUpperCase(), excelRow);
        }
      }

      if (sku || designName) {
        validProducts.push({
          excelRow,
          sku,
          designName,
          shortCode: r[8] ? String(r[8]).trim() : '',
          surface: r[5] ? String(r[5]).trim() : '',
          collection: r[6] ? String(r[6]).trim() : '',
          baseColor: r[7] ? String(r[7]).trim() : '',
          size: r[3] ? String(r[3]).trim() : '',
          thickness: r[4] ? Number(r[4]) : null,
          boxWeight: r[11] ? Number(r[11]) : null,
          pcsPerBox: r[12] ? Number(r[12]) : null,
          sqFtPerBox: r[13] ? Number(r[13]) : null,
          price: r[14] ? Number(r[14]) : null,
          rawRow: r
        });
      }
    });

    sheetsAudit[sheetName] = {
      sheetName,
      rawRowCount: rawRows.length,
      validProductCount: validProducts.length,
      blankRowCount: blankRows.length,
      blankRows,
      skuRange: {
        first: validProducts[0]?.sku,
        last: validProducts[validProducts.length - 1]?.sku
      },
      duplicateSkus,
      duplicateDesignNames,
      missingSkus,
      missingDesignNames,
      products: validProducts
    };
  }

  // 2. Fetch Production Firestore docs
  console.log('\nFetching Firestore products & tiles...');
  const [productsRaw, tilesRaw] = await Promise.all([
    fetchAllFirestoreDocs('products'),
    fetchAllFirestoreDocs('tiles')
  ]);
  const products = productsRaw.map(parseDoc);
  const tiles = tilesRaw.map(parseDoc);

  // 3. Fetch Storage Objects
  console.log('\nFetching Storage inventory...');
  const token = await getAccessToken();
  const storageMap = await fetchStorageInventory(token);

  // 4. Detailed comparison
  const productsBySku = new Map();
  const productsByDocId = new Map();
  products.forEach(p => {
    if (p.sku) productsBySku.set(p.sku, p);
    productsByDocId.set(p._docId, p);
  });

  const tilesBySku = new Map();
  const tilesByDocId = new Map();
  tiles.forEach(t => {
    if (t.sku) tilesBySku.set(t.sku, t);
    tilesByDocId.set(t._docId, t);
  });

  // Check Sheet 1, 2, 3 against Firestore
  const comparison = {};
  for (const sheetName of ['1', '2', '3']) {
    const sheetData = sheetsAudit[sheetName];
    const foundInProducts = [];
    const missingFromProducts = [];
    const foundInTiles = [];
    const missingFromTiles = [];

    for (const p of sheetData.products) {
      const fireDoc = productsBySku.get(p.sku);
      if (fireDoc) {
        foundInProducts.push({ excel: p, fireDoc });
      } else {
        // Also try matching by docId or designName
        const altDoc = Array.from(productsBySku.values()).find(d => 
          (d.name && p.designName && d.name.toLowerCase() === p.designName.toLowerCase()) ||
          (d.id && p.sku && d.id.includes(p.sku.replace(/[^a-zA-Z0-9]/g, '_')))
        );
        missingFromProducts.push({ excel: p, altMatch: altDoc ? altDoc.sku : null });
      }

      const tileDoc = tilesBySku.get(p.sku);
      if (tileDoc) {
        foundInTiles.push({ excel: p, tileDoc });
      } else {
        missingFromTiles.push({ excel: p });
      }
    }

    comparison[sheetName] = {
      sheetName,
      excelCount: sheetData.products.length,
      foundInProductsCount: foundInProducts.length,
      missingFromProductsCount: missingFromProducts.length,
      missingFromProducts,
      foundInTilesCount: foundInTiles.length,
      missingFromTilesCount: missingFromTiles.length,
      missingFromTiles,
      foundInProducts
    };
  }

  // Any products in Firestore not in Sheet 1, 2, 3?
  const allExcelSkus = new Set();
  ['1', '2', '3'].forEach(s => sheetsAudit[s].products.forEach(p => allExcelSkus.add(p.sku)));

  const extraInProducts = products.filter(p => !allExcelSkus.has(p.sku));
  const extraInTiles = tiles.filter(t => !allExcelSkus.has(t.sku));

  // 5. Audit Mockups and Image Architecture for ALL products in Firestore
  const imageAudit = {
    classA_workingPrimaryMockup: [],
    classB_mockupImagesMissing: [],
    classC_mockupImagesEmpty: [],
    classD_storageObjectMissing: [],
    classE_storageExistsCannotDisplay: [],
    classF_legacyImageOnly: [],
    classG_noUsableImage: []
  };

  function checkStorageExists(imgPath) {
    if (!imgPath) return false;
    // Check direct path or URL
    if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) return true; // External URL
    return storageMap.has(imgPath);
  }

  products.forEach(p => {
    const hasMockupArray = Array.isArray(p.mockupImages);
    const mockupArrayEmpty = !hasMockupArray || p.mockupImages.length === 0;
    const hasImagesArray = Array.isArray(p.images) && p.images.length > 0;
    const hasFaceImagesArray = Array.isArray(p.faceImages) && p.faceImages.length > 0;
    const hasLifestyleArray = Array.isArray(p.lifestyleImages) && p.lifestyleImages.length > 0;

    let primaryMockupPath = (!mockupArrayEmpty) ? p.mockupImages[0] : null;
    let primaryMockupInStorage = primaryMockupPath ? checkStorageExists(primaryMockupPath) : false;

    let primaryLegacyPath = hasImagesArray ? p.images[0] : null;
    let primaryLegacyInStorage = primaryLegacyPath ? checkStorageExists(primaryLegacyPath) : false;

    let primaryFacePath = hasFaceImagesArray ? p.faceImages[0] : null;
    let primaryFaceInStorage = primaryFacePath ? checkStorageExists(primaryFacePath) : false;

    // Classification
    if (primaryMockupPath && primaryMockupInStorage) {
      imageAudit.classA_workingPrimaryMockup.push({
        sku: p.sku,
        name: p.name,
        mockupPath: primaryMockupPath,
        _docId: p._docId
      });
    } else if (primaryMockupPath && !primaryMockupInStorage) {
      imageAudit.classD_storageObjectMissing.push({
        sku: p.sku,
        name: p.name,
        missingMockupPath: primaryMockupPath,
        legacyPath: primaryLegacyPath,
        legacyInStorage: primaryLegacyInStorage,
        _docId: p._docId
      });
    } else if (!hasMockupArray) {
      imageAudit.classB_mockupImagesMissing.push({
        sku: p.sku,
        name: p.name,
        legacyPath: primaryLegacyPath,
        legacyInStorage: primaryLegacyInStorage,
        _docId: p._docId
      });
    } else if (mockupArrayEmpty) {
      if (hasImagesArray && primaryLegacyInStorage) {
        imageAudit.classF_legacyImageOnly.push({
          sku: p.sku,
          name: p.name,
          legacyPath: primaryLegacyPath,
          _docId: p._docId
        });
      } else if (!hasImagesArray && !hasFaceImagesArray) {
        imageAudit.classG_noUsableImage.push({
          sku: p.sku,
          name: p.name,
          _docId: p._docId
        });
      } else {
        imageAudit.classC_mockupImagesEmpty.push({
          sku: p.sku,
          name: p.name,
          _docId: p._docId
        });
      }
    }
  });

  // 6. Running Catalogue Pipeline & Exclusion Analysis
  // Trace how getTilesCatalogueAdvanced() and ProductCatalogService interact
  const activeProducts = products.filter(p => p.isActive === true);
  const inactiveProducts = products.filter(p => p.isActive === false);
  const missingActiveProducts = products.filter(p => p.isActive === undefined || p.isActive === null);

  // Group by category/collection/productLine
  const productsByProductLine = {};
  products.forEach(p => {
    const pl = p.productLine || 'none';
    productsByProductLine[pl] = (productsByProductLine[pl] || 0) + 1;
  });

  // 7. Check ProductCatalogService static products
  const staticCatalogFile = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'services', 'product_catalog_service.dart'), 'utf8');
  const staticSkus = [];
  const skuRegex = /sku:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = skuRegex.exec(staticCatalogFile)) !== null) {
    staticSkus.push(match[1]);
  }

  const staticTileSkus = staticSkus.filter(s => !s.startsWith('ITA-LX-'));
  const staticAdhesiveSkus = staticSkus.filter(s => s.startsWith('ITA-LX-'));

  const fullReport = {
    timestamp: new Date().toISOString(),
    masterExcel: {
      sheet1: {
        rawRowCount: sheetsAudit['1'].rawRowCount,
        validProductCount: sheetsAudit['1'].validProductCount,
        blankRowCount: sheetsAudit['1'].blankRowCount,
        blankRows: sheetsAudit['1'].blankRows,
        skuRange: sheetsAudit['1'].skuRange,
        duplicateSkus: sheetsAudit['1'].duplicateSkus,
        duplicateDesignNames: sheetsAudit['1'].duplicateDesignNames,
        missingSkus: sheetsAudit['1'].missingSkus,
        missingDesignNames: sheetsAudit['1'].missingDesignNames,
        sampleProducts: sheetsAudit['1'].products.slice(0, 5)
      },
      sheet2: {
        rawRowCount: sheetsAudit['2'].rawRowCount,
        validProductCount: sheetsAudit['2'].validProductCount,
        blankRowCount: sheetsAudit['2'].blankRowCount,
        skuRange: sheetsAudit['2'].skuRange,
        duplicateSkus: sheetsAudit['2'].duplicateSkus,
        duplicateDesignNames: sheetsAudit['2'].duplicateDesignNames
      },
      sheet3: {
        rawRowCount: sheetsAudit['3'].rawRowCount,
        validProductCount: sheetsAudit['3'].validProductCount,
        blankRowCount: sheetsAudit['3'].blankRowCount,
        skuRange: sheetsAudit['3'].skuRange,
        duplicateSkus: sheetsAudit['3'].duplicateSkus,
        duplicateDesignNames: sheetsAudit['3'].duplicateDesignNames
      },
      totalExpectedProducts: sheetsAudit['1'].validProductCount + sheetsAudit['2'].validProductCount + sheetsAudit['3'].validProductCount
    },
    firestore: {
      totalProductsCollection: products.length,
      totalTilesCollection: tiles.length,
      activeProductsCount: activeProducts.length,
      inactiveProductsCount: inactiveProducts.length,
      missingActiveProductsCount: missingActiveProducts.length,
      inactiveProductSkus: inactiveProducts.map(p => ({ sku: p.sku, name: p.name })),
      missingActiveSkus: missingActiveProducts.map(p => ({ sku: p.sku, name: p.name })),
      productsByProductLine,
      sheet1Comparison: {
        excelCount: comparison['1'].excelCount,
        foundInFirestoreProducts: comparison['1'].foundInProductsCount,
        missingFromFirestoreProducts: comparison['1'].missingFromProductsCount,
        missingSkus: comparison['1'].missingFromProducts.map(m => ({ sku: m.excel.sku, designName: m.excel.designName, row: m.excel.excelRow })),
        foundInTiles: comparison['1'].foundInTilesCount
      },
      sheet2Comparison: {
        excelCount: comparison['2'].excelCount,
        foundInFirestoreProducts: comparison['2'].foundInProductsCount,
        missingFromFirestoreProducts: comparison['2'].missingFromProductsCount,
        foundInTiles: comparison['2'].foundInTilesCount
      },
      sheet3Comparison: {
        excelCount: comparison['3'].excelCount,
        foundInFirestoreProducts: comparison['3'].foundInProductsCount,
        missingFromFirestoreProducts: comparison['3'].missingFromProductsCount,
        foundInTiles: comparison['3'].foundInTilesCount
      },
      extraInProducts: extraInProducts.map(p => ({ sku: p.sku, name: p.name, _docId: p._docId })),
      extraInTiles: extraInTiles.map(t => ({ sku: t.sku, name: t.name, _docId: t._docId }))
    },
    staticCatalogService: {
      totalStaticProducts: staticSkus.length,
      staticTileCount: staticTileSkus.length,
      staticAdhesiveCount: staticAdhesiveSkus.length,
      staticTileRange: {
        first: staticTileSkus[0],
        last: staticTileSkus[staticTileSkus.length - 1]
      },
      commentClaim: "203 tile products + 6 adhesives = 209 catalog products"
    },
    imageClassification: {
      classA_count: imageAudit.classA_workingPrimaryMockup.length,
      classB_count: imageAudit.classB_mockupImagesMissing.length,
      classC_count: imageAudit.classC_mockupImagesEmpty.length,
      classD_count: imageAudit.classD_storageObjectMissing.length,
      classE_count: imageAudit.classE_storageExistsCannotDisplay.length,
      classF_count: imageAudit.classF_legacyImageOnly.length,
      classG_count: imageAudit.classG_noUsableImage.length,
      classD_details: imageAudit.classD_storageObjectMissing,
      classB_details: imageAudit.classB_mockupImagesMissing,
      classC_details: imageAudit.classC_mockupImagesEmpty,
      classF_details: imageAudit.classF_legacyImageOnly,
      classG_details: imageAudit.classG_noUsableImage
    }
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'complete_catalogue_audit.json'),
    JSON.stringify(fullReport, null, 2),
    'utf8'
  );

  console.log('\n======================================================================');
  console.log('AUDIT SUMMARY HIGHLIGHTS:');
  console.log('======================================================================');
  console.log(`Master Excel Sheet 1 valid products: ${fullReport.masterExcel.sheet1.validProductCount}`);
  console.log(`Master Excel Sheet 2 valid products: ${fullReport.masterExcel.sheet2.validProductCount}`);
  console.log(`Master Excel Sheet 3 valid products: ${fullReport.masterExcel.sheet3.validProductCount}`);
  console.log(`Total Master Excel expected:        ${fullReport.masterExcel.totalExpectedProducts}`);
  console.log(`----------------------------------------------------------------------`);
  console.log(`Firestore "products" total:         ${fullReport.firestore.totalProductsCollection}`);
  console.log(`Firestore "tiles" total:            ${fullReport.firestore.totalTilesCollection}`);
  console.log(`Sheet 1 in Firestore "products":    ${fullReport.firestore.sheet1Comparison.foundInFirestoreProducts} found / ${fullReport.firestore.sheet1Comparison.missingFromFirestoreProducts} missing`);
  console.log(`Sheet 2 in Firestore "products":    ${fullReport.firestore.sheet2Comparison.foundInFirestoreProducts} found / ${fullReport.firestore.sheet2Comparison.missingFromFirestoreProducts} missing`);
  console.log(`Sheet 3 in Firestore "products":    ${fullReport.firestore.sheet3Comparison.foundInFirestoreProducts} found / ${fullReport.firestore.sheet3Comparison.missingFromFirestoreProducts} missing`);
  console.log(`----------------------------------------------------------------------`);
  console.log(`Static ProductCatalogService products: ${fullReport.staticCatalogService.totalStaticProducts} (${fullReport.staticCatalogService.staticTileCount} tiles + ${fullReport.staticCatalogService.staticAdhesiveCount} adhesives)`);
  console.log(`----------------------------------------------------------------------`);
  console.log(`Image Class A (Working mockup):     ${fullReport.imageClassification.classA_count}`);
  console.log(`Image Class D (Storage missing):    ${fullReport.imageClassification.classD_count}`);
  console.log(`Image Class B/C/F/G:                ${fullReport.imageClassification.classB_count + fullReport.imageClassification.classC_count + fullReport.imageClassification.classF_count + fullReport.imageClassification.classG_count}`);
  console.log('======================================================================\n');
}

runDeepAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
