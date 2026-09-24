/**
 * ITACON GRANITO - Glossy Tile WebP Thumbnail Generator
 *
 * Generates 547 WebP thumbnails from confirmed glossy source images.
 * Settings:
 * - max dimension: 800px
 * - quality: 80
 * - preserve aspect ratio
 * - withoutEnlargement: true
 *
 * Output directory: build/generated_glossy_thumbnails/
 */

const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(__dirname, 'ITACON_Image_Mapping.csv');
const GLOSSY_EXTRACTED_DIR = 'D:/glossy/glossy';
const THUMBNAILS_OUTPUT_DIR = path.join(PROJECT_ROOT, 'build', 'generated_glossy_thumbnails');
const MANIFEST_OUTPUT_PATH = path.join(PROJECT_ROOT, 'build', 'glossy_thumbnails_manifest.json');

if (!fs.existsSync(THUMBNAILS_OUTPUT_DIR)) {
  fs.mkdirSync(THUMBNAILS_OUTPUT_DIR, { recursive: true });
}

// Subdirectory map for exact folder resolution
const dirEntries = fs.readdirSync(GLOSSY_EXTRACTED_DIR, { withFileTypes: true });
const subDirMap = new Map();
for (const d of dirEntries) {
  if (d.isDirectory()) {
    subDirMap.set(d.name.toLowerCase().trim(), d.name);
  }
}

function resolveSourceFile(sourceImageStr) {
  const cleanStr = sourceImageStr.replace(/\\/g, '/').trim();
  const parts = cleanStr.split('/');
  let targetFolder = '';
  let targetFilename = '';

  if (parts.length >= 3) {
    targetFolder = parts[1].trim();
    targetFilename = parts.slice(2).join('/').trim();
  } else if (parts.length === 2) {
    targetFolder = parts[0].trim();
    targetFilename = parts[1].trim();
  } else {
    targetFilename = parts[0].trim();
  }

  const directPath = path.join(GLOSSY_EXTRACTED_DIR, targetFolder, targetFilename);
  if (fs.existsSync(directPath)) return directPath;

  const actualFolder = subDirMap.get(targetFolder.toLowerCase());
  if (actualFolder) {
    const candidatePath = path.join(GLOSSY_EXTRACTED_DIR, actualFolder, targetFilename);
    if (fs.existsSync(candidatePath)) return candidatePath;

    const files = fs.readdirSync(path.join(GLOSSY_EXTRACTED_DIR, actualFolder));
    const targetNorm = targetFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = files.filter(f => f.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm);
    if (matched.length === 1) {
      return path.join(GLOSSY_EXTRACTED_DIR, actualFolder, matched[0]);
    }
  }

  const baseNorm = targetFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [_, actualDir] of subDirMap) {
    const dirPath = path.join(GLOSSY_EXTRACTED_DIR, actualDir);
    const files = fs.readdirSync(dirPath);
    for (const f of files) {
      if (f.toLowerCase().replace(/[^a-z0-9]/g, '') === baseNorm) {
        return path.join(dirPath, f);
      }
    }
  }
  return null;
}

