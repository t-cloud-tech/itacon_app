const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { describe, before, after, beforeEach, it } = require('mocha');

const PROJECT_ID = 'itacon-app';
const RULES_FILE = resolve(__dirname, '../firestore.rules');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_FILE, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('SECURITY TEST: Products & Tiles isActive Permissions', function () {
  this.timeout(30000);

  it('1. Customer account CANNOT change isActive on products (denied)', async () => {
    // Setup initial product doc via admin context
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('products').doc('PROD_TEST_01').set({
        productId: 'PROD_TEST_01',
        name: 'Test Tile',
        isActive: true,
      });
    });

    const customerDb = testEnv.authenticatedContext('CUSTOMER_123', {
      role: 'customer',
      userCategory: 'retailers',
    }).firestore();

    await assertFails(
      customerDb.collection('products').doc('PROD_TEST_01').update({
        isActive: false,
      })
    );
  });

  it('2. Customer account CANNOT change isActive on tiles (denied)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('tiles').doc('PROD_TEST_01').set({
        tileId: 'PROD_TEST_01',
        name: 'Test Tile',
        isActive: true,
      });
    });

    const customerDb = testEnv.authenticatedContext('CUSTOMER_123', {
      role: 'customer',
      userCategory: 'retailers',
    }).firestore();

    await assertFails(
      customerDb.collection('tiles').doc('PROD_TEST_01').update({
        isActive: false,
      })
    );
  });

  it('3. Designer CAN update isActive, updatedAt, updatedBy on products and tiles (allowed)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('products').doc('PROD_TEST_01').set({
        productId: 'PROD_TEST_01',
        name: 'Test Tile',
        isActive: true,
      });
      await context.firestore().collection('tiles').doc('PROD_TEST_01').set({
        tileId: 'PROD_TEST_01',
        name: 'Test Tile',
        isActive: true,
      });
    });

    const designerDb = testEnv.authenticatedContext('DESIGNER_001', {
      role: 'designer',
    }).firestore();

    // Designer batch update
    const batch = designerDb.batch();
    batch.update(designerDb.collection('products').doc('PROD_TEST_01'), {
      isActive: false,
      updatedAt: new Date(),
      updatedBy: 'DESIGNER_001',
    });
    batch.update(designerDb.collection('tiles').doc('PROD_TEST_01'), {
      isActive: false,
      updatedAt: new Date(),
      updatedBy: 'DESIGNER_001',
    });

    await assertSucceeds(batch.commit());
  });
});
