const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

async function inspectAll() {
  const prodSnap = await db.collection('products').get();
  console.log(`Total docs in products: ${prodSnap.size}`);

  // Let's list all docs that do NOT start with PROD_VIT_
  console.log('\nDocs in products not starting with PROD_VIT_:');
  prodSnap.forEach(doc => {
    if (!doc.id.startsWith('PROD_VIT_')) {
      console.log(`  ${doc.id} => name: "${doc.data().name}", price: ${doc.data().basePrice ?? doc.data().price}`);
    }
  });

  // Check how many start with PROD_VIT_
  let vitCount = 0;
  prodSnap.forEach(doc => {
    if (doc.id.startsWith('PROD_VIT_')) {
      vitCount++;
    }
  });
  console.log(`\nDocs starting with PROD_VIT_: ${vitCount}`);
  console.log(`Total: ${vitCount} + 6 = ${vitCount + 6}`);

  // Let's also check tiles collection
  const tilesSnap = await db.collection('tiles').get();
  console.log(`\nTotal docs in tiles: ${tilesSnap.size}`);
  console.log('Docs in tiles not starting with PROD_VIT_:');
  tilesSnap.forEach(doc => {
    if (!doc.id.startsWith('PROD_VIT_')) {
      console.log(`  ${doc.id} => name: "${doc.data().name}", price: ${doc.data().basePrice ?? doc.data().price}`);
    }
  });
}

inspectAll().catch(console.error);
