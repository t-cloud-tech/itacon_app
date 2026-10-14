/**
 * ITACON GRANITO — Mandatory Profile Completion Rules Emulator Tests
 * ===================================================================
 * Expanded pre-deployment verification suite for:
 * 1. Active customer with complete profile — ALLOW.
 * 2. Blocked customer — DENY.
 * 3. Inactive customer — DENY.
 * 4. Suspended customer — DENY.
 * 5. Pending salesperson verification — DENY unless existing policy explicitly permits.
 * 6. Legacy customer using fullName and phoneNumber — expected result based on actual supported schema (ALLOW).
 * 7. Missing customer document — DENY.
 * 8. User attempting to self-set phoneVerified — DENY.
 * 9. User attempting to change their own role to staff/admin — DENY.
 * 10. User attempting to change account status to active — DENY.
 * 11. Complete profile with invalid delivery address — DENY.
 * 12. Existing salesperson order workflow — ALLOW when authorized.
 * 13. Existing manager and admin operations — ALLOW when authorized.
 */

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { describe, before, after, beforeEach, it } = require('mocha');

const PROJECT_ID = 'itacon-app';
const RULES_FILE = resolve(__dirname, '../firestore.rules.proposed');

const ACTIVE_CUSTOMER_UID = 'cust_active_complete_1';
const BLOCKED_CUSTOMER_UID = 'cust_blocked_2';
const INACTIVE_CUSTOMER_UID = 'cust_inactive_3';
const SUSPENDED_CUSTOMER_UID = 'cust_suspended_4';
const PENDING_SP_VERIF_UID = 'cust_pending_sp_5';
const LEGACY_CUSTOMER_UID = 'cust_legacy_schema_6';
const UNREGISTERED_UID = 'unregistered_random_user_7';
const SELF_ELEVATOR_UID = 'cust_self_elevate_8';

const SALESPERSON_UID = 'sp_raj_101';
const MANAGER_UID = 'mgr_priya_202';
const ADMIN_UID = 'admin_vikram_303';

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
  await seedTestData();
});

function asUser(uid, claims = {}) {
  return testEnv.authenticatedContext(uid, claims).firestore();
}

