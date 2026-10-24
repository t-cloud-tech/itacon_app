const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}
const db = admin.firestore();

function testParseDoc(map, docId) {
  const pId = map['productId'] || (docId ? docId : (map['id'] || ''));
  const colorVal = map['baseColour'] || map['color'] || map['baseColor'] || 'Grey';
  const sz = map['size'] || '20 kg Bag';
  const stStatus = map['stockStatus'] || 'available';

  // Dart: ((map['currentStock'] ?? map['availableQuantity'] ?? 500) as num).toInt();
  const rawCurrentStock = map['currentStock'] !== undefined ? map['currentStock'] : (map['availableQuantity'] !== undefined ? map['availableQuantity'] : 500);
  if (typeof rawCurrentStock !== 'number') {
    throw new Error(`currentStock/availableQuantity is not a number: ${typeof rawCurrentStock} (${rawCurrentStock})`);
  }

  const rawReservedStock = map['reservedStock'] !== undefined ? map['reservedStock'] : 0;
  if (typeof rawReservedStock !== 'number') {
    throw new Error(`reservedStock is not a number: ${typeof rawReservedStock} (${rawReservedStock})`);
  }

  const rawAvailableStock = map['availableStock'] !== undefined ? map['availableStock'] : (rawCurrentStock - rawReservedStock);
  if (typeof rawAvailableStock !== 'number') {
    throw new Error(`availableStock is not a number: ${typeof rawAvailableStock} (${rawAvailableStock})`);
  }

  // Dart: (map['sqFtPerBox'] as num?)?.toDouble();
  if (map['sqFtPerBox'] !== undefined && map['sqFtPerBox'] !== null && typeof map['sqFtPerBox'] !== 'number') {
    throw new Error(`sqFtPerBox is not a number: ${typeof map['sqFtPerBox']} (${map['sqFtPerBox']})`);
  }

  // Dart: (map['basePrice'] as num?)?.toDouble() ?? 0.0
  if (map['basePrice'] !== undefined && map['basePrice'] !== null && typeof map['basePrice'] !== 'number') {
    throw new Error(`basePrice is not a number: ${typeof map['basePrice']} (${map['basePrice']})`);
  }

  // Dart: (map['moq'] as num?)?.toInt() ?? 1
  if (map['moq'] !== undefined && map['moq'] !== null && typeof map['moq'] !== 'number') {
    throw new Error(`moq is not a number: ${typeof map['moq']} (${map['moq']})`);
  }

  // Dart: (map['thicknessMm'] as num?)?.toDouble() ?? 9.0
  if (map['thicknessMm'] !== undefined && map['thicknessMm'] !== null && typeof map['thicknessMm'] !== 'number') {
    throw new Error(`thicknessMm is not a number: ${typeof map['thicknessMm']} (${map['thicknessMm']})`);
  }

  // Dart: (map['boxWeightKg'] as num?)?.toDouble()
  if (map['boxWeightKg'] !== undefined && map['boxWeightKg'] !== null && typeof map['boxWeightKg'] !== 'number') {
    throw new Error(`boxWeightKg is not a number: ${typeof map['boxWeightKg']} (${map['boxWeightKg']})`);
  }

  // Dart: (map['pcsPerBox'] as num?)?.toInt()
  if (map['pcsPerBox'] !== undefined && map['pcsPerBox'] !== null && typeof map['pcsPerBox'] !== 'number') {
    throw new Error(`pcsPerBox is not a number: ${typeof map['pcsPerBox']} (${map['pcsPerBox']})`);
  }

  // Dart: (map['aspectRatioValue'] as num?)?.toDouble()
  if (map['aspectRatioValue'] !== undefined && map['aspectRatioValue'] !== null && typeof map['aspectRatioValue'] !== 'number') {
    throw new Error(`aspectRatioValue is not a number: ${typeof map['aspectRatioValue']} (${map['aspectRatioValue']})`);
  }

  // Dart: (map['trendingOrder'] as num?)?.toInt()
  if (map['trendingOrder'] !== undefined && map['trendingOrder'] !== null && typeof map['trendingOrder'] !== 'number') {
    throw new Error(`trendingOrder is not a number: ${typeof map['trendingOrder']} (${map['trendingOrder']})`);
  }
}

async function validateAll() {
  console.log('Testing products collection with TileProduct.fromMap strict rules...');
  const prodSnap = await db.collection('products').get();
  let prodErrors = 0;
  prodSnap.forEach(doc => {
    try {
      testParseDoc(doc.data(), doc.id);
    } catch (e) {
      console.log(`[products ERROR] Doc ${doc.id}: ${e.message}`);
      prodErrors++;
    }
  });

  console.log(`products validation complete: ${prodErrors} errors found across ${prodSnap.size} docs.`);

  console.log('\nTesting tiles collection with TileProduct.fromMap strict rules...');
  const tilesSnap = await db.collection('tiles').get();
  let tileErrors = 0;
  tilesSnap.forEach(doc => {
    try {
      testParseDoc(doc.data(), doc.id);
    } catch (e) {
      console.log(`[tiles ERROR] Doc ${doc.id}: ${e.message}`);
      tileErrors++;
    }
  });
  console.log(`tiles validation complete: ${tileErrors} errors found across ${tilesSnap.size} docs.`);
}

validateAll().catch(console.error);
