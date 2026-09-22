const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

async function testSharp() {
  const outDir = 'C:/Users/ttirt/.gemini/antigravity-ide/brain/9a357262-e52e-4fc6-bd45-24d6fc3121bc/scratch/test_thumbs';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. Mockup test
  const mockupPath = path.resolve('d:/itacon_app/assets/images/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-001_mockup.jpeg');
  const mockupMeta = await sharp(mockupPath).metadata();
  console.log('Mockup source:', mockupMeta.width, 'x', mockupMeta.height, 'format:', mockupMeta.format, 'size:', fs.statSync(mockupPath).size);
  
  // Resize preserving aspect ratio into 600x400 bounding box without distortion
  const mockupThumb = path.join(outDir, 'mockup_test.webp');
  await sharp(mockupPath)
    .resize(600, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(mockupThumb);
  const mockupThumbMeta = await sharp(mockupThumb).metadata();
  console.log('Mockup thumb:', mockupThumbMeta.width, 'x', mockupThumbMeta.height, 'size:', fs.statSync(mockupThumb).size, 'bytes');

  // 2. Tile face test
  const tilePath = path.resolve('d:/itacon_app/assets/images/tiles/VIT-60120-8.50-GLO-MAR-WHIT-00-001_face1.jpeg');
  const tileMeta = await sharp(tilePath).metadata();
  console.log('Tile source:', tileMeta.width, 'x', tileMeta.height, 'format:', tileMeta.format, 'size:', fs.statSync(tilePath).size);

  const tileThumb = path.join(outDir, 'tile_test.webp');
  await sharp(tilePath)
    .resize(200, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toFile(tileThumb);
  const tileThumbMeta = await sharp(tileThumb).metadata();
  console.log('Tile thumb:', tileThumbMeta.width, 'x', tileThumbMeta.height, 'size:', fs.statSync(tileThumb).size, 'bytes');

  // 3. Adhesive test
  const adhesivePath = path.resolve('d:/itacon_app/assets/images/adhesives/ITA-LX-01.png');
  const adhesiveMeta = await sharp(adhesivePath).metadata();
  console.log('Adhesive source:', adhesiveMeta.width, 'x', adhesiveMeta.height, 'format:', adhesiveMeta.format, 'size:', fs.statSync(adhesivePath).size);

  const adhesiveThumb = path.join(outDir, 'adhesive_test.webp');
  await sharp(adhesivePath)
    .resize(400, 500, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(adhesiveThumb);
  const adhesiveThumbMeta = await sharp(adhesiveThumb).metadata();
  console.log('Adhesive thumb:', adhesiveThumbMeta.width, 'x', adhesiveThumbMeta.height, 'size:', fs.statSync(adhesiveThumb).size, 'bytes');
}

testSharp().catch(console.error);
