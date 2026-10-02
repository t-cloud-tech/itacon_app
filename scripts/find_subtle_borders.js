const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

async function findSubtleBorders() {
  const dirs = [
    { name: 'Sheet 2', path: 'assets/product_import/sheet2/mockups' },
    { name: 'Sheet 3', path: 'assets/product_import/sheet3/mockups' }
  ];

  const candidates = [];

  for (const group of dirs) {
    const files = fs.readdirSync(group.path).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
    for (const f of files) {
      const full = path.join(group.path, f);
      const meta = await sharp(full).metadata();
      const raw = await sharp(full).resize(400, 400, { fit: 'fill' }).raw().toBuffer();

      // Check outer 15 pixels (top, bot, left, right)
      let topMax = 0, botMax = 0, leftMax = 0, rightMax = 0;

      for (let y = 0; y < 15; y++) {
        let b = 0;
        for (let x = 0; x < 400; x++) {
          const idx = (y * 400 + x) * 3;
          if (raw[idx] < 50 && raw[idx+1] < 50 && raw[idx+2] < 50) b++;
        }
        if (b / 400 > topMax) topMax = b / 400;
      }

      for (let y = 385; y < 400; y++) {
        let b = 0;
        for (let x = 0; x < 400; x++) {
          const idx = (y * 400 + x) * 3;
          if (raw[idx] < 50 && raw[idx+1] < 50 && raw[idx+2] < 50) b++;
        }
        if (b / 400 > botMax) botMax = b / 400;
      }

      for (let x = 0; x < 15; x++) {
        let b = 0;
        for (let y = 0; y < 400; y++) {
          const idx = (y * 400 + x) * 3;
          if (raw[idx] < 50 && raw[idx+1] < 50 && raw[idx+2] < 50) b++;
        }
        if (b / 400 > leftMax) leftMax = b / 400;
      }

      for (let x = 385; x < 400; x++) {
        let b = 0;
        for (let y = 0; y < 400; y++) {
          const idx = (y * 400 + x) * 3;
          if (raw[idx] < 50 && raw[idx+1] < 50 && raw[idx+2] < 50) b++;
        }
        if (b / 400 > rightMax) rightMax = b / 400;
      }

      if (topMax >= 0.35 || botMax >= 0.35 || leftMax >= 0.35 || rightMax >= 0.35) {
        candidates.push({
          group: group.name,
          file: f,
          w: meta.width,
          h: meta.height,
          topMax: (topMax*100).toFixed(1) + '%',
          botMax: (botMax*100).toFixed(1) + '%',
          leftMax: (leftMax*100).toFixed(1) + '%',
          rightMax: (rightMax*100).toFixed(1) + '%',
        });
      }
    }
  }

  console.log(`Found ${candidates.length} images with border artifacts:`);
  candidates.forEach(c => {
    console.log(`  [${c.group}] ${c.file} (${c.w}x${c.h}) -> Top: ${c.topMax}, Bot: ${c.botMax}, Left: ${c.leftMax}, Right: ${c.rightMax}`);
  });
}

findSubtleBorders().catch(console.error);
