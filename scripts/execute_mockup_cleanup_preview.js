/**
 * ITACON PRODUCT MOCKUP IMAGE CLEANUP — AUDIT & LOCAL PREVIEW GENERATOR
 * 
 * PHASES IMPLEMENTED:
 * Phase 1: Comprehensive Read-Only Image-Aware Border Detection Audit
 * Phase 2: High-Quality Local Cropped Previews (NO source file overwrites)
 * Phase 3: Preview WebP Thumbnail Generation (Local Only)
 * Phase 4: Visual BEFORE / AFTER Comparison Contact Sheets
 * Phase 5: Verification & Safety Validation
 * 
 * ZERO MODIFICATIONS to:
 * - Production Firebase Storage
 * - Firestore
 * - Firebase Auth
 * - Cloud Functions
 * - Rules
 * - Source original files
 * - Tile faces / Adhesives / Excel
 */

const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PREVIEW_ROOT = path.join(PROJECT_ROOT, 'image_cleanup_preview');
const PREVIEW_FULL_DIR = path.join(PREVIEW_ROOT, 'mockups', 'full');
const PREVIEW_THUMB_DIR = path.join(PREVIEW_ROOT, 'mockups', 'thumbnails');
const CONTACT_SHEET_DIR = path.join(PREVIEW_ROOT, 'contact_sheets');

const SOURCE_GROUPS = [
  {
    sheet: 'Sheet 1',
    dir: path.join(PROJECT_ROOT, 'assets', 'images', 'mockups'),
    firebasePrefix: 'products/mockups/',
    ext: '.jpeg'
  },
  {
    sheet: 'Sheet 2',
    dir: path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet2', 'mockups'),
    firebasePrefix: 'products/mockups/',
    ext: '.jpg'
  },
  {
    sheet: 'Sheet 3',
    dir: path.join(PROJECT_ROOT, 'assets', 'product_import', 'sheet3', 'mockups'),
    firebasePrefix: 'products/mockups/',
    ext: '.jpg'
  }
];

// Configuration & Safety Limits
const CONFIG = {
  nearBlackThreshold: 45,       // Max RGB value considered near-black (0-255)
  edgeBorderStartThreshold: 0.60, // Minimum % of black in edge row/col to be considered border
  inwardRowBlackThreshold: 0.70,  // % black for regular border row
  textRowBlackThreshold: 0.50,    // % black for row containing text inside black strip
  maxLookaheadRows: 6,            // Lookahead rows for text in border
  maxCropAreaPercentage: 0.25,    // 25% max crop area safety limit (exceeding -> MANUAL_REVIEW_REQUIRED)
  thumbWidth: 600,
  thumbHeight: 400,
  thumbQuality: 82
};

function isNearBlack(r, g, b, thresh = CONFIG.nearBlackThreshold) {
  return r <= thresh && g <= thresh && b <= thresh;
}

/**
 * Stage 1: Coarse detection on normalized downscaled image
 */
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
  // Check if first row is border
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
        // Lookahead to verify it is text inside dark strip
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
  let botRows = 0;
  const maxBot = Math.floor(normH * 0.25);
  let rb0Black = 0;
  const bot0Start = (normH - 1) * normW * channels;
  for (let x = 0; x < normW; x++) {
    const idx = bot0Start + x * channels;
    if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) rb0Black++;
  }
  if (rb0Black / normW >= CONFIG.edgeBorderStartThreshold) {
    for (let b = 0; b < maxBot; b++) {
      const y = normH - 1 - b;
      let bCount = 0;
      for (let x = 0; x < normW; x++) {
        const idx = (y * normW + x) * channels;
        if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) bCount++;
      }
      const pct = bCount / normW;
      if (pct >= CONFIG.inwardRowBlackThreshold) {
        botRows = b + 1;
      } else if (pct >= CONFIG.textRowBlackThreshold) {
        let lookAheadFound = false;
        for (let l = 1; l <= CONFIG.maxLookaheadRows && b + l < maxBot; l++) {
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
          botRows = b + 1;
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
  let cl0Black = 0;
  for (let y = 0; y < normH; y++) {
    const idx = (y * normW) * channels;
    if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) cl0Black++;
  }
  if (cl0Black / normH >= CONFIG.edgeBorderStartThreshold) {
    for (let x = 0; x < maxLeft; x++) {
      let bCount = 0;
      for (let y = 0; y < normH; y++) {
        const idx = (y * normW + x) * channels;
        if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) bCount++;
      }
      const pct = bCount / normH;
      if (pct >= CONFIG.inwardRowBlackThreshold) {
        leftCols = x + 1;
      } else {
        break;
      }
    }
  }

  // 4. RIGHT BORDER
  let rightCols = 0;
  const maxRight = Math.floor(normW * 0.20);
  let cr0Black = 0;
  for (let y = 0; y < normH; y++) {
    const idx = (y * normW + (normW - 1)) * channels;
    if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) cr0Black++;
  }
  if (cr0Black / normH >= CONFIG.edgeBorderStartThreshold) {
    for (let r = 0; r < maxRight; r++) {
      const x = normW - 1 - r;
      let bCount = 0;
      for (let y = 0; y < normH; y++) {
        const idx = (y * normW + x) * channels;
        if (isNearBlack(raw[idx], raw[idx+1], raw[idx+2])) bCount++;
      }
      const pct = bCount / normH;
      if (pct >= CONFIG.inwardRowBlackThreshold) {
        rightCols = r + 1;
      } else {
        break;
      }
    }
  }

  return {
    top: Math.round(topRows / scale),
    bottom: Math.round(botRows / scale),
    left: Math.round(leftCols / scale),
    right: Math.round(rightCols / scale)
  };
}

