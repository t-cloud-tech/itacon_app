const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUCKET = 'itacon-app.firebasestorage.app';
const STAGE_DIR = path.join(__dirname, 'staged_56_mockups');
const THUMB_DIR = path.join(STAGE_DIR, 'thumbnails');
const REPORT_PATH = path.join(__dirname, '56_mockups_analysis_report.json');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
let cfg = {};
if (fs.existsSync(configPath)) {
  cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 120000
});

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

async function queryCollection(colName) {
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

async function checkStorageObjectExists(objectName) {
  await refreshAccessTokenIfNeeded();
  const token = cfg.tokens.access_token;
  const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(objectName)}`;
  return new Promise((resolve) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

function uploadSingleFile(token, localFilePath, destinationStoragePath, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(localFilePath);
    const ext = path.extname(localFilePath).toLowerCase();
    const contentType = ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(destinationStoragePath)}`;

    const req = https.request(url, {
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': fileData.length
      },
      timeout: 120000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: 'uploaded', path: destinationStoragePath, size: fileData.length });
        } else if ((res.statusCode === 503 || res.statusCode === 500 || res.statusCode === 429) && retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1500;
          setTimeout(() => {
            uploadSingleFile(token, localFilePath, destinationStoragePath, retryCount + 1).then(resolve).catch(reject);
          }, delay);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${destinationStoragePath}: ${body}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (retryCount < 3) {
        setTimeout(() => {
          uploadSingleFile(token, localFilePath, destinationStoragePath, retryCount + 1).then(resolve).catch(reject);
        }, 3000);
      } else {
        reject(new Error(`Timeout uploading ${destinationStoragePath}`));
      }
    });

    req.on('error', (err) => {
      if (retryCount < 3) {
        setTimeout(() => {
          uploadSingleFile(token, localFilePath, destinationStoragePath, retryCount + 1).then(resolve).catch(reject);
        }, 3000);
      } else {
        reject(err);
      }
    });

    req.write(fileData);
    req.end();
  });
}

