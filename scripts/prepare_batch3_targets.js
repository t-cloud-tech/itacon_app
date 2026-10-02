const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const candidates = [
  // Sheet 1
  { dir: 'assets/images/mockups', file: 'VIT-60120-8.50-GLO-MAR-WHIT-00-059_mockup.jpeg', source: 'Sheet 1', storageKey: 'products/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-059_mockup.jpeg', thumbKey: 'products/thumbnails/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-059_mockup.webp' },
  // Sheet 2
  { dir: 'assets/product_import/sheet2/mockups', file: 'BISAZZA NATURAL.jpg', source: 'Sheet 2', storageKey: 'products/mockups/BISAZZA NATURAL.jpg', thumbKey: 'products/thumbnails/mockups/BISAZZA NATURAL.webp' },
  { dir: 'assets/product_import/sheet2/mockups', file: 'LIMA CREMA.jpg', source: 'Sheet 2', storageKey: 'products/mockups/LIMA CREMA.jpg', thumbKey: 'products/thumbnails/mockups/LIMA CREMA.webp' },
  { dir: 'assets/product_import/sheet2/mockups', file: 'ONYX OMANI BEIGE.jpg', source: 'Sheet 2', storageKey: 'products/mockups/ONYX OMANI BEIGE.jpg', thumbKey: 'products/thumbnails/mockups/ONYX OMANI BEIGE.webp' },
  { dir: 'assets/product_import/sheet2/mockups', file: 'ROME GREY.jpg', source: 'Sheet 2', storageKey: 'products/mockups/ROME GREY.jpg', thumbKey: 'products/thumbnails/mockups/ROME GREY.webp' },
  { dir: 'assets/product_import/sheet2/mockups', file: 'AMIGO SMOKE.jpg', source: 'Sheet 2', storageKey: 'products/mockups/AMIGO SMOKE.jpg', thumbKey: 'products/thumbnails/mockups/AMIGO SMOKE.webp' },
  { dir: 'assets/product_import/sheet2/mockups', file: 'BISAZZA GREY.jpg', source: 'Sheet 2', storageKey: 'products/mockups/BISAZZA GREY.jpg', thumbKey: 'products/thumbnails/mockups/BISAZZA GREY.webp' },
  { dir: 'assets/product_import/sheet2/mockups', file: 'ALBANION CREMA.jpg', source: 'Sheet 2', storageKey: 'products/mockups/ALBANION CREMA.jpg', thumbKey: 'products/thumbnails/mockups/ALBANION CREMA.webp' },
  { dir: 'assets/product_import/sheet2/mockups', file: 'SHG HARVEST GREY.jpg', source: 'Sheet 2', storageKey: 'products/mockups/SHG HARVEST GREY.jpg', thumbKey: 'products/thumbnails/mockups/SHG HARVEST GREY.webp' },
  { dir: 'assets/product_import/sheet2/mockups', file: 'MARMI BIANCO.jpg', source: 'Sheet 2', storageKey: 'products/mockups/MARMI BIANCO.jpg', thumbKey: 'products/thumbnails/mockups/MARMI BIANCO.webp' },
  // Sheet 3
  { dir: 'assets/product_import/sheet3/mockups', file: 'MG PIGUES NATURAL-preview.jpg', source: 'Sheet 3', storageKey: 'products/mockups/MG PIGUES NATURAL-preview.jpg', thumbKey: 'products/thumbnails/mockups/MG PIGUES NATURAL-preview.webp' },
  { dir: 'assets/product_import/sheet3/mockups', file: 'MG BRATVI BLACK-preview.jpg', source: 'Sheet 3', storageKey: 'products/mockups/MG BRATVI BLACK-preview.jpg', thumbKey: 'products/thumbnails/mockups/MG BRATVI BLACK-preview.webp' },
  { dir: 'assets/product_import/sheet3/mockups', file: 'MG BRERA BROWN-preview.jpg', source: 'Sheet 3', storageKey: 'products/mockups/MG BRERA BROWN-preview.jpg', thumbKey: 'products/thumbnails/mockups/MG BRERA BROWN-preview.webp' },
  { dir: 'assets/product_import/sheet3/mockups', file: 'MG SYDNEY GREY-preview.jpg', source: 'Sheet 3', storageKey: 'products/mockups/MG SYDNEY GREY-preview.jpg', thumbKey: 'products/thumbnails/mockups/MG SYDNEY GREY-preview.webp' },
  { dir: 'assets/product_import/sheet3/mockups', file: 'MG OMANI BEIGE-preview.jpg', source: 'Sheet 3', storageKey: 'products/mockups/MG OMANI BEIGE-preview.jpg', thumbKey: 'products/thumbnails/mockups/MG OMANI BEIGE-preview.webp' }
];

