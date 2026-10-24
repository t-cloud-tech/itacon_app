/**
 * scripts/restore_image_paths.js
 * Restores Firestore products and tiles collections from an image paths backup JSON.
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'itacon-app'
  });
}
const db = admin.firestore();

async function restore(backupFilePath) {
  if (!backupFilePath) {
    console.error('Usage: node scripts/restore_image_paths.js <path_to_backup_json>');
    process.exit(1);
  }

  const fullPath = path.resolve(backupFilePath);
  if (!fs.existsSync(fullPath)) {
    console.error('Backup file does not exist at:', fullPath);
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  console.log(`Loaded backup from ${fullPath}`);
  console.log(`Products in backup: ${backup.products ? backup.products.length : 0}`);
  console.log(`Tiles in backup: ${backup.tiles ? backup.tiles.length : 0}`);

  // Restore products
  if (backup.products && backup.products.length > 0) {
    console.log('\nRestoring products collection...');
    let batch = db.batch();
    let count = 0;
    for (const item of backup.products) {
      const ref = db.collection('products').doc(item.id);
      batch.update(ref, {
        images: item.images,
        mockupImages: item.mockupImages,
        faceImages: item.faceImages
      });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Committed ${count} products...`);
      }
    }
    if (count % 400 !== 0) {
      await batch.commit();
    }
    console.log(`Successfully restored ${count} products.`);
  }

  // Restore tiles
  if (backup.tiles && backup.tiles.length > 0) {
    console.log('\nRestoring tiles collection...');
    let batch = db.batch();
    let count = 0;
    for (const item of backup.tiles) {
      const ref = db.collection('tiles').doc(item.id);
      batch.update(ref, {
        images: item.images,
        mockupImages: item.mockupImages,
        faceImages: item.faceImages
      });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Committed ${count} tiles...`);
      }
    }
    if (count % 400 !== 0) {
      await batch.commit();
    }
    console.log(`Successfully restored ${count} tiles.`);
  }

  console.log('\n=== RESTORATION COMPLETE ===');
}

const arg = process.argv[2];
restore(arg).then(() => process.exit(0)).catch(err => {
  console.error('Restoration failed:', err);
  process.exit(1);
});
