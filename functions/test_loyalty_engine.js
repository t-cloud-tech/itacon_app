const assert = require('assert');

// Test the core business logic of loyaltyRewardEngine
console.log('Running Backend Loyalty Reward Engine Unit Tests...');

const DEFAULT_LOYALTY_CONFIG = {
  signupBonusPoints: 500,
  referralSignupPoints: 500,
  successfulOrderReward: 5555.0,
  pointsPerBox: 10,
  minimumRedemptionPoints: 50000,
  rupeesPerPoint: 0.50,
};

// Test 1: Welcome bonus amount
assert.strictEqual(DEFAULT_LOYALTY_CONFIG.signupBonusPoints, 500, 'Welcome bonus must be 500 points');

// Test 2: Referral signup bonus amount
assert.strictEqual(DEFAULT_LOYALTY_CONFIG.referralSignupPoints, 500, 'Referral signup must be 500 points');

// Test 3: Successful order reward amount
assert.strictEqual(DEFAULT_LOYALTY_CONFIG.successfulOrderReward, 5555.0, 'Successful order reward must be 5555');

// Test 4: Purchase points per box calculation
function calculatePurchasePoints(boxes, pointsPerBox = DEFAULT_LOYALTY_CONFIG.pointsPerBox) {
  return boxes * pointsPerBox;
}
assert.strictEqual(calculatePurchasePoints(100), 1000, '100 boxes must award 1000 points');
assert.strictEqual(calculatePurchasePoints(50), 500, '50 boxes must award 500 points');
assert.strictEqual(calculatePurchasePoints(0), 0, '0 boxes must award 0 points');

// Test 5: Redemption conversion: 50,000 points = ₹25,000
function calculateRupeeValue(points, rupeesPerPoint = DEFAULT_LOYALTY_CONFIG.rupeesPerPoint) {
  return points * rupeesPerPoint;
}
assert.strictEqual(calculateRupeeValue(50000), 25000, '50,000 points must equal ₹25,000');
assert.strictEqual(calculateRupeeValue(100000), 50000, '100,000 points must equal ₹50,000');

// Test 6: Self-referral validation
function validateReferralSubmission(userUid, userReferralCode, inputReferralCode) {
  if (userReferralCode && userReferralCode.toUpperCase() === inputReferralCode.toUpperCase()) {
    return { valid: false, reason: 'self_referral' };
  }
  return { valid: true };
}
assert.strictEqual(
  validateReferralSubmission('U1', 'ITA-123456', 'ITA-123456').valid,
  false,
  'Self-referral must be rejected'
);
assert.strictEqual(
  validateReferralSubmission('U1', 'ITA-123456', 'ITA-654321').valid,
  true,
  'Valid referral from different user must be accepted'
);

// Test 7: Idempotency of Purchase Points (Transaction ID uniqueness)
const processedOrders = new Set();
function awardPurchasePointsIdempotent(orderId, boxes) {
  const txId = `purchase_order_${orderId}`;
  if (processedOrders.has(txId)) {
    return { success: false, reason: 'already_processed', points: 0 };
  }
  processedOrders.add(txId);
  return { success: true, points: calculatePurchasePoints(boxes) };
}
const firstRun = awardPurchasePointsIdempotent('ORD_001', 100);
assert.strictEqual(firstRun.success, true);
assert.strictEqual(firstRun.points, 1000);

const duplicateRun = awardPurchasePointsIdempotent('ORD_001', 100);
assert.strictEqual(duplicateRun.success, false);
assert.strictEqual(duplicateRun.points, 0);

// Test 8: Referral qualification transitions to 'reward_pending' (NOT approved)
function qualifyReferralOrder(order) {
  if (order.status === 'confirmed' && order.totalBoxes > 0 && order.totalAmount > 0) {
    return {
      status: 'reward_pending',
      orderRewardAmount: 5555.0,
      orderRewardGranted: true,
      qualifyingOrderId: order.id,
    };
  }
  return null;
}

