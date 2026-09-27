const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSV_SRC = 'D:\\product_image_mapping.csv';
const CSV_DEST = path.join(PROJECT_ROOT, 'scripts', 'product_image_mapping.csv');

const S2_DEST = path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet2', 'mockups');
const S3_MOCK_DEST = path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'mockups');
const S3_TILE_DEST = path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'tile_faces');

console.log('--- STEP 1: LOCAL STAGING ---');

// Ensure destination directories exist
[S2_DEST, S3_MOCK_DEST, S3_TILE_DEST].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
    console.log('Created directory:', d);
  }
});

// Copy CSV
fs.copyFileSync(CSV_SRC, CSV_DEST);
console.log('Copied mapping CSV to:', CSV_DEST);

// Parse CSV
const csvRaw = fs.readFileSync(CSV_DEST, 'utf8');
const lines = csvRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
const records = [];
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',').map(s => s.trim());
  records.push({
    sheet: parts[0],
    sku: parts[1],
    designName: parts[2],
    imageType: parts[3],
    imageFilename: parts[4], // Exact filename preserved
    imageOrder: parseInt(parts[5], 10)
  });
}
console.log('Parsed CSV records:', records.length);

// 1. Copy Sheet 2 mockups
const s2Dirs = ['D:\\Glossy 1', 'D:\\Glossy 2', 'D:\\Glossy 3', 'D:\\Glossy 4', 'D:\\Glossy 5', 'D:\\Glossy 6'];
const s2Records = records.filter(r => r.sheet === '2');
let s2Copied = 0;
for (const r of s2Records) {
  let found = false;
  for (const d of s2Dirs) {
    const srcFile = path.join(d, r.imageFilename);
    if (fs.existsSync(srcFile)) {
      const destFile = path.join(S2_DEST, r.imageFilename);
      fs.copyFileSync(srcFile, destFile);
      s2Copied++;
      found = true;
      break;
    }
  }
  if (!found) {
    console.error('ERROR: Sheet 2 source file missing:', r.imageFilename);
  }
}
console.log(`Sheet 2 Mockups Copied: ${s2Copied} / ${s2Records.length}`);

// 2. Copy Sheet 3 mockups
const s3PreviewDir = 'D:\\mg glossy preview\\mg glossy preview';
const s3MockRecords = records.filter(r => r.sheet === '3' && r.imageType === 'Mockup');
let s3MockCopied = 0;
for (const r of s3MockRecords) {
  const srcFile = path.join(s3PreviewDir, r.imageFilename);
  if (fs.existsSync(srcFile)) {
    const destFile = path.join(S3_MOCK_DEST, r.imageFilename);
    fs.copyFileSync(srcFile, destFile);
    s3MockCopied++;
  } else {
    console.error('ERROR: Sheet 3 mockup source file missing:', r.imageFilename);
  }
}
console.log(`Sheet 3 Mockups Copied: ${s3MockCopied} / ${s3MockRecords.length}`);

// 3. Copy Sheet 3 tile faces
const s3TileDirs = ['D:\\mg glossy 1', 'D:\\mg glossy 2', 'D:\\mg glossy 3', 'D:\\mg glossy 4'];
const s3TileRecords = records.filter(r => r.sheet === '3' && r.imageType === 'Tile Face');
let s3TileCopied = 0;
for (const r of s3TileRecords) {
  let found = false;
  for (const d of s3TileDirs) {
    const directPath = path.join(d, r.imageFilename);
    const subfolderPath = path.join(d, r.designName, r.imageFilename);
    let srcFile = null;
    if (fs.existsSync(directPath)) {
      srcFile = directPath;
    } else if (fs.existsSync(subfolderPath)) {
      srcFile = subfolderPath;
    }
    if (srcFile) {
      const destFile = path.join(S3_TILE_DEST, r.imageFilename);
      fs.copyFileSync(srcFile, destFile);
      s3TileCopied++;
      found = true;
      break;
    }
  }
  if (!found) {
    console.error('ERROR: Sheet 3 tile face source file missing:', r.imageFilename);
  }
}
console.log(`Sheet 3 Tile Faces Copied: ${s3TileCopied} / ${s3TileRecords.length}`);

// Verification of staged directories
const s2Staged = fs.readdirSync(S2_DEST);
const s3MockStaged = fs.readdirSync(S3_MOCK_DEST);
const s3TileStaged = fs.readdirSync(S3_TILE_DEST);

console.log('--- VERIFICATION OF STAGED FILES ---');
console.log('Sheet 2 Mockups count:', s2Staged.length, '(Expected: 138)');
console.log('Sheet 3 Mockups count:', s3MockStaged.length, '(Expected: 97)');
console.log('Sheet 3 Tile Faces count:', s3TileStaged.length, '(Expected: 360)');

// Check ADIGE GREY .jpg in S2
const hasAdigeGreySpace = fs.existsSync(path.join(S2_DEST, 'ADIGE GREY .jpg'));
console.log('Exact filename preserved ("ADIGE GREY .jpg"):', hasAdigeGreySpace);

const stagingSummary = {
  csvRecordsCount: records.length,
  s2StagedCount: s2Staged.length,
  s3MockStagedCount: s3MockStaged.length,
  s3TileStagedCount: s3TileStaged.length,
  allFilesExist: (s2Staged.length === 138 && s3MockStaged.length === 97 && s3TileStaged.length === 360),
  adigeGreySpacePreserved: hasAdigeGreySpace
};

fs.writeFileSync(
  path.join(PROJECT_ROOT, 'build', 'staging_verification.json'),
  JSON.stringify(stagingSummary, null, 2),
  'utf8'
);
console.log('Staging verification summary written to build/staging_verification.json');
