const fs = require('fs');
const path = require('path');

const storageInv = JSON.parse(fs.readFileSync('C:/Users/ttirt/.gemini/antigravity-ide/brain/9a357262-e52e-4fc6-bd45-24d6fc3121bc/scratch/storage_objects_inventory.json', 'utf8'));
const storageNames = new Set(storageInv.map(item => item.name));

const localDirs = [
  { category: 'mockup', localDir: 'd:/itacon_app/assets/images/mockups', storagePrefix: 'products/mockups/' },
  { category: 'tile', localDir: 'd:/itacon_app/assets/images/tiles', storagePrefix: 'products/tiles/' },
  { category: 'adhesive', localDir: 'd:/itacon_app/assets/images/adhesives', storagePrefix: 'products/adhesives/' }
];

let totalLocal = 0;
let matchedStorage = 0;
let missingInStorage = [];
let basenameMap = new Map();

for (const { category, localDir, storagePrefix } of localDirs) {
  const files = fs.readdirSync(localDir);
  console.log(`Directory ${localDir}: found ${files.length} files`);
  for (const f of files) {
    totalLocal++;
    const ext = path.extname(f);
    const base = path.basename(f, ext);
    const storagePath = `${storagePrefix}${f}`;
    
    // Check collisions for thumb name
    const thumbName = `${base}.webp`;
    const catThumbKey = `${category}/${thumbName}`;
    if (basenameMap.has(catThumbKey)) {
      console.error(`COLLISION DETECTED: ${catThumbKey} already mapped from ${basenameMap.get(catThumbKey)} and now ${f}`);
    } else {
      basenameMap.set(catThumbKey, f);
    }
    
    if (storageNames.has(storagePath)) {
      matchedStorage++;
    } else {
      missingInStorage.push({ f, storagePath });
    }
  }
}

console.log(`Total local files inspected: ${totalLocal}`);
console.log(`Matched exactly in Firebase Storage: ${matchedStorage}`);
console.log(`Missing in Firebase Storage: ${missingInStorage.length}`);
if (missingInStorage.length > 0) {
  console.log('Sample missing:', missingInStorage.slice(0, 5));
}
