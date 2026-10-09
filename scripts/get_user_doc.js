const https = require('https');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

function getRequest(url, token) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });
}

async function main() {
  const token = await getFreshAccessToken();
  const uid = '3zdYNxT4uiOjtZx3hQdieEEKlJ32';
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const doc = await getRequest(url, token);
  console.log('Doc users/' + uid + ':', JSON.stringify(doc, null, 2));
}

main().catch(console.error);
