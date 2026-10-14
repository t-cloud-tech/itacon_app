const fs = require('fs');
const path = require('path');
const AdmZip = require('./node_modules/adm-zip');
const sharp = require('./node_modules/sharp');

const ZIP_PATH = 'D:\\PRASHANTBHAI.zip';
const REPORT_PATH = path.join(__dirname, '56_mockups_analysis_report.json');
const STAGE_DIR = path.join(__dirname, 'staged_56_mockups');
const THUMB_DIR = path.join(STAGE_DIR, 'thumbnails');

async function stageMockups() {
  if (!fs.existsSync(STAGE_DIR)) {
    fs.mkdirSync(STAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(THUMB_DIR)) {
    fs.mkdirSync(THUMB_DIR, { recursive: true });
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const zip = new AdmZip(ZIP_PATH);
  const zipEntries = zip.getEntries();
  const entryMap = new Map();
  for (const entry of zipEntries) {
    if (!entry.isDirectory && !entry.entryName.includes('__MACOSX') && !entry.name.startsWith('._')) {
      entryMap.set(entry.entryName, entry);
      entryMap.set(entry.name, entry);
    }
  }

  const uploadManifest = [];

  for (const rec of report.records) {
    const entry = entryMap.get(rec.zipPath) || entryMap.get(rec.filename);
    if (!entry) {
      throw new Error(`Missing entry for ${rec.filename}`);
    }

    const outOriginalPath = path.join(STAGE_DIR, rec.filename);
    const buf = entry.getData();
    fs.writeFileSync(outOriginalPath, buf);

    // Verify readability with sharp
    const meta = await sharp(buf).metadata();

    // Generate webp thumbnail (e.g. width 400px, quality 85)
    const baseName = path.parse(rec.filename).name;
    const thumbFilename = `${baseName}.webp`;
    const outThumbPath = path.join(THUMB_DIR, thumbFilename);

    await sharp(buf)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outThumbPath);

    const thumbMeta = await sharp(outThumbPath).metadata();

    uploadManifest.push({
      excelRow: rec.excelRow,
      sku: rec.sku,
      designName: rec.designName,
      filename: rec.filename,
      storagePath: `products/mockups/${rec.filename}`,
      thumbnailStoragePath: `products/thumbnails/mockups/${thumbFilename}`,
      existsInStorage: rec.storage.existsInStorage,
      actionNeeded: rec.storage.existsInStorage ? 'REUSE_EXISTING' : 'UPLOAD_NEW',
      originalSizeBytes: buf.length,
      originalDimensions: `${meta.width}x${meta.height}`,
      thumbnailSizeBytes: fs.statSync(outThumbPath).size,
      thumbnailDimensions: `${thumbMeta.width}x${thumbMeta.height}`,
      firestoreProductsDocId: rec.firestore.docId,
      firestoreStatus: rec.firestore.currentMockups.includes(`products/mockups/${rec.filename}`) ? 'ALREADY_LINKED' : 'NEEDS_UPDATE'
    });
  }

  fs.writeFileSync(
    path.join(__dirname, 'prepared_upload_manifest.json'),
    JSON.stringify(uploadManifest, null, 2),
    'utf8'
  );

  console.log(`Successfully staged all 56 verified images into ${STAGE_DIR}`);
  console.log(`Successfully generated 56 WebP thumbnails in ${THUMB_DIR}`);
  console.log(`Action summary:`);
  console.log(`- Upload needed to Storage: ${uploadManifest.filter(x => x.actionNeeded === 'UPLOAD_NEW').length}`);
  console.log(`- Already in Storage (reuse): ${uploadManifest.filter(x => x.actionNeeded === 'REUSE_EXISTING').length}`);
  console.log(`- Firestore updates needed: ${uploadManifest.filter(x => x.firestoreStatus === 'NEEDS_UPDATE').length}`);
  console.log(`- Firestore already linked: ${uploadManifest.filter(x => x.firestoreStatus === 'ALREADY_LINKED').length}`);
}

stageMockups().catch(err => {
  console.error('Staging failed:', err);
  process.exit(1);
});
