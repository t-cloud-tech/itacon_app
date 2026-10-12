const fs = require('fs');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';
const EXPECTED_BASELINE_RULESET = 'projects/itacon-app/rulesets/9755afef-f096-4457-85ba-4c7b9c740e1c';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  if (!acc || !acc.tokens || !acc.tokens.refresh_token) {
    throw new Error('No Firebase CLI account found.');
  }
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

async function main() {
  console.log('=== ITACON FIRESTORE RULES-ONLY PRODUCTION DEPLOYMENT ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Target Firebase Project:', FIREBASE_PROJECT_ID);

  const token = await getFreshAccessToken();
  console.log('Auth token acquired.');

  // Pre-condition 1 & 2: Check current active release
  console.log('\n[CHECK 1/3] Verifying current active release...');
  const releasesRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  if (!releasesRes.ok) {
    throw new Error(`Failed to list releases: ${releasesRes.status} ${await releasesRes.text()}`);
  }
  const releasesData = await releasesRes.json();
  const currentRelease = (releasesData.releases || []).find(r => r.name.includes('cloud.firestore'));
  if (!currentRelease) {
    throw new Error('No cloud.firestore release found!');
  }

  console.log('Current Release Name:', currentRelease.name);
  console.log('Current Ruleset Name:', currentRelease.rulesetName);
  console.log('Current Ruleset Update Time:', currentRelease.updateTime);

  if (currentRelease.rulesetName !== EXPECTED_BASELINE_RULESET) {
    console.error(`FATAL: Current ruleset (${currentRelease.rulesetName}) does NOT match verified baseline (${EXPECTED_BASELINE_RULESET}).`);
    console.error('ABORTING DEPLOYMENT TO PREVENT OVERWRITING CHANGES.');
    process.exit(1);
  }
  console.log('BASELINE CONFIRMED MATCH! Safe to proceed.');

  // Read local firestore.rules
  const localRulesPath = 'firestore.rules';
  const rulesContent = fs.readFileSync(localRulesPath, 'utf8');
  console.log(`Local rules read from ${localRulesPath} (${rulesContent.length} bytes).`);

  // Step 1: Create new ruleset
  console.log('\n[DEPLOY 2/3] Creating new ruleset on Google Firebase Rules API...');
  const createRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/rulesets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      source: {
        files: [{ name: 'firestore.rules', content: rulesContent }],
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create ruleset: ${createRes.status} ${await createRes.text()}`);
  }

  const createData = await createRes.json();
  const newRulesetName = createData.name;
  console.log('New ruleset created successfully:');
  console.log('Ruleset ID:', newRulesetName);
  console.log('Ruleset Create Time:', createData.createTime);

  // Step 2: Release new ruleset to cloud.firestore
  console.log('\n[DEPLOY 3/3] Updating release projects/itacon-app/releases/cloud.firestore...');
  const releaseRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases/cloud.firestore`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      release: {
        name: `projects/${FIREBASE_PROJECT_ID}/releases/cloud.firestore`,
        rulesetName: newRulesetName,
      },
    }),
  });

  if (!releaseRes.ok) {
    throw new Error(`Failed to update release: ${releaseRes.status} ${await releaseRes.text()}`);
  }

  const releaseData = await releaseRes.json();
  console.log('Release updated successfully:');
  console.log('Release Name:', releaseData.name);
  console.log('Active Ruleset:', releaseData.rulesetName);
  console.log('Release Update Time:', releaseData.updateTime);

  // Verification: Fetch releases again to confirm live active state
  console.log('\n[POST-DEPLOY] Confirming live release state...');
  const verifyRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  const verifyData = await verifyRes.json();
  const activeRelease = (verifyData.releases || []).find(r => r.name.includes('cloud.firestore'));

  console.log('Live Active Release:', activeRelease.name);
  console.log('Live Active Ruleset:', activeRelease.rulesetName);
  console.log('Live Update Timestamp:', activeRelease.updateTime);

  if (activeRelease.rulesetName === newRulesetName) {
    console.log('\n>>> SUCCESS: NEW FIRESTORE RULES ARE LIVE! <<<');
  } else {
    console.error('\n>>> WARNING: Ruleset mismatch after patch! <<<');
  }
}

main().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
