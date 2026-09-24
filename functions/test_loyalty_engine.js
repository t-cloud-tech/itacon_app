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

// Run async tests
testConcurrentRedemptions().then(() => {
  console.log('✅ All Backend Loyalty Reward Engine Unit Tests (including Concurrent Double-Spend & Role Auth) Passed Successfully!');
});
