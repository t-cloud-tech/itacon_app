/**
 * ITACON GRANITO — Firestore Security Rules Emulator Tests
 * =========================================================
 * Tests every real application payload against firestore.rules
 * to catch permission regressions BEFORE production deployment.
 *
 * Run: npx mocha --timeout 30000 test/firestore.rules.test.js
 *
 * Requires: Firestore emulator running on port 8080
 *   firebase emulators:start --only firestore
 */

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { describe, before, after, beforeEach, it } = require('mocha');

// ============================================================
// PROJECT CONFIG
// ============================================================
const PROJECT_ID = 'itacon-app';
const RULES_FILE = resolve(__dirname, '../firestore.rules');

// ============================================================
// SHARED TEST UIDs
// ============================================================
const CUSTOMER_UID = 'customer_alice';
const OTHER_CUSTOMER_UID = 'customer_bob';
const SALESPERSON_UID = 'salesperson_raj';              // assigned salesperson (must exist in /salesPersons)
const UNASSIGNED_SALESPERSON_UID = 'salesperson_sam';  // unassigned salesperson (must exist in /salesPersons)
const MANAGER_UID = 'manager_priya';                    // must have role=manager in /users

// ============================================================
// TEST ENVIRONMENT
// ============================================================
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

// Helper: get a Firestore instance for a specific user
function asUser(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

// Helper: get a Firestore instance for unauthenticated user
function asGuest() {
  return testEnv.unauthenticatedContext().firestore();
}

// Helper: seed data that requires bypassing rules
async function seedData(dataFn) {
  await testEnv.withSecurityRulesDisabled(dataFn);
}

// ============================================================
// PHASE 1: PRE-SEED TEST DATA
// ============================================================
async function seedBaseData() {
  await seedData(async (ctx) => {
    const db = ctx.firestore();

    // Assigned Salesperson document (makes SALESPERSON_UID pass isStaff())
    await db.collection('salesPersons').doc(SALESPERSON_UID).set({
      name: 'Raj Salesperson',
      email: 'raj@itacon.in',
    });

    // Unassigned Salesperson document (makes UNASSIGNED_SALESPERSON_UID pass isStaff())
    await db.collection('salesPersons').doc(UNASSIGNED_SALESPERSON_UID).set({
      name: 'Sam Unassigned Salesperson',
      email: 'sam@itacon.in',
    });

    // Manager user document (makes MANAGER_UID pass isAdminOrManager())
    await db.collection('users').doc(MANAGER_UID).set({
      userId: MANAGER_UID,
      name: 'Priya Manager',
      role: 'manager',
      userCategory: 'manager',
    });

    // Customer user documents
    await db.collection('users').doc(CUSTOMER_UID).set({
      userId: CUSTOMER_UID,
      name: 'Alice Customer',
      role: 'customer',
      userCategory: 'Dealer',
    });

    await db.collection('users').doc(OTHER_CUSTOMER_UID).set({
      userId: OTHER_CUSTOMER_UID,
      name: 'Bob Other Customer',
      role: 'customer',
      userCategory: 'Dealer',
    });
  });
}

// ============================================================
// EXACT FLUTTER PO CREATE PAYLOAD (from TileOrder.toMap())
// ============================================================
function buildPoPayload(overrides = {}) {
  return {
    id: 'NEW_PO_ID',
    orderId: 'NEW_PO_ID',
    orderReference: 'ITC-GJ-2026-0001',
    orderReferenceNumber: 'ITC-GJ-2026-0001',
    userId: CUSTOMER_UID,
    customerId: CUSTOMER_UID,
    customerName: 'Alice Customer',
    salesPersonId: '',
    userCategory: 'Dealer',
    customerCategory: 'Dealer',
    status: 'pending_rate',
    orderType: 'ready_stock',
    poNumber: 'ITC-GJ-2026-0001',
    poDocumentUrl: '',
    deliveryLocation: { address: 'Ahmedabad, Gujarat' },
    deliveryAddress: 'Ahmedabad, Gujarat',
    transportRequired: true,
    remarks: 'Handle with care',
    subtotal: 0.0,
    discount: 0.0,
    taxAmount: 0.0,
    tax: 0.0,
    totalAmount: 0.0,
    total: 0.0,
    totalBoxes: 20,
    totalWeightKg: 560.0,
    totalWeightTons: 0.56,
    orderItems: [
      {
        productId: 'P1',
        productName: 'Royal Black Marble',
        size: '600x1200',
        surface: 'Glossy',
        quantity: 20,
        quantityBoxes: 20,
        moq: 10,
        finalPrice: 0.0,
      },
    ],
    items: [
      {
        productId: 'P1',
        productName: 'Royal Black Marble',
        size: '600x1200',
        surface: 'Glossy',
        quantity: 20,
        quantityBoxes: 20,
        moq: 10,
        finalPrice: 0.0,
      },
    ],
    stateCode: 'GJ',
    priceApprovalStatus: 'none',
    estimateDetails: {
      discountPercent: 0.0,
      discountAmount: 0.0,
      taxAmount: 0.0,
      subtotal: 0.0,
      grandTotal: 0.0,
      totalBoxes: 20,
      totalWeightTons: 0.56,
      totalWeightKg: 560.0,
    },
    shipmentId: null,
    freightAmount: null,
    dispatchStatus: 'unassigned',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'not_required',
    rateQuotedAt: null,
    confirmedAt: null,
    ...overrides,
  };
}

// ============================================================
// PART A — PO CREATION TESTS
// ============================================================
describe('A: PO Create — /orders/{orderId}', () => {

  beforeEach(seedBaseData);

  it('A1. Customer can create their own PO with full exact Flutter payload', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('orders').doc('NEW_PO_ID').set(buildPoPayload())
    );
  });

  it('A2. Customer CANNOT create a PO owned by another user', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('OTHER_PO').set(buildPoPayload({
        userId: OTHER_CUSTOMER_UID,
        customerId: OTHER_CUSTOMER_UID,
      }))
    );
  });

  it('A3. Customer CANNOT create PO with status=confirmed', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('BAD_PO').set(buildPoPayload({
        status: 'confirmed',
      }))
    );
  });

  it('A4. Customer CANNOT create PO with status=paid', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('BAD_PO2').set(buildPoPayload({
        status: 'paid',
      }))
    );
  });

  it('A5. Customer CANNOT create PO with forged paidAmount > 0', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('BAD_PO3').set(buildPoPayload({
        paidAmount: 50000,
      }))
    );
  });

  it('A6. Customer CANNOT create PO with forged paymentStatus=paid', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('BAD_PO4').set(buildPoPayload({
        paymentStatus: 'paid',
      }))
    );
  });

  it('A7. Customer CANNOT create PO with forged rateQuotedAt (non-null)', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('BAD_PO5').set(buildPoPayload({
        rateQuotedAt: new Date(),
      }))
    );
  });

  it('A8. Unauthenticated user CANNOT create any PO', async () => {
    const db = asGuest();
    await assertFails(
      db.collection('orders').doc('ANON_PO').set(buildPoPayload())
    );
  });

  it('A9. Staff (salesperson) can create an order on behalf of customer', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(
      db.collection('orders').doc('STAFF_PO').set(buildPoPayload({
        salesPersonId: SALESPERSON_UID,
      }))
    );
  });
});

