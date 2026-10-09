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

function getRequest(url, token) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          resolve(b);
        }
      });
    }).on('error', reject);
  });
}

function postRequest(url, token, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          resolve(b);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const token = await getFreshAccessToken();
  console.log('Got access token');

  // Query Firebase Auth users to find the latest created user
  const authUrl = `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:batchGet?maxResults=20`;
  const authUsers = await getRequest(authUrl, token);
  console.log('Auth users count:', (authUsers.users || []).length);
  // Sort users by lastLoginAt or createdAt
  const sorted = (authUsers.users || []).sort((a, b) => parseInt(b.createdAt || 0) - parseInt(a.createdAt || 0));
  console.log('Top 3 newest Auth users:');
  for (const u of sorted.slice(0, 3)) {
    console.log({
      localId: u.localId,
      phoneNumber: u.phoneNumber,
      displayName: u.displayName,
      createdAt: new Date(parseInt(u.createdAt)).toISOString(),
      lastLoginAt: u.lastLoginAt ? new Date(parseInt(u.lastLoginAt)).toISOString() : null,
    });

    // Check if Firestore users/{localId} exists
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${u.localId}`;
    const userDoc = await getRequest(firestoreUrl, token);
    if (userDoc.error) {
      console.log(`Firestore doc users/${u.localId}: NOT FOUND (${userDoc.error.message})`);
    } else {
      console.log(`Firestore doc users/${u.localId}: EXISTS`);
      console.log('Fields:', Object.keys(userDoc.fields || {}));
    }
  }
}

main().catch(console.error);
