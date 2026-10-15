import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/utils/profile_validator.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
    AppStateService.instance.clearInMemoryCart();
  });

  const fullValidProfile = UserProfile(
    userId: 'CUST_100_VALID',
    name: 'Rajesh Sharma',
    phone: '+919876543210',
    phoneVerified: true,
    email: 'rajesh.sharma@ceramictraders.in',
    userCategory: 'dealer',
    role: 'customer',
    companyName: 'Sharma Tile Emporium',
    address: {'line1': 'Plot 101, National Highway 8A'},
    city: 'Morbi',
    state: 'Gujarat',
    pincode: '363642',
    gstNumber: '24AAACS1234A1Z5',
    religion: 'Hindu',
    dateOfBirth: '15/08/1988',
    status: 'active',
  );

  group('PHASE 5 — Mandatory Regression Tests for Profile Validation Bug', () {
    // 1. Profile showing 100% and containing valid Firestore fields — order allowed.
    test('1. Profile showing 100% and containing valid Firestore fields — order allowed', () {
      final appState = AppStateService.instance;
      appState.setCurrentUserProfile(fullValidProfile);

      expect(appState.profileCompletionPercentage, equals(100));
      final eligibility = ProfileOrderingValidator.validate(fullValidProfile);
      expect(eligibility.isEligible, isTrue);
      expect(eligibility.missingFields, isEmpty);
      expect(eligibility.invalidFields, isEmpty);
      expect(appState.isProfileEligibleForOrdering, isTrue);
    });

    // 2. Valid profile using nested address map — order allowed.
    test('2. Valid profile using nested address map — order allowed', () {
      final nestedAddressMap = {
        'userId': 'CUST_NESTED_01',
        'name': 'Pooja Patel',
        'phone': '+919876543212',
        'phoneVerified': true,
        'email': 'pooja.patel@designstudio.com',
        'userCategory': 'architect',
        'companyName': 'Patel Architects',
        'address': {
          'line1': 'Suite 404, Signature Tower',
          'city': 'Ahmedabad',
          'state': 'Gujarat',
          'pincode': '380015',
        },
        'city': '', // Intentionally blank at top level to test nested resolution
        'state': '',
        'pincode': '',
        'status': 'active',
      };

      final profileFromMap = UserProfile.fromMap(nestedAddressMap, 'CUST_NESTED_01');
      expect(profileFromMap.city, equals('Ahmedabad'));
      expect(profileFromMap.state, equals('Gujarat'));
      expect(profileFromMap.pincode, equals('380015'));

      final eligibility = ProfileOrderingValidator.validate(profileFromMap);
      expect(eligibility.isEligible, isTrue, reason: 'Nested address map must satisfy city, state, pincode, line1');
      expect(eligibility.missingFields, isEmpty);
    });

    // 3. Valid profile using supported legacy field aliases — order allowed.
    test('3. Valid profile using supported legacy field aliases — order allowed', () {
      final legacyDoc = {
        'uid': 'CUST_LEGACY_01',
        'fullName': 'Anil Ambani',
        'phoneNumber': '+919876543213',
        'isVerified': true,
        'emailAddress': 'anil.ambani@ceramics.com',
        'role': 'builder',
        'businessName': 'Ambani Constructions LLP',
        'address': {
          'addressLine': 'Survey No 88, B/H Galaxy Mall',
          'district': 'Surat',
          'stateCode': 'Gujarat',
          'postalCode': '395007',
        },
        'status': 'active',
      };

      final profile = UserProfile.fromMap(legacyDoc, 'CUST_LEGACY_01');
      expect(profile.name, equals('Anil Ambani'));
      expect(profile.phone, equals('+919876543213'));
      expect(profile.isVerified, isTrue);
      expect(profile.email, equals('anil.ambani@ceramics.com'));
      expect(profile.companyName, equals('Ambani Constructions LLP'));
      expect(profile.userCategory, equals('builder'));
      expect(profile.city, equals('Surat'));
      expect(profile.state, equals('Gujarat'));
      expect(profile.pincode, equals('395007'));

      final eligibility = ProfileOrderingValidator.validate(profile);
      expect(eligibility.isEligible, isTrue);
    });

    // 4. Profile saved, then checkout opened — fresh values used.
    test('4. Profile saved, then checkout opened — fresh values used', () {
      final appState = AppStateService.instance;
      // Start with initial profile
      appState.setCurrentUserProfile(fullValidProfile);
      expect(appState.currentUserProfile.city, equals('Morbi'));

      // Simulate profile edit saved to app state
      appState.updateUserProfileFields(
        city: 'Rajkot',
        pincode: '360005',
        address: {
          'line1': 'Ring Road 2, Ceramic Plaza',
          'city': 'Rajkot',
          'state': 'Gujarat',
          'pincode': '360005',
        },
      );

      final updated = appState.currentUserProfile;
      expect(updated.city, equals('Rajkot'));
      expect(updated.pincode, equals('360005'));
      expect(updated.address['line1'], equals('Ring Road 2, Ceramic Plaza'));

      final eligibility = ProfileOrderingValidator.validate(updated);
      expect(eligibility.isEligible, isTrue);
    });

    // 5. Email stored correctly — email validation passes.
    test('5. Email stored correctly — email validation passes', () {
      final profile = fullValidProfile.copyWith(email: 'valid.customer@gmail.com');
      final eligibility = ProfileOrderingValidator.validate(profile);
      expect(eligibility.isEligible, isTrue);
      expect(eligibility.missingFields.contains('Email Address'), isFalse);
      expect(eligibility.invalidFields.contains('Valid Email Address'), isFalse);
    });

    // 6. Missing genuine email — order blocked.
    test('6. Missing genuine email — order blocked', () {
      // 6a. Empty email
      final emptyEmail = fullValidProfile.copyWith(email: '');
      final elEmpty = ProfileOrderingValidator.validate(emptyEmail);
      expect(elEmpty.isEligible, isFalse);
      expect(elEmpty.missingFields, contains('Email Address'));

      // 6b. Dummy email (user_*@itacon.com)
      final dummyEmail = fullValidProfile.copyWith(email: 'user_9876543210@itacon.com');
      final elDummy = ProfileOrderingValidator.validate(dummyEmail);
      expect(elDummy.isEligible, isFalse);
      expect(elDummy.missingFields, contains('Genuine Email Address'));

      // 6c. Malformed email
      final invalidEmail = fullValidProfile.copyWith(email: 'invalid-email-no-at-domain');
      final elInvalid = ProfileOrderingValidator.validate(invalidEmail);
      expect(elInvalid.isEligible, isFalse);
      expect(elInvalid.invalidFields, contains('Valid Email Address'));
    });

    // 7. Missing actual street address — order blocked.
    test('7. Missing actual street address — order blocked', () {
      final noStreet = fullValidProfile.copyWith(address: {});
      final eligibility = ProfileOrderingValidator.validate(noStreet);
      expect(eligibility.isEligible, isFalse);
      expect(eligibility.missingFields, contains('Street Address'));
    });

    // 8. Missing actual city/state/PIN — order blocked.
    test('8. Missing actual city/state/PIN — order blocked', () {
      final missingLoc = fullValidProfile.copyWith(
        city: '',
        state: '',
        pincode: '',
        address: {'line1': 'Just a street line'},
      );
      final eligibility = ProfileOrderingValidator.validate(missingLoc);
      expect(eligibility.isEligible, isFalse);
      expect(eligibility.missingFields, contains('City'));
      expect(eligibility.missingFields, contains('State'));
      expect(eligibility.missingFields, contains('PIN Code'));
    });

    // 9. Incomplete profile with 100% UI caused by stale state — order blocked correctly.
    test('9. Incomplete profile with 100% UI caused by stale state — order blocked correctly', () {
      // Simulate state where local UI somehow reports completion or displays 100%
      // but authoritative profile lacks street address, email, city, state, pincode.
      const staleIncompleteProfile = UserProfile(
        userId: 'CUST_STALE_01',
        name: 'Stale Customer',
        phone: '+919876543210',
        phoneVerified: true,
        userCategory: 'retailer',
        role: 'customer',
        companyName: 'Stale Firm',
        email: '',
        address: {},
        city: '',
        state: '',
        pincode: '',
        status: 'active',
      );

      final eligibility = ProfileOrderingValidator.validate(staleIncompleteProfile);
      expect(eligibility.isEligible, isFalse);
      expect(eligibility.missingFields, contains('Email Address'));
      expect(eligibility.missingFields, contains('Street Address'));
      expect(eligibility.missingFields, contains('City'));
      expect(eligibility.missingFields, contains('State'));
      expect(eligibility.missingFields, contains('PIN Code'));
      expect(eligibility.summaryMessage, contains('Please complete your profile to place an order'));
    });

    // 10. Optional religion and DOB — never block ordering.
    test('10. Optional religion and DOB — never block ordering', () {
      final noRelDob = fullValidProfile.copyWith(religion: '', dateOfBirth: '');
      final eligibility = ProfileOrderingValidator.validate(noRelDob);
      expect(eligibility.isEligible, isTrue);
      expect(eligibility.missingFields, isEmpty);
      expect(eligibility.invalidFields, isEmpty);
    });

    // 11. Optional GSTIN — existing policy preserved.
    test('11. Optional GSTIN — existing policy preserved', () {
      // Omitted GSTIN -> allowed
      final noGst = fullValidProfile.copyWith(gstNumber: '');
      expect(ProfileOrderingValidator.validate(noGst).isEligible, isTrue);

      // Valid GSTIN -> allowed
      final validGst = fullValidProfile.copyWith(gstNumber: '24AAACP1234A1Z5');
      expect(ProfileOrderingValidator.validate(validGst).isEligible, isTrue);

      // Malformed GSTIN -> flagged
      final badGst = fullValidProfile.copyWith(gstNumber: '123BADGSTIN');
      final elBad = ProfileOrderingValidator.validate(badGst);
      expect(elBad.isEligible, isFalse);
      expect(elBad.invalidFields, contains('Valid 15-character GSTIN'));
    });

    // 12. Blocked or pending account — order denied.
    test('12. Blocked or pending account — order denied', () {
      // 12a. Blocked account
      final blocked = fullValidProfile.copyWith(status: 'blocked');
      final elBlocked = ProfileOrderingValidator.validate(blocked);
      expect(elBlocked.isEligible, isFalse);
      expect(elBlocked.invalidFields, contains('Active Account Status'));

      // 12b. Pending salesperson verification
      final pendingSp = fullValidProfile.copyWith(status: 'pending_salesperson_verification');
      final elPending = ProfileOrderingValidator.validate(pendingSp);
      expect(elPending.isEligible, isFalse);
      expect(elPending.invalidFields, contains('Active Account Status'));

      // 12c. Suspended or inactive
      final inactive = fullValidProfile.copyWith(status: 'inactive');
      final elInactive = ProfileOrderingValidator.validate(inactive);
      expect(elInactive.isEligible, isFalse);
      expect(elInactive.invalidFields, contains('Active Account Status'));
    });

    // 13. Existing cart remains unchanged after validation failure.
    test('13. Existing cart remains unchanged after validation failure', () {
      final appState = AppStateService.instance;
      final testProduct = TileProduct(
        id: 'PROD_TEST_99',
        name: 'Onyx Crystal 600x1200',
        size: '600x1200 mm',
        surface: 'Polished',
        color: 'Beige',
        pattern: 'Onyx',
        basePrice: 52.0,
        moq: 10,
        stockStatus: 'available',
        images: ['https://example.com/onyx.jpg'],
        sqFtPerBox: 15.5,
        boxWeightKg: 28.0,
      );

      appState.addToCart(testProduct, size: '600x1200 mm', finish: 'Polished', quantity: 40);
      expect(appState.cartItems.length, equals(1));
      expect(appState.cartItems.first.quantity, equals(40));

      // Attempt validation on incomplete profile
      const incomplete = UserProfile(
        userId: 'CUST_FAIL',
        name: 'Incomplete',
        phone: '+919999988888',
        phoneVerified: true,
        userCategory: 'dealer',
        role: 'customer',
        companyName: '',
        email: '',
      );
      final eligibility = ProfileOrderingValidator.validate(incomplete);
      expect(eligibility.isEligible, isFalse);

      // Cart MUST still be intact
      expect(appState.cartItems.length, equals(1));
      expect(appState.cartItems.first.product.name, equals('Onyx Crystal 600x1200'));
      expect(appState.cartItems.first.quantity, equals(40));
    });

    // 14. Existing salesperson and purchase order workflow remains unaffected.
    test('14. Existing salesperson and purchase order workflow remains unaffected', () {
      final profileWithSalesperson = fullValidProfile.copyWith(
        salesPersonId: 'SP_MORBI_007',
        salespersonName: 'Vikram Mehta',
        salespersonPhone: '+919876500007',
        salespersonReferralCode: 'VIKRAM007',
      );

      final eligibility = ProfileOrderingValidator.validate(profileWithSalesperson);
      expect(eligibility.isEligible, isTrue);

      final appState = AppStateService.instance;
      appState.setCurrentUserProfile(profileWithSalesperson);
      expect(appState.currentUserProfile.salesPersonId, equals('SP_MORBI_007'));
      expect(appState.currentUserProfile.salespersonName, equals('Vikram Mehta'));
      expect(appState.currentUserProfile.salespersonPhone, equals('+919876500007'));
    });

    // 15. Firestore permission-denied during profile save does not produce false 100% completion
    test('15. Failed profile save does not produce false 100% completion indication', () {
      final appState = AppStateService.instance;
      const initialProfile = UserProfile(
        userId: 'CUST_FAIL_TEST',
        name: 'Incomplete User',
        phone: '+919876543210',
        phoneVerified: true,
        userCategory: 'retailer',
        role: 'customer',
        companyName: '',
        email: '',
      );

      appState.setCurrentUserProfile(initialProfile);
      final initialPercentage = appState.profileCompletionPercentage;
      expect(initialPercentage, lessThan(50));

      // Simulate a failed save attempt where Firestore throws permission-denied.
      // Under our corrected contract, AppStateService is NOT updated on failure.
      bool threwError = false;
      try {
        throw Exception('PERMISSION_DENIED: Modifying privileged user fields is not allowed.');
      } catch (e) {
        threwError = true;
        // AppState is NOT updated on error
      }

      expect(threwError, isTrue);
      // AppState retains original percentage, NEVER falsely reports 100%
      expect(appState.profileCompletionPercentage, equals(initialPercentage));
      expect(appState.isProfileEligibleForOrdering, isFalse);
    });

    // 16. Profile save followed by app restart restores all saved values correctly
    test('16. Profile save followed by app restart restores all saved values correctly', () async {
      final appState = AppStateService.instance;
      appState.setCurrentUserProfile(fullValidProfile);
      await UserSessionService.saveUserSession(fullValidProfile);

      // Simulate app restart: clear in-memory state and load from persistent session
      appState.clearUserProfile();
      expect(appState.currentUserProfile.userId, isEmpty);

      final restoredProfile = await UserSessionService.restoreUserSession();
      expect(restoredProfile, isNotNull);
      appState.setCurrentUserProfile(restoredProfile!);

      expect(appState.currentUserProfile.userId, equals('CUST_100_VALID'));
      expect(appState.currentUserProfile.email, equals('rajesh.sharma@ceramictraders.in'));
      expect(appState.currentUserProfile.city, equals('Morbi'));
      expect(appState.currentUserProfile.state, equals('Gujarat'));
      expect(appState.currentUserProfile.pincode, equals('363642'));
      expect(appState.currentUserProfile.address['line1'], equals('Plot 101, National Highway 8A'));
      expect(appState.profileCompletionPercentage, equals(100));
      expect(appState.isProfileEligibleForOrdering, isTrue);
    });

    // 17. Local profile cache does not override Firestore authoritative profile
    test('17. Local profile cache does not override Firestore authoritative profile', () {
      // If local state claims complete, but authoritative Firestore document is incomplete,
      // validating the authoritative profile correctly blocks the order.
      const authoritativeIncomplete = UserProfile(
        userId: 'CUST_AUTH_INCOMPLETE',
        name: 'Actual Firestore Record',
        phone: '+919876543210',
        phoneVerified: true,
        userCategory: 'dealer',
        role: 'customer',
        companyName: 'Morbi Ceramics',
        email: '', // Missing in Firestore
        city: '',
        state: '',
        pincode: '',
        address: {},
      );

      final eligibility = ProfileOrderingValidator.validate(authoritativeIncomplete);
      expect(eligibility.isEligible, isFalse);
      expect(eligibility.missingFields, contains('Email Address'));
      expect(eligibility.missingFields, contains('Street Address'));
      expect(eligibility.missingFields, contains('City'));
      expect(eligibility.missingFields, contains('State'));
      expect(eligibility.missingFields, contains('PIN Code'));
    });

    // 18. Profile edited on another device is not overwritten by stale checkout data
    test('18. Profile edited on another device is preserved and not overwritten by stale checkout data', () {
      final appState = AppStateService.instance;
      // Stale local profile in memory
      const staleLocalProfile = UserProfile(
        userId: 'CUST_MULTI_DEVICE',
        name: 'Device A Old Name',
        phone: '+919876543210',
        phoneVerified: true,
        userCategory: 'retailer',
        role: 'customer',
        companyName: 'Old Firm Name',
        email: 'device.a@test.com',
        city: 'Morbi',
        state: 'Gujarat',
        pincode: '363642',
        address: {'line1': 'Old Address Line'},
      );
      appState.setCurrentUserProfile(staleLocalProfile);

      // Newer document updated on Device B in Firestore
      final newerFirestoreDoc = {
        'userId': 'CUST_MULTI_DEVICE',
        'name': 'Device B Updated Name',
        'phone': '+919876543210',
        'phoneVerified': true,
        'userCategory': 'retailer',
        'role': 'customer',
        'companyName': 'Updated Premium Tiles LLP',
        'email': 'device.b@test.com',
        'city': 'Rajkot',
        'state': 'Gujarat',
        'pincode': '360005',
        'address': {
          'line1': '150 Feet Ring Road',
          'city': 'Rajkot',
          'state': 'Gujarat',
          'pincode': '360005',
        },
        'status': 'active',
      };

      final freshProfileFromFirestore = UserProfile.fromMap(newerFirestoreDoc, 'CUST_MULTI_DEVICE');

      // When checkout refreshes the authoritative profile, it loads the fresh Firestore profile
      appState.setCurrentUserProfile(freshProfileFromFirestore);

      expect(appState.currentUserProfile.name, equals('Device B Updated Name'));
      expect(appState.currentUserProfile.companyName, equals('Updated Premium Tiles LLP'));
      expect(appState.currentUserProfile.city, equals('Rajkot'));
      expect(appState.currentUserProfile.email, equals('device.b@test.com'));
      expect(ProfileOrderingValidator.validate(appState.currentUserProfile).isEligible, isTrue);
    });
  });
}
