/**
 * scripts/inspectCandidateTiles.js
 * 
 * Fetches 15 diverse candidate tiles with mockup images for the Trending Collection.
 */

const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}

const db = admin.firestore();

async function main() {
  const snap = await db.collection('tiles')
    .where('productLine', '==', 'tiles')
    .where('isActive', '==', true)
    .where('inStock', '==', true)
    .get();

  const list = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.mockupImages && data.mockupImages.length > 0 && data.mockupImages[0]) {
      list.push({
        id: d.id,
        name: data.name,
        size: data.size,
        surface: data.surface || data.finish || 'Glossy',
        collection: data.collection,
        color: data.color || data.baseColor || 'N/A',
        price: data.basePrice !== undefined ? data.basePrice : data.price,
        inStock: data.inStock,
        isActive: data.isActive,
        mockupPath: data.mockupImages[0],
        url: `https://firebasestorage.googleapis.com/v0/b/itacon-app.firebasestorage.app/o/${encodeURIComponent(data.mockupImages[0])}?alt=media`,
      });
    }
  });

  const selectedIds = [
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_001', // ITA 001-ADLINE SATUARIO (White Statuario Marble)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_003', // ITA 003-MG SILVER SATUARIO (Silver Statuario Marble Endless)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_005', // ITA 005-MG OIKOS BLUE (Exotic Blue Marble Endless)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_006', // ITA 006-MG ASHER GREY (Contemporary Grey Marble Endless)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_008', // ITA 008-MG LEAVES BLUE (Floral Décor Endless)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_009', // ITA 009-MG LEAVES BROWN (Earthy Floral Décor Endless)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_010', // ITA 010-MG OMANI BEIGE (Warm Luxury Omani Beige Marble)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_014', // ITA 014-DYNA CLASSIC IVORY (Classic Crema / Ivory Dyna)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_025', // ITA 025-MG PANOZZO GREEN (Bold Emerald Green Marble)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_033', // ITA 033-MG ELDORADO GOLD (Royal Gold Veined Marble)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_060', // Super White (Pure Minimalist White)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_089',    // BAYAZ BIANCO (Italian Bianco Carrara)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_097',    // CRYSTAL TRAVERTINO BEIGE (Architectural Travertine)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_100',    // DYNA BROWN (Deep Earth Dyna Brown)
    'PROD_VIT_60120_8_50_GLO_MAR_WHIT_104',    // DYNA FANTASTICO (Rich Warm Fantastic Onyx)
  ];

  const candidates = [];
  for (const id of selectedIds) {
    const item = list.find(x => x.id === id);
    if (item) candidates.push(item);
  }

  console.log(JSON.stringify(candidates, null, 2));
}

main().catch(console.error);
