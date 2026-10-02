const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

async function inspectCroppedFiles() {
  const s2Dir = 'assets/product_import/sheet2/mockups';
  const s3Dir = 'assets/product_import/sheet3/mockups';

  const s2Files = fs.readdirSync(s2Dir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
  const s3Files = fs.readdirSync(s3Dir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));

  console.log(`Checking current files in ${s2Dir} (${s2Files.length} files)...`);

  let s2RemainingBorders = [];
  for (const f of s2Files) {
    const p = path.join(s2Dir, f);
    const meta = await sharp(p).metadata();
    const raw = await sharp(p).resize(200, 200, { fit: 'fill' }).raw().toBuffer();

    let topBlack = 0, botBlack = 0, leftBlack = 0, rightBlack = 0;
    for (let i = 0; i < 200; i++) {
      // top row
      const t = (0 * 200 + i) * 3;
      if (raw[t] < 50 && raw[t+1] < 50 && raw[t+2] < 50) topBlack++;

      // bot row
      const b = (199 * 200 + i) * 3;
      if (raw[b] < 50 && raw[b+1] < 50 && raw[b+2] < 50) botBlack++;

      // left col
      const l = (i * 200 + 0) * 3;
      if (raw[l] < 50 && raw[l+1] < 50 && raw[l+2] < 50) leftBlack++;

      // right col
      const r = (i * 200 + 199) * 3;
      if (raw[r] < 50 && raw[r+1] < 50 && raw[r+2] < 50) rightBlack++;
    }

    // Also check row 1, 2, 3 (in case 1px border remains)
    let topR1 = 0, botR1 = 0;
    for (let i = 0; i < 200; i++) {
      const t = (1 * 200 + i) * 3;
      if (raw[t] < 50 && raw[t+1] < 50 && raw[t+2] < 50) topR1++;

      const b = (198 * 200 + i) * 3;
      if (raw[b] < 50 && raw[b+1] < 50 && raw[b+2] < 50) botR1++;
    }

    if (topBlack / 200 >= 0.40 || botBlack / 200 >= 0.40 || leftBlack / 200 >= 0.40 || rightBlack / 200 >= 0.40 ||
        topR1 / 200 >= 0.40 || botR1 / 200 >= 0.40) {
      s2RemainingBorders.push({
        file: f,
        w: meta.width,
        h: meta.height,
        topPct: (topBlack/200).toFixed(2),
        botPct: (botBlack/200).toFixed(2),
        leftPct: (leftBlack/200).toFixed(2),
        rightPct: (rightBlack/200).toFixed(2),
      });
    }
  }

  console.log(`Sheet 2 remaining with borders: ${s2RemainingBorders.length} / ${s2Files.length}`);
  if (s2RemainingBorders.length > 0) {
    console.log('Sample Sheet 2 remaining:', s2RemainingBorders.slice(0, 10));
  }

  console.log(`\nChecking current files in ${s3Dir} (${s3Files.length} files)...`);
  let s3RemainingBorders = [];
  for (const f of s3Files) {
    const p = path.join(s3Dir, f);
    const meta = await sharp(p).metadata();
    const raw = await sharp(p).resize(200, 200, { fit: 'fill' }).raw().toBuffer();

    let topBlack = 0, botBlack = 0, leftBlack = 0, rightBlack = 0;
    for (let i = 0; i < 200; i++) {
      const t = (0 * 200 + i) * 3;
      if (raw[t] < 50 && raw[t+1] < 50 && raw[t+2] < 50) topBlack++;

      const b = (199 * 200 + i) * 3;
      if (raw[b] < 50 && raw[b+1] < 50 && raw[b+2] < 50) botBlack++;

      const l = (i * 200 + 0) * 3;
      if (raw[l] < 50 && raw[l+1] < 50 && raw[l+2] < 50) leftBlack++;

      const r = (i * 200 + 199) * 3;
      if (raw[r] < 50 && raw[r+1] < 50 && raw[r+2] < 50) rightBlack++;
    }

    let topR1 = 0, botR1 = 0;
    for (let i = 0; i < 200; i++) {
      const t = (1 * 200 + i) * 3;
      if (raw[t] < 50 && raw[t+1] < 50 && raw[t+2] < 50) topR1++;

      const b = (198 * 200 + i) * 3;
      if (raw[b] < 50 && raw[b+1] < 50 && raw[b+2] < 50) botR1++;
    }

    if (topBlack / 200 >= 0.40 || botBlack / 200 >= 0.40 || leftBlack / 200 >= 0.40 || rightBlack / 200 >= 0.40 ||
        topR1 / 200 >= 0.40 || botR1 / 200 >= 0.40) {
      s3RemainingBorders.push({
        file: f,
        w: meta.width,
        h: meta.height,
        topPct: (topBlack/200).toFixed(2),
        botPct: (botBlack/200).toFixed(2),
        leftPct: (leftBlack/200).toFixed(2),
        rightPct: (rightBlack/200).toFixed(2),
      });
    }
  }

  console.log(`Sheet 3 remaining with borders: ${s3RemainingBorders.length} / ${s3Files.length}`);
  if (s3RemainingBorders.length > 0) {
    console.log('Sample Sheet 3 remaining:', s3RemainingBorders.slice(0, 10));
  }
}

inspectCroppedFiles().catch(console.error);