// ============================================================
// PART B — PO READ TESTS
// ============================================================
describe('B: PO Read — /orders/{orderId}', () => {

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('orders').doc('ALICE_ORDER').set(
        buildPoPayload({ id: 'ALICE_ORDER', orderId: 'ALICE_ORDER' })
      );
    });
  });

  it('B1. Customer can read their own order', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(db.collection('orders').doc('ALICE_ORDER').get());
  });

  it('B2. Other customer CANNOT read Alice\'s order', async () => {
    const db = asUser(OTHER_CUSTOMER_UID);
    await assertFails(db.collection('orders').doc('ALICE_ORDER').get());
  });

  it('B3. Salesperson can read the order', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(db.collection('orders').doc('ALICE_ORDER').get());
  });
});

// ============================================================
// PART C — QUOTATION (CUSTOMER ACCEPT/REJECT) TESTS
// ============================================================
describe('C: Quotation Decision — /orders/{orderId}', () => {

  const QUOTED_ORDER_ID = 'QUOTED_ORDER';

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('orders').doc(QUOTED_ORDER_ID).set({
        ...buildPoPayload({ id: QUOTED_ORDER_ID, orderId: QUOTED_ORDER_ID }),
        status: 'rate_quoted',
        salesPersonId: SALESPERSON_UID,
        subtotal: 84000.0,
        discount: 4000.0,
        taxAmount: 14400.0,
        totalAmount: 94400.0,
        tax: 14400.0,
        total: 94400.0,
        rateQuotedAt: new Date(),
        quotedBy: SALESPERSON_UID,
        orderItems: [
          {
            productId: 'P1',
            productName: 'Royal Black Marble',
            size: '600x1200',
            surface: 'Glossy',
            quantity: 20,
            quotedUnitPrice: 4200.0,
            lineTotal: 84000.0,
          },
        ],
      });
    });
  });

  it('C1. Customer can confirm a rate_quoted order (status → confirmed)', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('orders').doc(QUOTED_ORDER_ID).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
    );
  });

  it('C2. Customer CANNOT confirm and change the totalAmount', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(QUOTED_ORDER_ID).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        totalAmount: 1.0, // Forged lower price
        subtotal: 84000.0,
        taxAmount: 14400.0,
      })
    );
  });

  it('C3. Customer CANNOT confirm and set paidAmount', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(QUOTED_ORDER_ID).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        totalAmount: 94400.0,
        subtotal: 84000.0,
        taxAmount: 14400.0,
        paidAmount: 94400.0, // FORGED
      })
    );
  });

  it('C4. Customer can reject a rate_quoted order (status → rejected)', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('orders').doc(QUOTED_ORDER_ID).update({
        status: 'rejected',
        rejectionReason: 'Price too high',
      })
    );
  });

  it('C5. Customer CANNOT reject and change totalAmount', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(QUOTED_ORDER_ID).update({
        status: 'rejected',
        totalAmount: 0.0, // Modified
      })
    );
  });

  it('C6. Other customer CANNOT confirm Alice\'s quoted order', async () => {
    const db = asUser(OTHER_CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(QUOTED_ORDER_ID).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        totalAmount: 94400.0,
        subtotal: 84000.0,
        taxAmount: 14400.0,
      })
    );
  });

  it('C7. Salesperson can submit a quotation (update to rate_quoted)', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(
      db.collection('orders').doc(QUOTED_ORDER_ID).update({
        status: 'rate_quoted',
        subtotal: 84000.0,
        discount: 4000.0,
        taxAmount: 14400.0,
        totalAmount: 94400.0,
        quotedBy: SALESPERSON_UID,
        rateQuotedAt: new Date(),
      })
    );
  });
});

