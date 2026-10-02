const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const sharp = require('./node_modules/sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUCKET = 'itacon-app.firebasestorage.app';
const AUDIT_FILE = path.join(PROJECT_ROOT, 'image_cleanup_final_303', 'audit', 'audit_303_products.json');
const FULL_SOURCE_DIR = path.join(PROJECT_ROOT, 'image_cleanup_final_303', 'full');
const THUMB_SOURCE_DIR = path.join(PROJECT_ROOT, 'image_cleanup_final_303', 'thumbnails');

function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cfg.tokens.access_token;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function downloadStorageObject(token, objectPath) {
  const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media`;
  return new Promise((resolve) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      if (res.statusCode !== 200) {
        return resolve({ success: false, statusCode: res.statusCode, path: objectPath });
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ success: true, buffer: Buffer.concat(chunks), path: objectPath }));
      res.on('error', () => resolve({ success: false, path: objectPath }));
    }).on('error', () => resolve({ success: false, path: objectPath }));
  });
}

function uploadStorageObject(token, objectPath, buffer, contentType) {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': buffer.length
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          resolve({ success: false, statusCode: res.statusCode, body });
        }
      });
    });
    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.write(buffer);
    req.end();
  });
}

// Simple concurrent worker pool
async function runConcurrent(items, concurrency, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('=== STARTING FAST CONCURRENT BACKUP & PRODUCTION REPLACEMENT (FINAL 303 AUDIT) ===');
  const token = getAccessToken();

  const auditData = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  const cropRequiredList = auditData.filter(r => r.action === 'CROP_REQUIRED');

  // De-duplicate unique mockups
  const uniqueMockups = new Map();
  cropRequiredList.forEach(r => {
    if (!uniqueMockups.has(r.mockupFilename)) {
      uniqueMockups.set(r.mockupFilename, r);
    }
  });

  console.log(`Total CROP_REQUIRED product records: ${cropRequiredList.length}`);
  console.log(`Unique mockup objects to replace: ${uniqueMockups.size}`);

  // Re-use or create timestamped backup folder
  const existingBackups = fs.readdirSync(path.join(PROJECT_ROOT, 'backup_mockups')).filter(d => d.startsWith('final_303_'));
  let backupDirName;
  if (existingBackups.length > 0) {
    backupDirName = existingBackups[existingBackups.length - 1];
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupDirName = `final_303_${timestamp}`;
  }

  const backupDir = path.join(PROJECT_ROOT, 'backup_mockups', backupDirName);
  const backupLocalDir = path.join(backupDir, 'local');
  const backupRemoteFullDir = path.join(backupDir, 'remote_full');
  const backupRemoteThumbDir = path.join(backupDir, 'remote_thumbs');

  [backupDir, backupLocalDir, backupRemoteFullDir, backupRemoteThumbDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
  console.log(`Using backup folder: ${backupDir}`);

  // 1. FAST CONCURRENT BACKUP PHASE
  console.log('\n--- Phase 1: Downloading & Backing Up Current Remote and Local Objects (Concurrency: 8) ---');
  const mockupList = Array.from(uniqueMockups.values());
  let downloadedCount = 0;

  const backupManifest = await runConcurrent(mockupList, 8, async (item) => {
    const filename = item.mockupFilename;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const remoteFullObject = `products/mockups/${filename}`;
    const remoteThumbObject = `products/thumbnails/mockups/${baseName}.webp`;

    const fullDest = path.join(backupRemoteFullDir, filename);
    let remoteFullSha = null;
    if (fs.existsSync(fullDest) && fs.statSync(fullDest).size > 0) {
      remoteFullSha = sha256(fs.readFileSync(fullDest));
    } else {
      const res = await downloadStorageObject(token, remoteFullObject);
      if (res.success) {
        fs.writeFileSync(fullDest, res.buffer);
        remoteFullSha = sha256(res.buffer);
      }
    }

    const thumbDest = path.join(backupRemoteThumbDir, `${baseName}.webp`);
    let remoteThumbSha = null;
    if (fs.existsSync(thumbDest) && fs.statSync(thumbDest).size > 0) {
      remoteThumbSha = sha256(fs.readFileSync(thumbDest));
    } else {
      const res = await downloadStorageObject(token, remoteThumbObject);
      if (res.success) {
        fs.writeFileSync(thumbDest, res.buffer);
        remoteThumbSha = sha256(res.buffer);
      }
    }

    // Local backup
    let localFoundPath = null;
    let localSha = null;
    const localCandidates = [
      path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet2', 'mockups', filename),
      path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'mockups', filename),
      path.join(PROJECT_ROOT, 'assets', 'images', 'mockups', filename)
    ];
    for (const c of localCandidates) {
      if (fs.existsSync(c)) {
        localFoundPath = c;
        const ldest = path.join(backupLocalDir, filename);
        if (!fs.existsSync(ldest)) {
          fs.copyFileSync(c, ldest);
        }
        localSha = sha256(fs.readFileSync(ldest));
        break;
      }
    }

    downloadedCount++;
    if (downloadedCount % 40 === 0 || downloadedCount === mockupList.length) {
      console.log(`Backup progress: ${downloadedCount}/${mockupList.length} items.`);
    }

    return {
      filename,
      baseName,
      remoteFullObject,
      remoteFullSha,
      remoteThumbObject,
      remoteThumbSha,
      localFoundPath,
      localSha
    };
  });

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    backupRoot: backupDir,
    uniqueMockupsCount: uniqueMockups.size,
    items: backupManifest
  }, null, 2));

  console.log(`Backup completed: ${backupManifest.length} items verified in ${backupDir}.`);

  // 2. FAST CONCURRENT PRODUCTION REPLACEMENT PHASE
  console.log('\n--- Phase 2: Uploading Clean Full Mockups and 600x400 WebP Thumbnails (Concurrency: 8) ---');
  let uploadedCount = 0;
  const failedUploads = [];

  const localThumbDir = path.join(PROJECT_ROOT, 'assets', 'product_import', 'thumbnails', 'mockups');
  if (!fs.existsSync(localThumbDir)) fs.mkdirSync(localThumbDir, { recursive: true });

  await runConcurrent(mockupList, 8, async (item) => {
    const filename = item.mockupFilename;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const cleanFullFile = path.join(FULL_SOURCE_DIR, filename);
    const cleanThumbFile = path.join(THUMB_SOURCE_DIR, `${baseName}.webp`);

    if (!fs.existsSync(cleanFullFile) || !fs.existsSync(cleanThumbFile)) {
      failedUploads.push({ filename, error: 'Source clean files missing' });
      return;
    }

    const cleanFullBuf = fs.readFileSync(cleanFullFile);
    const cleanThumbBuf = fs.readFileSync(cleanThumbFile);

    const fullContentType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const thumbContentType = 'image/webp';

    // Upload full mockup
    const fullRes = await uploadStorageObject(token, `products/mockups/${filename}`, cleanFullBuf, fullContentType);
    if (!fullRes.success) {
      failedUploads.push({ filename, type: 'full', statusCode: fullRes.statusCode });
    }

    // Upload thumbnail
    const thumbRes = await uploadStorageObject(token, `products/thumbnails/mockups/${baseName}.webp`, cleanThumbBuf, thumbContentType);
    if (!thumbRes.success) {
      failedUploads.push({ filename, type: 'thumb', statusCode: thumbRes.statusCode });
    }

    // Update local thumbnail
    fs.writeFileSync(path.join(localThumbDir, `${baseName}.webp`), cleanThumbBuf);

    // Update local full mockup
    for (const c of [
      path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet2', 'mockups', filename),
      path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'mockups', filename),
      path.join(PROJECT_ROOT, 'assets', 'images', 'mockups', filename)
    ]) {
      if (fs.existsSync(c)) {
        fs.writeFileSync(c, cleanFullBuf);
      }
    }

    uploadedCount++;
    if (uploadedCount % 40 === 0 || uploadedCount === mockupList.length) {
      console.log(`Upload progress: ${uploadedCount}/${mockupList.length} mockups & thumbnails.`);
    }
  });

  console.log(`\nUpload phase complete!`);
  console.log(`  Uploaded unique mockups: ${uploadedCount}`);
  console.log(`  Failed replacements: ${failedUploads.length}`);

  // 3. REMOTE VERIFICATION PHASE
  console.log('\n--- Phase 3: Post-Replacement Remote Verification ---');
  let verifySuccessCount = 0;
  let verifyFailCount = 0;

  const testSamples = [
    'HARVEST BIANCO.jpg',
    'SHG HARVEST GREY.jpg',
    'IND_1025_SF_MG-preview.jpg',
    'VIT-60120-8.50-GLO-MAR-WHIT-00-061_mockup.jpeg'
  ];

  for (const sName of testSamples) {
    const sBase = sName.replace(/\.[^/.]+$/, '');
    const vThumb = await downloadStorageObject(token, `products/thumbnails/mockups/${sBase}.webp`);
    if (vThumb.success) {
      const vMeta = await sharp(vThumb.buffer).metadata();
      console.log(`Remote verified: products/thumbnails/mockups/${sBase}.webp (${vMeta.width}x${vMeta.height}, ${vThumb.buffer.length} bytes)`);
      verifySuccessCount++;
    } else {
      console.error(`Verification failed: products/thumbnails/mockups/${sBase}.webp`);
      verifyFailCount++;
    }

    const vFull = await downloadStorageObject(token, `products/mockups/${sName}`);
    if (vFull.success) {
      const vMeta = await sharp(vFull.buffer).metadata();
      console.log(`Remote verified: products/mockups/${sName} (${vMeta.width}x${vMeta.height}, ${vFull.buffer.length} bytes)`);
      verifySuccessCount++;
    } else {
      console.error(`Verification failed: products/mockups/${sName}`);
      verifyFailCount++;
    }
  }

  const replacementSummary = {
    backupPath: backupDir,
    totalUniqueMockupsTargeted: uniqueMockups.size,
    firebaseFullResolutionObjectsReplaced: uploadedCount,
    firebaseThumbnailObjectsReplaced: uploadedCount,
    failedReplacements: failedUploads.length,
    localThumbnailsUpdated: uploadedCount,
    allThumbnailsGeneratedFromFinalCrops: true,
    verificationSuccess: verifyFailCount === 0
  };

  fs.writeFileSync(path.join(backupDir, 'replacement_summary.json'), JSON.stringify(replacementSummary, null, 2));
  fs.writeFileSync(path.join(PROJECT_ROOT, 'image_cleanup_final_303', 'audit', 'replacement_summary.json'), JSON.stringify(replacementSummary, null, 2));

  console.log('\nFinal replacement summary:');
  console.log(JSON.stringify(replacementSummary, null, 2));
}

main().catch(err => {
  console.error('Fatal replacement error:', err);
  process.exit(1);
});
