const fs = require('fs');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function main() {
  const acc = auth.getGlobalDefaultAccount();
  if (!acc || !acc.tokens || !acc.tokens.refresh_token) {
    throw new Error('No Firebase CLI account found.');
  }

  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  const token = result.access_token;

  const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  console.log('Releases count:', data.releases?.length);
  for (const r of data.releases || []) {
    console.log(`- ${r.name} -> ${r.rulesetName} (${r.updateTime})`);
  }

  const storageRelease = (data.releases || []).find(r => r.name.includes('firebase.storage'));
  if (!storageRelease) {
    console.log('No firebase.storage release found!');
    return;
  }

  const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/${storageRelease.rulesetName}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!rulesetRes.ok) {
    throw new Error(`Ruleset fetch failed: ${rulesetRes.status}`);
  }

  const rulesetData = await rulesetRes.json();
  const file = rulesetData.source?.files?.[0];
  if (file) {
    fs.writeFileSync('scripts/backup_deployed_storage.rules', file.content, 'utf8');
    console.log(`Saved live deployed storage rules to scripts/backup_deployed_storage.rules (${file.content.length} bytes)`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
