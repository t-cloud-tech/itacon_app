const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');
const https = require('https');

const FIREBASE_PROJECT_ID = 'itacon-app';
const BUCKET_NAME = 'itacon-app.firebasestorage.app';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

function fetchJson(url, token, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = https.request(reqOptions, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: b });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function deleteStorageObject(bucket, objectPath, token) {
  const encodedPath = encodeURIComponent(objectPath);
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedPath}`;
  const res = await fetchJson(url, token, { method: 'DELETE' });
  console.log(`Deleted ${objectPath}: status ${res.status}`);
  return res;
}

async function clearOrderUnpaidFields(orderId, token) {
  const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${orderId}?updateMask.fieldPaths=unpaidPoDocumentPath&updateMask.fieldPaths=unpaidPoContentHash`;
  const res = await fetchJson(patchUrl, token, {
    method: 'PATCH',
    body: {
      fields: {
        unpaidPoDocumentPath: { nullValue: null },
        unpaidPoContentHash: { nullValue: null },
      },
    },
  });
  console.log(`Cleared unpaidPo cache fields on order ${orderId}: status ${res.status}`);
}

async function main() {
  const token = await getFreshAccessToken();

  const filesToDelete = [
    'purchase_orders/k4UmJDSM8IEHQDiwjcqq/unpaid/ITC-PO-2026-5765_UNPAID.pdf',
    'purchase_orders/kedpYLjnhNyKMp3dtKAK/unpaid/ITC-PO-2026-9081_UNPAID.pdf',
  ];

  for (const f of filesToDelete) {
    await deleteStorageObject(BUCKET_NAME, f, token);
  }

  await clearOrderUnpaidFields('k4UmJDSM8IEHQDiwjcqq', token);
  await clearOrderUnpaidFields('kedpYLjnhNyKMp3dtKAK', token);

  console.log('Done deleting stale unpaid PDFs.');
}

main().catch(console.error);
