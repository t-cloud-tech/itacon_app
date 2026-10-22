/**
 * scripts/setTrendingTiles.js
 * 
 * Safely marks ONLY the 4 approved tiles as isTrending: true with trendingOrder: 1-4.
 */

const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

const TRENDING_TILES = [
  { id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_003', name: 'ITA 003-MG SILVER SATUARIO', order: 1 },
  { id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_005', name: 'ITA 005-MG OIKOS BLUE', order: 2 },
  { id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_010', name: 'ITA 010-MG OMANI BEIGE', order: 3 },
  { id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_006', name: 'ITA 006-MG ASHER GREY', order: 4 },
];

async function applyTrending() {
  console.log('Setting isTrending: true and trendingOrder on approved tiles...');
  const batch = db.batch();

  for (const t of TRENDING_TILES) {
    const tileRef = db.collection('tiles').doc(t.id);
    const prodRef = db.collection('products').doc(t.id);

    batch.update(tileRef, {
      isTrending: true,
      trendingOrder: t.order,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(prodRef, {
      isTrending: true,
      trendingOrder: t.order,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`- Staged: ${t.name} (${t.id}) -> order ${t.order}`);
  }

  await batch.commit();
  console.log('>>> Successfully updated 4 tiles in Firestore!');
}

applyTrending().catch(err => {
  console.error('Failed to set trending tiles:', err);
  process.exit(1);
});
