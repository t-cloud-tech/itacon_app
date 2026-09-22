const fs = require('fs');

const seedData = JSON.parse(fs.readFileSync('d:/itacon_app/scripts/tiles_seed_data.json', 'utf8'));
const { adhesiveProducts } = require('d:/itacon_app/scripts/seed_adhesives.js');

const skuToProduct = new Map();

for (const p of seedData.products) {
  skuToProduct.set(p.sku, { code: p.sku, name: p.name });
}

for (const a of adhesiveProducts) {
  skuToProduct.set(a.sku, { code: a.sku, name: a.name });
}

console.log(`Loaded ${skuToProduct.size} product mappings.`);
