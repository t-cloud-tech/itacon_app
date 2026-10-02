const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const S2_DIR = path.join(__dirname, '..', 'assets', 'product_import', 'sheet2', 'mockups');
const S3_DIR = path.join(__dirname, '..', 'assets', 'product_import', 'sheet3', 'mockups');

const CONFIG = {
  darkPixelThreshold: 55,       // RGB < 55 considered dark
  borderLineDarkPct: 0.30,      // Line with >= 30% dark pixels is considered a border candidate
  borderLineAvgLum: 45,         // Line with avg lum < 45 is dark
  maxCropPct: 0.25              // Safety limit: max 25% area
};

function isDark(r, g, b) {
  return r <= CONFIG.darkPixelThreshold && g <= CONFIG.darkPixelThreshold && b <= CONFIG.darkPixelThreshold;
}

async function analyzeEdgeBorders(filePath) {
  const meta = await sharp(filePath).metadata();
  const origW = meta.width;
  const origH = meta.height;

  // Normalize to 800px on long edge for precise edge profiling
  const scale = 800 / Math.max(origW, origH);
  const normW = Math.round(origW * scale);
  const normH = Math.round(origH * scale);

  const raw = await sharp(filePath).resize(normW, normH, { fit: 'fill' }).raw().toBuffer();
  const channels = 3;

  function rowStats(y) {
    let darkCount = 0;
    let sumL = 0;
    for (let x = 0; x < normW; x++) {
      const idx = (y * normW + x) * channels;
      const r = raw[idx], g = raw[idx+1], b = raw[idx+2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      sumL += l;
      if (isDark(r, g, b)) darkCount++;
    }
    const pct = darkCount / normW;
    const avg = sumL / normW;
    const isBorderLine = (pct >= CONFIG.borderLineDarkPct) || (avg <= CONFIG.borderLineAvgLum);
    return { pct, avg, isBorderLine };
  }

  function colStats(x) {
    let darkCount = 0;
    let sumL = 0;
    for (let y = 0; y < normH; y++) {
      const idx = (y * normW + x) * channels;
      const r = raw[idx], g = raw[idx+1], b = raw[idx+2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      sumL += l;
      if (isDark(r, g, b)) darkCount++;
    }
    const pct = darkCount / normH;
    const avg = sumL / normH;
    const isBorderLine = (pct >= CONFIG.borderLineDarkPct) || (avg <= CONFIG.borderLineAvgLum);
    return { pct, avg, isBorderLine };
  }

  // 1. TOP BORDER
  let topRows = 0;
  const maxTop = Math.floor(normH * 0.20);
  const r0 = rowStats(0);
  if (r0.isBorderLine) {
    for (let y = 0; y < maxTop; y++) {
      const st = rowStats(y);
      if (st.isBorderLine) {
        topRows = y + 1;
      } else {
        // lookahead 3 rows for text inside dark strip
        let foundNextDark = false;
        for (let l = 1; l <= 4 && y + l < maxTop; l++) {
          if (rowStats(y + l).isBorderLine) {
            foundNextDark = true;
            break;
          }
        }
        if (foundNextDark) {
          topRows = y + 1;
        } else {
          break;
        }
      }
    }
  }

  // 2. BOTTOM BORDER
  let botRows = 0;
  const maxBot = Math.floor(normH * 0.20);
  const rEnd = rowStats(normH - 1);
  if (rEnd.isBorderLine) {
    for (let b = 0; b < maxBot; b++) {
      const y = normH - 1 - b;
      const st = rowStats(y);
      if (st.isBorderLine) {
        botRows = b + 1;
      } else {
        let foundNextDark = false;
        for (let l = 1; l <= 4 && b + l < maxBot; l++) {
          if (rowStats(normH - 1 - (b + l)).isBorderLine) {
            foundNextDark = true;
            break;
          }
        }
        if (foundNextDark) {
          botRows = b + 1;
        } else {
          break;
        }
      }
    }
  }

  // 3. LEFT BORDER
  let leftCols = 0;
  const maxLeft = Math.floor(normW * 0.20);
  const c0 = colStats(0);
  if (c0.isBorderLine) {
    for (let x = 0; x < maxLeft; x++) {
      const st = colStats(x);
      if (st.isBorderLine) {
        leftCols = x + 1;
      } else {
        let foundNextDark = false;
        for (let l = 1; l <= 4 && x + l < maxLeft; l++) {
          if (colStats(x + l).isBorderLine) {
            foundNextDark = true;
            break;
          }
        }
        if (foundNextDark) {
          leftCols = x + 1;
        } else {
          break;
        }
      }
    }
  }

  // 4. RIGHT BORDER
  let rightCols = 0;
  const maxRight = Math.floor(normW * 0.20);
  const cEnd = colStats(normW - 1);
  if (cEnd.isBorderLine) {
    for (let r = 0; r < maxRight; r++) {
      const x = normW - 1 - r;
      const st = colStats(x);
      if (st.isBorderLine) {
        rightCols = r + 1;
      } else {
        let foundNextDark = false;
        for (let l = 1; l <= 4 && r + l < maxRight; l++) {
          if (colStats(normW - 1 - (r + l)).isBorderLine) {
            foundNextDark = true;
            break;
          }
        }
        if (foundNextDark) {
          rightCols = r + 1;
        } else {
          break;
        }
      }
    }
  }

  // Map back to original image coordinates
  const origTop = Math.min(Math.round(topRows / scale), Math.floor(origH * 0.25));
  const origBottom = Math.min(Math.round(botRows / scale), Math.floor(origH * 0.25));
  const origLeft = Math.min(Math.round(leftCols / scale), Math.floor(origW * 0.25));
  const origRight = Math.min(Math.round(rightCols / scale), Math.floor(origW * 0.25));

  const hasBorder = origTop > 0 || origBottom > 0 || origLeft > 0 || origRight > 0;

  const cropX = origLeft;
  const cropY = origTop;
  const cropW = origW - origLeft - origRight;
  const cropH = origH - origTop - origBottom;

  const origArea = origW * origH;
  const croppedArea = cropW * cropH;
  const areaRemovedPct = ((origArea - croppedArea) / origArea) * 100;

  return {
    origW,
    origH,
    hasBorder,
    borders: { top: origTop, bottom: origBottom, left: origLeft, right: origRight },
    crop: { x: cropX, y: cropY, w: cropW, h: cropH },
    areaRemovedPct: parseFloat(areaRemovedPct.toFixed(2)),
    status: hasBorder ? (areaRemovedPct <= CONFIG.maxCropPct * 100 ? 'SAFE_TO_CROP' : 'MANUAL_REVIEW_REQUIRED') : 'NO_CROP_NEEDED'
  };
}

async function run() {
  console.log('Running refined border detection across Sheet 2 & Sheet 3 mockups...');

  const groups = [
    { name: 'Sheet 2', dir: S2_DIR },
    { name: 'Sheet 3', dir: S3_DIR }
  ];

  const allResults = [];

  for (const g of groups) {
    const files = fs.readdirSync(g.dir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
    console.log(`\nScanning ${g.name} (${files.length} images)...`);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const full = path.join(g.dir, f);
      const res = await analyzeEdgeBorders(full);
      allResults.push({
        sheet: g.name,
        filename: f,
        localPath: full,
        firebaseStoragePath: `products/mockups/${f}`,
        thumbnailStoragePath: `products/thumbnails/mockups/${path.basename(f, path.extname(f))}.webp`,
        ...res
      });
      if ((i + 1) % 40 === 0 || i === files.length - 1) {
        console.log(`  Processed ${i + 1} / ${files.length}`);
      }
    }
  }

  const needCrop = allResults.filter(r => r.status === 'SAFE_TO_CROP');
  const clean = allResults.filter(r => r.status === 'NO_CROP_NEEDED');
  const review = allResults.filter(r => r.status === 'MANUAL_REVIEW_REQUIRED');

  console.log('\n======================================================');
  console.log('REFINED DETECTION SUMMARY:');
  console.log(`Total Images Audited: ${allResults.length}`);
  console.log(`SAFE_TO_CROP (Border Detected): ${needCrop.length}`);
  console.log(`NO_CROP_NEEDED (Clean): ${clean.length}`);
  console.log(`MANUAL_REVIEW_REQUIRED: ${review.length}`);
  console.log('======================================================');

  if (needCrop.length > 0) {
    console.log('\nImages needing crop:');
    needCrop.forEach(c => {
      console.log(`  [${c.sheet}] ${c.filename} (${c.origW}x${c.origH}) -> Borders: T=${c.borders.top}, B=${c.borders.bottom}, L=${c.borders.left}, R=${c.borders.right} (Area removed: ${c.areaRemovedPct}%)`);
    });
  }

  fs.writeFileSync('scripts/s2_s3_refined_audit.json', JSON.stringify(allResults, null, 2), 'utf8');
  console.log('\nSaved audit to scripts/s2_s3_refined_audit.json');
}

run().catch(console.error);
