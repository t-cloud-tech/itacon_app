const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const dirs = [
  { name: 'Sheet 1', dir: path.resolve(__dirname, '../assets/images/mockups') },
  { name: 'Sheet 2', dir: path.resolve(__dirname, '../assets/product_import/sheet2/mockups') },
  { name: 'Sheet 3', dir: path.resolve(__dirname, '../assets/product_import/sheet3/mockups') }
];

async function scanStrictBlackEdges() {
  const allBlackBorders = [];
  for (const d of dirs) {
    const files = fs.readdirSync(d.dir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));
    console.log('Auditing ' + d.name + ' (' + files.length + ' files)...');
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
      for (let x = 0; x < Math.min(50, Math.floor(width * 0.1)); x++) {
        let dark = 0, lumSum = 0;
        for (let y = 0; y < height; y++) {
          const l = getPixelLum(x, y);
          lumSum += l;
          if (l < 45) dark++;
        }
        const darkPct = dark / height;
        const avgLum = lumSum / height;
        if (darkPct > 0.50 || avgLum < 35) {
          left = x + 1;
        } else {
          let next = false;
          for (let la = 1; la <= 3; la++) {
            if (x + la < width * 0.1) {
              let d2 = 0, l2 = 0;
              for (let y = 0; y < height; y++) {
                const l = getPixelLum(x + la, y);
                l2 += l;
                if (l < 45) d2++;
              }
              if (d2 / height > 0.50 || (l2 / height) < 35) { next = true; break; }
            }
          }
          if (!next) break;
        }
      }

      // Check right
      let right = 0;
      for (let x = width - 1; x >= Math.max(0, width - 50); x--) {
        let dark = 0, lumSum = 0;
        for (let y = 0; y < height; y++) {
          const l = getPixelLum(x, y);
          lumSum += l;
          if (l < 45) dark++;
        }
        const darkPct = dark / height;
        const avgLum = lumSum / height;
        if (darkPct > 0.50 || avgLum < 35) {
          right = width - x;
        } else {
          let next = false;
          for (let la = 1; la <= 3; la++) {
            if (x - la >= width - 50) {
              let d2 = 0, l2 = 0;
              for (let y = 0; y < height; y++) {
                const l = getPixelLum(x - la, y);
                l2 += l;
                if (l < 45) d2++;
              }
              if (d2 / height > 0.50 || (l2 / height) < 35) { next = true; break; }
            }
          }
          if (!next) break;
        }
      }

      // Check top
      let top = 0;
      for (let y = 0; y < Math.min(50, Math.floor(height * 0.1)); y++) {
        let dark = 0, lumSum = 0;
        for (let x = 0; x < width; x++) {
          const l = getPixelLum(x, y);
          lumSum += l;
          if (l < 45) dark++;
        }
        const darkPct = dark / width;
        const avgLum = lumSum / width;
        if (darkPct > 0.50 || avgLum < 35) {
          top = y + 1;
        } else {
          let next = false;
          for (let la = 1; la <= 3; la++) {
            if (y + la < height * 0.1) {
              let d2 = 0, l2 = 0;
              for (let x = 0; x < width; x++) {
                const l = getPixelLum(x, y + la);
                l2 += l;
                if (l < 45) d2++;
              }
              if (d2 / width > 0.50 || (l2 / width) < 35) { next = true; break; }
            }
          }
          if (!next) break;
        }
      }

      // Check bottom
      let bottom = 0;
      for (let y = height - 1; y >= Math.max(0, height - 50); y--) {
        let dark = 0, lumSum = 0;
        for (let x = 0; x < width; x++) {
          const l = getPixelLum(x, y);
          lumSum += l;
          if (l < 45) dark++;
        }
        const darkPct = dark / width;
        const avgLum = lumSum / width;
        if (darkPct > 0.50 || avgLum < 35) {
          bottom = height - y;
        } else {
          let next = false;
          for (let la = 1; la <= 3; la++) {
            if (y - la >= height - 50) {
              let d2 = 0, l2 = 0;
              for (let x = 0; x < width; x++) {
                const l = getPixelLum(x, y - la);
                l2 += l;
                if (l < 45) d2++;
              }
              if (d2 / width > 0.50 || (l2 / width) < 35) { next = true; break; }
            }
          }
          if (!next) break;
        }
      }

      if (left > 0 || right > 0 || top > 0 || bottom > 0) {
        allBlackBorders.push({
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

  console.log('\n=== STRICT BLACK BORDER AUDIT RESULTS ===');
  console.log('Total files needing border crop: ' + allBlackBorders.length);
  fs.writeFileSync(path.resolve(__dirname, 'strict_black_border_targets.json'), JSON.stringify(allBlackBorders, null, 2));
  allBlackBorders.forEach((b, idx) => {
    console.log('[' + (idx + 1) + '/' + allBlackBorders.length + '] ' + b.file + ' (' + b.source + ') ' + b.width + 'x' + b.height + ' -> top:' + b.crop.top + ', bot:' + b.crop.bottom + ', left:' + b.crop.left + ', right:' + b.crop.right);
  });
}

scanStrictBlackEdges().catch(console.error);
