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
  return { stringValue: String(val) };
}

function convertFromFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  return null;
}

async function writeBankConfig(token, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'updatedAt') {
      fields[k] = { timestampValue: new Date().toISOString() };
    } else {
      fields[k] = convertToFirestoreValue(v);
    }
  }

  const payload = JSON.stringify({ fields });
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/paymentConfig/bankTransfer`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(b));
        } else {
          reject(new Error(`Failed to write bank config: HTTP ${res.statusCode} - ${b}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function readBankConfig(token) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/paymentConfig/bankTransfer`;
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(b));
        } else {
          reject(new Error(`Failed to read bank config: HTTP ${res.statusCode} - ${b}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Authenticating via Firebase CLI...');
  const token = await getFreshAccessToken();

  const bankData = {
    accountHolderName: 'ITACON GRANITO PVT LTD',
    bankName: 'STATE BANK OF INDIA',
    accountNumber: '37631540457',
    ifscCode: 'SBIN0016390',
    branchName: 'COM-BRANCH LALPAR',
    accountType: 'Current Account',
    enabled: true,
    instructions: 'Please transfer the exact final quotation amount using NEFT/RTGS/IMPS. After payment, submit your UTR/reference number and payment receipt in the ITACON app for verification.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'administrator'
  };

  console.log('Writing paymentConfig/bankTransfer to production Firestore (itacon-app)...');
  await writeBankConfig(token, bankData);
  console.log('Write completed. Reading back for verification...');

  const verifiedDoc = await readBankConfig(token);
  const f = verifiedDoc.fields || {};

  const readBack = {
    accountHolderName: convertFromFirestoreValue(f.accountHolderName),
    bankName: convertFromFirestoreValue(f.bankName),
    accountNumber: convertFromFirestoreValue(f.accountNumber),
    ifscCode: convertFromFirestoreValue(f.ifscCode),
    branchName: convertFromFirestoreValue(f.branchName),
    accountType: convertFromFirestoreValue(f.accountType),
    enabled: convertFromFirestoreValue(f.enabled),
    instructions: convertFromFirestoreValue(f.instructions),
    updatedAt: convertFromFirestoreValue(f.updatedAt),
    updatedBy: convertFromFirestoreValue(f.updatedBy),
  };

  const rawAcct = String(readBack.accountNumber || '');
  const last4 = rawAcct.length >= 4 ? rawAcct.slice(-4) : rawAcct;
  const maskedAcct = '••••••••' + last4;

  console.log('\n--- VERIFICATION RESULT ---');
  console.log('Config Path: paymentConfig/bankTransfer');
  console.log('Enabled: ' + readBack.enabled);
  console.log('Account Holder: ' + readBack.accountHolderName);
  console.log('Bank: ' + readBack.bankName);
  console.log('Account: ' + maskedAcct);
  console.log('IFSC: ' + readBack.ifscCode);
  console.log('Branch: ' + readBack.branchName);
  console.log('Account Type: ' + readBack.accountType);
  console.log('Instructions Configured: ' + (readBack.instructions ? 'yes' : 'no'));
  console.log('Updated At: ' + readBack.updatedAt);
  console.log('Updated By: ' + readBack.updatedBy);
}

main().catch(err => {
  console.error('Operation failed:', err);
  process.exit(1);
});
