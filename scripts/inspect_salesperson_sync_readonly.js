const https = require('https');
const os = require('os');
const fs = require('fs');

const FIREBASE_PROJECT_ID = 'itacon-app';
const SP_ID = 'WNSahNXK9GQrGoiIEmD4QBvAeim1';

function getAccessToken() {
  const p = os.homedir() + '/.config/configstore/firebase-tools.json';
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  return cfg.tokens.access_token;
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

const parseDoc = (doc) => {
  if (!doc || !doc.fields) return null;
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
  const res = { id: docId };
  for (const k of Object.keys(f)) {
    res[k] = getVal(f[k]);
  }
  return res;
};

async function main() {
  const token = getAccessToken();

  // 1. Fetch salesperson doc
  const spUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/salesPersons/${SP_ID}`;
  const spDocRaw = await getRequest(spUrl, token);
  const spDoc = parseDoc(spDocRaw);
  console.log('=== SALESPERSON DOCUMENT ===');
  console.log(`Document ID: ${SP_ID}`);
  console.log(`Name: ${spDoc.name || spDoc.fullName}`);
  console.log(`Referral Code: ${spDoc.referralCode}`);
  console.log(`assignedClientsCount: ${spDoc.assignedClientsCount}`);
  console.log(`activeClientsCount: ${spDoc.activeClientsCount}`);
  console.log(`isActive: ${spDoc.isActive}`);

  // 2. Fetch all documents in salesPersons/{SP_ID}/assigned_clients
  let assignedClients = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/salesPersons/${SP_ID}/assigned_clients?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await getRequest(url, token);
    if (data.documents) {
      assignedClients = assignedClients.concat(data.documents.map(parseDoc));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`\n=== salesPersons/${SP_ID}/assigned_clients SUBCOLLECTION ===`);
  console.log(`Total documents found: ${assignedClients.length}`);
  const assignedClientIds = new Set(assignedClients.map(c => c.id));
  assignedClients.forEach(c => {
    console.log(` - [${c.id}] ${c.name || c.clientName} | ${c.phone || c.clientPhone} | category: ${c.clientCategory || c.userCategory}`);
  });

  // 3. Fetch all users from users collection to compare
  let allUsers = [];
  pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const data = await getRequest(url, token);
    if (data.documents) {
      allUsers = allUsers.concat(data.documents.map(parseDoc));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`\n=== USERS ASSIGNED TO THIS SALESPERSON (salesPersonId == ${SP_ID}) ===`);
  const assignedUsersInUsersCol = allUsers.filter(u => 
    u.salesPersonId === SP_ID || 
    u.assignedSalespersonId === SP_ID || 
    (u.salespersonReferralCode && u.salespersonReferralCode.toUpperCase() === 'SALES101')
  );
  console.log(`Total users in users collection with this salesperson: ${assignedUsersInUsersCol.length}`);

  // 4. Reconciliation Comparison
  const missingFromSubcollection = [];
  for (const u of assignedUsersInUsersCol) {
    const inSub = assignedClientIds.has(u.id);
    if (!inSub) {
      missingFromSubcollection.push(u);
    }
  }

  console.log(`\n=== RECONCILIATION FINDINGS ===`);
  console.log(`1. salesPersons.assignedClientsCount counter: ${spDoc.assignedClientsCount}`);
  console.log(`2. salesPersons.activeClientsCount counter: ${spDoc.activeClientsCount}`);
  console.log(`3. Documents in assigned_clients subcollection: ${assignedClients.length}`);
  console.log(`4. Users with salesPersonId in users collection: ${assignedUsersInUsersCol.length}`);
  console.log(`5. Users in users collection MISSING from assigned_clients subcollection: ${missingFromSubcollection.length}`);

  if (missingFromSubcollection.length > 0) {
    console.log('\n--- Details of Missing Clients ---');
    missingFromSubcollection.forEach(u => {
      console.log(` - UID: ${u.id}`);
      console.log(`   Name: ${u.name || u.fullName}`);
      console.log(`   Phone: ${u.phone || u.phoneNumber}`);
      console.log(`   salesPersonId: ${u.salesPersonId}`);
      console.log(`   assignedSalespersonId: ${u.assignedSalespersonId}`);
      console.log(`   salespersonReferralCode: ${u.salespersonReferralCode}`);
      console.log(`   status: ${u.status}`);
      console.log(`   isVerified: ${u.isVerified}`);
      console.log(`   createdAt: ${u.createdAt}`);
    });
  }

  // 5. Also check client_assignments collection for these missing users
  console.log('\n--- client_assignments check for missing users ---');
  for (const u of missingFromSubcollection) {
    const asgnUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/client_assignments/ASGN_${u.id}`;
    const asgnRaw = await getRequest(asgnUrl, token);
    const exists = asgnRaw.fields ? true : false;
    console.log(` - client_assignments/ASGN_${u.id}: ${exists ? 'EXISTS' : 'MISSING'}`);
  }
}

main().catch(console.error);
