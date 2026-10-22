/**
 * scripts/updateFixingSolutionPrices.js
 * 
 * Script to safely inspect and apply prices for the 6 "Fixing Solutions" products in Firestore.
 * 
 * Usage:
 *   node scripts/updateFixingSolutionPrices.js           # DRY RUN (read-only, reports findings)
 *   node scripts/updateFixingSolutionPrices.js --apply   # APPLY (applies updates, writes priceChangeLogs)
 */

const admin = require('../functions/node_modules/firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

// 6 Fixing Solutions products specification
const FIXING_PRODUCTS = [
  {
    id: 'PROD_ADH_LX01',
    productId: 'PROD_ADH_LX01',
    sku: 'ITA-LX-01',
    name: 'ITA LX-01 Tile Adhesive (Type-1 C1T, 20 kg)',
    productName: 'ITA LX-01 Tile Adhesive (Type-1 C1T, 20 kg)',
    productLine: 'adhesives',
    tileCategory: 'Fixing Solutions',
    collection: 'Fixing Solutions',
    category: 'Fixing Solutions',
    categoryId: 'CAT_ADHESIVES',
    categoryName: 'Fixing Solutions',
    classification: 'TYPE-1 (C1T)',
    color: 'Grey',
    oldBasePrice: 150.0,
    newBasePrice: 200.0,
    unit: 'bag',
    bagWeightKg: 20.0,
    size: '20 kg Bag',
    surface: 'TYPE-1 (C1T)',
    pattern: 'Polymer Cementitious',
    moq: 1,
    stockStatus: 'available_now',
    availableQuantity: 1000,
    productType: 'Adhesives',
    bodyType: 'Polymer Cement Matrix',
    thickness: 'Type-1 C1T',
    boxWeightKg: 20.0,
    sqFtPerBox: 55.0,
    images: ['products/adhesives/ITA-LX-01.png'],
    usageTileSizes: 'Floor 2x2, Wall 12x18, Parking Tiles 16x16, 12x12',
    applicationNotes: 'Standard interior floor & wall ceramic/vitrified tiling.',
    isActive: true,
  },
  {
    id: 'PROD_ADH_LX02',
    productId: 'PROD_ADH_LX02',
    sku: 'ITA-LX-02',
    name: 'ITA LX-02 Tile Adhesive (Type-2 C2T, 20 kg)',
    productName: 'ITA LX-02 Tile Adhesive (Type-2 C2T, 20 kg)',
    productLine: 'adhesives',
    tileCategory: 'Fixing Solutions',
    collection: 'Fixing Solutions',
    category: 'Fixing Solutions',
    categoryId: 'CAT_ADHESIVES',
    categoryName: 'Fixing Solutions',
    classification: 'TYPE-2 (C2T)',
    color: 'Grey',
    oldBasePrice: 185.0,
    newBasePrice: 235.0,
    unit: 'bag',
    bagWeightKg: 20.0,
    size: '20 kg Bag',
    surface: 'TYPE-2 (C2T)',
    pattern: 'Polymer Cementitious',
    moq: 1,
    stockStatus: 'available_now',
    availableQuantity: 1000,
    productType: 'Adhesives',
    bodyType: 'Polymer Cement Matrix',
    thickness: 'Type-2 C2T',
    boxWeightKg: 20.0,
    sqFtPerBox: 50.0,
    images: ['products/adhesives/ITA-LX-02.png'],
    usageTileSizes: '300x600, 300x450 Wall, 800x800, 600x1200 upto 10 ft.',
    applicationNotes: 'Interior & Exterior Wall or Floor tile-on-tile, high dip elevation.',
    isActive: true,
  },
  {
    id: 'PROD_ADH_LX03',
    productId: 'PROD_ADH_LX03',
    sku: 'ITA-LX-03',
    name: 'ITA LX-03 Tile Adhesive (Type-3 C2TE, 20 kg)',
    productName: 'ITA LX-03 Tile Adhesive (Type-3 C2TE, 20 kg)',
    productLine: 'adhesives',
    tileCategory: 'Fixing Solutions',
    collection: 'Fixing Solutions',
    category: 'Fixing Solutions',
    categoryId: 'CAT_ADHESIVES',
    categoryName: 'Fixing Solutions',
    classification: 'TYPE-3 (C2TE)',
    color: 'Grey',
    oldBasePrice: 220.0,
    newBasePrice: 270.0,
    unit: 'bag',
    bagWeightKg: 20.0,
    size: '20 kg Bag',
    surface: 'TYPE-3 (C2TE)',
    pattern: 'Polymer Cementitious',
    moq: 1,
    stockStatus: 'available_now',
    availableQuantity: 1000,
    productType: 'Adhesives',
    bodyType: 'Polymer Cement Matrix',
    thickness: 'Type-3 C2TE',
    boxWeightKg: 20.0,
    sqFtPerBox: 45.0,
    images: ['products/adhesives/ITA-LX-03.png'],
    usageTileSizes: '1000x1000, 800x1600 upto 10 ft., 600x1200 upto 20 ft., 200x1200 Wooden Plank.',
    applicationNotes: 'Wall and floor heavy vitrified tiles, window/door framing with marble, continuous sunlight exposure.',
    isActive: true,
  },
  {
    id: 'PROD_ADH_LX03W',
    productId: 'PROD_ADH_LX03W',
    sku: 'ITA-LX-03W',
    name: 'ITA LX-03W White Tile Adhesive (Type-3 White C2TE)',
    productName: 'ITA LX-03W White Tile Adhesive (Type-3 White C2TE)',
    productLine: 'adhesives',
    tileCategory: 'Fixing Solutions',
    collection: 'Fixing Solutions',
    category: 'Fixing Solutions',
    categoryId: 'CAT_ADHESIVES',
    categoryName: 'Fixing Solutions',
    classification: 'TYPE-3 (WHITE) (C2TE)',
    color: 'White',
    oldBasePrice: 310.0,
    newBasePrice: 360.0,
    unit: 'bag',
    bagWeightKg: 20.0,
    size: '20 kg Bag',
    surface: 'TYPE-3 (WHITE) (C2TE)',
    pattern: 'White Polymer Cementitious',
    moq: 1,
    stockStatus: 'available_now',
    availableQuantity: 1000,
    productType: 'Adhesives',
    bodyType: 'White Polymer Cement Matrix',
    thickness: 'Type-3 White',
    boxWeightKg: 20.0,
    sqFtPerBox: 45.0,
    images: ['products/adhesives/ITA-LX-03W.png'],
    usageTileSizes: 'Composite Marble, Glass Mosaics, White Stones',
    applicationNotes: 'Pure white adhesive for composite marble, glass mosaics, and external walls exposed to continuous sunlight.',
    isActive: true,
  },
  {
    id: 'PROD_ADH_LX04',
    productId: 'PROD_ADH_LX04',
    sku: 'ITA-LX-04',
    name: 'ITA LX-04 Tile Adhesive (Type-4 C2TES1)',
    productName: 'ITA LX-04 Tile Adhesive (Type-4 C2TES1)',
    productLine: 'adhesives',
    tileCategory: 'Fixing Solutions',
    collection: 'Fixing Solutions',
    category: 'Fixing Solutions',
    categoryId: 'CAT_ADHESIVES',
    categoryName: 'Fixing Solutions',
    classification: 'TYPE-4 (C2TES1)',
    color: 'Grey',
    oldBasePrice: 290.0,
    newBasePrice: 340.0,
    unit: 'bag',
    bagWeightKg: 20.0,
    size: '20 kg Bag',
    surface: 'TYPE-4 (C2TES1)',
    pattern: 'High-Polymer Matrix',
    moq: 1,
    stockStatus: 'available_now',
    availableQuantity: 1000,
    productType: 'Adhesives',
    bodyType: 'High Polymer Matrix',
    thickness: 'Type-4 C2TES1',
    boxWeightKg: 20.0,
    sqFtPerBox: 40.0,
    images: ['products/adhesives/ITA-LX-04.png'],
    usageTileSizes: '1200x1800, 1200x1200, 1200x1600, 800x2400, Slabs, Marble and Granite.',
    applicationNotes: 'High-flex polymer adhesive for large format slabs, elevation facades, and thermal expansion zones.',
    isActive: true,
  },
  {
    id: 'PROD_ADH_LX04W',
    productId: 'PROD_ADH_LX04W',
    sku: 'ITA-LX-04W',
    name: 'ITA LX-04 White Tile Adhesive (Type-4 White)',
    productName: 'ITA LX-04 White Tile Adhesive (Type-4 White)',
    productLine: 'adhesives',
    tileCategory: 'Fixing Solutions',
    collection: 'Fixing Solutions',
    category: 'Fixing Solutions',
    categoryId: 'CAT_ADHESIVES',
    categoryName: 'Fixing Solutions',
    classification: 'TYPE-4 (WHITE) (C2TES1)',
    color: 'White',
    oldBasePrice: 380.0,
    newBasePrice: 430.0,
    unit: 'bag',
    bagWeightKg: 20.0,
    size: '20 kg Bag',
    surface: 'TYPE-4 (WHITE) (C2TES1)',
    pattern: 'White High-Polymer Matrix',
    moq: 1,
    stockStatus: 'available_now',
    availableQuantity: 1000,
    productType: 'Adhesives',
    bodyType: 'White High Polymer Matrix',
    thickness: 'Type-4 White C2TES1',
    boxWeightKg: 20.0,
    sqFtPerBox: 40.0,
    images: ['products/adhesives/ITA-LX-04W.png'],
    usageTileSizes: '1200x1800 Jumbo Slabs, Onyx Marble, Translucent Stones',
    applicationNotes: 'Premium white polymer adhesive for luxury translucent marble slabs and heavy-duty external sunlight applications.',
    isActive: true,
  },
];

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log('========================================================================');
  console.log(`FIXING SOLUTIONS PRICE UPDATE — ${isApply ? 'APPLY MODE' : 'DRY RUN'}`);
  console.log('========================================================================\n');

  console.log('Target products to update (+₹50):');
  const summaryTable = FIXING_PRODUCTS.map(p => ({
    docId: p.id,
    sku: p.sku,
    name: p.name,
    oldPrice: `₹${p.oldBasePrice}`,
    newPrice: `₹${p.newBasePrice}`,
    type: typeof p.newBasePrice,
  }));
  console.table(summaryTable);

  if (!isApply) {
    console.log('Dry run complete. Run with --apply to apply changes to Firestore.');
    return;
  }

  // STEP 2: APPLY MODE
  console.log('Checking safety conditions on Firestore products docs...');
  const batch = db.batch();
  const logDetails = [];

  for (const p of FIXING_PRODUCTS) {
    const prodRef = db.collection('products').doc(p.id);
    const tileRef = db.collection('tiles').doc(p.id);

    const existingSnap = await prodRef.get();
    if (existingSnap.exists) {
      const data = existingSnap.data() || {};
      const currentPrice = Number(data.basePrice || data.price);
      // SAFETY CHECK: only update if price still equals old price, preventing double-increments
      if (currentPrice === p.newBasePrice) {
        console.log(`[SAFETY SKIP] ${p.id} already has new price ₹${p.newBasePrice}. Skipping.`);
        continue;
      }
      if (currentPrice !== p.oldBasePrice) {
        throw new Error(`[SAFETY ABORT] ${p.id} price is ₹${currentPrice}, expected ₹${p.oldBasePrice}. Aborting.`);
      }

      batch.update(prodRef, {
        basePrice: p.newBasePrice,
        price: p.newBasePrice,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.update(tileRef, {
        basePrice: p.newBasePrice,
        price: p.newBasePrice,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Document does not exist yet: create complete product record with new price
      const docPayload = {
        id: p.id,
        productId: p.productId,
        sku: p.sku,
        name: p.name,
        productName: p.productName,
        productLine: p.productLine,
        tileCategory: p.tileCategory,
        collection: p.collection,
        category: p.category,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        classification: p.classification,
        color: p.color,
        basePrice: p.newBasePrice,
        price: p.newBasePrice,
        unit: p.unit,
        bagWeightKg: p.bagWeightKg,
        size: p.size,
        surface: p.surface,
        pattern: p.pattern,
        moq: p.moq,
        stockStatus: p.stockStatus,
        availableQuantity: p.availableQuantity,
        productType: p.productType,
        bodyType: p.bodyType,
        thickness: p.thickness,
        boxWeightKg: p.boxWeightKg,
        sqFtPerBox: p.sqFtPerBox,
        images: p.images,
        usageTileSizes: p.usageTileSizes,
        applicationNotes: p.applicationNotes,
        isActive: p.isActive,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      batch.set(prodRef, docPayload);
      batch.set(tileRef, docPayload);
    }

    logDetails.push({
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      oldPrice: p.oldBasePrice,
      newPrice: p.newBasePrice,
    });
  }

  // Record audit log in priceChangeLogs collection
  const logRef = db.collection('priceChangeLogs').doc();
  batch.set(logRef, {
    category: 'Fixing Solutions',
    priceIncrease: 50,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    appliedBy: 'scripts/updateFixingSolutionPrices.js',
    productsUpdated: logDetails,
  });

  await batch.commit();
  console.log(`\n>>> SUCCESS: Batch committed!`);
  console.log(`>>> Written to priceChangeLogs with log ID: ${logRef.id}`);
}

run().catch(err => {
  console.error('Fatal error applying price updates:', err);
  process.exit(1);
});
