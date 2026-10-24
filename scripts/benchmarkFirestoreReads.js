const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}
const db = admin.firestore();

async function benchmark() {
  console.log('=== BENCHMARK 1: Trending Tiles Query ===');
  const t0 = Date.now();
  const trendingSnap = await db.collection('tiles').where('isTrending', '==', true).get();
  const t1 = Date.now();
  console.log(`Trending query took: ${t1 - t0} ms. Returned docs: ${trendingSnap.size}`);
  trendingSnap.forEach(d => {
    console.log(`  ${d.id} | ${d.data().name} | isTrending: ${d.data().isTrending} | order: ${d.data().trendingOrder}`);
  });

  console.log('\n=== BENCHMARK 2: Full Products Catalogue Query (All products where isActive == true) ===');
  const t2 = Date.now();
  const productsSnap = await db.collection('products').where('isActive', '==', true).get();
  const t3 = Date.now();
  console.log(`Products query took: ${t3 - t2} ms. Returned docs: ${productsSnap.size}`);

  let totalJsonBytes = 0;
  productsSnap.forEach(d => {
    totalJsonBytes += JSON.stringify(d.data()).length;
  });
  console.log(`Total payload size downloaded for products: ${(totalJsonBytes / 1024).toFixed(1)} KB`);

  console.log('\n=== BENCHMARK 3: Full Tiles Catalogue Query (All tiles where isActive == true) ===');
  const t4 = Date.now();
  const tilesSnap = await db.collection('tiles').where('isActive', '==', true).get();
  const t5 = Date.now();
  console.log(`Tiles query took: ${t5 - t4} ms. Returned docs: ${tilesSnap.size}`);

  let totalTilesBytes = 0;
  tilesSnap.forEach(d => {
    totalTilesBytes += JSON.stringify(d.data()).length;
  });
  console.log(`Total payload size downloaded for tiles: ${(totalTilesBytes / 1024).toFixed(1)} KB`);
}

benchmark().catch(console.error);
