/**
 * scripts/audit_products_data.js
 * Read-only script auditing all docs in 'products' and 'tiles' collections.
 */

const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

async function audit() {
  console.log('Auditing Firestore products and tiles...');
  const prodSnap = await db.collection('products').get();
  console.log(`Total 'products' docs: ${prodSnap.docs.length}`);

  const anomalies = [];
  const fixingSolutions = [];

  for (const doc of prodSnap.docs) {
    const data = doc.data();
    const id = doc.id;

    const price = data.price ?? data.basePrice;
    const priceType = typeof price;
    const isPriceNumber = priceType === 'number';

    const name = data.name;
    const size = data.size;
    const images = data.images;
    const hasImages = Array.isArray(images) && images.length > 0;

    const isAdhesive = id.startsWith('PROD_ADH_') || data.category === 'Fixing Solutions' || data.productLine === 'adhesives';

    if (isAdhesive) {
      fixingSolutions.push({
        id,
        name,
        price,
        priceType,
        basePrice: data.basePrice,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
      });
    }

    if (!isPriceNumber || !name || !size || !hasImages) {
      anomalies.push({
        id,
        name: name || '[MISSING]',
        size: size || '[MISSING]',
        price,
        priceType,
        imagesCount: Array.isArray(images) ? images.length : (images ? 'not-array' : 0),
        reason: [
          !isPriceNumber ? `Price is ${priceType} (${price})` : null,
          !name ? 'Missing name' : null,
          !size ? 'Missing size' : null,
          !hasImages ? 'Empty or missing images' : null,
        ].filter(Boolean).join('; '),
      });
    }
  }

  console.log(`\n--- Fixing Solutions Products (${fixingSolutions.length}) ---`);
  console.table(fixingSolutions);

  console.log(`\n--- Anomalies / Potential Issue Docs (${anomalies.length}) ---`);
  console.table(anomalies);

  // Check references in orders, carts, wishlists
  console.log('\n--- Checking references for Adhesive / 6 docs ---');
  for (const fs of fixingSolutions) {
    const cartMatches = await db.collection('carts').where('items', 'array-contains', fs.id).get().catch(() => ({ size: 0 }));
    // Also query collectionGroup or subcollections if any
    console.log(`Doc ${fs.id} (${fs.name}) -> Cart matches: ${cartMatches.size}`);
  }
}

audit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