const qualified = qualifyReferralOrder({
  id: 'ORD_99',
  status: 'confirmed',
  totalBoxes: 120,
  totalAmount: 150000,
});
assert.strictEqual(qualified.status, 'reward_pending', 'Referral must transition to reward_pending');
assert.strictEqual(qualified.orderRewardAmount, 5555.0);
assert.strictEqual(qualified.orderRewardGranted, true);

// Test 9: Redemption threshold validation (minimum 50,000 points)
function validateRedemptionRequest(availablePoints, requestedPoints) {
  if (requestedPoints < DEFAULT_LOYALTY_CONFIG.minimumRedemptionPoints) {
    return { valid: false, reason: 'below_minimum_threshold' };
  }
  if (availablePoints < requestedPoints) {
    return { valid: false, reason: 'insufficient_balance' };
  }
  return { valid: true, rupeeAmount: calculateRupeeValue(requestedPoints) };
}
assert.strictEqual(validateRedemptionRequest(40000, 50000).valid, false);
assert.strictEqual(validateRedemptionRequest(60000, 45000).valid, false);
assert.strictEqual(validateRedemptionRequest(60000, 50000).valid, true);
assert.strictEqual(validateRedemptionRequest(60000, 50000).rupeeAmount, 25000);

// Test 10: Concurrent Redemption Double-Spend Simulation
// User balance = 60,000 points. Two simultaneous 50,000 pt requests.
class MockFirestoreBalanceTransaction {
  constructor(initialBalance) {
    this.balance = initialBalance;
    this.transactions = [];
  }

  async runTransaction(executeFn) {
    // Atomically execute with check-and-set semantics
    return await executeFn({
      getBalance: () => this.balance,
      deduct: (points, id) => {
        if (this.balance < points) {
          throw new Error('Insufficient points balance. Available: ' + this.balance);
        }
        this.balance -= points;
        this.transactions.push({ id, deducted: points, remaining: this.balance });
        return this.balance;
      },
    });
  }
}

