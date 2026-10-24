/**
 * scripts/inspect_six_adhesives.js
 * Inspects the 6 adhesive docs in Firestore and checks references across all collections.
 */

const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

const SIX_DOCS = [
  'PROD_ADH_LX01',
  'PROD_ADH_LX02',
  'PROD_ADH_LX03',
  'PROD_ADH_LX03W',
  'PROD_ADH_LX04',
  'PROD_ADH_LX04W',
];

async function inspect() {
  console.log('--- Inspecting the 6 Adhesive Products in Firestore ---');

  for (const docId of SIX_DOCS) {
    const docSnap = await db.collection('products').doc(docId).get();
    if (!docSnap.exists) {
      console.log(`Doc ${docId} does NOT exist in 'products'`);
      continue;
    }

    const data = docSnap.data();
    console.log(`\n========================================`);
    console.log(`Doc ID: ${docId}`);
    console.log(`Name: ${data.name}`);
    console.log(`Price: ${data.price} (${typeof data.price}), BasePrice: ${data.basePrice} (${typeof data.basePrice})`);
    console.log(`CreatedAt: ${data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : 'none'}`);
    console.log(`UpdatedAt: ${data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : 'none'}`);
    console.log(`Fields Present (${Object.keys(data).length}):`, Object.keys(data).join(', '));

    // Check references in orders
    const ordersSnap = await db.collection('orders').where('productIds', 'array-contains', docId).get().catch(() => ({ size: 0 }));
    // Check references in carts
    const cartsSnap = await db.collection('carts').where('itemIds', 'array-contains', docId).get().catch(() => ({ size: 0 }));
    // Check references in wishlists
    const wishlistsSnap = await db.collection('wishlists').where('productIds', 'array-contains', docId).get().catch(() => ({ size: 0 }));
    // Check references in estimates/quotations
    const estimatesSnap = await db.collection('estimates').where('productIds', 'array-contains', docId).get().catch(() => ({ size: 0 }));

    console.log(`References: Orders=${ordersSnap.size}, Carts=${cartsSnap.size}, Wishlists=${wishlistsSnap.size}, Estimates=${estimatesSnap.size}`);
  }
}

inspect().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
