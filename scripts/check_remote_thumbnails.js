const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('./node_modules/sharp');

const configPath = 'C:\\Users\\ttirt\\.config\\configstore\\firebase-tools.json';
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function checkRemoteThumbnails() {
  const token = cfg.tokens.access_token;
  const bucket = 'itacon-app.firebasestorage.app';

  const testThumbs = [
    'products/thumbnails/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-061_mockup.webp',
    'products/thumbnails/mockups/ADIGE CREMA.webp',
    'products/thumbnails/mockups/ADIGE GREY .webp',
    'products/thumbnails/mockups/MG ADRY STATUARIO-preview.webp',
    'products/thumbnails/mockups/MG AMAZING BROWN-preview.webp',
    'products/thumbnails/mockups/VIT-60120-8.50-GLO-MAR-WHIT-066_room1.webp'
  ];

  for (const objName of testThumbs) {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objName)}?alt=media`;
    const buf = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${objName}`));
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    const meta = await sharp(buf).metadata();
    const raw = await sharp(buf).resize(200, 200, { fit: 'fill' }).raw().toBuffer();
    
    let topBlack = 0, botBlack = 0;
    for (let x = 0; x < 200; x++) {
      const t = (0 * 200 + x) * 3;
      if (raw[t] < 45 && raw[t+1] < 45 && raw[t+2] < 45) topBlack++;

      const b = (199 * 200 + x) * 3;
      if (raw[b] < 45 && raw[b+1] < 45 && raw[b+2] < 45) botBlack++;
    }

    console.log(`Thumbnail: ${objName} (${meta.width}x${meta.height}) -> topBlack: ${(topBlack/200).toFixed(2)}, botBlack: ${(botBlack/200).toFixed(2)}`);
  }
}

checkRemoteThumbnails().catch(console.error);
