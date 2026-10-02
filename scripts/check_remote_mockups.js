const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('./node_modules/sharp');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function checkRemoteMockups() {
  const token = cfg.tokens.access_token;
  const bucket = 'itacon-app.firebasestorage.app';

  // Sample files that were cropped in batch 1:
  const testFiles = [
    'products/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-061_mockup.jpeg',
    'products/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-064_mockup.jpeg',
    'products/mockups/ADIGE CREMA.jpg',
    'products/mockups/ADIGE GREY .jpg',
    'products/mockups/MG ADRY STATUARIO-preview.jpg',
    'products/mockups/MG AMAZING BROWN-preview.jpg'
  ];

  for (const objName of testFiles) {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objName)}?alt=media`;
    const buf = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    const meta = await sharp(buf).metadata();
    const raw = await sharp(buf).resize(200, 200, { fit: 'fill' }).raw().toBuffer();
    
    // Check top row lum and bottom row lum
    let topBlack = 0, botBlack = 0;
    for (let x = 0; x < 200; x++) {
      const t = (0 * 200 + x) * 3;
      if (raw[t] < 45 && raw[t+1] < 45 && raw[t+2] < 45) topBlack++;

      const b = (199 * 200 + x) * 3;
      if (raw[b] < 45 && raw[b+1] < 45 && raw[b+2] < 45) botBlack++;
    }

    console.log(`Remote: ${objName} (${meta.width}x${meta.height}) -> topBlack: ${(topBlack/200).toFixed(2)}, botBlack: ${(botBlack/200).toFixed(2)}`);
  }
}

checkRemoteMockups().catch(console.error);