// ============================================================
// PART D — WISHLIST TESTS
// ============================================================
describe('D: Wishlist — /wishlists/{userId}/wishlistItems/{itemId}', () => {

  beforeEach(seedBaseData);

  it('D1. Customer can add to their own wishlist', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('wishlists').doc(CUSTOMER_UID)
        .collection('wishlistItems').doc('P1').set({
          productId: 'P1',
          productName: 'Royal Black Marble',
          size: '600x1200',
          addedAt: new Date(),
        })
    );
  });

  it('D2. Customer can read their own wishlist items', async () => {
    await seedData(async (ctx) => {
      await ctx.firestore().collection('wishlists').doc(CUSTOMER_UID)
        .collection('wishlistItems').doc('P1').set({ productId: 'P1' });
    });
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('wishlists').doc(CUSTOMER_UID)
        .collection('wishlistItems').get()
    );
  });

  it('D3. Other customer CANNOT read Alice\'s wishlist', async () => {
    await seedData(async (ctx) => {
      await ctx.firestore().collection('wishlists').doc(CUSTOMER_UID)
        .collection('wishlistItems').doc('P1').set({ productId: 'P1' });
    });
    const db = asUser(OTHER_CUSTOMER_UID);
    await assertFails(
      db.collection('wishlists').doc(CUSTOMER_UID)
        .collection('wishlistItems').get()
    );
  });

  it('D4. Customer can delete from their own wishlist', async () => {
    await seedData(async (ctx) => {
      await ctx.firestore().collection('wishlists').doc(CUSTOMER_UID)
        .collection('wishlistItems').doc('P1').set({ productId: 'P1' });
    });
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('wishlists').doc(CUSTOMER_UID)
        .collection('wishlistItems').doc('P1').delete()
    );
  });

  it('D5. Unauthenticated user CANNOT read any wishlist', async () => {
    const db = asGuest();
    await assertFails(
      db.collection('wishlists').doc(CUSTOMER_UID)
        .collection('wishlistItems').get()
    );
  });
});

// ============================================================
// PART E — DEMAND PROFILE TESTS
// ============================================================
describe('E: Demand Profile — /users/{uid}/demand_profile/{docId}', () => {

  beforeEach(seedBaseData);

  it('E1. Customer can write their own demand_profile/summary', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('users').doc(CUSTOMER_UID)
        .collection('demand_profile').doc('summary').set({
          viewedProductIds: ['P1', 'P2'],
          wishlistProductIds: ['P1'],
          lastUpdated: new Date(),
        }, { merge: true })
    );
  });

  it('E2. Customer can read their own demand_profile/summary', async () => {
    await seedData(async (ctx) => {
      await ctx.firestore().collection('users').doc(CUSTOMER_UID)
        .collection('demand_profile').doc('summary').set({ views: 5 });
    });
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('users').doc(CUSTOMER_UID)
        .collection('demand_profile').doc('summary').get()
    );
  });

  it('E3. Other customer CANNOT read Alice\'s demand_profile', async () => {
    await seedData(async (ctx) => {
      await ctx.firestore().collection('users').doc(CUSTOMER_UID)
        .collection('demand_profile').doc('summary').set({ views: 5 });
    });
    const db = asUser(OTHER_CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc(CUSTOMER_UID)
        .collection('demand_profile').doc('summary').get()
    );
  });
});

// ============================================================
// PART F — AUTO_ASSIGN_USER TESTS
// ============================================================
describe('F: Auto_Assign_User — /Auto_Assign_User/{docId}', () => {

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('Auto_Assign_User').doc(CUSTOMER_UID).set({
        clientId: CUSTOMER_UID,
        assignedSalesPersonId: SALESPERSON_UID,
        assignmentType: 'auto_assigned',
        assignedAt: new Date(),
      });
    });
  });

  it('F1. Customer can READ their own Auto_Assign_User document', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('Auto_Assign_User').doc(CUSTOMER_UID).get()
    );
  });

  it('F2. Customer CANNOT read another customer\'s assignment', async () => {
    const db = asUser(OTHER_CUSTOMER_UID);
    await assertFails(
      db.collection('Auto_Assign_User').doc(CUSTOMER_UID).get()
    );
  });

  it('F3. Customer CANNOT write to Auto_Assign_User (cannot self-assign)', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('Auto_Assign_User').doc(CUSTOMER_UID).set({
        clientId: CUSTOMER_UID,
        assignedSalesPersonId: 'fake_salesperson',
      })
    );
  });

  it('F4. Unauthenticated user CANNOT read Auto_Assign_User', async () => {
    const db = asGuest();
    await assertFails(
      db.collection('Auto_Assign_User').doc(CUSTOMER_UID).get()
    );
  });

  it('F5. Salesperson CANNOT write Auto_Assign_User (privilege escalation prevention)', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertFails(
      db.collection('Auto_Assign_User').doc('new_client').set({
        clientId: 'new_client',
        assignedSalesPersonId: SALESPERSON_UID,
        assignmentType: 'auto_assigned',
      })
    );
  });

  it('F6. Admin/Manager CAN write Auto_Assign_User', async () => {
    const db = asUser(MANAGER_UID);
    await assertSucceeds(
      db.collection('Auto_Assign_User').doc('new_client_admin').set({
        clientId: 'new_client_admin',
        assignedSalesPersonId: SALESPERSON_UID,
        assignmentType: 'auto_assigned',
      })
    );
  });
});

