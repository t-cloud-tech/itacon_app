const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

async function inspectSheet1() {
  const dir = path.join(__dirname, '..', 'assets', 'images', 'mockups');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpeg')).sort();

  console.log('Inspecting first 15 Sheet 1 mockups:');
  for (let i = 0; i < 15; i++) {
    const f = files[i];
    const p = path.join(dir, f);
    const meta = await sharp(p).metadata();
    
    // Check top and bottom rows
    // Downsample to 200x200
    const raw = await sharp(p).resize(200, 200, { fit: 'fill' }).raw().toBuffer();
    
    function avgLumRow(y) {
      let sum = 0;
      for (let x = 0; x < 200; x++) {
        const idx = (y * 200 + x) * 3;
        sum += 0.299 * raw[idx] + 0.587 * raw[idx+1] + 0.114 * raw[idx+2];
      }
      return (sum / 200).toFixed(1);
    }

    console.log(`${f} (${meta.width}x${meta.height}): top(0)=${avgLumRow(0)}, top(5)=${avgLumRow(5)}, top(10)=${avgLumRow(10)} | bot(199)=${avgLumRow(199)}, bot(195)=${avgLumRow(195)}, bot(190)=${avgLumRow(190)}`);
  }
}

inspectSheet1().catch(console.error);
