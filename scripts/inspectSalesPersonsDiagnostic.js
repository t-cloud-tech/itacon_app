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

const parseDoc = (doc) => {
  const docId = doc.name ? doc.name.split('/').pop() : '';
  const f = doc.fields || {};
  const getVal = (v) => {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
    if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
    if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(getVal);
    if (v.mapValue !== undefined) {
      const res = {};
      for (const k of Object.keys(v.mapValue.fields || {})) {
        res[k] = getVal(v.mapValue.fields[k]);
      }
      return res;
    }
    return null;
  };
  const res = { id: docId };
  for (const k of Object.keys(f)) {
    res[k] = getVal(f[k]);
  }
  return res;
};

async function main() {
  const token = await getFreshAccessToken();
  console.log('Connected with fresh Firebase access token.');

  let allSpDocs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/salesPersons?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.documents) allSpDocs = allSpDocs.concat(data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Found ${allSpDocs.length} documents in collection 'salesPersons':\n`);
  const parsed = allSpDocs.map(parseDoc);

  console.log(JSON.stringify(parsed.map(sp => ({
    id: sp.id,
    name: sp.name || sp.fullName,
    rawReferralCode: JSON.stringify(sp.referralCode),
    typeofReferralCode: typeof sp.referralCode,
    isActive: sp.isActive,
    typeofIsActive: typeof sp.isActive,
    status: sp.status,
    typeofStatus: typeof sp.status,
    assignedClientsCount: sp.assignedClientsCount,
    activeClientsCount: sp.activeClientsCount,
  })), null, 2));
}

main().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
