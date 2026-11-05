const path = require('path');
const admin = require(path.resolve(__dirname, '../functions/node_modules/firebase-admin'));

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}
const db = admin.firestore();

async function inspect() {
  console.log('--- Inspecting staffNotifications ---');
  const snap = await db.collection('staffNotifications').get();
  console.log('Total notifications:', snap.size);

  const types = {};
  const recips = {};
  let withLocalhost = [];
  let unassignedNotifs = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    types[data.type] = (types[data.type] || 0) + 1;
    recips[data.recipientUid] = (recips[data.recipientUid] || 0) + 1;

    if (data.link && data.link.includes('localhost')) {
      withLocalhost.push({ id: doc.id, link: data.link });
    }

    if (data.type === 'customer_assigned' && (data.dedupeKey?.startsWith('custUnassigned_') || data.title?.includes('Unassigned'))) {
      unassignedNotifs.push({
        id: doc.id,
        customerId: data.refs?.customerId,
        dedupeKey: data.dedupeKey,
        recipientUid: data.recipientUid,
        title: data.title,
        body: data.body,
        createdAt: data.createdAt,
      });
    }
  }

  console.log('Breakdown by type:', types);
  console.log('Notifications with localhost in link:', withLocalhost.length);
  if (withLocalhost.length > 0) {
    console.log('Sample localhost links:', withLocalhost.slice(0, 5));
  }
  console.log('Unassigned customer notifications:', unassignedNotifs.length);

  // Check which unassigned customers now have a salesperson
  const customerIds = [...new Set(unassignedNotifs.map(n => n.customerId).filter(Boolean))];
  console.log('Unique unassigned customer IDs in notifications:', customerIds.length);

  let nowAssignedCount = 0;
  let stillUnassignedCount = 0;
  for (const cid of customerIds) {
    const cDoc = await db.collection('users').doc(cid).get();
    if (cDoc.exists) {
      const cData = cDoc.data() || {};
      const sp = (cData.salesPersonId || cData.assignedSalespersonId || '').trim();
      if (sp) {
        nowAssignedCount++;
      } else {
        stillUnassignedCount++;
      }
    }
  }
  console.log(`Customers checked: ${customerIds.length}. Now assigned: ${nowAssignedCount}, Still unassigned: ${stillUnassignedCount}`);

  // Inspect staffDevices
  console.log('\n--- Inspecting staffDevices ---');
  const staffDevicesSnap = await db.collection('staffDevices').get();
  console.log('Total staff device documents:', staffDevicesSnap.size);

  let totalTokens = 0;
  let localhostTokens = [];

  for (const userDevDoc of staffDevicesSnap.docs) {
    const uid = userDevDoc.id;
    const tokensSnap = await userDevDoc.ref.collection('tokens').get();
    totalTokens += tokensSnap.size;

    for (const tDoc of tokensSnap.docs) {
      const tData = tDoc.data();
      const origin = tData.origin || '';
      const userAgent = tData.userAgent || '';
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        localhostTokens.push({ uid, tokenId: tDoc.id, origin });
      }
    }
  }

  console.log(`Total FCM tokens: ${totalTokens}`);
  console.log(`Tokens registered from localhost/127.0.0.1: ${localhostTokens.length}`);
  if (localhostTokens.length > 0) {
    console.log('Localhost tokens:', localhostTokens);
  }

  // Inspect user roles to check who are admins, salespersons, designers
  console.log('\n--- Inspecting staff users & roles ---');
  const usersSnap = await db.collection('users').get();
  const roleCounts = {};
  const staffMap = {};

  usersSnap.docs.forEach(d => {
    const u = d.data();
    const role = (u.role || '').toLowerCase().trim();
    const cat = (u.userCategory || '').toLowerCase().trim();
    if (role || cat === 'salesperson' || cat === 'admin' || cat === 'manager') {
      const effRole = role || cat;
      roleCounts[effRole] = (roleCounts[effRole] || 0) + 1;
      staffMap[d.id] = { uid: d.id, name: u.name || u.fullName, role: effRole, email: u.email, salespersonId: u.salesPersonId };
    }
  });
  console.log('Staff role counts:', roleCounts);
}

inspect().catch(console.error);