/**
 * Stage 2: Refine border boundary at full resolution with pixel precision
 */
async function refineBordersFullRes(filePath, coarse, origW, origH) {
  let { top, bottom, left, right } = coarse;

  // Refine Top if detected
  if (top > 5) {
    const searchStart = Math.max(0, top - 20);
    const searchHeight = Math.min(origH - searchStart, 40);
    const patch = await sharp(filePath)
      .extract({ left: 0, top: searchStart, width: origW, height: searchHeight })
      .raw()
      .toBuffer();

    let refinedTop = top;
    // Step by rows
    for (let r = 0; r < searchHeight; r++) {
      let blackCount = 0;
      const step = 4; // Sample every 4th pixel for speed
      const totalSamples = Math.floor(origW / step);
      for (let x = 0; x < origW; x += step) {
        const idx = (r * origW + x) * 3;
        if (isNearBlack(patch[idx], patch[idx+1], patch[idx+2])) blackCount++;
      }
      const pct = blackCount / totalSamples;
      if (pct < 0.35) {
        refinedTop = searchStart + r;
        break;
      }
    }
    top = refinedTop;
  }

  // Refine Bottom if detected
  if (bottom > 5) {
    const searchStart = Math.max(0, origH - bottom - 20);
    const searchHeight = Math.min(origH - searchStart, 40);
    const patch = await sharp(filePath)
      .extract({ left: 0, top: searchStart, width: origW, height: searchHeight })
      .raw()
      .toBuffer();

    let refinedBottom = bottom;
    for (let r = searchHeight - 1; r >= 0; r--) {
      let blackCount = 0;
      const step = 4;
      const totalSamples = Math.floor(origW / step);
      for (let x = 0; x < origW; x += step) {
        const idx = (r * origW + x) * 3;
        if (isNearBlack(patch[idx], patch[idx+1], patch[idx+2])) blackCount++;
      }
      const pct = blackCount / totalSamples;
      if (pct < 0.35) {
        refinedBottom = origH - (searchStart + r + 1);
        break;
      }
    }
    bottom = refinedBottom;
  }

  // Refine Left if detected
  if (left > 5) {
    const searchStart = Math.max(0, left - 15);
    const searchWidth = Math.min(origW - searchStart, 30);
    const searchH = Math.min(origH, 1000);
    const patch = await sharp(filePath)
      .extract({ left: searchStart, top: Math.floor((origH - searchH)/2), width: searchWidth, height: searchH })
      .raw()
      .toBuffer();

    let refinedLeft = left;
    for (let c = 0; c < searchWidth; c++) {
      let blackCount = 0;
      for (let y = 0; y < searchH; y += 4) {
        const idx = (y * searchWidth + c) * 3;
        if (isNearBlack(patch[idx], patch[idx+1], patch[idx+2])) blackCount++;
      }
      const pct = blackCount / (searchH / 4);
      if (pct < 0.35) {
        refinedLeft = searchStart + c;
        break;
      }
    }
    left = refinedLeft;
  }

  // Refine Right if detected
  if (right > 5) {
    const searchStart = Math.max(0, origW - right - 15);
    const searchWidth = Math.min(origW - searchStart, 30);
    const searchH = Math.min(origH, 1000);
    const patch = await sharp(filePath)
      .extract({ left: searchStart, top: Math.floor((origH - searchH)/2), width: searchWidth, height: searchH })
      .raw()
      .toBuffer();

    let refinedRight = right;
    for (let c = searchWidth - 1; c >= 0; c--) {
      let blackCount = 0;
      for (let y = 0; y < searchH; y += 4) {
        const idx = (y * searchWidth + c) * 3;
        if (isNearBlack(patch[idx], patch[idx+1], patch[idx+2])) blackCount++;
      }
      const pct = blackCount / (searchH / 4);
      if (pct < 0.35) {
        refinedRight = origW - (searchStart + c + 1);
        break;
      }
    }
    right = refinedRight;
  }

  return { top, bottom, left, right };
}

