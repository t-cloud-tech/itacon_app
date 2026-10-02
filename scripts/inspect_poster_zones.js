const fs = require('fs');
const sharp = require('./node_modules/sharp');

async function inspectPoster() {
  const p = 'D:/glossy/glossy/ADIGE CREMA/ADIGE CREMA_R1.jpg';
  const meta = await sharp(p).metadata();
  console.log('ADIGE CREMA_R1:', meta.width, 'x', meta.height);

  // Let's divide it into 6 vertical zones of 500px height each:
  // zone 1: 0 - 500
  // zone 2: 500 - 1000
  // zone 3: 1000 - 1500
  // zone 4: 1500 - 2000
  // zone 5: 2000 - 2500
  // zone 6: 2500 - 3000
  const raw = await sharp(p).resize(150, 300, { fit: 'fill' }).raw().toBuffer();
  
  for (let z = 0; z < 6; z++) {
    const startY = z * 50;
    const endY = (z + 1) * 50;
    let sumL = 0;
    let darkPix = 0;
    let totalPix = 50 * 150;
    for (let y = startY; y < endY; y++) {
      for (let x = 0; x < 150; x++) {
        const idx = (y * 150 + x) * 3;
        const lum = 0.299 * raw[idx] + 0.587 * raw[idx+1] + 0.114 * raw[idx+2];
        sumL += lum;
        if (lum < 50) darkPix++;
      }
    }
    console.log(`Zone ${z+1} (y=${startY*10}..${endY*10}): avg lum = ${(sumL/totalPix).toFixed(1)}, dark pixels = ${((darkPix/totalPix)*100).toFixed(1)}%`);
  }
}

inspectPoster().catch(console.error);
