const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

async function runTests() {
  console.log('=== TEST 1: Query isTrending: true from tiles ===');
  const snap = await db.collection('tiles').where('isTrending', '==', true).get();
  console.log(`Found ${snap.size} trending tiles.`);

  const tiles = [];
  snap.forEach(doc => {
    tiles.push({ id: doc.id, ...doc.data() });
  });

  // Sort by trendingOrder ascending
  tiles.sort((a, b) => (a.trendingOrder ?? 999) - (b.trendingOrder ?? 999));

  console.log('Ordered trending tiles:');
  tiles.forEach((t, i) => {
    console.log(`  [#${i + 1}] order: ${t.trendingOrder} | ${t.id} | name: "${t.name}" | size: ${t.size} | price: ₹${t.basePrice} | isActive: ${t.isActive}`);
  });

  if (tiles.length !== 4) {
    throw new Error(`Expected exactly 4 trending tiles, got ${tiles.length}`);
  }

  const expectedOrder = [
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_003',
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_005',
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_010',
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_006',
  ];

  for (let i = 0; i < 4; i++) {
    if (tiles[i].id !== expectedOrder[i]) {
      throw new Error(`Order mismatch at position ${i}: expected ${expectedOrder[i]}, got ${tiles[i].id}`);
    }
    if (tiles[i].trendingOrder !== i + 1) {
      throw new Error(`trendingOrder mismatch: expected ${i + 1}, got ${tiles[i].trendingOrder}`);
    }
  }
  console.log('✓ TEST 1 PASSED: 4 tiles returned in exact approved order.');

  console.log('\n=== TEST 2: Test refill fallback if one tile is untrended ===');
  const tile4Id = expectedOrder[3];
  await db.collection('tiles').doc(tile4Id).update({ isTrending: false });
  console.log(`Temporarily set ${tile4Id} isTrending = false`);

  // Query again
  const snap2 = await db.collection('tiles').where('isTrending', '==', true).get();
  const trending2 = [];
  snap2.forEach(doc => {
    const d = doc.data();
    if (d.isActive) trending2.push({ id: doc.id, ...d });
  });
  trending2.sort((a, b) => (a.trendingOrder ?? 999) - (b.trendingOrder ?? 999));

  console.log(`Trending query returned ${trending2.length} tiles (needs refill to 4).`);

  // Simulate refill logic
  const existingIds = new Set(trending2.map(t => t.id));
  const refillSnap = await db.collection('tiles').where('isActive', '==', true).limit(9).get();
  refillSnap.forEach(doc => {
    if (!existingIds.has(doc.id) && trending2.length < 4) {
      trending2.push({ id: doc.id, ...doc.data() });
      existingIds.add(doc.id);
    }
  });

  console.log(`After refill: total ${trending2.length} tiles.`);
  trending2.forEach((t, i) => {
    console.log(`  [#${i + 1}] ${t.id} | isTrending: ${t.isTrending} | order: ${t.trendingOrder}`);
  });

  if (trending2.length !== 4) {
    throw new Error(`Refill failed to produce 4 tiles`);
  }
  console.log('✓ TEST 2 PASSED: Refill mechanism successfully fills up to 4 items.');

  console.log('\n=== RESTORING TEST 2 TILE ===');
  await db.collection('tiles').doc(tile4Id).update({ isTrending: true, trendingOrder: 4 });
  console.log(`Restored ${tile4Id} isTrending = true, trendingOrder = 4`);

  console.log('\n=== VERIFYING FINAL STATE ===');
  const finalSnap = await db.collection('tiles').where('isTrending', '==', true).get();
  console.log(`Final trending tiles count in Firestore: ${finalSnap.size}`);
  finalSnap.forEach(doc => {
    console.log(`  ${doc.id} -> isTrending: ${doc.data().isTrending}, trendingOrder: ${doc.data().trendingOrder}`);
  });

  console.log('\nALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
