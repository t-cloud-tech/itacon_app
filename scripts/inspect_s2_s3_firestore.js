const fs = require('fs');
const https = require('https');

const configPath = 'C:\\Users\\ttirt\\.config\\configstore\\firebase-tools.json';
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function inspectFirestoreDocs() {
  const token = cfg.tokens.access_token;
  const projectId = 'itacon-app';

  // Fetch products from Firestore
  let allDocs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.documents) allDocs = allDocs.concat(data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Loaded ${allDocs.length} products from Firestore.`);

  const parseDoc = (doc) => {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    const getVal = (v) => {
      if (!v) return null;
      if (v.stringValue !== undefined) return v.stringValue;
      if (v.booleanValue !== undefined) return v.booleanValue;
      if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
      if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
      if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(getVal);
      return null;
    };
    return {
      docId,
      name: getVal(f.name),
      sku: getVal(f.sku),
      frontCardImage: getVal(f.frontCardImage),
      frontCardThumbnail: getVal(f.frontCardThumbnail),
      images: getVal(f.images) || [],
      mockupImages: getVal(f.mockupImages) || [],
      faceImages: getVal(f.faceImages) || []
    };
  };

  const parsed = allDocs.map(parseDoc);

  // Sheet 2 samples:
  const s2Samples = parsed.filter(p => p.sku && p.sku.startsWith('VIT-60120-8.50-GLO-MAR-WHIT-0') && !p.sku.includes('-00-'));
  console.log('\n--- SHEET 2 SAMPLES (Firestore) ---');
  s2Samples.slice(0, 5).forEach(p => {
    console.log(`Doc: ${p.docId} | SKU: ${p.sku} | Name: ${p.name}`);
    console.log(`  frontCardImage: ${p.frontCardImage}`);
    console.log(`  frontCardThumbnail: ${p.frontCardThumbnail}`);
    console.log(`  mockupImages:`, p.mockupImages);
    console.log(`  faceImages:`, p.faceImages);
    console.log(`  images:`, p.images);
  });

  // Sheet 3 samples:
  const s3Samples = parsed.filter(p => p.name && (p.name.startsWith('MG ') || p.name.includes('MG-')));
  console.log('\n--- SHEET 3 SAMPLES (Firestore) ---');
  s3Samples.slice(0, 5).forEach(p => {
    console.log(`Doc: ${p.docId} | SKU: ${p.sku} | Name: ${p.name}`);
    console.log(`  frontCardImage: ${p.frontCardImage}`);
    console.log(`  frontCardThumbnail: ${p.frontCardThumbnail}`);
    console.log(`  mockupImages:`, p.mockupImages);
    console.log(`  faceImages:`, p.faceImages);
    console.log(`  images:`, p.images);
  });
}

inspectFirestoreDocs().catch(console.error);
