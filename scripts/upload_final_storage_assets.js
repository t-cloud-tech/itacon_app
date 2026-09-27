const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUCKET = 'itacon-app.firebasestorage.app';

// Persistent HTTPS agent with keep-alive
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 120000
});

function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cfg.tokens.access_token;
}

async function refreshAccessTokenIfNeeded() {
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
}

async function fetchExistingStorageObjects() {
  console.log('Fetching inventory of existing objects in Firebase Storage for idempotency check...');
  let token = getAccessToken();
  const storageMap = new Map(); // path -> size
  let pageToken = '';
  do {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?maxResults=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, {
        agent: httpsAgent,
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Fetch storage failed (HTTP ${res.statusCode}): ${body}`));
          }
        });
      }).on('error', reject);
    });

    if (data.items) {
      data.items.forEach(i => storageMap.set(i.name, parseInt(i.size, 10)));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Inventory loaded: ${storageMap.size} existing objects in bucket.`);
  return storageMap;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

function uploadSingleFile(token, localFilePath, destinationStoragePath, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(localFilePath);
    const contentType = getContentType(localFilePath);
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
        const delay = Math.pow(2, retryCount) * 1500;
        setTimeout(() => {
          uploadSingleFile(token, localFilePath, destinationStoragePath, retryCount + 1).then(resolve).catch(reject);
        }, delay);
      } else {
        reject(new Error(`Timeout uploading ${destinationStoragePath}`));
      }
    });

    req.on('error', (err) => {
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1500;
        setTimeout(() => {
          uploadSingleFile(token, localFilePath, destinationStoragePath, retryCount + 1).then(resolve).catch(reject);
        }, delay);
      } else {
        reject(err);
      }
    });

    req.write(fileData);
    req.end();
  });
}

async function runUpload() {
  console.log('======================================================================');
  console.log('PHASE 4A — IDEMPOTENT FIREBASE STORAGE UPLOAD PIPELINE');
  console.log('======================================================================\n');

  await refreshAccessTokenIfNeeded();

  // 1. Build complete manifest
  const manifestThumbnails = [];
  const manifestOriginals = [];

  const s2Mock = fs.readdirSync(path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet2', 'mockups')).filter(f => !f.startsWith('.'));
  const s3Mock = fs.readdirSync(path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'mockups')).filter(f => !f.startsWith('.'));
  const s3Tile = fs.readdirSync(path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'tile_faces')).filter(f => !f.startsWith('.'));

  // Sheet 2 mockups
  s2Mock.forEach(f => {
    const base = f.substring(0, f.lastIndexOf('.'));
    manifestThumbnails.push({
      category: 'mockup_thumb',
      local: path.join(PROJECT_ROOT, 'assets', 'product_import', 'thumbnails', 'mockups', `${base}.webp`),
      storage: `products/thumbnails/mockups/${base}.webp`
    });
    manifestOriginals.push({
      category: 'mockup_orig',
      local: path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet2', 'mockups', f),
      storage: `products/mockups/${f}`
    });
  });

  // Sheet 3 mockups
  s3Mock.forEach(f => {
    const base = f.substring(0, f.lastIndexOf('.'));
    manifestThumbnails.push({
      category: 'mockup_thumb',
      local: path.join(PROJECT_ROOT, 'assets', 'product_import', 'thumbnails', 'mockups', `${base}.webp`),
      storage: `products/thumbnails/mockups/${base}.webp`
    });
    manifestOriginals.push({
      category: 'mockup_orig',
      local: path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'mockups', f),
      storage: `products/mockups/${f}`
    });
  });

  // Sheet 3 tile faces
  s3Tile.forEach(f => {
    const base = f.substring(0, f.lastIndexOf('.'));
    manifestThumbnails.push({
      category: 'tile_thumb',
      local: path.join(PROJECT_ROOT, 'assets', 'product_import', 'thumbnails', 'tiles', `${base}.webp`),
      storage: `products/thumbnails/tiles/${base}.webp`
    });
    manifestOriginals.push({
      category: 'tile_orig',
      local: path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'tile_faces', f),
      storage: `products/tiles/${f}`
    });
  });

  const totalManifest = [...manifestThumbnails, ...manifestOriginals];
  console.log(`Manifest planned objects: ${totalManifest.length} (595 Thumbnails + 595 Originals)`);

  // 2. Fetch existing objects to check idempotency
  const existingStorageMap = await fetchExistingStorageObjects();

  const results = {
    totalExpected: totalManifest.length,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    skippedItems: [],
    uploadedItems: [],
    failures: []
  };

  // Filter items: skip if already present in storage with matching size
  const itemsToUpload = [];
  for (const item of totalManifest) {
    const localSize = fs.statSync(item.local).size;
    if (existingStorageMap.has(item.storage)) {
      const remoteSize = existingStorageMap.get(item.storage);
      if (remoteSize === localSize) {
        results.skipped++;
        results.skippedItems.push({ storage: item.storage, size: localSize });
        continue;
      }
    }
    itemsToUpload.push(item);
  }

  console.log(`\nIdempotency Check:`);
  console.log(`- Already existing in Storage (will SKIP): ${results.skipped}`);
  console.log(`- Remaining to upload: ${itemsToUpload.length}`);

  const startTime = Date.now();
  let doneCount = 0;
  const CONCURRENCY = 4;

  for (let i = 0; i < itemsToUpload.length; i += CONCURRENCY) {
    await refreshAccessTokenIfNeeded();
    const token = getAccessToken();

    const chunk = itemsToUpload.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (item) => {
      try {
        const res = await uploadSingleFile(token, item.local, item.storage);
        results.uploaded++;
        results.uploadedItems.push(res);
      } catch (err) {
        results.failed++;
        results.failures.push({ storage: item.storage, error: err.message });
        console.error(`FAILED: ${item.storage}:`, err.message);
      } finally {
        doneCount++;
        const pct = (((doneCount + results.skipped) / totalManifest.length) * 100).toFixed(1);
        if (doneCount % 20 === 0 || doneCount === itemsToUpload.length) {
          console.log(`Progress: ${doneCount + results.skipped} / ${totalManifest.length} (${pct}%) [New uploads: ${results.uploaded}, Skipped: ${results.skipped}, Failed: ${results.failed}]`);
        }
      }
    }));
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================================`);
  console.log(`STORAGE UPLOAD SUMMARY (${durationSec}s):`);
  console.log(`- Total Expected: ${results.totalExpected}`);
  console.log(`- Uploaded: ${results.uploaded}`);
  console.log(`- Skipped (Already Identical): ${results.skipped}`);
  console.log(`- Failed: ${results.failed}`);
  console.log(`======================================================================\n`);

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'storage_upload_report.json'),
    JSON.stringify({ ...results, durationSec: parseFloat(durationSec) }, null, 2),
    'utf8'
  );
  console.log('Detailed upload report written to build/storage_upload_report.json');
}

runUpload().catch(err => {
  console.error('Fatal upload error:', err);
  process.exit(1);
});
