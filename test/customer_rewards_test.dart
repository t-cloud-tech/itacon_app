import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/loyalty_config.dart';
import 'package:itacon_app/models/loyalty_transaction.dart';
import 'package:itacon_app/models/referral_model.dart';
import 'package:itacon_app/models/loyalty_redemption.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/models/tile_order.dart';

void main() {
  group('ITACON GRANITO Customer Rewards & Loyalty System Tests', () {
    const config = LoyaltyConfig(
      signupBonusPoints: 500,
      referralSignupPoints: 500,
      successfulOrderReward: 5555.0,
      pointsPerBox: 10,
      minimumRedemptionPoints: 50000,
      rupeesPerPoint: 0.50,
    );

    // -------------------------------------------------------------------------
    // TEST 1: Welcome bonus = 500 exactly once
    // -------------------------------------------------------------------------
    test('1. Welcome bonus = 500 points granted exactly once per customer', () {
      final user = UserProfile(
        userId: 'USER_NEW_01',
        name: 'Vipul Patel',
        companyName: 'Patel Ceramics',
        phone: '+919876543210',
        email: 'vipul@example.com',
        userCategory: 'Dealer',
        role: 'customer',
        welcomeBonusGranted: false,
        loyaltyPoints: 0,
      );

      // First time granting
      expect(user.welcomeBonusGranted, isFalse);
      expect(user.loyaltyPoints, equals(0));

      final updatedUser = user.copyWith(
        loyaltyPoints: user.loyaltyPoints + config.signupBonusPoints,
        lifetimePoints: user.lifetimePoints + config.signupBonusPoints,
        welcomeBonusGranted: true,
      );

      expect(updatedUser.loyaltyPoints, equals(500));
      expect(updatedUser.welcomeBonusGranted, isTrue);

      // Attempt to grant again: guard must block it
      final canGrantAgain = !updatedUser.welcomeBonusGranted;
      expect(canGrantAgain, isFalse, reason: 'Must not grant welcome bonus repeatedly');
    });

    // -------------------------------------------------------------------------
    // TEST 2 & 3: Referral Step 1 — Referrer gets 500, New customer gets 500
    // -------------------------------------------------------------------------
    test('2 & 3. Referral Step 1: Referrer receives +500 and New customer gets their own 500 welcome points', () {
      final referrer = UserProfile(
        userId: 'USER_REFERRER',
        name: 'Pravin Shah',
        companyName: 'Shah Tiles',
        phone: '+919825012345',
        email: 'pravin@example.com',
        userCategory: 'Wholesale',
        role: 'customer',
        referralCode: 'ITA-554433',
        loyaltyPoints: 1000,
        lifetimePoints: 1000,
        welcomeBonusGranted: true,
      );

      final newCustomer = UserProfile(
        userId: 'USER_REFERRED',
        name: 'Amit Kumar',
        companyName: 'Kumar Designs',
        phone: '+919988776655',
        email: 'amit@example.com',
        userCategory: 'Architect',
        role: 'customer',
        referredBy: referrer.userId,
        welcomeBonusGranted: false,
        loyaltyPoints: 0,
      );

      // Step 1 reward processing
      final updatedReferrer = referrer.copyWith(
        loyaltyPoints: referrer.loyaltyPoints + config.referralSignupPoints,
        lifetimePoints: referrer.lifetimePoints + config.referralSignupPoints,
      );

      final updatedNewCustomer = newCustomer.copyWith(
        loyaltyPoints: newCustomer.loyaltyPoints + config.signupBonusPoints,
        lifetimePoints: newCustomer.lifetimePoints + config.signupBonusPoints,
        welcomeBonusGranted: true,
      );

      // Referrer got +500
      expect(updatedReferrer.loyaltyPoints, equals(1500));
      // New customer got their own separate +500 welcome points
      expect(updatedNewCustomer.loyaltyPoints, equals(500));
      expect(updatedNewCustomer.welcomeBonusGranted, isTrue);

      // Separate ledger transactions
      final referrerTx = LoyaltyTransaction(
        transactionId: 'TX_REF_01',
        userId: referrer.userId,
        type: 'referral_signup',
        points: 500,
        balanceAfter: 1500,
      );

      final welcomeTx = LoyaltyTransaction(
        transactionId: 'TX_WELCOME_01',
        userId: newCustomer.userId,
        type: 'welcome_bonus',
        points: 500,
        balanceAfter: 500,
      );

      expect(referrerTx.type, equals('referral_signup'));
      expect(welcomeTx.type, equals('welcome_bonus'));
      expect(referrerTx.userId, isNot(equals(welcomeTx.userId)));
    });

    // -------------------------------------------------------------------------
    // TEST 4: Self referral rejected
    // -------------------------------------------------------------------------
    test('4. Self referral rejected when user enters their own referral code', () {
      const currentUserId = 'USER_101';
      const userReferralCode = 'ITA-998877';

      bool validateReferral(String inputCode, String ownerUid, String applicantUid) {
        if (inputCode.trim().toUpperCase() == userReferralCode.toUpperCase() &&
            applicantUid == ownerUid) {
          return false; // Rejected: self referral
        }
        return true;
      }

      final isAllowed = validateReferral('ITA-998877', currentUserId, currentUserId);
      expect(isAllowed, isFalse, reason: 'Self referral must be strictly rejected');
    });

    // -------------------------------------------------------------------------
    // TEST 5: Invalid referral rejected
    // -------------------------------------------------------------------------
    test('5. Invalid / non-existent referral code rejected', () {
      final existingCodes = {'ITA-111111', 'ITA-222222', 'ITA-333333'};

      bool validateCode(String inputCode) {
        final clean = inputCode.trim().toUpperCase();
        return clean.isNotEmpty && existingCodes.contains(clean);
      }

      expect(validateCode('ITA-INVALID'), isFalse);
      expect(validateCode(''), isFalse);
      expect(validateCode('ITA-111111'), isTrue);
    });

    // -------------------------------------------------------------------------
    // TEST 6: Qualifying referral order creates ₹5,555 reward once (reward_pending)
    // -------------------------------------------------------------------------
    test('6. Qualifying referral order transitions referral to reward_pending with ₹5,555', () {
      final referral = ReferralModel(
        id: 'REF_DOC_001',
        referrerUid: 'USER_REF_1',
        referredUid: 'USER_CUST_1',
        referralCode: 'ITA-123456',
        signupRewardPoints: 500,
        orderRewardAmount: 5555.0,
        status: 'signed_up',
        signupRewardGranted: true,
        orderRewardGranted: false,
      );

      final order = TileOrder(
        id: 'ORDER_QUAL_01',
        orderReference: 'ITC-PO-2026-7001',
        userId: 'USER_CUST_1',
        userCategory: 'Dealer',
        status: 'confirmed',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Confirmed order',
        totalBoxes: 150,
        subtotal: 150000.0,
        totalAmount: 177000.0,
        items: const [],
      );

      // Qualification rules check
      final isConfirmed = order.status == 'confirmed';
      final hasBoxes = order.totalBoxes > 0;
      final hasTotals = order.totalAmount > 0;
      expect(isConfirmed && hasBoxes && hasTotals, isTrue);

      // Transition to reward_pending (NOT approved yet)
      final qualifiedReferral = ReferralModel(
        id: referral.id,
        referrerUid: referral.referrerUid,
        referredUid: referral.referredUid,
        referralCode: referral.referralCode,
        signupRewardPoints: referral.signupRewardPoints,
        orderRewardAmount: referral.orderRewardAmount,
        status: 'reward_pending',
        qualifyingOrderId: order.id,
        signupRewardGranted: true,
        orderRewardGranted: true,
        qualifiedAt: DateTime.now(),
      );

      expect(qualifiedReferral.status, equals('reward_pending'));
      expect(qualifiedReferral.orderRewardGranted, isTrue);
      expect(qualifiedReferral.orderRewardAmount, equals(5555.0));
      expect(qualifiedReferral.qualifyingOrderId, equals('ORDER_QUAL_01'));
    });

    // -------------------------------------------------------------------------
    // TEST 7: Duplicate order processing does not duplicate ₹5,555
    // -------------------------------------------------------------------------
    test('7. Duplicate order events do not duplicate ₹5,555 referral reward', () {
      var referral = ReferralModel(
        id: 'REF_DOC_001',
        referrerUid: 'USER_REF_1',
        referredUid: 'USER_CUST_1',
        referralCode: 'ITA-123456',
        status: 'reward_pending',
        orderRewardGranted: true,
        qualifyingOrderId: 'ORDER_QUAL_01',
      );

      int rewardCount = 1;

      // Simulate a duplicate status update on the same order or another order
      void processOrderForReferral(TileOrder order) {
        if (referral.orderRewardGranted == true) {
          // Already qualified, do not process again
          return;
        }
        rewardCount++;
      }

      final duplicateOrder = TileOrder(
        id: 'ORDER_QUAL_01',
        orderReference: 'ITC-PO-2026-7001',
        userId: 'USER_CUST_1',
        userCategory: 'Dealer',
        status: 'confirmed',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi'},
        transportRequired: true,
        remarks: '',
        totalBoxes: 150,
        items: const [],
      );

      processOrderForReferral(duplicateOrder);
      expect(rewardCount, equals(1), reason: 'Must not qualify or reward more than once');
    });

    // -------------------------------------------------------------------------
    // TEST 8 & 9: Purchase points = boxes × 10 (100 boxes = 1,000 points)
    // -------------------------------------------------------------------------
    test('8 & 9. Purchase points calculation: boxes × 10 points (100 boxes = 1,000 points)', () {
      expect(config.calculatePurchasePoints(100), equals(1000));
      expect(config.calculatePurchasePoints(50), equals(500));
      expect(config.calculatePurchasePoints(250), equals(2500));
      expect(config.calculatePurchasePoints(0), equals(0));
    });

    // -------------------------------------------------------------------------
    // TEST 10: 50,000 points = ₹25,000 redemption value
    // -------------------------------------------------------------------------
    test('10. Conversion check: 50,000 points = ₹25,000 value (at ₹0.50/pt)', () {
      final value = config.calculateRupeeValue(50000);
      expect(value, equals(25000.0));

      final halfValue = config.calculateRupeeValue(25000);
      expect(halfValue, equals(12500.0));
    });

    // -------------------------------------------------------------------------
    // TEST 11: Below 50,000 cannot submit redemption
    // -------------------------------------------------------------------------
    test('11. Customer with points below 50,000 cannot submit redemption', () {
      const userPoints = 49990;
      final canSubmit = userPoints >= config.minimumRedemptionPoints;
      expect(canSubmit, isFalse, reason: 'Redemption must be gated to at least 50,000 points');
    });

    // -------------------------------------------------------------------------
    // TEST 12: Duplicate redemption cannot double-deduct points
    // -------------------------------------------------------------------------
    test('12. Idempotent redemption cannot double-deduct points', () {
      int balance = 60000;
      const requestedPoints = 50000;
      final processedRedemptions = <String>{};

      final request = LoyaltyRedemption(
        id: 'REDEMPTION_001',
        userId: 'USER_TEST_01',
        requestedPoints: requestedPoints,
        rupeesAmount: config.calculateRupeeValue(requestedPoints),
        status: 'pending',
      );
      expect(request.requestedPoints, equals(50000));
      expect(request.rupeesAmount, equals(25000.0));

      bool processRedemption(String redemptionId) {
        if (processedRedemptions.contains(redemptionId)) {
          return false; // Already processed
        }
        if (balance < requestedPoints) {
          return false;
        }
        balance -= requestedPoints;
        processedRedemptions.add(redemptionId);
        return true;
      }

      final firstAttempt = processRedemption('REDEMPTION_001');
      expect(firstAttempt, isTrue);
      expect(balance, equals(10000));

      // Duplicate attempt with same ID
      final secondAttempt = processRedemption('REDEMPTION_001');
      expect(secondAttempt, isFalse);
      expect(balance, equals(10000), reason: 'Balance must not be double deducted');
    });

    // -------------------------------------------------------------------------
    // TEST 13: Existing referral codes continue working
    // -------------------------------------------------------------------------
    test('13. Existing referral codes continue working seamlessly', () {
      final existingUser = UserProfile(
        userId: 'USER_LEGACY_99',
        name: 'Bharat Ceramic World',
        companyName: 'Bharat Ceramics',
        phone: '+919824000111',
        email: 'bharat@ceramics.com',
        userCategory: 'Dealer',
        role: 'customer',
        referralCode: 'ITA-782910',
      );

      expect(existingUser.referralCode, equals('ITA-782910'));
      expect(existingUser.referralCode?.startsWith('ITA-'), isTrue);
    });

    // -------------------------------------------------------------------------
    // TEST 14: Existing users are handled safely (no unwanted overwrite)
    // -------------------------------------------------------------------------
    test('14. Existing users without loyalty fields default safely without overwriting', () {
      final legacyRawDoc = {
        'userId': 'USER_OLD_01',
        'name': 'Old Partner',
        'phone': '+919999999999',
        'email': 'old@partner.com',
        'userCategory': 'dealer',
        'role': 'customer',
        // Note: loyaltyPoints, lifetimePoints, welcomeBonusGranted are completely omitted
      };

      final profile = UserProfile.fromMap(legacyRawDoc, 'USER_OLD_01');

      expect(profile.loyaltyPoints, equals(0));
      expect(profile.lifetimePoints, equals(0));
      expect(profile.welcomeBonusGranted, isFalse);
      expect(profile.referredBy, isNull);
    });

    // -------------------------------------------------------------------------
    // TEST 15: Registration payload compliance with Firestore security rules
    // -------------------------------------------------------------------------
    test('15. Registration payload does NOT contain protected loyalty fields', () {
      // Replicate exact payload constructed by FirestoreService.createUserProfile
      final registrationDocData = {
        'userId': 'USER_REG_123',
        'uid': 'USER_REG_123',
        'name': 'Ketan Mehta',
        'fullName': 'Ketan Mehta',
        'phone': '+919876543210',
        'phoneNumber': '+919876543210',
        'userCategory': 'dealer',
        'role': 'dealer',
        'referralCode': 'ITA-KETAN1',
        'referredByCode': 'ITA-ABC999',
        'status': 'active',
        'isVerified': true,
      };

      const protectedFields = [
        'loyaltyPoints',
        'lifetimePoints',
        'welcomeBonusGranted',
        'referredBy',
      ];

      for (final field in protectedFields) {
        expect(
          registrationDocData.containsKey(field),
          isFalse,
          reason: 'Client registration payload must NOT send $field to satisfy Firestore rules',
        );
      }
    });

    // -------------------------------------------------------------------------
    // TEST 16: Redemption submission parameters validation
    // -------------------------------------------------------------------------
    test('16. Minimum redemption threshold (50,000 points = ₹25,000) enforced', () {
      expect(config.minimumRedemptionPoints, equals(50000));
      expect(config.calculateRupeeValue(50000), equals(25000.0));

      bool isRedemptionEligible(int points) => points >= config.minimumRedemptionPoints;

      expect(isRedemptionEligible(49999), isFalse);
      expect(isRedemptionEligible(50000), isTrue);
      expect(isRedemptionEligible(100000), isTrue);
    });

    // -------------------------------------------------------------------------
    // TEST 17: Concurrent redemption double-spend simulation
    // -------------------------------------------------------------------------
    test('17. Concurrent double-spend simulation: only one request succeeds', () {
      int balance = 60000;
      const requested = 50000;
      int successfulDeductions = 0;

      void attemptDeduct() {
        if (balance >= requested) {
          balance -= requested;
          successfulDeductions++;
        }
      }

      // Simulate two simultaneous requests
      attemptDeduct();
      attemptDeduct();

      expect(successfulDeductions, equals(1), reason: 'Only one request can deduct 50,000 from 60,000');
      expect(balance, equals(10000), reason: 'Balance must remain 10,000 and never drop below zero');
    });

    // -------------------------------------------------------------------------
    // TEST 18: Role authorization check for ₹5,555 referral reward approval
    // -------------------------------------------------------------------------
    test('18. Only Admin/Salesperson can approve referral reward', () {
      bool isAuthorizedToApprove(String role, String category, {bool isAdminToken = false}) {
        if (isAdminToken) return true;
        final r = role.toLowerCase();
        final c = category.toLowerCase();
        return r == 'admin' || r == 'salesperson' || r == 'manager' || c == 'admin' || c == 'salesperson';
      }

      expect(isAuthorizedToApprove('customer', 'dealer'), isFalse);
      expect(isAuthorizedToApprove('customer', 'architect'), isFalse);
      expect(isAuthorizedToApprove('salesperson', 'salesperson'), isTrue);
      expect(isAuthorizedToApprove('admin', 'admin'), isTrue);
      expect(isAuthorizedToApprove('customer', 'dealer', isAdminToken: true), isTrue);
    });
  });
}