// ============================================================
// PART G — PAYMENT SECURITY TESTS
// ============================================================
describe('G: Payment Security', () => {

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('orders').doc('CONFIRMED_ORDER').set({
        ...buildPoPayload({ id: 'CONFIRMED_ORDER', orderId: 'CONFIRMED_ORDER' }),
        status: 'confirmed',
        paymentStatus: 'payment_due',
        totalAmount: 94400.0,
        subtotal: 84000.0,
        taxAmount: 14400.0,
      });

      await ctx.firestore().collection('paymentConfig').doc('bank_config').set({
        bankName: 'HDFC Bank',
        accountNumber: 'XXXX1234',
        ifscCode: 'HDFC0001234',
      });
    });
  });

  it('G1. Customer CANNOT directly write to paymentSubmissions', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('paymentSubmissions').add({
        customerId: CUSTOMER_UID,
        orderId: 'CONFIRMED_ORDER',
        amount: 94400.0,
        utrNumber: '123456789012',
      })
    );
  });

  it('G2. Customer CANNOT write to payment_utrs', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('payment_utrs').doc('UTR123').set({
        utr: 'UTR123',
        orderId: 'CONFIRMED_ORDER',
      })
    );
  });

  it('G3. Customer CANNOT set paymentStatus=paid on their order', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('CONFIRMED_ORDER').update({
        paymentStatus: 'paid',
        paidAmount: 94400.0,
        paidAt: new Date(),
      })
    );
  });

  it('G4. Customer can READ paymentConfig (to see bank details for transfer)', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('paymentConfig').doc('bank_config').get()
    );
  });

  it('G5. Customer CANNOT write to paymentConfig', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('paymentConfig').doc('bank_config').update({
        accountNumber: 'HACKED123',
      })
    );
  });
});

// ============================================================
// PART H — LOYALTY / REWARD SECURITY TESTS
// ============================================================
describe('H: Reward Security', () => {

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('loyaltyTransactions').doc('TX1').set({
        userId: CUSTOMER_UID,
        points: 100,
        event: 'order_confirmed',
      });
      await ctx.firestore().collection('referrals').doc('REF1').set({
        referrerUid: CUSTOMER_UID,
        referredUid: OTHER_CUSTOMER_UID,
        status: 'completed',
        pointsAwarded: 500,
      });
    });
  });

  it('H1. Customer can READ their own loyaltyTransactions', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('loyaltyTransactions').doc('TX1').get()
    );
  });

  it('H2. Customer CANNOT WRITE to loyaltyTransactions', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('loyaltyTransactions').add({
        userId: CUSTOMER_UID,
        points: 99999,
        event: 'forged',
      })
    );
  });

  it('H3. Customer can READ their own referrals', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('referrals').doc('REF1').get()
    );
  });

  it('H4. Customer CANNOT WRITE to referrals', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('referrals').add({
        referrerUid: CUSTOMER_UID,
        referredUid: 'fake_uid',
        pointsAwarded: 99999,
      })
    );
  });

  it('H5. Customer CANNOT WRITE to loyaltyRedemptions', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('loyaltyRedemptions').add({
        userId: CUSTOMER_UID,
        pointsUsed: 1000,
        status: 'approved',
      })
    );
  });
});

// ============================================================
// PART I — SALESPERSON ASSIGNMENT & DASHBOARD
// ============================================================
describe('I: Salesperson & Assignment', () => {

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('client_assignments').doc('ASSIGN1').set({
        clientId: CUSTOMER_UID,
        customerId: CUSTOMER_UID,
        assignedSalesPersonId: SALESPERSON_UID,
        status: 'active',
      });
    });
  });

  it('I1. Customer can READ their own client_assignment', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('client_assignments').doc('ASSIGN1').get()
    );
  });

  it('I2. Customer CANNOT WRITE to client_assignments (cannot self-assign)', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('client_assignments').doc('ASSIGN_FORGED').set({
        clientId: CUSTOMER_UID,
        assignedSalesPersonId: 'someone_else',
      })
    );
  });

  it('I3. Customer can READ salesPersons document (to show assigned salesperson info)', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('salesPersons').doc(SALESPERSON_UID).get()
    );
  });

  it('I4. Customer CANNOT WRITE to salesPersons', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('salesPersons').doc(SALESPERSON_UID).update({
        name: 'Hacked Name',
      })
    );
  });
});

