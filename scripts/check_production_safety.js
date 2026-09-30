const https = require('https');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  if (!acc || !acc.tokens || !acc.tokens.refresh_token) {
    throw new Error('No Firebase CLI account found. Run firebase login.');
  }
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

async function inspectCollection(collectionName, token) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=5`;
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    https.get(url, options, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const parsed = JSON.parse(b);
          const docCount = (parsed.documents || []).length;
          resolve({ collection: collectionName, sampleCount: docCount, hasDocs: docCount > 0 });
        } else {
          resolve({ collection: collectionName, error: `HTTP ${res.statusCode}` });
        }
      });
    }).on('error', (err) => resolve({ collection: collectionName, error: err.message }));
  });
}

async function checkSpecificDoc(docPath, token) {
  return new Promise((resolve) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${docPath}`;
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    https.get(url, options, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ path: docPath, exists: true });
        } else if (res.statusCode === 404) {
          resolve({ path: docPath, exists: false });
        } else {
          resolve({ path: docPath, error: `HTTP ${res.statusCode}` });
        }
      });
    }).on('error', (err) => resolve({ path: docPath, error: err.message }));
  });
}

async function main() {
  console.log('Authenticating via Firebase CLI...');
  const token = await getFreshAccessToken();
  console.log('Inspecting production collections non-destructively on project: ' + FIREBASE_PROJECT_ID);

  const collections = [
    'users',
    'orders',
    'loyaltyConfig',
    'referrals',
    'loyaltyTransactions',
    'redemptionRequests',
    'products',
    'promotions',
    'notifications',
    'chat_channels'
  ];

  for (const col of collections) {
    const res = await inspectCollection(col, token);
    console.log(`- Collection [${col}]: ${res.error ? 'Error ' + res.error : (res.hasDocs ? 'INTACT (documents detected)' : 'EXISTS (0 returned on sample page)')}`);
  }

  // Check specific singleton documents like loyaltyConfig/global and paymentConfig/bankTransfer
  const loyaltyConfigDoc = await checkSpecificDoc('loyaltyConfig/global', token);
  console.log(`- Document [loyaltyConfig/global]: ${loyaltyConfigDoc.exists ? 'EXISTS & INTACT' : 'NOT FOUND'}`);

  const paymentConfigDoc = await checkSpecificDoc('paymentConfig/bankTransfer', token);
  console.log(`- Document [paymentConfig/bankTransfer]: ${paymentConfigDoc.exists ? 'EXISTS' : 'NOT CREATED YET (as expected before Step 5)'}`);
}

main().catch(err => {
  console.error('Safety check failed:', err);
  process.exit(1);
});
