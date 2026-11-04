/**
 * scripts/backfill_last_order_at.js
 *
 * Backfill `lastOrderAt` field on customer documents from existing orders in Firestore.
 *
 * Usage:
 *   node scripts/backfill_last_order_at.js            (Dry-run by default)
 *   node scripts/backfill_last_order_at.js --apply    (Applies updates to Firestore)
 *
 * Rule: Writes ONLY the `lastOrderAt` field.
 */

const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}
const db = admin.firestore();

function parseDate(val) {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000);
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log('================================================================');
  console.log(`ITACON GRANITO — Backfill Customer lastOrderAt (${isApply ? 'APPLY MODE' : 'DRY RUN'})`);
  console.log('================================================================');

  // 1. Fetch all orders
  console.log('\n[1/3] Reading orders from Firestore...');
  const ordersSnap = await db.collection('orders').get();
  console.log(`Found ${ordersSnap.size} total order documents.`);

  const customerLatestOrderMap = new Map();

  ordersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const custId = (data.userId || data.customerId || '').trim();
    if (!custId) return;

    // Check createdAt, confirmedAt, paidAt
    const createdDate = parseDate(data.createdAt) || parseDate(data.confirmedAt) || parseDate(data.paidAt);
    if (!createdDate) return;

    const existing = customerLatestOrderMap.get(custId);
    if (!existing || createdDate > existing.date) {
      customerLatestOrderMap.set(custId, {
        date: createdDate,
        orderId: doc.id,
        orderRef: data.orderReference || data.poNumber || doc.id,
      });
    }
  });

  console.log(`Found order history for ${customerLatestOrderMap.size} distinct customer ID(s).`);

  // 2. Fetch all customers from users collection
  console.log('\n[2/3] Fetching customers from users collection...');
  const usersSnap = await db.collection('users').get();
  const staffRoles = ['admin', 'manager', 'salesperson', 'staff', 'superadmin', 'super_admin', 'designer'];

  const customerUpdates = [];

  usersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const role = (data.role || '').toLowerCase().trim();
    if (staffRoles.includes(role) || data.designerId) return;

    const custId = doc.id;
    const latestOrder = customerLatestOrderMap.get(custId);
    const currentLastOrderAt = data.lastOrderAt || null;

    if (latestOrder) {
      const newLastOrderIso = latestOrder.date.toISOString();
      const needsUpdate = currentLastOrderAt !== newLastOrderIso;

      customerUpdates.push({
        uid: custId,
        name: data.name || data.fullName || 'Unknown',
        company: data.companyName || data.businessName || data.firmName || 'Individual',
        currentLastOrderAt,
        newLastOrderAt: newLastOrderIso,
        latestOrderId: latestOrder.orderId,
        latestOrderRef: latestOrder.orderRef,
        needsUpdate,
      });
    } else {
      customerUpdates.push({
        uid: custId,
        name: data.name || data.fullName || 'Unknown',
        company: data.companyName || data.businessName || data.firmName || 'Individual',
        currentLastOrderAt,
        newLastOrderAt: null,
        latestOrderId: null,
        latestOrderRef: null,
        needsUpdate: false,
      });
    }
  });

  // Also check if any orders have customer IDs that exist only in 'customers' collection
  const customersSnap = await db.collection('customers').get();
  customersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const custId = doc.id;
    const alreadyListed = customerUpdates.some((u) => u.uid === custId);
    if (alreadyListed) return;

    const latestOrder = customerLatestOrderMap.get(custId);
    const currentLastOrderAt = data.lastOrderAt || null;

    if (latestOrder) {
      customerUpdates.push({
        uid: custId,
        name: data.name || data.companyName || 'Unknown (customers col)',
        company: data.companyName || 'Individual',
        currentLastOrderAt,
        newLastOrderAt: latestOrder.date.toISOString(),
        latestOrderId: latestOrder.orderId,
        latestOrderRef: latestOrder.orderRef,
        needsUpdate: currentLastOrderAt !== latestOrder.date.toISOString(),
        isCustomersCol: true,
      });
    }
  });

  console.log(`\nAnalysis Summary:`);
  console.log(`- Total Customers Evaluated: ${customerUpdates.length}`);
  const toUpdate = customerUpdates.filter((c) => c.needsUpdate);
  console.log(`- Customers Needing Update: ${toUpdate.length}`);
  console.log(`- Customers Already Up-to-Date: ${customerUpdates.length - toUpdate.length}`);

  console.log('\n[Customer Table]');
  console.table(
    customerUpdates.map((c) => ({
      'Customer ID': c.uid,
      'Name / Firm': `${c.name} (${c.company})`,
      'Current lastOrderAt': c.currentLastOrderAt || '(none)',
      'New lastOrderAt': c.newLastOrderAt || '(no orders)',
      'Latest Order': c.latestOrderRef || '-',
      'Action': c.needsUpdate ? (isApply ? 'APPLYING' : 'WILL UPDATE') : 'NO CHANGE',
    }))
  );

  // 3. Apply if requested
  if (isApply) {
    if (toUpdate.length === 0) {
      console.log('\nNo updates required. All customers are already up-to-date.');
      return;
    }

    console.log(`\n[3/3] Applying updates to ${toUpdate.length} customer document(s)...`);
    const batch = db.batch();

    for (const item of toUpdate) {
      const targetCol = item.isCustomersCol ? 'customers' : 'users';
      const ref = db.collection(targetCol).doc(item.uid);
      // WRITE ONLY lastOrderAt field
      batch.update(ref, {
        lastOrderAt: item.newLastOrderAt,
      });
    }

    await batch.commit();
    console.log(`Successfully updated ${toUpdate.length} customer document(s) with lastOrderAt!`);
  } else {
    console.log('\nDRY RUN complete. No changes were written.');
    console.log('Run with --apply to write these changes to Firestore.');
  }
}

run().catch((err) => {
  console.error('Fatal error in backfill:', err);
  process.exit(1);
});

