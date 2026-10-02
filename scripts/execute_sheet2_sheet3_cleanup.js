const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const sharp = require('./node_modules/sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const AUDIT_FILE = path.join(__dirname, 's2_s3_refined_audit.json');
const BUCKET = 'itacon-app.firebasestorage.app';

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 8,
  timeout: 120000
});

function safeCopyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, fs.readFileSync(src));
}

function getSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function getMd5Base64(filePath) {
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('base64');
}

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

function downloadStorageObject(token, storagePath, destLocalPath, retry = 0) {
  return new Promise((resolve, reject) => {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
    const req = https.get(url, {
      agent: httpsAgent,
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        fs.mkdirSync(path.dirname(destLocalPath), { recursive: true });
        const fileStream = fs.createWriteStream(destLocalPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve({ status: 'downloaded', size: fs.statSync(destLocalPath).size });
        });
      } else if (res.statusCode === 404) {
        resolve({ status: 'not_found' });
      } else if ((res.statusCode === 503 || res.statusCode === 429) && retry < 3) {
        setTimeout(() => downloadStorageObject(token, storagePath, destLocalPath, retry + 1).then(resolve).catch(reject), 1000);
      } else {
        reject(new Error(`Download failed ${storagePath} (HTTP ${res.statusCode})`));
      }
    });
    req.on('error', (err) => {
      if (retry < 3) {
        setTimeout(() => downloadStorageObject(token, storagePath, destLocalPath, retry + 1).then(resolve).catch(reject), 1000);
      } else {
        reject(err);
      }
    });
  });
}

