import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/utils/profile_validator.dart';
import 'package:itacon_app/screens/cart_screen.dart';
import 'package:itacon_app/screens/checkout_screen.dart';
import 'package:itacon_app/screens/profile/edit_profile_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
    AppStateService.instance.clearInMemoryCart();
  });

  const fullValidProfile = UserProfile(
    userId: 'USER_VALID_01',
    name: 'Ramesh Patel',
    phone: '+919876543210',
    phoneVerified: true,
    email: 'ramesh.patel@ceramicworld.com',
    userCategory: 'dealer',
    role: 'customer',
    companyName: 'Patel Ceramic Mart',
    address: {'line1': 'Plot 42, Ceramic Industrial Zone'},
    city: 'Morbi',
    state: 'Gujarat',
    pincode: '363642',
    gstNumber: '24AAACP1234A1Z5',
    religion: 'Hindu',
    dateOfBirth: '12/04/1985',
  );

  group('Mandatory Profile Completion Before Ordering Tests', () {
    test('Scenario 1: New customer with incomplete profile is NOT eligible for ordering', () {
      const incompleteProfile = UserProfile(
        userId: 'USER_NEW_01',
        name: 'New Customer',
        phone: '+919999988888',
        phoneVerified: true,
        email: '',
        companyName: '',
        userCategory: 'dealer',
        role: 'customer',
        address: {},
        city: '',
        state: '',
        pincode: '',
      );

      final eligibility = ProfileOrderingValidator.validate(incompleteProfile);
      expect(eligibility.isEligible, isFalse);
      expect(eligibility.missingFields, contains('Email Address'));
      expect(eligibility.missingFields, contains('Company / Firm Name'));
      expect(eligibility.missingFields, contains('Street Address'));
      expect(eligibility.missingFields, contains('City'));
      expect(eligibility.missingFields, contains('State'));
      expect(eligibility.missingFields, contains('PIN Code'));
    });

    test('Scenario 2: Existing customer with 42% completion attempts an order', () {
      final appState = AppStateService.instance;
      // 5 fields out of 12 = 42% (e.g. name, phone, category, religion, dob)
      const partialProfile = UserProfile(
        userId: 'USER_PARTIAL_42',
        name: 'Suresh Kumar',
        phone: '+919876543211',
        phoneVerified: true,
        userCategory: 'retailer',
        role: 'customer',
        religion: 'Hindu',
        dateOfBirth: '01/01/1990',
        companyName: '',
        email: '',
        address: {},
        city: '',
        state: '',
        pincode: '',
      );

      appState.setCurrentUserProfile(partialProfile);
      expect(appState.profileCompletionPercentage, equals(42));

      // Separate ordering eligibility result does not rely on 100% completion
      final eligibility = appState.orderingProfileEligibility;
      expect(eligibility.isEligible, isFalse);
      expect(eligibility.missingFields, contains('Email Address'));
      expect(eligibility.missingFields, contains('Street Address'));
      expect(eligibility.missingFields, contains('City'));
      expect(eligibility.missingFields, contains('State'));
      expect(eligibility.missingFields, contains('PIN Code'));
    });

    test('Scenario 3: Customer fills all mandatory fields and becomes eligible', () {
      final eligibility = ProfileOrderingValidator.validate(fullValidProfile);
      expect(eligibility.isEligible, isTrue);
      expect(eligibility.missingFields, isEmpty);
      expect(eligibility.invalidFields, isEmpty);
    });

    test('Scenario 4: Religion and Date of Birth do NOT block ordering', () {
      // Profile with empty religion and date of birth
      final noReligionDobProfile = fullValidProfile.copyWith(
        religion: '',
        dateOfBirth: '',
      );

      final eligibility = ProfileOrderingValidator.validate(noReligionDobProfile);
      expect(eligibility.isEligible, isTrue);
      expect(eligibility.missingFields, isEmpty);
      expect(eligibility.invalidFields, isEmpty);
    });

    test('Scenario 5: GST format validation follows confirmed policy (optional unless provided)', () {
      // 1. Valid customer without GST (e.g. Architect or small Retailer without GST registration)
      final noGstProfile = fullValidProfile.copyWith(
        gstNumber: '',
        userCategory: 'architect',
      );
      final eligibilityNoGst = ProfileOrderingValidator.validate(noGstProfile);
      expect(eligibilityNoGst.isEligible, isTrue);
      expect(eligibilityNoGst.invalidFields, isEmpty);

      // 2. Customer provides invalid format GSTIN -> must be flagged
      final invalidGstProfile = fullValidProfile.copyWith(
        gstNumber: 'INVALID_GSTIN_123',
      );
      final eligibilityInvalidGst = ProfileOrderingValidator.validate(invalidGstProfile);
      expect(eligibilityInvalidGst.isEligible, isFalse);
      expect(eligibilityInvalidGst.invalidFields, contains('Valid 15-character GSTIN'));

      // 3. Customer provides valid 15-char GSTIN -> valid
      final validGstProfile = fullValidProfile.copyWith(
        gstNumber: '24AAACP1234A1Z5',
      );
      final eligibilityValidGst = ProfileOrderingValidator.validate(validGstProfile);
      expect(eligibilityValidGst.isEligible, isTrue);
    });

    test('Scenario 6: Removing a mandatory field makes the profile ineligible again', () {
      var current = fullValidProfile;
      expect(ProfileOrderingValidator.validate(current).isEligible, isTrue);

      // Remove street address
      current = current.copyWith(address: {});
      expect(ProfileOrderingValidator.validate(current).isEligible, isFalse);
      expect(ProfileOrderingValidator.validate(current).missingFields, contains('Street Address'));

      // Restore address, remove PIN code
      current = fullValidProfile.copyWith(pincode: '');
      expect(ProfileOrderingValidator.validate(current).isEligible, isFalse);
      expect(ProfileOrderingValidator.validate(current).missingFields, contains('PIN Code'));

      // Invalid PIN code (5 digits instead of 6)
      current = fullValidProfile.copyWith(pincode: '36364');
      expect(ProfileOrderingValidator.validate(current).isEligible, isFalse);
      expect(ProfileOrderingValidator.validate(current).invalidFields, contains('Valid 6-digit PIN Code'));
    });

    test('Scenario 7: Dummy email address (user_*@itacon.com) is treated as missing genuine email', () {
      final dummyEmailProfile = fullValidProfile.copyWith(
        email: 'user_9876543210@itacon.com',
      );
      final eligibility = ProfileOrderingValidator.validate(dummyEmailProfile);
      expect(eligibility.isEligible, isFalse);
      expect(eligibility.missingFields, contains('Genuine Email Address'));
    });

    test('Scenario 8: Unverified phone number blocks ordering', () {
      final unverifiedPhoneProfile = fullValidProfile.copyWith(
        phoneVerified: false,
        emailVerified: false,
        whatsappVerified: false,
      );
      final eligibility = ProfileOrderingValidator.validate(unverifiedPhoneProfile);
      expect(eligibility.isEligible, isFalse);
      expect(eligibility.invalidFields, contains('Verified Phone Number'));
    });

    test('Scenario 9: Cart contents remain intact when profile status changes or is checked', () {
      final appState = AppStateService.instance;

      final testProduct = TileProduct(
        id: 'PROD_TEST_01',
        name: 'Statuario White 600x1200',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Marble',
        basePrice: 45.0,
        moq: 10,
        stockStatus: 'available',
        images: ['https://example.com/test.jpg'],
        sqFtPerBox: 15.5,
        boxWeightKg: 28.0,
      );

      appState.addToCart(
        testProduct,
        size: '600x1200 mm',
        finish: 'Glossy',
        quantity: 25,
      );
      expect(appState.cartItems.length, equals(1));
      expect(appState.cartItems.first.quantity, equals(25));

      // Set incomplete profile
      appState.setCurrentUserProfile(const UserProfile(
        userId: 'USER_INCOMPLETE',
        name: 'Incomplete',
        companyName: '',
        phone: '',
        email: '',
        userCategory: 'dealer',
        role: 'customer',
      ));

      expect(appState.isProfileEligibleForOrdering, isFalse);
      // Verify cart was not altered
      expect(appState.cartItems.length, equals(1));
      expect(appState.cartItems.first.quantity, equals(25));

      // Now set complete profile
      appState.setCurrentUserProfile(fullValidProfile);
      expect(appState.isProfileEligibleForOrdering, isTrue);

      // Cart still completely intact
      expect(appState.cartItems.length, equals(1));
      expect(appState.cartItems.first.product.name, equals('Statuario White 600x1200'));
      expect(appState.cartItems.first.quantity, equals(25));
    });

    test('Scenario 10: Existing 12-field completion percentage remains intact for gamification', () {
      final appState = AppStateService.instance;
      expect(appState.profileTotalFieldsCount, equals(12));

      // With fullValidProfile:
      // name, religion, dateOfBirth, phone, userCategory, email, companyName, gstNumber, address, city, state, pincode = 12/12 = 100%
      appState.setCurrentUserProfile(fullValidProfile);
      expect(appState.profileFilledFieldsCount, equals(12));
      expect(appState.profileCompletionPercentage, equals(100));

      // Without religion and dob: 10/12 = 83%
      final withoutReligionDob = fullValidProfile.copyWith(religion: '', dateOfBirth: '');
      appState.setCurrentUserProfile(withoutReligionDob);
      expect(appState.profileFilledFieldsCount, equals(10));
      expect(appState.profileCompletionPercentage, equals(83));
      // But ordering eligibility is still TRUE!
      expect(appState.isProfileEligibleForOrdering, isTrue);
    });

    testWidgets('Scenario 11: CartScreen blocks checkout when profile incomplete and shows missing fields', (tester) async {
      final appState = AppStateService.instance;
      appState.setCurrentUserProfile(const UserProfile(
        userId: 'USER_INCOMPLETE',
        name: 'Incomplete User',
        phone: '+919999988888',
        phoneVerified: true,
        email: '',
        companyName: '',
        userCategory: 'dealer',
        role: 'customer',
      ));

      final testProduct = TileProduct(
        id: 'PROD_TEST_01',
        name: 'Statuario White 600x1200',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Marble',
        basePrice: 45.0,
        moq: 10,
        stockStatus: 'available',
        images: ['https://example.com/test.jpg'],
        sqFtPerBox: 15.5,
        boxWeightKg: 28.0,
      );

      appState.addToCart(
        testProduct,
        size: '600x1200 mm',
        finish: 'Glossy',
        quantity: 10,
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: CartScreen(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Tap PROCEED TO CHECKOUT
      final checkoutBtn = find.text('PROCEED TO CHECKOUT →');
      expect(checkoutBtn, findsOneWidget);
      await tester.tap(checkoutBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Verify dialog appears
      expect(find.text('Profile Completion Required'), findsOneWidget);
      expect(find.text('COMPLETE PROFILE NOW'), findsOneWidget);
      expect(find.text('Email Address'), findsOneWidget);
      expect(find.text('Street Address'), findsOneWidget);

      // Cart item still in place
      expect(appState.cartItems.length, equals(1));

      // Tap COMPLETE PROFILE NOW -> opens EditProfileScreen
      await tester.tap(find.text('COMPLETE PROFILE NOW'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.byType(EditProfileScreen), findsOneWidget);
    });

    testWidgets('Scenario 12: CartScreen allows checkout when profile is complete', (tester) async {
      final appState = AppStateService.instance;
      appState.setCurrentUserProfile(fullValidProfile);

      final testProduct = TileProduct(
        id: 'PROD_TEST_01',
        name: 'Statuario White 600x1200',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Marble',
        basePrice: 45.0,
        moq: 10,
        stockStatus: 'available',
        images: ['https://example.com/test.jpg'],
        sqFtPerBox: 15.5,
        boxWeightKg: 28.0,
      );

      appState.addToCart(
        testProduct,
        size: '600x1200 mm',
        finish: 'Glossy',
        quantity: 10,
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: CartScreen(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Tap PROCEED TO CHECKOUT
      final checkoutBtn = find.text('PROCEED TO CHECKOUT →');
      expect(checkoutBtn, findsOneWidget);
      await tester.tap(checkoutBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Directly navigates to CheckoutScreen without dialog
      expect(find.text('Profile Completion Required'), findsNothing);
      expect(find.byType(CheckoutScreen), findsOneWidget);
    });
  });
}
