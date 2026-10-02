const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const mapping = JSON.parse(fs.readFileSync('scripts/batch2_room_mapping.json', 'utf8'));

async function inspectSample() {
  const samples = [mapping[0], mapping[1], mapping[2], mapping[3], mapping[10], mapping[20], mapping[50]];

  for (const s of samples) {
    const meta = await sharp(s.localSource).metadata();
    console.log(`\n--- ${s.design} (${s.storageMockupName}) ---`);
    console.log(`Dimensions: ${meta.width}x${meta.height}`);

    // Downsample to 200x200
    const raw = await sharp(s.localSource).resize(200, 200, { fit: 'fill' }).raw().toBuffer();
    
    // Check top row, middle row, bottom row, left col, right col
    function avgLumRow(y) {
      let sum = 0;
      for (let x = 0; x < 200; x++) {
        const idx = (y * 200 + x) * 3;
        sum += 0.299 * raw[idx] + 0.587 * raw[idx+1] + 0.114 * raw[idx+2];
      }
      return (sum / 200).toFixed(1);
    }

    function avgLumCol(x) {
      let sum = 0;
      for (let y = 0; y < 200; y++) {
        const idx = (y * 200 + x) * 3;
        sum += 0.299 * raw[idx] + 0.587 * raw[idx+1] + 0.114 * raw[idx+2];
      }
      return (sum / 200).toFixed(1);
    }

    console.log(`Top rows lum (y=0, 5, 10, 20): ${avgLumRow(0)}, ${avgLumRow(5)}, ${avgLumRow(10)}, ${avgLumRow(20)}`);
    console.log(`Bottom rows lum (y=199, 195, 190, 180): ${avgLumRow(199)}, ${avgLumRow(195)}, ${avgLumRow(190)}, ${avgLumRow(180)}`);
    console.log(`Left cols lum (x=0, 5, 10): ${avgLumCol(0)}, ${avgLumCol(5)}, ${avgLumCol(10)}`);
    console.log(`Right cols lum (x=199, 195, 190): ${avgLumCol(199)}, ${avgLumCol(195)}, ${avgLumCol(190)}`);
  }
}

inspectSample().catch(console.error);
