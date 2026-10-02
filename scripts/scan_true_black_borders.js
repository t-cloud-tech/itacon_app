const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const dirs = [
  { name: 'Sheet 1', dir: path.resolve(__dirname, '../assets/images/mockups') },
  { name: 'Sheet 2', dir: path.resolve(__dirname, '../assets/product_import/sheet2/mockups') },
  { name: 'Sheet 3', dir: path.resolve(__dirname, '../assets/product_import/sheet3/mockups') }
];

async function scanTrueBlackEdges() {
  const targets = [];
  for (const d of dirs) {
    const files = fs.readdirSync(d.dir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));
    console.log(`Auditing ${d.name} (${files.length} files)...`);
    for (const f of files) {
      const p = path.join(d.dir, f);
      const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
      const { width, height, channels } = info;
      function getPixelLum(x, y) {
        const idx = (y * width + x) * channels;
        return 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      }

      // Check left
      let left = 0;
      for (let x = 0; x < 25; x++) {
        let dark = 0, lumSum = 0;
        for (let y = 0; y < height; y++) {
          const l = getPixelLum(x, y);
          lumSum += l;
          if (l < 45) dark++;
        }
        if (dark / height >= 0.45 || lumSum / height <= 35) {
          left = x + 1;
        } else break;
      }

      // Check right
      let right = 0;
      for (let x = width - 1; x >= width - 25; x--) {
        let dark = 0, lumSum = 0;
        for (let y = 0; y < height; y++) {
          const l = getPixelLum(x, y);
          lumSum += l;
          if (l < 45) dark++;
        }
        if (dark / height >= 0.45 || lumSum / height <= 35) {
          right = width - x;
        } else break;
      }

      // Check top
      let top = 0;
      for (let y = 0; y < 25; y++) {
        let dark = 0, lumSum = 0;
        for (let x = 0; x < width; x++) {
          const l = getPixelLum(x, y);
          lumSum += l;
          if (l < 45) dark++;
        }
        if (dark / width >= 0.45 || lumSum / width <= 35) {
          top = y + 1;
        } else break;
      }

      // Check bottom
      let bottom = 0;
      for (let y = height - 1; y >= height - 25; y--) {
        let dark = 0, lumSum = 0;
        for (let x = 0; x < width; x++) {
          const l = getPixelLum(x, y);
          lumSum += l;
          if (l < 45) dark++;
        }
        if (dark / width >= 0.45 || lumSum / width <= 35) {
          bottom = height - y;
        } else break;
      }

      if (left > 0 || right > 0 || top > 0 || bottom > 0) {
        targets.push({
          source: d.name,
          dir: d.dir,
          file: f,
          filePath: p,
          width,
          height,
          crop: { top, bottom, left, right }
        });
      }
    }
  }

  console.log(`\nTrue black border targets: ${targets.length}`);
  targets.forEach((t, i) => {
    console.log(`${i+1}. ${t.file} (${t.source}) ${t.width}x${t.height} -> ${JSON.stringify(t.crop)}`);
  });
  fs.writeFileSync(path.resolve(__dirname, 'true_black_border_targets.json'), JSON.stringify(targets, null, 2));
}

scanTrueBlackEdges().catch(console.error);
