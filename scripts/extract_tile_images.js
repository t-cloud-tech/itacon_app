const fs = require('fs');
const path = require('path');
const AdmZip = require(path.join(__dirname, 'node_modules', 'adm-zip'));
const XLSX = require(path.join(__dirname, 'node_modules', 'xlsx'));

const excelPath = path.join(__dirname, 'Itacon_Product_with_Tile_Images.xlsx');
const outputDir = path.join(__dirname, '..', 'assets', 'images', 'tiles');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Opening Excel Archive:', excelPath);
const zip = new AdmZip(excelPath);

const relsXml = zip.readAsText('xl/drawings/_rels/drawing1.xml.rels');
const drawingXml = zip.readAsText('xl/drawings/drawing1.xml');

const relsMap = {};
for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
  relsMap[m[1]] = m[2].replace('../media/', 'xl/media/');
}

const anchorRegex = /<xdr:from>\s*<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="([^"]+)"/g;
const imageByRow = {};
for (const match of drawingXml.matchAll(anchorRegex)) {
  const row = parseInt(match[2], 10);
  const rId = match[3];
  imageByRow[row] = relsMap[rId];
}

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

let extractedCount = 0;
const manifest = [];

for (let r = 2; r < rows.length; r++) {
  const rowData = rows[r];
  if (!rowData || !rowData[1]) continue;

  const sku = String(rowData[1]).trim();
  const shortCode = String(rowData[8]).trim();
  const designName = String(rowData[9]).trim();
  const mediaPath = imageByRow[r];

  let targetFileName = `${sku}.jpeg`;
  let targetFilePath = path.join(outputDir, targetFileName);
  let assetPath = `assets/images/tiles/${targetFileName}`;

  if (mediaPath) {
    const entry = zip.getEntry(mediaPath);
    if (entry) {
      const data = zip.readFile(entry);
      fs.writeFileSync(targetFilePath, data);
      extractedCount++;
    }
  } else {
    // If no media, use fallback
    targetFileName = `fallback_tile.jpeg`;
    assetPath = `assets/images/tiles/${targetFileName}`;
  }

  manifest.push({
    row: r,
    sku,
    shortCode,
    designName,
    hasRealImage: !!mediaPath,
    assetPath
  });
}

// Create fallback tile image by copying the first extracted image if fallback needed
if (fs.existsSync(path.join(outputDir, `${manifest[0].sku}.jpeg`))) {
  fs.copyFileSync(
    path.join(outputDir, `${manifest[0].sku}.jpeg`),
    path.join(outputDir, 'fallback_tile.jpeg')
  );
}

console.log(`\nSuccessfully extracted ${extractedCount} images into assets/images/tiles/`);
console.log(`Total products mapped in manifest: ${manifest.length}`);
fs.writeFileSync(path.join(__dirname, 'tile_images_manifest.json'), JSON.stringify(manifest, null, 2));