async function measureExactCrop(c) {
  const fullPath = path.resolve(__dirname, '..', c.dir, c.file);
  const { data, info } = await sharp(fullPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  function getPixelLum(x, y) {
    const idx = (y * width + x) * channels;
    return 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
  }

  // Left scan: stop when row dark percentage < 0.20 and avgLum > 60
  let cropLeft = 0;
  for (let x = 0; x < 50; x++) {
    let dark = 0, lumSum = 0;
    for (let y = 0; y < height; y++) {
      const l = getPixelLum(x, y);
      lumSum += l;
      if (l < 45) dark++;
    }
    const darkPct = dark / height;
    const avgLum = lumSum / height;
    if (darkPct > 0.25 || avgLum < 50) {
      cropLeft = x + 1;
    } else {
      // 2px lookahead
      let foundDarker = false;
      for (let la = 1; la <= 3; la++) {
        if (x + la < 50) {
          let d2 = 0, l2 = 0;
          for (let y = 0; y < height; y++) {
            const l = getPixelLum(x + la, y);
            l2 += l;
            if (l < 45) d2++;
          }
          if (d2 / height > 0.35 || l2 / height < 40) { foundDarker = true; break; }
        }
      }
      if (!foundDarker) break;
    }
  }

  // Right scan
  let cropRight = 0;
  for (let x = width - 1; x >= width - 50; x--) {
    let dark = 0, lumSum = 0;
    for (let y = 0; y < height; y++) {
      const l = getPixelLum(x, y);
      lumSum += l;
      if (l < 45) dark++;
    }
    const darkPct = dark / height;
    const avgLum = lumSum / height;
    if (darkPct > 0.25 || avgLum < 50) {
      cropRight = width - x;
    } else {
      let foundDarker = false;
      for (let la = 1; la <= 3; la++) {
        if (x - la >= width - 50) {
          let d2 = 0, l2 = 0;
          for (let y = 0; y < height; y++) {
            const l = getPixelLum(x - la, y);
            l2 += l;
            if (l < 45) d2++;
          }
          if (d2 / height > 0.35 || l2 / height < 40) { foundDarker = true; break; }
        }
      }
      if (!foundDarker) break;
    }
  }

  // Add 1-2px safety margin to ensure no residual edge artifact remains
  if (cropLeft > 0) cropLeft += 2;
  if (cropRight > 0) cropRight += 2;

  return {
    ...c,
    fullPath,
    origWidth: width,
    origHeight: height,
    cropLeft,
    cropRight,
    cropTop: 0,
    cropBottom: 0,
    newWidth: width - cropLeft - cropRight,
    newHeight: height
  };
}

async function run() {
  const results = [];
  for (const c of candidates) {
    const res = await measureExactCrop(c);
    results.push(res);
    console.log(`[TARGET] ${res.file} (${res.source}) ${res.origWidth}x${res.origHeight} -> Crop: left=${res.cropLeft}, right=${res.cropRight} => Final: ${res.newWidth}x${res.newHeight}`);
  }
  fs.writeFileSync(path.resolve(__dirname, 'batch3_targets.json'), JSON.stringify(results, null, 2));
}

run().catch(console.error);
