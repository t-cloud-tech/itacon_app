const fs = require('fs');
const path = require('path');

const intermediate = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'audit_intermediate.json'), 'utf8'));
const sheet1 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'sheet1_parsed_products.json'), 'utf8'));

// Fetch token and storage inventory
const https = require('https');
const BUCKET = 'itacon-app.firebasestorage.app';

function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cfg.tokens.access_token;
}

async function fetchStorageInventory(token) {
  const storageSet = new Set();
  let pageToken = '';
  do {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?maxResults=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.items) {
      data.items.forEach(i => storageSet.add(i.name));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return storageSet;
}

async function checkSheet1Storage() {
  const token = getAccessToken();
  const storageSet = await fetchStorageInventory(token);
  console.log(`Loaded ${storageSet.size} storage objects.`);

  let mockupsFound = 0;
  let mockupsMissing = 0;
  let missingMockupList = [];

  let facesFound = 0;
  let facesMissing = 0;
  let missingFaceList = [];

  let thumbsFound = 0;
  let thumbsMissing = 0;

  sheet1.forEach(p => {
    // Check mockups
    p.mockupImages.forEach(m => {
      if (storageSet.has(m)) {
        mockupsFound++;
      } else {
        mockupsMissing++;
        missingMockupList.push({ sku: p.sku, name: p.name, path: m });
      }

      // Check thumbnail
      const thumbPath = m.replace('products/mockups/', 'products/thumbnails/mockups/').replace(/\.[^.]+$/, '.webp');
      if (storageSet.has(thumbPath)) {
        thumbsFound++;
      } else {
        thumbsMissing++;
      }
    });

    // Check faces
    p.faceImages.forEach(f => {
      if (storageSet.has(f)) {
        facesFound++;
      } else {
        facesMissing++;
        missingFaceList.push({ sku: p.sku, name: p.name, path: f });
      }

      const thumbPath = f.replace('products/tiles/', 'products/thumbnails/tiles/').replace(/\.[^.]+$/, '.webp');
      if (storageSet.has(thumbPath)) {
        thumbsFound++;
      } else {
        thumbsMissing++;
      }
    });
  });

  console.log('\n--- Sheet 1 Storage Audit ---');
  console.log(`Mockups: Found = ${mockupsFound}, Missing = ${mockupsMissing}`);
  console.log(`Tile Faces: Found = ${facesFound}, Missing = ${facesMissing}`);
  console.log(`Thumbnails: Found = ${thumbsFound}, Missing = ${thumbsMissing}`);

  console.log('\nSample Missing Mockups:', missingMockupList.slice(0, 5));
  console.log('Sample Missing Faces:', missingFaceList.slice(0, 5));

  // Also check if any Sheet 1 objects exist in storage under different names!
  const allSheet1Storage = Array.from(storageSet).filter(s => s.includes('00-') || s.includes('001') || s.includes('002'));
  console.log('\nTotal Storage objects matching "00-" or "001":', allSheet1Storage.length);
  console.log('Sample matching storage objects:', allSheet1Storage.slice(0, 10));

  fs.writeFileSync(
    path.join(__dirname, '..', 'build', 'sheet1_storage_audit.json'),
    JSON.stringify({
      mockupsFound,
      mockupsMissing,
      missingMockupList,
      facesFound,
      facesMissing,
      missingFaceList,
      allSheet1StorageCount: allSheet1Storage.length,
      sampleSheet1Storage: allSheet1Storage.slice(0, 20)
    }, null, 2),
    'utf8'
  );
}

checkSheet1Storage().catch(err => {
  console.error(err);
  process.exit(1);
});
