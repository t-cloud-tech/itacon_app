const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');
const https = require('https');

const BUCKET_NAME = 'itacon-app.appspot.com'; // or itacon-app.firebasestorage.app

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

function fetchJson(url, token) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });
  });
}

async function listFiles(bucket) {
  const token = await getFreshAccessToken();
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=purchase_orders/`;
  const res = await fetchJson(url, token);
  return res.items || [];
}

async function main() {
  try {
    let items = await listFiles('itacon-app.firebasestorage.app');
    console.log(`Found ${items.length} items in itacon-app.firebasestorage.app:`);
    items.forEach(i => console.log(' - ' + i.name + ` (${i.size} bytes)`));
  } catch (e) {
    try {
      let items = await listFiles('itacon-app.appspot.com');
      console.log(`Found ${items.length} items in itacon-app.appspot.com:`);
      items.forEach(i => console.log(' - ' + i.name + ` (${i.size} bytes)`));
    } catch (err) {
      console.error('Error listing storage:', err);
    }
  }
}

main().catch(console.error);
