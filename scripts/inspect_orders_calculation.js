const https = require('https');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

function fetchJson(url, token) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });
  });
}

function parseFirestoreValue(valObj) {
  if (!valObj) return null;
  const key = Object.keys(valObj)[0];
  const val = valObj[key];
  if (key === 'mapValue') {
    const res = {};
    for (const [k, v] of Object.entries(val.fields || {})) {
      res[k] = parseFirestoreValue(v);
    }
    return res;
  }
  if (key === 'arrayValue') {
    return (val.values || []).map(parseFirestoreValue);
  }
  if (key === 'integerValue' || key === 'doubleValue') {
    return Number(val);
  }
  if (key === 'booleanValue') {
    return Boolean(val);
  }
  return val;
}

function parseFirestoreDoc(doc) {
  const docId = doc.name.split('/').pop();
  const data = { id: docId };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = parseFirestoreValue(v);
  }
  return data;
}

async function main() {
  const token = await getFreshAccessToken();
  let pageToken = '';
  const allOrders = [];

  do {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetchJson(url, token);
    if (res.documents) {
      for (const d of res.documents) {
        allOrders.push(parseFirestoreDoc(d));
      }
    }
    pageToken = res.nextPageToken || '';
  } while (pageToken);

  console.log(`Fetched ${allOrders.length} orders total.`);

  for (const ord of allOrders) {
    const ref = ord.orderReference || ord.id;
    if (ref.includes('9095') || ref.includes('5765')) {
      console.log('\n=============================================');
      console.log(`TARGET ORDER: ${ref} (ID: ${ord.id})`);
      console.log('Status:', ord.status);
      console.log('Payment Status:', ord.paymentStatus);
      console.log('Subtotal:', ord.subtotal);
      console.log('Tax Amount:', ord.taxAmount);
      console.log('Total Amount:', ord.totalAmount);
      console.log('Quotation Mode:', ord.quotationMode);
      console.log('Basic Amount:', ord.basicAmount);
      console.log('Insurance Amount:', ord.insuranceAmount);
      console.log('Basic Plus Insurance:', ord.basicPlusInsurance);
      console.log('Packaging Charges:', ord.packagingCharges);
      console.log('Quotation Breakdown:', JSON.stringify(ord.quotationBreakdown, null, 2));
      console.log('Items:', JSON.stringify(ord.items || ord.orderItems, null, 2));
    }
  }

  console.log('\n--- ALL ORDERS SUMMARY ---');
  for (const ord of allOrders) {
    const ref = ord.orderReference || ord.id;
    console.log(`${ref.padEnd(22)} | status: ${(ord.status || 'N/A').padEnd(12)} | payStatus: ${(ord.paymentStatus || 'N/A').padEnd(15)} | total: ${ord.totalAmount} | subtotal: ${ord.subtotal} | tax: ${ord.taxAmount}`);
  }
}

main().catch(console.error);