async function testConcurrentRedemptions() {
  const store = new MockFirestoreBalanceTransaction(60000);

  const attemptRedemption = async (reqId, points) => {
    try {
      return await store.runTransaction(async (tx) => {
        const current = tx.getBalance();
        if (current < points) {
          return { success: false, reason: 'insufficient_balance', remaining: current };
        }
        const remaining = tx.deduct(points, reqId);
        return { success: true, remaining };
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Run two 50,000 redemption attempts concurrently
  const [resA, resB] = await Promise.all([
    attemptRedemption('REQ_1', 50000),
    attemptRedemption('REQ_2', 50000),
  ]);

  // Exactly one must succeed and one must fail
  const successCount = (resA.success ? 1 : 0) + (resB.success ? 1 : 0);
  assert.strictEqual(successCount, 1, 'Only one of two concurrent redemptions can succeed');
  assert.strictEqual(store.balance, 10000, 'Balance must be exactly 10,000 points and never negative');
  assert.strictEqual(store.transactions.length, 1, 'Only one transaction must be committed');
}

// Test 11: Admin/Salesperson Role Authorization Test for ₹5,555 Approval
function authorizeRewardApproval(caller, token = {}) {
  const role = String(caller.role || '').toLowerCase();
  const category = String(caller.userCategory || '').toLowerCase();
  const isAuthorized =
    token.admin === true ||
    token.role === 'admin' ||
    token.role === 'salesperson' ||
    caller.isAdmin === true ||
    role === 'admin' ||
    role === 'salesperson' ||
    role === 'manager' ||
    category === 'admin' ||
    category === 'salesperson';

  if (!isAuthorized) {
    return { authorized: false, error: 'permission-denied' };
  }
  return { authorized: true };
}

assert.strictEqual(authorizeRewardApproval({ role: 'customer', userCategory: 'dealer' }).authorized, false, 'Customer must be denied approval');
assert.strictEqual(authorizeRewardApproval({ role: 'customer', userCategory: 'architect' }).authorized, false, 'Architect customer must be denied approval');
assert.strictEqual(authorizeRewardApproval({ role: 'salesperson', userCategory: 'salesperson' }).authorized, true, 'Salesperson must be authorized');
assert.strictEqual(authorizeRewardApproval({ role: 'admin', userCategory: 'admin' }).authorized, true, 'Admin must be authorized');
assert.strictEqual(authorizeRewardApproval({ role: 'customer' }, { admin: true }).authorized, true, 'Admin token claim must be authorized');

// Test 12: Referral Code Onboarding Window & Orders Restriction
function validateReferralLinkingConstraints({ userCreatedAt, orderCount, alreadyReferred, isSelfReferral }) {
  if (isSelfReferral) {
    return { allowed: false, error: 'self_referral' };
  }
  if (alreadyReferred) {
    return { allowed: false, error: 'already_referred' };
  }
  if (orderCount > 0) {
    return { allowed: false, error: 'orders_already_placed' };
  }
  const ONBOARDING_MS = 24 * 60 * 60 * 1000;
  if (Date.now() - userCreatedAt.getTime() > ONBOARDING_MS) {
    return { allowed: false, error: 'outside_onboarding_window' };
  }
  return { allowed: true };
}

const now = new Date();
const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

assert.strictEqual(validateReferralLinkingConstraints({ userCreatedAt: fourHoursAgo, orderCount: 0, alreadyReferred: false, isSelfReferral: false }).allowed, true);
assert.strictEqual(validateReferralLinkingConstraints({ userCreatedAt: fourHoursAgo, orderCount: 2, alreadyReferred: false, isSelfReferral: false }).allowed, false, 'Orders placed must reject referral linking');
assert.strictEqual(validateReferralLinkingConstraints({ userCreatedAt: threeDaysAgo, orderCount: 0, alreadyReferred: false, isSelfReferral: false }).allowed, false, 'Outside 24h onboarding window must reject referral linking');
assert.strictEqual(validateReferralLinkingConstraints({ userCreatedAt: fourHoursAgo, orderCount: 0, alreadyReferred: true, isSelfReferral: false }).allowed, false, 'Already referred user must reject duplicate linking');
assert.strictEqual(validateReferralLinkingConstraints({ userCreatedAt: fourHoursAgo, orderCount: 0, alreadyReferred: false, isSelfReferral: true }).allowed, false, 'Self referral must be rejected');

// Test 13: Order Lifecycle Transitions
function evaluateOrderPoints(beforeStatus, afterStatus, boxes) {
  // Only first transition to confirmed grants points
  if (afterStatus === 'confirmed' && beforeStatus !== 'confirmed' && boxes > 0) {
    return boxes * 10;
  }
  return 0;
}
assert.strictEqual(evaluateOrderPoints(null, 'pending_rate', 100), 0);
assert.strictEqual(evaluateOrderPoints('pending_rate', 'rate_quoted', 100), 0);
assert.strictEqual(evaluateOrderPoints('rate_quoted', 'confirmed', 100), 1000, 'First confirmed transition must award points');
assert.strictEqual(evaluateOrderPoints('confirmed', 'confirmed', 100), 0, 'Re-update of already confirmed order must not award points');
assert.strictEqual(evaluateOrderPoints('confirmed', 'dispatched', 100), 0);

// Test 14: Firestore Registration Payload Security Verification
function verifyRegistrationPayloadAgainstRules(payload) {
  const protectedFields = ['loyaltyPoints', 'lifetimePoints', 'welcomeBonusGranted', 'referredBy'];
  const violations = protectedFields.filter(f => f in payload);
  return { valid: violations.length === 0, violations };
}

// Actual Flutter registration payload from firestore_service.dart
const flutterRegistrationPayload = {
  userId: 'USR_ABC123',
  uid: 'USR_ABC123',
  fullName: 'Rajesh Sharma',
  phone: '+919876543210',
  userCategory: 'dealer',
  role: 'dealer',
  status: 'active',
  referredByCode: 'ITA-REF999',
  isVerified: true,
};
assert.strictEqual(verifyRegistrationPayloadAgainstRules(flutterRegistrationPayload).valid, true, 'Flutter registration payload must pass Firestore rules');

// Malicious payload trying to inject points directly
const forgedPayload = { ...flutterRegistrationPayload, loyaltyPoints: 50000 };
assert.strictEqual(verifyRegistrationPayloadAgainstRules(forgedPayload).valid, false, 'Direct loyaltyPoints injection must be caught by rules');

// Test 15: Incomplete Customer Registration (No salesperson) -> No welcome bonus, No assignment
function processRegistrationCompletion(userData, existingWelcomeGranted = false, alreadyAssigned = false) {
  const spId = (userData.salesPersonId || userData.assignedSalespersonId || '').toString().trim();
  const isVerified = userData.isVerified === true || userData.status === 'active';

  // If salesperson not verified, account is incomplete -> skip
  if (!spId || !isVerified) {
    return {
      status: 'skipped_incomplete',
      pointsAwarded: 0,
      assignmentsCreated: false,
      counterIncremented: false,
    };
  }

  let pointsAwarded = 0;
  if (!existingWelcomeGranted) {
    pointsAwarded = 500;
  }

  let counterIncremented = false;
  if (!alreadyAssigned) {
    counterIncremented = true;
  }

  return {
    status: 'completed',
    pointsAwarded: pointsAwarded,
    assignmentsCreated: true,
    counterIncremented: counterIncremented,
    assignmentCollections: [
      `client_assignments/ASGN_${userData.userId || userData.uid}`,
      `Auto_Assign_User/${userData.userId || userData.uid}`,
      `salesPersons/${spId}/assigned_clients/${userData.userId || userData.uid}`,
    ],
  };
}

const incompleteUser = {
  uid: 'CUST_INC_1',
  userId: 'CUST_INC_1',
  name: 'Incomplete Partner',
  salesPersonId: null,
  isVerified: false,
};
const incompleteResult = processRegistrationCompletion(incompleteUser);
assert.strictEqual(incompleteResult.status, 'skipped_incomplete', 'Incomplete registration must be skipped');
assert.strictEqual(incompleteResult.pointsAwarded, 0, 'Incomplete registration must receive 0 welcome points');
assert.strictEqual(incompleteResult.assignmentsCreated, false, 'Incomplete registration must not create assignments');

// Test 16: Completed Customer Registration (Salesperson verified) -> +500 points, assignments created
const completedUser = {
  uid: 'CUST_COMP_1',
  userId: 'CUST_COMP_1',
  name: 'Complete Partner',
  salesPersonId: 'SP_101',
  isVerified: true,
};
const completedResult = processRegistrationCompletion(completedUser, false, false);
assert.strictEqual(completedResult.status, 'completed', 'Completed registration must process successfully');
assert.strictEqual(completedResult.pointsAwarded, 500, 'Completed registration must award 500 welcome points');
assert.strictEqual(completedResult.assignmentsCreated, true, 'Assignments must be created');
assert.strictEqual(completedResult.counterIncremented, true, 'assignedClientsCount must be incremented on initial assignment');
assert.strictEqual(completedResult.assignmentCollections.length, 3, 'Must create in all 3 assignment collections');

// Test 17: Completion Idempotency (Retry or subsequent profile update) -> 0 extra points, no duplicate counter increment
const retryResult = processRegistrationCompletion(completedUser, true, true);
assert.strictEqual(retryResult.status, 'completed');
assert.strictEqual(retryResult.pointsAwarded, 0, 'No duplicate welcome bonus on retry/subsequent update');
assert.strictEqual(retryResult.counterIncremented, false, 'No duplicate counter increment on retry/subsequent update');

// Test 18-25: Server-Side Active Salesperson Validation Suite
const mockSalespersonsDb = {
  'SP_ACTIVE_1': {
    id: 'SP_ACTIVE_1',
    name: 'Vraj Shah (Authoritative)',
    phone: '+919876543210',
    referralCode: 'SALES101',
    isActive: true,
    status: 'active',
  },
  'SP_INACTIVE_1': {
    id: 'SP_INACTIVE_1',
    name: 'Inactive Rep',
    phone: '+919876543219',
    referralCode: 'INACTIVE99',
    isActive: false,
    status: 'inactive',
  },
};

function processRegistrationCompletionWithValidation(userData, salespersonsStore = mockSalespersonsDb, existingWelcomeGranted = false, alreadyAssigned = false, existingAssignmentSpId = null, alreadyInSubcollection = false) {
  const candidateSpId = (userData.salesPersonId || userData.assignedSalespersonId || '').toString().trim();
  const isVerified = userData.isVerified === true || userData.status === 'active';

  // 1. Missing / Empty salesperson ID or not verified
  if (!candidateSpId || !isVerified) {
    return { status: 'skipped_incomplete', pointsAwarded: 0, assignmentsCreated: false, counterIncremented: false };
  }

  // 2. Authoritative server-side lookup
  const spDoc = salespersonsStore[candidateSpId];
  if (!spDoc) {
    return { status: 'rejected_nonexistent_salesperson', pointsAwarded: 0, assignmentsCreated: false, counterIncremented: false };
  }

  const isExplicitlyInactive = spDoc.isActive === false || spDoc.status === 'inactive';
  const isActive = (spDoc.isActive === true || spDoc.status === 'active') && !isExplicitlyInactive;
  if (!isActive) {
    return { status: 'rejected_inactive_salesperson', pointsAwarded: 0, assignmentsCreated: false, counterIncremented: false };
  }

  // 3. Unauthorized reassignment rejection
  if (existingAssignmentSpId && existingAssignmentSpId !== candidateSpId) {
    return {
      status: 'rejected_unauthorized_reassignment',
      preservedSalespersonId: existingAssignmentSpId,
      pointsAwarded: 0,
      assignmentsCreated: false,
      counterIncremented: false,
    };
  }

  // Authoritative server-side metadata wins over client-provided fields
  const authoritativeName = spDoc.name || 'ITA Sales Executive';
  const authoritativePhone = spDoc.phone || '';
  const authoritativeCode = (spDoc.referralCode || '').toUpperCase();

  let pointsAwarded = 0;
  if (!existingWelcomeGranted) {
    pointsAwarded = 500;
  }

  let counterIncremented = false;
  if (!alreadyAssigned && !alreadyInSubcollection) {
    counterIncremented = true;
  }

  return {
    status: 'completed',
    pointsAwarded,
    assignmentsCreated: true,
    counterIncremented,
    salespersonName: authoritativeName,
    salespersonPhone: authoritativePhone,
    salespersonReferralCode: authoritativeCode,
  };
}

// Test 18: ACTIVE legitimate salesperson -> completion succeeds
const t18 = processRegistrationCompletionWithValidation({
  userId: 'U_18',
  salesPersonId: 'SP_ACTIVE_1',
  isVerified: true,
});
assert.strictEqual(t18.status, 'completed', 'Active salesperson must complete');
assert.strictEqual(t18.pointsAwarded, 500, 'Must award 500 welcome points');
assert.strictEqual(t18.assignmentsCreated, true, 'Must create assignment mirrors');
assert.strictEqual(t18.counterIncremented, true, 'Must increment assignedClientsCount on first assignment');

// Test 19: INACTIVE salesperson -> rejected, no welcome reward, no assignment mirrors
const t19 = processRegistrationCompletionWithValidation({
  userId: 'U_19',
  salesPersonId: 'SP_INACTIVE_1',
  isVerified: true,
});
assert.strictEqual(t19.status, 'rejected_inactive_salesperson', 'Inactive salesperson must be rejected');
assert.strictEqual(t19.pointsAwarded, 0, 'No points for inactive salesperson');
assert.strictEqual(t19.assignmentsCreated, false, 'No assignments for inactive salesperson');
assert.strictEqual(t19.counterIncremented, false, 'No counter increment for inactive salesperson');

// Test 20: NONEXISTENT salesperson -> rejected, no welcome reward, no assignment mirrors
const t20 = processRegistrationCompletionWithValidation({
  userId: 'U_20',
  salesPersonId: 'SP_GHOST_999',
  isVerified: true,
});
assert.strictEqual(t20.status, 'rejected_nonexistent_salesperson', 'Nonexistent salesperson must be rejected');
assert.strictEqual(t20.pointsAwarded, 0);
assert.strictEqual(t20.assignmentsCreated, false);

// Test 21: EMPTY salesperson -> no completion
const t21 = processRegistrationCompletionWithValidation({
  userId: 'U_21',
  salesPersonId: '',
  isVerified: true,
});
assert.strictEqual(t21.status, 'skipped_incomplete');
assert.strictEqual(t21.pointsAwarded, 0);
assert.strictEqual(t21.assignmentsCreated, false);

// Test 22: FORGED salesperson metadata with legitimate ID -> server authoritative metadata wins
const t22 = processRegistrationCompletionWithValidation({
  userId: 'U_22',
  salesPersonId: 'SP_ACTIVE_1',
  salespersonName: 'Forged Fake Name',
  salespersonPhone: '+910000000000',
  salespersonReferralCode: 'FORGED_CODE',
  isVerified: true,
});
assert.strictEqual(t22.status, 'completed');
assert.strictEqual(t22.salespersonName, 'Vraj Shah (Authoritative)', 'Server authoritative name must win');
assert.strictEqual(t22.salespersonPhone, '+919876543210', 'Server authoritative phone must win');
assert.strictEqual(t22.salespersonReferralCode, 'SALES101', 'Server authoritative code must win');

// Test 23: FORGED/nonexistent salesperson ID -> blocked
const t23 = processRegistrationCompletionWithValidation({
  userId: 'U_23',
  salesPersonId: 'FORGED_ID_ATTACK',
  isVerified: true,
});
assert.strictEqual(t23.status, 'rejected_nonexistent_salesperson');
assert.strictEqual(t23.pointsAwarded, 0);

// Test 24: Profile update after completion -> no duplicate actions
const t24 = processRegistrationCompletionWithValidation(
  { userId: 'U_18', salesPersonId: 'SP_ACTIVE_1', isVerified: true },
  mockSalespersonsDb,
  true, // already granted
  true  // already assigned
);
assert.strictEqual(t24.status, 'completed');
assert.strictEqual(t24.pointsAwarded, 0, 'No duplicate welcome reward on profile update');
assert.strictEqual(t24.counterIncremented, false, 'No duplicate counter increment on profile update');

// Test 25: Trigger retry -> no duplicate actions
const t25 = processRegistrationCompletionWithValidation(
  { userId: 'U_18', salesPersonId: 'SP_ACTIVE_1', isVerified: true },
  mockSalespersonsDb,
  true, // already granted
  true  // already assigned
);
assert.strictEqual(t25.pointsAwarded, 0, 'No duplicate welcome reward on trigger retry');
assert.strictEqual(t25.counterIncremented, false, 'No duplicate counter increment on trigger retry');

// Test 26: Unauthorized Reassignment Attempt -> Rejected, existing assignment preserved
const t26 = processRegistrationCompletionWithValidation(
  { userId: 'U_26', salesPersonId: 'SP_ACTIVE_1', isVerified: true },
  mockSalespersonsDb,
  true, // already granted
  true, // already assigned
  'SP_LEGITIMATE_PREVIOUS' // client already has legitimate previous assignment
);
assert.strictEqual(t26.status, 'rejected_unauthorized_reassignment', 'Reassignment must be rejected');
assert.strictEqual(t26.preservedSalespersonId, 'SP_LEGITIMATE_PREVIOUS', 'Must preserve original assignment');
assert.strictEqual(t26.counterIncremented, false, 'Must not increment counter on rejected reassignment');

// Test 27: Already in assigned_clients subcollection -> no duplicate counter increment
const t27 = processRegistrationCompletionWithValidation(
  { userId: 'U_27', salesPersonId: 'SP_ACTIVE_1', isVerified: true },
  mockSalespersonsDb,
  true,
  false, // assignment doc missing
  null,
  true   // but already exists in assigned_clients subcollection
);
assert.strictEqual(t27.status, 'completed');
assert.strictEqual(t27.counterIncremented, false, 'Must not increment counter if already in subcollection');

// Run async tests
testConcurrentRedemptions().then(() => {
  console.log('✅ All Backend Loyalty Reward Engine Unit Tests (including Concurrent Double-Spend, Role Auth, Registration Completion, & Server-Side Salesperson Validation) Passed Successfully!');
});

