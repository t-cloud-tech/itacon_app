const fs = require('fs');
const path = require('path');
const XLSX = require('./node_modules/xlsx');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = 'D:/Itacon Product (2) (1) (2).xlsx';
const CSV_PATH = path.join(PROJECT_ROOT, 'scripts', 'product_image_mapping.csv');

function parseSpaces(spacesRaw) {
  const defaultSpaces = ['Living Room', 'Bedroom', 'Commercial'];
  if (!spacesRaw) return defaultSpaces;
  const s = String(spacesRaw).toLowerCase();
  const spaces = [];
  if (s.includes('floor')) spaces.push('Living Room', 'Bedroom', 'Commercial');
  if (s.includes('wall')) spaces.push('Wall', 'Bath Room');
  return Array.from(new Set(spaces.length > 0 ? spaces : defaultSpaces));
}

function runPrepare() {
  console.log('======================================================================');
  console.log('PHASE 4C — PREPARE SHEET 3 PROPOSED FIRESTORE PAYLOADS');
  console.log('======================================================================\n');

  // 1. Read Master Excel Sheet 3
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Master Excel not found at: ${EXCEL_PATH}`);
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets['3'];
  if (!sheet) {
    throw new Error('Sheet "3" not found in Excel!');
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headers = rawRows[1] || [];
  const dataRows = rawRows.slice(2).filter(r => r && r[1] && String(r[1]).trim().length > 0);

  console.log(`Excel Sheet 3 Product Rows: ${dataRows.length} (Expected: 97)`);

  // 2. Read CSV image mappings
  const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const csvLines = csvRaw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const imageMap = new Map(); // sku -> { mockups: [], tileFaces: [] }

  for (let i = 1; i < csvLines.length; i++) {
    const parts = csvLines[i].split(',').map(s => s.trim());
    if (parts[0] === '3') {
      const sku = parts[1];
      if (!imageMap.has(sku)) {
        imageMap.set(sku, { mockups: [], tileFaces: [] });
      }
      const entry = imageMap.get(sku);
      if (parts[3] === 'Mockup') {
        entry.mockups.push({ filename: parts[4], order: parseInt(parts[5], 10) });
      } else if (parts[3] === 'Tile Face') {
        entry.tileFaces.push({ filename: parts[4], order: parseInt(parts[5], 10) });
      }
    }
  }

  // Sort images by order
  for (const entry of imageMap.values()) {
    entry.mockups.sort((a, b) => a.order - b.order);
    entry.tileFaces.sort((a, b) => a.order - b.order);
  }

  const proposedDocs = [];
  const faceDistribution = {};
  const blankFieldAudit = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const sku = String(row[1]).trim();
    const designName = String(row[9]).trim();
    const shortCode = String(row[8]).trim() || `00-${204 + i}`;
    const surface = String(row[5]).trim() || 'Glossy';
    const collection = String(row[6]).trim() || 'GLOSSY - ENDLESS';
    const baseColour = String(row[7]).trim() || 'WHITE';
    const rawSize = String(row[3]).trim() || '60X120';
    const size = (rawSize.toUpperCase() === '60X120') ? '600x1200 mm' : rawSize;
    const thicknessMm = Number(row[4]) || 8.5;
    const boxWeightKg = Number(row[11]) || 27;
    const pcsPerBox = parseInt(row[12], 10) || 2;
    const sqFtPerBox = Number(row[13]) || 15.5;
    const basePrice = Number(row[14]) || 35;
    const moq = parseInt(row[15], 10) || 100;
    const stockQty = parseInt(row[17], 10) || 100;
    const spacesRaw = String(row[10]).trim();
    const spaces = parseSpaces(spacesRaw);

    // Image arrays from CSV mapping
    const imgEntry = imageMap.get(sku) || { mockups: [], tileFaces: [] };
    const mockupImages = imgEntry.mockups.map(m => `products/mockups/${m.filename}`);
    const faceImages = imgEntry.tileFaces.map(f => `products/tiles/${f.filename}`);

    // Track face distribution
    const numFaces = faceImages.length;
    faceDistribution[`${numFaces} Faces`] = (faceDistribution[`${numFaces} Faces`] || 0) + 1;

    // Doc ID sanitization matching existing project standard
    const docId = 'PROD_' + sku.replace(/[^a-zA-Z0-9]/g, '_');

    // Blank field checks
    const missingInExcel = [];
    if (!row[1]) missingInExcel.push('SKU');
    if (!row[9]) missingInExcel.push('Design Name');
    if (!row[14]) missingInExcel.push('Price');
    if (missingInExcel.length > 0) {
      blankFieldAudit.push({ sku, missingInExcel });
    }

    // Proposed document matching existing Firestore products schema exactly
    const docPayload = {
      id: docId,
      productId: docId,
      sku: sku,
      name: designName,
      shortCode: shortCode,
      surface: surface,
      finish: surface,
      collection: collection,
      categoryId: 'CAT_VITRIFIED',
      categoryName: 'Vitrified Tiles',
      productLine: 'tiles',
      productType: 'Vitrified',
      bodyType: 'Porcelain',
      size: size,
      shape: 'rectangle',
      aspectRatio: '0.5',
      aspectRatioValue: 0.5,
      thickness: `${thicknessMm} mm`,
      thicknessMm: thicknessMm,
      baseColor: baseColour,
      baseColour: baseColour,
      basePrice: basePrice,
      priceCategory: 'Premium',
      moq: moq,
      pcsPerBox: pcsPerBox,
      boxWeightKg: boxWeightKg,
      sqFtPerBox: sqFtPerBox,
      stockStatus: 'available_now',
      inStock: true,
      availableQuantity: stockQty,
      currentStock: stockQty,
      reservedStock: 0,
      availableStock: stockQty,
      isActive: true,
      isComingSoon: false,
      shade: 'Light',
      spaces: spaces,
      randomPattern: `${numFaces} Faces`,
      packingDetails: {
        boxWeight: `${boxWeightKg} kg`,
        sqmPerBox: '1.44',
        boxesPerPallet: 40,
        piecesPerBox: pcsPerBox
      },
      mockupImages: mockupImages,
      faceImages: faceImages,
      // For backward-compatibility with legacy widgets expecting images[0]
      images: mockupImages.length > 0 ? [mockupImages[0]] : (faceImages.length > 0 ? [faceImages[0]] : []),
      lifestyleImages: []
    };

    proposedDocs.push(docPayload);
  }

  console.log(`Successfully generated ${proposedDocs.length} proposed Firestore documents.`);
  console.log('Face count distribution:', faceDistribution);

  // Validation of proposed payloads against model requirements
  let validationErrors = [];
  proposedDocs.forEach((doc, idx) => {
    if (!doc.id || !doc.sku || !doc.name) {
      validationErrors.push(`Doc #${idx}: Missing critical ID/SKU/name`);
    }
    if (typeof doc.basePrice !== 'number' || doc.basePrice <= 0) {
      validationErrors.push(`Doc ${doc.sku}: Invalid price ${doc.basePrice}`);
    }
    if (typeof doc.moq !== 'number' || doc.moq <= 0) {
      validationErrors.push(`Doc ${doc.sku}: Invalid MOQ ${doc.moq}`);
    }
    if (!Array.isArray(doc.mockupImages) || doc.mockupImages.length === 0) {
      validationErrors.push(`Doc ${doc.sku}: Empty mockupImages`);
    }
    if (!Array.isArray(doc.faceImages) || doc.faceImages.length === 0) {
      validationErrors.push(`Doc ${doc.sku}: Empty faceImages`);
    }
  });

  console.log(`Validation Errors: ${validationErrors.length}`);

  const output = {
    totalSheet3Products: proposedDocs.length,
    faceDistribution,
    blankFieldAudit,
    validationErrors,
    sampleDocuments: proposedDocs.slice(0, 5),
    allProposedDocuments: proposedDocs
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'sheet3_dry_run_payloads.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );
  console.log('Proposed payloads saved to build/sheet3_dry_run_payloads.json');
}

runPrepare();