// ============================================================
// PART J — PRODUCTS (PUBLIC CATALOG)
// ============================================================
describe('J: Products — public catalog', () => {

  beforeEach(async () => {
    await seedData(async (ctx) => {
      await ctx.firestore().collection('products').doc('P1').set({
        name: 'Royal Black Marble',
        size: '600x1200',
        surface: 'Glossy',
        price: 4200,
      });
    });
  });

  it('J1. Unauthenticated user CAN read products (public catalog)', async () => {
    const db = asGuest();
    await assertSucceeds(db.collection('products').doc('P1').get());
  });

  it('J2. Authenticated customer CAN read products', async () => {
    await seedBaseData();
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(db.collection('products').doc('P1').get());
  });

  it('J3. Customer CANNOT write to products', async () => {
    await seedBaseData();
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('products').doc('P1').update({ price: 1 })
    );
  });
});

// ============================================================
// PART K — USERS OWNERSHIP & PRIVILEGE ESCALATION
// ============================================================
describe('K: Users Ownership & Profile Protection — /users/{userId}', () => {
  beforeEach(seedBaseData);

  it('K1. Customer creates users/{ownUid} → ALLOW', async () => {
    const newUid = 'customer_new_123';
    const db = asUser(newUid);
    await assertSucceeds(
      db.collection('users').doc(newUid).set({
        userId: newUid,
        name: 'New Customer',
        phone: '+919876543210',
        email: 'new@example.com',
      })
    );
  });

  it('K2. Customer creates users/{otherUid} → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc('forged_victim_uid').set({
        userId: 'forged_victim_uid',
        name: 'Victim',
      })
    );
  });

  it('K3. Customer updates users/{ownUid} normal profile → ALLOW', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('users').doc(CUSTOMER_UID).update({
        name: 'Alice Updated',
        companyName: 'Alice Tiles Co',
      })
    );
  });

  it('K4. Customer updates users/{otherUid} → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc(OTHER_CUSTOMER_UID).update({
        name: 'Hacked Bob',
      })
    );
  });

  it('K5. Customer modifies own role → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc(CUSTOMER_UID).update({
        role: 'admin',
      })
    );
  });

  it('K6. Customer modifies own loyaltyPoints → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc(CUSTOMER_UID).update({
        loyaltyPoints: 999999,
      })
    );
  });

  it('K7. Customer modifies own userCategory → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc(CUSTOMER_UID).update({
        userCategory: 'manager',
      })
    );
  });

  it('K8. Customer modifies own welcomeBonusGranted → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc(CUSTOMER_UID).update({
        welcomeBonusGranted: true,
      })
    );
  });

  it('K9. Admin/Manager can update user role → ALLOW', async () => {
    const db = asUser(MANAGER_UID);
    await assertSucceeds(
      db.collection('users').doc(CUSTOMER_UID).update({
        role: 'vip_dealer',
      })
    );
  });
});

// ============================================================
// PART L — ORDER STAFF AUTHORIZATION (ASSIGNED VS UNASSIGNED)
// ============================================================
describe('L: Order Staff Authorization — Assigned vs Unassigned Salesperson', () => {
  const ORDER_FOR_ASSIGNMENT_TEST = 'ORDER_ASSIGN_TEST';

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('orders').doc(ORDER_FOR_ASSIGNMENT_TEST).set({
        ...buildPoPayload({ id: ORDER_FOR_ASSIGNMENT_TEST, orderId: ORDER_FOR_ASSIGNMENT_TEST }),
        status: 'pending_rate',
        salesPersonId: SALESPERSON_UID,
      });
    });
  });

  it('L1. Assigned salesperson quotation update → ALLOW', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_FOR_ASSIGNMENT_TEST).update({
        status: 'rate_quoted',
        subtotal: 50000.0,
        discount: 0.0,
        taxAmount: 9000.0,
        totalAmount: 59000.0,
        quotedBy: SALESPERSON_UID,
        rateQuotedAt: new Date(),
      })
    );
  });

  it('L2. Unassigned salesperson same update → DENY', async () => {
    const db = asUser(UNASSIGNED_SALESPERSON_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_FOR_ASSIGNMENT_TEST).update({
        status: 'rate_quoted',
        subtotal: 50000.0,
        discount: 0.0,
        taxAmount: 9000.0,
        totalAmount: 59000.0,
        quotedBy: UNASSIGNED_SALESPERSON_UID,
        rateQuotedAt: new Date(),
      })
    );
  });

  it('L3. Admin/Manager legitimate update on any order → ALLOW', async () => {
    const db = asUser(MANAGER_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_FOR_ASSIGNMENT_TEST).update({
        remarks: 'Approved by manager Priya',
        priceApprovalStatus: 'approved',
      })
    );
  });

  it('L4. Assigned salesperson cannot directly forge paymentStatus=paid → DENY', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_FOR_ASSIGNMENT_TEST).update({
        paymentStatus: 'paid',
        paidAmount: 59000.0,
      })
    );
  });
});

