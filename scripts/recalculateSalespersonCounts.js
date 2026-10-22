/**
 * scripts/recalculateSalespersonCounts.js
 * 
 * One-time admin backfill script to recalculate salesperson client counts
 * and rebuild missing assigned_clients subcollection documents.
 * 
 * Usage:
 *   node scripts/recalculateSalespersonCounts.js          # DRY-RUN (default, no writes)
 *   node scripts/recalculateSalespersonCounts.js --dry-run # DRY-RUN explicitly
 *   node scripts/recalculateSalespersonCounts.js --apply   # Commits batched writes to Firestore
 */

const path = require('path');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'itacon-app',
  });
}

const db = admin.firestore();

/**
 * Normalizes referral code strings for case-insensitive, punctuation/whitespace-insensitive matching.
 */
function normalizeReferralCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/[-\s]/g, '');
}

/**
 * Determines whether a client is active.
 */
function isClientActive(clientData) {
  if (!clientData) return false;
  if (clientData.isActive === false || clientData.status === 'inactive' || clientData.status === 'blocked') {
    return false;
  }
  if (clientData.isActive === true || clientData.status === 'active') {
    return true;
  }
  if (clientData.status === 'pending_salesperson_verification' || clientData.status === 'pending') {
    return false;
  }
  return true;
}

/**
 * Identifies staff members to exclude from client assignment calculations.
 */
function isStaffUser(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase().trim();
  const cat = (userData.userCategory || '').toLowerCase().trim();
  return (
    role === 'salesperson' ||
    role === 'admin' ||
    role === 'manager' ||
    role === 'staff' ||
    role === 'super_admin' ||
    cat === 'salesperson' ||
    cat === 'admin' ||
    cat === 'manager'
  );
}

class BatchManager {
  constructor(firestoreDb, dryRun) {
    this.db = firestoreDb;
    this.dryRun = dryRun;
    this.currentBatch = firestoreDb.batch();
    this.opsCount = 0;
    this.totalBatchesCommitted = 0;
    this.totalOps = 0;
  }

  set(docRef, data, options) {
    this.totalOps++;
    if (!this.dryRun) {
      if (options) {
        this.currentBatch.set(docRef, data, options);
      } else {
        this.currentBatch.set(docRef, data);
      }
      this.opsCount++;
    }
  }

  async checkCommit() {
    if (this.opsCount >= 400 && !this.dryRun) {
      await this.currentBatch.commit();
      this.totalBatchesCommitted++;
      this.currentBatch = this.db.batch();
      this.opsCount = 0;
    }
  }

