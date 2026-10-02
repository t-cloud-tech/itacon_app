const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const mapping = JSON.parse(fs.readFileSync('scripts/batch2_room_mapping.json', 'utf8'));
console.log('Loaded batch 2 room items:', mapping.length);

const CONFIG = {
  nearBlackThreshold: 45,       // Max RGB value considered near-black (0-255)
  edgeBorderStartThreshold: 0.60, // Minimum % of black in edge row/col to be considered border
  inwardRowBlackThreshold: 0.70,  // % black for regular border row
  textRowBlackThreshold: 0.50,    // % black for row containing text inside black strip
  maxLookaheadRows: 6,            // Lookahead rows for text in border
  maxCropAreaPercentage: 0.25,    // 25% max crop area safety limit (exceeding -> MANUAL_REVIEW_REQUIRED)
};

function isNearBlack(r, g, b, thresh = CONFIG.nearBlackThreshold) {
  return r <= thresh && g <= thresh && b <= thresh;
}

async function detectCoarseBorders(filePath, origW, origH) {
  const normW = 1200;
  const scale = normW / origW;
  const normH = Math.round(origH * scale);

  const raw = await sharp(filePath)
    .resize(normW, normH)
    .raw()
    .toBuffer();

  const channels = 3;

  // 1. TOP BORDER
  let topRows = 0;
  const maxTop = Math.floor(normH * 0.25);
  let r0Black = 0;
  for (let x = 0; x < normW; x++) {
    const idx = x * channels;
    if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) r0Black++;
  }
  if (r0Black / normW >= CONFIG.edgeBorderStartThreshold) {
    for (let y = 0; y < maxTop; y++) {
      let bCount = 0;
      for (let x = 0; x < normW; x++) {
        const idx = (y * normW + x) * channels;
        if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) bCount++;
      }
      const pct = bCount / normW;
      if (pct >= CONFIG.inwardRowBlackThreshold) {
        topRows = y + 1;
      } else if (pct >= CONFIG.textRowBlackThreshold) {
        let lookAheadFound = false;
        for (let l = 1; l <= CONFIG.maxLookaheadRows && y + l < maxTop; l++) {
          let lBlack = 0;
          for (let x = 0; x < normW; x++) {
            const idx = ((y + l) * normW + x) * channels;
            if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) lBlack++;
          }
          if (lBlack / normW >= CONFIG.inwardRowBlackThreshold) {
            lookAheadFound = true;
            break;
          }
        }
        if (lookAheadFound) {
          topRows = y + 1;
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  // 2. BOTTOM BORDER
  let bottomRows = 0;
  const maxBottom = Math.floor(normH * 0.25);
  let rEndBlack = 0;
  for (let x = 0; x < normW; x++) {
    const idx = ((normH - 1) * normW + x) * channels;
    if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) rEndBlack++;
  }
  if (rEndBlack / normW >= CONFIG.edgeBorderStartThreshold) {
    for (let b = 0; b < maxBottom; b++) {
      const y = normH - 1 - b;
      let bCount = 0;
      for (let x = 0; x < normW; x++) {
        const idx = (y * normW + x) * channels;
        if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) bCount++;
      }
      const pct = bCount / normW;
      if (pct >= CONFIG.inwardRowBlackThreshold) {
        bottomRows = b + 1;
      } else if (pct >= CONFIG.textRowBlackThreshold) {
        let lookAheadFound = false;
        for (let l = 1; l <= CONFIG.maxLookaheadRows && b + l < maxBottom; l++) {
          let lBlack = 0;
          const ly = normH - 1 - (b + l);
          for (let x = 0; x < normW; x++) {
            const idx = (ly * normW + x) * channels;
            if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) lBlack++;
          }
          if (lBlack / normW >= CONFIG.inwardRowBlackThreshold) {
            lookAheadFound = true;
            break;
          }
        }
        if (lookAheadFound) {
          bottomRows = b + 1;
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  // 3. LEFT BORDER
  let leftCols = 0;
  const maxLeft = Math.floor(normW * 0.20);
  let c0Black = 0;
  for (let y = 0; y < normH; y++) {
    const idx = (y * normW) * channels;
    if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) c0Black++;
  }
  if (c0Black / normH >= CONFIG.edgeBorderStartThreshold) {
    for (let x = 0; x < maxLeft; x++) {
      let bCount = 0;
      for (let y = 0; y < normH; y++) {
        const idx = (y * normW + x) * channels;
        if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) bCount++;
      }
      if (bCount / normH >= CONFIG.inwardRowBlackThreshold) {
        leftCols = x + 1;
      } else {
        break;
      }
    }
  }

  // 4. RIGHT BORDER
  let rightCols = 0;
  const maxRight = Math.floor(normW * 0.20);
  let cEndBlack = 0;
  for (let y = 0; y < normH; y++) {
    const idx = (y * normW + (normW - 1)) * channels;
    if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) cEndBlack++;
  }
  if (cEndBlack / normH >= CONFIG.edgeBorderStartThreshold) {
    for (let r = 0; r < maxRight; r++) {
      const x = normW - 1 - r;
      let bCount = 0;
      for (let y = 0; y < normH; y++) {
        const idx = (y * normW + x) * channels;
        if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) bCount++;
      }
      if (bCount / normH >= CONFIG.inwardRowBlackThreshold) {
        rightCols = r + 1;
      } else {
        break;
      }
    }
  }

  // Map to original resolution
  const coarseTop = Math.round(topRows / scale);
  const coarseBottom = Math.round(bottomRows / scale);
  const coarseLeft = Math.round(leftCols / scale);
  const coarseRight = Math.round(rightCols / scale);

  return {
    top: coarseTop,
    bottom: coarseBottom,
    left: coarseLeft,
    right: coarseRight
  };
}

