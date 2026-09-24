const fs = require('fs');
const path = require('path');
const XLSX = require('./node_modules/xlsx');

const EXCEL_PATH = 'D:/Itacon Product (2) (1) (2).xlsx';
const CSV_PATH = path.join(__dirname, 'ITACON_Image_Mapping.csv');
const GLOSSY_EXTRACTED_DIR = 'D:/glossy/glossy';

console.log('====================================================');
console.log('PHASE 2 — MASTER DATA & IMAGE MAPPING VALIDATION');
console.log('====================================================');

// 1. Read Master Excel Sheet 2
if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`ERROR: Excel file not found at ${EXCEL_PATH}`);
  process.exit(1);
}

const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['2'];
if (!sheet) {
  console.error(`ERROR: Sheet "2" not found in ${EXCEL_PATH}. Available sheets:`, wb.SheetNames);
  process.exit(1);
}

const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
// Row 0: Title, Row 1: Headers, Row 2+: Products
const headers = rawRows[1] || [];
const productRows = rawRows.slice(2).filter(r => r && r[1] && String(r[1]).trim().length > 0);

console.log(`Excel Data Rows Found: ${productRows.length} (Expected: 138)`);

const excelProducts = [];
const skuSet = new Set();
const designNameSet = new Set();
const docIdSet = new Set();
const duplicateSkus = [];
const duplicateDesignNames = [];
const duplicateDocIds = [];

for (let i = 0; i < productRows.length; i++) {
  const row = productRows[i];
  const sku = String(row[1]).trim();
  const designName = String(row[9]).trim();
  const shortCode = String(row[8]).trim();
  const surface = String(row[5]).trim() || 'Glossy';
  const collection = String(row[6]).trim() || 'Marble - Random';
  const baseColor = String(row[7]).trim() || 'White Statuario';
  const size = String(row[3]).trim() || '600x1200 mm';
  const thickness = Number(row[4]) || 8.5;
  const boxWeight = Number(row[11]) || 27.0;
  const pcsPerBox = Number(row[12]) || 2;
  const sqFtPerBox = Number(row[13]) || 15.5;
  const price = Number(row[14]) || 35.0;
  const moq = Number(row[15]) || 100;
  const stockQty = Number(row[17]) || 100;
  const stockStatus = String(row[16]).trim() || 'AVAILABLE';

  // ID Sanitization matching existing project: 'PROD_' + sku.replace(/[^a-zA-Z0-9]/g, '_')
  const docId = 'PROD_' + sku.replace(/[^a-zA-Z0-9]/g, '_');

  if (skuSet.has(sku)) duplicateSkus.push(sku);
  skuSet.add(sku);

  if (designNameSet.has(designName)) duplicateDesignNames.push(designName);
  designNameSet.add(designName);

  if (docIdSet.has(docId)) duplicateDocIds.push(docId);
  docIdSet.add(docId);

  excelProducts.push({
    rowNumber: i + 3,
    sku,
    docId,
    designName,
    shortCode,
    surface,
    collection,
    baseColor,
    size: size === '60X120' ? '600x1200 mm' : size,
    thickness,
    boxWeight,
    pcsPerBox,
    sqFtPerBox,
    price,
    moq,
    stockQty,
    stockStatus
  });
}

console.log(`Unique SKUs: ${skuSet.size}`);
console.log(`Unique Design Names: ${designNameSet.size}`);
console.log(`Unique Document IDs: ${docIdSet.size}`);
if (duplicateSkus.length > 0) console.error('Duplicate SKUs:', duplicateSkus);
if (duplicateDesignNames.length > 0) console.error('Duplicate Design Names:', duplicateDesignNames);
if (duplicateDocIds.length > 0) console.error('Duplicate Doc IDs:', duplicateDocIds);

// 2. Parse ITACON_Image_Mapping.csv
if (!fs.existsSync(CSV_PATH)) {
  console.error(`ERROR: CSV file not found at ${CSV_PATH}`);
  process.exit(1);
}

const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
const csvLines = csvRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
const csvHeaderLine = csvLines[0].replace(/^\uFEFF/, '').trim();
const csvHeaders = csvHeaderLine.split(',').map(h => h.trim());

console.log(`\nCSV Total Mapping Rows: ${csvLines.length - 1} (Expected: 547)`);

const excelProductsByName = new Map();
const excelProductsBySku = new Map();
for (const p of excelProducts) {
  excelProductsByName.set(p.designName.toLowerCase(), p);
  excelProductsBySku.set(p.sku.toLowerCase(), p);
}

const mappedImages = [];
const mappedDesigns = new Set();
const unmappedInExcel = [];
const skuMismatches = [];
const missingImages = [];
const ambiguousImages = [];
const duplicateMappingEntries = new Set();
const seenSourceImages = new Set();

// Cache directory listings for fast lookup
const dirEntries = fs.readdirSync(GLOSSY_EXTRACTED_DIR, { withFileTypes: true });
const subDirMap = new Map(); // normalized name -> actual dir name
for (const d of dirEntries) {
  if (d.isDirectory()) {
    subDirMap.set(d.name.toLowerCase().trim(), d.name);
  }
}

