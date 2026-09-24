const path = require('path');
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

function convertToFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(convertToFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function convertFromFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(convertFromFirestoreValue);
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = convertFromFirestoreValue(v);
    }
    return obj;
  }
  return val;
}

async function getDocument(collection, docId) {
  const token = await getFreshAccessToken();
  return new Promise((resolve) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}`;
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(body);
            const data = {};
            for (const [k, v] of Object.entries(parsed.fields || {})) {
              data[k] = convertFromFirestoreValue(v);
            }
            resolve({ exists: true, data });
          } catch (e) {
            resolve({ exists: false, error: e.message });
          }
        } else if (res.statusCode === 404) {
          resolve({ exists: false, status: 404 });
        } else {
          resolve({ exists: false, status: res.statusCode, body });
        }
      });
    }).on('error', (err) => {
      resolve({ exists: false, error: err.message });
    });
  });
}

async function createDocument(collection, docId, data) {
  const token = await getFreshAccessToken();
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      fields[k] = convertToFirestoreValue(v);
    }
    const payload = JSON.stringify({ fields });
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}`;

    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`==================================================`);
  console.log(`STEP 1: INSPECTING / CREATING PRODUCTION LOYALTY CONFIG`);
  console.log(`Firebase Project: ${FIREBASE_PROJECT_ID}`);
  console.log(`==================================================`);

  const EXPECTED_CONFIG = {
    signupBonusPoints: 500,
    referralSignupPoints: 500,
    successfulOrderReward: 5555,
    pointsPerBox: 10,
    minimumRedemptionPoints: 50000,
    rupeesPerPoint: 0.50,
  };

  const check = await getDocument('loyaltyConfig', 'current');

  if (check.exists) {
    console.log('NOTICE: loyaltyConfig/current ALREADY EXISTS in production:');
    console.log(JSON.stringify(check.data, null, 2));

    let matches = true;
    for (const [key, val] of Object.entries(EXPECTED_CONFIG)) {
      if (check.data[key] !== val) {
        console.warn(`Mismatch on key "${key}": existing=${check.data[key]}, expected=${val}`);
        matches = false;
      }
    }
    if (matches) {
      console.log('SUCCESS: Existing loyaltyConfig/current perfectly matches approved production values.');
    } else {
      console.log('WARNING: Conflict detected in existing config. Retaining existing values without overwrite.');
    }
    return;
  }

  console.log('loyaltyConfig/current does not exist yet.');
  console.log('Safely creating loyaltyConfig/current with approved values...');
  await createDocument('loyaltyConfig', 'current', EXPECTED_CONFIG);
  console.log('SUCCESS: Successfully created loyaltyConfig/current with values:');
  console.log(JSON.stringify(EXPECTED_CONFIG, null, 2));
}

main().catch(err => {
  console.error('Fatal error in manage_loyalty_config:', err);
  process.exit(1);
});
