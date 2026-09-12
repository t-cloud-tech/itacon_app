const fs = require('fs');
const path = require('path');

const catalogData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'extracted_catalog_data.json'), 'utf8')
);

const tileProductsCode = catalogData.map(p => {
  const imagesListStr = p.images.map(img => `'${img}'`).join(', ');
  const faceImagesListStr = p.faceImages.map(img => `'${img}'`).join(', ');
  const mockupImagesListStr = p.mockupImages && p.mockupImages.length > 0
    ? `const [${p.mockupImages.map(img => `'${img}'`).join(', ')}]`
    : `null`;

  const randomPatternStr = p.faceImages.length > 1
    ? `'${p.faceImages.length} Faces'`
    : `'Single Face'`;

  const spacesList = p.spacesRaw.toLowerCase().includes('wall')
    ? `const ['Living Room', 'Bedroom', 'Bath Room', 'Commercial', 'Wall']`
    : `const ['Living Room', 'Bedroom', 'Bath Room', 'Commercial']`;

  return `    TileProduct(
      id: 'PROD_${p.sku.replace(/[^a-zA-Z0-9]/g, '_')}',
      productId: 'PROD_${p.sku.replace(/[^a-zA-Z0-9]/g, '_')}',
      sku: '${p.sku}',
      name: '${p.name.replace(/'/g, "\\'")}',
      size: '600x1200 mm',
      surface: '${p.surface}',
      color: '${p.baseColour.replace(/'/g, "\\'")}',
      baseColour: '${p.baseColour.replace(/'/g, "\\'")}',
      pattern: '${p.collection.replace(/'/g, "\\'")}',
      basePrice: ${p.price.toFixed(1)},
      moq: ${p.moq},
      unit: 'box',
      stockStatus: 'available_now',
      availableQuantity: ${p.stockQty},
      currentStock: ${p.stockQty},
      reservedStock: 0,
      availableStock: ${p.stockQty},
      images: const [${imagesListStr}],
      faceImages: const [${faceImagesListStr}],
      mockupImages: ${mockupImagesListStr},
      finish: '${p.surface}',
      thickness: '${p.thickness}',
      thicknessMm: ${p.thicknessNum},
      boxWeightKg: ${p.boxWeight.toFixed(1)},
      pcsPerBox: ${p.pcsPerBox},
      sqFtPerBox: ${p.coverageSqFt.toFixed(1)},
      productType: 'Vitrified',
      tileCategory: 'Floor Tiles',
      collection: '${p.collection.replace(/'/g, "\\'")}',
      spaces: ${spacesList},
      shape: 'rectangle',
      aspectRatio: '0.5',
      aspectRatioValue: 0.5,
      randomPattern: ${randomPatternStr},
      priceCategory: 'Premium',
      shade: 'Light',
    ),`;
}).join('\n');

const currentFile = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'services', 'product_catalog_service.dart'),
  'utf8'
);

const adhesiveStartIdx = currentFile.indexOf("id: 'PROD_ADH_LX01'");
const lastTileProductBeforeAdhesive = currentFile.lastIndexOf('TileProduct(', adhesiveStartIdx);
const adhesiveCode = currentFile.substring(lastTileProductBeforeAdhesive);

const newServiceCode = `import '../models/tile_product.dart';

/// Centralized repository of all production catalog products for ITACON tiles and adhesives.
/// Contains the ${catalogData.length} official vitrified tile products imported from Itacon Product Catalogue and the 6 ITACON LX Adhesives.
class ProductCatalogService {
  static final List<TileProduct> allCatalogProducts = [
${tileProductsCode}
    ${adhesiveCode}
`;

fs.writeFileSync(
  path.join(__dirname, '..', 'lib', 'services', 'product_catalog_service.dart'),
  newServiceCode,
  'utf8'
);

console.log(`Successfully generated ProductCatalogService with ${catalogData.length} tile products!`);
