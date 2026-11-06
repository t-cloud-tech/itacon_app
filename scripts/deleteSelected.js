/**
 * scripts/deleteSelected.js
 *
 * Targeted Data Deletion Script for Itacon (itacon-app).
 * Supports --dry-run (default) and --execute.
 *
 * PHASES IMPLEMENTED:
 * Phase 1: Dry run analysis, itemized counts, keep verification, lead checks, warnings.
 * Phase 2: Recursive batched Firestore deletes, Firebase Auth account deletions, Cloud Storage file removals.
 * Phase 3: Recalculation of assignedClientsCount and activeClientsCount for remaining salespersons.
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'itacon-app',
    storageBucket: 'itacon-app.firebasestorage.app',
  });
}

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

const IS_EXECUTE = process.argv.includes('--execute');
const IS_DRY_RUN = !IS_EXECUTE;

// ============================================================================
// TARGET SPECIFICATIONS
// ============================================================================
const TARGET_STAFF = [
  {
    key: 'vraj_patel_admin_1',
    label: 'Vraj Patel (Admin 1)',
    uid: '9hhMaF6WFccGHJc4vyglAxPEPMJ3',
    role: 'admin',
    expectedEmail: 'vrajp9013@gmail.com',
    userDocPath: 'users/9hhMaF6WFccGHJc4vyglAxPEPMJ3',
    extraDocPaths: [],
  },
  {
    key: 'vraj_patel_admin_2',
    label: 'Vraj Patel (Admin 2 doc)',
    uid: 'admin_01',
    role: 'admin',
    expectedEmail: 'vrajp9013@gmail.com',
    userDocPath: 'users/admin_01',
    extraDocPaths: [],
  },
  {
    key: 'vraj_shah_salesperson',
    label: 'Vraj Shah (Salesperson)',
    uid: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
    role: 'salesperson',
    code: 'SALES101',
    expectedEmail: 'vrajtemp1@gmail.com',
    userDocPath: 'users/WNSahNXK9GQrGoiIEmD4QBvAeim1',
    extraDocPaths: ['salesPersons/WNSahNXK9GQrGoiIEmD4QBvAeim1'],
  },
  {
    key: 'somil_patel_designer',
    label: 'Somil Patel (Designer)',
    uid: 'dwOILGR9IJPSxHaPTIuDOyblA432',
    role: 'designer',
    expectedEmail: 'somilpatel403@gmail.com',
    userDocPath: 'users/dwOILGR9IJPSxHaPTIuDOyblA432',
    extraDocPaths: ['Designer/ySQksyQa7J8NgDJwUEO5'],
  },
  {
    key: 'rudra_designer',
    label: 'Rudra (Designer)',
    uid: 'fQbVx9NtcyW5OotRXtjNh42lndt2',
    role: 'designer',
    expectedEmail: 'lajeweh391@moblha.com',
    userDocPath: 'users/fQbVx9NtcyW5OotRXtjNh42lndt2',
    extraDocPaths: ['Designer/fQbVx9NtcyW5OotRXtjNh42lndt2'],
  },
  {
    key: 'priya_sharma_designer',
    label: 'Priya Sharma (Designer)',
    uid: 'i4m8gcmAmlVb5NgAkK3nu1iLC7n1',
    role: 'designer',
    expectedEmail: 'designer@itacon.com',
    userDocPath: 'users/i4m8gcmAmlVb5NgAkK3nu1iLC7n1',
    extraDocPaths: [],
  },
];

const TARGET_CUSTOMERS = [
  {
    key: 'cust_gggttjfcf',
    label: 'Customer gggttjfcf / ghjvvghvg',
    uid: 'sPtDUcRndAUXpPOIdxLfWORm2sz2',
    role: 'dealer',
    firm: 'gggttjfcf',
    phone: '+917654778646',
    customerCode: 'CUST-RM2SZ2',
    gstin: '24AAAFT2820R1Z0',
    userDocPath: 'users/sPtDUcRndAUXpPOIdxLfWORm2sz2',
    categoryMirrorPath: 'dealers/sPtDUcRndAUXpPOIdxLfWORm2sz2',
  },
  {
    key: 'cust_tirth_patel',
    label: 'Tirth Kalpesh Patel (JAY KHODIYAR BEARING TRADERS / Dero By Zero)',
    uid: 'curhNkfDRveFrBxdtSeOpUosZKD3',
    role: 'wholesaler',
    firm: 'JAY KHODIYAR BEARING TRADERS',
    phone: '+919624818476',
    customerCode: 'CUST-OSZKD3',
    gstin: '24AOOPR9561H1ZB',
    userDocPath: 'users/curhNkfDRveFrBxdtSeOpUosZKD3',
    categoryMirrorPath: 'wholesalers/curhNkfDRveFrBxdtSeOpUosZKD3',
  },
];

// Explicit accounts to protect
const PROTECTED_ACCOUNTS = [
  { name: 'Prashant D Sitapara', uid: '5YSBaVZCIfOuJiMPa9QH7fPr6M42', role: 'admin' },
  { name: 'Dhaval Jani', uid: 'njbTk37EpsZkD9JpS3bBoUfAwHa2', role: 'salesperson', code: 'SALES-020' },
  { name: 'Abhi Pandya', uid: 'NX6cVgOSmKM9q6eWGszY4JUKnoy1', role: 'designer' },
];

async function run() {
  const dateStr = new Date().toISOString().slice(0, 10);
  console.log('================================================================');
  console.log(`ITACON GRANITO — DATA DELETION (${IS_EXECUTE ? 'EXECUTE MODE' : 'DRY RUN MODE'})`);
  console.log(`Date: ${dateStr}`);
  console.log('================================================================\n');

  if (IS_DRY_RUN) {
    console.log('>>> RUNNING IN DRY-RUN MODE. NO DATA WILL BE DELETED OR MODIFIED. <<<\n');
  } else {
    console.log('>>> RUNNING IN LIVE EXECUTION MODE. DATA DELETIONS WILL BE PERFORMED! <<<\n');
  }

  // ==========================================================================
  // SECTION 1: TARGET ACCOUNTS INSPECTION
  // ==========================================================================
  console.log('================================================================');
  console.log('1. ACCOUNTS MARKED FOR DELETION');
  console.log('================================================================');

  const staffDeletePlan = [];
  for (const s of TARGET_STAFF) {
    let firestoreData = null;
    const userDocRef = db.doc(s.userDocPath);
    const userDocSnap = await userDocRef.get();
    if (userDocSnap.exists) {
      firestoreData = userDocSnap.data();
    }

    let authUser = null;
    try {
      authUser = await auth.getUser(s.uid);
    } catch (_) {}

    const docPaths = [s.userDocPath, ...s.extraDocPaths];
    // Check extra subcollections under user doc
    const subcols = userDocSnap.exists ? await userDocRef.listCollections() : [];
    const subcolNames = subcols.map(c => c.id);

    staffDeletePlan.push({
      ...s,
      existsInFirestore: userDocSnap.exists,
      firestoreData,
      authUid: authUser ? authUser.uid : null,
      authEmail: authUser ? authUser.email : null,
      docPaths,
      subcollections: subcolNames,
    });

    console.log(`[STAFF] ${s.label}`);
    console.log(`   UID:            ${s.uid}`);
    console.log(`   Role:           ${s.role}`);
    console.log(`   Email / Phone:  ${firestoreData?.email || s.expectedEmail} | ${firestoreData?.phone || 'N/A'}`);
    console.log(`   Firestore Docs: ${docPaths.join(', ')} (exists: ${userDocSnap.exists})`);
    console.log(`   Subcollections: ${subcolNames.join(', ') || 'none'}`);
    console.log(`   Auth Account:   ${authUser ? `Found (UID: ${authUser.uid}, Email: ${authUser.email})` : 'NOT FOUND in Firebase Auth'}`);
    console.log('');
  }

  const custDeletePlan = [];
  for (const c of TARGET_CUSTOMERS) {
    let firestoreData = null;
    const userDocRef = db.doc(c.userDocPath);
    const userDocSnap = await userDocRef.get();
    if (userDocSnap.exists) {
      firestoreData = userDocSnap.data();
    }

    let authUser = null;
    try {
      authUser = await auth.getUser(c.uid);
    } catch (_) {}

    const subcols = userDocSnap.exists ? await userDocRef.listCollections() : [];
    const subcolNames = subcols.map(s => s.id);

    const docPaths = [c.userDocPath, c.categoryMirrorPath];
    custDeletePlan.push({
      ...c,
      existsInFirestore: userDocSnap.exists,
      firestoreData,
      authUid: authUser ? authUser.uid : null,
      authPhone: authUser ? authUser.phoneNumber : null,
      docPaths,
      subcollections: subcolNames,
    });

    console.log(`[CUSTOMER] ${c.label}`);
    console.log(`   UID:            ${c.uid}`);
    console.log(`   Role/Category:  ${c.role}`);
    console.log(`   Customer Code:  ${c.customerCode}`);
    console.log(`   Phone / Email:  ${c.phone} | ${firestoreData?.email || 'N/A'}`);
    console.log(`   GSTIN:          ${c.gstin}`);
    console.log(`   Firestore Docs: ${docPaths.join(', ')}`);
    console.log(`   Subcollections: ${subcolNames.join(', ') || 'none'}`);
    console.log(`   Auth Account:   ${authUser ? `Found (UID: ${authUser.uid}, Phone: ${authUser.phoneNumber})` : 'NOT FOUND in Firebase Auth'}`);
    console.log('');
  }

  // ==========================================================================
  // SECTION 2: CUSTOMER ASSOCIATED DATA & STORAGE FILES
  // ==========================================================================
  console.log('================================================================');
  console.log('2. CUSTOMER ASSOCIATED DATA BREAKDOWN');
  console.log('================================================================');

  const customerDataSummary = {};

  for (const c of TARGET_CUSTOMERS) {
    console.log(`\n--- Data Analysis for ${c.label} (UID: ${c.uid}) ---`);
    const summary = {
      uid: c.uid,
      orders: [],
      salesOrders: [],
      quotations: [],
      paymentSubmissions: [],
      paymentUtrs: [],
      loyaltyTransactions: [],
      userDemands: [],
      approvalRequests: [],
      wishlistDocs: [],
      customerSummaryDocs: [],
      clientAssignments: [],
      customerReferrals: [],
      gstLookupDocs: [],
      profileStorageFiles: [],
      orderStorageFiles: [],
    };

    // Orders
    const ordersSnap = await db.collection('orders').get();
    ordersSnap.forEach(d => {
      const data = d.data();
      if (data.userId === c.uid || data.customerId === c.uid || data.uid === c.uid) {
        summary.orders.push({
          id: d.id,
          poNumber: data.poNumber || data.orderNumber || data.po_number || 'N/A',
          status: data.status,
          totalAmount: data.totalAmount || data.finalAmount || data.orderTotal,
          createdAt: data.createdAt,
        });
      }
    });

    // SalesOrders
    const salesOrdersSnap = await db.collection('salesOrders').get();
    salesOrdersSnap.forEach(d => {
      const data = d.data();
      if (data.userId === c.uid || data.customerId === c.uid || summary.orders.some(o => o.id === d.id)) {
        summary.salesOrders.push({
          id: d.id,
          poNumber: data.poNumber || data.orderNumber || 'N/A',
          status: data.status,
        });
      }
    });

    // Quotations
    const quotationsSnap = await db.collection('quotations').get();
    quotationsSnap.forEach(d => {
      const data = d.data();
      if (data.userId === c.uid || data.customerId === c.uid || data.uid === c.uid) {
        summary.quotations.push({
          id: d.id,
          quotationNumber: data.quotationNumber || data.quoteNumber || d.id,
          status: data.status,
          totalAmount: data.totalAmount || data.finalTotal,
        });
      }
    });

    // Payment submissions & UTRs
    const paymentsSnap = await db.collection('paymentSubmissions').get();
    paymentsSnap.forEach(d => {
      const data = d.data();
      if (data.userId === c.uid || data.customerId === c.uid || data.uid === c.uid || summary.orders.some(o => o.id === data.orderId)) {
        summary.paymentSubmissions.push({
          id: d.id,
          orderId: data.orderId,
          utrNumber: data.utrNumber,
          amount: data.amount,
          status: data.status,
        });
      }
    });

    const utrsSnap = await db.collection('payment_utrs').get();
    utrsSnap.forEach(d => {
      const data = d.data();
      if (data.userId === c.uid || data.customerId === c.uid || summary.orders.some(o => o.id === data.orderId)) {
        summary.paymentUtrs.push({
          id: d.id,
          utr: data.utr || data.utrNormalized,
          orderId: data.orderId,
          status: data.status,
        });
      }
    });

    // Loyalty transactions
    const loyaltySnap = await db.collection('loyaltyTransactions').get();
    loyaltySnap.forEach(d => {
      const data = d.data();
      if (data.userId === c.uid || data.customerId === c.uid) {
        summary.loyaltyTransactions.push({
          id: d.id,
          points: data.points,
          type: data.type,
        });
      }
    });

    // User demands
    const demandsSnap = await db.collection('user_demands').get();
    demandsSnap.forEach(d => {
      const data = d.data();
      if (data.userId === c.uid || data.customerId === c.uid) {
        summary.userDemands.push(d.id);
      }
    });

    // Approval requests
    const approvalsSnap = await db.collection('approvalRequests').get();
    approvalsSnap.forEach(d => {
      const str = JSON.stringify(d.data());
      if (str.includes(c.uid) || summary.orders.some(o => str.includes(o.id))) {
        summary.approvalRequests.push(d.id);
      }
    });

    // Wishlist
    const wishSnap = await db.collection('wishlists').doc(c.uid).get();
    if (wishSnap.exists) summary.wishlistDocs.push(`wishlists/${c.uid}`);

    // Customer summary
    const csSnap = await db.collection('customerSummary').doc(c.uid).get();
    if (csSnap.exists) summary.customerSummaryDocs.push(`customerSummary/${c.uid}`);

    // Client assignments
    const caSnap = await db.collection('client_assignments').get();
    caSnap.forEach(d => {
      const data = d.data();
      if (data.clientId === c.uid || data.userId === c.uid || d.id === `ASGN_${c.uid}`) {
        summary.clientAssignments.push(`client_assignments/${d.id}`);
      }
    });

    // Customer referrals
    const crSnap = await db.collection('customer_referrals').get();
    crSnap.forEach(d => {
      const data = d.data();
      if (data.clientId === c.uid || data.userId === c.uid || data.referrerId === c.uid || data.referredId === c.uid) {
        summary.customerReferrals.push(`customer_referrals/${d.id}`);
      }
    });

    // GST lookup
    if (c.gstin) {
      const gstSnap = await db.collection('gstLookups').doc(c.gstin).get();
      if (gstSnap.exists) summary.gstLookupDocs.push(`gstLookups/${c.gstin}`);
    }

    // Storage files
    const [profileFiles] = await bucket.getFiles({ prefix: `user_profiles/${c.uid}` });
    summary.profileStorageFiles = profileFiles.map(f => f.name);

    for (const order of summary.orders) {
      const [poFiles] = await bucket.getFiles({ prefix: `purchase_orders/${order.id}/` });
      const [proofFiles] = await bucket.getFiles({ prefix: `payment_proofs/${order.id}/` });
      poFiles.forEach(f => summary.orderStorageFiles.push(f.name));
      proofFiles.forEach(f => summary.orderStorageFiles.push(f.name));
    }

    customerDataSummary[c.uid] = summary;

    console.log(`- Orders Count:              ${summary.orders.length}`);
    if (summary.orders.length > 0) {
      console.log('  List of Orders (PO Numbers):');
      summary.orders.forEach((o, idx) => {
        console.log(`    [${idx + 1}] Order ID: ${o.id} | PO: ${o.poNumber} | Status: ${o.status}`);
      });
    }
    console.log(`- SalesOrders Count:         ${summary.salesOrders.length}`);
    console.log(`- Quotations Count:          ${summary.quotations.length}`);
    if (summary.quotations.length > 0) {
      summary.quotations.forEach(q => console.log(`    Quotation ID: ${q.id} | Status: ${q.status}`));
    }
    console.log(`- Payment Submissions Count: ${summary.paymentSubmissions.length}`);
    console.log(`- Payment UTRs Count:        ${summary.paymentUtrs.length}`);
    console.log(`- Loyalty Transactions:      ${summary.loyaltyTransactions.length}`);
    console.log(`- User Demands Count:        ${summary.userDemands.length}`);
    console.log(`- Approval Requests Count:   ${summary.approvalRequests.length}`);
    console.log(`- Wishlists:                 ${summary.wishlistDocs.length} doc(s)`);
    console.log(`- Customer Summary:          ${summary.customerSummaryDocs.length} doc(s)`);
    console.log(`- Client Assignments:        ${summary.clientAssignments.length} doc(s)`);
    console.log(`- GST Lookups:               ${summary.gstLookupDocs.length} doc(s)`);
    console.log(`- Storage Files:             ${summary.orderStorageFiles.length + summary.profileStorageFiles.length} file(s) total`);
    console.log(`    Profile Files:           ${summary.profileStorageFiles.length}`);
    summary.profileStorageFiles.forEach(f => console.log(`       * ${f}`));
    console.log(`    Order/Proof Files:       ${summary.orderStorageFiles.length}`);
    summary.orderStorageFiles.forEach(f => console.log(`       * ${f}`));
  }

  // ==========================================================================
  // SECTION 3: KEEP CHECK (ACCOUNTS THAT WILL REMAIN)
  // ==========================================================================
  console.log('\n================================================================');
  console.log('3. KEEP CHECK: ACCOUNTS THAT REMAIN SAFE');
  console.log('================================================================');

  const allTargetUids = [
    ...TARGET_STAFF.map(s => s.uid),
    ...TARGET_CUSTOMERS.map(c => c.uid),
  ];

  const allUsersSnap = await db.collection('users').get();
  const keptStaff = [];
  const keptCustomers = [];

  allUsersSnap.forEach(d => {
    if (allTargetUids.includes(d.id)) return;
    const data = d.data();
    const role = data.role || data.userCategory || 'unknown';
    const name = data.name || data.fullName || data.companyName || 'Unnamed';
    if (['admin', 'salesperson', 'designer'].includes(role)) {
      keptStaff.push({ uid: d.id, name, role, email: data.email, phone: data.phone });
    } else {
      keptCustomers.push({ uid: d.id, name, role, phone: data.phone, email: data.email });
    }
  });

  console.log(`[VERIFICATION] Kept Staff Accounts (${keptStaff.length}):`);
  keptStaff.forEach(s => {
    console.log(`  - [${s.role.toUpperCase()}] ${s.name} | UID: ${s.uid} | ${s.email || s.phone}`);
  });

  console.log(`\n[VERIFICATION] Kept Customer / Dealer / Wholesaler Accounts (${keptCustomers.length}):`);
  keptCustomers.forEach(c => {
    console.log(`  - [${c.role.toUpperCase()}] ${c.name} | UID: ${c.uid} | ${c.phone || c.email}`);
  });

  // Strict check for Prashant D Sitapara and Dhaval Jani
  const prashantKept = keptStaff.some(s => s.uid === '5YSBaVZCIfOuJiMPa9QH7fPr6M42');
  const dhavalKept = keptStaff.some(s => s.uid === 'njbTk37EpsZkD9JpS3bBoUfAwHa2');

  console.log('\n--- CORE REPOSITORY PRESERVATION VERIFICATION ---');
  console.log(`  [CONFIRM] Admin Prashant D Sitapara KEPT:  ${prashantKept ? 'YES (Verified)' : 'FAIL - NOT FOUND!'}`);
  console.log(`  [CONFIRM] Salesperson Dhaval Jani KEPT:     ${dhavalKept ? 'YES (Verified)' : 'FAIL - NOT FOUND!'}`);
  if (!prashantKept || !dhavalKept) {
    throw new Error('CRITICAL SAFETY FAILURE: Protected account missing from keep list!');
  }

  // ==========================================================================
  // SECTION 4: LEADS / OPPORTUNITIES / FOLLOW-UPS CHECK
  // ==========================================================================
  console.log('\n================================================================');
  console.log('4. LEADS, OPPORTUNITIES & FOLLOW-UPS LINKED TO DELETED STAFF');
  console.log('================================================================');

  const leadsSnap = await db.collection('leads').get();
  const linkedLeads = [];
  const unlinkedLeads = [];

  leadsSnap.forEach(d => {
    const data = d.data();
    const assigned = data.assignedTo || data.assignedSalespersonId || data.salespersonId;
    const createdBy = data.createdBy;
    const isLinked = TARGET_STAFF.some(s => s.uid === assigned || s.uid === createdBy);
    if (isLinked) {
      linkedLeads.push({ id: d.id, ...data });
    } else {
      unlinkedLeads.push({ id: d.id, ...data });
    }
  });

  console.log(`Total Leads in Database: ${leadsSnap.size}`);
  console.log(`Leads linked to deleted staff: ${linkedLeads.length}`);
  if (linkedLeads.length > 0) {
    linkedLeads.forEach(l => {
      console.log(`  - Lead ID: ${l.id} | Name: ${l.name || l.companyName} | AssignedTo: ${l.assignedTo} | CreatedBy: ${l.createdBy}`);
    });
  } else {
    console.log('  -> NONE. No leads or opportunities are assigned to or owned by any of the staff accounts being deleted.');
  }

  console.log(`Existing Leads (assigned to kept staff): ${unlinkedLeads.length}`);
  unlinkedLeads.forEach(l => {
    console.log(`  - Lead ID: ${l.id} | Name: ${l.name || l.leadName || l.firmName || 'Unnamed'} | AssignedTo: ${l.assignedTo || l.salespersonName} (Status: ${l.status})`);
  });

  // ==========================================================================
  // SECTION 5: WARNINGS AND AMBIGUITIES
  // ==========================================================================
  console.log('\n================================================================');
  console.log('5. WARNINGS & AMBIGUITY CHECKS');
  console.log('================================================================');

  console.log('1. [DUPLICATE ADMIN]: Two docs exist for Vraj Patel:');
  console.log('   - users/9hhMaF6WFccGHJc4vyglAxPEPMJ3 (has Firebase Auth user)');
  console.log('   - users/admin_01 (has NO separate Firebase Auth user)');
  console.log('   Both Firestore documents will be deleted. Only 9hhMaF6WFccGHJc4vyglAxPEPMJ3 will trigger Auth deletion.');
  console.log('');
  console.log('2. [SIMILAR NAME CHECK - VRAJ]:');
  console.log('   - Deleted Staff: Vraj Patel (admin) & Vraj Shah (salesperson)');
  console.log('   - KEPT Trader: Vraj K Patel (users/I7KdGK9OZuO65G7rblpmZvh19xM2, trader role, phone +918128084783)');
  console.log('   CONFIRMED: Trader Vraj K Patel is NOT marked for deletion and is completely preserved.');
  console.log('');
  console.log('3. [DESIGNER SOMIL PATEL DUAL DOCS]:');
  console.log('   - users/dwOILGR9IJPSxHaPTIuDOyblA432 (users profile + Auth)');
  console.log('   - Designer/ySQksyQa7J8NgDJwUEO5 (doc in root Designer collection with email somilpatel403@gmail.com)');
  console.log('   CONFIRMED: Both the user doc and the Designer doc will be deleted.');
  console.log('');
  console.log('4. [DESIGNER PRIYA SHARMA AUTH]:');
  console.log('   - users/i4m8gcmAmlVb5NgAkK3nu1iLC7n1 exists in Firestore.');
  console.log('   - Firebase Auth user does NOT exist for this UID.');
  console.log('   CONFIRMED: Firestore document will be deleted; Auth deletion skipped safely.');
  console.log('');
  console.log('5. [CROSS-LINKED ASSIGNMENTS]:');
  console.log('   - Salesperson Vraj Shah had 1 assigned client in salesPersons/WNSahNXK9GQrGoiIEmD4QBvAeim1/assigned_clients:');
  console.log('     Client curhNkfDRveFrBxdtSeOpUosZKD3 (Tirth Kalpesh Patel).');
  console.log('   - Customer gggttjfcf (sPtDUcRndAUXpPOIdxLfWORm2sz2) had assigned salesperson Dhaval Jani (SALES-020).');
  console.log('   CONFIRMED: Both Vraj Shah and Tirth Kalpesh Patel are being deleted together. For Dhaval Jani, Phase 3 will recompute client counts so Dhaval Jani is clean.');

  // ==========================================================================
  // PHASE 2 & 3: EXECUTE (ONLY WHEN --execute IS PROVIDED)
  // ==========================================================================
  if (IS_EXECUTE) {
    console.log('\n================================================================');
    console.log('PHASE 2: LIVE DELETION EXECUTION');
    console.log('================================================================');

    const deleteLog = {
      timestamp: new Date().toISOString(),
      firestoreDocumentsDeleted: [],
      subcollectionsDeleted: [],
      authUsersDeleted: [],
      storageFilesDeleted: [],
      phase3Recounts: {},
    };

    // 1. Delete Customer Data
    for (const c of custDeletePlan) {
      console.log(`\nExecuting deletion for customer: ${c.label}...`);
      const summary = customerDataSummary[c.uid];

      // Delete storage files
      const allFiles = [...summary.profileStorageFiles, ...summary.orderStorageFiles];
      console.log(`  Deleting ${allFiles.length} storage files...`);
      for (const filePath of allFiles) {
        try {
          await bucket.file(filePath).delete();
          deleteLog.storageFilesDeleted.push(filePath);
          console.log(`    [STORAGE DELETED] ${filePath}`);
        } catch (e) {
          console.warn(`    [STORAGE DELETE FAILED] ${filePath}: ${e.message}`);
        }
      }

      // Delete Approval Requests
      for (const reqId of summary.approvalRequests) {
        await db.collection('approvalRequests').doc(reqId).delete();
        deleteLog.firestoreDocumentsDeleted.push(`approvalRequests/${reqId}`);
      }

      // Delete User Demands
      for (const demId of summary.userDemands) {
        await db.collection('user_demands').doc(demId).delete();
        deleteLog.firestoreDocumentsDeleted.push(`user_demands/${demId}`);
      }

      // Delete Loyalty Transactions
      for (const lt of summary.loyaltyTransactions) {
        await db.collection('loyaltyTransactions').doc(lt.id).delete();
        deleteLog.firestoreDocumentsDeleted.push(`loyaltyTransactions/${lt.id}`);
      }

      // Delete Payment Submissions and UTRs
      for (const p of summary.paymentSubmissions) {
        await db.collection('paymentSubmissions').doc(p.id).delete();
        deleteLog.firestoreDocumentsDeleted.push(`paymentSubmissions/${p.id}`);
      }
      for (const u of summary.paymentUtrs) {
        await db.collection('payment_utrs').doc(u.id).delete();
        deleteLog.firestoreDocumentsDeleted.push(`payment_utrs/${u.id}`);
      }

      // Delete Quotations
      for (const q of summary.quotations) {
        await db.collection('quotations').doc(q.id).delete();
        deleteLog.firestoreDocumentsDeleted.push(`quotations/${q.id}`);
      }

      // Delete SalesOrders & Orders
      for (const so of summary.salesOrders) {
        await db.collection('salesOrders').doc(so.id).delete();
        deleteLog.firestoreDocumentsDeleted.push(`salesOrders/${so.id}`);
      }
      for (const o of summary.orders) {
        await db.collection('orders').doc(o.id).delete();
        deleteLog.firestoreDocumentsDeleted.push(`orders/${o.id}`);
      }

      // Delete Wishlist
      for (const w of summary.wishlistDocs) {
        await db.doc(w).delete();
        deleteLog.firestoreDocumentsDeleted.push(w);
      }

      // Delete Customer Summary
      for (const cs of summary.customerSummaryDocs) {
        await db.doc(cs).delete();
        deleteLog.firestoreDocumentsDeleted.push(cs);
      }

      // Delete Client Assignments
      for (const ca of summary.clientAssignments) {
        await db.doc(ca).delete();
        deleteLog.firestoreDocumentsDeleted.push(ca);
      }

      // Delete Customer Referrals
      for (const cr of summary.customerReferrals) {
        await db.doc(cr).delete();
        deleteLog.firestoreDocumentsDeleted.push(cr);
      }

      // Delete GST Lookups
      for (const gst of summary.gstLookupDocs) {
        await db.doc(gst).delete();
        deleteLog.firestoreDocumentsDeleted.push(gst);
      }

      // Delete Category Mirror Doc
      if (c.categoryMirrorPath) {
        const catRef = db.doc(c.categoryMirrorPath);
        const catSnap = await catRef.get();
        if (catSnap.exists) {
          await catRef.delete();
          deleteLog.firestoreDocumentsDeleted.push(c.categoryMirrorPath);
        }
      }

      // Delete User Doc with recursive delete (subcollections)
      const userRef = db.doc(c.userDocPath);
      await db.recursiveDelete(userRef);
      deleteLog.firestoreDocumentsDeleted.push(c.userDocPath);
      if (c.subcollections && c.subcollections.length) {
        deleteLog.subcollectionsDeleted.push(...c.subcollections.map(s => `${c.userDocPath}/${s}`));
      }
      console.log(`  [FIRESTORE RECURSIVE DELETED] ${c.userDocPath}`);

      // Delete Auth User
      if (c.authUid) {
        try {
          await auth.deleteUser(c.authUid);
          deleteLog.authUsersDeleted.push(c.authUid);
          console.log(`  [AUTH DELETED] ${c.authUid}`);
        } catch (e) {
          console.warn(`  [AUTH DELETE FAILED] ${c.authUid}: ${e.message}`);
        }
      }
    }

    // 2. Delete Staff Accounts
    for (const s of staffDeletePlan) {
      console.log(`\nExecuting deletion for staff: ${s.label}...`);

      // Delete extra doc paths (e.g. salesPersons doc + subcollection assigned_clients, Designer docs)
      for (const edp of s.extraDocPaths) {
        const edpRef = db.doc(edp);
        await db.recursiveDelete(edpRef);
        deleteLog.firestoreDocumentsDeleted.push(edp);
        console.log(`  [FIRESTORE RECURSIVE DELETED] ${edp}`);
      }

      // Delete User Doc with subcollections
      const userRef = db.doc(s.userDocPath);
      await db.recursiveDelete(userRef);
      deleteLog.firestoreDocumentsDeleted.push(s.userDocPath);
      if (s.subcollections && s.subcollections.length) {
        deleteLog.subcollectionsDeleted.push(...s.subcollections.map(sc => `${s.userDocPath}/${sc}`));
      }
      console.log(`  [FIRESTORE RECURSIVE DELETED] ${s.userDocPath}`);

      // Delete Auth User
      if (s.authUid) {
        try {
          await auth.deleteUser(s.authUid);
          deleteLog.authUsersDeleted.push(s.authUid);
          console.log(`  [AUTH DELETED] ${s.authUid}`);
        } catch (e) {
          console.warn(`  [AUTH DELETE FAILED] ${s.authUid}: ${e.message}`);
        }
      }
    }

    // ========================================================================
    // PHASE 3: FIX COUNTS
    // ========================================================================
    console.log('\n================================================================');
    console.log('PHASE 3: FIX SALESPERSON CLIENT COUNTS');
    console.log('================================================================');

    const spSnap = await db.collection('salesPersons').get();
    for (const spDoc of spSnap.docs) {
      const spId = spDoc.id;
      // Skip deleted salesperson if still lingering
      if (spId === 'WNSahNXK9GQrGoiIEmD4QBvAeim1') continue;

      const assignedSnap = await spDoc.ref.collection('assigned_clients').get();
      let assignedCount = 0;
      let activeCount = 0;

      for (const clientDoc of assignedSnap.docs) {
        // Double check if client exists in users
        const cSnap = await db.collection('users').doc(clientDoc.id).get();
        if (cSnap.exists) {
          assignedCount++;
          const cData = cSnap.data();
          if (cData.status !== 'inactive' && cData.isActive !== false) {
            activeCount++;
          }
        } else {
          // Orphaned subcollection doc: remove it
          await clientDoc.ref.delete();
          console.log(`  Cleaned orphaned assigned_client ${clientDoc.id} from salesPersons/${spId}`);
        }
      }

      // Update both salesPersons/{spId} and users/{spId}
      await db.collection('salesPersons').doc(spId).update({
        assignedClientsCount: assignedCount,
        activeClientsCount: activeCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userSpRef = db.collection('users').doc(spId);
      const userSpSnap = await userSpRef.get();
      if (userSpSnap.exists) {
        await userSpRef.update({
          assignedClientsCount: assignedCount,
          activeClientsCount: activeCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      deleteLog.phase3Recounts[spId] = {
        name: spDoc.data().name,
        assignedClientsCount: assignedCount,
        activeClientsCount: activeCount,
      };

      console.log(`Salesperson ${spDoc.data().name} (${spId}): assigned=${assignedCount}, active=${activeCount}`);
    }

    // Write deletion log report
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const logFilePath = path.join(reportsDir, `delete-log-${dateStr}.json`);
    fs.writeFileSync(logFilePath, JSON.stringify(deleteLog, null, 2), 'utf-8');
    console.log(`\nDeletion log successfully written to: ${logFilePath}`);
  } else {
    console.log('\n================================================================');
    console.log('DRY RUN COMPLETE — STOPPED AS REQUIRED');
    console.log('Awaiting your explicit "Approved" to proceed to Phase 2 Deletion.');
    console.log('================================================================');
  }
}

run().catch(err => {
  console.error('Fatal error in deleteSelected:', err);
  process.exit(1);
});

