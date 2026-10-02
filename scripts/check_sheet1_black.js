const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

async function testSheet1Images() {
  const dir = 'assets/images/mockups';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpeg')).sort();

  for (let i = 0; i < 10; i++) {
    const file = files[i];
    const full = path.join(dir, file);
    const meta = await sharp(full).metadata();

    // Check if there is any black strip or border anywhere
    // Let's sample rows from top to bottom
    const raw = await sharp(full).raw().toBuffer({ resolveWithObject: true });
    const w = raw.info.width;
    const h = raw.info.height;
    const ch = raw.info.channels;

    function rowBlack(y) {
      let b = 0;
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * ch;
        if (raw.data[idx] < 45 && raw.data[idx+1] < 45 && raw.data[idx+2] < 45) b++;
      }
      return b / w;
    }

    console.log(`\n${file} (${w}x${h}):`);
    console.log(`  Top rows black %: y=0: ${(rowBlack(0)*100).toFixed(1)}%, y=10: ${(rowBlack(10)*100).toFixed(1)}%, y=50: ${(rowBlack(50)*100).toFixed(1)}%`);
    console.log(`  Bottom rows black %: y=h-1: ${(rowBlack(h-1)*100).toFixed(1)}%, y=h-11: ${(rowBlack(h-11)*100).toFixed(1)}%, y=h-51: ${(rowBlack(h-51)*100).toFixed(1)}%`);
  }
}

testSheet1Images().catch(console.error);
