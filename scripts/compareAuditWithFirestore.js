const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}
const db = admin.firestore();

async function compare() {
  const AUDIT_FILE = path.join(__dirname, '..', 'image_cleanup_final_303', 'audit', 'audit_303_products.json');
  const auditData = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  const auditIds = new Set(auditData.map(d => d.productId || d.id));

  console.log(`Audit file has ${auditIds.size} unique IDs.`);

  const prodSnap = await db.collection('products').get();
  const firestoreIds = new Set();
  prodSnap.forEach(d => firestoreIds.add(d.id));

  console.log(`Firestore products collection has ${firestoreIds.size} unique IDs.`);

  // Find in audit but not in firestore
  const inAuditNotInFirestore = [...auditIds].filter(id => !firestoreIds.has(id));
  console.log(`In audit but NOT in firestore (${inAuditNotInFirestore.length}):`, inAuditNotInFirestore);

  // Find in firestore but not in audit
  const inFirestoreNotInAudit = [...firestoreIds].filter(id => !auditIds.has(id));
  console.log(`In firestore but NOT in audit (${inFirestoreNotInAudit.length}):`, inFirestoreNotInAudit);
}

compare().catch(console.error);
