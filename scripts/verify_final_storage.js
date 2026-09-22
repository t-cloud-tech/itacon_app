const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;
const bucket = 'itacon-app.firebasestorage.app';

async function verifyStorageInventory() {
  let allItems = [];
  let pageToken = '';
  
  do {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o?maxResults=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', reject);
    });
    
    if (data.items) {
      allItems = allItems.concat(data.items);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  
  console.log(`Total objects in Firebase Storage bucket: ${allItems.length}`);
  
  const categories = {};
  allItems.forEach(item => {
    let prefix = 'other';
    if (item.name.startsWith('products/thumbnails/mockups/')) prefix = 'thumbnails/mockups';
    else if (item.name.startsWith('products/thumbnails/tiles/')) prefix = 'thumbnails/tiles';
    else if (item.name.startsWith('products/thumbnails/adhesives/')) prefix = 'thumbnails/adhesives';
    else if (item.name.startsWith('products/mockups/')) prefix = 'originals/mockups';
    else if (item.name.startsWith('products/tiles/')) prefix = 'originals/tiles';
    else if (item.name.startsWith('products/adhesives/')) prefix = 'originals/adhesives';
    
    categories[prefix] = (categories[prefix] || 0) + 1;
  });
  
  console.log('Complete Storage Inventory:');
  console.log(JSON.stringify(categories, null, 2));
}

verifyStorageInventory().catch(console.error);