/**
 * Main execution pipeline
 */
async function main() {
  console.log('======================================================================');
  console.log('ITACON PRODUCT MOCKUP IMAGE CLEANUP — AUDIT & PREVIEW PIPELINE');
  console.log('======================================================================\n');

  // Ensure directories exist
  [PREVIEW_FULL_DIR, PREVIEW_THUMB_DIR, CONTACT_SHEET_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const auditRecords = [];
  const edgeBreakdown = {
    topOnly: 0,
    bottomOnly: 0,
    leftOnly: 0,
    rightOnly: 0,
    topAndBottom: 0,
    allFourEdges: 0,
    topAndSides: 0,
    otherMultiEdge: 0
  };

  let totalImagesScanned = 0;

  for (const group of SOURCE_GROUPS) {
    const files = fs.readdirSync(group.dir).filter(f => !f.startsWith('.'));
    console.log(`Auditing ${group.sheet}: ${files.length} images from ${path.relative(PROJECT_ROOT, group.dir)}...`);

    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const filePath = path.join(group.dir, filename);
      totalImagesScanned++;

      const meta = await sharp(filePath).metadata();
      const origW = meta.width;
      const origH = meta.height;

      // Stage 1: Coarse detection
      const coarse = await detectCoarseBorders(filePath, origW, origH);

      // Stage 2: Fine full-res refinement
      const borders = await refineBordersFullRes(filePath, coarse, origW, origH);

      const hasBorder = borders.top > 0 || borders.bottom > 0 || borders.left > 0 || borders.right > 0;

      // Crop coordinates
      const cropX = borders.left;
      const cropY = borders.top;
      const cropW = origW - borders.left - borders.right;
      const cropH = origH - borders.top - borders.bottom;

      const areaBefore = origW * origH;
      const areaAfter = cropW * cropH;
      const areaRemovedPct = ((areaBefore - areaAfter) / areaBefore) * 100;

      let status = 'NO_CROP_NEEDED';
      let confidence = 1.0;

      if (hasBorder) {
        if (areaRemovedPct > (CONFIG.maxCropAreaPercentage * 100)) {
          status = 'MANUAL_REVIEW_REQUIRED';
          confidence = 0.65;
        } else if (cropW <= 100 || cropH <= 100) {
          status = 'MANUAL_REVIEW_REQUIRED';
          confidence = 0.50;
        } else {
          status = 'SAFE_TO_CROP';
          confidence = 0.98;
        }

        // Breakdown categorization
        const t = borders.top > 0;
        const b = borders.bottom > 0;
        const l = borders.left > 0;
        const r = borders.right > 0;

        if (t && b && l && r) edgeBreakdown.allFourEdges++;
        else if (t && !b && !l && !r) edgeBreakdown.topOnly++;
        else if (!t && b && !l && !r) edgeBreakdown.bottomOnly++;
        else if (t && b && !l && !r) edgeBreakdown.topAndBottom++;
        else if (t && !b && (l || r)) edgeBreakdown.topAndSides++;
        else edgeBreakdown.otherMultiEdge++;
      }

      auditRecords.push({
        sheet: group.sheet,
        sourceDir: path.relative(PROJECT_ROOT, group.dir),
        filename,
        origPath: filePath,
        firebaseStoragePath: `${group.firebasePrefix}${filename}`,
        origWidth: origW,
        origHeight: origH,
        format: meta.format,
        hasBorder,
        borders,
        crop: { x: cropX, y: cropY, w: cropW, h: cropH },
        areaRemovedPct: parseFloat(areaRemovedPct.toFixed(2)),
        confidence,
        status
      });

      if ((i + 1) % 50 === 0 || (i + 1) === files.length) {
        console.log(`  Processed ${i + 1}/${files.length} images...`);
      }
    }
  }

  // Summary counts
  const borderDetectedCount = auditRecords.filter(r => r.hasBorder).length;
  const safeToCropCount = auditRecords.filter(r => r.status === 'SAFE_TO_CROP').length;
  const noCropNeededCount = auditRecords.filter(r => r.status === 'NO_CROP_NEEDED').length;
  const manualReviewCount = auditRecords.filter(r => r.status === 'MANUAL_REVIEW_REQUIRED').length;

  console.log('\n======================================================================');
  console.log('AUDIT RESULTS:');
  console.log(`Total Mockups Scanned:          ${totalImagesScanned}`);
  console.log(`Black Border Detected:          ${borderDetectedCount}`);
  console.log(`SAFE_TO_CROP:                   ${safeToCropCount}`);
  console.log(`NO_CROP_NEEDED:                 ${noCropNeededCount}`);
  console.log(`MANUAL_REVIEW_REQUIRED:         ${manualReviewCount}`);
  console.log('======================================================================\n');

  // Save complete audit manifest
  const auditReportPath = path.join(PREVIEW_ROOT, 'mockup_cleanup_audit.json');
  fs.writeFileSync(auditReportPath, JSON.stringify(auditRecords, null, 2), 'utf8');
  console.log(`Audit saved to ${auditReportPath}`);

  // PHASE 2: Generate Local Cropped Previews for SAFE_TO_CROP images
  console.log('\n======================================================================');
  console.log('PHASE 2: GENERATING LOCAL CROPPED PREVIEWS (SAFE_TO_CROP ONLY)');
  console.log('======================================================================');

  const safeImages = auditRecords.filter(r => r.status === 'SAFE_TO_CROP');
  let previewsGenerated = 0;
  let thumbnailsGenerated = 0;

  for (let i = 0; i < safeImages.length; i++) {
    const item = safeImages[i];
    const previewOutPath = path.join(PREVIEW_FULL_DIR, item.filename);
    const thumbFilename = `${path.basename(item.filename, path.extname(item.filename))}.webp`;
    const thumbOutPath = path.join(PREVIEW_THUMB_DIR, thumbFilename);

    // 1. Crop full-res image
    await sharp(item.origPath)
      .extract({
        left: item.crop.x,
        top: item.crop.y,
        width: item.crop.w,
        height: item.crop.h
      })
      .toFile(previewOutPath);

    previewsGenerated++;

    // 2. Generate local preview WebP thumbnail (600x400)
    await sharp(previewOutPath)
      .resize({
        width: CONFIG.thumbWidth,
        height: CONFIG.thumbHeight,
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: CONFIG.thumbQuality, effort: 4 })
      .toFile(thumbOutPath);

    thumbnailsGenerated++;

    if ((i + 1) % 50 === 0 || (i + 1) === safeImages.length) {
      console.log(`  Generated preview ${i + 1}/${safeImages.length}...`);
    }
  }

  console.log(`\nGenerated ${previewsGenerated} full-res cleaned previews in ${PREVIEW_FULL_DIR}`);
  console.log(`Generated ${thumbnailsGenerated} preview WebP thumbnails in ${PREVIEW_THUMB_DIR}`);

  // PHASE 3: Generate Visual BEFORE / AFTER Comparison Contact Sheets
  console.log('\n======================================================================');
  console.log('PHASE 3: GENERATING BEFORE / AFTER CONTACT SHEETS');
  console.log('======================================================================');

  const contactSheetPaths = await generateContactSheets(safeImages);

  console.log(`\nContact Sheets Generated: ${contactSheetPaths.length} sheets`);
  contactSheetPaths.forEach(p => console.log(`  - ${p}`));

  // PHASE 4: Validation & Integrity Checks
  console.log('\n======================================================================');
  console.log('PHASE 4: VALIDATION OF PREVIEWS');
  console.log('======================================================================');

  let validationPassed = 0;
  let validationFailed = 0;

  for (const item of safeImages) {
    const previewPath = path.join(PREVIEW_FULL_DIR, item.filename);
    try {
      const stat = fs.statSync(previewPath);
      if (stat.size <= 0) throw new Error('Zero byte file');

      const meta = await sharp(previewPath).metadata();
      if (meta.width !== item.crop.w || meta.height !== item.crop.h) {
        throw new Error(`Dimension mismatch: expected ${item.crop.w}x${item.crop.h}, got ${meta.width}x${meta.height}`);
      }

      // Check crop stays inside bounds
      if (item.crop.x < 0 || item.crop.y < 0 ||
          item.crop.x + item.crop.w > item.origWidth ||
          item.crop.y + item.crop.h > item.origHeight) {
        throw new Error('Crop rectangle out of bounds');
      }

      validationPassed++;
    } catch (err) {
      console.error(`Validation failed for ${item.filename}: ${err.message}`);
      validationFailed++;
    }
  }

  console.log(`Validation Passed: ${validationPassed}/${safeImages.length}`);
  console.log(`Validation Failed: ${validationFailed}`);

  return {
    totalImagesScanned,
    borderDetectedCount,
    safeToCropCount,
    noCropNeededCount,
    manualReviewCount,
    edgeBreakdown,
    previewsGenerated,
    thumbnailsGenerated,
    contactSheetPaths,
    validationPassed
  };
}