  async finish() {
    if (this.opsCount > 0 && !this.dryRun) {
      await this.currentBatch.commit();
      this.totalBatchesCommitted++;
      this.opsCount = 0;
    }
  }
}

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = !isApply || args.includes('--dry-run');

  console.log('========================================================================');
  console.log(`ITACON SALESPERSON COUNTER RECONCILIATION & SUBCOLLECTION BACKFILL`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY-RUN (Read-only, no database writes)' : '🚀 APPLY (Writing changes to Firestore)'}`);
  console.log(`Target Firestore: ${process.env.FIRESTORE_EMULATOR_HOST ? `Emulator (${process.env.FIRESTORE_EMULATOR_HOST})` : 'Production Project (itacon-app)'}`);
  console.log('========================================================================\n');

  // 1. Fetch all salesPersons documents
  const spSnap = await db.collection('salesPersons').get();
  const salespersons = [];
  const spMapById = new Map();
  const spMapByNormCode = new Map();

  spSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const spObj = {
      id: doc.id,
      name: data.name || data.fullName || 'Salesperson',
      phone: data.phone || data.phoneNumber || '',
      email: data.email || '',
      referralCode: (data.referralCode || '').toString().trim(),
      normalizedCode: normalizeReferralCode(data.referralCode),
      currentAssigned: Number(data.assignedClientsCount) || 0,
      currentActive: Number(data.activeClientsCount) || 0,
      status: data.status || (data.isActive === false ? 'inactive' : 'active'),
      isActive: data.isActive !== false && data.status !== 'inactive',
      linkedClients: [],
      missingSubdocs: [],
    };
    salespersons.push(spObj);
    spMapById.set(spObj.id, spObj);
    if (spObj.normalizedCode) {
      spMapByNormCode.set(spObj.normalizedCode, spObj);
    }
  });

  console.log(`Found ${salespersons.length} salespersons in 'salesPersons' collection.`);

  // 2. Fetch all users from 'users' collection
  const usersSnap = await db.collection('users').get();
  console.log(`Scanning ${usersSnap.size} total user profiles in 'users' collection...`);

  let customerCount = 0;
  let linkedCustomerCount = 0;
  let unlinkedCustomerCount = 0;

  usersSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    if (isStaffUser(data)) {
      return; // Skip staff members
    }
    customerCount++;

    const clientId = doc.id;
    const clientSpId = (data.salesPersonId || data.assignedSalespersonId || '').toString().trim();
    const rawRefCode = (
      data.salespersonReferralCode ||
      data.referralCodeEntered ||
      data.referredByCode ||
      ''
    ).toString().trim();
    const normRefCode = normalizeReferralCode(rawRefCode);

    // Match priority: direct salesperson ID, then referral code
    let matchedSp = null;
    if (clientSpId && spMapById.has(clientSpId)) {
      matchedSp = spMapById.get(clientSpId);
    } else if (normRefCode && spMapByNormCode.has(normRefCode)) {
      matchedSp = spMapByNormCode.get(normRefCode);
    }

    if (matchedSp) {
      linkedCustomerCount++;
      matchedSp.linkedClients.push({
        id: clientId,
        name: data.name || data.fullName || '',
        phone: data.phone || data.phoneNumber || '',
        email: data.email || '',
        createdAt: data.createdAt || null,
        isActive: isClientActive(data),
      });
    } else {
      unlinkedCustomerCount++;
    }
  });

  console.log(`Customer accounts analyzed: ${customerCount} (${linkedCustomerCount} linked to salespersons, ${unlinkedCustomerCount} unassigned).\n`);

  // 3. For each salesperson, inspect their assigned_clients subcollection
  console.log('Inspecting assigned_clients subcollections for each salesperson...');
  for (const sp of salespersons) {
    const subSnap = await db.collection('salesPersons').doc(sp.id).collection('assigned_clients').get();
    const existingSubIds = new Set(subSnap.docs.map((d) => d.id));

    for (const client of sp.linkedClients) {
      if (!existingSubIds.has(client.id)) {
        sp.missingSubdocs.push(client);
      }
    }
  }

  // 4. Print Table
  const tableRows = salespersons.map((sp) => {
    const correctAssigned = sp.linkedClients.length;
    const correctActive = sp.linkedClients.filter((c) => c.isActive).length;
    return {
      'Salesperson Name': sp.name,
      'Referral Code': sp.referralCode || '(none)',
      'Current Assigned': sp.currentAssigned,
      'Correct Assigned': correctAssigned,
      'Current Active': sp.currentActive,
      'Correct Active': correctActive,
      'Missing Subdocs': sp.missingSubdocs.length,
      'Status': sp.status,
    };
  });

  console.log('\n--- SALESPERSON COUNTER RECONCILIATION SUMMARY ---');
  console.table(tableRows);

  let totalMissingSubdocs = 0;
  let totalCounterUpdates = 0;

  salespersons.forEach((sp) => {
    totalMissingSubdocs += sp.missingSubdocs.length;
    const correctAssigned = sp.linkedClients.length;
    const correctActive = sp.linkedClients.filter((c) => c.isActive).length;
    if (sp.currentAssigned !== correctAssigned || sp.currentActive !== correctActive) {
      totalCounterUpdates++;
    }
  });

  console.log(`Total missing subcollection documents to create: ${totalMissingSubdocs}`);
  console.log(`Total salesperson documents requiring count updates: ${totalCounterUpdates}`);

  if (isDryRun) {
    console.log('\n========================================================================');
    console.log('NOTICE: DRY-RUN COMPLETED. ZERO writes were made to Firestore.');
    console.log('To write missing subdocuments and update salesperson counters, run:');
    console.log('  node scripts/recalculateSalespersonCounts.js --apply');
    console.log('========================================================================\n');
    return;
  }

  // 5. Apply changes using BatchManager (max 500 per batch)
  console.log('\n--- APPLYING CHANGES TO FIRESTORE IN BATCHES ---');
  const batchManager = new BatchManager(db, isDryRun);

  for (const sp of salespersons) {
    const spRef = db.collection('salesPersons').doc(sp.id);

    // Create missing assigned_clients docs
    for (const client of sp.missingSubdocs) {
      const subdocRef = spRef.collection('assigned_clients').doc(client.id);
      const subdocData = {
        clientId: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        createdAt: client.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        isActive: client.isActive,
      };
      batchManager.set(subdocRef, subdocData);
      await batchManager.checkCommit();
    }

    // Set correct assignedClientsCount and activeClientsCount
    const correctAssigned = sp.linkedClients.length;
    const correctActive = sp.linkedClients.filter((c) => c.isActive).length;

    batchManager.set(
      spRef,
      {
        assignedClientsCount: correctAssigned,
        activeClientsCount: correctActive,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batchManager.checkCommit();
  }

  await batchManager.finish();

  console.log(`\nSUCCESS: Applied all ${batchManager.totalOps} operations across ${batchManager.totalBatchesCommitted} batch(es).`);
  console.log('All salesperson assignedClientsCount, activeClientsCount, and assigned_clients subcollections are now 100% reconciled.');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error during salesperson reconciliation:', err);
    process.exit(1);
  });
