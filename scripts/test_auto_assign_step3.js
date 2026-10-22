/**
 * scripts/test_auto_assign_step3.js
 * 
 * Comprehensive STEP 3 test runner for Auto-Assign Sales Executive:
 * Tests 1 through 7 with real production Firestore & Cloud Functions,
 * followed by clean-up of test users and verification of counts.
 */

const https = require('https');
const path = require('path');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const PROJECT_ID = 'itacon-app';
const REGION = 'asia-south1';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  if (!acc || !acc.tokens || !acc.tokens.refresh_token) {
    throw new Error('No Firebase CLI account found. Run firebase login.');
  }
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

// REST call to Firestore
function firestoreRequest(accessToken, method, docPath, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          if (res.statusCode >= 400 && res.statusCode !== 404) {
            return reject(new Error(`HTTP ${res.statusCode} for ${docPath}: ${raw}`));
          }
          try {
            resolve(raw ? JSON.parse(raw) : null);
          } catch (e) {
            resolve(raw);
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Call asia-south1 2nd gen callable function directly via HTTP
function callFunction(functionName, data, authToken) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ data });
    const req = https.request(
      {
        hostname: `${REGION}-${PROJECT_ID}.cloudfunctions.net`,
        path: `/${functionName}`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 400) {
              return resolve({ status: res.statusCode, error: parsed.error || raw });
            }
            resolve({ status: res.statusCode, result: parsed.result });
          } catch (e) {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Convert firestore fields to JS object
function decodeFirestoreFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else if (v.mapValue !== undefined) res[k] = decodeFirestoreFields(v.mapValue.fields);
    else if (v.nullValue !== undefined) res[k] = null;
  }
  return res;
}

// Encode JS object to firestore fields
function encodeFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') {
      if (Number.isInteger(v)) fields[k] = { integerValue: v.toString() };
      else fields[k] = { doubleValue: v };
    } else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (v === null) fields[k] = { nullValue: null };
  }
  return { fields };
}

async function getSalespersons(accessToken) {
  const res = await firestoreRequest(accessToken, 'GET', 'salesPersons');
  const list = [];
  if (res && res.documents) {
    for (const doc of res.documents) {
      const id = doc.name.split('/').pop();
      list.push({ id, ...decodeFirestoreFields(doc.fields) });
    }
  }
  return list;
}

module.exports = {
  getFreshAccessToken,
  firestoreRequest,
  callFunction,
  decodeFirestoreFields,
  encodeFirestoreFields,
  getSalespersons,
};
