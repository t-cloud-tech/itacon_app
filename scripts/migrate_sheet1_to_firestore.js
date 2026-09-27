const fs = require('fs');
const path = require('path');
const https = require('https');
const XLSX = require('./node_modules/xlsx');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = 'D:/Itacon Product (2) (1) (2).xlsx';
const BUCKET = 'itacon-app.firebasestorage.app';

// Persistent HTTPS agent with keep-alive
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 60000
});

function getCliAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cfg.tokens.access_token;
}

async function refreshAccessTokenIfNeeded() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const expiresAt = cfg.tokens.expires_at || 0;
  if (Date.now() + 5 * 60 * 1000 > expiresAt) {
    const api = require('C:\\Users\\ttirt\\AppData\\Roaming\\npm\\node_modules\\firebase-tools\\lib\\api');
    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      refresh_token: cfg.tokens.refresh_token
    }).toString();

    await new Promise((resolve, reject) => {
      const req = https.request('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const data = JSON.parse(body);
          if (data.access_token) {
            cfg.tokens.access_token = data.access_token;
            cfg.tokens.expires_at = Date.now() + data.expires_in * 1000;
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
            resolve();
          } else {
            reject(new Error('Token refresh failed: ' + body));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
  return cfg.tokens.access_token;
}

// Convert standard JS object to Firestore REST fields map
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      fields[k] = { nullValue: null };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (typeof v === 'number') {
      if (Number.isInteger(v)) {
        fields[k] = { integerValue: v.toString() };
      } else {
        fields[k] = { doubleValue: v };
      }
    } else if (typeof v === 'string') {
      fields[k] = { stringValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map(item => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') return Number.isInteger(item) ? { integerValue: item.toString() } : { doubleValue: item };
            if (typeof item === 'boolean') return { booleanValue: item };
            return { stringValue: String(item) };
          })
        }
      };
    } else if (typeof v === 'object') {
      fields[k] = {
        mapValue: {
          fields: toFirestoreFields(v)
        }
      };
    }
  }
  return fields;
}

