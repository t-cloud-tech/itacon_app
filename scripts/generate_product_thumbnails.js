/**
 * Reproducible Product Thumbnail Generation Script
 * 
 * Generates high-efficiency WebP thumbnails for ITACON products
 * conforming to Phase 4.3 specifications without modifying source images.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'build', 'product_thumbnails');

// Load product catalog metadata for manifest enrichment
const seedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'tiles_seed_data.json'), 'utf8'));
const { adhesiveProducts } = require(path.join(__dirname, 'seed_adhesives.js'));

const skuMap = new Map();
for (const p of seedData.products) {
  skuMap.set(p.sku, { code: p.sku, name: p.name });
}
for (const a of adhesiveProducts) {
  skuMap.set(a.sku, { code: a.sku, name: a.name });
}

function findProductInfo(filename, category) {
  if (category === 'adhesive') {
    const ext = path.extname(filename);
    const sku = path.basename(filename, ext);
    if (skuMap.has(sku)) return skuMap.get(sku);
    return { code: sku, name: null };
  }
  
  // For tiles and mockups: format is typically SKU_suffix or SKU.ext
  // e.g. VIT-60120-8.50-GLO-MAR-WHIT-00-001_mockup.jpeg
  // or VIT-60120-8.50-GLO-MAR-WHIT-00-001_face1.jpeg
  for (const [sku, info] of skuMap.entries()) {
    if (filename.startsWith(sku)) {
      return info;
    }
  }

  if (filename.includes('fallback_tile')) {
    return { code: null, name: 'Fallback Tile Image' };
  }

  return { code: null, name: null };
}

const CATEGORIES = [
  {
    category: 'mockup',
    sourceDir: path.join(PROJECT_ROOT, 'assets', 'images', 'mockups'),
    outDir: path.join(OUTPUT_ROOT, 'mockups'),
    sourceFirebasePrefix: 'products/mockups/',
    thumbFirebasePrefix: 'products/thumbnails/mockups/',
    targetWidth: 600,
    targetHeight: 400,
    quality: 82
  },
  {
    category: 'tile',
    sourceDir: path.join(PROJECT_ROOT, 'assets', 'images', 'tiles'),
    outDir: path.join(OUTPUT_ROOT, 'tiles'),
    sourceFirebasePrefix: 'products/tiles/',
    thumbFirebasePrefix: 'products/thumbnails/tiles/',
    targetWidth: 200,
    targetHeight: 400,
    quality: 80
  },
  {
    category: 'adhesive',
    sourceDir: path.join(PROJECT_ROOT, 'assets', 'images', 'adhesives'),
    outDir: path.join(OUTPUT_ROOT, 'adhesives'),
    sourceFirebasePrefix: 'products/adhesives/',
    thumbFirebasePrefix: 'products/thumbnails/adhesives/',
    targetWidth: 400,
    targetHeight: 500,
    quality: 82
  }
];

async function generateThumbnails() {
  console.log('====================================================');
  console.log('PHASE 4.3 — PRODUCT THUMBNAIL GENERATOR');
  console.log('====================================================');
  console.log(`Output Directory: ${OUTPUT_ROOT}\n`);

  if (!fs.existsSync(OUTPUT_ROOT)) {
    fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  }

  const manifest = [];
  const stats = {
    mockup: { count: 0, sourceBytes: 0, thumbBytes: 0 },
    tile: { count: 0, sourceBytes: 0, thumbBytes: 0 },
    adhesive: { count: 0, sourceBytes: 0, thumbBytes: 0 }
  };

  for (const config of CATEGORIES) {
    if (!fs.existsSync(config.outDir)) {
      fs.mkdirSync(config.outDir, { recursive: true });
    }

    const files = fs.readdirSync(config.sourceDir).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    });

    console.log(`Processing ${files.length} images for category: [${config.category}]...`);

    for (const file of files) {
      const sourceLocalPath = path.join(config.sourceDir, file);
      const ext = path.extname(file);
      const baseName = path.basename(file, ext);
      const thumbFileName = `${baseName}.webp`;
      const thumbLocalPath = path.join(config.outDir, thumbFileName);

      const sourceStat = fs.statSync(sourceLocalPath);
      const sourceBytes = sourceStat.size;

      // Extract source metadata
      const sourceMeta = await sharp(sourceLocalPath).metadata();

      // Generate optimized WebP thumbnail preserving aspect ratio
      await sharp(sourceLocalPath)
        .resize(config.targetWidth, config.targetHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({
          quality: config.quality,
          effort: 4
        })
        .toFile(thumbLocalPath);

      const thumbStat = fs.statSync(thumbLocalPath);
      const thumbBytes = thumbStat.size;
      const thumbMeta = await sharp(thumbLocalPath).metadata();

      const prodInfo = findProductInfo(file, config.category);

      const sourceFirebasePath = `${config.sourceFirebasePrefix}${file}`;
      const thumbnailFirebasePath = `${config.thumbFirebasePrefix}${thumbFileName}`;

      const entry = {
        category: config.category,
        productCode: prodInfo.code,
        productName: prodInfo.name,
        sourceLocalPath: path.relative(PROJECT_ROOT, sourceLocalPath).replace(/\\/g, '/'),
        sourceFirebasePath,
        thumbnailLocalPath: path.relative(PROJECT_ROOT, thumbLocalPath).replace(/\\/g, '/'),
        thumbnailFirebasePath,
        sourceWidth: sourceMeta.width,
        sourceHeight: sourceMeta.height,
        thumbnailWidth: thumbMeta.width,
        thumbnailHeight: thumbMeta.height,
        sourceBytes,
        thumbnailBytes: thumbBytes,
        format: 'webp',
        quality: config.quality
      };

      manifest.push(entry);

      stats[config.category].count++;
      stats[config.category].sourceBytes += sourceBytes;
      stats[config.category].thumbBytes += thumbBytes;
    }
  }

  // Save manifest
  const manifestPath = path.join(OUTPUT_ROOT, 'thumbnail_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest generated successfully at: ${manifestPath}`);

  // Print Detailed Summary
  console.log('\n====================================================');
  console.log('SUMMARY OF GENERATED THUMBNAILS');
  console.log('====================================================');

  let totalSourceBytes = 0;
  let totalThumbBytes = 0;
  let totalCount = 0;

  for (const cat of ['mockup', 'tile', 'adhesive']) {
    const s = stats[cat];
    const red = ((1 - s.thumbBytes / s.sourceBytes) * 100).toFixed(2);
    totalSourceBytes += s.sourceBytes;
    totalThumbBytes += s.thumbBytes;
    totalCount += s.count;

    console.log(`Category: [${cat.toUpperCase()}]`);
    console.log(`  Count:         ${s.count}`);
    console.log(`  Original Size: ${(s.sourceBytes / (1024 * 1024)).toFixed(2)} MB (${s.sourceBytes.toLocaleString()} bytes)`);
    console.log(`  Thumbnail Size:${(s.thumbBytes / (1024 * 1024)).toFixed(2)} MB (${s.thumbBytes.toLocaleString()} bytes)`);
    console.log(`  Reduction:     ${red}%\n`);
  }

  const totalRed = ((1 - totalThumbBytes / totalSourceBytes) * 100).toFixed(2);
  console.log('----------------------------------------------------');
  console.log(`TOTAL IMAGES PROCESSED: ${totalCount}`);
  console.log(`TOTAL ORIGINAL SIZE:    ${(totalSourceBytes / (1024 * 1024)).toFixed(2)} MB (${totalSourceBytes.toLocaleString()} bytes)`);
  console.log(`TOTAL THUMBNAIL SIZE:   ${(totalThumbBytes / (1024 * 1024)).toFixed(2)} MB (${totalThumbBytes.toLocaleString()} bytes)`);
  console.log(`OVERALL REDUCTION:      ${totalRed}%`);
  console.log('====================================================\n');
}

generateThumbnails().catch(err => {
  console.error('Thumbnail generation failed:', err);
  process.exit(1);
});
