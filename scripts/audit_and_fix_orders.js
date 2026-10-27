const fs = require('fs');
const path = require('path');
const https = require('https');
const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

function fetchJson(url, token, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = https.request(reqOptions, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: b });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
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
  const data = { id: docId, _rawFields: doc.fields };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = parseFirestoreValue(v);
  }
  return data;
}

/**
 * Shared authoritative PO calculation formula:
 * Basic amount → +0.35% insurance → Basic + 0.35% → +18% GST on Basic + 0.35% → Estimated total
 */
function calculatePoAmounts(order) {
  let basic = 0;
  if (order.basicAmount !== undefined && order.basicAmount !== null && Number(order.basicAmount) > 0) {
    basic = Number(order.basicAmount);
  } else if (order.subtotal !== undefined && order.subtotal !== null && Number(order.subtotal) > 0) {
    basic = Number(order.subtotal);
  } else if (Array.isArray(order.items) && order.items.length > 0) {
    basic = order.items.reduce((sum, item) => {
      const lineTotal = Number(item.lineTotal || item.totalPrice || item.finalPrice || 0);
      return sum + lineTotal;
    }, 0);
  }

  // Round basic to 2 decimals
  basic = Math.round(basic * 100) / 100;

  if (basic <= 0) {
    return {
      basicAmount: 0,
      insuranceAmount: 0,
      basicPlusInsurance: 0,
      taxAmount: 0,
      totalAmount: 0,
      packagingCharges: 0,
    };
  }

  // 0.35% transit insurance
  const insurance = Math.round(basic * 0.0035 * 100) / 100;

  // Basic + 0.35%
  const basicPlusIns = Math.round((basic + insurance) * 100) / 100;

  // 18% GST on (Basic + 0.35%)
  const gst = Math.round(basicPlusIns * 0.18 * 100) / 100;

  // Estimated total
  const estimatedTotal = Math.round((basicPlusIns + gst) * 100) / 100;

  // Packaging charges
  let packaging = 0;
  if (order.packagingCharges !== undefined && order.packagingCharges !== null && Number(order.packagingCharges) > 0) {
    packaging = Number(order.packagingCharges);
  } else {
    const rawSubtotal = Number(order.subtotal || basic);
    if (rawSubtotal > estimatedTotal) {
      packaging = Math.round(((rawSubtotal - estimatedTotal) / 100) * 100) / 100;
    }
  }

  return {
    basicAmount: basic,
    insuranceAmount: insurance,
    basicPlusInsurance: basicPlusIns,
    taxAmount: gst,
    totalAmount: estimatedTotal,
    packagingCharges: packaging,
  };
}

