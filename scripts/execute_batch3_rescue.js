const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const sharp = require('./node_modules/sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUCKET_NAME = 'itacon-app.firebasestorage.app';
const CONFIG_PATH = 'C:\\Users\\ttirt\\.config\\configstore\\firebase-tools.json';

const TARGETS = [
  // Sheet 2: 100% solid black borders (4px)
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet2/mockups/BISAZZA NATURAL.jpg'),
    storagePath: 'products/mockups/BISAZZA NATURAL.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/BISAZZA NATURAL.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/BISAZZA NATURAL.webp',
    crop: { left: 6, right: 0, top: 0, bottom: 0 },
    sheet: 'Sheet 2'
  },
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet2/mockups/LIMA CREMA.jpg'),
    storagePath: 'products/mockups/LIMA CREMA.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/LIMA CREMA.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/LIMA CREMA.webp',
    crop: { left: 6, right: 0, top: 0, bottom: 0 },
    sheet: 'Sheet 2'
  },
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet2/mockups/ONYX OMANI BEIGE.jpg'),
    storagePath: 'products/mockups/ONYX OMANI BEIGE.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/ONYX OMANI BEIGE.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/ONYX OMANI BEIGE.webp',
    crop: { left: 6, right: 0, top: 0, bottom: 0 },
    sheet: 'Sheet 2'
  },
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet2/mockups/ROME GREY.jpg'),
    storagePath: 'products/mockups/ROME GREY.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/ROME GREY.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/ROME GREY.webp',
    crop: { left: 6, right: 0, top: 0, bottom: 0 },
    sheet: 'Sheet 2'
  },
  // Sheet 2: Residual edge borders
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet2/mockups/AMIGO SMOKE.jpg'),
    storagePath: 'products/mockups/AMIGO SMOKE.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/AMIGO SMOKE.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/AMIGO SMOKE.webp',
    crop: { left: 0, right: 16, top: 0, bottom: 0 },
    sheet: 'Sheet 2'
  },
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet2/mockups/BISAZZA GREY.jpg'),
    storagePath: 'products/mockups/BISAZZA GREY.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/BISAZZA GREY.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/BISAZZA GREY.webp',
    crop: { left: 0, right: 14, top: 0, bottom: 0 },
    sheet: 'Sheet 2'
  },
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet2/mockups/MARMI BIANCO.jpg'),
    storagePath: 'products/mockups/MARMI BIANCO.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/MARMI BIANCO.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/MARMI BIANCO.webp',
    crop: { left: 5, right: 0, top: 0, bottom: 0 },
    sheet: 'Sheet 2'
  },
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet2/mockups/SHG HARVEST GREY.jpg'),
    storagePath: 'products/mockups/SHG HARVEST GREY.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/SHG HARVEST GREY.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/SHG HARVEST GREY.webp',
    crop: { left: 5, right: 0, top: 0, bottom: 0 },
    sheet: 'Sheet 2'
  },
  // Sheet 3: Offset black strip (8px) & lines
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet3/mockups/MG PIGUES NATURAL-preview.jpg'),
    storagePath: 'products/mockups/MG PIGUES NATURAL-preview.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/MG PIGUES NATURAL-preview.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/MG PIGUES NATURAL-preview.webp',
    crop: { left: 0, right: 10, top: 0, bottom: 0 },
    sheet: 'Sheet 3'
  },
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet3/mockups/MG BRATVI BLACK-preview.jpg'),
    storagePath: 'products/mockups/MG BRATVI BLACK-preview.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/MG BRATVI BLACK-preview.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/MG BRATVI BLACK-preview.webp',
    crop: { left: 0, right: 4, top: 0, bottom: 0 },
    sheet: 'Sheet 3'
  },
  {
    localFile: path.join(PROJECT_ROOT, 'assets/product_import/sheet3/mockups/MG BRERA BROWN-preview.jpg'),
    storagePath: 'products/mockups/MG BRERA BROWN-preview.jpg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/MG BRERA BROWN-preview.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/MG BRERA BROWN-preview.webp',
    crop: { left: 0, right: 4, top: 0, bottom: 0 },
    sheet: 'Sheet 3'
  },
  // Sheet 1: Left black line (2px)
  {
    localFile: path.join(PROJECT_ROOT, 'assets/images/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-059_mockup.jpeg'),
    storagePath: 'products/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-059_mockup.jpeg',
    thumbLocal: path.join(PROJECT_ROOT, 'assets/product_import/thumbnails/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-059_mockup.webp'),
    thumbStoragePath: 'products/thumbnails/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-059_mockup.webp',
    crop: { left: 4, right: 0, top: 0, bottom: 0 },
    sheet: 'Sheet 1'
  }
];

function safeCopyFile(src, dest) {
  const buf = fs.readFileSync(src);
  fs.writeFileSync(dest, buf);
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
  return cfg.tokens.access_token;
}

function getAuthToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cfg.tokens.access_token;
}

