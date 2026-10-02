const fs = require('fs');
const path = require('path');

const fileContent = fs.readFileSync('lib/services/product_catalog_service.dart', 'utf8');

// Match each TileProduct(...) block
const productBlocks = fileContent.split(/TileProduct\s*\(/);
console.log('Total TileProduct entries found in catalog:', productBlocks.length - 1);

const products = [];
for (let i = 1; i < productBlocks.length; i++) {
  const block = productBlocks[i];
  const nameMatch = block.match(/name:\s*'([^']+)'/);
  const skuMatch = block.match(/sku:\s*'([^']+)'/);
  const imagesMatch = block.match(/images:\s*(?:const\s*)?\[([^\]]+)\]/);
  const mockupImagesMatch = block.match(/mockupImages:\s*(?:const\s*)?\[([^\]]+)\]/);
  const faceImagesMatch = block.match(/faceImages:\s*(?:const\s*)?\[([^\]]+)\]/);

  const parseList = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  };

  products.push({
    name: nameMatch ? nameMatch[1] : 'Unknown',
    sku: skuMatch ? skuMatch[1] : 'Unknown',
    images: parseList(imagesMatch ? imagesMatch[1] : ''),
    mockupImages: parseList(mockupImagesMatch ? mockupImagesMatch[1] : ''),
    faceImages: parseList(faceImagesMatch ? faceImagesMatch[1] : '')
  });
}

console.log('Parsed products:', products.length);

// Let's check what images are used
const allMockupPaths = new Set();
const allFacePaths = new Set();

products.forEach(p => {
  p.mockupImages.forEach(img => allMockupPaths.add(img));
  p.images.forEach(img => {
    if (img.includes('mockup')) allMockupPaths.add(img);
  });
  p.faceImages.forEach(img => allFacePaths.add(img));
});

console.log('Total unique mockup paths across all products in Flutter catalog:', allMockupPaths.size);

// Check which of these are:
// 1) Sheet 1: products/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-XXX_mockup.jpeg
// 2) Sheet 2: products/mockups/ADIGE CREMA.jpg ??? OR products/mockups/VIT-60120-8.50-GLO-MAR-WHIT-066_room1.jpg ???
const pathsArr = Array.from(allMockupPaths);
const s1Count = pathsArr.filter(p => p.includes('-00-')).length;
const namedMockups = pathsArr.filter(p => !p.includes('_room') && !p.includes('-00-'));
const roomMockups = pathsArr.filter(p => p.includes('_room'));

console.log('Sheet 1 mockups (VIT-...-00-XXX_mockup.jpeg):', s1Count);
console.log('Named mockups (e.g. products/mockups/ADIGE CREMA.jpg):', namedMockups.length);
console.log('Room mockups (e.g. products/mockups/VIT-...-066_room1.jpg):', roomMockups.length);
if (namedMockups.length > 0) {
  console.log('Sample named mockups:', namedMockups.slice(0, 5));
}
