const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const DIRS = [
  { name: 'Sheet 1', dir: path.join(__dirname, '..', 'assets', 'images', 'mockups') },
  { name: 'Sheet 2', dir: path.join(__dirname, '..', 'assets', 'product_import', 'sheet2', 'mockups') },
  { name: 'Sheet 3', dir: path.join(__dirname, '..', 'assets', 'product_import', 'sheet3', 'mockups') },
];

async function scanBorders() {
  console.log('Scanning all 299 mockup images across Sheet 1, Sheet 2, Sheet 3...');

  const results = [];

  for (const group of DIRS) {
    const files = fs.readdirSync(group.dir).filter(f => !f.startsWith('.'));
    console.log(`\nScanning ${group.name} (${files.length} images)...`);

    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const filePath = path.join(group.dir, filename);

      try {
        const meta = await sharp(filePath).metadata();
        const { width, height } = meta;

        // We want to detect borders on:
        // Top: check down to max 25% of height
        // Bottom: check up to max 25% of height
        // Left: check right to max 25% of width
        // Right: check left to max 25% of width

        // To do this efficiently and accurately, let's downsample or extract edge bands.
        // For large images (like 9525x6700), processing full res can take a lot of memory.
        // Let's resize to a normalized scale (e.g. width ~ 1000px, or resize max dimension 1600px)
        // OR extract bands directly from sharp.
        // Actually, if we resize image to e.g. 1000px wide (preserving aspect ratio):
        // 1 pixel in resized = (width / 1000) pixels in original.
        // But wait! Resizing might blur text or thin borders slightly.
        // Let's see: extracting the top 15% and bottom 15% at full res or downsampled:
        // Let's test on a downscaled version (width 1200) vs full res.
        
        // Let's do a fast scan with resized 1200px wide:
        const scale = 1200 / width;
        const resH = Math.round(height * scale);
        const resW = 1200;

        const raw = await sharp(filePath)
          .resize(resW, resH)
          .raw()
          .toBuffer();

        const channels = 3; // sharp raw() produces RGB by default if we don't have alpha

        // Helper: check if a pixel is near-black
        // Near-black: R < 35 && G < 35 && B < 35 (or lum < 35)
        function isNearBlack(r, g, b) {
          return r < 40 && g < 40 && b < 40;
        }

        // Analyze TOP rows
        let topBorderRows = 0;
        const maxTop = Math.floor(resH * 0.25); // conservative safety limit: max 25%
        for (let y = 0; y < maxTop; y++) {
          let blackPixels = 0;
          for (let x = 0; x < resW; x++) {
            const idx = (y * resW + x) * channels;
            if (isNearBlack(raw[idx], raw[idx + 1], raw[idx + 2])) {
              blackPixels++;
            }
          }
          const pct = blackPixels / resW;
          // If a row is part of a black strip (even with text), black pixels will be >= 75%
          // (text usually occupies < 20% of the row width)
          // If the very first rows are not dark at all, there is NO top border!
          if (y === 0 && pct < 0.60) {
            // First row isn't dark, so no top border
            break;
          }
          if (pct >= 0.70) {
            topBorderRows = y + 1;
          } else {
            // Allow 1-2 rows of text/noise if followed by more black?
            // Let's check next 3 rows
            let lookaheadBlack = false;
            for (let look = 1; look <= 4 && y + look < maxTop; look++) {
              let lookBlack = 0;
              for (let x = 0; x < resW; x++) {
                const idx = ((y + look) * resW + x) * channels;
                if (isNearBlack(raw[idx], raw[idx + 1], raw[idx + 2])) {
                  lookBlack++;
                }
              }
              if (lookBlack / resW >= 0.70) {
                lookaheadBlack = true;
                break;
              }
            }
            if (lookaheadBlack) {
              topBorderRows = y + 1;
            } else {
              break;
            }
          }
        }

        // Analyze BOTTOM rows
        let bottomBorderRows = 0;
        const maxBottom = Math.floor(resH * 0.25);
        for (let b = 0; b < maxBottom; b++) {
          const y = resH - 1 - b;
          let blackPixels = 0;
          for (let x = 0; x < resW; x++) {
            const idx = (y * resW + x) * channels;
            if (isNearBlack(raw[idx], raw[idx + 1], raw[idx + 2])) {
              blackPixels++;
            }
          }
          const pct = blackPixels / resW;
          if (b === 0 && pct < 0.60) {
            break;
          }
          if (pct >= 0.70) {
            bottomBorderRows = b + 1;
          } else {
            let lookaheadBlack = false;
            for (let look = 1; look <= 4 && b + look < maxBottom; look++) {
              let lookBlack = 0;
              const ly = resH - 1 - (b + look);
              for (let x = 0; x < resW; x++) {
                const idx = (ly * resW + x) * channels;
                if (isNearBlack(raw[idx], raw[idx + 1], raw[idx + 2])) {
                  lookBlack++;
                }
              }
              if (lookBlack / resW >= 0.70) {
                lookaheadBlack = true;
                break;
              }
            }
            if (lookaheadBlack) {
              bottomBorderRows = b + 1;
            } else {
              break;
            }
          }
        }

        // Analyze LEFT columns
        let leftBorderCols = 0;
        const maxLeft = Math.floor(resW * 0.20);
        for (let x = 0; x < maxLeft; x++) {
          let blackPixels = 0;
          for (let y = 0; y < resH; y++) {
            const idx = (y * resW + x) * channels;
            if (isNearBlack(raw[idx], raw[idx + 1], raw[idx + 2])) {
              blackPixels++;
            }
          }
          const pct = blackPixels / resH;
          if (x === 0 && pct < 0.60) break;
          if (pct >= 0.70) {
            leftBorderCols = x + 1;
          } else {
            break;
          }
        }

        // Analyze RIGHT columns
        let rightBorderCols = 0;
        const maxRight = Math.floor(resW * 0.20);
        for (let r = 0; r < maxRight; r++) {
          const x = resW - 1 - r;
          let blackPixels = 0;
          for (let y = 0; y < resH; y++) {
            const idx = (y * resW + x) * channels;
            if (isNearBlack(raw[idx], raw[idx + 1], raw[idx + 2])) {
              blackPixels++;
            }
          }
          const pct = blackPixels / resH;
          if (r === 0 && pct < 0.60) break;
          if (pct >= 0.70) {
            rightBorderCols = r + 1;
          } else {
            break;
          }
        }

        // Map back to original resolution
        const origTop = Math.round(topBorderRows / scale);
        const origBottom = Math.round(bottomBorderRows / scale);
        const origLeft = Math.round(leftBorderCols / scale);
        const origRight = Math.round(rightBorderCols / scale);

        const hasBorder = origTop > 0 || origBottom > 0 || origLeft > 0 || origRight > 0;

        // Crop rect
        const cropX = origLeft;
        const cropY = origTop;
        const cropW = width - origLeft - origRight;
        const cropH = height - origTop - origBottom;

        const areaRemoved = (width * height - cropW * cropH) / (width * height);
        const pctRemoved = (areaRemoved * 100).toFixed(2);

        let status = 'NO_CROP_NEEDED';
        if (hasBorder) {
          if (areaRemoved > 0.25) {
            status = 'MANUAL_REVIEW_REQUIRED';
          } else {
            status = 'SAFE_TO_CROP';
          }
        }

        results.push({
          group: group.name,
          filename,
          width,
          height,
          format: meta.format,
          hasBorder,
          borders: { top: origTop, bottom: origBottom, left: origLeft, right: origRight },
          crop: { x: cropX, y: cropY, w: cropW, h: cropH },
          pctRemoved,
          status
        });

      } catch (err) {
        console.error(`Error processing ${filename}:`, err.message);
        results.push({
          group: group.name,
          filename,
          status: 'ERROR',
          error: err.message
        });
      }
    }
  }

  // Summary counts
  const total = results.length;
  const withBorder = results.filter(r => r.hasBorder).length;
  const safeToCrop = results.filter(r => r.status === 'SAFE_TO_CROP').length;
  const noCropNeeded = results.filter(r => r.status === 'NO_CROP_NEEDED').length;
  const manualReview = results.filter(r => r.status === 'MANUAL_REVIEW_REQUIRED').length;

  console.log('\n==================================================');
  console.log('SCAN SUMMARY:');
  console.log(`Total Scanned: ${total}`);
  console.log(`With Border: ${withBorder}`);
  console.log(`SAFE_TO_CROP: ${safeToCrop}`);
  console.log(`NO_CROP_NEEDED: ${noCropNeeded}`);
  console.log(`MANUAL_REVIEW_REQUIRED: ${manualReview}`);
  console.log('==================================================\n');

  // Let's log some examples with borders
  const sampleWithBorders = results.filter(r => r.hasBorder).slice(0, 15);
  console.log('Sample images with borders:');
  sampleWithBorders.forEach(s => {
    console.log(`- [${s.group}] ${s.filename} (${s.width}x${s.height}): Top=${s.borders.top}, Bottom=${s.borders.bottom}, Left=${s.borders.left}, Right=${s.borders.right} -> Removed ${s.pctRemoved}% (${s.status})`);
  });

  fs.writeFileSync(path.join(__dirname, 'mockup_scan_preliminary.json'), JSON.stringify(results, null, 2), 'utf8');
}

scanBorders().catch(console.error);
