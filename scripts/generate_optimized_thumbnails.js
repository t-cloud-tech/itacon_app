const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const S2_MOCK_DIR = path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet2', 'mockups');
const S3_MOCK_DIR = path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'mockups');
const S3_TILE_DIR = path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'tile_faces');

const THUMB_MOCK_DIR = path.join(PROJECT_ROOT, 'assets', 'product_import', 'thumbnails', 'mockups');
const THUMB_TILE_DIR = path.join(PROJECT_ROOT, 'assets', 'product_import', 'thumbnails', 'tiles');

[THUMB_MOCK_DIR, THUMB_TILE_DIR].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

async function generateThumbnail(srcPath, destPath, targetWidth) {
  // Deterministic WebP conversion: resize with withoutEnlargement: true, quality: 80
  await sharp(srcPath)
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(destPath);
}

function getBaseName(filename) {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(0, lastDot) : filename;
}

async function run() {
  console.log('--- STEP 2: GENERATING OPTIMIZED WEBP THUMBNAILS ---');
  const start = Date.now();

  // 1. Sheet 2 mockups (Target: ~440px)
  const s2Files = fs.readdirSync(S2_MOCK_DIR).filter(f => !f.startsWith('.'));
  console.log(`Processing ${s2Files.length} Sheet 2 mockups (target 440px)...`);
  let s2Done = 0;
  for (const f of s2Files) {
    const src = path.join(S2_MOCK_DIR, f);
    const base = getBaseName(f);
    const dest = path.join(THUMB_MOCK_DIR, `${base}.webp`);
    await generateThumbnail(src, dest, 440);
    s2Done++;
  }
  console.log(`Sheet 2 Mockup thumbnails generated: ${s2Done} / ${s2Files.length}`);

  // 2. Sheet 3 mockups (Target: ~440px)
  const s3MockFiles = fs.readdirSync(S3_MOCK_DIR).filter(f => !f.startsWith('.'));
  console.log(`Processing ${s3MockFiles.length} Sheet 3 mockups (target 440px)...`);
  let s3MockDone = 0;
  for (const f of s3MockFiles) {
    const src = path.join(S3_MOCK_DIR, f);
    const base = getBaseName(f);
    const dest = path.join(THUMB_MOCK_DIR, `${base}.webp`);
    await generateThumbnail(src, dest, 440);
    s3MockDone++;
  }
  console.log(`Sheet 3 Mockup thumbnails generated: ${s3MockDone} / ${s3MockFiles.length}`);

  // 3. Sheet 3 tile faces (Target: ~250px)
  const s3TileFiles = fs.readdirSync(S3_TILE_DIR).filter(f => !f.startsWith('.'));
  console.log(`Processing ${s3TileFiles.length} Sheet 3 tile faces (target 250px)...`);
  let s3TileDone = 0;
  for (const f of s3TileFiles) {
    const src = path.join(S3_TILE_DIR, f);
    const base = getBaseName(f);
    const dest = path.join(THUMB_TILE_DIR, `${base}.webp`);
    await generateThumbnail(src, dest, 250);
    s3TileDone++;
  }
  console.log(`Sheet 3 Tile Face thumbnails generated: ${s3TileDone} / ${s3TileFiles.length}`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Thumbnails generated successfully in ${elapsed}s!`);

  const mockThumbs = fs.readdirSync(THUMB_MOCK_DIR).length;
  const tileThumbs = fs.readdirSync(THUMB_TILE_DIR).length;

  console.log('Total Mockup Thumbnails:', mockThumbs, '(Expected: 235)');
  console.log('Total Tile Face Thumbnails:', tileThumbs, '(Expected: 360)');
  console.log('Total Thumbnails Generated:', mockThumbs + tileThumbs, '(Expected: 595)');

  // Verify ADIGE GREY .webp
  const hasAdigeGreyThumb = fs.existsSync(path.join(THUMB_MOCK_DIR, 'ADIGE GREY .webp'));
  console.log('Exact thumbnail preserved ("ADIGE GREY .webp"):', hasAdigeGreyThumb);

  const summary = {
    mockupThumbnailsCount: mockThumbs,
    tileThumbnailsCount: tileThumbs,
    totalThumbnails: mockThumbs + tileThumbs,
    adigeGreyThumbPreserved: hasAdigeGreyThumb,
    elapsedSeconds: parseFloat(elapsed)
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'thumbnail_verification.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );
}

run().catch(err => {
  console.error('Thumbnail generation error:', err);
  process.exit(1);
});