// ============================================================
// PART M — EXACT PO CREATE PAYLOAD INTEGRITY
// ============================================================
describe('M: Exact PO Create Payload Tests from TileOrder.toMap()', () => {
  beforeEach(seedBaseData);

  it('M1. Authenticated owner + exact pending_rate payload → MUST ALLOW', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('orders').doc('EXACT_PO_1').set(buildPoPayload({
        id: 'EXACT_PO_1',
        orderId: 'EXACT_PO_1',
      }))
    );
  });

  it('M2. Other UID attempting to create PO → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('EXACT_PO_2').set(buildPoPayload({
        id: 'EXACT_PO_2',
        orderId: 'EXACT_PO_2',
        userId: OTHER_CUSTOMER_UID,
        customerId: OTHER_CUSTOMER_UID,
      }))
    );
  });

  it('M3. Forged confirmed create → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('EXACT_PO_3').set(buildPoPayload({
        status: 'confirmed',
      }))
    );
  });

  it('M4. Forged paid create → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('EXACT_PO_4').set(buildPoPayload({
        status: 'paid',
      }))
    );
  });

  it('M5. Non-zero paidAmount create → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('EXACT_PO_5').set(buildPoPayload({
        paidAmount: 25000.0,
      }))
    );
  });

  it('M6. Non-null paidAt create → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('EXACT_PO_6').set(buildPoPayload({
        paidAt: new Date(),
      }))
    );
  });

  it('M7. Non-null paymentId create → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('EXACT_PO_7').set(buildPoPayload({
        paymentId: 'FORGED_PAY_123',
      }))
    );
  });
});

// ============================================================
// PART N — CUSTOMER REFERRALS & ABUSE PREVENTION
// ============================================================
describe('N: customer_referrals Abuse Prevention', () => {
  beforeEach(seedBaseData);

  it('N1. Customer creates customer_referral with own UID → ALLOW', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('customer_referrals').add({
        referralCode: 'FRIEND10',
        userId: CUSTOMER_UID,
        clientId: CUSTOMER_UID,
        userName: 'Alice Customer',
        createdAt: new Date(),
      })
    );
  });

  it('N2. Customer creates customer_referral forging another customer UID → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('customer_referrals').add({
        referralCode: 'FRIEND10',
        userId: OTHER_CUSTOMER_UID,
        clientId: OTHER_CUSTOMER_UID,
        userName: 'Bob Victim',
        createdAt: new Date(),
      })
    );
  });

  it('N3. Unauthenticated user cannot create customer_referral → DENY', async () => {
    const db = asGuest();
    await assertFails(
      db.collection('customer_referrals').add({
        referralCode: 'FRIEND10',
        userId: CUSTOMER_UID,
        clientId: CUSTOMER_UID,
      })
    );
  });
});

// ============================================================
// PART O — ROOT NOTIFICATIONS ABUSE PREVENTION
// ============================================================
describe('O: Root notifications Abuse Prevention', () => {
  const NOTIF_ID = 'NOTIF_ALICE_1';

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('notifications').doc(NOTIF_ID).set({
        userId: CUSTOMER_UID,
        targetUser: CUSTOMER_UID,
        title: 'Order Update',
        message: 'Your PO is being reviewed',
        isRead: false,
        createdAt: new Date(),
      });
    });
  });

  it('O1. Staff creates root notification → ALLOW', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(
      db.collection('notifications').doc('STAFF_NOTIF_1').set({
        userId: CUSTOMER_UID,
        targetUser: CUSTOMER_UID,
        title: 'Staff Notice',
        message: 'Your rates are ready',
        isRead: false,
      })
    );
  });

  it('O2. Customer creates arbitrary root notification → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('notifications').doc('SPAM_NOTIF_1').set({
        userId: OTHER_CUSTOMER_UID,
        targetUser: OTHER_CUSTOMER_UID,
        title: 'Spam Alert',
        message: 'Arbitrary spam message',
      })
    );
  });

  it('O3. Recipient customer marks own root notification as read → ALLOW', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('notifications').doc(NOTIF_ID).update({
        isRead: true,
        read: true,
      })
    );
  });

  it('O4. Other customer updates recipient root notification → DENY', async () => {
    const db = asUser(OTHER_CUSTOMER_UID);
    await assertFails(
      db.collection('notifications').doc(NOTIF_ID).update({
        isRead: true,
        read: true,
      })
    );
  });
});