// Function to resolve image file inside D:/glossy/glossy
function resolveSourceImage(sourceZip, sourceImageStr) {
  // Typical sourceImageStr: 'glossy 1/ADIGE CREMA/ADIGE CREMA_R1.jpg'
  // Or: 'glossy 1/10=BAYAZ BIANCO/BAYAZ BIANCO_P1.jpg'
  const parts = sourceImageStr.replace(/\\/g, '/').split('/');
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

  // 1. Exact path try
  const exactPath = path.join(GLOSSY_EXTRACTED_DIR, targetFolder, targetFilename);
  if (fs.existsSync(exactPath)) {
    return { path: exactPath, count: 1 };
  }

  // 2. Folder normalization try
  const actualFolder = subDirMap.get(targetFolder.toLowerCase());
  if (actualFolder) {
    const candidatePath = path.join(GLOSSY_EXTRACTED_DIR, actualFolder, targetFilename);
    if (fs.existsSync(candidatePath)) {
      return { path: candidatePath, count: 1 };
    }

    // Try finding matching filename in actual folder
    const filesInFolder = fs.readdirSync(path.join(GLOSSY_EXTRACTED_DIR, actualFolder));
    const targetNorm = targetFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = filesInFolder.filter(f => f.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm);
    if (matched.length === 1) {
      return { path: path.join(GLOSSY_EXTRACTED_DIR, actualFolder, matched[0]), count: 1 };
    }
  }

  // 3. Fallback: Search all folders for this filename
  const baseFilenameNorm = targetFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidateMatches = [];
  for (const [_, actualDir] of subDirMap) {
    const dirPath = path.join(GLOSSY_EXTRACTED_DIR, actualDir);
    const files = fs.readdirSync(dirPath);
    for (const f of files) {
      if (f.toLowerCase().replace(/[^a-z0-9]/g, '') === baseFilenameNorm) {
        candidateMatches.push(path.join(dirPath, f));
      }
    }
  }

  if (candidateMatches.length === 1) {
    return { path: candidateMatches[0], count: 1 };
  } else if (candidateMatches.length > 1) {
    return { path: null, count: candidateMatches.length, candidates: candidateMatches };
  }

  return { path: null, count: 0 };
}

for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i];
  // Format: Design Name,SKU,Source ZIP,Source Image,Role,Sequence,Original Storage Path,Thumbnail Storage Path,Local Thumbnail
  const cols = line.split(',').map(c => c.trim());
  const designName = cols[0];
  const sku = cols[1];
  const sourceZip = cols[2];
  const sourceImage = cols[3];
  const role = cols[4];
  const sequence = parseInt(cols[5], 10) || 1;
  const origStoragePath = cols[6];
  const thumbStoragePath = cols[7];
  const localThumbnail = cols[8];

  const excelProduct = excelProductsByName.get(designName.toLowerCase());
  if (!excelProduct) {
    unmappedInExcel.push({ line: i, designName, sku });
  } else {
    if (excelProduct.sku.toLowerCase() !== sku.toLowerCase()) {
      skuMismatches.push({ line: i, designName, csvSku: sku, excelSku: excelProduct.sku });
    }
  }

  mappedDesigns.add(designName);

  // Check duplicate mapping
  const mapKey = `${designName}|${sourceImage}`;
  if (duplicateMappingEntries.has(mapKey)) {
    console.warn(`Warning: Duplicate mapping row detected for ${mapKey}`);
  }
  duplicateMappingEntries.add(mapKey);

  // Resolve source image
  const resolved = resolveSourceImage(sourceZip, sourceImage);
  if (resolved.count === 0) {
    missingImages.push({ line: i, designName, sourceImage, sourceZip });
  } else if (resolved.count > 1) {
    ambiguousImages.push({ line: i, designName, sourceImage, candidates: resolved.candidates });
  }

  mappedImages.push({
    designName,
    sku,
    role,
    sequence,
    sourceZip,
    sourceImage,
    resolvedLocalPath: resolved.path,
    origStoragePath,
    thumbStoragePath
  });
}

console.log(`\n--- MAPPING VALIDATION SUMMARY ---`);
console.log(`Unique Mapped Designs: ${mappedDesigns.size} (Expected: 137)`);
console.log(`Total Mapped Images: ${mappedImages.length} (Expected: 547)`);
console.log(`Missing Mapped Images: ${missingImages.length} (Expected: 0)`);
console.log(`Ambiguous Mapped Images: ${ambiguousImages.length} (Expected: 0)`);
console.log(`Unmapped In Excel: ${unmappedInExcel.length} (Expected: 0)`);
console.log(`SKU Mismatches: ${skuMismatches.length} (Expected: 0)`);

if (missingImages.length > 0) {
  console.error('\nFirst 5 missing images:', missingImages.slice(0, 5));
}
if (ambiguousImages.length > 0) {
  console.error('\nFirst 5 ambiguous images:', ambiguousImages.slice(0, 5));
}
if (skuMismatches.length > 0) {
  console.error('\nSKU Mismatches:', skuMismatches);
}

// Check special cases
console.log(`\n--- SPECIAL CASES AUDIT ---`);
const telerCremaInExcel = excelProductsByName.has('teler crema');
const telerCremaInCsv = mappedDesigns.has('TELER CREMA');
console.log(`TELER CREMA in Excel: ${telerCremaInExcel} (Expected: true)`);
console.log(`TELER CREMA in Mapped CSV: ${telerCremaInCsv} (Expected: false - no image)`);

const topazBrownInExcel = excelProductsByName.has('topaz brown');
const topazBrownInCsv = mappedDesigns.has('TOPAZ BROWN');
const topazBrownInDir = subDirMap.has('topaz brown');
console.log(`TOPAZ BROWN in Excel: ${topazBrownInExcel} (Expected: false)`);
console.log(`TOPAZ BROWN in Mapped CSV: ${topazBrownInCsv} (Expected: false)`);
console.log(`TOPAZ BROWN in Extracted Folders: ${topazBrownInDir} (Excluded properly: true)`);

// Role breakdown
const roleCounts = {};
for (const img of mappedImages) {
  roleCounts[img.role] = (roleCounts[img.role] || 0) + 1;
}
console.log(`\nImage Roles Distribution:`, roleCounts);
