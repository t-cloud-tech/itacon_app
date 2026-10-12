const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function main() {
  console.log('1. Getting Firebase credentials...');
  const acc = auth.getGlobalDefaultAccount();
  if (!acc || !acc.tokens || !acc.tokens.refresh_token) {
    throw new Error('No Firebase CLI account found.');
  }
  console.log('Account found for:', acc.user?.email);

  console.log('2. Requesting access token...');
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  const token = result.access_token;
  console.log('Access token acquired successfully.');

  console.log('3. Fetching active releases from firebaserules.googleapis.com...');
  const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  console.log('4. Releases received:');
  const firestoreRelease = (data.releases || []).find(r => r.name.includes('cloud.firestore'));
  if (!firestoreRelease) {
    throw new Error('No cloud.firestore release found!');
  }

  console.log('Release Name:', firestoreRelease.name);
  console.log('Active Ruleset Name:', firestoreRelease.rulesetName);
  console.log('Update Time:', firestoreRelease.updateTime);

  console.log('5. Fetching active ruleset source...');
  const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!rulesetRes.ok) {
    throw new Error(`HTTP error ${rulesetRes.status}: ${await rulesetRes.text()}`);
  }

  const rulesetData = await rulesetRes.json();
  console.log('Ruleset createTime:', rulesetData.createTime);
  const file = rulesetData.source?.files?.[0];
  if (file) {
    console.log('Source file name:', file.name);
    console.log('Source content length:', file.content.length);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