// ============================================================
// PART P — CUSTOMER QUOTATION ACCEPT/REJECT STRICT ALLOWLIST & ABUSE
// ============================================================
describe('P: Customer Quotation Accept/Reject — Strict Allowlist & Abuse', () => {
  const ORDER_P = 'ORDER_P_TEST';

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('orders').doc(ORDER_P).set({
        ...buildPoPayload({ id: ORDER_P, orderId: ORDER_P }),
        status: 'rate_quoted',
        paymentStatus: 'not_required',
        subtotal: 50000.0,
        discount: 5000.0,
        taxAmount: 9000.0,
        totalAmount: 54000.0,
        salesPersonId: SALESPERSON_UID,
        deliveryAddress: 'Original Street 123',
        deliveryLocation: 'Surat',
      });
    });
  });

  it('P1. Customer accepts quotation using EXACT legitimate fields → ALLOW', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_P).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
    );
  });

  it('P2. Customer attempts to modify items/orderItems during accept → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_P).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        confirmedAt: new Date(),
        updatedAt: new Date(),
        items: [{ tileId: 'FREE_TILE', boxes: 100 }],
      })
    );
  });

  it('P3. Customer attempts to modify discount during accept → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_P).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        confirmedAt: new Date(),
        updatedAt: new Date(),
        discount: 20000.0,
      })
    );
  });

  it('P4. Customer attempts to alter delivery information during accept → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_P).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        confirmedAt: new Date(),
        updatedAt: new Date(),
        deliveryAddress: 'Forged New Address 999',
      })
    );
  });

  it('P5. Customer attempts to alter salesPersonId during accept → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_P).update({
        status: 'confirmed',
        paymentStatus: 'payment_due',
        confirmedAt: new Date(),
        updatedAt: new Date(),
        salesPersonId: 'different_salesperson',
      })
    );
  });

  it('P6. Customer rejects quotation using legitimate fields → ALLOW', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_P).update({
        status: 'rejected',
        updatedAt: new Date(),
      })
    );
  });

  it('P7. Customer attempts to alter discount during reject → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_P).update({
        status: 'rejected',
        updatedAt: new Date(),
        discount: 0.0,
      })
    );
  });

  it('P8. Customer attempts to alter totalAmount during reject → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_P).update({
        status: 'rejected',
        updatedAt: new Date(),
        totalAmount: 1.0,
      })
    );
  });
});

// ============================================================
// PART Q — SALESPERSON PAYMENT FIELDS (MODERN & LEGACY)
// ============================================================
describe('Q: Salesperson Payment Fields — Backend Only (Modern & Legacy)', () => {
  const ORDER_MODERN = 'ORDER_MODERN_TEST';
  const ORDER_LEGACY = 'ORDER_LEGACY_TEST';

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      // Modern order with payment fields present
      await ctx.firestore().collection('orders').doc(ORDER_MODERN).set({
        ...buildPoPayload({ id: ORDER_MODERN, orderId: ORDER_MODERN }),
        status: 'pending_rate',
        salesPersonId: SALESPERSON_UID,
        paymentStatus: 'not_required',
        paidAmount: 0.0,
      });

      // Legacy order without payment fields
      await ctx.firestore().collection('orders').doc(ORDER_LEGACY).set({
        id: ORDER_LEGACY,
        orderId: ORDER_LEGACY,
        userId: CUSTOMER_UID,
        customerId: CUSTOMER_UID,
        status: 'pending_rate',
        salesPersonId: SALESPERSON_UID,
        totalAmount: 0.0,
      });
    });
  });

  it('Q1. Assigned salesperson quoting modern order → ALLOW', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_MODERN).update({
        status: 'rate_quoted',
        subtotal: 40000.0,
        taxAmount: 7200.0,
        totalAmount: 47200.0,
        rateQuotedAt: new Date(),
        quotedBy: SALESPERSON_UID,
      })
    );
  });

  it('Q2. Assigned salesperson quoting legacy order (missing paidAmount) → ALLOW', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_LEGACY).update({
        status: 'rate_quoted',
        totalAmount: 35000.0,
        rateQuotedAt: new Date(),
        quotedBy: SALESPERSON_UID,
      })
    );
  });

  it('Q3. Assigned salesperson adding paidAmount to legacy order → DENY', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_LEGACY).update({
        paidAmount: 35000.0,
      })
    );
  });

  it('Q4. Assigned salesperson modifying paidAmount on modern order → DENY', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_MODERN).update({
        paidAmount: 47200.0,
      })
    );
  });

  it('Q5. Assigned salesperson altering paymentStatus → DENY', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_MODERN).update({
        paymentStatus: 'paid',
      })
    );
  });

  it('Q6. Assigned salesperson adding paidAt/paymentId → DENY', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_MODERN).update({
        paidAt: new Date(),
        paymentId: 'SP_FORGED_PAY_ID',
      })
    );
  });
});

// ============================================================
// PART R — ADMIN / MANAGER PAYMENT PROTECTION
// ============================================================
describe('R: Admin / Manager Payment Protection', () => {
  const ORDER_R = 'ORDER_R_TEST';

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('orders').doc(ORDER_R).set({
        ...buildPoPayload({ id: ORDER_R, orderId: ORDER_R }),
        status: 'confirmed',
        paymentStatus: 'payment_due',
        totalAmount: 50000.0,
        paidAmount: 0.0,
        salesPersonId: SALESPERSON_UID,
      });
    });
  });

  it('R1. Admin legitimate operational update (change status, remarks) → ALLOW', async () => {
    const db = asUser(MANAGER_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_R).update({
        status: 'processing',
        dispatchStatus: 'processing',
        remarks: 'Batch in production',
      })
    );
  });

  it('R2. Manager price approval update → ALLOW', async () => {
    const db = asUser(MANAGER_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_R).update({
        priceApprovalStatus: 'approved',
        remarks: 'Approved by manager',
      })
    );
  });

  it('R3. Admin direct paymentStatus=paid forgery via client write → DENY', async () => {
    const db = asUser(MANAGER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_R).update({
        paymentStatus: 'paid',
      })
    );
  });

  it('R4. Manager direct paidAmount modification via client write → DENY', async () => {
    const db = asUser(MANAGER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_R).update({
        paidAmount: 50000.0,
      })
    );
  });

  it('R5. Admin direct paidAt/paymentId/verifiedAt modification → DENY', async () => {
    const db = asUser(MANAGER_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_R).update({
        paidAt: new Date(),
        paymentId: 'ADMIN_FORGED_PAY_ID',
        verifiedAt: new Date(),
      })
    );
  });
});

