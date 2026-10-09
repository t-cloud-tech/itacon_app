const fs = require('fs');
const https = require('https');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  if (!acc || !acc.tokens || !acc.tokens.refresh_token) {
    throw new Error('No Firebase CLI account found.');
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
  const releasesUrl = `https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases`;
  const releases = await getRequest(releasesUrl, token);
  const firestoreRelease = (releases.releases || []).find(r => r.name.includes('cloud.firestore'));
  if (!firestoreRelease) {
    throw new Error('No firestore release found');
  }
  console.log('Project ID confirmed:', FIREBASE_PROJECT_ID);
  console.log('Active rulesetName:', firestoreRelease.rulesetName);
  const rulesetUrl = `https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`;
  const ruleset = await getRequest(rulesetUrl, token);
  for (const file of ruleset.source.files) {
    fs.writeFileSync(`scripts/backup_deployed_${file.name}`, file.content, 'utf8');
    console.log(`Backed up ${file.name} to scripts/backup_deployed_${file.name} (${file.content.length} bytes)`);
  }
}

main().catch(console.error);
