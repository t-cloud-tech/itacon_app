const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}
const db = admin.firestore();

async function checkIsActive() {
  console.log('Querying products where isActive == true:');
  const snap = await db.collection('products').where('isActive', '==', true).get();
  console.log(`Number of docs with isActive == true in products: ${snap.size}`);

  const snapAll = await db.collection('products').get();
  let hasIsActiveTrue = 0;
  let hasIsActiveFalse = 0;
  let missingIsActive = 0;

  snapAll.forEach(d => {
    const data = d.data();
    if (data.isActive === true) hasIsActiveTrue++;
    else if (data.isActive === false) hasIsActiveFalse++;
    else missingIsActive++;
  });

  console.log(`In products: isActive: true = ${hasIsActiveTrue}, isActive: false = ${hasIsActiveFalse}, missing isActive = ${missingIsActive}`);

  console.log('\nQuerying tiles where isActive == true:');
  const snapTiles = await db.collection('tiles').where('isActive', '==', true).get();
  console.log(`Number of docs with isActive == true in tiles: ${snapTiles.size}`);

  let tileIsActiveTrue = 0;
  let tileIsActiveFalse = 0;
  let tileMissingIsActive = 0;

  const snapAllTiles = await db.collection('tiles').get();
  snapAllTiles.forEach(d => {
    const data = d.data();
    if (data.isActive === true) tileIsActiveTrue++;
    else if (data.isActive === false) tileIsActiveFalse++;
    else tileMissingIsActive++;
  });

  console.log(`In tiles: isActive: true = ${tileIsActiveTrue}, isActive: false = ${tileIsActiveFalse}, missing isActive = ${tileMissingIsActive}`);
}

checkIsActive().catch(console.error);
