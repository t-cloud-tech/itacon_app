const fs = require('fs');
const sharp = require('./node_modules/sharp');

async function inspectImages() {
  const p1 = 'assets/product_import/sheet2/mockups/BISAZZA GREY.jpg';
  const p2 = 'assets/product_import/sheet3/mockups/MG SYDNEY GREY-preview.jpg';

  console.log('--- BISAZZA GREY.jpg ---');
  const m1 = await sharp(p1).metadata();
  console.log(`Dimensions: ${m1.width} x ${m1.height}`);

  // check left edge: columns 0 to 50
  const raw1 = await sharp(p1).resize(400, 300, { fit: 'fill' }).raw().toBuffer();
  for (let x = 0; x < 20; x++) {
    let black = 0;
    for (let y = 0; y < 300; y++) {
      const idx = (y * 400 + x) * 3;
      if (raw1[idx] < 50 && raw1[idx+1] < 50 && raw1[idx+2] < 50) black++;
    }
    console.log(`x=${x}: black=${((black/300)*100).toFixed(1)}%`);
  }

  console.log('\n--- MG SYDNEY GREY-preview.jpg ---');
  const m2 = await sharp(p2).metadata();
  console.log(`Dimensions: ${m2.width} x ${m2.height}`);
  const raw2 = await sharp(p2).resize(400, 300, { fit: 'fill' }).raw().toBuffer();
  console.log('Top rows y=0..15:');
  for (let y = 0; y < 15; y++) {
    let black = 0;
    for (let x = 0; x < 400; x++) {
      const idx = (y * 400 + x) * 3;
      if (raw2[idx] < 50 && raw2[idx+1] < 50 && raw2[idx+2] < 50) black++;
    }
    console.log(`y=${y}: black=${((black/400)*100).toFixed(1)}%`);
  }
}

inspectImages().catch(console.error);
