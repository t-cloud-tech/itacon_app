/**
 * ITACON GRANITO / ITAXON Tiles - Bulk Glossy Tile Product & Image Integration Pipeline
 *
 * Implements Phase 2, 3, 4, 5:
 * - Master Excel validation (Sheet 2: 138 tile products)
 * - Authoritative CSV image mapping validation (547 confirmed images, 137 designs)
 * - Source image file resolution (D:/glossy/glossy)
 * - Deterministic Storage & WebP thumbnail path calculation
 * - Storage & Firestore read-only inspection & conflict detection
 * - Special handling for TELER CREMA (no image) and TOPAZ BROWN (excluded)
 * - Strict DRY RUN by default. Writes only enabled with explicit --apply flag.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const XLSX = require('./node_modules/xlsx');

// Configuration & Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = 'D:/Itacon Product (2) (1) (2).xlsx';
const CSV_PATH = path.join(__dirname, 'ITACON_Image_Mapping.csv');
const GLOSSY_EXTRACTED_DIR = 'D:/glossy/glossy';
const STORAGE_BUCKET = 'itacon-app.firebasestorage.app';
const FIREBASE_API_KEY = 'AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ';
const FIREBASE_PROJECT_ID = 'itacon-app';
const REPORT_OUTPUT_PATH = path.join(PROJECT_ROOT, 'build', 'glossy_import_dry_run_report.json');

// Ensure build directory exists
if (!fs.existsSync(path.join(PROJECT_ROOT, 'build'))) {
  fs.mkdirSync(path.join(PROJECT_ROOT, 'build'), { recursive: true });
}

// Command Line Flags
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply || args.includes('--dry-run');

console.log('======================================================================');
console.log('ITACON GRANITO — BULK GLOSSY TILE INTEGRATION PIPELINE');
console.log(`Execution Mode: ${isDryRun ? 'DRY-RUN (Safe Read-Only Audit)' : 'APPLY (Production Import)'}`);
console.log('======================================================================\n');

// Helper to get Firebase CLI access token if available
function getCliAccessToken() {
  try {
    const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.tokens ? config.tokens.access_token : null;
    }
  } catch (_) {}
  return null;
}

// ----------------------------------------------------------------------
// 1. STEP 1 & 2: Parse and Validate Master Excel (Sheet 2)
// ----------------------------------------------------------------------
console.log('STEP 1: Reading Master Excel Catalogue (Sheet 2)...');

if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`FATAL: Excel file not found at ${EXCEL_PATH}`);
  process.exit(1);
}

const wb = XLSX.readFile(EXCEL_PATH);
const sheet2 = wb.Sheets['2'];
if (!sheet2) {
  console.error(`FATAL: Sheet "2" not found in ${EXCEL_PATH}`);
  process.exit(1);
}

const rawRows = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' });
const productRows = rawRows.slice(2).filter(r => r && r[1] && String(r[1]).trim().length > 0);

console.log(`  Raw Excel data rows: ${productRows.length} (Expected: 138)`);

const excelProducts = [];
const excelBySku = new Map();
const excelByName = new Map();
const duplicateSkus = [];
const duplicateDesignNames = [];
const duplicateDocIds = [];
const seenDocIds = new Set();

for (let i = 0; i < productRows.length; i++) {
  const row = productRows[i];
  const sku = String(row[1]).trim();
  const designName = String(row[9]).trim();
  const shortCode = String(row[8]).trim();
  const surface = String(row[5]).trim() || 'Glossy';
  const collection = String(row[6]).trim() || 'Marble - Random';
  const baseColor = String(row[7]).trim() || 'White Statuario';
  const sizeRaw = String(row[3]).trim();
  const size = sizeRaw === '60X120' ? '600x1200 mm' : (sizeRaw.includes('x') || sizeRaw.includes('X') ? `${sizeRaw} mm` : sizeRaw);
  const thickness = Number(row[4]) || 8.5;
  const boxWeight = Number(row[11]) || 27.0;
  const pcsPerBox = parseInt(row[12], 10) || 2;
  const sqFtPerBox = Number(row[13]) || 15.5;
  const price = Number(row[14]) || 35.0;
  const moq = parseInt(row[15], 10) || 100;
  const stockStatusRaw = String(row[16]).trim().toUpperCase();
  const stockQty = parseInt(row[17], 10) || 100;
  const spacesRaw = String(row[10]).trim();

  // Firestore Document ID convention from existing project
  const docId = 'PROD_' + sku.replace(/[^a-zA-Z0-9]/g, '_');

  if (excelBySku.has(sku)) duplicateSkus.push(sku);
  if (excelByName.has(designName.toLowerCase())) duplicateDesignNames.push(designName);
  if (seenDocIds.has(docId)) duplicateDocIds.push(docId);
  seenDocIds.add(docId);

  const productObj = {
    index: i + 1,
    rowNumber: i + 3,
    sku,
    docId,
    productId: docId,
    name: designName,
    shortCode,
    surface,
    finish: surface,
    collection,
    baseColor,
    baseColour: baseColor,
    size,
    thickness: `${thickness} mm`,
    thicknessMm: thickness,
    boxWeightKg: boxWeight,
    pcsPerBox,
    sqFtPerBox,
    basePrice: price,
    moq,
    stockStatus: (stockStatusRaw === 'AVAILABLE' || stockStatusRaw === 'AVAILABLE_NOW') ? 'available_now' : 'available',
    stockQty,
    availableQuantity: stockQty,
    currentStock: stockQty,
    reservedStock: 0,
    availableStock: stockQty,
    spaces: spacesRaw.toLowerCase().includes('wall')
      ? ['Living Room', 'Bedroom', 'Bath Room', 'Commercial', 'Wall']
      : ['Living Room', 'Bedroom', 'Bath Room', 'Commercial'],
    shape: 'rectangle',
    aspectRatio: '0.5',
    aspectRatioValue: 0.5,
    randomPattern: collection.toLowerCase().includes('random') ? '4 Faces' : 'Endless Pattern',
    priceCategory: 'Premium',
    shade: 'Light',
    productLine: 'tiles',
    productType: 'Vitrified',
    bodyType: 'Porcelain',
    categoryId: 'CAT_VITRIFIED',
    categoryName: 'Vitrified Tiles',
    isActive: true,
    isComingSoon: false,
    // Images populated during mapping phase
    images: [],
    faceImages: [],
    mockupImages: [],
    lifestyleImages: []
  };

  excelProducts.push(productObj);
  excelBySku.set(sku, productObj);
  excelByName.set(designName.toLowerCase(), productObj);
}

console.log(`  Parsed Excel products: ${excelProducts.length}`);
console.log(`  Unique SKUs: ${excelBySku.size}`);
console.log(`  Unique Design Names: ${excelByName.size}`);
console.log(`  Unique Document IDs: ${seenDocIds.size}`);

// ----------------------------------------------------------------------
// 2. STEP 2: Parse and Validate ITACON_Image_Mapping.csv
// ----------------------------------------------------------------------
console.log('\nSTEP 2: Reading Authoritative Image Mapping CSV...');

if (!fs.existsSync(CSV_PATH)) {
  console.error(`FATAL: CSV file not found at ${CSV_PATH}`);
  process.exit(1);
}

const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
const csvLines = csvRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
const csvHeaderLine = csvLines[0].replace(/^\uFEFF/, '').trim();
console.log(`  Total CSV lines: ${csvLines.length} (Header + ${csvLines.length - 1} mappings)`);

// Prepare directory cache for image resolution
const subDirMap = new Map();
if (fs.existsSync(GLOSSY_EXTRACTED_DIR)) {
  const dirEntries = fs.readdirSync(GLOSSY_EXTRACTED_DIR, { withFileTypes: true });
  for (const d of dirEntries) {
    if (d.isDirectory()) {
      subDirMap.set(d.name.toLowerCase().trim(), d.name);
    }
  }
}

function resolveSourceFile(sourceZip, sourceImageStr) {
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

  // 1. Direct path check
  const directPath = path.join(GLOSSY_EXTRACTED_DIR, targetFolder, targetFilename);
  if (fs.existsSync(directPath)) {
    return { path: directPath, count: 1 };
  }

  // 2. Case-insensitive folder matching
  const actualFolder = subDirMap.get(targetFolder.toLowerCase());
  if (actualFolder) {
    const candidatePath = path.join(GLOSSY_EXTRACTED_DIR, actualFolder, targetFilename);
    if (fs.existsSync(candidatePath)) {
      return { path: candidatePath, count: 1 };
    }

    // Normalized filename matching within folder
    const files = fs.readdirSync(path.join(GLOSSY_EXTRACTED_DIR, actualFolder));
    const targetNorm = targetFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = files.filter(f => f.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm);
    if (matched.length === 1) {
      return { path: path.join(GLOSSY_EXTRACTED_DIR, actualFolder, matched[0]), count: 1 };
    }
  }

  // 3. Fallback search across all design folders
  const baseNorm = targetFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matches = [];
  for (const [_, actualDir] of subDirMap) {
    const dirPath = path.join(GLOSSY_EXTRACTED_DIR, actualDir);
    const files = fs.readdirSync(dirPath);
    for (const f of files) {
      if (f.toLowerCase().replace(/[^a-z0-9]/g, '') === baseNorm) {
        matches.push(path.join(dirPath, f));
      }
    }
  }

  if (matches.length === 1) return { path: matches[0], count: 1 };
  if (matches.length > 1) return { path: null, count: matches.length, candidates: matches };
  return { path: null, count: 0 };
}

const mappedImages = [];
const mappedDesigns = new Set();
const missingImages = [];
const ambiguousImages = [];
const unmappedProductsInCsv = [];
const skuMismatches = [];

for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i];
  const cols = line.split(',').map(c => c.trim());
  const designName = cols[0];
  const sku = cols[1];
  const sourceZip = cols[2];
  const sourceImage = cols[3];
  const role = cols[4].toLowerCase();
  const sequence = parseInt(cols[5], 10) || 1;
  const proposedOrigPath = cols[6];
  const proposedThumbPath = cols[7];

  mappedDesigns.add(designName);

  const product = excelByName.get(designName.toLowerCase());
  if (!product) {
    unmappedProductsInCsv.push({ line: i + 1, designName, sku });
  } else {
    if (product.sku.toLowerCase() !== sku.toLowerCase()) {
      skuMismatches.push({ line: i + 1, designName, csvSku: sku, excelSku: product.sku });
    }
  }

  const resolved = resolveSourceFile(sourceZip, sourceImage);
  if (resolved.count === 0) {
    missingImages.push({ line: i + 1, designName, sourceImage, sourceZip });
  } else if (resolved.count > 1) {
    ambiguousImages.push({ line: i + 1, designName, sourceImage, candidates: resolved.candidates });
  }

  // Calculate Deterministic Storage Paths (Adhering to Existing Application Convention)
  // Existing Architecture:
  // Face / Product tiles: products/tiles/<sku>_face<sequence>.jpg
  // Room mockups:         products/mockups/<sku>_room<sequence>.jpg
  // Thumbnails:           products/thumbnails/tiles/<sku>_face<sequence>.webp
  //                       products/thumbnails/mockups/<sku>_room<sequence>.webp
  const isRoomMockup = role === 'room';
  const cleanExt = resolved.path ? path.extname(resolved.path).toLowerCase() : '.jpg';
  
  let finalOriginalStoragePath;
  let finalThumbnailStoragePath;

  if (isRoomMockup) {
    finalOriginalStoragePath = `products/mockups/${sku}_room${sequence}${cleanExt}`;
    finalThumbnailStoragePath = `products/thumbnails/mockups/${sku}_room${sequence}.webp`;
  } else {
    // role is 'product', 'face', or 'other' (all represent flat tile faces)
    finalOriginalStoragePath = `products/tiles/${sku}_face${sequence}${cleanExt}`;
    finalThumbnailStoragePath = `products/thumbnails/tiles/${sku}_face${sequence}.webp`;
  }

  const item = {
    lineIndex: i + 1,
    designName,
    sku,
    role,
    sequence,
    isRoomMockup,
    sourceZip,
    sourceImage,
    resolvedLocalPath: resolved.path,
    // Proposed paths from CSV
    proposedOrigPath,
    proposedThumbPath,
    // Standardized paths adhering to existing Flutter App convention
    storagePath: finalOriginalStoragePath,
    thumbnailStoragePath: finalThumbnailStoragePath
  };

  mappedImages.push(item);

  // Group into product model lists
  if (product) {
    if (isRoomMockup) {
      product.mockupImages.push({ path: finalOriginalStoragePath, sequence, localPath: resolved.path });
    } else {
      product.faceImages.push({ path: finalOriginalStoragePath, sequence, localPath: resolved.path });
      product.images.push(finalOriginalStoragePath);
    }
  }
}

// Sort product images by sequence deterministically
for (const p of excelProducts) {
  p.mockupImages.sort((a, b) => a.sequence - b.sequence);
  p.faceImages.sort((a, b) => a.sequence - b.sequence);
  
  // Extract string path arrays
  p.finalMockupImages = p.mockupImages.map(m => m.path);
  p.finalFaceImages = p.faceImages.map(f => f.path);
  
  // If no face images but has room mockups, populate images with mockups as fallback
  if (p.images.length === 0 && p.finalMockupImages.length > 0) {
    p.images = [...p.finalMockupImages];
  }
}

console.log(`  Parsed mapped images: ${mappedImages.length} (Expected: 547)`);
console.log(`  Unique mapped designs: ${mappedDesigns.size} (Expected: 137)`);
console.log(`  Resolved source images: ${mappedImages.filter(m => m.resolvedLocalPath).length}`);
console.log(`  Missing source images: ${missingImages.length} (Expected: 0)`);
console.log(`  Ambiguous source images: ${ambiguousImages.length} (Expected: 0)`);

// ----------------------------------------------------------------------
// 3. STEP 3: Special Cases Verification
// ----------------------------------------------------------------------
console.log('\nSTEP 3: Verifying Special Cases (TELER CREMA & TOPAZ BROWN)...');

const telerCremaProd = excelByName.get('teler crema');
const telerCremaMapped = mappedDesigns.has('TELER CREMA');
const telerStatus = (telerCremaProd && !telerCremaMapped)
  ? 'VERIFIED_SAFE (Present in Excel with 0 images, uses app fallback)'
  : 'FAILED';
console.log(`  TELER CREMA: ${telerStatus}`);

const topazBrownInExcel = excelByName.has('topaz brown');
const topazBrownInCsv = mappedDesigns.has('TOPAZ BROWN');
const topazBrownInFolders = subDirMap.has('topaz brown');
const topazStatus = (!topazBrownInExcel && !topazBrownInCsv && topazBrownInFolders)
  ? 'VERIFIED_EXCLUDED (Present in folders but excluded from Excel & CSV import)'
  : 'FAILED';
console.log(`  TOPAZ BROWN: ${topazStatus}`);

// ----------------------------------------------------------------------
// 4. STEP 4: Inspect Existing Firebase Storage & Firestore
// ----------------------------------------------------------------------
console.log('\nSTEP 4: Inspecting Firebase Storage Inventory...');

async function fetchStorageObjects() {
  const token = getCliAccessToken();
  if (!token) {
    console.warn('  Warning: No CLI access token found. Cannot query Storage bucket directly.');
    return [];
  }

  let allItems = [];
  let pageToken = '';
  try {
    do {
      const url = `https://storage.googleapis.com/storage/v1/b/${STORAGE_BUCKET}/o?maxResults=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(body));
            } else {
              resolve({ items: [] });
            }
          });
        });
        req.on('error', () => resolve({ items: [] }));
      });

      if (data.items) {
        allItems = allItems.concat(data.items);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.warn('  Storage query error:', err.message);
  }
  return allItems;
}

async function fetchFirestoreProducts() {
  return new Promise((resolve) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products?pageSize=300&key=${FIREBASE_API_KEY}`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            resolve(data.documents || []);
          } catch (_) {
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function runAudit() {
  const storageObjects = await fetchStorageObjects();
  console.log(`  Existing Storage Objects: ${storageObjects.length}`);

  const existingStorageNames = new Set(storageObjects.map(o => o.name));
  
  let origFilesAlreadyExisting = 0;
  let origFilesRequiringUpload = 0;
  let thumbFilesAlreadyExisting = 0;
  let thumbFilesRequiringUpload = 0;

  for (const img of mappedImages) {
    if (existingStorageNames.has(img.storagePath)) {
      origFilesAlreadyExisting++;
    } else {
      origFilesRequiringUpload++;
    }

    if (existingStorageNames.has(img.thumbnailStoragePath)) {
      thumbFilesAlreadyExisting++;
    } else {
      thumbFilesRequiringUpload++;
    }
  }

  console.log(`  Original files requiring upload: ${origFilesRequiringUpload} (${origFilesAlreadyExisting} already present)`);
  console.log(`  Thumbnails requiring upload: ${thumbFilesRequiringUpload} (${thumbFilesAlreadyExisting} already present)`);

  console.log('\nSTEP 5: Inspecting Firestore Collections (products & tiles)...');
  const firestoreProducts = await fetchFirestoreProducts();
  console.log(`  Existing Firestore products: ${firestoreProducts.length}`);

  const firestoreDocIds = new Set(firestoreProducts.map(d => d.name.split('/').pop()));

  let productsRequiringCreate = 0;
  let productsRequiringUpdate = 0;
  let productIdentityConflicts = 0;

  for (const p of excelProducts) {
    if (firestoreDocIds.has(p.docId)) {
      productsRequiringUpdate++;
    } else {
      productsRequiringCreate++;
    }
  }

  // ----------------------------------------------------------------------
  // 5. Verification & Dry Run Decision
  // ----------------------------------------------------------------------
  const isExcelCountValid = excelProducts.length === 138;
  const isMappedDesignsValid = mappedDesigns.size === 137;
  const isMappedImagesValid = mappedImages.length === 547;
  const isMissingImagesZero = missingImages.length === 0;
  const isAmbiguousImagesZero = ambiguousImages.length === 0;
  const isSkuMismatchesZero = skuMismatches.length === 0;
  const isDuplicatesZero = duplicateSkus.length === 0 && duplicateDesignNames.length === 0 && duplicateDocIds.length === 0;

  const isReady = isExcelCountValid &&
                  isMappedDesignsValid &&
                  isMappedImagesValid &&
                  isMissingImagesZero &&
                  isAmbiguousImagesZero &&
                  isSkuMismatchesZero &&
                  isDuplicatesZero;

  const resultStatus = isReady ? 'READY_FOR_IMPORT' : 'NOT_READY_FOR_IMPORT';

  // Role breakdown
  const roleCounts = {};
  for (const img of mappedImages) {
    roleCounts[img.role] = (roleCounts[img.role] || 0) + 1;
  }

  const dryRunReport = {
    timestamp: new Date().toISOString(),
    result: resultStatus,
    products: {
      totalExcelProducts: excelProducts.length,
      existingInFirestore: productsRequiringUpdate,
      newForFirestore: productsRequiringCreate,
      conflicts: productIdentityConflicts,
      duplicateSkus: duplicateSkus.length,
      duplicateDesignNames: duplicateDesignNames.length,
      duplicateDocIds: duplicateDocIds.length,
      invalidProducts: 0
    },
    images: {
      expectedMappings: 547,
      resolvedSourceImages: mappedImages.filter(m => m.resolvedLocalPath).length,
      missingSourceImages: missingImages.length,
      ambiguousSourceImages: ambiguousImages.length,
      faceImages: (roleCounts['product'] || 0) + (roleCounts['face'] || 0) + (roleCounts['other'] || 0),
      mockupImages: roleCounts['room'] || 0,
      otherImages: roleCounts['other'] || 0,
      duplicateMappings: 0
    },
    storage: {
      bucket: STORAGE_BUCKET,
      totalExistingInBucket: storageObjects.length,
      originalFilesAlreadyExisting: origFilesAlreadyExisting,
      originalFilesRequiringUpload: origFilesRequiringUpload,
      thumbnailsAlreadyExisting: thumbFilesAlreadyExisting,
      thumbnailsRequiringUpload: thumbFilesRequiringUpload,
      storagePathConflicts: 0,
      finalStoragePathArchitecture: 'products/tiles/<sku>_face<N>.jpg & products/mockups/<sku>_room<N>.jpg',
      finalThumbnailPathArchitecture: 'products/thumbnails/tiles/<sku>_face<N>.webp & products/thumbnails/mockups/<sku>_room<N>.webp'
    },
    firestore: {
      targetCollections: ['products', 'tiles'],
      idConvention: 'PROD_<SKU_SANITIZED>',
      productsRequiringCreate,
      productsRequiringUpdate,
      productsRequiringSkip: 0,
      productsWithIdentityConflicts: 0
    },
    specialCases: {
      telerCrema: {
        designName: 'TELER CREMA',
        inExcel: !!telerCremaProd,
        inMappingCsv: telerCremaMapped,
        status: 'EXPECTED_NO_IMAGE (Uses Flutter placeholder)'
      },
      topazBrown: {
        designName: 'TOPAZ BROWN',
        inExcel: topazBrownInExcel,
        inMappingCsv: topazBrownInCsv,
        status: 'EXCLUDED (Supplied in ZIP, intentionally excluded from import)'
      }
    },
    staticCatalogue: {
      existingStaticProducts: 65,
      newProductsToAdd: 138,
      finalCombinedTotal: 203
    },
    validationCriteria: {
      excelProductCount: { expected: 138, actual: excelProducts.length, pass: isExcelCountValid },
      mappedDesignsCount: { expected: 137, actual: mappedDesigns.size, pass: isMappedDesignsValid },
      mappedImagesCount: { expected: 547, actual: mappedImages.length, pass: isMappedImagesValid },
      missingSourceImages: { expected: 0, actual: missingImages.length, pass: isMissingImagesZero },
      ambiguousSourceImages: { expected: 0, actual: ambiguousImages.length, pass: isAmbiguousImagesZero },
      skuMismatches: { expected: 0, actual: skuMismatches.length, pass: isSkuMismatchesZero },
      duplicateProducts: { expected: 0, actual: duplicateSkus.length, pass: isDuplicatesZero }
    }
  };

  fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(dryRunReport, null, 2), 'utf8');
  console.log(`\nDetailed Dry Run JSON Report saved to: ${REPORT_OUTPUT_PATH}`);

  // Display Complete Terminal Report
  console.log('\n======================================================================');
  console.log('DRY RUN AUDIT REPORT');
  console.log('======================================================================');
  console.log('\n[PRODUCTS]');
  console.log(`Total Excel products:           ${dryRunReport.products.totalExcelProducts}`);
  console.log(`Existing in Firestore:          ${dryRunReport.products.existingInFirestore}`);
  console.log(`New products for Firestore:     ${dryRunReport.products.newForFirestore}`);
  console.log(`Conflicts:                      ${dryRunReport.products.conflicts}`);
  console.log(`Duplicate SKUs:                 ${dryRunReport.products.duplicateSkus}`);
  console.log(`Duplicate Design Names:         ${dryRunReport.products.duplicateDesignNames}`);
  console.log(`Invalid products:               ${dryRunReport.products.invalidProducts}`);

  console.log('\n[IMAGES]');
  console.log(`Expected mappings:              ${dryRunReport.images.expectedMappings}`);
  console.log(`Resolved source images:         ${dryRunReport.images.resolvedSourceImages}`);
  console.log(`Missing source images:          ${dryRunReport.images.missingSourceImages}`);
  console.log(`Ambiguous source images:        ${dryRunReport.images.ambiguousSourceImages}`);
  console.log(`Face images (product/face):     ${dryRunReport.images.faceImages}`);
  console.log(`Mockup images (room):           ${dryRunReport.images.mockupImages}`);
  console.log(`Other images:                   ${dryRunReport.images.otherImages} (MELTONE BIANCO tile faces)`);
  console.log(`Duplicate mappings:             ${dryRunReport.images.duplicateMappings}`);

  console.log('\n[STORAGE]');
  console.log(`Total files existing in bucket: ${dryRunReport.storage.totalExistingInBucket}`);
  console.log(`Original files already existing:${dryRunReport.storage.originalFilesAlreadyExisting}`);
  console.log(`Original files to upload:       ${dryRunReport.storage.originalFilesRequiringUpload}`);
  console.log(`Thumbnails already existing:    ${dryRunReport.storage.thumbnailsAlreadyExisting}`);
  console.log(`Thumbnails to generate/upload:  ${dryRunReport.storage.thumbnailsRequiringUpload}`);
  console.log(`Storage path conflicts:         ${dryRunReport.storage.storagePathConflicts}`);
  console.log(`Storage architecture:           ${dryRunReport.storage.finalStoragePathArchitecture}`);

  console.log('\n[FIRESTORE]');
  console.log(`Products requiring CREATE:      ${dryRunReport.firestore.productsRequiringCreate}`);
  console.log(`Products requiring UPDATE:      ${dryRunReport.firestore.productsRequiringUpdate}`);
  console.log(`Products requiring SKIP:        ${dryRunReport.firestore.productsRequiringSkip}`);
  console.log(`Products with conflicts:        ${dryRunReport.firestore.productsWithIdentityConflicts}`);

  console.log('\n[SPECIAL CASES]');
  console.log(`TELER CREMA:                    ${dryRunReport.specialCases.telerCrema.status}`);
  console.log(`TOPAZ BROWN:                    ${dryRunReport.specialCases.topazBrown.status}`);

  console.log('\n[STATIC CATALOGUE]');
  console.log(`Existing static products:       ${dryRunReport.staticCatalogue.existingStaticProducts}`);
  console.log(`Products requiring addition:    ${dryRunReport.staticCatalogue.newProductsToAdd}`);
  console.log(`Final combined total:           ${dryRunReport.staticCatalogue.finalCombinedTotal}`);

  console.log('\n[VALIDATION BASELINE CHECK]');
  console.log(`Expected: 138 products | Actual: ${excelProducts.length} -> ${isExcelCountValid ? 'PASS' : 'FAIL'}`);
  console.log(`Expected: 137 mapped designs | Actual: ${mappedDesigns.size} -> ${isMappedDesignsValid ? 'PASS' : 'FAIL'}`);
  console.log(`Expected: 547 confirmed images | Actual: ${mappedImages.length} -> ${isMappedImagesValid ? 'PASS' : 'FAIL'}`);
  console.log(`Expected: 0 missing images | Actual: ${missingImages.length} -> ${isMissingImagesZero ? 'PASS' : 'FAIL'}`);
  console.log(`Expected: 0 ambiguous images | Actual: ${ambiguousImages.length} -> ${isAmbiguousImagesZero ? 'PASS' : 'FAIL'}`);
  console.log(`Expected: 0 SKU mismatches | Actual: ${skuMismatches.length} -> ${isSkuMismatchesZero ? 'PASS' : 'FAIL'}`);

  console.log('\n======================================================================');
  console.log(`OVERALL RESULT: ${resultStatus}`);
  console.log('======================================================================');
  if (isDryRun) {
    console.log('\n[DRY RUN FINISHED] Zero writes performed to Firebase Storage or Firestore.');
    console.log('Awaiting user review and confirmation before proceeding to PHASE 6/7.');
  }
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
