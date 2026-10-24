const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

async function checkDocs() {
  const prodSnap = await db.collection('products').get();
  console.log('Real count in products:', prodSnap.size);

  // Group by category / productLine
  const countsByLine = {};
  const countsByCategory = {};
  prodSnap.forEach(d => {
    const data = d.data();
    const pl = data.productLine || 'none';
    const cat = data.tileCategory || data.category || data.categoryId || 'none';
    countsByLine[pl] = (countsByLine[pl] || 0) + 1;
    countsByCategory[cat] = (countsByCategory[cat] || 0) + 1;
  });

  console.log('Counts by productLine in products:', countsByLine);
  console.log('Counts by category in products:', countsByCategory);

  // Check createdAt timestamps
  const createdTimes = [];
  prodSnap.forEach(d => {
    const data = d.data();
    if (data.createdAt) {
      createdTimes.push({
        id: d.id,
        name: data.name,
        created: data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
      });
    }
  });

  createdTimes.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  console.log('\nTop 15 most recently created docs in products:');
  createdTimes.slice(0, 15).forEach(c => console.log(`  ${c.id} | ${c.name} | ${c.created}`));

  // Check if there are any other collections with 'product' or 'tile' in their name
  const collections = await db.listCollections();
  console.log('\nAll Root Collections in Firestore:');
  collections.forEach(c => console.log('  -', c.id));
}

checkDocs().catch(console.error);
