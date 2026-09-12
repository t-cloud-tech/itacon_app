const fs = require('fs');
const path = require('path');
const AdmZip = require('./node_modules/adm-zip');
const XLSX = require('./node_modules/xlsx');

const excelPath = path.join(__dirname, 'Itacon_Product_with_Tile_Images.xlsx');
const tilesDir = path.join(__dirname, '..', 'assets', 'images', 'tiles');
const mockupsDir = path.join(__dirname, '..', 'assets', 'images', 'mockups');

if (!fs.existsSync(tilesDir)) fs.mkdirSync(tilesDir, { recursive: true });
if (!fs.existsSync(mockupsDir)) fs.mkdirSync(mockupsDir, { recursive: true });

console.log('Loading Excel archive:', excelPath);
const zip = new AdmZip(excelPath);

const relsXml = zip.readAsText('xl/drawings/_rels/drawing1.xml.rels');
const drawingXml = zip.readAsText('xl/drawings/drawing1.xml');

const relsMap = {};
for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
  relsMap[m[1]] = m[2].replace('../media/', 'xl/media/');
}

const anchorRegex = /<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="([^"]+)"/g;
const imagesByRowCol = {};

for (const match of drawingXml.matchAll(anchorRegex)) {
  const col = parseInt(match[1], 10);
  const row = parseInt(match[2], 10);
  const rId = match[3];
  if (!imagesByRowCol[row]) imagesByRowCol[row] = {};
  imagesByRowCol[row][col] = relsMap[rId];
}

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

let mockupsExtracted = 0;
let facesExtracted = 0;
const catalogEntries = [];

for (let r = 2; r < rows.length; r++) {
  const row = rows[r];
  const sku = String(row[1] || '').trim();
  if (!sku) continue;

  const designName = String(row[9] || '').trim();
  const shortCode = String(row[8] || '').trim();
  const surface = String(row[5] || 'Glossy').trim();
  const collection = String(row[6] || 'Marble - Random').trim();
  const baseColour = String(row[7] || 'White Statuario').trim();
  const thickness = row[4] ? `${row[4]} mm` : '8.5 mm';
  const thicknessNum = parseFloat(row[4]) || 8.5;
  const price = parseFloat(row[14]) || 35.0;
  const boxWeight = parseFloat(row[11]) || 27.0;
  const pcsPerBox = parseInt(row[12], 10) || 2;
  const coverageSqFt = parseFloat(row[13]) || 15.5;
  const moq = parseInt(row[15], 10) || 100;
  const stockQty = parseInt(row[17], 10) || 100;
  const spacesRaw = String(row[10] || 'Floors\\Walls').trim();

  // 1. Room Mockup from Col 19
  let mockupAssetPath = null;
  const mockupZipPath = imagesByRowCol[r] ? imagesByRowCol[r][19] : null;
  if (mockupZipPath) {
    const entry = zip.getEntry(mockupZipPath);
    if (entry) {
      const mockupFileName = `${sku}_mockup.jpeg`;
      const mockupFilePath = path.join(mockupsDir, mockupFileName);
      fs.writeFileSync(mockupFilePath, zip.readFile(entry));
      mockupAssetPath = `assets/images/mockups/${mockupFileName}`;
      mockupsExtracted++;
    }
  }

  // 2. Tile Faces from Col 25 to 30
  const faceAssetPaths = [];
  if (imagesByRowCol[r]) {
    for (let c = 25; c <= 30; c++) {
      const faceZipPath = imagesByRowCol[r][c];
      if (faceZipPath) {
        const entry = zip.getEntry(faceZipPath);
        if (entry) {
          const faceNum = faceAssetPaths.length + 1;
          const faceFileName = `${sku}_face${faceNum}.jpeg`;
          const faceFilePath = path.join(tilesDir, faceFileName);
          fs.writeFileSync(faceFilePath, zip.readFile(entry));
          faceAssetPaths.push(`assets/images/tiles/${faceFileName}`);
          facesExtracted++;
        }
      }
    }
  }

  // Also ensure ${sku}.jpeg exists in tilesDir for backwards compatibility
  const legacyTilePath = path.join(tilesDir, `${sku}.jpeg`);
  if (faceAssetPaths.length > 0) {
    // Copy face1 as main tile
    const face1Path = path.join(tilesDir, `${sku}_face1.jpeg`);
    fs.copyFileSync(face1Path, legacyTilePath);
  } else if (!fs.existsSync(legacyTilePath)) {
    // If no face, copy fallback
    const fallbackPath = path.join(tilesDir, 'fallback_tile.jpeg');
    if (fs.existsSync(fallbackPath)) {
      fs.copyFileSync(fallbackPath, legacyTilePath);
    }
  }

  // Determine images list
  const productImages = faceAssetPaths.length > 0
    ? faceAssetPaths
    : [`assets/images/tiles/${sku}.jpeg`];

  const productMockups = mockupAssetPath ? [mockupAssetPath] : [];

  catalogEntries.push({
    row: r,
    sku,
    name: designName,
    shortCode,
    surface,
    collection,
    baseColour,
    thickness,
    thicknessNum,
    price,
    boxWeight,
    pcsPerBox,
    coverageSqFt,
    moq,
    stockQty,
    spacesRaw,
    images: productImages,
    faceImages: faceAssetPaths.length > 0 ? faceAssetPaths : productImages,
    mockupImages: productMockups
  });
}

console.log(`\nExtraction completed!`);
console.log(`- Room Mockup Images Extracted: ${mockupsExtracted}`);
console.log(`- Tile Face Images Extracted: ${facesExtracted}`);
console.log(`- Total Products Mapped: ${catalogEntries.length}`);

fs.writeFileSync(
  path.join(__dirname, 'extracted_catalog_data.json'),
  JSON.stringify(catalogEntries, null, 2)
);
console.log('Saved extracted catalog to scripts/extracted_catalog_data.json');