async function runAudit() {
  console.log('Auditing 249 Batch 2 room mockups...');
  let withBorders = 0;
  let withoutBorders = 0;
  let manualReview = 0;
  const results = [];

  for (let i = 0; i < mapping.length; i++) {
    const item = mapping[i];
    const meta = await sharp(item.localSource).metadata();
    const origW = meta.width;
    const origH = meta.height;

    const borders = await detectCoarseBorders(item.localSource, origW, origH);
    const hasBorder = borders.top > 0 || borders.bottom > 0 || borders.left > 0 || borders.right > 0;

    const cropX = borders.left;
    const cropY = borders.top;
    const cropW = origW - borders.left - borders.right;
    const cropH = origH - borders.top - borders.bottom;

    const origArea = origW * origH;
    const croppedArea = cropW * cropH;
    const areaRemovedPct = ((origArea - croppedArea) / origArea) * 100;

    let status = 'NO_CROP_NEEDED';
    if (hasBorder) {
      if (areaRemovedPct > CONFIG.maxCropAreaPercentage * 100 || cropW <= 100 || cropH <= 100) {
        status = 'MANUAL_REVIEW_REQUIRED';
        manualReview++;
      } else {
        status = 'SAFE_TO_CROP';
        withBorders++;
      }
    } else {
      withoutBorders++;
    }

    results.push({
      design: item.design,
      sku: item.sku,
      filename: item.storageMockupName,
      localSource: item.localSource,
      firebaseStoragePath: `products/mockups/${item.storageMockupName}`,
      thumbnailStoragePath: `products/thumbnails/mockups/${path.basename(item.storageMockupName, path.extname(item.storageMockupName))}.webp`,
      origWidth: origW,
      origHeight: origH,
      hasBorder,
      borders,
      crop: { x: cropX, y: cropY, w: cropW, h: cropH },
      areaRemovedPct: parseFloat(areaRemovedPct.toFixed(2)),
      status
    });

    if ((i + 1) % 50 === 0 || i === mapping.length - 1) {
      console.log(`Processed ${i + 1} / ${mapping.length} (with borders: ${withBorders}, clean: ${withoutBorders})`);
    }
  }

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  console.log(`Total Images Audited: ${results.length}`);
  console.log(`SAFE_TO_CROP (has black borders): ${withBorders}`);
  console.log(`NO_CROP_NEEDED (already clean): ${withoutBorders}`);
  console.log(`MANUAL_REVIEW_REQUIRED: ${manualReview}`);

  fs.writeFileSync('scripts/batch2_audit_results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('Saved audit results to scripts/batch2_audit_results.json');
}

runAudit().catch(console.error);
