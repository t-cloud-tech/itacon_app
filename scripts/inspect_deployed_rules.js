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

async function main() {
  const token = await getFreshAccessToken();
  console.log('Got access token');

  // List releases
  const releasesUrl = `https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases`;
  const releases = await getRequest(releasesUrl, token);
  console.log('Releases:', JSON.stringify(releases, null, 2));

  // Find firestore release
  const firestoreRelease = (releases.releases || []).find(r => r.name.includes('cloud.firestore'));
  if (firestoreRelease) {
    console.log('Firestore release rulesetName:', firestoreRelease.rulesetName);
    const rulesetUrl = `https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`;
    const ruleset = await getRequest(rulesetUrl, token);
    if (ruleset.source && ruleset.source.files) {
      for (const file of ruleset.source.files) {
        console.log(`=== FILE: ${file.name} ===`);
        const lines = file.content.split('\n');
        console.log(lines.slice(0, 30).join('\n'));
      }
    } else {
      console.log('Ruleset response:', JSON.stringify(ruleset, null, 2));
    }
  } else {
    console.log('No cloud.firestore release found!');
  }
}

main().catch(console.error);
