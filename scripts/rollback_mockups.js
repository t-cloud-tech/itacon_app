/**
 * ITACON PRODUCT MOCKUP IMAGE CLEANUP — RECOVERABLE ROLLBACK SCRIPT
 *
 * Reverts the 239 mockup originals and 239 thumbnails back to their exact
 * pre-replacement states using backup snapshot: 2026-10-01T04-09-47-523Z
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'backup_mockups/2026-10-01T04-09-47-523Z/manifest.json');
const BUCKET = 'itacon-app.firebasestorage.app';

function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8')).tokens.access_token;
}

function uploadStorageObject(token, localFilePath, destinationStoragePath, contentType) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(localFilePath);
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(destinationStoragePath)}`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': fileData.length
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(b)));
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function rollback() {
  console.log('Initiating rollback from manifest: ' + MANIFEST_PATH);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const token = getAccessToken();

  let restoredLocal = 0;
  let restoredRemote = 0;

  for (const item of manifest.items) {
    // 1. Restore local original
    const localBackupFile = path.join(PROJECT_ROOT, manifest.backupRoot, 'local_originals', item.originalRelativePath);
    const localTargetFile = path.join(PROJECT_ROOT, item.originalRelativePath);
    fs.copyFileSync(localBackupFile, localTargetFile);
    restoredLocal++;

    // 2. Restore remote original
    const remoteOrigBackup = path.join(PROJECT_ROOT, item.remoteBackupOriginalPath);
    await uploadStorageObject(token, remoteOrigBackup, item.firebaseStorageOriginalPath, 'image/jpeg');

    // 3. Restore remote thumbnail
    const remoteThumbBackup = path.join(PROJECT_ROOT, item.remoteBackupThumbnailPath);
    await uploadStorageObject(token, remoteThumbBackup, item.firebaseStorageThumbnailPath, 'image/webp');
    restoredRemote += 2;
  }

  console.log(`Rollback complete: ${restoredLocal} local files restored, ${restoredRemote} remote objects restored.`);
}

if (process.argv.includes('--execute')) {
  rollback().catch(console.error);
} else {
  console.log('DRY RUN: Add --execute flag to perform live rollback.');
}
