const fs = require('fs');
const https = require('https');

const configPath = 'C:\\Users\\ttirt\\.config\\configstore\\firebase-tools.json';
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function checkActiveProducts() {
  const token = cfg.tokens.access_token;
  const projectId = 'itacon-app';

  // Fetch from /products
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

  console.log(`Loaded ${allDocs.length} Firestore products.`);

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
      id: docId,
      name: getVal(f.name),
      sku: getVal(f.sku),
      isActive: getVal(f.isActive),
      frontCardImage: getVal(f.frontCardImage),
      frontCardThumbnail: getVal(f.frontCardThumbnail),
      images: getVal(f.images) || [],
      mockupImages: getVal(f.mockupImages) || [],
      faceImages: getVal(f.faceImages) || []
    };
  };

  const parsed = allDocs.map(parseDoc);
  const active = parsed.filter(p => p.isActive === true);
  console.log(`Active products count: ${active.length}`);

  // Look at the frontCardImage and mockupImages of active products
  console.log('\nSample active products frontCardImage & mockupImages:');
  active.slice(0, 10).forEach(p => {
    console.log(`SKU: ${p.sku} | Name: ${p.name}`);
    console.log(`  frontCardImage: ${p.frontCardImage}`);
    console.log(`  mockupImages: ${p.mockupImages.join(', ')}`);
  });

  // Check Sheet 2 products in Firestore (e.g. ADIGE CREMA)
  const adige = active.find(p => p.name === 'ADIGE CREMA');
  if (adige) {
    console.log('\nADIGE CREMA in Firestore:');
    console.log(`  frontCardImage: ${adige.frontCardImage}`);
    console.log(`  mockupImages: ${adige.mockupImages.join(', ')}`);
  }

  // Check Sheet 3 products in Firestore (e.g. MG ADRY STATUARIO)
  const mg = active.find(p => p.name && p.name.includes('ADRY'));
  if (mg) {
    console.log(`\n${mg.name} in Firestore:`);
    console.log(`  frontCardImage: ${mg.frontCardImage}`);
    console.log(`  mockupImages: ${mg.mockupImages.join(', ')}`);
  }
}

checkActiveProducts().catch(console.error);