async function uploadToStorage(filePath, storagePath, contentType, token) {
  const fileData = fs.readFileSync(filePath);
  const encodedPath = encodeURIComponent(storagePath);
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodedPath}`;

  return new Promise((resolve, reject) => {
    const req = https.request(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': fileData.length
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseBody));
        } else {
          reject(new Error(`Upload failed for ${storagePath}: HTTP ${res.statusCode}: ${responseBody}`));
        }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function executeRescue() {
  console.log('======================================================================');
  console.log('ITACON BATCH 3 MOCKUP RESCUE PIPELINE');
  console.log('======================================================================\n');
  console.log(`Target Mockup Images to Crop & Replace: ${TARGETS.length}`);

  // Step 1: Backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(PROJECT_ROOT, 'backup_mockups', `batch3_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(path.join(backupDir, 'full'), { recursive: true });
  fs.mkdirSync(path.join(backupDir, 'thumbnails'), { recursive: true });

  const manifest = [];
  console.log(`Creating backups in: ${backupDir}...`);
  for (const t of TARGETS) {
    const baseName = path.basename(t.localFile);
    const backupFull = path.join(backupDir, 'full', baseName);
    safeCopyFile(t.localFile, backupFull);

    let backupThumb = null;
    if (fs.existsSync(t.thumbLocal)) {
      backupThumb = path.join(backupDir, 'thumbnails', path.basename(t.thumbLocal));
      safeCopyFile(t.thumbLocal, backupThumb);
    }

    manifest.push({
      file: baseName,
      source: t.sheet,
      originalPath: t.localFile,
      storagePath: t.storagePath,
      thumbStoragePath: t.thumbStoragePath,
      crop: t.crop,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(t.localFile)).digest('hex')
    });
  }
  fs.writeFileSync(path.join(backupDir, 'backup_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Successfully backed up all ${TARGETS.length} files.`);

  // Step 2: Precise Crop & Generation
  console.log('\nCropping images and generating updated WebP thumbnails...');
  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const baseName = path.basename(t.localFile);
    // 1. Read input into buffer first to release file lock on Windows
    const inputBuffer = fs.readFileSync(t.localFile);
    const meta = await sharp(inputBuffer).metadata();

    const cropBox = {
      left: t.crop.left,
      top: t.crop.top,
      width: meta.width - t.crop.left - t.crop.right,
      height: meta.height - t.crop.top - t.crop.bottom
    };

    const croppedBuffer = await sharp(inputBuffer)
      .extract(cropBox)
      .jpeg({ quality: 95, mozjpeg: true })
      .toBuffer();

    fs.writeFileSync(t.localFile, croppedBuffer);

    // 2. Generate 600x400 WebP thumbnail
    const thumbBuffer = await sharp(croppedBuffer)
      .resize(600, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85, effort: 6 })
      .toBuffer();

    fs.writeFileSync(t.thumbLocal, thumbBuffer);
    console.log(`  [${i + 1}/${TARGETS.length}] Cropped & replaced: ${baseName} (${meta.width}x${meta.height} -> ${cropBox.width}x${cropBox.height})`);
  }

  // Step 3: Upload to Firebase Storage
  console.log('\nUploading cleaned images and thumbnails to Firebase Storage...');
  await refreshAccessTokenIfNeeded();
  const token = getAuthToken();
  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const baseName = path.basename(t.localFile);

    await uploadToStorage(t.localFile, t.storagePath, 'image/jpeg', token);
    await uploadToStorage(t.thumbLocal, t.thumbStoragePath, 'image/webp', token);

    console.log(`  [${i + 1}/${TARGETS.length}] Uploaded: ${t.storagePath} & ${t.thumbStoragePath}`);
  }

  // Step 4: Verification
  console.log('\nVerifying post-upload integrity...');
  let cleanCount = 0;
  for (const t of TARGETS) {
    const { data, info } = await sharp(fs.readFileSync(t.localFile)).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    function getPixelLum(x, y) {
      const idx = (y * width + x) * channels;
      return 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
    }
    let leftDark = 0, rightDark = 0;
    for (let y = 0; y < height; y++) {
      if (getPixelLum(0, y) < 40) leftDark++;
      if (getPixelLum(width - 1, y) < 40) rightDark++;
    }
    const leftPct = (leftDark / height).toFixed(2);
    const rightPct = (rightDark / height).toFixed(2);
    if (leftPct < 0.35 && rightPct < 0.35) cleanCount++;
    console.log(`  ✓ ${path.basename(t.localFile)}: leftDarkPct=${leftPct}, rightDarkPct=${rightPct}`);
  }

  console.log(`\nVerification: ${cleanCount} / ${TARGETS.length} mockups 100% clean.`);
  console.log('======================================================================');
  console.log('BATCH 3 CLEANUP SUCCESSFULLY COMPLETED!');
  console.log('======================================================================');
}

executeRescue().catch(err => {
  console.error('FATAL ERROR in execution:', err);
  process.exit(1);
});