async function main() {
  const isExecute = process.argv.includes('--execute');
  const token = await getFreshAccessToken();

  let pageToken = '';
  const allOrders = [];

  do {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetchJson(url, token);
    if (res.data && res.data.documents) {
      for (const d of res.data.documents) {
        allOrders.push(parseFirestoreDoc(d));
      }
    }
    pageToken = (res.data && res.data.nextPageToken) || '';
  } while (pageToken);

  console.log(`Fetched ${allOrders.length} orders total.`);

  // 1. Save JSON backup
  const backupDir = path.join(__dirname, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, `orders_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(allOrders, null, 2));
  console.log(`Saved backup of ${allOrders.length} orders to: ${backupFile}`);

  // Table of all orders
  console.log('\n========================================================================================================================');
  console.log('PO Number            | Status          | Payment Status  | Stored Total  | Correct Total | Difference    | Category');
  console.log('---------------------+-----------------+-----------------+---------------+---------------+---------------+--------------');

  const ordersToUpdate = [];
  const submittedOrders = [];
  const paidOrders = [];
  const alreadyCorrectOrders = [];

  for (const ord of allOrders) {
    const ref = (ord.orderReference || ord.poNumber || ord.id).padEnd(20);
    const status = (ord.status || 'N/A').padEnd(15);
    const payStatus = (ord.paymentStatus || 'N/A').padEnd(15);
    const storedTotalNum = Number(ord.totalAmount || ord.total || 0);
    const storedTotalStr = ('₹' + storedTotalNum.toFixed(2)).padEnd(13);

    let orderForCalc = ord;
    if (ref.includes('5765')) {
      orderForCalc = { ...ord, basicAmount: 1085.00, subtotal: 1085.00 };
    }

    const calc = calculatePoAmounts(orderForCalc);
    const correctTotalStr = ('₹' + calc.totalAmount.toFixed(2)).padEnd(13);
    const diff = Math.round((calc.totalAmount - storedTotalNum) * 100) / 100;
    const diffStr = ((diff >= 0 ? '+₹' : '-₹') + Math.abs(diff).toFixed(2)).padEnd(13);

    const normPayStatus = (ord.paymentStatus || '').toLowerCase();
    const isPaid = normPayStatus === 'paid' || ord.status === 'in_production' || ord.status === 'completed' || ord.status === 'delivered';
    const isSubmitted = normPayStatus === 'pending_verification' || normPayStatus === 'submitted';

    let category = '';
    if (isPaid) {
      category = 'VERIFIED/PAID';
      if (Math.abs(diff) > 0.01) {
        paidOrders.push({ order: ord, calc, diff });
      } else {
        alreadyCorrectOrders.push(ord);
      }
    } else if (isSubmitted) {
      category = 'SUBMITTED (HOLD)';
      submittedOrders.push({ order: ord, calc, diff });
    } else {
      // Unpaid & Not submitted
      if (Math.abs(diff) > 0.01 && calc.totalAmount > 0) {
        category = 'UNPAID -> UPDATE';
        ordersToUpdate.push({ order: ord, calc, diff });
      } else {
        category = 'UNPAID -> NO-OP';
        alreadyCorrectOrders.push(ord);
      }
    }

    console.log(`${ref} | ${status} | ${payStatus} | ${storedTotalStr} | ${correctTotalStr} | ${diffStr} | ${category}`);
  }

  console.log('========================================================================================================================\n');

  console.log(`Summary:`);
  console.log(`- Orders to update (Unpaid, not submitted, not verified): ${ordersToUpdate.length}`);
  console.log(`- Submitted orders (pending verification, held per rules): ${submittedOrders.length}`);
  console.log(`- Verified/Paid orders with mismatch (held per rules): ${paidOrders.length}`);

  if (ordersToUpdate.length > 0) {
    console.log('\n--- ORDERS TO UPDATE ---');
    for (const item of ordersToUpdate) {
      const ord = item.order;
      const ref = ord.orderReference || ord.id;
      console.log(`- ${ref} (ID: ${ord.id}):`);
      console.log(`    Current: Subtotal ₹${ord.subtotal}, Tax ₹${ord.taxAmount}, Total ₹${ord.totalAmount}`);
      console.log(`    New:     Basic ₹${item.calc.basicAmount}, Ins ₹${item.calc.insuranceAmount}, Basic+Ins ₹${item.calc.basicPlusInsurance}, Tax ₹${item.calc.taxAmount}, Total ₹${item.calc.totalAmount}, Pkg ₹${item.calc.packagingCharges}`);
    }
  }

  if (submittedOrders.length > 0) {
    console.log('\n--- SUBMITTED ORDERS (HELD FOR USER DECISION) ---');
    for (const item of submittedOrders) {
      const ord = item.order;
      const ref = ord.orderReference || ord.id;
      console.log(`- ${ref} (ID: ${ord.id}): Stored ₹${ord.totalAmount} vs Calc ₹${item.calc.totalAmount} (Diff: ₹${item.diff})`);
    }
  }

  if (paidOrders.length > 0) {
    console.log('\n--- PAID ORDERS (HELD FOR USER DECISION) ---');
    for (const item of paidOrders) {
      const ord = item.order;
      const ref = ord.orderReference || ord.id;
      console.log(`- ${ref} (ID: ${ord.id}): Stored ₹${ord.totalAmount} vs Calc ₹${item.calc.totalAmount} (Diff: ₹${item.diff})`);
    }
  }

  if (isExecute && ordersToUpdate.length > 0) {
    console.log('\nExecuting batch updates for eligible UNPAID orders...');
    let updatedCount = 0;
    for (const item of ordersToUpdate) {
      const ord = item.order;
      const calc = item.calc;
      const orderRef = ord.id;
      const poNum = ord.orderReference || ord.poNumber || ord.id;

      const updateFields = {
        basicAmount: { doubleValue: calc.basicAmount },
        insuranceAmount: { doubleValue: calc.insuranceAmount },
        basicPlusInsurance: { doubleValue: calc.basicPlusInsurance },
        taxAmount: { doubleValue: calc.taxAmount },
        tax: { doubleValue: calc.taxAmount },
        totalAmount: { doubleValue: calc.totalAmount },
        total: { doubleValue: calc.totalAmount },
        packagingCharges: { doubleValue: calc.packagingCharges },
        quotationMode: { stringValue: 'mrp' },
        updatedAt: { stringValue: new Date().toISOString() },
      };

      if (poNum.includes('5765')) {
        updateFields.subtotal = { doubleValue: 1085.00 };
      }

      // 1. Update order document
      const fieldPaths = Object.keys(updateFields).map(k => `updateMask.fieldPaths=${k}`).join('&');
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${orderRef}?${fieldPaths}`;
      const patchRes = await fetchJson(patchUrl, token, {
        method: 'PATCH',
        body: { fields: updateFields },
      });

      if (patchRes.status === 200) {
        console.log(`Updated order ${poNum} (${orderRef}) to Total: ₹${calc.totalAmount}`);
        updatedCount++;

        // 2. Log change in priceChangeLogs
        const logDocUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/priceChangeLogs`;
        await fetchJson(logDocUrl, token, {
          method: 'POST',
          body: {
            fields: {
              category: { stringValue: 'Order Calculation Fix' },
              orderId: { stringValue: orderRef },
              poNumber: { stringValue: poNum },
              previousSubtotal: { doubleValue: Number(ord.subtotal || 0) },
              previousTax: { doubleValue: Number(ord.taxAmount || ord.tax || 0) },
              previousTotal: { doubleValue: Number(ord.totalAmount || ord.total || 0) },
              newBasicAmount: { doubleValue: calc.basicAmount },
              newInsuranceAmount: { doubleValue: calc.insuranceAmount },
              newBasicPlusInsurance: { doubleValue: calc.basicPlusInsurance },
              newTax: { doubleValue: calc.taxAmount },
              newTotal: { doubleValue: calc.totalAmount },
              difference: { doubleValue: item.diff },
              appliedBy: { stringValue: 'scripts/audit_and_fix_orders.js' },
              reason: { stringValue: 'FIX UNPAID PO calculation alignment with paid PO formula' },
              timestamp: { timestampValue: new Date().toISOString() },
            },
          },
        });
      } else {
        console.error(`Failed to update ${poNum} (${orderRef}):`, patchRes.status, patchRes.raw || patchRes.data);
      }
    }
    console.log(`\nSuccessfully updated ${updatedCount} orders and wrote audit logs to priceChangeLogs.`);
  } else if (!isExecute) {
    console.log('\n[DRY RUN COMPLETE] To execute updates, run with --execute');
  }
}

main().catch(console.error);
