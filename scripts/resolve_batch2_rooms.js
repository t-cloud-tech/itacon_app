const fs = require('fs');
const path = require('path');

const csv = fs.readFileSync('scripts/ITACON_Image_Mapping.csv', 'utf8');
const lines = csv.split('\n').filter(Boolean);
const GLOSSY_EXTRACTED_DIR = 'D:/glossy/glossy';

// Subdirectory map
const dirEntries = fs.readdirSync(GLOSSY_EXTRACTED_DIR, { withFileTypes: true });
const subDirMap = new Map();
for (const d of dirEntries) {
  if (d.isDirectory()) {
    subDirMap.set(d.name.toLowerCase().trim(), d.name);
  }
}

function resolveSourceFile(sourceImageStr) {
  const cleanStr = sourceImageStr.replace(/\\/g, '/').trim();
  const parts = cleanStr.split('/');
  let targetFolder = '';
  let targetFilename = '';

  if (parts.length >= 3) {
    targetFolder = parts[1].trim();
    targetFilename = parts.slice(2).join('/').trim();
  } else if (parts.length === 2) {
    targetFolder = parts[0].trim();
    targetFilename = parts[1].trim();
  } else {
    targetFilename = parts[0].trim();
  }

  const directPath = path.join(GLOSSY_EXTRACTED_DIR, targetFolder, targetFilename);
  if (fs.existsSync(directPath)) return directPath;

  const actualFolder = subDirMap.get(targetFolder.toLowerCase());
  if (actualFolder) {
    const candidatePath = path.join(GLOSSY_EXTRACTED_DIR, actualFolder, targetFilename);
    if (fs.existsSync(candidatePath)) return candidatePath;

    const files = fs.readdirSync(path.join(GLOSSY_EXTRACTED_DIR, actualFolder));
    const targetNorm = targetFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = files.filter(f => f.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm);
    if (matched.length === 1) {
      return path.join(GLOSSY_EXTRACTED_DIR, actualFolder, matched[0]);
    }
  }

  const baseNorm = targetFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [_, actualDir] of subDirMap) {
    const files = fs.readdirSync(path.join(GLOSSY_EXTRACTED_DIR, actualDir));
    const matched = files.filter(f => f.toLowerCase().replace(/[^a-z0-9]/g, '') === baseNorm);
    if (matched.length === 1) {
      return path.join(GLOSSY_EXTRACTED_DIR, actualDir, matched[0]);
    }
  }

  return null;
}

const records = [];
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  if (parts.length >= 8) {
    const role = parts[4].trim();
    if (role === 'room') {
      records.push({
        design: parts[0].trim(),
        sku: parts[1].trim(),
        sourceImage: parts[3].trim(),
        role: role,
        seq: parts[5].trim(),
        storageMockupName: `${parts[1].trim()}_room${parts[5].trim()}.jpg`
      });
    }
  }
}

console.log('Total room records:', records.length);
let resolvedCount = 0;
let missing = [];

const mapping = [];
records.forEach(r => {
  const src = resolveSourceFile(r.sourceImage);
  if (src && fs.existsSync(src)) {
    resolvedCount++;
    mapping.push({
      ...r,
      localSource: src
    });
  } else {
    missing.push(r);
  }
});

console.log(`Resolved: ${resolvedCount} / ${records.length}`);
if (missing.length > 0) {
  console.log('Missing items:', missing);
} else {
  console.log('All 249 room files successfully resolved from D:/glossy/glossy!');
  fs.writeFileSync('scripts/batch2_room_mapping.json', JSON.stringify(mapping, null, 2), 'utf8');
}
