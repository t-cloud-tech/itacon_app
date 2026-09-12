/**
 * Firestore Product Seeding Script - ITACON Vitrified Tiles
 * Extracted directly from: Itacon_Product_with_Tile_Images.xlsx
 *
 * Provides all 65 official tile products and category for batch import into Cloud Firestore.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, 'node_modules', 'xlsx'));

const excelPath = path.join(__dirname, 'Itacon_Product_with_Tile_Images.xlsx');
const manifestPath = path.join(__dirname, 'tile_images_manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];

const manifestBySku = {};
for (const m of manifest) {
  manifestBySku[m.sku] = m;
}

const tileCategory = {
  categoryId: "CAT_VITRIFIED",
  name: "Vitrified Tiles",
  subtitle: "600x1200 mm Premium Slabs",
  displayOrder: 1,
  isFeatured: true,
  imageUrl: "assets/images/tiles/VIT-60120-8.50-GLO-MAR-WHIT-00-001.jpeg"
};

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

const tileProducts = [];
for (let r = 2; r < rows.length; r++) {
  const row = rows[r];
  if (!row || !row[1]) continue;

  const sku = String(row[1]).trim();
  const shortCode = String(row[8]).trim();
  const designName = String(row[9]).trim();
  const surface = String(row[5]).trim() || 'Glossy';
  const collection = String(row[6]).trim() || 'Marble - Random';
  const baseColor = String(row[7]).trim() || 'White Statuario';
  const thickness = Number(row[4]) || 8.5;
  const boxWeight = Number(row[11]) || 27.0;
  const pcsPerBox = Number(row[12]) || 2;
  const sqFtPerBox = Number(row[13]) || 15.5;
  const price = Number(row[14]) || 35.0;
  const moq = Number(row[15]) || 100;
  const stockQty = Number(row[17]) || 100;

  const mItem = manifestBySku[sku];
  const imageAsset = mItem && mItem.hasRealImage
    ? mItem.assetPath
    : 'assets/images/tiles/fallback_tile.jpeg';

  const prodId = 'PROD_' + sku.replace(/[^a-zA-Z0-9]/g, '_');

  tileProducts.push({
    productId: prodId,
    sku,
    name: designName,
    productLine: 'tiles',
    categoryId: 'CAT_VITRIFIED',
    categoryName: 'Vitrified Tiles',
    classification: surface,
    surface,
    color: baseColor,
    baseColour: baseColor,
    pattern: collection,
    basePrice: price,
    unit: 'box',
    moq,
    stockStatus: 'available_now',
    availableQuantity: stockQty,
    currentStock: stockQty,
    reservedStock: 0,
    availableStock: stockQty,
    images: [imageAsset],
    collection,
    productType: 'Vitrified',
    finish: surface,
    thickness: `${thickness} mm`,
    thicknessMm: thickness,
    boxWeightKg: boxWeight,
    pcsPerBox,
    sqFtPerBox,
    spaces: ['Living Room', 'Bedroom', 'Bath Room', 'Commercial'],
    shape: 'rectangle',
    aspectRatio: '0.5',
    aspectRatioValue: 0.5,
    randomPattern: collection.toLowerCase().includes('random') ? '4 Faces' : 'Endless Pattern',
    priceCategory: 'Premium',
    shade: 'Light',
    isActive: true,
  });
}

if (require.main === module) {
  console.log(`Loaded ${tileProducts.length} tile products from Excel.`);
  const outputPath = path.join(__dirname, 'tiles_seed_data.json');
  fs.writeFileSync(outputPath, JSON.stringify({ category: tileCategory, products: tileProducts }, null, 2));
  console.log(`Saved seed JSON to ${outputPath}`);
}

module.exports = {
  tileCategory,
  tileProducts
};
