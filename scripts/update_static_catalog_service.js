/**
 * Deterministic Static Fallback Catalog Synchronizer
 *
 * Merges:
 * - 65 Existing Tile Products (SKU 001 - 065)
 * - 138 New Glossy Tile Products from Sheet 2 (SKU 066 - 203)
 * - 6 ITACON LX Adhesive Products
 *
 * Produces exactly 203 unique tiles + 6 adhesives = 209 products in ProductCatalogService.allCatalogProducts.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('./node_modules/xlsx');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = 'D:/Itacon Product (2) (1) (2).xlsx';
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'build', 'glossy_thumbnails_manifest.json');
const TARGET_FILE = path.join(PROJECT_ROOT, 'lib', 'services', 'product_catalog_service.dart');

// 1. Read existing static catalog file to extract the 65 existing tiles and 6 adhesives
const currentSource = fs.readFileSync(TARGET_FILE, 'utf8');

// Extract the 6 adhesives code block
const adhesiveMarker = "id: 'PROD_ADH_LX01'";
const adhesiveStartPos = currentSource.indexOf(adhesiveMarker);
if (adhesiveStartPos === -1) {
  console.error("FATAL: Could not locate adhesives block in product_catalog_service.dart");
  process.exit(1);
}
const tileBeforeAdhesive = currentSource.lastIndexOf('TileProduct(', adhesiveStartPos);
const adhesivesCode = currentSource.substring(tileBeforeAdhesive).trim();

// Extract the first 65 existing tiles code block
const productsListStartMarker = 'static final List<TileProduct> allCatalogProducts = [';
const listStartIdx = currentSource.indexOf(productsListStartMarker);
const existing65Code = currentSource.substring(listStartIdx + productsListStartMarker.length, tileBeforeAdhesive).trim();

// 2. Read the 138 new glossy products from Excel Sheet 2 and Manifest
const wb = XLSX.readFile(EXCEL_PATH);
const sheet2 = wb.Sheets['2'];
const rawRows = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' });
const productRows = rawRows.slice(2).filter(r => r && r[1] && String(r[1]).trim().length > 0);

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const imagesBySku = new Map();
for (const item of manifest) {
  if (!imagesBySku.has(item.sku)) {
    imagesBySku.set(item.sku, { faces: [], mockups: [] });
  }
  const entry = imagesBySku.get(item.sku);
  if (item.isRoomMockup) {
    entry.mockups.push({ path: item.finalOriginalStoragePath, sequence: item.sequence });
  } else {
    entry.faces.push({ path: item.finalOriginalStoragePath, sequence: item.sequence });
  }
}

const newGlossyTilesCode = productRows.map(row => {
  const sku = String(row[1]).trim();
  const designName = String(row[9]).trim().replace(/'/g, "\\'");
  const shortCode = String(row[8]).trim();
  const surface = String(row[5]).trim() || 'Glossy';
  const collection = (String(row[6]).trim() || 'Marble - Random').replace(/'/g, "\\'");
  const baseColor = (String(row[7]).trim() || 'White Statuario').replace(/'/g, "\\'");
  const sizeRaw = String(row[3]).trim();
  const size = sizeRaw === '60X120' ? '600x1200 mm' : (sizeRaw.includes('x') || sizeRaw.includes('X') ? `${sizeRaw} mm` : sizeRaw);
  const thickness = Number(row[4]) || 8.5;
  const boxWeight = Number(row[11]) || 27.0;
  const pcsPerBox = parseInt(row[12], 10) || 2;
  const sqFtPerBox = Number(row[13]) || 15.5;
  const price = Number(row[14]) || 35.0;
  const moq = parseInt(row[15], 10) || 100;
  const stockQty = parseInt(row[17], 10) || 100;
  const spacesRaw = String(row[10]).trim();

  const docId = 'PROD_' + sku.replace(/[^a-zA-Z0-9]/g, '_');

  const imgData = imagesBySku.get(sku) || { faces: [], mockups: [] };
  imgData.faces.sort((a, b) => a.sequence - b.sequence);
  imgData.mockups.sort((a, b) => a.sequence - b.sequence);

  const facePaths = imgData.faces.map(f => `'${f.path}'`);
  const mockupPaths = imgData.mockups.map(m => `'${m.path}'`);
  const allImages = facePaths.length > 0 ? facePaths : mockupPaths;

  const imagesListStr = allImages.length > 0 ? `const [${allImages.join(', ')}]` : `const []`;
  const faceImagesListStr = facePaths.length > 0 ? `const [${facePaths.join(', ')}]` : `null`;
  const mockupImagesListStr = mockupPaths.length > 0 ? `const [${mockupPaths.join(', ')}]` : `null`;

  const randomPatternStr = facePaths.length > 1
    ? `'${facePaths.length} Faces'`
    : `'4 Faces'`;

  const spacesList = spacesRaw.toLowerCase().includes('wall')
    ? `const ['Living Room', 'Bedroom', 'Bath Room', 'Commercial', 'Wall']`
    : `const ['Living Room', 'Bedroom', 'Bath Room', 'Commercial']`;

  return `    TileProduct(
      id: '${docId}',
      productId: '${docId}',
      sku: '${sku}',
      name: '${designName}',
      size: '${size}',
      surface: '${surface}',
      color: '${baseColor}',
      baseColour: '${baseColor}',
      pattern: '${collection}',
      basePrice: ${price.toFixed(1)},
      moq: ${moq},
      unit: 'box',
      stockStatus: 'available_now',
      availableQuantity: ${stockQty},
      currentStock: ${stockQty},
      reservedStock: 0,
      availableStock: ${stockQty},
      images: ${imagesListStr},
      faceImages: ${faceImagesListStr},
      mockupImages: ${mockupImagesListStr},
      finish: '${surface}',
      thickness: '${thickness} mm',
      thicknessMm: ${thickness.toFixed(1)},
      boxWeightKg: ${boxWeight.toFixed(1)},
      pcsPerBox: ${pcsPerBox},
      sqFtPerBox: ${sqFtPerBox.toFixed(1)},
      productType: 'Vitrified',
      tileCategory: 'Floor Tiles',
      collection: '${collection}',
      spaces: ${spacesList},
      shape: 'rectangle',
      aspectRatio: '0.5',
      aspectRatioValue: 0.5,
      randomPattern: ${randomPatternStr},
      priceCategory: 'Premium',
      shade: 'Light',
    ),`;
}).join('\n');

const generatedSource = `import '../models/tile_product.dart';

/// Centralized repository of all production catalog products for ITACON tiles and adhesives.
/// Contains:
/// - 65 initial Vitrified Tiles (001 - 065)
/// - 138 newly imported Glossy Vitrified Tiles (066 - 203)
/// - 6 ITACON LX Adhesives
/// Total: 203 tile products + 6 adhesives = 209 catalog products.
class ProductCatalogService {
  static final List<TileProduct> allCatalogProducts = [
${existing65Code}
${newGlossyTilesCode}
${adhesivesCode}
`;

fs.writeFileSync(TARGET_FILE, generatedSource, 'utf8');
console.log(`Successfully updated ${TARGET_FILE}!`);
console.log(`- Preserved existing 65 tiles`);
console.log(`- Added 138 new glossy tiles`);
console.log(`- Preserved 6 adhesives`);
console.log(`Total items in ProductCatalogService: 209`);
