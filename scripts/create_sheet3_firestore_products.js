const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PAYLOAD_FILE = path.join(PROJECT_ROOT, 'build', 'sheet3_dry_run_payloads.json');

// Convert JS object to Firestore REST API fields format
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_docId') continue;
    if (v === null || v === undefined) {
      fields[k] = { nullValue: null };
    } else if (typeof v === 'string') {
      fields[k] = { stringValue: v };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (typeof v === 'number') {
      if (Number.isInteger(v)) {
        fields[k] = { integerValue: v.toString() };
      } else {
        fields[k] = { doubleValue: v };
      }
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map(item => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') {
              return Number.isInteger(item) ? { integerValue: item.toString() } : { doubleValue: item };
            }
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

// Write document to collection via REST API (PATCH with merge behavior)
function writeFirestoreDoc(collectionName, docId, data) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/${collectionName}/${docId}`;
    const payload = JSON.stringify({
      fields: toFirestoreFields(data)
    });

    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Failed to write ${collectionName}/${docId} (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runCreation() {
  console.log('======================================================================');
  console.log('PHASE 4C — PRODUCTION SHEET 3 FIRESTORE DOCUMENT CREATION');
  console.log('======================================================================\n');

  if (!fs.existsSync(PAYLOAD_FILE)) {
    throw new Error(`Dry run payload file not found at: ${PAYLOAD_FILE}`);
  }

  const dryRunData = JSON.parse(fs.readFileSync(PAYLOAD_FILE, 'utf8'));
  const docs = dryRunData.allProposedDocuments;
  console.log(`Loaded ${docs.length} validated Sheet 3 product documents for creation.`);

  const results = {
    totalExpected: docs.length,
    productsCreated: 0,
    tilesCreated: 0,
    failures: [],
    createdList: []
  };

  const startTime = Date.now();
  const CONCURRENCY = 5;

  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    const chunk = docs.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (doc) => {
      const docId = doc.id;
      try {
        // 1. Write to "products" collection
        await writeFirestoreDoc('products', docId, doc);
        results.productsCreated++;

        // 2. Write to mirror "tiles" collection
        await writeFirestoreDoc('tiles', docId, doc);
        results.tilesCreated++;

        results.createdList.push({
          sku: doc.sku,
          docId: docId,
          name: doc.name,
          mockupsCount: doc.mockupImages.length,
          facesCount: doc.faceImages.length,
          randomPattern: doc.randomPattern
        });
      } catch (err) {
        console.error(`ERROR creating ${docId}:`, err.message);
        results.failures.push({ sku: doc.sku, docId, error: err.message });
      }
    }));

    const done = Math.min(i + CONCURRENCY, docs.length);
    console.log(`Progress: ${done} / ${docs.length} products created in products and tiles.`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================================`);
  console.log(`SHEET 3 CREATION SUMMARY (${durationSec}s):`);
  console.log(`- Total Expected: ${results.totalExpected}`);
  console.log(`- Created in "products": ${results.productsCreated} / ${docs.length}`);
  console.log(`- Created in "tiles" (mirror): ${results.tilesCreated} / ${docs.length}`);
  console.log(`- Failures: ${results.failures.length}`);
  console.log(`======================================================================\n`);

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'build', 'sheet3_creation_report.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('Creation report written to build/sheet3_creation_report.json');
}

runCreation().catch(err => {
  console.error('Fatal Sheet 3 creation error:', err);
  process.exit(1);
});