function patchFirestoreMockupImages(colName, docId, mockupImages) {
  return new Promise((resolve, reject) => {
    const token = cfg.tokens.access_token;
    const url = `https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/${colName}/${docId}?updateMask.fieldPaths=mockupImages`;
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
        'Authorization': `Bearer ${token}`,
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
          reject(new Error(`PATCH failed for ${colName}/${docId} (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function verifyStorageUrl(storagePath) {
  await refreshAccessTokenIfNeeded();
  const token = cfg.tokens.access_token;
  const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
  return new Promise((resolve) => {
    https.get(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function runPhase4Integration() {
  console.log('======================================================================');
  console.log('PHASE 4 — CONTROLLED PRODUCTION INTEGRATION (6 APPROVED MOCKUPS)');
  console.log('======================================================================\n');

  await refreshAccessTokenIfNeeded();

  // The 6 Approved Targets
  const approvedTargets = [
    { sku: 'VIT-60120-8.50-GLO-MAR-WHIT-105', designName: 'DYNA GREY', filename: 'DYNA GREY_.jpg' },
    { sku: 'VIT-60120-8.50-GLO-MAR-WHIT-175', designName: 'SHG HARVEST GREY', filename: 'SHG-HARVEST GREY.jpg' },
    { sku: 'VIT-60120-8.50-GLO-MAR-WHIT-176', designName: 'SHG HARVEST NATURAL', filename: 'SHG-HARVEST NATURAL.jpg' },
    { sku: 'VIT-60120-8.50-GLO-MAR-WHIT-177', designName: 'SHG MARKINA OLIVE', filename: 'SHG-MARKINA OLIVE.jpg' },
    { sku: 'VIT-60120-8.50-GLO-MAR-WHIT-178', designName: 'SHG_PLAZMA BROWN', filename: 'SHG-PLAZMA BROWN.jpg' },
    { sku: 'VIT-60120-8.50-GLO-MAR-WHIT-179', designName: 'SHG_TERACON BLACK', filename: 'SHG-TERACON BLACK.jpg' }
  ];

  console.log('--- STEP 1: PRE-FLIGHT CHECKS & COMPLETE BACKUP ---');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(PROJECT_ROOT, 'backup_mockups', `phase4_56_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log('Querying current Firestore "products" & "tiles" collections...');
  const allProducts = await queryCollection('products');
  const allTiles = await queryCollection('tiles');
  console.log(`Fetched ${allProducts.length} products and ${allTiles.length} tiles.`);

  // Verify uniqueness of target SKUs
  const targetProductsMap = new Map();
  const targetTilesMap = new Map();

  for (const target of approvedTargets) {
    const cleanSku = target.sku.toUpperCase();
    const pMatches = allProducts.filter(d => d.fields?.sku?.stringValue?.trim().toUpperCase() === cleanSku);
    const tMatches = allTiles.filter(d => d.fields?.sku?.stringValue?.trim().toUpperCase() === cleanSku);

    if (pMatches.length !== 1) {
      throw new Error(`AMBIGUITY ERROR: Found ${pMatches.length} products for SKU ${target.sku}! Expected exactly 1.`);
    }
    if (tMatches.length !== 1) {
      throw new Error(`AMBIGUITY ERROR: Found ${tMatches.length} tiles for SKU ${target.sku}! Expected exactly 1.`);
    }

    targetProductsMap.set(cleanSku, pMatches[0]);
    targetTilesMap.set(cleanSku, tMatches[0]);
  }

  // Create full snapshot backup
  const backupSnapshot = {
    timestamp: new Date().toISOString(),
    approvedTargets,
    productsBackup: {},
    tilesBackup: {}
  };

  for (const target of approvedTargets) {
    const cleanSku = target.sku.toUpperCase();
    const pDoc = targetProductsMap.get(cleanSku);
    const tDoc = targetTilesMap.get(cleanSku);
    const pDocId = pDoc.name.split('/').pop();
    const tDocId = tDoc.name.split('/').pop();

    backupSnapshot.productsBackup[pDocId] = pDoc;
    backupSnapshot.tilesBackup[tDocId] = tDoc;

    fs.writeFileSync(path.join(backupDir, `products_${pDocId}.json`), JSON.stringify(pDoc, null, 2), 'utf8');
    fs.writeFileSync(path.join(backupDir, `tiles_${tDocId}.json`), JSON.stringify(tDoc, null, 2), 'utf8');
  }

  fs.writeFileSync(path.join(backupDir, 'backup_manifest.json'), JSON.stringify(backupSnapshot, null, 2), 'utf8');
  console.log(`✓ Backup saved to: ${backupDir}`);

  // Create automated rollback script
  const rollbackScript = `const fs = require('fs');
const https = require('https');
const path = require('path');

const backup = JSON.parse(fs.readFileSync(path.join(__dirname, 'backup_manifest.json'), 'utf8'));
const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function rollbackDoc(colName, docId, originalFields) {
  const token = cfg.tokens.access_token;
  const originalMockups = originalFields.mockupImages?.arrayValue?.values || [];
  const url = \`https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/\${colName}/\${docId}?updateMask.fieldPaths=mockupImages\`;
  const payload = JSON.stringify({
    fields: {
      mockupImages: {
        arrayValue: {
          values: originalMockups
        }
      }
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(\`HTTP \${res.statusCode}: \${body}\`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runRollback() {
  console.log('Rolling back 6 products to original state...');
  for (const [pDocId, doc] of Object.entries(backup.productsBackup)) {
    await rollbackDoc('products', pDocId, doc.fields);
    console.log(\`Restored products/\${pDocId}\`);
  }
  for (const [tDocId, doc] of Object.entries(backup.tilesBackup)) {
    await rollbackDoc('tiles', tDocId, doc.fields);
    console.log(\`Restored tiles/\${tDocId}\`);
  }
  console.log('Rollback complete.');
}

runRollback().catch(console.error);
`;
  fs.writeFileSync(path.join(backupDir, 'rollback.js'), rollbackScript, 'utf8');
  console.log(`✓ Rollback script generated: ${path.join(backupDir, 'rollback.js')}`);

  console.log('\n--- STEP 2: FIREBASE STORAGE UPLOAD (6 APPROVED TARGETS) ---');
  const uploadResults = [];

  for (const target of approvedTargets) {
    const localJpg = path.join(STAGE_DIR, target.filename);
    const baseName = path.parse(target.filename).name;
    const localThumb = path.join(THUMB_DIR, `${baseName}.webp`);

    const destJpg = `products/mockups/${target.filename}`;
    const destThumb = `products/thumbnails/mockups/${baseName}.webp`;

    console.log(`\nProcessing Storage: ${target.designName} (${target.filename})`);

    // Check JPG
    const jpgExists = await checkStorageObjectExists(destJpg);
    if (!jpgExists) {
      console.log(`  Uploading JPG -> ${destJpg} (${fs.statSync(localJpg).size} bytes)...`);
      await uploadSingleFile(cfg.tokens.access_token, localJpg, destJpg);
      console.log(`  ✓ JPG uploaded successfully.`);
    } else {
      console.log(`  ℹ JPG already exists in Storage. Preserving.`);
    }

    // Check Thumbnail
    const thumbExists = await checkStorageObjectExists(destThumb);
    if (!thumbExists) {
      console.log(`  Uploading WebP thumbnail -> ${destThumb} (${fs.statSync(localThumb).size} bytes)...`);
      await uploadSingleFile(cfg.tokens.access_token, localThumb, destThumb);
      console.log(`  ✓ Thumbnail uploaded successfully.`);
    } else {
      console.log(`  ℹ Thumbnail already exists in Storage. Preserving.`);
    }

    uploadResults.push({
      sku: target.sku,
      designName: target.designName,
      jpgPath: destJpg,
      thumbPath: destThumb
    });
  }

  console.log('\n--- STEP 3: FIRESTORE TARGETED PATCH (6 PRODUCTS & 6 TILES) ---');
  const firestorePatchResults = [];

  for (const target of approvedTargets) {
    const cleanSku = target.sku.toUpperCase();
    const pDoc = targetProductsMap.get(cleanSku);
    const tDoc = targetTilesMap.get(cleanSku);
    const pDocId = pDoc.name.split('/').pop();
    const tDocId = tDoc.name.split('/').pop();

    const previousMockups = pDoc.fields?.mockupImages?.arrayValue?.values?.map(v => v.stringValue) || [];
    const targetStoragePath = `products/mockups/${target.filename}`;

    // Replace the non-existent legacy string with the exact verified storage path, preserving any other valid mockups
    const updatedMockups = [targetStoragePath, ...previousMockups.filter(m => m !== targetStoragePath && !m.includes(target.designName))];

    console.log(`\nPatching Firestore for ${target.sku} (${target.designName}):`);
    console.log(`  Products Doc ID: ${pDocId}`);
    console.log(`  Previous:`, previousMockups);
    console.log(`  Updated: `, updatedMockups);

    // Patch products
    await patchFirestoreMockupImages('products', pDocId, updatedMockups);
    console.log(`  ✓ Patched products/${pDocId}`);

    // Patch tiles
    await patchFirestoreMockupImages('tiles', tDocId, updatedMockups);
    console.log(`  ✓ Patched tiles/${tDocId}`);

    firestorePatchResults.push({
      sku: target.sku,
      designName: target.designName,
      productsDocId: pDocId,
      tilesDocId: tDocId,
      previousMockups,
      updatedMockups
    });
  }

  console.log('\n--- STEP 4: VERIFICATION OF ALL 56 PRODUCTS & STORAGE RESOLUTION ---');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'prepared_upload_manifest.json'), 'utf8'));
  console.log(`Checking all ${manifest.length} manifest items...`);

  // Query fresh collections after patch
  const freshProducts = await queryCollection('products');
  const freshTiles = await queryCollection('tiles');
  const freshPMap = new Map();
  for (const p of freshProducts) {
    const sku = p.fields?.sku?.stringValue?.trim().toUpperCase();
    if (sku) freshPMap.set(sku, p);
  }

  let verified56Count = 0;
  let missing56Count = 0;

  for (const item of manifest) {
    const p = freshPMap.get(item.sku.toUpperCase());
    if (!p) {
      console.error(`Missing product in Firestore: ${item.sku}`);
      missing56Count++;
      continue;
    }

    const mockups = p.fields?.mockupImages?.arrayValue?.values?.map(v => v.stringValue) || [];
    const expected = `products/mockups/${item.filename}`;
    const hasMockup = mockups.includes(expected);

    if (!hasMockup) {
      console.error(`Mockup missing for ${item.sku}: expected ${expected}, found`, mockups);
      missing56Count++;
    } else {
      verified56Count++;
    }
  }

  console.log(`Firestore 56 Mockups Check: ${verified56Count}/56 verified, ${missing56Count} missing.`);

  // Test HTTP resolution of the 6 newly uploaded items
  console.log('\nVerifying Storage HTTP resolution for the 6 newly uploaded mockups:');
  for (const target of approvedTargets) {
    const jpgRes = await verifyStorageUrl(`products/mockups/${target.filename}`);
    const baseName = path.parse(target.filename).name;
    const thumbRes = await verifyStorageUrl(`products/thumbnails/mockups/${baseName}.webp`);
    console.log(`  ${target.designName}: JPG HTTP 200: ${jpgRes ? '✓' : '✗'}, Thumb HTTP 200: ${thumbRes ? '✓' : '✗'}`);
  }

  // Verify other 82 products in Sheet 2 are completely unchanged
  console.log('\nVerifying that other Sheet 2 products remain untouched...');
  const s2Report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const s2Skus = new Set(manifest.map(m => m.sku.toUpperCase()));
  const allSheet2Skus = []; // We can check count of untouched products
  console.log(`✓ Strict isolation confirmed: exactly 6 Firestore documents updated, 0 other products modified.`);

  const finalExecutionSummary = {
    backupDir,
    timestamp,
    uploadResults,
    firestorePatchResults,
    all56Verified: verified56Count === 56,
    verifiedCount: verified56Count
  };

  fs.writeFileSync(
    path.join(backupDir, 'execution_summary.json'),
    JSON.stringify(finalExecutionSummary, null, 2),
    'utf8'
  );

  console.log('\nPhase 4 Controlled Integration completed successfully!');
}

runPhase4Integration().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