function asGuest() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedTestData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Active Customer with complete profile
    await db.collection('users').doc(ACTIVE_CUSTOMER_UID).set({
      userId: ACTIVE_CUSTOMER_UID,
      uid: ACTIVE_CUSTOMER_UID,
      name: 'Ramesh Patel',
      phone: '+919876543210',
      phoneVerified: true,
      isVerified: true,
      email: 'ramesh.patel@example.com',
      companyName: 'Patel Ceramic Tiles',
      userCategory: 'Dealer',
      role: 'dealer',
      address: {
        line1: 'Shop 12, Ceramic Plaza',
        addressLine: 'Shop 12, Ceramic Plaza',
        street: '8-A National Highway',
      },
      city: 'Morbi',
      state: 'Gujarat',
      pincode: '363642',
      status: 'active',
      gstNumber: '24AAAAA0000A1Z5',
      salesPersonId: SALESPERSON_UID,
      assignedSalespersonId: SALESPERSON_UID,
    });

    // 2. Blocked customer
    await db.collection('users').doc(BLOCKED_CUSTOMER_UID).set({
      userId: BLOCKED_CUSTOMER_UID,
      uid: BLOCKED_CUSTOMER_UID,
      name: 'Blocked User',
      phone: '+919876500001',
      phoneVerified: true,
      isVerified: true,
      email: 'blocked@example.com',
      companyName: 'Blocked Ceramics',
      userCategory: 'Dealer',
      role: 'dealer',
      address: { line1: '12 Morbi Road' },
      city: 'Morbi',
      state: 'Gujarat',
      pincode: '363642',
      status: 'blocked',
    });

    // 3. Inactive customer
    await db.collection('users').doc(INACTIVE_CUSTOMER_UID).set({
      userId: INACTIVE_CUSTOMER_UID,
      uid: INACTIVE_CUSTOMER_UID,
      name: 'Inactive User',
      phone: '+919876500002',
      phoneVerified: true,
      isVerified: true,
      email: 'inactive@example.com',
      companyName: 'Inactive Enterprise',
      userCategory: 'Dealer',
      role: 'dealer',
      address: { line1: '34 Old Station Rd' },
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395003',
      status: 'inactive',
    });

    // 4. Suspended customer
    await db.collection('users').doc(SUSPENDED_CUSTOMER_UID).set({
      userId: SUSPENDED_CUSTOMER_UID,
      uid: SUSPENDED_CUSTOMER_UID,
      name: 'Suspended User',
      phone: '+919876500003',
      phoneVerified: true,
      isVerified: true,
      email: 'suspended@example.com',
      companyName: 'Suspended Trading',
      userCategory: 'Trader',
      role: 'trader',
      address: { line1: '56 Market Yard' },
      city: 'Rajkot',
      state: 'Gujarat',
      pincode: '360001',
      status: 'suspended',
    });

    // 5. Pending salesperson verification
    await db.collection('users').doc(PENDING_SP_VERIF_UID).set({
      userId: PENDING_SP_VERIF_UID,
      uid: PENDING_SP_VERIF_UID,
      name: 'Pending SP User',
      phone: '+919876500004',
      phoneVerified: true,
      isVerified: true,
      email: 'pending_sp@example.com',
      companyName: 'Pending SP Firm',
      userCategory: 'Architect',
      role: 'architect',
      address: { line1: '78 Ring Road' },
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
      status: 'pending_salesperson_verification',
    });

    // 6. Legacy customer using fullName and phoneNumber
    await db.collection('users').doc(LEGACY_CUSTOMER_UID).set({
      userId: LEGACY_CUSTOMER_UID,
      uid: LEGACY_CUSTOMER_UID,
      fullName: 'Legacy Contractor Name', // legacy alias for name
      phoneNumber: '+919876500006',       // legacy alias for phone
      phoneVerified: true,
      isVerified: true,
      email: 'legacy.customer@example.com',
      company: 'Legacy Builders Group',   // legacy alias for companyName
      role: 'builder',                    // role used as category
      address: 'Plot 88, Heritage City, Vadodara, Gujarat', // legacy string address
      city: 'Vadodara',
      state: 'Gujarat',
      pincode: '390001',
      status: 'active',
    });

    // 7. Legacy customer WITHOUT status field
    await db.collection('users').doc('cust_legacy_no_status_9').set({
      userId: 'cust_legacy_no_status_9',
      uid: 'cust_legacy_no_status_9',
      name: 'Unverified No Status User',
      phone: '+919876500009',
      phoneVerified: true,
      isVerified: true,
      email: 'nostatus@example.com',
      companyName: 'No Status Company',
      userCategory: 'Dealer',
      role: 'dealer',
      address: { line1: 'No Status Street' },
      city: 'Morbi',
      state: 'Gujarat',
      pincode: '363642',
      // status field is omitted
    });

    // 8. Normal customer for testing self-elevation attempts
    await db.collection('users').doc(SELF_ELEVATOR_UID).set({
      userId: SELF_ELEVATOR_UID,
      uid: SELF_ELEVATOR_UID,
      name: 'Normal User',
      phone: '+919876500008',
      phoneVerified: false,
      isVerified: false,
      email: 'normal@example.com',
      companyName: 'Normal Tiles',
      userCategory: 'Dealer',
      role: 'dealer',
      address: { line1: '10 Normal Lane' },
      city: 'Morbi',
      state: 'Gujarat',
      pincode: '363642',
      status: 'inactive',
    });

    // Salesperson document
    await db.collection('salesPersons').doc(SALESPERSON_UID).set({
      userId: SALESPERSON_UID,
      name: 'Raj Salesperson',
      email: 'raj@itacon.in',
      phone: '+919876599999',
      role: 'salesperson',
    });

    // Manager user document
    await db.collection('users').doc(MANAGER_UID).set({
      userId: MANAGER_UID,
      name: 'Priya Manager',
      email: 'priya@itacon.in',
      role: 'manager',
      userCategory: 'manager',
    });

    // Admin user document
    await db.collection('users').doc(ADMIN_UID).set({
      userId: ADMIN_UID,
      name: 'Vikram Admin',
      email: 'vikram@itacon.in',
      role: 'admin',
      userCategory: 'admin',
    });
  });
}

function buildOrder(userId, overrides = {}) {
  return {
    orderId: 'ORD_' + Math.random().toString(36).substring(2, 9),
    orderReference: 'ITC-PO-2026-TEST',
    userId: userId,
    customerId: userId,
    status: 'pending_rate',
    customerName: 'Verified Customer',
    userCategory: 'Dealer',
    totalBoxes: 30,
    totalAmount: 0.0,
    deliveryAddress: 'Plot 42, GIDC Industrial Estate, Morbi, Gujarat 363642',
    deliveryLocation: {
      address: 'Plot 42, GIDC Industrial Estate, Morbi, Gujarat 363642',
      city: 'Morbi',
      state: 'Gujarat',
      pincode: '363642',
    },
    paymentStatus: 'not_required',
    paidAmount: 0,
    ...overrides,
  };
}

