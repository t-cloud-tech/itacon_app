const fs = require('fs');
const https = require('https');
const path = require('path');

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

async function fetchCollection(collectionName) {
  const token = await refreshAccessTokenIfNeeded();
  const projectId = 'itacon-app';
  let allDocs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => {
          try {
            resolve(JSON.parse(b));
          } catch(e) {
            reject(new Error(`Failed to parse response: ${b}`));
          }
        });
      }).on('error', reject);
    });

    if (data.error) {
      throw new Error(`Firestore API Error on ${collectionName}: ${JSON.stringify(data.error)}`);
    }

    if (data.documents) allDocs = allDocs.concat(data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return allDocs;
}

function parseVal(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseVal);
  if (v.mapValue !== undefined) {
    const res = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
      res[k] = parseVal(val);
    }
    return res;
  }
  return null;
}

function docToObj(doc) {
  const id = doc.name.split('/').pop();
  const res = { _id: id };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    res[k] = parseVal(v);
  }
  return res;
}

async function main() {
  console.log('--- FETCHING LIVE FIRESTORE COLLECTIONS (READ-ONLY) ---');
  const rawProducts = await fetchCollection('products');
  console.log(`Fetched ${rawProducts.length} documents from /products`);

  const rawTiles = await fetchCollection('tiles');
  console.log(`Fetched ${rawTiles.length} documents from /tiles`);

  const products = rawProducts.map(docToObj);
  const tiles = rawTiles.map(docToObj);

  // Analyze /products
  const activeProducts = products.filter(p => p.isActive === true);
  const inactiveProducts = products.filter(p => p.isActive !== true);
  const adhesivesInProducts = products.filter(p => 
    p.productLine === 'adhesives' || 
    p.categoryId === 'CAT_ADHESIVES' || 
    (p.sku && p.sku.startsWith('ITA-LX')) ||
    (p.unit === 'bag')
  );
  const tilesInProducts = activeProducts.filter(p => !adhesivesInProducts.includes(p));

  console.log('\n=== FIRESTORE /products INVENTORY ===');
  console.log(`Total documents: ${products.length}`);
  console.log(`Active documents (isActive == true): ${activeProducts.length}`);
  console.log(`Inactive documents: ${inactiveProducts.length}`);
  console.log(`Adhesives in /products: ${adhesivesInProducts.length}`);
  console.log(`Active Tiles in /products: ${tilesInProducts.length}`);

  // Inspect field value frequencies in active tiles
  const freq = {
    productType: {},
    surface: {},
    finish: {},
    size: {},
    color: {},
    baseColour: {},
    baseColor: {},
    spaces: {},
    collection: {},
    pattern: {},
    thickness: {},
  };

  tilesInProducts.forEach(p => {
    const inc = (map, val) => {
      if (val === undefined || val === null) {
        map['[NULL/UNDEFINED]'] = (map['[NULL/UNDEFINED]'] || 0) + 1;
      } else if (Array.isArray(val)) {
        val.forEach(item => inc(map, item));
      } else {
        const s = String(val).trim();
        map[s] = (map[s] || 0) + 1;
      }
    };

    inc(freq.productType, p.productType);
    inc(freq.surface, p.surface);
    inc(freq.finish, p.finish);
    inc(freq.size, p.size);
    inc(freq.color, p.color);
    inc(freq.baseColour, p.baseColour);
    inc(freq.baseColor, p.baseColor);
    inc(freq.spaces, p.spaces);
    inc(freq.collection, p.collection);
    inc(freq.pattern, p.pattern);
    inc(freq.thickness, p.thickness);
  });

  console.log('\n--- FIELD DISTRIBUTIONS IN ACTIVE TILES (/products) ---');
  console.log('1. Product Types:', JSON.stringify(freq.productType, null, 2));
  console.log('2. Surface:', JSON.stringify(freq.surface, null, 2));
  console.log('3. Finish:', JSON.stringify(freq.finish, null, 2));
  console.log('4. Sizes:', JSON.stringify(freq.size, null, 2));
  console.log('5. Base Colours (baseColour / color):', JSON.stringify(freq.baseColour, null, 2));
  console.log('6. Spaces:', JSON.stringify(freq.spaces, null, 2));
  console.log('7. Collections:', JSON.stringify(freq.collection, null, 2));
  console.log('8. Patterns:', JSON.stringify(freq.pattern, null, 2));
  console.log('9. Thickness:', JSON.stringify(freq.thickness, null, 2));

  // Check /tiles collection too
  console.log('\n=== FIRESTORE /tiles INVENTORY ===');
  console.log(`Total documents in /tiles: ${tiles.length}`);
  const activeTilesColl = tiles.filter(t => t.isActive === true);
  console.log(`Active documents in /tiles: ${activeTilesColl.length}`);

  // Check categories collection too
  const rawCategories = await fetchCollection('categories');
  console.log(`\nFetched ${rawCategories.length} categories.`);
  rawCategories.forEach(c => {
    const obj = docToObj(c);
    console.log(`Category: id=${obj._id}, name=${obj.name}, productLine=${obj.productLine}`);
  });
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
