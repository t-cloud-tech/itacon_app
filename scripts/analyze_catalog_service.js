const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '..', 'lib', 'services', 'product_catalog_service.dart'), 'utf8');

const skuRegex = /sku:\s*['"]([^'"]+)['"]/g;
const skus = [];
let m;
while ((m = skuRegex.exec(content)) !== null) {
  skus.push(m[1]);
}

console.log('Total static products in ProductCatalogService:', skus.length);

const sheet1Skus = skus.filter(s => s.includes('00-'));
const sheet2Skus = skus.filter(s => !s.includes('00-') && !s.startsWith('ITA-LX-') && s.startsWith('VIT-'));
const adhesives = skus.filter(s => s.startsWith('ITA-LX-'));

console.log('Sheet 1 SKUs in ProductCatalogService:', sheet1Skus.length, sheet1Skus[0], '...', sheet1Skus[sheet1Skus.length - 1]);
console.log('Sheet 2 SKUs in ProductCatalogService:', sheet2Skus.length, sheet2Skus[0], '...', sheet2Skus[sheet2Skus.length - 1]);
console.log('Adhesives in ProductCatalogService:', adhesives.length, adhesives);

// Check which numbers are in Sheet 1 in ProductCatalogService
const s1Numbers = sheet1Skus.map(s => {
  const match = s.match(/00-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}).filter(n => n !== null);

console.log('Sheet 1 numbers count in ProductCatalogService:', s1Numbers.length);
console.log('Sheet 1 min number:', Math.min(...s1Numbers), 'max number:', Math.max(...s1Numbers));

// Are Sheet 3 products in ProductCatalogService?
const sheet3Candidates = skus.filter(s => {
  const match = s.match(/-(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num >= 204 && num <= 300;
  }
  return false;
});
console.log('Sheet 3 SKUs in ProductCatalogService:', sheet3Candidates.length);
