const assert = require('assert');
const {
  FIELDS_USED_FOR_TYPE_DETECTION,
  resolveHsnCategory,
  hasTileTypeChanged,
} = require('./hsnMapping');

console.log('Starting HSN Mapping & Assignment Tests...');

// 1. Vitrified Tests
{
  const p1 = resolveHsnCategory({ sku: 'VIT-60120-8.50-GLO-MAR-WHIT-00-001', productType: 'Vitrified' });
  assert.strictEqual(p1, 'vitrified', 'VIT- prefix must map to vitrified');

  const p2 = resolveHsnCategory({ bodyType: 'Porcelain', name: 'Carara White' });
  assert.strictEqual(p2, 'vitrified', 'Porcelain bodyType must map to vitrified');

  const p3 = resolveHsnCategory({ productType: 'GVT Polished' });
  assert.strictEqual(p3, 'vitrified', 'GVT must map to vitrified');

  const p4 = resolveHsnCategory({ tileCategory: 'PGVT Slabs' });
  assert.strictEqual(p4, 'vitrified', 'PGVT must map to vitrified');

  const p5 = resolveHsnCategory({ productType: 'Double Charge Heavy Duty' });
  assert.strictEqual(p5, 'vitrified', 'Double charge must map to vitrified');

  const p6 = resolveHsnCategory({ bodyType: 'Full Body Vitrified' });
  assert.strictEqual(p6, 'vitrified', 'Full body must map to vitrified');
  console.log('✔ Test 1: Vitrified / Porcelain detection verified');
}

// 2. Adhesive Tests
{
  const a1 = resolveHsnCategory({ isAdhesive: true });
  assert.strictEqual(a1, 'tileAdhesive', 'isAdhesive === true must map to tileAdhesive');

  const a2 = resolveHsnCategory({}, 'PROD_ADH_LX01');
  assert.strictEqual(a2, 'tileAdhesive', 'PROD_ADH_ prefix must map to tileAdhesive');

  const a3 = resolveHsnCategory({ sku: 'ITA-LX-03W' });
  assert.strictEqual(a3, 'tileAdhesive', 'ITA-LX-03W SKU must map to tileAdhesive');
  console.log('✔ Test 2: Tile Adhesive detection verified');
}

// 3. Ceramic Wall & Floor Tests
{
  const cw = resolveHsnCategory({ productType: 'Ceramic', tileCategory: 'Wall Tiles' });
  assert.strictEqual(cw, 'ceramicWall', 'Ceramic + Wall must map to ceramicWall');

  const cf = resolveHsnCategory({ productType: 'Ceramic', tileCategory: 'Floor Tiles' });
  assert.strictEqual(cf, 'ceramicFloor', 'Ceramic + Floor must map to ceramicFloor');
  console.log('✔ Test 3: Ceramic Wall & Floor detection verified');
}

// 4. Unmapped Tests
{
  const u1 = resolveHsnCategory({ sku: 'DEMO-001', name: 'DEMO', productType: 'Adhesives' }, 'O5b6jtBrylI7BJNZ2tWz');
  assert.strictEqual(u1, null, 'Non-official demo adhesive must be unmapped');

  const u2 = resolveHsnCategory({ productType: 'Unknown Material', sku: 'MISC-123' });
  assert.strictEqual(u2, null, 'Unknown tile type must be unmapped');
  console.log('✔ Test 4: Unmapped items handled safely without guessing');
}

// 5. Type Change Detection Tests
{
  const before = { productType: 'Vitrified', sku: 'VIT-001', basePrice: 100, currentStock: 50 };
  const afterNoChange = { productType: 'Vitrified', sku: 'VIT-001', basePrice: 120, currentStock: 40 };
  assert.strictEqual(hasTileTypeChanged(before, afterNoChange), false, 'Price/stock changes must not flag as type changed');

  const afterTypeChange = { productType: 'Ceramic', tileCategory: 'Wall Tiles', sku: 'CER-001' };
  assert.strictEqual(hasTileTypeChanged(before, afterTypeChange), true, 'ProductType change must flag as type changed');
  console.log('✔ Test 5: Tile type change detection verified');
}

console.log('\n====================================================');
console.log('ALL HSN ASSIGNMENT TESTS PASSED!');
console.log('====================================================\n');

