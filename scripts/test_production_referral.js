/**
 * scripts/test_production_referral.js
 * 
 * Verifies referral code lookup against the REAL production Firestore:
 * - "SALES-107", "sales-107", " SALES-107 ", "SALES107" -> Mohit
 * - "SALES101", "sales101" -> Vraj Shah
 * - "WRONG123" -> not found
 */

const https = require('https');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const PROJECT_ID = 'itacon-app';

function computeReferralCodeKey(code) {
  if (!code || typeof code !== 'string') return '';
  return code.replace(/[-\s]/g, '').toUpperCase().trim();
}

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  if (!acc || !acc.tokens || !acc.tokens.refresh_token) {
    throw new Error('No Firebase CLI account found. Run firebase login.');
  }
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

function runFirestoreStructuredQuery(accessToken, structuredQuery) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ structuredQuery });
    const req = https.request(
      {
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          }
          try {
            const arr = JSON.parse(raw);
            const docs = [];
            for (const item of arr) {
              if (item.document) {
                docs.push(item.document);
              }
            }
            resolve(docs);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function lookupReferralCodeInProduction(accessToken, inputCode) {
  const key = computeReferralCodeKey(inputCode);
  const trimmed = typeof inputCode === 'string' ? inputCode.trim() : '';

  // 1. Query by referralCodeKey
  let docs = await runFirestoreStructuredQuery(accessToken, {
    from: [{ collectionId: 'salesPersons' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'referralCodeKey' },
        op: 'EQUAL',
        value: { stringValue: key },
      },
    },
    limit: 1,
  });

  // 2. Fallback query: referralCode == trimmed
  if (docs.length === 0 && trimmed) {
    docs = await runFirestoreStructuredQuery(accessToken, {
      from: [{ collectionId: 'salesPersons' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'referralCode' },
          op: 'EQUAL',
          value: { stringValue: trimmed },
        },
      },
      limit: 1,
    });
  }

  // 3. Fallback query: referralCode == trimmed.toUpperCase()
  if (docs.length === 0 && trimmed) {
    docs = await runFirestoreStructuredQuery(accessToken, {
      from: [{ collectionId: 'salesPersons' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'referralCode' },
          op: 'EQUAL',
          value: { stringValue: trimmed.toUpperCase() },
        },
      },
      limit: 1,
    });
  }

  if (docs.length === 0) {
    return null;
  }

  const doc = docs[0];
  const fields = doc.fields || {};
  return {
    id: doc.name.split('/').pop(),
    name: fields.name?.stringValue || fields.fullName?.stringValue,
    referralCode: fields.referralCode?.stringValue,
    referralCodeKey: fields.referralCodeKey?.stringValue,
    isActive: fields.isActive?.booleanValue,
  };
}

async function main() {
  console.log('Connecting to REAL production Firestore project: itacon-app...');
  const token = await getFreshAccessToken();

  const testCases = [
    { input: 'SALES-107', expectedName: 'Mohit', shouldSucceed: true },
    { input: 'sales-107', expectedName: 'Mohit', shouldSucceed: true },
    { input: ' SALES-107 ', expectedName: 'Mohit', shouldSucceed: true },
    { input: 'SALES107', expectedName: 'Mohit', shouldSucceed: true },
    { input: 'SALES101', expectedName: 'Vraj Shah', shouldSucceed: true },
    { input: 'sales101', expectedName: 'Vraj Shah', shouldSucceed: true },
    { input: 'WRONG123', expectedName: null, shouldSucceed: false },
  ];

  console.log('\n--- VERIFYING CODES ON REAL PRODUCTION DATABASE ---');
  let passed = 0;
  for (const tc of testCases) {
    const res = await lookupReferralCodeInProduction(token, tc.input);
    if (tc.shouldSucceed) {
      if (res && res.name === tc.expectedName && (res.isActive === true || res.isActive === 'true')) {
        console.log(`✔ SUCCESS: "${tc.input}" -> Matched ${res.name} (Code: ${res.referralCode}, Key: ${res.referralCodeKey}, Active: ${res.isActive})`);
        passed++;
      } else {
        console.error(`❌ FAILED: "${tc.input}" -> Expected ${tc.expectedName}, got ${JSON.stringify(res)}`);
      }
    } else {
      if (!res) {
        console.log(`✔ SUCCESS: "${tc.input}" -> Correctly rejected as not found`);
        passed++;
      } else {
        console.error(`❌ FAILED: "${tc.input}" -> Expected not found, but matched ${JSON.stringify(res)}`);
      }
    }
  }

  console.log(`\nResults: ${passed}/${testCases.length} tests passed on real production database.`);
  if (passed === testCases.length) {
    console.log('🎉 REAL PRODUCTION VERIFICATION TESTS ALL PASSED!');
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
