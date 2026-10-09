const https = require('https');
const fs = require('fs');
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

function requestJson(url, method, data, token) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch (e) {
          resolve({ status: res.statusCode, data: b });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('--- STARTING CONTROLLED FIRESTORE RULES DEPLOYMENT ---');
  console.log('Target Project:', FIREBASE_PROJECT_ID);

  const token = await getFreshAccessToken();
  const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

  // Step 1: Create new ruleset
  console.log('1. Creating new ruleset on Google Firebase Rules API...');
  const createUrl = `https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/rulesets`;
  const createRes = await requestJson(createUrl, 'POST', {
    source: {
      files: [{ name: 'firestore.rules', content: rulesContent }],
    },
  }, token);

  if (createRes.status !== 200 || !createRes.data || !createRes.data.name) {
    throw new Error(`Failed to create ruleset: ${JSON.stringify(createRes)}`);
  }

  const newRulesetName = createRes.data.name;
  console.log('New ruleset created successfully:', newRulesetName);
  console.log('Created time:', createRes.data.createTime);

  // Step 2: Release new ruleset to cloud.firestore
  console.log('2. Updating release projects/itacon-app/releases/cloud.firestore...');
  const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases/cloud.firestore`;
  const releaseRes = await requestJson(releaseUrl, 'PATCH', {
    release: {
      name: `projects/${FIREBASE_PROJECT_ID}/releases/cloud.firestore`,
      rulesetName: newRulesetName,
    },
  }, token);

  if (releaseRes.status !== 200) {
    throw new Error(`Failed to update release: ${JSON.stringify(releaseRes)}`);
  }

  console.log('--- DEPLOYMENT SUCCESSFUL ---');
  console.log('Updated Release:', releaseRes.data.name);
  console.log('Active Ruleset:', releaseRes.data.rulesetName);
  console.log('Update Timestamp:', releaseRes.data.updateTime);
}

main().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
