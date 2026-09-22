const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;
const bucket = 'itacon-app.firebasestorage.app';

async function testUploadSingle() {
  const filePath = path.resolve('d:/itacon_app/build/product_thumbnails/tiles/fallback_tile.webp');
  const fileData = fs.readFileSync(filePath);
  const destName = 'products/thumbnails/tiles/fallback_tile.webp';

  console.log(`Uploading test file (${fileData.length} bytes) to ${destName}...`);

  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(destName)}`;

  const resData = await new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'image/webp',
        'Content-Length': fileData.length
      }
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
    req.write(fileData);
    req.end();
  });

  console.log('Upload SUCCESS! Object metadata:');
  console.log('Name:', resData.name);
  console.log('Size:', resData.size);
  console.log('Content-Type:', resData.contentType);
  console.log('Bucket:', resData.bucket);
  console.log('Updated:', resData.updated);
}

testUploadSingle().catch(console.error);
