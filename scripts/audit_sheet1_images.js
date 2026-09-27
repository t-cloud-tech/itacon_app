const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '..', 'lib', 'services', 'product_catalog_service.dart'), 'utf8');

// Parse TileProduct blocks
const blocks = content.split(/TileProduct\s*\(/g).slice(1);
console.log('Total TileProduct blocks found in Dart file:', blocks.length);

const parsedProducts = [];

for (const block of blocks) {
  const getField = (fieldName) => {
    const regex = new RegExp(`${fieldName}:\\s*(?:const\\s*)?['"]([^'"]+)['"]`);
    const m = block.match(regex);
    return m ? m[1] : null;
  };

  const getArrayField = (fieldName) => {
    const regex = new RegExp(`${fieldName}:\\s*(?:const\\s*)?\\[([^\\]]*)\\]`);
    const m = block.match(regex);
    if (!m) return [];
    return m[1].split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(s => s.length > 0);
  };

  const sku = getField('sku');
  const name = getField('name');
  const mockupImages = getArrayField('mockupImages');
  const images = getArrayField('images');
  const faceImages = getArrayField('faceImages');
  const lifestyleImages = getArrayField('lifestyleImages');

  if (sku) {
    parsedProducts.push({
      sku,
      name,
      mockupImages,
      images,
      faceImages,
      lifestyleImages
    });
  }
}

console.log('Parsed products count:', parsedProducts.length);

const sheet1 = parsedProducts.filter(p => p.sku.includes('00-'));
console.log('Sheet 1 products count in Dart file:', sheet1.length);

// Check Storage inventory
const audit = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'complete_catalogue_audit.json'), 'utf8'));

// Fetch storage objects from earlier audit intermediate or let's read storage list
const intermediate = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'audit_intermediate.json'), 'utf8'));

console.log('Sample Sheet 1 items:');
sheet1.slice(0, 5).forEach(p => {
  console.log(`- ${p.sku} | ${p.name}:`);
  console.log(`  mockupImages:`, p.mockupImages);
  console.log(`  images:`, p.images);
  console.log(`  faceImages:`, p.faceImages);
});

// Check how many have mockupImages, images, faceImages
let withMockups = 0;
let withImages = 0;
let withFaces = 0;
let withLifestyle = 0;

sheet1.forEach(p => {
  if (p.mockupImages.length > 0) withMockups++;
  if (p.images.length > 0) withImages++;
  if (p.faceImages.length > 0) withFaces++;
  if (p.lifestyleImages.length > 0) withLifestyle++;
});

console.log('\n--- Sheet 1 Image Architecture in ProductCatalogService ---');
console.log(`Total Sheet 1 in Dart: ${sheet1.length}`);
console.log(`With mockupImages: ${withMockups}`);
console.log(`With images: ${withImages}`);
console.log(`With faceImages: ${withFaces}`);
console.log(`With lifestyleImages: ${withLifestyle}`);

fs.writeFileSync(
  path.join(__dirname, '..', 'build', 'sheet1_parsed_products.json'),
  JSON.stringify(sheet1, null, 2),
  'utf8'
);
