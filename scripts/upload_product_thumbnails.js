/**
 * High-Speed, Safe Product Thumbnail Upload & Verification Tool
 *
 * Uploads generated WebP thumbnails to Firebase Storage under:
 * - products/thumbnails/mockups/
 * - products/thumbnails/tiles/
 * - products/thumbnails/adhesives/
 *
 * CRITICAL SAFETY:
 * - ADDITIVE ONLY. Does not touch or overwrite existing original images.
 * - Does not change storage rules or configurations.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'build', 'product_thumbnails', 'thumbnail_manifest.json');
const BUCKET = 'itacon-app.firebasestorage.app';

function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config.tokens.access_token;
}

function uploadFile(token, localFilePath, destinationStoragePath) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(localFilePath);
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(destinationStoragePath)}`;

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'image/webp',
        'Content-Length': fileData.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ raw: body });
          }
        } else {
          reject(new Error(`Failed upload ${destinationStoragePath} (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

function getObjectMetadata(token, storagePath) {
  return new Promise((resolve, reject) => {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(storagePath)}`;
    const req = https.get(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Failed metadata for ${storagePath} (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });
    req.on('error', reject);
  });
}

async function uploadInBatches(token, manifest, concurrency = 8) {
  const results = [];
  let index = 0;
  const total = manifest.length;

  console.log(`Starting parallel upload of ${total} thumbnails (concurrency: ${concurrency})...`);

  async function worker() {
    while (index < total) {
      const currentIndex = index++;
      const item = manifest[currentIndex];
      const localAbsPath = path.join(PROJECT_ROOT, item.thumbnailLocalPath);

      try {
        const uploadRes = await uploadFile(token, localAbsPath, item.thumbnailFirebasePath);
        results.push({ item, success: true, size: uploadRes.size });
        if (results.length % 50 === 0 || results.length === total) {
          console.log(`  Uploaded ${results.length}/${total} (${((results.length / total) * 100).toFixed(1)}%)...`);
        }
      } catch (err) {
        console.error(`  ERROR uploading ${item.thumbnailFirebasePath}:`, err.message);
        results.push({ item, success: false, error: err.message });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('====================================================');
  console.log('PHASE 4.3 — FIREBASE STORAGE THUMBNAIL UPLOADER');
  console.log('====================================================');

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found at ${MANIFEST_PATH}! Run generate_product_thumbnails.js first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const token = getAccessToken();

  console.log(`Target Bucket: ${BUCKET}`);
  console.log(`Items in Manifest: ${manifest.length}\n`);

  const uploadResults = await uploadInBatches(token, manifest, 10);
  const failures = uploadResults.filter(r => !r.success);

  if (failures.length > 0) {
    console.error(`\nFAILED to upload ${failures.length} files!`);
    fs.writeFileSync(path.join(PROJECT_ROOT, 'build', 'product_thumbnails', 'upload_failures.json'), JSON.stringify(failures, null, 2));
    process.exit(1);
  }

  console.log(`\nALL ${manifest.length} THUMBNAILS UPLOADED SUCCESSFULLY!\n`);

  // Verification phase
  console.log('====================================================');
  console.log('STEP 11 — VERIFYING FIREBASE STORAGE UPLOADS');
  console.log('====================================================');

  // Verify representative samples from EACH category
  const categories = ['mockup', 'tile', 'adhesive'];
  const verificationResults = [];

  for (const cat of categories) {
    const samples = manifest.filter(m => m.category === cat).slice(0, 3);
    console.log(`\nVerifying samples for category: [${cat.toUpperCase()}]`);

    for (const sample of samples) {
      console.log(`Checking: ${sample.thumbnailFirebasePath}...`);
      const meta = await getObjectMetadata(token, sample.thumbnailFirebasePath);

      const isValid = (
        meta.name === sample.thumbnailFirebasePath &&
        meta.contentType === 'image/webp' &&
        parseInt(meta.size) > 0 &&
        parseInt(meta.size) === sample.thumbnailBytes
      );

      console.log(`  - Object Name:    ${meta.name}`);
      console.log(`  - Content-Type:   ${meta.contentType} (Expected: image/webp)`);
      console.log(`  - Storage Size:   ${meta.size} bytes (Local: ${sample.thumbnailBytes} bytes)`);
      console.log(`  - Storage Status: ${isValid ? 'VERIFIED ✓' : 'INVALID ✗'}`);

      verificationResults.push({
        category: cat,
        storagePath: meta.name,
        contentType: meta.contentType,
        sizeBytes: parseInt(meta.size),
        isValid
      });
    }
  }

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'product_thumbnails', 'verification_results.json'),
    JSON.stringify(verificationResults, null, 2)
  );

  console.log('\nVerification completed successfully. Results saved to verification_results.json.');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