async function writeDoc(token, collection, docId, data) {
  const fields = toFirestoreFields(data);
  const postData = JSON.stringify({ fields });
  const url = `https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/${collection}/${docId}`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'PATCH',
      agent: httpsAgent,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Failed to write ${collection}/${docId} (${res.statusCode}): ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Fetch all Storage objects in bucket
async function fetchStorageInventory(token) {
  const storageSet = new Set();
  let pageToken = '';
  do {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?maxResults=1000${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.items) {
      data.items.forEach(i => storageSet.add(i.name));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return storageSet;
}

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log('======================================================================');
  console.log(`PHASE 1: SHEET 1 FIRESTORE MIGRATION (${isApply ? 'APPLY MODE' : 'DRY RUN'})`);
  console.log('======================================================================\n');

  const token = await refreshAccessTokenIfNeeded();

  console.log('1. Loading Storage inventory for verification...');
  const storageSet = await fetchStorageInventory(token);
  console.log(`   Found ${storageSet.size} objects in bucket.`);

  console.log('2. Reading Master Excel Sheet 1...');
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws1 = wb.Sheets['1'];
  const rawRows = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });

  const excelRows = [];
  for (let i = 2; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (r && r[1] && String(r[1]).trim().length > 0) {
      excelRows.push({
        excelRow: i + 1,
        sku: String(r[1]).trim(),
        designName: String(r[9]).trim(),
        productCategory: String(r[2]).trim() || 'VIT',
        sizeCm: String(r[3]).trim() || '60X120',
        thickness: Number(r[4]) || 8.5,
        surface: String(r[5]).trim() || 'Glossy',
        collection: String(r[6]).trim() || 'Marble - Random',
        baseColor: String(r[7]).trim() || 'White Statuario',
        shortCode: String(r[8]).trim(),
        applicableSpaces: String(r[10]).trim() || 'Floors\\Walls',
        boxWeight: Number(r[11]) || 27.0,
        pcsPerBox: Number(r[12]) || 2,
        sqFtPerBox: Number(r[13]) || 15.5,
        price: Number(r[14]) || 35.0,
        moq: Number(r[15]) || 100,
        stockStatus: String(r[16]).trim() || 'AVAILABLE',
        stockQty: Number(r[17]) || 100
      });
    }
  }

  console.log(`   Valid Sheet 1 products in Master Excel: ${excelRows.length} (Expected: 62)`);
  if (excelRows.length !== 62) {
    throw new Error(`Expected exactly 62 products in Sheet 1, found ${excelRows.length}`);
  }

  console.log('3. Loading verified image mappings for Sheet 1...');
  const staticProducts = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'build', 'sheet1_parsed_products.json'), 'utf8'));
  const staticBySku = new Map();
  staticProducts.forEach(p => staticBySku.set(p.sku, p));

  const payloads = [];
  for (const exp of excelRows) {
    const staticItem = staticBySku.get(exp.sku);
    if (!staticItem) {
      throw new Error(`Missing image metadata for Sheet 1 SKU: ${exp.sku}`);
    }

    const mockupImages = staticItem.mockupImages || [];
    const faceImages = staticItem.faceImages || [];

    if (mockupImages.length === 0) {
      throw new Error(`Empty mockupImages for SKU ${exp.sku}`);
    }

    // Verify primary mockup in storage
    if (!storageSet.has(mockupImages[0])) {
      throw new Error(`Mockup ${mockupImages[0]} does not exist in Firebase Storage for SKU ${exp.sku}`);
    }

    // Verify all faces in storage
    for (const f of faceImages) {
      if (!storageSet.has(f)) {
        throw new Error(`Tile face ${f} does not exist in Firebase Storage for SKU ${exp.sku}`);
      }
    }

    // Standard doc ID matching project convention
    const docId = 'PROD_' + exp.sku.replace(/[^a-zA-Z0-9]/g, '_');

    // Compatibility rule: images[0] = mockupImages[0]
    const images = [mockupImages[0]];

    const faceCount = faceImages.length;
    const randomPattern = faceCount > 0 ? `${faceCount} Faces` : (exp.collection.toLowerCase().includes('random') ? '4 Faces' : 'Endless Pattern');

    const productPayload = {
      id: docId,
      productId: docId,
      sku: exp.sku,
      name: exp.designName,
      shortCode: exp.shortCode,
      size: '600x1200 mm',
      thickness: `${exp.thickness} mm`,
      thicknessMm: exp.thickness,
      surface: exp.surface,
      finish: exp.surface,
      collection: exp.collection,
      baseColor: exp.baseColor,
      baseColour: exp.baseColor,
      basePrice: exp.price,
      moq: exp.moq,
      stockStatus: exp.stockStatus.toLowerCase() === 'available' ? 'available_now' : 'available_now',
      availableQuantity: exp.stockQty,
      currentStock: exp.stockQty,
      availableStock: exp.stockQty,
      reservedStock: 0,
      inStock: true,
      isActive: true,
      isComingSoon: false,
      categoryId: 'CAT_VITRIFIED',
      categoryName: 'Vitrified Tiles',
      productLine: 'tiles',
      productType: 'Vitrified',
      bodyType: 'Porcelain',
      spaces: ['Living Room', 'Bedroom', 'Bath Room', 'Commercial', 'Wall'],
      shape: 'rectangle',
      aspectRatio: '0.5',
      aspectRatioValue: 0.5,
      shade: 'Light',
      priceCategory: 'Premium',
      pcsPerBox: exp.pcsPerBox,
      boxWeightKg: exp.boxWeight,
      sqFtPerBox: exp.sqFtPerBox,
      packingDetails: {
        sqmPerBox: '1.44',
        boxWeight: `${exp.boxWeight} kg`,
        boxesPerPallet: 40,
        piecesPerBox: exp.pcsPerBox
      },
      randomPattern,
      mockupImages,
      faceImages,
      images,
      lifestyleImages: []
    };

    payloads.push({ docId, payload: productPayload });
  }

  console.log(`\n4. Prepared ${payloads.length} product payloads ready for import.`);

  if (!isApply) {
    console.log('\nDRY RUN COMPLETE. Payloads validated. Run with --apply to commit to production.');
    fs.writeFileSync(
      path.join(PROJECT_ROOT, 'build', 'sheet1_dry_run_payloads.json'),
      JSON.stringify(payloads, null, 2),
      'utf8'
    );
    return;
  }

  console.log('\n5. WRITING TO FIRESTORE "products" and "tiles"...');
  let productsWritten = 0;
  let tilesWritten = 0;

  for (let i = 0; i < payloads.length; i++) {
    const { docId, payload } = payloads[i];
    await writeDoc(token, 'products', docId, payload);
    productsWritten++;
    await writeDoc(token, 'tiles', docId, payload);
    tilesWritten++;

    if ((i + 1) % 10 === 0 || i === payloads.length - 1) {
      console.log(`Progress: ${i + 1} / ${payloads.length} (${((i + 1) / payloads.length * 100).toFixed(1)}%)`);
    }
  }

  console.log('\n======================================================================');
  console.log('SHEET 1 MIGRATION SUCCESSFUL!');
  console.log(`- Documents written to "products": ${productsWritten}`);
  console.log(`- Documents written to "tiles":    ${tilesWritten}`);
  console.log('======================================================================\n');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
