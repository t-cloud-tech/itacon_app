const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function refreshAccessTokenIfNeeded() {
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
}

async function queryCollection(colName) {
  await refreshAccessTokenIfNeeded();
  const token = cfg.tokens.access_token;
  const projectId = 'itacon-app';
  let docs = [];
  let pageToken = '';

  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colName}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      }).on('error', reject);
    });

    if (data.documents) {
      docs = docs.concat(data.documents);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return docs;
}

async function run() {
  console.log('Querying Firestore products and tiles collections...');
  const productDocs = await queryCollection('products');
  console.log('Firestore "products" count:', productDocs.length);

  const tileDocs = await queryCollection('tiles');
  console.log('Firestore "tiles" count:', tileDocs.length);

  const allMockups = new Set();
  const allImages = new Set();

  function extractImages(doc) {
    const fields = doc.fields || {};
    // check frontCardImage, mockupImages, images
    if (fields.frontCardImage && fields.frontCardImage.stringValue) {
      allMockups.add(fields.frontCardImage.stringValue);
    }
    if (fields.mockupImages && fields.mockupImages.arrayValue && fields.mockupImages.arrayValue.values) {
      fields.mockupImages.arrayValue.values.forEach(v => {
        if (v.stringValue) allMockups.add(v.stringValue);
      });
    }
    if (fields.images && fields.images.arrayValue && fields.images.arrayValue.values) {
      fields.images.arrayValue.values.forEach(v => {
        if (v.stringValue) {
          allImages.add(v.stringValue);
          if (v.stringValue.includes('mockup')) allMockups.add(v.stringValue);
        }
      });
    }
  }

  productDocs.forEach(extractImages);
  tileDocs.forEach(extractImages);

  console.log('Total unique mockup paths referenced in Firestore:', allMockups.size);
  console.log('Sample mockup paths in Firestore:', Array.from(allMockups).slice(0, 10));

  const audit1 = JSON.parse(fs.readFileSync('image_cleanup_preview/mockup_cleanup_audit.json', 'utf8'));
  const batch1Filenames = new Set(audit1.map(i => path.basename(i.filename || '')));

  let fsInBatch1 = 0;
  let fsNotInBatch1 = 0;
  const fsNotInBatch1List = [];

  allMockups.forEach(m => {
    const b = path.basename(m);
    if (batch1Filenames.has(b)) fsInBatch1++;
    else {
      fsNotInBatch1++;
      fsNotInBatch1List.push(m);
    }
  });

  console.log('Firestore mockups audited in Batch 1:', fsInBatch1);
  console.log('Firestore mockups NOT audited in Batch 1:', fsNotInBatch1);
  if (fsNotInBatch1List.length > 0) {
    console.log('Sample Firestore mockups NOT in Batch 1:', fsNotInBatch1List.slice(0, 10));
  }
}

run().catch(console.error);
