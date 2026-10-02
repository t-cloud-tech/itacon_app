const fs = require('fs');
const path = require('path');

const catalogCode = fs.readFileSync('lib/services/product_catalog_service.dart', 'utf8');
const mockupMatches = catalogCode.match(/products\/mockups\/[^'\"]+/g) || [];
const uniqueCatalogMockups = Array.from(new Set(mockupMatches));
console.log('Unique mockups in lib/services/product_catalog_service.dart:', uniqueCatalogMockups.length);

const audit1 = JSON.parse(fs.readFileSync('image_cleanup_preview/mockup_cleanup_audit.json', 'utf8'));
const batch1Filenames = new Set(audit1.map(i => path.basename(i.filename || '')));

let inBatch1 = 0;
let notInBatch1 = 0;
const notInBatch1List = [];

uniqueCatalogMockups.forEach(m => {
  const b = path.basename(m);
  if (batch1Filenames.has(b)) {
    inBatch1++;
  } else {
    notInBatch1++;
    notInBatch1List.push(m);
  }
});

console.log('Catalog mockups audited in Batch 1:', inBatch1);
console.log('Catalog mockups NOT audited in Batch 1:', notInBatch1);
console.log('Sample not in Batch 1 (first 10):', notInBatch1List.slice(0, 10));
console.log('Sample not in Batch 1 (last 10):', notInBatch1List.slice(-10));
