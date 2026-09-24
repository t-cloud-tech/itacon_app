const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Default remote reward configuration fallback
 */
const DEFAULT_LOYALTY_CONFIG = {
  signupBonusPoints: 500,
  referralSignupPoints: 500,
  successfulOrderReward: 5555.0,
  pointsPerBox: 10,
  minimumRedemptionPoints: 50000,
  rupeesPerPoint: 0.50,
};

/**
 * Reads active reward configuration from `loyaltyConfig/current` or returns defaults
 */
async function getLoyaltyConfig(db) {
  try {
    const configSnap = await db.collection('loyaltyConfig').doc('current').get();
    if (configSnap.exists && configSnap.data()) {
      const data = configSnap.data();
      return {
        signupBonusPoints: Number(data.signupBonusPoints) || DEFAULT_LOYALTY_CONFIG.signupBonusPoints,
        referralSignupPoints: Number(data.referralSignupPoints) || DEFAULT_LOYALTY_CONFIG.referralSignupPoints,
        successfulOrderReward: Number(data.successfulOrderReward) || DEFAULT_LOYALTY_CONFIG.successfulOrderReward,
        pointsPerBox: Number(data.pointsPerBox) || DEFAULT_LOYALTY_CONFIG.pointsPerBox,
        minimumRedemptionPoints: Number(data.minimumRedemptionPoints) || DEFAULT_LOYALTY_CONFIG.minimumRedemptionPoints,
        rupeesPerPoint: Number(data.rupeesPerPoint) || DEFAULT_LOYALTY_CONFIG.rupeesPerPoint,
      };
    }
  } catch (err) {
    console.warn('[RewardEngine] Could not read loyaltyConfig/current, using defaults:', err.message);
  }
  return DEFAULT_LOYALTY_CONFIG;
}

/**
 * Cloud Function Trigger: onUserCreatedReward
 * Triggered on `users/{userId}` creation.
 * Idempotently awards 500 Welcome Points once, and processes referral step 1 if referredByCode is present.
 */
