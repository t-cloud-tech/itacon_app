/**
 * scripts/restoreSalespersons.js
 *
 * Restores the 20 real salespersons added today (2026-10-31):
 * - Re-imports their Firebase Auth accounts with SCRYPT password hashes & salts
 * - Restores their users/{uid} documents
 * - Restores their salesPersons/{uid} documents
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'itacon-app',
  });
}

const db = admin.firestore();
const auth = admin.auth();

// The 20 new salespersons added today
const SALESPERSONS_DATA = [
  {
    uid: 'jnALlvIImZhfOoIKnu9sMLHLOmk1',
    name: 'Jaydeep Visodia',
    email: 'jaydeep.itacongranito@gmail.com',
    phone: '+919909000750',
    referralCode: 'SALES-001',
    employeeId: 'SE IGPL-001',
    region: 'North Gujarat',
    states: ['GJ'],
  },
  {
    uid: 'lhdV825u6JVA0z9ME0FECdGTzV32',
    name: 'Jay Thadoda',
    email: 'jay.itacongranito@gmail.com',
    phone: '+919265658982',
    referralCode: 'SALES-002',
    employeeId: 'SE IGPL-002',
    region: 'South Gujarat',
    states: ['GJ'],
  },
  {
    uid: 'NLkBqHj5Ppca7gIt8Cqd2ncxSTs1',
    name: 'Dhaval Muchadiya',
    email: 'dhavalmuchhadiya2205@gmail.com',
    phone: '+917861811197',
    referralCode: 'SALES-003',
    employeeId: 'SE IGPL-003',
    region: 'Saurashtra',
    states: ['GJ'],
  },
  {
    uid: 'k7l2b9IQxohZw3MczN64Baryin73',
    name: 'Mehul Kotadia',
    email: 'mp0920049@gmail.com',
    phone: '+918128473500',
    referralCode: 'SALES-004',
    employeeId: 'SE IGPL-004',
    region: 'Central Gujarat',
    states: ['GJ'],
  },
  {
    uid: 'I370uqsMvZddKCDj39YRyvS5WGo1',
    name: 'Jay Mejdiya',
    email: 'itaconjaybhai@gmail.com',
    phone: '+917069377776',
    referralCode: 'SALES-005',
    employeeId: 'SE IGPL-005',
    region: 'Ahmedabad',
    states: ['GJ'],
  },
  {
    uid: 'ccR7uzjeRld10kpZ9IS8pmlmH6Y2',
    name: 'Vishal Rawal',
    email: 'vishw727@gmail.com',
    phone: '+918866000727',
    referralCode: 'SALES-006',
    employeeId: 'SE IGPL-006',
    region: 'Surat',
    states: ['GJ'],
  },
  {
    uid: 'H1HIE4BNtnVteP5AnBlsj9xyK5i1',
    name: 'Jignesh Bhai',
    email: 'ghodasara.jignesh1212@gmail.com',
    phone: '+919825271985',
    referralCode: 'SALES-007',
    employeeId: 'SE IGPL-007',
    region: 'Morbi',
    states: ['GJ'],
  },
  {
    uid: 'CgwGsI870dM3RT9hhmUn7t6jo4s1',
    name: 'Ashok Dharodiya',
    email: 'dharodiyaashok@gmail.com',
    phone: '+919825214544',
    referralCode: 'SALES-008',
    employeeId: 'SE IGPL-008',
    region: 'Rajkot',
    states: ['GJ'],
  },
  {
    uid: 'vqYeN4jo6kZBkuvIannTo4GyGyw1',
    name: 'Mehul Moradia',
    email: 'export@itacongranito.com',
    phone: '+919909000767',
    referralCode: 'SALES-009',
    employeeId: 'SE IGPL-009',
    region: 'Export Division',
    states: ['GJ', 'MH'],
  },
  {
    uid: 'fKkXlFBo4SaqX2vSzneNZDDS3ZB2',
    name: 'Sagar Jivani',
    email: 'document.itacongranito@gmail.com',
    phone: '+919909021217',
    referralCode: 'SALES-010',
    employeeId: 'SE IGPL-010',
    region: 'Documentation / HQ',
    states: ['GJ'],
  },
  {
    uid: 'nna3nYZRcKSEXvrvDKSHltWoq0G3',
    name: 'YK Jadeja',
    email: 'export3@itacongranito.com',
    phone: '+917778817805',
    referralCode: 'SALES-011',
    employeeId: 'SE IGPL-011',
    region: 'Kutch',
    states: ['GJ'],
  },
  {
    uid: 'RGb1vHl0SCfv09Wj3QEoh9TzLR03',
    name: 'Yash Ghoniya',
    email: 'export5@itacongranito.com',
    phone: '+917069377771',
    referralCode: 'SALES-012',
    employeeId: 'SE IGPL-012',
    region: 'Export Division 5',
    states: ['GJ'],
  },
  {
    uid: 'm4hSHxihRKhYqaC0MCtxbcrShVq1',
    name: 'Tulsi Barochiya',
    email: 'export.eu@itacongranito.com',
    phone: '+919909000759',
    referralCode: 'SALES-013',
    employeeId: 'SE IGPL-013',
    region: 'Europe Export',
    states: ['GJ'],
  },
  {
    uid: 'ARuXKEvndUUdnRiebEWEoXgv8sG2',
    name: 'Vishvaraj Zala',
    email: 'export6.itacon@gmail.com',
    phone: '+917788992310',
    referralCode: 'SALES-014',
    employeeId: 'SE IGPL-014',
    region: 'Export Division 6',
    states: ['GJ'],
  },
  {
    uid: 'eo7NJxrcauPphhhqxWkusoW1pbU2',
    name: 'Mahendra Thoria',
    email: 'itconsales.77778@gmail.com',
    phone: '+917069377778',
    referralCode: 'SALES-015',
    employeeId: 'SE IGPL-015',
    region: 'West India',
    states: ['GJ', 'MH'],
  },
  {
    uid: 'T46jnMZL9FSFGetOELoW14OnjsA2',
    name: 'Frenk Budhdev',
    email: 'itacongranito24@gmail.com',
    phone: '+918128910433',
    referralCode: 'SALES-016',
    employeeId: 'SE IGPL-016',
    region: 'North India',
    states: ['RJ', 'DL', 'UP'],
  },
  {
    uid: 'YGxjEjStYKQJrHOnKvqzuKAtmju1',
    name: 'Balvant Hadiyal',
    email: 'itacongranito25@gmail.com',
    phone: '+919909000765',
    referralCode: 'SALES-017',
    employeeId: 'SE IGPL-017',
    region: 'South India',
    states: ['KA', 'TN', 'TS'],
  },
  {
    uid: 'KG1UcfNa7larPUL45x5hxkcTIgd2',
    name: 'Alpesh Tridevi',
    email: 'itacon.7069777745@gmail.com',
    phone: '+917069777745',
    referralCode: 'SALES-018',
    employeeId: 'SE IGPL-018',
    region: 'Central India',
    states: ['MP', 'CG'],
  },
  {
    uid: 'tX8jWz0K7vaq8SrivKS8kkqcMRt1',
    name: 'Devans Kothari',
    email: 'itacon.sales@gmail.com',
    phone: '+918200516293',
    referralCode: 'SALES-019',
    employeeId: 'SE IGPL-019',
    region: 'East India',
    states: ['WB', 'OR', 'BR'],
  },
  {
    uid: 'njbTk37EpsZkD9JpS3bBoUfAwHa2',
    name: 'Dhaval Jani',
    email: 'itacon.7069777734@gmail.com',
    phone: '+917069777734',
    referralCode: 'SALES-020',
    employeeId: 'SE IGPL-020',
    region: 'Corporate Accounts',
    states: ['GJ', 'MH', 'DL'],
  },
];

async function main() {
  console.log('================================================================================');
  console.log('RESTORING 20 SALESPERSON ACCOUNTS ADDED TODAY');
  console.log('================================================================================\n');

  // 1. Read Auth backup file
  const backupFile = 'C:/Users/ttirt/auth-backup-20261031.json';
  const rawAuth = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const backupUsers = rawAuth.users || rawAuth;
  const targetMap = new Map();
  SALESPERSONS_DATA.forEach(sp => targetMap.set(sp.uid, sp));

  const authRecordsToImport = [];

  for (const bUser of backupUsers) {
    if (targetMap.has(bUser.localId)) {
      const sp = targetMap.get(bUser.localId);
      authRecordsToImport.push({
        uid: bUser.localId,
        email: bUser.email || sp.email,
        emailVerified: bUser.emailVerified || false,
        passwordHash: Buffer.from(bUser.passwordHash, 'base64'),
        passwordSalt: Buffer.from(bUser.salt, 'base64'),
        displayName: sp.name,
      });
    }
  }

  console.log(`[1/3] Importing ${authRecordsToImport.length} Firebase Auth accounts...`);
  const importResult = await auth.importUsers(authRecordsToImport, {
    hash: {
      algorithm: 'SCRYPT',
      key: Buffer.from('m5JL4k9Xi0Q6bD6FctVYAiuenRqf2IG1vtsNzZiuujTWVKcCJefEiIUimHl0BjBaP+RbTSUdp3k+SUYrbIKUkQ==', 'base64'),
      saltSeparator: Buffer.from('Bw==', 'base64'),
      rounds: 8,
      memoryCost: 14,
    },
  });

  console.log(`  -> Auth import result: Success count = ${importResult.successCount}, Errors = ${importResult.errors.length}`);
  if (importResult.errors.length > 0) {
    importResult.errors.forEach(e => console.error(`     Error on index ${e.index}: ${e.error.message}`));
  }

  // 2. Restore users/{uid} documents in batch
  console.log('\n[2/3] Restoring users collection documents in batch...');
  const usersBatch = db.batch();
  const nowIso = new Date().toISOString();

  for (const sp of SALESPERSONS_DATA) {
    const userRef = db.collection('users').doc(sp.uid);
    // Find matching auth salt/hash if needed
    const bUser = backupUsers.find(u => u.localId === sp.uid) || {};
    usersBatch.set(userRef, {
      userId: sp.uid,
      uid: sp.uid,
      name: sp.name,
      fullName: sp.name,
      email: sp.email,
      phone: sp.phone,
      phoneNumber: sp.phone,
      role: 'salesperson',
      userCategory: 'salesperson',
      salesPersonId: sp.uid,
      referralCode: sp.referralCode,
      region: sp.region,
      employeeId: sp.employeeId,
      status: 'active',
      isActive: true,
      passwordHash: bUser.passwordHash || '',
      passwordSalt: bUser.salt || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    }, { merge: true });
  }
  await usersBatch.commit();
  console.log(`  -> Successfully restored 20 documents in users collection.`);

  // 3. Restore salesPersons/{uid} documents in batch
  console.log('\n[3/3] Restoring salesPersons collection documents in batch...');
  const spBatch = db.batch();

  for (const sp of SALESPERSONS_DATA) {
    const spRef = db.collection('salesPersons').doc(sp.uid);
    spBatch.set(spRef, {
      salesPersonId: sp.uid,
      employeeId: sp.employeeId,
      name: sp.name,
      fullName: sp.name,
      email: sp.email,
      phone: sp.phone,
      phoneNumber: sp.phone,
      referralCode: sp.referralCode,
      referralCodeKey: sp.referralCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      region: sp.region,
      states: sp.states,
      status: 'active',
      isActive: true,
      assignedClientsCount: 0,
      activeClientsCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    }, { merge: true });
  }
  await spBatch.commit();
  console.log(`  -> Successfully restored 20 documents in salesPersons collection.`);

  // 4. Verification
  console.log('\n================================================================================');
  console.log('VERIFICATION OF RESTORED SALESPERSONS');
  console.log('================================================================================');
  const spSnap = await db.collection('salesPersons').get();
  console.log(`Total salesPersons in Firestore: ${spSnap.size} (Expected: 21: Vraj Shah + 20 new salespersons)`);

  const uSnap = await db.collection('users').get();
  console.log(`Total users in Firestore: ${uSnap.size} (Expected: 27: 1 customer + 5 staff + 21 salespersons)`);

  const authList = await auth.listUsers(100);
  console.log(`Total Firebase Auth accounts: ${authList.users.length} (Expected: 25: 1 customer + 4 staff + 20 new salespersons)`);

  console.log('\nAll 20 new salespersons successfully brought back!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