/**
 * Generate Visual Contact Sheets (HTML & Image pairs)
 */
async function generateContactSheets(safeImages) {
  // Let's create visual contact sheets in batches of 16 images per sheet
  // 4 rows x 4 items (each item has ORIGINAL and CLEANED side by side)
  const ITEMS_PER_SHEET = 12;
  const totalSheets = Math.ceil(safeImages.length / ITEMS_PER_SHEET);
  const sheetPaths = [];

  const ITEM_IMG_W = 320;
  const ITEM_IMG_H = 210;
  const ITEM_CARD_W = ITEM_IMG_W * 2 + 30; // 670px
  const ITEM_CARD_H = ITEM_IMG_H + 85;     // 295px

  const COLS = 2;
  const ROWS = 6;
  const CANVAS_W = COLS * ITEM_CARD_W + 60; // 1400px
  const CANVAS_H = ROWS * ITEM_CARD_H + 120; // 1890px

  for (let s = 0; s < totalSheets; s++) {
    const sheetNum = String(s + 1).padStart(2, '0');
    const startIdx = s * ITEMS_PER_SHEET;
    const endIdx = Math.min(startIdx + ITEMS_PER_SHEET, safeImages.length);
    const sheetItems = safeImages.slice(startIdx, endIdx);

    const sheetOutName = `contact_sheet_${sheetNum}.jpg`;
    const sheetOutPath = path.join(CONTACT_SHEET_DIR, sheetOutName);

    // Build SVG tiles or Sharp composite
    const composites = [];

    // Header background & title
    const headerSvg = `
      <svg width="${CANVAS_W}" height="100">
        <rect width="${CANVAS_W}" height="100" fill="#0A1128"/>
        <text x="30" y="45" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF">
          ITACON PRODUCT MOCKUP CLEANUP — CONTACT SHEET ${sheetNum} OF ${String(totalSheets).padStart(2, '0')}
        </text>
        <text x="30" y="75" font-family="Arial, sans-serif" font-size="14" fill="#90CDF4">
          Showing items ${startIdx + 1} to ${endIdx} of ${safeImages.length} SAFE_TO_CROP mockups (BEFORE: Left | AFTER: Right)
        </text>
      </svg>
    `;
    composites.push({
      input: Buffer.from(headerSvg),
      top: 0,
      left: 0
    });

    for (let i = 0; i < sheetItems.length; i++) {
      const item = sheetItems[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const cardLeft = 30 + col * (ITEM_CARD_W + 20);
      const cardTop = 110 + row * ITEM_CARD_H;

      // 1. Resize original preview thumbnail for contact sheet
      const origThumbBuf = await sharp(item.origPath)
        .resize(ITEM_IMG_W, ITEM_IMG_H, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85 })
        .toBuffer();

      // 2. Resize cleaned preview thumbnail for contact sheet
      const cleanedFull = path.join(PREVIEW_FULL_DIR, item.filename);
      const cleanedThumbBuf = await sharp(cleanedFull)
        .resize(ITEM_IMG_W, ITEM_IMG_H, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Card metadata SVG overlay
      const metaSvg = `
        <svg width="${ITEM_CARD_W}" height="${ITEM_CARD_H}">
          <!-- Card border & background -->
          <rect width="${ITEM_CARD_W}" height="${ITEM_CARD_H}" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
          
          <!-- Before tag -->
          <rect x="10" y="10" width="75" height="22" rx="4" fill="#E53E3E"/>
          <text x="16" y="25" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">BEFORE</text>
          
          <!-- After tag -->
          <rect x="${ITEM_IMG_W + 20}" y="10" width="75" height="22" rx="4" fill="#38A169"/>
          <text x="${ITEM_IMG_W + 26}" y="25" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">CLEANED</text>
          
          <!-- Metadata footer -->
          <text x="15" y="${ITEM_IMG_H + 48}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1A202C">
            ${escapeXml(item.filename)}
          </text>
          <text x="15" y="${ITEM_IMG_H + 68}" font-family="Arial, sans-serif" font-size="11" fill="#4A5568">
            Before: ${item.origWidth}x${item.origHeight} | After: ${item.crop.w}x${item.crop.h} (-${item.areaRemovedPct}%) | Edges: T:${item.borders.top} B:${item.borders.bottom} L:${item.borders.left} R:${item.borders.right}
          </text>
        </svg>
      `;

      composites.push({
        input: Buffer.from(metaSvg),
        top: cardTop,
        left: cardLeft
      });

      // Original image
      composites.push({
        input: origThumbBuf,
        top: cardTop + 36,
        left: cardLeft + 10
      });

      // Cleaned image
      composites.push({
        input: cleanedThumbBuf,
        top: cardTop + 36,
        left: cardLeft + ITEM_IMG_W + 20
      });
    }

    // Render entire contact sheet
    await sharp({
      create: {
        width: CANVAS_W,
        height: CANVAS_H,
        channels: 3,
        background: { r: 241, g: 245, b: 249 }
      }
    })
      .composite(composites)
      .jpeg({ quality: 88 })
      .toFile(sheetOutPath);

    sheetPaths.push(path.relative(PROJECT_ROOT, sheetOutPath));
    console.log(`  Rendered contact sheet ${sheetNum}/${totalSheets}: ${sheetOutName}`);
  }

  // Also generate an interactive HTML preview index for instant in-browser inspection!
  const htmlIndexContent = generateHtmlPreviewIndex(safeImages, totalSheets);
  const htmlPath = path.join(PREVIEW_ROOT, 'index.html');
  fs.writeFileSync(htmlPath, htmlIndexContent, 'utf8');
  console.log(`Generated interactive HTML inspection portal: ${htmlPath}`);

  return sheetPaths;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateHtmlPreviewIndex(safeImages, totalSheets) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ITACON Mockup Cleanup — Before & After Inspection</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    h1 { color: #38bdf8; margin-bottom: 4px; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .sheet-nav { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
    .sheet-nav a { background: #1e293b; color: #38bdf8; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; border: 1px solid #334155; }
    .sheet-nav a:hover { background: #38bdf8; color: #0f172a; }
    .sheet-container { display: flex; flex-direction: column; gap: 32px; }
    .sheet-img { width: 100%; max-width: 1300px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
  </style>
</head>
<body>
  <h1>ITACON Product Mockup Cleanup — Visual Contact Sheets</h1>
  <div class="subtitle">Side-by-side BEFORE / AFTER inspection for all ${safeImages.length} SAFE_TO_CROP mockups across Sheet 1, Sheet 2, and Sheet 3.</div>
  <div class="sheet-nav">
    ${Array.from({ length: totalSheets }, (_, i) => `<a href="#sheet-${i+1}">Sheet ${String(i+1).padStart(2, '0')}</a>`).join('')}
  </div>
  <div class="sheet-container">
    ${Array.from({ length: totalSheets }, (_, i) => `
      <div id="sheet-${i+1}">
        <h2 style="color: #cbd5e1; font-size: 18px; margin-bottom: 8px;">Contact Sheet ${String(i+1).padStart(2, '0')} of ${String(totalSheets).padStart(2, '0')}</h2>
        <img class="sheet-img" src="contact_sheets/contact_sheet_${String(i+1).padStart(2, '0')}.jpg" alt="Contact Sheet ${i+1}">
      </div>
    `).join('')}
  </div>
</body>
</html>`;
}

main().catch(console.error);