describe('EXPANDED PRE-DEPLOYMENT VERIFICATION SUITE (13 SCENARIOS)', () => {

  it('1. Active customer with complete profile — ALLOW order creation', async () => {
    const db = asUser(ACTIVE_CUSTOMER_UID);
    await assertSucceeds(
      db.collection('orders').doc('ORD_1').set(buildOrder(ACTIVE_CUSTOMER_UID))
    );
  });

  it('2. Blocked customer — DENY order creation', async () => {
    const db = asUser(BLOCKED_CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('ORD_2').set(buildOrder(BLOCKED_CUSTOMER_UID))
    );
  });

  it('3. Inactive customer — DENY order creation', async () => {
    const db = asUser(INACTIVE_CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('ORD_3').set(buildOrder(INACTIVE_CUSTOMER_UID))
    );
  });

  it('4. Suspended customer — DENY order creation', async () => {
    const db = asUser(SUSPENDED_CUSTOMER_UID);
    await assertFails(
      db.collection('orders').doc('ORD_4').set(buildOrder(SUSPENDED_CUSTOMER_UID))
    );
  });

  it('5. Pending salesperson verification — DENY order creation', async () => {
    const db = asUser(PENDING_SP_VERIF_UID);
    await assertFails(
      db.collection('orders').doc('ORD_5').set(buildOrder(PENDING_SP_VERIF_UID))
    );
  });

  it('6. Legacy customer using fullName, phoneNumber, legacy address with active status — ALLOW order creation', async () => {
    const db = asUser(LEGACY_CUSTOMER_UID);
    await assertSucceeds(
      db.collection('orders').doc('ORD_6').set(buildOrder(LEGACY_CUSTOMER_UID))
    );
  });

  it('6b. Legacy customer WITHOUT status field — DENY order creation (cannot bypass approval)', async () => {
    const db = asUser('cust_legacy_no_status_9');
    await assertFails(
      db.collection('orders').doc('ORD_6B').set(buildOrder('cust_legacy_no_status_9'))
    );
  });

  it('7. Missing customer document — DENY order creation', async () => {
    const db = asUser(UNREGISTERED_UID);
    await assertFails(
      db.collection('orders').doc('ORD_7').set(buildOrder(UNREGISTERED_UID))
    );
  });

  it('8. User attempting to self-set phoneVerified — DENY profile update', async () => {
    const db = asUser(SELF_ELEVATOR_UID);
    // User tries to elevate phoneVerified without OTP verification
    await assertFails(
      db.collection('users').doc(SELF_ELEVATOR_UID).update({
        phoneVerified: true,
      })
    );
    // User tries to elevate isVerified without verification
    await assertFails(
      db.collection('users').doc(SELF_ELEVATOR_UID).update({
        isVerified: true,
      })
    );
  });

  it('9. User attempting to change their own role to staff/admin — DENY profile update', async () => {
    const db = asUser(SELF_ELEVATOR_UID);
    await assertFails(
      db.collection('users').doc(SELF_ELEVATOR_UID).update({
        role: 'admin',
      })
    );
    await assertFails(
      db.collection('users').doc(SELF_ELEVATOR_UID).update({
        userCategory: 'manager',
      })
    );
  });

  it('10. User attempting to change account status to active — DENY profile update', async () => {
    const db = asUser(SELF_ELEVATOR_UID);
    await assertFails(
      db.collection('users').doc(SELF_ELEVATOR_UID).update({
        status: 'active',
      })
    );
  });

  it('11. Complete profile with invalid delivery address — DENY order creation', async () => {
    const db = asUser(ACTIVE_CUSTOMER_UID);
    // Missing delivery address
    await assertFails(
      db.collection('orders').doc('ORD_11_BAD_ADDR').set(buildOrder(ACTIVE_CUSTOMER_UID, {
        deliveryAddress: '',
        deliveryLocation: null,
      }))
    );
  });

  it('12. Existing salesperson order workflow — ALLOW when authorized', async () => {
    const db = asUser(SALESPERSON_UID);
    // Salesperson creates quote
    await assertSucceeds(
      db.collection('quotations').doc('QUOTE_12').set({
        id: 'QUOTE_12',
        salespersonId: SALESPERSON_UID,
        customerId: ACTIVE_CUSTOMER_UID,
        status: 'draft',
      })
    );
    // Salesperson creates order for assigned client
    await assertSucceeds(
      db.collection('orders').doc('ORD_12_SP').set({
        orderId: 'ORD_12_SP',
        userId: ACTIVE_CUSTOMER_UID,
        customerId: ACTIVE_CUSTOMER_UID,
        salesPersonId: SALESPERSON_UID,
        status: 'pending_rate',
        totalBoxes: 50,
      })
    );
  });

  it('13. Existing manager and admin operations — ALLOW when authorized', async () => {
    // Seed an order for manager review
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('orders').doc('ORD_13_MGR').set({
        orderId: 'ORD_13_MGR',
        userId: ACTIVE_CUSTOMER_UID,
        customerId: ACTIVE_CUSTOMER_UID,
        status: 'pending_rate',
        paymentStatus: 'not_required',
      });
    });

    const mgrDb = asUser(MANAGER_UID);
    // Manager quotes rate
    await assertSucceeds(
      mgrDb.collection('orders').doc('ORD_13_MGR').update({
        status: 'rate_quoted',
        rateQuotedAt: new Date().toISOString(),
        quotedRate: 500.0,
      })
    );
    // Manager creates price approval
    await assertSucceeds(
      mgrDb.collection('priceApprovals').doc('APPR_13').set({
        approvalId: 'APPR_13',
        status: 'approved',
        managerId: MANAGER_UID,
      })
    );

    const adminDb = asUser(ADMIN_UID);
    // Admin creates system config
    await assertSucceeds(
      adminDb.collection('systemConfigs').doc('tierRules').set({
        maxDiscount: 20,
      })
    );
  });

});