async function main() {
  console.log('======================================================================');
  console.log('PHASE 6 — GENERATE WEBP THUMBNAILS (547 confirmed images)');
  console.log('======================================================================\n');

  const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csvRaw.split(/\r?\n/).filter(l => l.trim().length > 0);

  console.log(`Mapping rows in CSV: ${lines.length - 1}`);

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const designName = cols[0];
    const sku = cols[1];
    const sourceZip = cols[2];
    const sourceImage = cols[3];
    const role = cols[4].toLowerCase();
    const sequence = parseInt(cols[5], 10) || 1;

    const localSourcePath = resolveSourceFile(sourceImage);
    if (!localSourcePath) {
      console.error(`FATAL: Source image not found: ${sourceImage}`);
      process.exit(1);
    }

    const isRoomMockup = role === 'room';
    const cleanExt = path.extname(localSourcePath).toLowerCase();

    // Standardized Storage and Thumbnail Paths
    let finalOriginalStoragePath;
    let finalThumbnailStoragePath;
    let localThumbFilename;

    if (isRoomMockup) {
      finalOriginalStoragePath = `products/mockups/${sku}_room${sequence}${cleanExt}`;
      finalThumbnailStoragePath = `products/thumbnails/mockups/${sku}_room${sequence}.webp`;
      localThumbFilename = `mockups_${sku}_room${sequence}.webp`;
    } else {
      finalOriginalStoragePath = `products/tiles/${sku}_face${sequence}${cleanExt}`;
      finalThumbnailStoragePath = `products/thumbnails/tiles/${sku}_face${sequence}.webp`;
      localThumbFilename = `tiles_${sku}_face${sequence}.webp`;
    }

    const localThumbPath = path.join(THUMBNAILS_OUTPUT_DIR, localThumbFilename);

    items.push({
      index: i,
      designName,
      sku,
      role,
      sequence,
      isRoomMockup,
      sourceImage,
      localSourcePath,
      localThumbPath,
      localThumbFilename,
      finalOriginalStoragePath,
      finalThumbnailStoragePath
    });
  }

  console.log(`Starting parallel thumbnail generation for ${items.length} images...`);
  console.log('Parameters: maxDimension = 800px, quality = 80, fit = inside, withoutEnlargement = true\n');

  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  // Batch process with concurrency
  const concurrency = 12;
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await sharp(item.localSourcePath)
          .rotate() // Auto-orient according to EXIF if any
          .resize({
            width: 800,
            height: 800,
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 80 })
          .toFile(item.localThumbPath);

        successCount++;
        if (successCount % 50 === 0 || successCount === items.length) {
          console.log(`  Progress: ${successCount}/${items.length} (${((successCount / items.length) * 100).toFixed(1)}%)...`);
        }
      } catch (err) {
        failureCount++;
        failures.push({ item, error: err.message });
        console.error(`  ERROR on ${item.sourceImage}: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  console.log('\n--- VERIFICATION OF GENERATED THUMBNAILS ---');
  console.log(`Expected: ${items.length}`);
  console.log(`Generated: ${successCount}`);
  console.log(`Failures: ${failureCount}`);

  // Thorough integrity verification: inspect each generated file with sharp
  console.log('\nVerifying output file integrity & dimensions...');
  let corruptCount = 0;
  let totalOrigBytes = 0;
  let totalThumbBytes = 0;

  for (const item of items) {
    try {
      const stat = fs.statSync(item.localThumbPath);
      if (stat.size === 0) {
        corruptCount++;
        continue;
      }
      totalThumbBytes += stat.size;

      const origStat = fs.statSync(item.localSourcePath);
      totalOrigBytes += origStat.size;

      const meta = await sharp(item.localThumbPath).metadata();
      if (meta.format !== 'webp' || meta.width > 800 || meta.height > 800) {
        corruptCount++;
      }
    } catch (e) {
      corruptCount++;
    }
  }

  console.log(`Corrupt or invalid WebP files: ${corruptCount}`);
  console.log(`Total original image size: ${(totalOrigBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Total WebP thumbnail size:  ${(totalThumbBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Average compression ratio:  ${((1 - (totalThumbBytes / totalOrigBytes)) * 100).toFixed(1)}% reduction`);

  // Save thumbnail manifest for upload pipeline
  fs.writeFileSync(MANIFEST_OUTPUT_PATH, JSON.stringify(items, null, 2), 'utf8');
  console.log(`\nSaved manifest to ${MANIFEST_OUTPUT_PATH}`);

  if (failureCount === 0 && corruptCount === 0 && successCount === 547) {
    console.log('\n======================================================================');
    console.log('PHASE 6 COMPLETE: 547 WEBP THUMBNAILS GENERATED & VERIFIED 100% CLEAN');
    console.log('======================================================================');
  } else {
    console.error('PHASE 6 FAILED VALIDATION! STOPPING.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in generator:', err);
  process.exit(1);
});
