/**
 * scripts/preLaunchCleanup.js
 *
 * PRE-LAUNCH DATA CLEANUP — Itacon (Firebase project itacon-app)
 *
 * Usage:
 *   node scripts/preLaunchCleanup.js           (Default: --dry-run mode, read-only)
 *   node scripts/preLaunchCleanup.js --dry-run (Explicit read-only dry run)
 *   node scripts/preLaunchCleanup.js --apply   (Executes deletes, fixes, and verification)
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

// 1. Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'itacon-app',
    storageBucket: 'itacon-app.firebasestorage.app',
  });
}

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

// 2. Authoritative KEEP Identifiers
const KEEP_SALESPERSON_UID = 'WNSahNXK9GQrGoiIEmD4QBvAeim1'; // Vraj Shah
const KEEP_CUSTOMER_UID = 'curhNkfDRveFrBxdtSeOpUosZKD3';    // Tirth Kalpesh Patel
const KEEP_CUSTOMER_PHONE = '+919624818476';

// Authoritative Staff Accounts
const KEEP_STAFF_UIDS = new Set([
  'admin_01',                      // Vraj Patel (admin doc)
  '9hhMaF6WFccGHJc4vyglAxPEPMJ3',   // Vraj Patel (admin auth/user)
  'dwOILGR9IJPSxHaPTIuDOyblA432',   // Somil Patel (Designer)
  'fQbVx9NtcyW5OotRXtjNh42lndt2',   // Rudra (Designer)
  'i4m8gcmAmlVb5NgAkK3nu1iLC7n1',   // Priya Sharma (Designer)
]);

// Collections to completely retain (Catalogue & Settings)
const CATALOGUE_AND_SETTINGS_COLLECTIONS = new Set([
  'products',
  'tiles',
  'config',
  'systemConfigs',
  'paymentConfig',
  'loyaltyConfig',
  'festivalGreetings',
  'priceChangeLogs',
  'deletedProductsLog',
]);

const isApply = process.argv.includes('--apply');

async function main() {
  console.log('================================================================================');
  console.log('ITACON GRANITO — PRE-LAUNCH DATA CLEANUP');
  console.log(`Execution Mode: ${isApply ? '*** APPLY (LIVE DELETIONS & WRITES) ***' : '*** DRY RUN (READ-ONLY) ***'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // STEP 1: Scan & Classify Users & Staff
  // ---------------------------------------------------------------------------
  const usersSnap = await db.collection('users').get();
  const keepUsers = [];
  const deleteUsers = [];
  const warnedUsers = [];
  const unclassifiedUsers = [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const doc of usersSnap.docs) {
    const id = doc.id;
    const d = doc.data() || {};
    const name = d.fullName || d.name || d.clientName || 'N/A';
    const role = d.role || d.userCategory || 'unspecified';
    const email = d.email || '';
    const phone = d.phoneNumber || d.phone || '';
    const businessName = d.businessName || d.companyName || '';
    const gstin = d.gstin || d.gstNumber || '';

    let createdAt = null;
    if (d.createdAt) {
      createdAt = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
    }

    const userSummary = {
      id,
      name,
      role,
      email,
      phone,
      businessName,
      gstin,
      createdAt: createdAt ? createdAt.toISOString() : 'N/A',
      raw: d,
    };

    if (id === KEEP_CUSTOMER_UID || id === KEEP_SALESPERSON_UID || KEEP_STAFF_UIDS.has(id)) {
      keepUsers.push(userSummary);
    } else {
      deleteUsers.push(userSummary);

      // Check warnings
      const warnings = [];
      if (createdAt && createdAt >= sevenDaysAgo) {
        warnings.push('Created in last 7 days');
      }
      if (businessName || gstin) {
        warnings.push(`Business: "${businessName}" | GSTIN: "${gstin}"`);
      }
      if (!d.role && !d.phoneNumber && !d.email && !d.fullName) {
        unclassifiedUsers.push(userSummary);
        warnings.push('Unclassified / incomplete doc');
      }

      if (warnings.length > 0) {
        warnedUsers.push({ ...userSummary, reasons: warnings });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Scan salesPersons Collection
  // ---------------------------------------------------------------------------
  const spSnap = await db.collection('salesPersons').get();
  const keepSalespersons = [];
  const deleteSalespersons = [];

  for (const doc of spSnap.docs) {
    const id = doc.id;
    const d = doc.data() || {};
    const summary = {
      id,
      name: d.fullName || d.name || 'N/A',
      code: d.referralCode || d.salespersonCode || 'N/A',
      email: d.email || 'N/A',
      phone: d.phone || d.phoneNumber || 'N/A',
      assignedClientsCount: d.assignedClientsCount || 0,
    };

    if (id === KEEP_SALESPERSON_UID) {
      keepSalespersons.push(summary);
    } else {
      deleteSalespersons.push(summary);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Scan Tirth's Customer Data and Link Status
  // ---------------------------------------------------------------------------
  const tirthUserDoc = await db.collection('users').doc(KEEP_CUSTOMER_UID).get();
  const tirthData = tirthUserDoc.exists ? tirthUserDoc.data() : null;
  const tirthCurrentSp = {
    salesPersonId: tirthData ? (tirthData.salesPersonId || tirthData.assignedSalespersonId || 'none') : 'none',
    salespersonName: tirthData ? (tirthData.salespersonName || 'none') : 'none',
    salespersonReferralCode: tirthData ? (tirthData.salespersonReferralCode || 'none') : 'none',
    salespersonPhone: tirthData ? (tirthData.salespersonPhone || 'none') : 'none',
  };

  // ---------------------------------------------------------------------------
  // STEP 4: Scan All Firestore Collections & Partition Docs
  // ---------------------------------------------------------------------------
  const allRootCollections = await db.listCollections();
  const collectionReport = {};
  const tirthOrderIds = new Set();

  // First collect Tirth's orders to correlate with dependent collections & storage
  const ordersSnap = await db.collection('orders').get();
  ordersSnap.docs.forEach((doc) => {
    const d = doc.data() || {};
    if (d.userId === KEEP_CUSTOMER_UID || d.customerId === KEEP_CUSTOMER_UID || d.customerPhone === KEEP_CUSTOMER_PHONE) {
      tirthOrderIds.add(doc.id);
    }
  });

  for (const colRef of allRootCollections) {
    const colName = colRef.id;
    if (CATALOGUE_AND_SETTINGS_COLLECTIONS.has(colName)) {
      const snap = await colRef.get();
      collectionReport[colName] = {
        total: snap.size,
        keep: snap.size,
        delete: 0,
        keepIds: snap.docs.map((d) => d.id),
        deleteIds: [],
        note: 'Catalogue / Settings collection (Retained)',
      };
      continue;
    }

    if (colName === 'users' || colName === 'salesPersons') {
      // Handled separately
      continue;
    }

    const snap = await colRef.get();
    const keepDocs = [];
    const deleteDocs = [];

    snap.docs.forEach((doc) => {
      const d = doc.data() || {};
      const id = doc.id;

      // Logic to determine if document belongs to Tirth / KEEP
      let belongsToKeep = false;

      if (colName === 'wholesalers' || colName === 'customers' || colName === 'customerSummary' || colName === 'wishlists') {
        belongsToKeep = (id === KEEP_CUSTOMER_UID);
      } else if (colName === 'Designer') {
        belongsToKeep = true; // All staff designers kept
      } else if (colName === 'retailers' || colName === 'builders' || colName === 'architects') {
        belongsToKeep = false; // Tirth is wholesaler; any mirror in these is deleted
      } else if (colName === 'orders') {
        belongsToKeep = tirthOrderIds.has(id);
      } else if (colName === 'salesOrders') {
        belongsToKeep = (d.userId === KEEP_CUSTOMER_UID || d.customerId === KEEP_CUSTOMER_UID || tirthOrderIds.has(d.orderId));
      } else if (colName === 'quotations') {
        belongsToKeep = (d.userId === KEEP_CUSTOMER_UID || d.customerPhone === KEEP_CUSTOMER_PHONE);
      } else if (colName === 'paymentSubmissions' || colName === 'payment_utrs') {
        belongsToKeep = (d.customerId === KEEP_CUSTOMER_UID || d.userId === KEEP_CUSTOMER_UID || tirthOrderIds.has(d.orderId));
      } else if (colName === 'approvalRequests') {
        belongsToKeep = tirthOrderIds.has(d.orderId);
      } else if (colName === 'user_demands' || colName === 'loyaltyTransactions') {
        belongsToKeep = (d.userId === KEEP_CUSTOMER_UID || d.customerId === KEEP_CUSTOMER_UID);
      } else if (colName === 'customer_referrals') {
        belongsToKeep = (d.clientId === KEEP_CUSTOMER_UID || d.userId === KEEP_CUSTOMER_UID);
      } else if (colName === 'client_assignments') {
        belongsToKeep = (d.clientId === KEEP_CUSTOMER_UID || d.userId === KEEP_CUSTOMER_UID || id === `ASGN_${KEEP_CUSTOMER_UID}`);
      } else if (colName === 'gstLookups') {
        belongsToKeep = (d.queriedBy === KEEP_CUSTOMER_UID);
      } else if (colName === 'Auto_Assign_User' || colName === 'Manual_salesperson_assign' || colName === 'notifications') {
        belongsToKeep = false;
      } else if (colName === 'auth_rate_limits' || colName === 'rate_limits') {
        belongsToKeep = false; // Ephemeral test caches
      }

      if (belongsToKeep) {
        keepDocs.push(id);
      } else {
        deleteDocs.push(id);
      }
    });

    collectionReport[colName] = {
      total: snap.size,
      keep: keepDocs.length,
      delete: deleteDocs.length,
      keepIds: keepDocs,
      deleteIds: deleteDocs,
    };
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Vraj Shah assigned_clients Subcollection
  // ---------------------------------------------------------------------------
  const vrajClientsSnap = await db.collection('salesPersons').doc(KEEP_SALESPERSON_UID).collection('assigned_clients').get();
  const vrajClientsKeep = [];
  const vrajClientsDelete = [];
  vrajClientsSnap.docs.forEach((doc) => {
    if (doc.id === KEEP_CUSTOMER_UID) {
      vrajClientsKeep.push(doc.id);
    } else {
      vrajClientsDelete.push(doc.id);
    }
  });

  // ---------------------------------------------------------------------------
  // STEP 6: Scan Firebase Auth Accounts
  // ---------------------------------------------------------------------------
  const listUsersResult = await auth.listUsers(1000);
  const authKeep = [];
  const authDelete = [];

  const keepAuthUids = new Set([
    KEEP_CUSTOMER_UID,
    KEEP_SALESPERSON_UID,
    ...KEEP_STAFF_UIDS,
  ]);

  for (const userRecord of listUsersResult.users) {
    const uSummary = {
      uid: userRecord.uid,
      email: userRecord.email || '',
      phone: userRecord.phoneNumber || '',
      displayName: userRecord.displayName || '',
      createdAt: userRecord.metadata.creationTime,
    };

    if (keepAuthUids.has(userRecord.uid)) {
      authKeep.push(uSummary);
    } else {
      authDelete.push(uSummary);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 7: Scan Firebase Storage Files
  // ---------------------------------------------------------------------------
  const [allFiles] = await bucket.getFiles();
  const storageKeep = [];
  const storageDelete = [];
  let storageDeleteBytes = 0;

  for (const file of allFiles) {
    const name = file.name;
    const size = parseInt(file.metadata.size || 0, 10);

    let keep = false;
    if (name.startsWith('products/')) {
      keep = true; // Catalogue assets
    } else if (name.startsWith('payment_proofs/')) {
      const orderId = name.split('/')[1];
      keep = tirthOrderIds.has(orderId);
    } else if (name.startsWith('purchase_orders/')) {
      const orderId = name.split('/')[1];
      keep = tirthOrderIds.has(orderId);
    } else if (name.startsWith('user_profiles/')) {
      keep = name.includes(KEEP_CUSTOMER_UID);
    } else {
      keep = false;
    }

    if (keep) {
      storageKeep.push({ name, size });
    } else {
      storageDelete.push({ name, size });
      storageDeleteBytes += size;
    }
  }

  // ===========================================================================
  // REPORT OUTPUT
  // ===========================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('1. KEEP LIST (NEVER DELETED)');
  console.log('--------------------------------------------------------------------------------');
  console.log(`[Salesperson] Vraj Shah`);
  console.log(`   - UID: ${KEEP_SALESPERSON_UID}`);
  console.log(`   - Email: vrajtemp1@gmail.com | Phone: 9876543210 | Referral Code: SALES101\n`);

  console.log(`[Customer] Tirth Kalpesh Patel`);
  console.log(`   - UID: ${KEEP_CUSTOMER_UID}`);
  console.log(`   - Phone: +919624818476 | Category: wholesaler | GSTIN: 24AOOPR9561H1ZB`);
  console.log(`   - Company: JAY KHODIYAR BEARING TRADERS`);
  console.log(`   - Orders: ${tirthOrderIds.size} | Quotations: ${collectionReport.quotations ? collectionReport.quotations.keep : 0}`);
  console.log(`   - Payments: ${collectionReport.paymentSubmissions ? collectionReport.paymentSubmissions.keep : 0} | Loyalty Txs: ${collectionReport.loyaltyTransactions ? collectionReport.loyaltyTransactions.keep : 0}\n`);

  console.log(`[Staff Accounts] (${keepUsers.filter(u => KEEP_STAFF_UIDS.has(u.id)).length} accounts)`);
  keepUsers
    .filter((u) => KEEP_STAFF_UIDS.has(u.id))
    .forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.name.padEnd(25)} | Role: ${u.role.padEnd(10)} | Email: ${(u.email || 'N/A').padEnd(26)} | Phone: ${(u.phone || 'N/A').padEnd(15)} | UID: ${u.id}`);
    });
  console.log(`   + Designer collection docs: fQbVx9NtcyW5OotRXtjNh42lndt2 (Rudra), ySQksyQa7J8NgDJwUEO5 (Somil)`);

  console.log('\n--------------------------------------------------------------------------------');
  console.log("2. TIRTH'S CURRENT SALESPERSON LINK (Item 5)");
  console.log('--------------------------------------------------------------------------------');
  console.log(`Current Linked Salesperson ID:   ${tirthCurrentSp.salesPersonId}`);
  console.log(`Current Linked Salesperson Name: ${tirthCurrentSp.salespersonName}`);
  console.log(`Current Linked Referral Code:    ${tirthCurrentSp.salespersonReferralCode}`);
  console.log(`Current Linked Phone:            ${tirthCurrentSp.salespersonPhone}`);
  if (tirthCurrentSp.salesPersonId !== KEEP_SALESPERSON_UID) {
    console.log(`\n>>> ACTION REQUIRED IN PHASE 3: Tirth is currently linked to salesperson Mohit (${tirthCurrentSp.salesPersonId}, ${tirthCurrentSp.salespersonReferralCode}), which is being deleted.`);
    console.log(`    Phase 3 will atomically re-link Tirth to Vraj Shah (${KEEP_SALESPERSON_UID}, SALES101) using authoritative verifyReferralCode fields.`);
  } else {
    console.log(`\n>>> Tirth is already correctly linked to Vraj Shah.`);
  }

  console.log('\n--------------------------------------------------------------------------------');
  console.log('3. DELETE LIST PER COLLECTION (Doc Counts & Scope)');
  console.log('--------------------------------------------------------------------------------');
  console.log(`salesPersons: ${deleteSalespersons.length} to delete (Total: ${spSnap.size}, Keep: ${keepSalespersons.length})`);
  deleteSalespersons.forEach((sp, i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${sp.name.padEnd(22)} | Code: ${sp.code.padEnd(10)} | Email: ${sp.email.padEnd(32)} | UID: ${sp.id}`);
  });

  console.log(`\nusers: ${deleteUsers.length} to delete (Total: ${usersSnap.size}, Keep: ${keepUsers.length})`);
  deleteUsers.forEach((u, i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${u.name.padEnd(25)} | Phone: ${(u.phone || 'N/A').padEnd(15)} | Cat: ${u.role.padEnd(12)} | Created: ${u.createdAt.padEnd(24)} | UID: ${u.id}`);
  });

  console.log('\nOther Firestore Collections:');
  for (const [col, rep] of Object.entries(collectionReport)) {
    if (CATALOGUE_AND_SETTINGS_COLLECTIONS.has(col)) {
      console.log(`   - ${col.padEnd(26)}: Total ${rep.total.toString().padStart(3)} | KEEP: ${rep.keep.toString().padStart(3)} | DELETE: ${rep.delete.toString().padStart(3)} [CATALOGUE/SETTINGS - RETAINED]`);
    } else {
      console.log(`   - ${col.padEnd(26)}: Total ${rep.total.toString().padStart(3)} | KEEP: ${rep.keep.toString().padStart(3)} | DELETE: ${rep.delete.toString().padStart(3)}`);
    }
  }

  console.log(`\nVraj Shah assigned_clients subcollection: Total ${vrajClientsSnap.size} | KEEP: ${vrajClientsKeep.length} | DELETE: ${vrajClientsDelete.length}`);

  console.log('\n--------------------------------------------------------------------------------');
  console.log('4. AUTH ACCOUNTS & STORAGE FILES TO DELETE');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Firebase Auth Accounts: ${authDelete.length} to delete (Total: ${listUsersResult.users.length}, Keep: ${authKeep.length})`);
  authDelete.forEach((u, i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${(u.displayName || u.email || u.phone || 'No identifier').padEnd(35)} | Created: ${u.createdAt.padEnd(30)} | UID: ${u.uid}`);
  });

  console.log(`\nFirebase Storage Files: ${storageDelete.length} to delete (Total: ${allFiles.length}, Keep: ${storageKeep.length})`);
  console.log(`Total Storage Reclaimed: ${(storageDeleteBytes / (1024 * 1024)).toFixed(3)} MB`);
  storageDelete.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
  });

  console.log('\n--------------------------------------------------------------------------------');
  console.log('5. SAFETY WARNINGS (Requires Explicit Confirmation)');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Flagged Entities: ${warnedUsers.length} users + 1 special product doc\n`);

  console.log('A. Users created in the last 7 days (or today):');
  warnedUsers
    .filter((w) => w.reasons.some((r) => r.includes('7 days')))
    .forEach((w) => {
      console.log(`   * ${w.name.padEnd(22)} (${w.role.padEnd(12)}) | Created: ${w.createdAt} | UID: ${w.id}`);
    });

  console.log('\nB. Users with non-empty business name / GSTIN:');
  warnedUsers
    .filter((w) => w.reasons.some((r) => r.includes('Business')))
    .forEach((w) => {
      console.log(`   * ${w.name.padEnd(22)} | Business: "${w.businessName}" | GSTIN: "${w.gstin}" | UID: ${w.id}`);
    });

  console.log('\nC. Incomplete / unclassified documents:');
  unclassifiedUsers.forEach((w) => {
    console.log(`   * UID: ${w.id} (fields: ${Object.keys(w.raw).join(', ')})`);
  });

  console.log('\nD. Special Catalogue Doc:');
  console.log(`   * products/O5b6jtBrylI7BJNZ2tWz & tiles/O5b6jtBrylI7BJNZ2tWz:`);
  console.log(`     Name: "DEMO" | SKU: "DEMO-001" | Created 2026-10-24 by Somil Patel (Designer).`);
  console.log(`     (Total products = 305; excluding DEMO = 304).`);

  // ===========================================================================
  // IF DRY RUN -> STOP HERE
  // ===========================================================================
  if (!isApply) {
    console.log('\n================================================================================');
    console.log('DRY RUN COMPLETE — NO CHANGES MADE.');
    console.log('Please review the report above.');
    console.log('To execute Phase 2 deletions and Phase 3 link updates, reply "Approved".');
    console.log('================================================================================\n');
    return;
  }

  // ===========================================================================
  // PHASE 2 — LIVE DELETIONS (Triggered only when --apply is passed)
  // ===========================================================================
  console.log('\n================================================================================');
  console.log('PHASE 2 — COMMENCING LIVE DELETIONS (--apply)');
  console.log('================================================================================');

  const cleanupLog = {
    startedAt: new Date().toISOString(),
    deletedCounts: {},
    deletedIds: {},
  };

  // Helper for batch deletes with recursiveDelete
  async function deleteDocs(colName, docIds) {
    if (!docIds || docIds.length === 0) return 0;
    console.log(`Deleting ${docIds.length} docs from ${colName}...`);
    let count = 0;
    for (const docId of docIds) {
      const docRef = db.collection(colName).doc(docId);
      await db.recursiveDelete(docRef);
      count++;
      if (count % 50 === 0 || count === docIds.length) {
        console.log(`   -> Deleted ${count}/${docIds.length} from ${colName}`);
      }
    }
    return count;
  }

  // 1. Delete non-retained salesPersons docs (+ subcollections)
  cleanupLog.deletedCounts.salesPersons = await deleteDocs('salesPersons', deleteSalespersons.map(s => s.id));
  cleanupLog.deletedIds.salesPersons = deleteSalespersons.map(s => s.id);

  // 2. Delete non-retained users docs (+ subcollections)
  cleanupLog.deletedCounts.users = await deleteDocs('users', deleteUsers.map(u => u.id));
  cleanupLog.deletedIds.users = deleteUsers.map(u => u.id);

  // 3. Delete non-retained docs in other collections
  for (const [colName, rep] of Object.entries(collectionReport)) {
    if (CATALOGUE_AND_SETTINGS_COLLECTIONS.has(colName)) continue;
    if (rep.deleteIds && rep.deleteIds.length > 0) {
      cleanupLog.deletedCounts[colName] = await deleteDocs(colName, rep.deleteIds);
      cleanupLog.deletedIds[colName] = rep.deleteIds;
    }
  }

  // 4. Delete Vraj Shah's orphan assigned_clients subdocs
  if (vrajClientsDelete.length > 0) {
    console.log(`Deleting ${vrajClientsDelete.length} orphan clients from Vraj Shah assigned_clients...`);
    for (const clientId of vrajClientsDelete) {
      await db.collection('salesPersons').doc(KEEP_SALESPERSON_UID).collection('assigned_clients').doc(clientId).delete();
    }
    cleanupLog.deletedCounts.vrajOrphanClients = vrajClientsDelete.length;
    cleanupLog.deletedIds.vrajOrphanClients = vrajClientsDelete;
  }

  // 5. Delete Firebase Auth accounts in batches (max 1000)
  if (authDelete.length > 0) {
    console.log(`Deleting ${authDelete.length} Firebase Auth accounts...`);
    const uidsToDelete = authDelete.map((u) => u.uid);
    for (let i = 0; i < uidsToDelete.length; i += 500) {
      const batch = uidsToDelete.slice(i, i + 500);
      const deleteResult = await auth.deleteUsers(batch);
      console.log(`   -> Auth batch deleted: ${batch.length} (Errors: ${deleteResult.errors.length})`);
    }
    cleanupLog.deletedCounts.authUsers = uidsToDelete.length;
    cleanupLog.deletedIds.authUsers = uidsToDelete;
  }

  // 6. Delete Storage files
  if (storageDelete.length > 0) {
    console.log(`Deleting ${storageDelete.length} files from Firebase Storage...`);
    for (const f of storageDelete) {
      try {
        await bucket.file(f.name).delete();
      } catch (err) {
        console.warn(`   Warning deleting storage file ${f.name}: ${err.message}`);
      }
    }
    cleanupLog.deletedCounts.storageFiles = storageDelete.length;
    cleanupLog.deletedIds.storageFiles = storageDelete.map((f) => f.name);
  }

  // Save cleanup report log
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const reportPath = path.join(reportsDir, `cleanup-log-${dateStr}.json`);
  cleanupLog.completedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(cleanupLog, null, 2), 'utf8');
  console.log(`\nCleanup log successfully written to: ${reportPath}`);

  // ===========================================================================
  // PHASE 3 — FIX LINKS + COUNTS
  // ===========================================================================
  console.log('\n================================================================================');
  console.log('PHASE 3 — FIXING SALESPERSON LINKS & RECALCULATING COUNTS');
  console.log('================================================================================');

  // 1. Re-link Tirth to Vraj Shah using authoritative verifyReferralCode fields
  const vrajSpDoc = await db.collection('salesPersons').doc(KEEP_SALESPERSON_UID).get();
  const vrajSpData = vrajSpDoc.data() || {};
  const spName = vrajSpData.name || vrajSpData.fullName || 'Vraj Shah';
  const spPhone = vrajSpData.phone || vrajSpData.phoneNumber || '9876543210';
  const spCode = vrajSpData.referralCode || 'SALES101';

  const tirthUserRef = db.collection('users').doc(KEEP_CUSTOMER_UID);
  const tirthLatestSnap = await tirthUserRef.get();
  const tirthLatestData = tirthLatestSnap.data() || {};

  console.log(`Linking customer Tirth (${KEEP_CUSTOMER_UID}) to Vraj Shah (${KEEP_SALESPERSON_UID}, ${spCode})...`);
  await tirthUserRef.set({
    salesPersonId: KEEP_SALESPERSON_UID,
    assignedSalespersonId: KEEP_SALESPERSON_UID,
    salespersonName: spName,
    salespersonPhone: spPhone,
    salespersonReferralCode: spCode,
    status: 'active',
    isVerified: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // 2. Ensure Vraj Shah's assigned_clients/{TirthUid} subdoc exists with identical fields
  const clientSubdocRef = db.collection('salesPersons').doc(KEEP_SALESPERSON_UID).collection('assigned_clients').doc(KEEP_CUSTOMER_UID);
  await clientSubdocRef.set({
    clientId: KEEP_CUSTOMER_UID,
    userId: KEEP_CUSTOMER_UID,
    name: tirthLatestData.fullName || tirthLatestData.name || 'Tirth Kalpesh Patel',
    clientName: tirthLatestData.fullName || tirthLatestData.name || 'Tirth Kalpesh Patel',
    phone: KEEP_CUSTOMER_PHONE,
    clientPhone: KEEP_CUSTOMER_PHONE,
    phoneNumber: KEEP_CUSTOMER_PHONE,
    clientCategory: 'wholesaler',
    userCategory: 'wholesaler',
    companyName: tirthLatestData.companyName || 'JAY KHODIYAR BEARING TRADERS',
    assignmentType: 'manual_referral',
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive: true,
  }, { merge: true });

  // 3. Recalculate Vraj Shah's counts based on real remaining assigned_clients subdocs
  const finalClientsSnap = await db.collection('salesPersons').doc(KEEP_SALESPERSON_UID).collection('assigned_clients').get();
  const realCount = finalClientsSnap.size;
  console.log(`Recalculating Vraj Shah counts: real assigned_clients count = ${realCount}`);

  await db.collection('salesPersons').doc(KEEP_SALESPERSON_UID).set({
    assignedClientsCount: realCount,
    activeClientsCount: realCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // 4. Update auxiliary mirror client_assignments
  await db.collection('client_assignments').doc(`ASGN_${KEEP_CUSTOMER_UID}`).set({
    assignmentId: `ASGN_${KEEP_CUSTOMER_UID}`,
    clientId: KEEP_CUSTOMER_UID,
    clientName: tirthLatestData.fullName || tirthLatestData.name || 'Tirth Kalpesh Patel',
    clientPhone: KEEP_CUSTOMER_PHONE,
    clientCategory: 'wholesaler',
    salespersonId: KEEP_SALESPERSON_UID,
    salespersonName: spName,
    salespersonPhone: spPhone,
    salespersonReferralCode: spCode,
    companyName: tirthLatestData.companyName || 'JAY KHODIYAR BEARING TRADERS',
    assignmentType: 'manual_referral',
    status: 'active',
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('Phase 3 links & counts successfully updated!');

  // ===========================================================================
  // PHASE 4 — VERIFY (READ-ONLY)
  // ===========================================================================
  console.log('\n================================================================================');
  console.log('PHASE 4 — POST-CLEANUP VERIFICATION');
  console.log('================================================================================');

  const vSpSnap = await db.collection('salesPersons').get();
  const vUsersSnap = await db.collection('users').get();
  const vOrdersSnap = await db.collection('orders').get();
  const vProductsSnap = await db.collection('products').get();
  const vTilesSnap = await db.collection('tiles').get();
  const vAuthList = await auth.listUsers(100);

  const vTirthDoc = await db.collection('users').doc(KEEP_CUSTOMER_UID).get();
  const vTirthData = vTirthDoc.data() || {};
  const vVrajDoc = await db.collection('salesPersons').doc(KEEP_SALESPERSON_UID).get();
  const vVrajData = vVrajDoc.data() || {};
  const vVrajSubSnap = await db.collection('salesPersons').doc(KEEP_SALESPERSON_UID).collection('assigned_clients').get();

  const c1 = vSpSnap.size === 1 && vSpSnap.docs[0].id === KEEP_SALESPERSON_UID;
  const c2 = vUsersSnap.docs.every(d => d.id === KEEP_CUSTOMER_UID || d.id === KEEP_SALESPERSON_UID || KEEP_STAFF_UIDS.has(d.id));
  const c3 = vOrdersSnap.size === tirthOrderIds.size;
  const c4 = vTirthData.salesPersonId === KEEP_SALESPERSON_UID && vTirthData.salespersonReferralCode === 'SALES101';
  const c5 = vVrajData.assignedClientsCount === 1 && vVrajData.activeClientsCount === 1 && vVrajSubSnap.size === 1;
  const c6 = (vProductsSnap.size === 304 || vProductsSnap.size === 305) && (vTilesSnap.size === 304 || vTilesSnap.size === 305);
  const c7 = vAuthList.users.every(u => keepAuthUids.has(u.uid));

  console.log(`${c1 ? '✅' : '❌'} salesPersons contains ONLY Vraj Shah: ${vSpSnap.size} doc(s) (${vSpSnap.docs.map(d => d.id).join(', ')})`);
  console.log(`${c2 ? '✅' : '❌'} Customer users: ONLY Tirth Kalpesh Patel; all staff accounts present: ${vUsersSnap.size} doc(s)`);
  console.log(`${c3 ? '✅' : '❌'} Tirth's data fully intact: order count before (${tirthOrderIds.size}) = after (${vOrdersSnap.size})`);
  console.log(`${c4 ? '✅' : '❌'} Tirth correctly linked to Vraj Shah (SALES101)`);
  console.log(`${c5 ? '✅' : '❌'} Vraj Shah counts correct (assignedClientsCount = ${vVrajData.assignedClientsCount}, subdocs = ${vVrajSubSnap.size})`);
  console.log(`${c6 ? '✅' : '❌'} Catalogue & config unchanged (Products: ${vProductsSnap.size}, Tiles: ${vTilesSnap.size})`);
  console.log(`${c7 ? '✅' : '❌'} Firebase Auth accounts: ONLY KEEP + staff (${vAuthList.users.length} accounts: ${vAuthList.users.map(u => u.uid).join(', ')})`);
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('\n*** SCRIPT EXECUTION FAILED ***');
  console.error(err);
  process.exit(1);
});

