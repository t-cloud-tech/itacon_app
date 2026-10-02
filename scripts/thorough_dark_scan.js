const fs = require('fs');
const path = require('path');
const sharp = require('./node_modules/sharp');

const mapping = JSON.parse(fs.readFileSync('scripts/batch2_room_mapping.json', 'utf8'));

async function thoroughScan() {
  console.log(`Scanning all ${mapping.length} images for any dark bars or borders...`);

  let foundBorders = [];

  for (let i = 0; i < mapping.length; i++) {
    const item = mapping[i];
    const raw = await sharp(item.localSource).resize(300, 300, { fit: 'fill' }).raw().toBuffer();

    // Check top 60 rows (top 20%)
    let topDarkRows = 0;
    for (let y = 0; y < 60; y++) {
      let darkCount = 0;
      for (let x = 0; x < 300; x++) {
        const idx = (y * 300 + x) * 3;
        if (raw[idx] < 50 && raw[idx+1] < 50 && raw[idx+2] < 50) darkCount++;
      }
      if (darkCount / 300 >= 0.50) topDarkRows++;
    }

    // Check bottom 60 rows (bottom 20%)
    let botDarkRows = 0;
    for (let y = 240; y < 300; y++) {
      let darkCount = 0;
      for (let x = 0; x < 300; x++) {
        const idx = (y * 300 + x) * 3;
        if (raw[idx] < 50 && raw[idx+1] < 50 && raw[idx+2] < 50) darkCount++;
      }
      if (darkCount / 300 >= 0.50) botDarkRows++;
    }

    // Check left 60 cols (left 20%)
    let leftDarkCols = 0;
    for (let x = 0; x < 60; x++) {
      let darkCount = 0;
      for (let y = 0; y < 300; y++) {
        const idx = (y * 300 + x) * 3;
        if (raw[idx] < 50 && raw[idx+1] < 50 && raw[idx+2] < 50) darkCount++;
      }
      if (darkCount / 300 >= 0.50) leftDarkCols++;
    }

    // Check right 60 cols (right 20%)
    let rightDarkCols = 0;
    for (let x = 240; x < 300; x++) {
      let darkCount = 0;
      for (let y = 0; y < 300; y++) {
        const idx = (y * 300 + x) * 3;
        if (raw[idx] < 50 && raw[idx+1] < 50 && raw[idx+2] < 50) darkCount++;
      }
      if (darkCount / 300 >= 0.50) rightDarkCols++;
    }

    if (topDarkRows >= 5 || botDarkRows >= 5 || leftDarkCols >= 5 || rightDarkCols >= 5) {
      foundBorders.push({
        design: item.design,
        file: item.storageMockupName,
        topDarkRows,
        botDarkRows,
        leftDarkCols,
        rightDarkCols
      });
    }
  }

  console.log(`Thorough scan complete. Images with dark bars: ${foundBorders.length} / ${mapping.length}`);
  if (foundBorders.length > 0) {
    console.log('Sample images with dark bars:', foundBorders.slice(0, 10));
  }
}

thoroughScan().catch(console.error);