exports.onUserCreatedReward = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    const userData = snap.data();

    if (!userData) {
      console.log(`[RewardEngine] Empty user data for user ${userId}. Skipping.`);
      return null;
    }

    const db = admin.firestore();
    const config = await getLoyaltyConfig(db);

    console.log(`[RewardEngine] Processing welcome reward & referral for user ${userId}`);

    try {
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) return;
        const currentData = userDoc.data() || {};

        // 1. Welcome Bonus Check (Must run exactly once)
        if (currentData.welcomeBonusGranted === true) {
          console.log(`[RewardEngine] User ${userId} already received welcome bonus. Skipping.`);
          return;
        }

        const welcomeTxRef = db.collection('loyaltyTransactions').doc(`welcome_${userId}`);
        const welcomeTxDoc = await transaction.get(welcomeTxRef);
        if (welcomeTxDoc.exists) {
          console.log(`[RewardEngine] Welcome transaction already exists for user ${userId}. Skipping.`);
          transaction.set(userRef, { welcomeBonusGranted: true }, { merge: true });
          return;
        }

        let userPoints = Number(currentData.loyaltyPoints) || 0;
        let userLifetime = Number(currentData.lifetimePoints) || userPoints;

        userPoints += config.signupBonusPoints;
        userLifetime += config.signupBonusPoints;

        // Record Welcome Transaction
        transaction.set(welcomeTxRef, {
          transactionId: welcomeTxRef.id,
          userId: userId,
          type: 'welcome_bonus',
          points: config.signupBonusPoints,
          balanceAfter: userPoints,
          description: 'Welcome bonus on joining ITACON Granito',
          status: 'completed',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2. Referral Step 1: If user registered with a referral code
        const referredByCode = (
          currentData.referredByCode ||
          currentData.referralCodeEntered ||
          currentData.registeredWithReferralCode
        );

        let referrerUid = null;
        let referralDocId = null;

        if (referredByCode && typeof referredByCode === 'string' && referredByCode.trim().length > 0) {
          const cleanCode = referredByCode.trim().toUpperCase();

          // Prevent self-referral
          if (cleanCode !== (currentData.referralCode || '').toUpperCase()) {
            // Find owner of referralCode
            const referrerQuery = await db.collection('users')
              .where('referralCode', '==', cleanCode)
              .limit(1)
              .get();

            if (!referrerQuery.empty) {
              const referrerDoc = referrerQuery.docs[0];
              const rUid = referrerDoc.id;

              if (rUid !== userId) {
                referrerUid = rUid;
                const referrerData = referrerDoc.data() || {};

                // Ensure referral document does not already exist
                const refQuery = await db.collection('referrals')
                  .where('referredUid', '==', userId)
                  .limit(1)
                  .get();

                if (refQuery.empty) {
                  const refDocRef = db.collection('referrals').doc();
                  referralDocId = refDocRef.id;

                  // Create referral record
                  transaction.set(refDocRef, {
                    referrerUid: referrerUid,
                    referredUid: userId,
                    referralCode: cleanCode,
                    signupRewardPoints: config.referralSignupPoints,
                    orderRewardAmount: config.successfulOrderReward,
                    status: 'signed_up',
                    qualifyingOrderId: null,
                    signupRewardGranted: true,
                    orderRewardGranted: false,
                    referredCustomerName: currentData.name || '',
                    referredCustomerPhone: currentData.phone || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  // Credit Referrer +500 points
                  const refTxRef = db.collection('loyaltyTransactions').doc(`ref_signup_${refDocRef.id}`);
                  const referrerPoints = (Number(referrerData.loyaltyPoints) || 0) + config.referralSignupPoints;
                  const referrerLifetime = (Number(referrerData.lifetimePoints) || (Number(referrerData.loyaltyPoints) || 0)) + config.referralSignupPoints;

                  transaction.set(refTxRef, {
                    transactionId: refTxRef.id,
                    userId: referrerUid,
                    type: 'referral_signup',
                    points: config.referralSignupPoints,
                    balanceAfter: referrerPoints,
                    relatedReferralId: refDocRef.id,
                    description: `Referral sign-up reward for inviting ${currentData.name || 'Trade Partner'}`,
                    status: 'completed',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  transaction.set(referrerDoc.ref, {
                    loyaltyPoints: referrerPoints,
                    lifetimePoints: referrerLifetime,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  }, { merge: true });

                  // Create notification for referrer
                  const notifRef = db.collection('users').doc(referrerUid).collection('notifications').doc();
                  transaction.set(notifRef, {
                    title: 'New Trade Referral! 🎉',
                    message: `${currentData.name || 'A new partner'} registered using your referral code. +500 Loyalty Points credited to your account!`,
                    type: 'referral_signup',
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                }
              }
            }
          }
        }

        // Finalize User document update
        transaction.set(userRef, {
          loyaltyPoints: userPoints,
          lifetimePoints: userLifetime,
          welcomeBonusGranted: true,
          ifReferrer: referrerUid ? { referredBy: referrerUid } : {},
          ...(referrerUid ? { referredBy: referrerUid } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`[RewardEngine] Successfully granted welcome bonus to user ${userId} and processed referral.`);
      });
    } catch (error) {
      console.error(`[RewardEngine] Error processing user welcome reward for ${userId}:`, error);
      throw error;
    }

    return null;
  });

/**
 * Cloud Function Trigger: onOrderStatusChangedRewards
 * Triggered when an Order in `orders/{orderId}` is created or updated.
 *
 * Rules:
 * 1. Purchase Loyalty Points: When order first becomes `status === 'confirmed'` with `totalBoxes > 0`,
 *    awards `totalBoxes * pointsPerBox` points to customer. Idempotent key `purchase_order_${orderId}`.
 * 2. Referral Step 2 Qualification: When referred customer places first qualifying order (`status === 'confirmed'`,
 *    `totalBoxes > 0`, valid totals), referral status becomes `reward_pending` (eligible for ₹5,555).
 *    Does NOT automatically approve/pay ₹5,555; keeps it pending for admin/business approval.
 */
exports.onOrderStatusChangedRewards = functions.firestore
  .document('orders/{orderId}')
  .onWrite(async (change, context) => {
    const orderId = context.params.orderId;
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;

    if (!afterData) return null; // Order deleted

    // Only process if status is 'confirmed'
    if (afterData.status !== 'confirmed') {
      return null;
    }

    // If order was already confirmed previously, check if purchase points were already processed
    const db = admin.firestore();
    const config = await getLoyaltyConfig(db);
    const userId = afterData.userId;
    const totalBoxes = Number(afterData.totalBoxes) || 0;
    const totalAmount = Number(afterData.totalAmount || afterData.total) || 0;

    if (!userId || totalBoxes <= 0) {
      console.log(`[RewardEngine] Order ${orderId} does not qualify (boxes: ${totalBoxes}, userId: ${userId}).`);
      return null;
    }

    // =========================================================================
    // PART 1: Idempotent Purchase Loyalty Points (10 points per box)
    // =========================================================================
    const purchaseTxRef = db.collection('loyaltyTransactions').doc(`purchase_order_${orderId}`);

    try {
      await db.runTransaction(async (transaction) => {
        const existingTx = await transaction.get(purchaseTxRef);
        if (existingTx.exists) {
          console.log(`[RewardEngine] Purchase points already granted for order ${orderId}. Skipping.`);
          return;
        }

        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) return;

        const userData = userDoc.data() || {};
        const pointsToAward = totalBoxes * config.pointsPerBox;
        const currentPoints = Number(userData.loyaltyPoints) || 0;
        const currentLifetime = Number(userData.lifetimePoints) || currentPoints;

        const newPoints = currentPoints + pointsToAward;
        const newLifetime = currentLifetime + pointsToAward;

        transaction.set(purchaseTxRef, {
          transactionId: purchaseTxRef.id,
          userId: userId,
          orderId: orderId,
          relatedOrderId: orderId,
          type: 'purchase_points',
          points: pointsToAward,
          balanceAfter: newPoints,
          description: `Purchase loyalty points for Order ${afterData.orderReference || orderId} (${totalBoxes} boxes)`,
          status: 'completed',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.set(userRef, {
          loyaltyPoints: newPoints,
          lifetimePoints: newLifetime,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`[RewardEngine] Awarded ${pointsToAward} purchase points to ${userId} for order ${orderId}`);
      });
    } catch (err) {
      console.error(`[RewardEngine] Error awarding purchase points for order ${orderId}:`, err);
    }

    // =========================================================================
    // PART 2: Referral Step 2 — ₹5,555 Qualification (status = reward_pending)
    // =========================================================================
    try {
      const referralSnap = await db.collection('referrals')
        .where('referredUid', '==', userId)
        .where('orderRewardGranted', '==', false)
        .limit(1)
        .get();

      if (!referralSnap.empty) {
        const refDoc = referralSnap.docs[0];
        const refData = refDoc.data();

        // Ensure order is a genuine valid qualifying order
        if (totalBoxes > 0 && totalAmount > 0) {
          console.log(`[RewardEngine] Referral ${refDoc.id} qualified by order ${orderId}! Setting status=reward_pending`);

          await db.runTransaction(async (transaction) => {
            transaction.update(refDoc.ref, {
              status: 'reward_pending', // Awaiting backend/admin business approval
              qualifyingOrderId: orderId,
              orderRewardGranted: true,
              qualifiedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Notify referrer of the pending ₹5,555 reward
            if (refData.referrerUid) {
              const notifRef = db.collection('users').doc(refData.referrerUid).collection('notifications').doc();
              transaction.set(notifRef, {
                title: 'Referral Order Qualified! 🌟',
                message: `Your referred partner completed a qualifying order! Your ₹${config.successfulOrderReward.toLocaleString('en-IN')} referral reward is now pending approval.`,
                type: 'referral_order_qualified',
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
          });
        }
      }
    } catch (err) {
      console.error(`[RewardEngine] Error checking referral qualification for order ${orderId}:`, err);
    }

    return null;
  });

/**
 * Cloud Function Callable: submitLoyaltyRedemptionCallable
 * Authoritative backend redemption processing.
 *
 * Rules:
 * - Requires authenticated user
 * - Fetches balance and config server-side (never trusts client rupeeAmount or balance)
 * - Validates minimum 50,000 points threshold
 * - Atomically checks balance and prevents concurrent double-spending via Firestore transaction
 * - Creates redemption doc in `loyaltyRedemptions/{id}`
 * - Atomically reserves/deducts points and records a ledger transaction in `loyaltyTransactions`
 */
exports.submitLoyaltyRedemptionCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to request redemption.');
  }

  const userId = context.auth.uid;
  const requestedPoints = Math.floor(Number(data && data.requestedPoints));
  const bankDetails = (data && data.bankDetails) ? String(data.bankDetails).trim() : '';
  const upiId = (data && data.upiId) ? String(data.upiId).trim() : '';

  if (!requestedPoints || requestedPoints <= 0 || !Number.isInteger(requestedPoints)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid integer requestedPoints is required.');
  }

  const db = admin.firestore();
  const config = await getLoyaltyConfig(db);

  if (requestedPoints < config.minimumRedemptionPoints) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Minimum redemption threshold is ${config.minimumRedemptionPoints.toLocaleString('en-IN')} points.`
    );
  }

  return await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User record not found.');
    }

    const userData = userDoc.data() || {};
    const currentPoints = Number(userData.loyaltyPoints) || 0;

    // Concurrency / balance check
    if (currentPoints < requestedPoints) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Insufficient points balance. Available: ${currentPoints}, Requested: ${requestedPoints}.`
      );
    }

    // Server-side calculation of rupee amount (1 point = ₹0.50)
    const rupeeAmount = Math.round(requestedPoints * config.rupeesPerPoint * 100) / 100;
    const newBalance = currentPoints - requestedPoints;

    // 1. Create redemption document in `loyaltyRedemptions/{redemptionId}`
    const redemptionRef = db.collection('loyaltyRedemptions').doc();
    const redemptionId = redemptionRef.id;

    transaction.set(redemptionRef, {
      id: redemptionId,
      redemptionId: redemptionId,
      userId: userId,
      userName: userData.name || userData.fullName || '',
      userPhone: userData.phone || userData.phoneNumber || '',
      userCategory: userData.userCategory || userData.role || '',
      pointsRequested: requestedPoints,
      rupeesAmount: rupeeAmount,
      status: 'pending',
      source: 'callable',
      pointsDeducted: true,
      bankDetails: bankDetails,
      upiId: upiId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Atomically deduct points from user profile
    transaction.update(userRef, {
      loyaltyPoints: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Atomically create loyalty ledger transaction record
    const ledgerRef = db.collection('loyaltyTransactions').doc(`redemption_${redemptionId}`);
    transaction.set(ledgerRef, {
      transactionId: ledgerRef.id,
      userId: userId,
      type: 'redemption',
      points: -requestedPoints,
      balanceAfter: newBalance,
      referenceId: redemptionId,
      relatedRedemptionId: redemptionId,
      description: `Points redemption request for ₹${rupeeAmount.toLocaleString('en-IN')}`,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      redemptionId: redemptionId,
      pointsRedeemed: requestedPoints,
      rupeesAmount: rupeeAmount,
      balanceAfter: newBalance,
    };
  });
});

/**
 * Cloud Function Trigger: onRedemptionRequestCreated
 * Triggered on `loyaltyRedemptions/{redemptionId}` onCreate.
 * For callable-created redemptions, points are already reserved atomically.
 * This trigger handles audit logging and admin notifications.
 */
exports.onRedemptionRequestCreated = functions.firestore
  .document('loyaltyRedemptions/{redemptionId}')
  .onCreate(async (snap, context) => {
    const redemptionId = context.params.redemptionId;
    const redemptionData = snap.data();

    if (!redemptionData) return null;

    // If points already deducted by callable, skip deduction and only notify
    if (redemptionData.pointsDeducted || redemptionData.source === 'callable') {
      console.log(`[RewardEngine] Redemption ${redemptionId} already processed via callable. Logged.`);
      return null;
    }

    const db = admin.firestore();
    const config = await getLoyaltyConfig(db);
    const userId = redemptionData.userId;
    const requestedPoints = Number(redemptionData.requestedPoints) || 0;

    console.log(`[RewardEngine] Processing background redemption request ${redemptionId} for user ${userId} (${requestedPoints} pts)`);

    try {
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          transaction.update(snap.ref, {
            status: 'rejected',
            adminRemarks: 'User profile does not exist.',
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return;
        }

        const userData = userDoc.data() || {};
        const availablePoints = Number(userData.loyaltyPoints) || 0;

        // Verify minimum threshold and sufficient balance
        if (requestedPoints < config.minimumRedemptionPoints || availablePoints < requestedPoints) {
          console.warn(`[RewardEngine] Insufficient points for user ${userId}: available ${availablePoints}, requested ${requestedPoints}`);
          transaction.update(snap.ref, {
            status: 'rejected',
            adminRemarks: `Insufficient points. Required min ${config.minimumRedemptionPoints} pts, available: ${availablePoints} pts.`,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return;
        }

        // Deduct points atomically
        const newBalance = availablePoints - requestedPoints;
        const rupeeValue = requestedPoints * config.rupeesPerPoint;

        transaction.update(userRef, {
          loyaltyPoints: newBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Record redemption transaction
        const txRef = db.collection('loyaltyTransactions').doc(`redemption_${redemptionId}`);
        transaction.set(txRef, {
          transactionId: txRef.id,
          userId: userId,
          type: 'redemption',
          points: -requestedPoints,
          balanceAfter: newBalance,
          description: `Points redemption request for ₹${rupeeValue.toLocaleString('en-IN')}`,
          status: 'pending_payout',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update redemption record
        transaction.update(snap.ref, {
          status: 'pending',
          rupeesAmount: rupeeValue,
          pointsDeducted: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[RewardEngine] Successfully processed redemption ${redemptionId} for user ${userId}. New balance: ${newBalance}`);
      });
    } catch (err) {
      console.error(`[RewardEngine] Error processing redemption ${redemptionId}:`, err);
      throw err;
    }

    return null;
  });

/**
 * Cloud Function Callable: submitReferralCodeCallable
 * Allows an authenticated customer to link a referral code safely during initial onboarding.
 *
 * Constraints:
 * - Customer must be in initial onboarding (within 24 hours of account creation)
 * - Customer must NOT have any existing orders
 * - Customer must NOT have an existing referredBy or referral relationship
 * - Not self-referral
 */
exports.submitReferralCodeCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const userId = context.auth.uid;
  const rawCode = (data && data.referralCode) ? String(data.referralCode).trim().toUpperCase() : '';

  if (!rawCode) {
    throw new functions.https.HttpsError('invalid-argument', 'Referral code cannot be empty.');
  }

  const db = admin.firestore();
  const config = await getLoyaltyConfig(db);

  // 1. Check if user already placed any orders
  const ordersSnap = await db.collection('orders')
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!ordersSnap.empty) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Referral codes can only be linked during new account registration, before placing orders.'
    );
  }

  return await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }

    const userData = userDoc.data() || {};

    // 2. Check onboarding window (within 24 hours of registration)
    if (userData.createdAt) {
      const createdDate = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
      const ONBOARDING_WINDOW_MS = 24 * 60 * 60 * 1000;
      if (Date.now() - createdDate.getTime() > ONBOARDING_WINDOW_MS) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Referral code linking is only allowed during initial onboarding (within 24 hours of account creation).'
        );
      }
    }

    // 3. Prevent self-referral
    if (userData.referralCode && userData.referralCode.toUpperCase() === rawCode) {
      throw new functions.https.HttpsError('failed-precondition', 'You cannot use your own referral code.');
    }

    // 4. Prevent changing referredBy if already referred
    if (userData.referredBy) {
      throw new functions.https.HttpsError('already-exists', 'You have already linked a referral code.');
    }

    // 5. Find owner of referral code
    const referrerQuery = await db.collection('users')
      .where('referralCode', '==', rawCode)
      .limit(1)
      .get();

    if (referrerQuery.empty) {
      throw new functions.https.HttpsError('not-found', 'Invalid referral code. Please check and try again.');
    }

    const referrerDoc = referrerQuery.docs[0];
    const referrerUid = referrerDoc.id;

    if (referrerUid === userId) {
      throw new functions.https.HttpsError('failed-precondition', 'You cannot refer yourself.');
    }

    // 6. Ensure no existing referral doc
    const refExisting = await db.collection('referrals')
      .where('referredUid', '==', userId)
      .limit(1)
      .get();

    if (!refExisting.empty) {
      throw new functions.https.HttpsError('already-exists', 'A referral already exists for your account.');
    }

    // 7. Create referral doc
    const refDocRef = db.collection('referrals').doc();
    transaction.set(refDocRef, {
      referrerUid: referrerUid,
      referredUid: userId,
      referralCode: rawCode,
      signupRewardPoints: config.referralSignupPoints,
      orderRewardAmount: config.successfulOrderReward,
      status: 'signed_up',
      qualifyingOrderId: null,
      signupRewardGranted: true,
      orderRewardGranted: false,
      referredCustomerName: userData.name || '',
      referredCustomerPhone: userData.phone || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 8. Credit Referrer +500 points
    const referrerData = referrerDoc.data() || {};
    const referrerPoints = (Number(referrerData.loyaltyPoints) || 0) + config.referralSignupPoints;
    const referrerLifetime = (Number(referrerData.lifetimePoints) || (Number(referrerData.loyaltyPoints) || 0)) + config.referralSignupPoints;

    const refTxRef = db.collection('loyaltyTransactions').doc(`ref_signup_${refDocRef.id}`);
    transaction.set(refTxRef, {
      transactionId: refTxRef.id,
      userId: referrerUid,
      type: 'referral_signup',
      points: config.referralSignupPoints,
      balanceAfter: referrerPoints,
      relatedReferralId: refDocRef.id,
      description: `Referral sign-up reward for inviting ${userData.name || 'Trade Partner'}`,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(referrerDoc.ref, {
      loyaltyPoints: referrerPoints,
      lifetimePoints: referrerLifetime,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 9. Update User with referredBy
    transaction.set(userRef, {
      referredBy: referrerUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, message: 'Referral code linked successfully!' };
  });
});

/**
 * Cloud Function Callable: approveReferralOrderRewardCallable
 * Authorized backend/admin callable to approve a ₹5,555 referral order reward.
 * Strictly verifies that the caller has an Admin or Salesperson role.
 */
exports.approveReferralOrderRewardCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = admin.firestore();
  const callerUid = context.auth.uid;

  // Verify caller's role from trusted database record and token claims
  const callerDoc = await db.collection('users').doc(callerUid).get();
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Caller user record not found.');
  }

  const callerData = callerDoc.data() || {};
  const callerRole = String(callerData.role || '').toLowerCase();
  const callerCategory = String(callerData.userCategory || '').toLowerCase();
  const tokenRole = String(context.auth.token.role || '').toLowerCase();

  const isAuthorized =
    context.auth.token.admin === true ||
    tokenRole === 'admin' ||
    tokenRole === 'salesperson' ||
    callerData.isAdmin === true ||
    callerRole === 'admin' ||
    callerRole === 'salesperson' ||
    callerRole === 'manager' ||
    callerCategory === 'admin' ||
    callerCategory === 'salesperson';

  if (!isAuthorized) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Permission denied. Only authorized Admin or Salesperson personnel can approve referral rewards.'
    );
  }

  const referralId = data ? data.referralId : null;
  if (!referralId) {
    throw new functions.https.HttpsError('invalid-argument', 'referralId is required.');
  }

  const refDocRef = db.collection('referrals').doc(referralId);
  const snap = await refDocRef.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Referral document not found.');
  }

  const refData = snap.data();
  if (refData.status !== 'reward_pending') {
    throw new functions.https.HttpsError('failed-precondition', `Cannot approve referral in status: ${refData.status}`);
  }

  await refDocRef.update({
    status: 'reward_approved',
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvedBy: callerUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Notify referrer
  if (refData.referrerUid) {
    await db.collection('users').doc(refData.referrerUid).collection('notifications').add({
      title: 'Referral Reward Approved! 💰',
      message: `Your ₹${(refData.orderRewardAmount || 5555).toLocaleString('en-IN')} referral reward for qualifying order has been approved!`,
      type: 'referral_reward_approved',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { success: true, status: 'reward_approved' };
});
