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

async function auditSalespersons() {
  const token = await getFreshAccessToken();
  console.log('Obtained fresh Firebase access token.');

  // Fetch all documents from salesPersons collection
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

  // Fetch users with role == 'salesperson' or check users collection
  let allUserDocs = [];
  pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.documents) allUserDocs = allUserDocs.concat(data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

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

  const parsedSp = allSpDocs.map(parseDoc);
  const parsedUsers = allUserDocs.map(parseDoc).filter(u => u.role === 'salesperson' || u.userCategory === 'salesperson');

  console.log('=== SALESPERSONS IN salesPersons COLLECTION ===');
  console.log(`Total count: ${parsedSp.length}`);
  parsedSp.forEach(sp => {
    console.log(JSON.stringify({
      id: sp.id,
      name: sp.name || sp.fullName,
      referralCode: sp.referralCode,
      status: sp.status,
      isActive: sp.isActive,
      phone: sp.phone || sp.phoneNumber,
      employeeId: sp.employeeId
    }, null, 2));
  });

  console.log('\n=== USERS WITH ROLE=salesperson IN users COLLECTION ===');
  console.log(`Total count: ${parsedUsers.length}`);
  parsedUsers.forEach(u => {
    console.log(JSON.stringify({
      id: u.id,
      name: u.name || u.fullName,
      referralCode: u.referralCode,
      status: u.status,
      isActive: u.isActive,
      phone: u.phone,
      role: u.role
    }, null, 2));
  });

  // Specifically check WNSahNXK9GQrGoiIEmD4QBvAeim1 in users
  const vrajInUsers = allUserDocs.map(parseDoc).find(u => u.id === 'WNSahNXK9GQrGoiIEmD4QBvAeim1');
  console.log('\n=== WNSahNXK9GQrGoiIEmD4QBvAeim1 IN users COLLECTION ===');
  if (vrajInUsers) {
    console.log(JSON.stringify(vrajInUsers, null, 2));
  } else {
    console.log('Not found in users collection');
  }
}

auditSalespersons().catch(console.error);
