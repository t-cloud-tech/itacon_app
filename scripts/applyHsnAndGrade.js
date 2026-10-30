/**
 * scripts/applyHsnAndGrade.js
 *
 * Bulk HSN Code & Product Grade Assignment for ITACON GRANITO
 *
 * 1. Verifies/creates config/hsnCodes.
 * 2. Creates/verifies config/productGrades.
 * 3. Reads dynamic configuration from both config documents (no hardcoded codes/grades).
 * 4. Backs up current values of (hsnCode, hsnCategory, grade, gradeLabel) to scripts/backup/.
 * 5. Applies HSN code, HSN category, Grade, and GradeLabel to products and tiles in batches <= 400.
 * 6. Generates detailed verification report.
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');
const {
  FIELDS_USED_FOR_TYPE_DETECTION,
  resolveHsnCategory,
  resolveProductGrade,
} = require('../functions/hsnMapping');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'itacon-app' });
}
const db = admin.firestore();

async function main() {
  console.log('================================================================');
  console.log('ITACON GRANITO — Bulk Product HSN & Grade Assignment');
  console.log('================================================================');

  // =========================================================================
  // STEP 1: Verify / Initialize config/hsnCodes
  // =========================================================================
  console.log('\n[1/6] Verifying config/hsnCodes in Firestore...');
  const expectedHsn = {
    vitrified: '69072100',
    ceramicFloor: '69072200',
    ceramicWall: '69072300',
    tileAdhesive: '32149090',
  };

  const hsnDocRef = db.collection('config').doc('hsnCodes');
  const hsnDocSnap = await hsnDocRef.get();
  let hsnConfig = {};

  if (!hsnDocSnap.exists) {
    console.log('  -> config/hsnCodes does not exist. Creating it...');
    hsnConfig = {
      ...expectedHsn,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'setup-script',
    };
    await hsnDocRef.set(hsnConfig);
    console.log('  -> Created config/hsnCodes with target values.');
  } else {
    hsnConfig = hsnDocSnap.data() || {};
    const changes = {};
    for (const [key, expectedVal] of Object.entries(expectedHsn)) {
      if (hsnConfig[key] !== expectedVal) {
        changes[key] = { from: hsnConfig[key], to: expectedVal };
      }
    }

    if (Object.keys(changes).length > 0) {
      console.log('  -> config/hsnCodes values differed or were missing:', changes);
      await hsnDocRef.update({
        ...expectedHsn,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'setup-script',
      });
      console.log('  -> Updated config/hsnCodes to target values.');
      hsnConfig = { ...hsnConfig, ...expectedHsn };
    } else {
      console.log('  -> config/hsnCodes exists with exact required values. Leaving untouched:');
      console.log('    ', {
        vitrified: hsnConfig.vitrified,
        ceramicFloor: hsnConfig.ceramicFloor,
        ceramicWall: hsnConfig.ceramicWall,
        tileAdhesive: hsnConfig.tileAdhesive,
      });
    }
  }

  // =========================================================================
  // STEP 2: Create / Verify config/productGrades
  // =========================================================================
  console.log('\n[2/6] Verifying/Creating config/productGrades in Firestore...');
  const expectedProductGrades = {
    grades: {
      PRE: 'Premium',
    },
    surfaceToGrade: {
      'high gloss polish': 'PRE',
      'glossy': 'PRE',
      'high gloss': 'PRE',
      'glossy / high gloss': 'PRE',
      'glo': 'PRE',
      'glossy ceramic': 'PRE',
    },
  };

  const gradeDocRef = db.collection('config').doc('productGrades');
  const gradeDocSnap = await gradeDocRef.get();
  let productGradesConfig = {};

  if (!gradeDocSnap.exists) {
    console.log('  -> config/productGrades does not exist. Creating it...');
    productGradesConfig = {
      ...expectedProductGrades,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'admin',
    };
    await gradeDocRef.set(productGradesConfig);
    console.log('  -> Created config/productGrades successfully.');
  } else {
    productGradesConfig = gradeDocSnap.data() || {};
    let needsUpdate = false;
    const currentSurfaces = productGradesConfig.surfaceToGrade || {};
    for (const [s, g] of Object.entries(expectedProductGrades.surfaceToGrade)) {
      if (currentSurfaces[s] !== g) {
        needsUpdate = true;
        break;
      }
    }
    if (!productGradesConfig.grades || productGradesConfig.grades.PRE !== 'Premium') {
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log('  -> Updating config/productGrades with full surfaceToGrade map...');
      await gradeDocRef.set({
        ...productGradesConfig,
        ...expectedProductGrades,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'admin',
      }, { merge: true });
      productGradesConfig = { ...productGradesConfig, ...expectedProductGrades };
      console.log('  -> config/productGrades updated.');
    } else {
      console.log('  -> config/productGrades already exists with required grades and surface mappings.');
    }
  }

  // Reload both config docs fresh from Firestore to guarantee we read from config docs (never hardcoded)
  const freshHsnSnap = await hsnDocRef.get();
  const freshGradeSnap = await gradeDocRef.get();
  const activeHsnConfig = freshHsnSnap.data();
  const activeGradeConfig = freshGradeSnap.data();

  // =========================================================================
  // STEP 3: Fetch all products and tiles collections
  // =========================================================================
  console.log('\n[3/6] Fetching products and tiles collections...');
  const productsSnap = await db.collection('products').get();
  const tilesSnap = await db.collection('tiles').get();

  const totalProducts = productsSnap.size;
  const totalTiles = tilesSnap.size;
  console.log(`Found ${totalProducts} products and ${totalTiles} tiles in Firestore.`);

  const tilesIdSet = new Set(tilesSnap.docs.map(d => d.id));

  // Determine surface field used in docs
  const surfaceFieldSample = productsSnap.docs.find(d => d.data().surface !== undefined);
  const finishFieldSample = productsSnap.docs.find(d => d.data().finish !== undefined);
  console.log(`Surface finish fields identified in documents: "surface" (${surfaceFieldSample ? 'present' : 'absent'}), "finish" (${finishFieldSample ? 'present' : 'absent'}). Primary field used: "surface".`);

  // =========================================================================
  // STEP 4: Pre-Write Backup of (hsnCode, hsnCategory, grade, gradeLabel)
  // =========================================================================
  console.log('\n[4/6] Creating pre-write backup in scripts/backup/...');
  const backupDir = path.join(__dirname, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `hsn_and_grade_backup_${timestamp}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);

  const backupData = {
    createdAt: new Date().toISOString(),
    totalProducts,
    totalTiles,
    products: productsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || d.productName || '',
        sku: d.sku || '',
        surface: d.surface || null,
        finish: d.finish || null,
        hsnCode: d.hsnCode || null,
        hsnCategory: d.hsnCategory || null,
        grade: d.grade || null,
        gradeLabel: d.gradeLabel || null,
      };
    }),
    tiles: tilesSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        hsnCode: d.hsnCode || null,
        hsnCategory: d.hsnCategory || null,
        grade: d.grade || null,
        gradeLabel: d.gradeLabel || null,
      };
    }),
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Backup saved to: ${backupFilePath}`);

  // =========================================================================
  // STEP 5: Evaluate products and prepare writes
  // =========================================================================
  console.log('\n[5/6] Evaluating products and preparing writes...');
  const stats = {
    total: totalProducts,
    hsnAssignedOrExisting: 0,
    hsnUnmapped: 0,
    gradeAssignedPRE: 0,
    gradeNoGrade: 0,
    productWrites: 0,
    tileWrites: 0,
  };

  const pendingWrites = []; // Array of { ref, payload, docId }

  for (const doc of productsSnap.docs) {
    const d = doc.data();
    const docId = doc.id;
    const updatePayload = {};

    // 1. HSN Code Evaluation
    if (d.hsnManualOverride !== true) {
      const category = resolveHsnCategory(d, docId);
      if (category) {
        const expectedHsnCode = activeHsnConfig[category];
        if (expectedHsnCode) {
          stats.hsnAssignedOrExisting++;
          if (d.hsnCode !== expectedHsnCode || d.hsnCategory !== category) {
            updatePayload.hsnCode = expectedHsnCode;
            updatePayload.hsnCategory = category;
          }
        }
      } else {
        stats.hsnUnmapped++;
      }
    }

    // 2. Grade Evaluation
    if (d.gradeManualOverride !== true) {
      const gradeResult = resolveProductGrade(d, activeGradeConfig);
      if (gradeResult) {
        stats.gradeAssignedPRE++;
        if (d.grade !== gradeResult.grade || d.gradeLabel !== gradeResult.gradeLabel) {
          updatePayload.grade = gradeResult.grade;
          updatePayload.gradeLabel = gradeResult.gradeLabel;
        }
      } else {
        stats.gradeNoGrade++;
      }
    }

    // Ensure ONLY the 4 permitted fields are ever written
    const allowedKeys = ['hsnCode', 'hsnCategory', 'grade', 'gradeLabel'];
    for (const k of Object.keys(updatePayload)) {
      if (!allowedKeys.includes(k)) {
        delete updatePayload[k];
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      pendingWrites.push({
        ref: doc.ref,
        payload: updatePayload,
        docId: `products/${docId}`,
      });
      stats.productWrites++;

      if (tilesIdSet.has(docId)) {
        pendingWrites.push({
          ref: db.collection('tiles').doc(docId),
          payload: updatePayload,
          docId: `tiles/${docId}`,
        });
        stats.tileWrites++;
      }
    }
  }

  // =========================================================================
  // STEP 6: Execute batched writes (max 400 per batch)
  // =========================================================================
  console.log(`\n[6/6] Executing ${pendingWrites.length} write operations in batches of 400...`);
  const BATCH_SIZE = 400;
  let batchCount = 0;

  for (let i = 0; i < pendingWrites.length; i += BATCH_SIZE) {
    const chunk = pendingWrites.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const write of chunk) {
      batch.update(write.ref, write.payload);
    }

    await batch.commit();
    batchCount++;
    console.log(`  Committed batch ${batchCount} (${chunk.length} operations)...`);
  }

  console.log('\n================================================================');
  console.log('EXECUTION COMPLETED SUCCESSFULLY');
  console.log('================================================================');

  console.log('\n--- Final Statistics Summary ---');
  console.log(`Total Products Evaluated:     ${stats.total}`);
  console.log(`Products with Valid HSN:      ${stats.hsnAssignedOrExisting}`);
  console.log(`Products UNMAPPED (HSN):      ${stats.hsnUnmapped}`);
  console.log(`Products Graded "PRE":        ${stats.gradeAssignedPRE}`);
  console.log(`Products with No Grade:       ${stats.gradeNoGrade}`);
  console.log(`Documents Updated (products): ${stats.productWrites}`);
  console.log(`Documents Updated (tiles):    ${stats.tileWrites}`);
  console.log(`Total Write Operations:       ${pendingWrites.length}`);
  console.log(`Backup File:                  ${backupFilePath}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});

