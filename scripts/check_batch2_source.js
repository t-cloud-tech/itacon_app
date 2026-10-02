const fs = require('fs');
const path = require('path');

const csv = fs.readFileSync('scripts/ITACON_Image_Mapping.csv', 'utf8');
const lines = csv.split('\n').filter(Boolean);
const header = lines[0].split(',');
console.log('Header:', header);

// Let's parse records
const records = [];
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  if (parts.length >= 8) {
    records.push({
      design: parts[0].trim(),
      sku: parts[1].trim(),
      sourceZip: parts[2].trim(),
      sourceImage: parts[3].trim(),
      role: parts[4].trim(),
      seq: parts[5].trim(),
      origStoragePath: parts[6].trim(),
      thumbStoragePath: parts[7].trim()
    });
  }
}

console.log('Total records in ITACON_Image_Mapping.csv:', records.length);
const roomRecords = records.filter(r => r.role === 'room');
console.log('Room records in ITACON_Image_Mapping.csv:', roomRecords.length);

// Let's see how they correspond to products/mockups/VIT-60120-8.50-GLO-MAR-WHIT-XXX_roomY.jpg
const storageObjects = JSON.parse(fs.readFileSync('scripts/all_storage_objects.json', 'utf8'));
const audit1 = JSON.parse(fs.readFileSync('image_cleanup_preview/mockup_cleanup_audit.json', 'utf8'));
const batch1Filenames = new Set(audit1.map(i => path.basename(i.filename || '')));

const batch2Mockups = storageObjects
  .filter(name => name.startsWith('products/mockups/'))
  .filter(name => !batch1Filenames.has(path.basename(name)));

console.log('Batch 2 mockups count in storage:', batch2Mockups.length);
console.log('Sample batch 2 storage mockup:', batch2Mockups[0]);
console.log('Sample room record in CSV:', roomRecords[0]);

// Compare file size of downloaded batch2 raw image vs D:/glossy file
const downloaded = 'image_cleanup_preview/batch2/raw/VIT-60120-8.50-GLO-MAR-WHIT-066_room1.jpg';
if (fs.existsSync(downloaded)) {
  const sizeDownloaded = fs.statSync(downloaded).size;
  console.log('Downloaded 066_room1 size:', sizeDownloaded);

  // find ADIGE CREMA_R1.jpg in D:/glossy
  const localD = 'D:/glossy/glossy/ADIGE CREMA/ADIGE CREMA_R1.jpg';
  if (fs.existsSync(localD)) {
    const sizeLocalD = fs.statSync(localD).size;
    console.log('Local D:/glossy 066_R1 size:', sizeLocalD);
    console.log('Sizes identical?', sizeDownloaded === sizeLocalD);
  }
}