// ============================================================
// PART S — ASSIGNMENT PRIVILEGE ESCALATION ATTACK
// ============================================================
describe('S: Assignment Privilege Escalation Attack Prevention', () => {
  const ORDER_S = 'ORDER_S_TEST';

  beforeEach(async () => {
    await seedBaseData();
    await seedData(async (ctx) => {
      await ctx.firestore().collection('orders').doc(ORDER_S).set({
        ...buildPoPayload({ id: ORDER_S, orderId: ORDER_S }),
        status: 'pending_rate',
        salesPersonId: SALESPERSON_UID, // assigned to SALESPERSON_UID, NOT UNASSIGNED_SALESPERSON_UID
      });
    });
  });

  it('S1. Unassigned salesperson attempts to write Auto_Assign_User to self-assign → DENY', async () => {
    const db = asUser(UNASSIGNED_SALESPERSON_UID);
    await assertFails(
      db.collection('Auto_Assign_User').doc(CUSTOMER_UID).set({
        clientId: CUSTOMER_UID,
        assignedSalesPersonId: UNASSIGNED_SALESPERSON_UID,
        assignmentType: 'auto_assigned',
      })
    );
  });

  it('S2. Unassigned salesperson attempts to write client_assignments to self-assign → DENY', async () => {
    const db = asUser(UNASSIGNED_SALESPERSON_UID);
    await assertFails(
      db.collection('client_assignments').doc(`ASGN_${CUSTOMER_UID}`).set({
        clientId: CUSTOMER_UID,
        salespersonId: UNASSIGNED_SALESPERSON_UID,
        status: 'active',
      })
    );
  });

  it('S3. Unassigned salesperson still cannot modify the customer order → DENY', async () => {
    const db = asUser(UNASSIGNED_SALESPERSON_UID);
    await assertFails(
      db.collection('orders').doc(ORDER_S).update({
        status: 'rate_quoted',
        totalAmount: 40000.0,
      })
    );
  });

  it('S4. Admin/manager legitimate assignment write to Auto_Assign_User → ALLOW', async () => {
    const db = asUser(MANAGER_UID);
    await assertSucceeds(
      db.collection('Auto_Assign_User').doc(CUSTOMER_UID).set({
        clientId: CUSTOMER_UID,
        assignedSalesPersonId: SALESPERSON_UID,
        assignmentType: 'auto_assigned',
      })
    );
  });

  it('S5. Admin/manager legitimate assignment write to client_assignments → ALLOW', async () => {
    const db = asUser(MANAGER_UID);
    await assertSucceeds(
      db.collection('client_assignments').doc(`ASGN_${CUSTOMER_UID}`).set({
        clientId: CUSTOMER_UID,
        salespersonId: SALESPERSON_UID,
        status: 'active',
      })
    );
  });

  it('S6. Legitimate assigned salesperson can quote order → ALLOW', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(
      db.collection('orders').doc(ORDER_S).update({
        status: 'rate_quoted',
        subtotal: 30000.0,
        taxAmount: 5400.0,
        totalAmount: 35400.0,
        rateQuotedAt: new Date(),
        quotedBy: SALESPERSON_UID,
      })
    );
  });
});

// ============================================================
// PART T — NESTED USER NOTIFICATION CREATE & ABUSE
// ============================================================
describe('T: Nested users/{userId}/notifications Protection', () => {
  beforeEach(seedBaseData);

  it('T1. Customer creates notification in own subcollection → ALLOW', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertSucceeds(
      db.collection('users').doc(CUSTOMER_UID)
        .collection('notifications').doc('OWN_NOTIF_1').set({
          title: 'My Saved Alert',
          message: 'Personal reminder',
          isRead: false,
          createdAt: new Date(),
        })
    );
  });

  it('T2. Customer creates notification in other customer subcollection → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc(OTHER_CUSTOMER_UID)
        .collection('notifications').doc('SPAM_NOTIF').set({
          title: 'Unsolicited',
          message: 'Direct intrusion',
          isRead: false,
          createdAt: new Date(),
        })
    );
  });

  it('T3. Customer with fake orderId attempts to create in other customer notifications → DENY', async () => {
    const db = asUser(CUSTOMER_UID);
    await assertFails(
      db.collection('users').doc(OTHER_CUSTOMER_UID)
        .collection('notifications').doc('FAKE_ORDER_NOTIF').set({
          orderId: 'ORDER_FAKE_999',
          title: 'Fake Notice',
          message: 'Bypassing using orderId',
        })
    );
  });

  it('T4. Staff creates notification in customer subcollection (e.g. quote ready) → ALLOW', async () => {
    const db = asUser(SALESPERSON_UID);
    await assertSucceeds(
      db.collection('users').doc(CUSTOMER_UID)
        .collection('notifications').doc('STAFF_MSG_1').set({
          title: 'Quote Ready',
          message: 'Your rates have been updated',
          isRead: false,
          createdAt: new Date(),
        })
    );
  });
});


