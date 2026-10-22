/**
 * scripts/backfillReferralCodeKey.js
 * 
 * One-time backfill script for salesPersons collection.
 * Adds new field: referralCodeKey = referralCode with spaces and hyphens removed, uppercased.
 * Example: "SALES-107" -> "SALES107", "SALES101" -> "SALES101".
 * 
 * Default: --dry-run (prints table, does not write).
 * Use --apply to write to Firestore.
 * 
 * Reports any key collisions among salespersons.
 */

const https = require('https');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

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

const parseDoc = (doc) => {
  const docId = doc.name ? doc.name.split('/').pop() : '';
  const f = doc.fields || {};
  const getVal = (v) => {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
    if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
    if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(getVal);
    if (v.mapValue !== undefined) {
      const res = {};
      for (const k of Object.keys(v.mapValue.fields || {})) {
        res[k] = getVal(v.mapValue.fields[k]);
      }
      return res;
    }
    return null;
  };
  const res = { id: docId, _raw: doc };
  for (const k of Object.keys(f)) {
    res[k] = getVal(f[k]);
  }
  return res;
};

async function patchDoc(token, docId, fieldsToUpdate) {
  const mask = Object.keys(fieldsToUpdate).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/salesPersons/${docId}?${mask}`;
  
  const formattedFields = {};
  for (const [k, v] of Object.entries(fieldsToUpdate)) {
    if (typeof v === 'string') {
      formattedFields[k] = { stringValue: v };
    } else if (typeof v === 'boolean') {
      formattedFields[k] = { booleanValue: v };
    } else if (typeof v === 'number') {
      formattedFields[k] = { integerValue: v.toString() };
    }
  }

  const payload = JSON.stringify({ fields: formattedFields });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const mode = isApply ? 'APPLY (Writing changes to Firestore)' : 'DRY-RUN (Simulated, no writes)';
  console.log('========================================================================');
  console.log(`ITACON SALESPERSON REFERRAL CODE KEY BACKFILL`);
  console.log(`Mode: ${mode}`);
  console.log('========================================================================\n');

  const token = await getFreshAccessToken();
  console.log('Connected with fresh Firebase access token.');

  let allSpDocs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/salesPersons?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      }).on('error', reject);
    });
    if (data.documents) allSpDocs = allSpDocs.concat(data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Fetched ${allSpDocs.length} documents from 'salesPersons'.\n`);
  const parsed = allSpDocs.map(parseDoc);

  const keyMap = new Map();
  const collisions = [];
  const reportRows = [];
  const pendingUpdates = [];

  for (const sp of parsed) {
    const rawCode = (sp.referralCode || '').toString();
    const newKey = computeReferralCodeKey(rawCode);
    const existingKey = sp.referralCodeKey || '';
    const name = sp.name || sp.fullName || '(No name)';

    // Check collision among active salespersons
    if (newKey) {
      if (keyMap.has(newKey)) {
        const other = keyMap.get(newKey);
        collisions.push({
          key: newKey,
          first: `${other.name} (${other.id}) [${other.rawCode}]`,
          second: `${name} (${sp.id}) [${rawCode}]`,
        });
      } else {
        keyMap.set(newKey, { id: sp.id, name, rawCode });
      }
    }

    const needsUpdate = newKey && (newKey !== existingKey);
    if (needsUpdate) {
      pendingUpdates.push({ id: sp.id, name, rawCode, newKey });
    }

    reportRows.push({
      ID: sp.id,
      Name: name,
      'Referral Code': rawCode,
      'Current referralCodeKey': existingKey || '(missing)',
      'New referralCodeKey': newKey || '(none)',
      Status: sp.status || (sp.isActive ? 'active' : 'inactive'),
      'Needs Update': needsUpdate ? 'YES' : 'NO',
    });
  }

  console.table(reportRows);

  if (collisions.length > 0) {
    console.warn('\n⚠️ KEY COLLISIONS DETECTED:');
    for (const c of collisions) {
      console.warn(` - Key "${c.key}" is shared between:\n    1) ${c.first}\n    2) ${c.second}`);
    }
  } else {
    console.log('\n✔ Zero key collisions detected across all salespersons.');
  }

  console.log(`\nTotal salespersons needing 'referralCodeKey' update: ${pendingUpdates.length}`);

  if (!isApply) {
    console.log('\n========================================================================');
    console.log('NOTICE: DRY-RUN COMPLETED. Zero writes made to Firestore.');
    console.log('To write referralCodeKey to salesPersons docs, run:');
    console.log('  node scripts/backfillReferralCodeKey.js --apply');
    console.log('========================================================================\n');
    return;
  }

  console.log('\nApplying updates to Firestore...');
  let successCount = 0;
  for (const item of pendingUpdates) {
    try {
      await patchDoc(token, item.id, { referralCodeKey: item.newKey });
      console.log(`✔ Updated salesPersons/${item.id} (${item.name}): referralCodeKey = "${item.newKey}"`);
      successCount++;
    } catch (e) {
      console.error(`❌ Failed to update salesPersons/${item.id}:`, e.message);
    }
  }

  console.log(`\n🎉 Successfully applied referralCodeKey updates to ${successCount} documents.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
