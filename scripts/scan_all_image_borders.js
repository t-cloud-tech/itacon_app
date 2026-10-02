const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const DIRS_TO_CHECK = [
  'assets/images/mockups',
  'assets/images/tiles',
  'assets/images/adhesives',
  'assets/product_import/sheet2/mockups',
  'assets/product_import/sheet3/mockups',
  'assets/product_import/sheet3/tile_faces',
  'D:/Glossy 1',
  'D:/Glossy 2',
  'D:/Glossy 3',
  'D:/Glossy 4',
  'D:/Glossy 5',
  'D:/Glossy 6',
  'D:/mg glossy preview/mg glossy preview'
];

async function scanBorders(dirPath) {
  if (!fs.existsSync(dirPath)) return { dir: dirPath, count: 0, withBorders: [] };
  const files = fs.readdirSync(dirPath).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  const withBorders = [];

  for (const f of files) {
    const full = path.join(dirPath, f);
    try {
      const meta = await sharp(full).metadata();
      const raw = await sharp(full).resize(200, 200, { fit: 'fill' }).raw().toBuffer();
      
      // Check top row (y=0) and bottom row (y=199) and left (x=0) and right (x=199)
      let topBlack = 0, botBlack = 0, leftBlack = 0, rightBlack = 0;
      for (let i = 0; i < 200; i++) {
        // top
        const tIdx = (0 * 200 + i) * 3;
        if (raw[tIdx] < 45 && raw[tIdx+1] < 45 && raw[tIdx+2] < 45) topBlack++;

        // bot
        const bIdx = (199 * 200 + i) * 3;
        if (raw[bIdx] < 45 && raw[bIdx+1] < 45 && raw[bIdx+2] < 45) botBlack++;

        // left
        const lIdx = (i * 200 + 0) * 3;
        if (raw[lIdx] < 45 && raw[lIdx+1] < 45 && raw[lIdx+2] < 45) leftBlack++;

        // right
        const rIdx = (i * 200 + 199) * 3;
        if (raw[rIdx] < 45 && raw[rIdx+1] < 45 && raw[rIdx+2] < 45) rightBlack++;
      }

      const isBorder = (topBlack / 200 >= 0.65) || (botBlack / 200 >= 0.65) || (leftBlack / 200 >= 0.65) || (rightBlack / 200 >= 0.65);
      if (isBorder) {
        withBorders.push({
          file: f,
          topPct: (topBlack / 200).toFixed(2),
          botPct: (botBlack / 200).toFixed(2),
          leftPct: (leftBlack / 200).toFixed(2),
          rightPct: (rightBlack / 200).toFixed(2),
        });
      }
    } catch (e) {}
  }

  return { dir: dirPath, count: files.length, withBorders };
}

async function run() {
  for (const d of DIRS_TO_CHECK) {
    const res = await scanBorders(d);
    console.log(`\nDir: ${res.dir} (Total: ${res.count}, With Borders: ${res.withBorders.length})`);
    if (res.withBorders.length > 0) {
      console.log('Sample with borders:', res.withBorders.slice(0, 5));
    }
  }
}

run().catch(console.error);
