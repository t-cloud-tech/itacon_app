const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function analyzeImage(filePath) {
  const image = sharp(filePath);
  const meta = await image.metadata();
  const width = meta.width;
  const height = meta.height;

  // Let's get raw pixel buffer (RGB)
  // To be fast, let's sample rows from top (0 to 200), bottom (height-200 to height), etc.
  // Or even better: extract top 300px, bottom 300px, left 300px, right 300px
  
  // Let's sample top 150 rows
  const topBuffer = await image
    .clone()
    .extract({ left: 0, top: 0, width: width, height: Math.min(300, height) })
    .raw()
    .toBuffer();

  const bottomHeight = Math.min(300, height);
  const bottomBuffer = await image
    .clone()
    .extract({ left: 0, top: height - bottomHeight, width: width, height: bottomHeight })
    .raw()
    .toBuffer();

  // Let's analyze top rows: for each row, compute % of near-black pixels (e.g. R<35, G<35, B<35)
  // Also compute average luminance, min/max luminance, std dev or variance
  console.log(`\n=== Analyzing: ${path.basename(filePath)} (${width}x${height}) ===`);

  function rowStats(buffer, rowIdx, rowWidth, channels) {
    let nearBlackCount = 0;
    let sumLum = 0;
    let maxLum = 0;
    let minLum = 255;
    const start = rowIdx * rowWidth * channels;
    for (let x = 0; x < rowWidth; x++) {
      const idx = start + x * channels;
      const r = buffer[idx];
      const g = buffer[idx + 1];
      const b = buffer[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      sumLum += lum;
      if (lum > maxLum) maxLum = lum;
      if (lum < minLum) minLum = lum;
      // near-black: all channels < 35 or lum < 30
      if (r < 35 && g < 35 && b < 35) {
        nearBlackCount++;
      }
    }
    const avgLum = sumLum / rowWidth;
    const pctBlack = (nearBlackCount / rowWidth) * 100;
    return { avgLum: avgLum.toFixed(1), maxLum: maxLum.toFixed(1), minLum: minLum.toFixed(1), pctBlack: pctBlack.toFixed(1) };
  }

  console.log('Top rows stats (sampled):');
  for (let r = 0; r < Math.min(150, height); r += 10) {
    const s = rowStats(topBuffer, r, width, meta.channels);
    console.log(`  Row ${r}: AvgLum=${s.avgLum}, MaxLum=${s.maxLum}, MinLum=${s.minLum}, BlackPct=${s.pctBlack}%`);
  }

  console.log('Bottom rows stats (sampled):');
  for (let r = bottomHeight - 1; r >= Math.max(0, bottomHeight - 150); r -= 10) {
    const s = rowStats(bottomBuffer, r, width, meta.channels);
    const actualRow = height - bottomHeight + r;
    console.log(`  Row ${actualRow}: AvgLum=${s.avgLum}, MaxLum=${s.maxLum}, MinLum=${s.minLum}, BlackPct=${s.pctBlack}%`);
  }
}

async function run() {
  // Test 1 from Sheet 1
  const s1Files = fs.readdirSync('assets/images/mockups').filter(f => f.endsWith('.jpeg'));
  if (s1Files.length > 0) {
    await analyzeImage(path.join('assets/images/mockups', s1Files[0]));
  }

  // Test 1 from Sheet 2
  const s2Files = fs.readdirSync('assets/product_import/sheet2/mockups').filter(f => f.endsWith('.jpeg'));
  if (s2Files.length > 0) {
    await analyzeImage(path.join('assets/product_import/sheet2/mockups', s2Files[0]));
  }

  // Test 1 from Sheet 3
  const s3Files = fs.readdirSync('assets/product_import/sheet3/mockups').filter(f => f.endsWith('.jpeg'));
  if (s3Files.length > 0) {
    await analyzeImage(path.join('assets/product_import/sheet3/mockups', s3Files[0]));
  }
}

run().catch(console.error);
