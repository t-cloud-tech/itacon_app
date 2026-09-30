const https = require('https');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

async function main() {
  const token = await getFreshAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/quotations?pageSize=2`;

  https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => {
      const parsed = JSON.parse(b);
      console.log('Total returned quotes:', (parsed.documents || []).length);
      for (const doc of (parsed.documents || [])) {
        const docId = doc.name.split('/').pop();
        console.log('\n--- QUOTE DOC ID:', docId);
        const fields = doc.fields || {};
        for (const [k, v] of Object.entries(fields)) {
          let val = Object.values(v)[0];
          if (typeof val === 'object') val = JSON.stringify(val).slice(0, 50);
          console.log(`  ${k}: ${val}`);
        }
      }
    });
  });
}

main().catch(console.error);
