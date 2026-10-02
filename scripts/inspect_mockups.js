const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dirs = [
  { name: 'Sheet 1', path: 'assets/images/mockups' },
  { name: 'Sheet 2', path: 'assets/product_import/sheet2/mockups' },
  { name: 'Sheet 3', path: 'assets/product_import/sheet3/mockups' }
];

async function inspect() {
  const dimMap = {};
  const allImages = [];

  for (const d of dirs) {
    const files = fs.readdirSync(d.path).filter(f => !f.startsWith('.'));
    for (const f of files) {
      const fullPath = path.join(d.path, f);
      try {
        const meta = await sharp(fullPath).metadata();
        const dim = `${meta.width}x${meta.height}`;
        dimMap[dim] = (dimMap[dim] || 0) + 1;
        allImages.push({
          dir: d.name,
          dirPath: d.path,
          filename: f,
          fullPath,
          width: meta.width,
          height: meta.height,
          format: meta.format,
          channels: meta.channels
        });
      } catch (e) {
        console.error('Error reading', fullPath, e.message);
      }
    }
  }

  console.log(`Total mockups analyzed: ${allImages.length}`);
  console.log('Dimension distribution:', JSON.stringify(dimMap, null, 2));

  return allImages;
}

inspect();
