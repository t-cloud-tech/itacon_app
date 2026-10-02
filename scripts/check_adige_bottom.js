const fs = require('fs');
const sharp = require('./node_modules/sharp');

async function checkAdigeBottom() {
  const p = 'D:/Glossy 1/ADIGE CREMA.jpg';
  console.log('Original from D:/Glossy 1:', p);
  const meta = await sharp(p).metadata();
  console.log(`Original dimensions: ${meta.width} x ${meta.height}`);

  // Let's sample rows from y = 0 to 600, and from y = height - 600 to height
  const raw = await sharp(p).resize(600, 400, { fit: 'fill' }).raw().toBuffer();

  function rowInfo(y) {
    let sumL = 0;
    let minL = 255;
    let maxL = 0;
    let blackCount = 0;
    for (let x = 0; x < 600; x++) {
      const idx = (y * 600 + x) * 3;
      const l = 0.299 * raw[idx] + 0.587 * raw[idx+1] + 0.114 * raw[idx+2];
      sumL += l;
      if (l < minL) minL = l;
      if (l > maxL) maxL = l;
      if (l < 45) blackCount++;
    }
    return {
      avgL: (sumL / 600).toFixed(1),
      minL: minL.toFixed(1),
      maxL: maxL.toFixed(1),
      blackPct: ((blackCount / 600) * 100).toFixed(1) + '%'
    };
  }

  console.log('\n--- TOP ROWS (scaled y=0..30) ---');
  for (let y = 0; y <= 35; y += 5) {
    console.log(`y=${y}:`, rowInfo(y));
  }

  console.log('\n--- BOTTOM ROWS (scaled y=365..399) ---');
  for (let y = 365; y < 400; y += 5) {
    console.log(`y=${y}:`, rowInfo(y));
  }
}

checkAdigeBottom().catch(console.error);
