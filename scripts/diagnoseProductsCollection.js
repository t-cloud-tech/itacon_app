const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

async function diagnose() {
  console.log('=== STEP 1: FETCHING ALL PRODUCTS DOCS ===');
  const productsSnap = await db.collection('products').get();
  console.log(`Total documents in 'products': ${productsSnap.size}`);

  const tilesSnap = await db.collection('tiles').get();
  console.log(`Total documents in 'tiles': ${tilesSnap.size}`);

  const priceLogsSnap = await db.collection('priceChangeLogs').get();
  console.log(`Total documents in 'priceChangeLogs': ${priceLogsSnap.size}`);
  priceLogsSnap.forEach(d => {
    console.log(`priceChangeLog [${d.id}]:`, JSON.stringify(d.data(), null, 2));
  });

  const allProducts = [];
  productsSnap.forEach(doc => {
    const data = doc.data();
    const fields = Object.keys(data);
    
    // Check required fields per TileProduct model:
    // name, size/unit, basePrice/price, images/imageUrl, categoryId/tileCategory/category
    const missing = [];
    if (!data.name) missing.push('name');
    if (!data.size && !data.unit) missing.push('size/unit');
    if (data.basePrice === undefined && data.price === undefined) missing.push('price');
    if ((!data.images || data.images.length === 0) && !data.imageUrl) missing.push('images');
    if (!data.categoryId && !data.tileCategory && !data.category) missing.push('category');

    allProducts.push({
      id: doc.id,
      name: data.name || '(NO NAME)',
      category: data.tileCategory || data.category || data.categoryId || '(NO CATEGORY)',
      productLine: data.productLine || '(none)',
      price: data.basePrice ?? data.price ?? '(none)',
      numFields: fields.length,
      createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
      updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null,
      missingFields: missing,
      data
    });
  });

  console.log('\n=== FIXING SOLUTIONS / ADHESIVE PRODUCTS IN products ===');
  const adhesives = allProducts.filter(p => 
    (p.name && p.name.toLowerCase().includes('adhesive')) ||
    (p.name && p.name.toLowerCase().includes('lx-')) ||
    (p.category && p.category.toLowerCase().includes('fixing')) ||
    (p.category && p.category.toLowerCase().includes('adhesive')) ||
    (p.productLine && p.productLine.toLowerCase().includes('adhesive')) ||
    p.id.toLowerCase().includes('adh') ||
    p.id.toLowerCase().includes('lx')
  );

  console.log(`Found ${adhesives.length} adhesive/fixing related products in 'products':`);
  adhesives.forEach(a => {
    console.log(`ID: ${a.id} | Name: "${a.name}" | Cat: ${a.category} | Price: ${a.price} | Fields: ${a.numFields} | Created: ${a.createdAt} | Updated: ${a.updatedAt} | Missing: [${a.missingFields.join(', ')}]`);
  });

  console.log('\n=== FIXING SOLUTIONS / ADHESIVE PRODUCTS IN tiles ===');
  const tilesAdhesives = [];
  tilesSnap.forEach(doc => {
    const data = doc.data();
    if (
      (data.name && data.name.toLowerCase().includes('adhesive')) ||
      (data.name && data.name.toLowerCase().includes('lx-')) ||
      (data.category && data.category.toLowerCase().includes('fixing')) ||
      (data.category && data.category.toLowerCase().includes('adhesive')) ||
      (data.productLine && data.productLine.toLowerCase().includes('adhesive')) ||
      doc.id.toLowerCase().includes('adh') ||
      doc.id.toLowerCase().includes('lx')
    ) {
      tilesAdhesives.push({
        id: doc.id,
        name: data.name,
        price: data.basePrice ?? data.price,
        created: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
        updated: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null,
      });
    }
  });
  console.log(`Found ${tilesAdhesives.length} adhesive/fixing related docs in 'tiles':`);
  tilesAdhesives.forEach(a => {
    console.log(`ID: ${a.id} | Name: "${a.name}" | Price: ${a.price} | Created: ${a.created} | Updated: ${a.updated}`);
  });

  console.log('\n=== CHECKING FOR MISSING REQUIRED FIELDS ACROSS ALL 309 PRODUCTS ===');
  const invalidProducts = allProducts.filter(p => p.missingFields.length > 0);
  console.log(`Products with missing required fields: ${invalidProducts.length}`);
  invalidProducts.forEach(p => {
    console.log(`  ID: ${p.id} | Name: "${p.name}" | Missing: [${p.missingFields.join(', ')}] | Fields count: ${p.numFields}`);
  });

  console.log('\n=== CHECKING REFERENCES FOR THE 6 NEW DOCS (PROD_ADH_LX...) ===');
  const candidateNewIds = ['PROD_ADH_LX01', 'PROD_ADH_LX02', 'PROD_ADH_LX03', 'PROD_ADH_LX03W', 'PROD_ADH_LX04', 'PROD_ADH_LX04W'];
  
  // Collections to check: orders, salesOrders, quotations, carts, wishlists
  const collectionsToCheck = ['orders', 'salesOrders', 'quotations', 'carts', 'wishlists'];
  for (const collName of collectionsToCheck) {
    const snap = await db.collection(collName).get();
    let refCount = 0;
    snap.forEach(doc => {
      const str = JSON.stringify(doc.data());
      for (const id of candidateNewIds) {
        if (str.includes(id)) {
          console.log(`REFERENCE FOUND in ${collName} doc [${doc.id}] for ${id}`);
          refCount++;
        }
      }
    });
    console.log(`Checked collection '${collName}' (${snap.size} docs) -> references to candidate IDs: ${refCount}`);
  }

  // Also check subcollections if any, e.g. carts under users or root
  const usersSnap = await db.collection('users').get();
  console.log(`Checking user cart/wishlist subcollections across ${usersSnap.size} users...`);
  let userSubRefCount = 0;
  for (const uDoc of usersSnap.docs) {
    const uCart = await db.collection('users').doc(uDoc.id).collection('cart').get();
    uCart.forEach(item => {
      const str = JSON.stringify(item.data());
      for (const id of candidateNewIds) {
        if (str.includes(id)) {
          console.log(`REFERENCE FOUND in users/${uDoc.id}/cart/${item.id} for ${id}`);
          userSubRefCount++;
        }
      }
    });
    const uWish = await db.collection('users').doc(uDoc.id).collection('wishlist').get();
    uWish.forEach(item => {
      const str = JSON.stringify(item.data());
      for (const id of candidateNewIds) {
        if (str.includes(id)) {
          console.log(`REFERENCE FOUND in users/${uDoc.id}/wishlist/${item.id} for ${id}`);
          userSubRefCount++;
        }
      }
    });
  }
  console.log(`Total user subcollection references found: ${userSubRefCount}`);
}

diagnose().catch(err => {
  console.error('Diagnosis error:', err);
  process.exit(1);
});