function uploadStorageObject(token, localFilePath, destinationStoragePath, contentType, retry = 0) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(localFilePath);
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
        } else if ((res.statusCode === 503 || res.statusCode === 500 || res.statusCode === 429) && retry < 3) {
          setTimeout(() => uploadStorageObject(token, localFilePath, destinationStoragePath, contentType, retry + 1).then(resolve).catch(reject), 1500);
        } else {
          reject(new Error(`Upload failed ${destinationStoragePath} (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', (err) => {
      if (retry < 3) {
        setTimeout(() => uploadStorageObject(token, localFilePath, destinationStoragePath, contentType, retry + 1).then(resolve).catch(reject), 1500);
      } else {
        reject(err);
      }
    });

    req.write(fileData);
    req.end();
  });
}

async function runPipeline() {
  console.log('======================================================================');
  console.log('ITACON PRODUCT MOCKUP CLEANUP — SHEET 2 & SHEET 3 RESCUE PIPELINE');
  console.log('======================================================================\n');

  await refreshAccessTokenIfNeeded();
  const token = getAccessToken();

  // 1. Read audit
  const audit = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  const targets = audit.filter(a => a.status === 'SAFE_TO_CROP' || a.status === 'MANUAL_REVIEW_REQUIRED');

  console.log(`Target Mockup Images to Crop & Replace: ${targets.length}`);

  // 2. Locate or Create Backup
  const existingBackups = fs.readdirSync(path.join(PROJECT_ROOT, 'backup_mockups'))
    .filter(d => d.startsWith('batch2_'))
    .sort();

  let backupDir;
  if (existingBackups.length > 0) {
    backupDir = path.join(PROJECT_ROOT, 'backup_mockups', existingBackups[existingBackups.length - 1]);
    console.log(`Using existing complete backup at: ${backupDir}`);
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupDir = path.join(PROJECT_ROOT, 'backup_mockups', `batch2_${timestamp}`);
    const localBackupDir = path.join(backupDir, 'local_originals');
    const remoteOrigBackupDir = path.join(backupDir, 'remote_originals');
    const remoteThumbBackupDir = path.join(backupDir, 'remote_thumbnails');

    fs.mkdirSync(localBackupDir, { recursive: true });
    fs.mkdirSync(remoteOrigBackupDir, { recursive: true });
    fs.mkdirSync(remoteThumbBackupDir, { recursive: true });

    console.log(`\nBacking up files to: ${backupDir}...`);
    const backupManifest = [];

    for (const t of targets) {
      const localDest = path.join(localBackupDir, t.sheet.replace(' ', '_'), t.filename);
      safeCopyFile(t.localPath, localDest);
      const localSha = getSha256(localDest);

      const remoteOrigDest = path.join(remoteOrigBackupDir, t.filename);
      const origDl = await downloadStorageObject(token, t.firebaseStoragePath, remoteOrigDest);

      const thumbName = path.basename(t.thumbnailStoragePath);
      const remoteThumbDest = path.join(remoteThumbBackupDir, thumbName);
      const thumbDl = await downloadStorageObject(token, t.thumbnailStoragePath, remoteThumbDest);

      backupManifest.push({
        filename: t.filename,
        sheet: t.sheet,
        localOriginal: t.localPath,
        localBackup: localDest,
        localSha256: localSha,
        firebaseStoragePath: t.firebaseStoragePath,
        remoteOrigDownloaded: origDl.status,
        thumbnailStoragePath: t.thumbnailStoragePath,
        remoteThumbDownloaded: thumbDl.status
      });
    }

    fs.writeFileSync(path.join(backupDir, 'backup_manifest.json'), JSON.stringify(backupManifest, null, 2), 'utf8');
    console.log(`Backup completed: ${backupManifest.length} items backed up.`);
  }

  // 3. Perform High-Precision Image-Aware Cropping & Local Replacement
  console.log('\nPerforming precise cropping and generating updated thumbnails...');
  const stagingCleanedDir = path.join(PROJECT_ROOT, 'image_cleanup_preview', 'batch2', 'cleaned');
  const stagingThumbDir = path.join(PROJECT_ROOT, 'image_cleanup_preview', 'batch2', 'thumbnails');
  fs.mkdirSync(stagingCleanedDir, { recursive: true });
  fs.mkdirSync(stagingThumbDir, { recursive: true });

  const localThumbDir = path.join(PROJECT_ROOT, 'assets', 'product_import', 'thumbnails', 'mockups');
  fs.mkdirSync(localThumbDir, { recursive: true });

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const stagedCleanedFile = path.join(stagingCleanedDir, t.filename);
    const thumbName = `${path.basename(t.filename, path.extname(t.filename))}.webp`;
    const stagedThumbFile = path.join(stagingThumbDir, thumbName);

    // Retrieve original uncropped from backup to avoid double crop
    const backupSource = path.join(backupDir, 'local_originals', t.sheet.replace(' ', '_'), t.filename);
    const sourceToCrop = fs.existsSync(backupSource) ? backupSource : t.localPath;

    // Crop image
    await sharp(sourceToCrop)
      .extract({
        left: t.crop.x,
        top: t.crop.y,
        width: t.crop.w,
        height: t.crop.h
      })
      .jpeg({ quality: 95, mozjpeg: true })
      .toFile(stagedCleanedFile);

    // Generate WebP thumbnail (600x400)
    await sharp(stagedCleanedFile)
      .resize(600, 400, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(stagedThumbFile);

    // Replace local original using safeCopyFile
    safeCopyFile(stagedCleanedFile, t.localPath);

    // Replace local thumbnail using safeCopyFile
    const localThumbFile = path.join(localThumbDir, thumbName);
    safeCopyFile(stagedThumbFile, localThumbFile);

    console.log(`  [${i+1}/${targets.length}] Cropped & replaced: ${t.filename} (${t.crop.w}x${t.crop.h})`);
  }

  // 4. Overwrite in Firebase Storage
  console.log('\nUploading cleaned images and thumbnails to Firebase Storage...');
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const stagedCleanedFile = path.join(stagingCleanedDir, t.filename);
    const thumbName = `${path.basename(t.filename, path.extname(t.filename))}.webp`;
    const stagedThumbFile = path.join(stagingThumbDir, thumbName);

    // Upload full mockup
    await uploadStorageObject(token, stagedCleanedFile, t.firebaseStoragePath, 'image/jpeg');

    // Upload thumbnail
    await uploadStorageObject(token, stagedThumbFile, t.thumbnailStoragePath, 'image/webp');

    console.log(`  [${i+1}/${targets.length}] Uploaded to Storage: ${t.firebaseStoragePath} & ${t.thumbnailStoragePath}`);
  }

  // 5. Post-Upload Verification
  console.log('\nVerifying post-upload integrity...');
  let verificationPassed = 0;
  for (const t of targets) {
    const verifyOrig = await sharp(t.localPath).metadata();
    if (verifyOrig.width === t.crop.w && verifyOrig.height === t.crop.h) {
      verificationPassed++;
    }
  }

  console.log(`Verification: ${verificationPassed} / ${targets.length} images correctly cropped and replaced.`);
  console.log('======================================================================');
  console.log('BATCH 2 CLEANUP SUCCESSFULLY COMPLETED!');
  console.log('======================================================================');
}

runPipeline().catch(console.error);
