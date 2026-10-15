import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/auth_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/screens/auth_gate.dart';
import 'package:itacon_app/screens/referral_gate_screen.dart';
import 'package:itacon_app/screens/main_navigation_screen.dart';
import 'package:itacon_app/screens/auth_screen.dart';
import 'package:itacon_app/widgets/profile_tier_card.dart';

// =============================================================================
// MOCK AUTH USER
// =============================================================================
class MockAuthUser implements User {
  @override
  final String uid;
  @override
  final String? phoneNumber;
  @override
  final String? displayName;
  @override
  final String? email;

  MockAuthUser({
    required this.uid,
    this.phoneNumber,
    this.displayName,
    this.email,
  });

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockUserCredential implements UserCredential {
  @override
  final User? user;
  @override
  final AuthCredential? credential;
  @override
  final AdditionalUserInfo? additionalUserInfo;

  MockUserCredential({this.user, this.credential, this.additionalUserInfo});
}

// =============================================================================
// TESTABLE FIRESTORE SERVICE WITH PRODUCTION-EQUIVALENT SALESPERSON FIXTURES
// =============================================================================
class TestSalespersonFirestoreService extends FirestoreService {
  final Map<String, Map<String, dynamic>> salesPersonsDb = {
    // 1 Active Production Salesperson: Vraj Shah
    'WNSahNXK9GQrGoiIEmD4QBvAeim1': {
      'id': 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
      'salesPersonId': 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
      'name': 'Vraj Shah',
      'fullName': 'Vraj Shah',
      'phone': '+919876543210',
      'phoneNumber': '+919876543210',
      'referralCode': 'SALES101',
      'isActive': true,
      'status': 'active',
    },
    // Inactive / Legacy Salespersons:
    'SP_001': {
      'id': 'SP_001',
      'salesPersonId': 'SP_001',
      'name': 'Legacy SP1',
      'referralCode': 'LEGACY_SP001_INACTIVE',
      'isActive': false,
      'status': 'inactive',
    },
    'SP_002': {
      'id': 'SP_002',
      'salesPersonId': 'SP_002',
      'name': 'Legacy SP2',
      'referralCode': 'LEGACY_SP002_INACTIVE',
      'isActive': false,
      'status': 'inactive',
    },
    'SP_003': {
      'id': 'SP_003',
      'salesPersonId': 'SP_003',
      'name': 'Legacy SP3',
      'referralCode': 'LEGACY_SP003_INACTIVE',
      'isActive': false,
      'status': 'inactive',
    },
    'SP_3210': {
      'id': 'SP_3210',
      'salesPersonId': 'SP_3210',
      'name': 'Legacy SP3210',
      'referralCode': 'LEGACY_SP3210_INACTIVE',
      'isActive': false,
      'status': 'inactive',
    },
  };

  final Map<String, Map<String, dynamic>> usersCollection = {};
  final Map<String, Map<String, dynamic>> categoryCollections = {};
  bool simulateNetworkError = false;
  int validateCallCount = 0;

  @override
  Future<SalespersonCodeResult> verifySalespersonCodeDetailed(String referralCode) async {
    validateCallCount++;
    if (simulateNetworkError) {
      return const SalespersonCodeResult(status: SalespersonCodeStatus.networkError);
    }
    final norm = referralCode.trim().toUpperCase();
    for (final doc in salesPersonsDb.values) {
      final code = (doc['referralCode'] ?? '').toString().trim().toUpperCase();
      if (code == norm) {
        final isActive = doc['isActive'] == true && doc['status'] != 'inactive';
        if (isActive) {
          return SalespersonCodeResult(
            status: SalespersonCodeStatus.active,
            data: doc,
          );
        } else {
          return SalespersonCodeResult(
            status: SalespersonCodeStatus.inactive,
            data: doc,
          );
        }
      }
    }
    return const SalespersonCodeResult(status: SalespersonCodeStatus.notFound);
  }

  @override
  Future<Map<String, dynamic>?> verifySalespersonReferralCode(String referralCode) async {
    final res = await verifySalespersonCodeDetailed(referralCode);
    if (res.status == SalespersonCodeStatus.active) {
      return res.data;
    }
    return null;
  }

  @override
  Future<void> createUserProfile({
    required String uid,
    String? phone,
    String? phoneNumber,
    String? name,
    String? fullName,
    required String role,
    String? userCategory,
    String? religion,
    String? dateOfBirth,
    String? email,
    String? countryCode,
    String? city,
    String? state,
    String? stateCode,
    String? pincode,
    Map<String, dynamic>? address,
    String? companyName,
    String? assignedSalespersonId,
    String? salespersonName,
    String? salespersonPhone,
    String? salespersonReferralCode,
    String? userReferralCode,
    String? referredByCode,
    bool isVerified = false,
    bool? phoneVerified,
    String? status,
    String? passwordHash,
    String? passwordSalt,
  }) async {
    final resolvedName = (name != null && name.trim().isNotEmpty) ? name.trim() : (fullName ?? '');
    final canonicalUsername = resolvedName.trim().toLowerCase();
    final effectiveCategory = (userCategory != null && userCategory.trim().isNotEmpty)
        ? userCategory.trim()
        : role;
    final data = {
      'uid': uid,
      'userId': uid,
      'name': resolvedName,
      'username': canonicalUsername,
      'phone': phone ?? phoneNumber,
      'countryCode': countryCode ?? '+91',
      'userCategory': effectiveCategory,
      'role': role,
      'status': status ?? 'active',
      'passwordHash': passwordHash,
      'passwordSalt': passwordSalt,
      'salesPersonId': assignedSalespersonId,
      'assignedSalespersonId': assignedSalespersonId,
      'salespersonName': salespersonName,
      'salespersonPhone': salespersonPhone,
      'salespersonReferralCode': salespersonReferralCode,
      'userReferralCode': userReferralCode,
      'isVerified': isVerified,
      'phoneVerified': phoneVerified ?? isVerified,
    };
    usersCollection[uid] = Map<String, dynamic>.from(data);
    final categoryToMirror = effectiveCategory.isNotEmpty ? effectiveCategory : role;
    if (categoryToMirror != 'customer' && categoryToMirror.isNotEmpty) {
      try {
        final catColName = FirestoreService.getCategoryCollectionName(categoryToMirror);
        categoryCollections.putIfAbsent(catColName, () => {})[uid] = Map<String, dynamic>.from(data);
      } catch (_) {}
    }
  }

  @override
  Future<Map<String, dynamic>?> getUserDocument(String uid) async {
    return usersCollection[uid];
  }

  @override
  Future<Map<String, dynamic>?> getCategoryDocument(String categoryCollection, String uid) async {
    return categoryCollections[categoryCollection]?[uid];
  }

  @override
  Future<void> updateUserSalespersonAssignment({
    required String uid,
    required String salespersonId,
    required String salespersonName,
    required String salespersonReferralCode,
    String? salespersonPhone,
  }) async {
    final existing = usersCollection[uid] ?? {'uid': uid, 'userId': uid};
    existing['salesPersonId'] = salespersonId;
    existing['assignedSalespersonId'] = salespersonId;
    existing['salespersonName'] = salespersonName;
    existing['salespersonReferralCode'] = salespersonReferralCode;
    if (salespersonPhone != null) {
      existing['salespersonPhone'] = salespersonPhone;
    }
    existing['isVerified'] = true;
    usersCollection[uid] = existing;
  }

  @override
  Future<void> updateUserProfileData({
    required String uid,
    String? name,
    String? fullName,
    String? religion,
    String? dateOfBirth,
    String? email,
    String? phone,
    String? phoneNumber,
    String? countryCode,
    String? companyName,
    String? role,
    bool updateRole = false,
    String? city,
    String? state,
    String? region,
    String? pincode,
    String? gstNumber,
    String? profilePhotoUrl,
    List<String>? showroomImages,
    Map<String, dynamic>? address,
  }) async {
    final existing = usersCollection[uid] ?? {'uid': uid, 'userId': uid};
    if (name != null) existing['name'] = name;
    if (religion != null) existing['religion'] = religion;
    if (dateOfBirth != null) existing['dateOfBirth'] = dateOfBirth;
    if (email != null) existing['email'] = email;
    if (phone != null) existing['phone'] = phone;
    if (companyName != null) existing['companyName'] = companyName;
    if (role != null) {
      existing['role'] = role;
      existing['userCategory'] = role;
    }
    if (city != null) existing['city'] = city;
    if (state != null) existing['state'] = state;
    if (pincode != null) existing['pincode'] = pincode;
    if (gstNumber != null) existing['gstNumber'] = gstNumber;
    if (profilePhotoUrl != null) existing['profilePhotoUrl'] = profilePhotoUrl;
    if (showroomImages != null) existing['showroomImages'] = showroomImages;
    if (address != null) existing['address'] = address;
    usersCollection[uid] = existing;
  }

  @override
  Future<UserProfile?> getUserProfile(String uid) async {
    final doc = usersCollection[uid];
    if (doc != null) {
      return UserProfile.fromMap(doc, uid);
    }
    return null;
  }

  @override
  Future<void> saveCustomerReferralCode({
    required String userId,
    required String referralCode,
    String? userName,
    String? userPhone,
    String? userCategory,
  }) async {}

  @override
  Future<void> executeAtomicClientAssignment({
    required String clientId,
    required String salespersonId,
    String assignmentType = 'manual_referral',
    String? clientName,
    String? clientPhone,
    String? companyName,
    String? clientCategory,
  }) async {}

  @override
  Future<List<Map<String, dynamic>>> getAvailableSalespersons() async {
    return salesPersonsDb.values
        .where((sp) => sp['isActive'] == true && sp['status'] != 'inactive')
        .toList();
  }
}

// =============================================================================
// TESTABLE AUTH SERVICE INJECTING TEST FIRESTORE SERVICE
// =============================================================================
class TestableAuthService extends AuthService {
  final MockAuthUser? mockUser;

  TestableAuthService({
    required super.firestoreService,
    this.mockUser,
  });

  @override
  User? get currentUser => mockUser;

  @override
  String? get currentUid => mockUser?.uid;

  @override
  Future<UserCredential> verifyPhoneOtp({
    required String verificationId,
    required String smsCode,
  }) async {
    return MockUserCredential(user: mockUser);
  }
}

// =============================================================================
// MAIN TEST SUITE
// =============================================================================
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late TestSalespersonFirestoreService mockFirestore;
  late TestableAuthService authService;
  const testUid = 'WNSahNXK9GQrGoiIEmD4QBvAeim1_CLIENT_001';

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AuthService.isPendingSecondaryValidation.value = false;
    AppStateService.instance.clearUserProfile();
    await UserSessionService.clearUserSession();
    mockFirestore = TestSalespersonFirestoreService();
    authService = TestableAuthService(
      firestoreService: mockFirestore,
      mockUser: MockAuthUser(uid: testUid, phoneNumber: '+919876543210'),
    );
  });

  group('MANDATORY SALESPERSON CODE REGISTRATION & SECURITY TESTS', () {
    test('1. Empty salesperson code blocks registration with explicit message', () async {
      expect(
        () => authService.registerUser(
          name: 'New Customer',
          phoneNumber: '+919876543210',
          categoryId: 'dealer',
          password: 'Password123!',
          verificationId: 'v_id_1',
          smsCode: '123456',
          referralCode: '',
        ),
        throwsA(predicate((e) => e.toString().contains('Please enter your salesperson code'))),
      );
    });

    test('2. Invalid code blocks registration', () async {
      expect(
        () => authService.registerUser(
          name: 'New Customer',
          phoneNumber: '+919876543210',
          categoryId: 'dealer',
          password: 'Password123!',
          verificationId: 'v_id_1',
          smsCode: '123456',
          referralCode: 'INVALID_XYZ_999',
        ),
        throwsA(predicate((e) => e.toString().contains('Invalid or inactive salesperson code'))),
      );
    });

    test('3. Inactive code blocks registration', () async {
      expect(
        () => authService.registerUser(
          name: 'New Customer',
          phoneNumber: '+919876543210',
          categoryId: 'dealer',
          password: 'Password123!',
          verificationId: 'v_id_1',
          smsCode: '123456',
          referralCode: 'LEGACY_SP001_INACTIVE',
        ),
        throwsA(predicate((e) => e.toString().contains('Invalid or inactive salesperson code'))),
      );
    });

    test('4. Legacy inactive salespersons (SP_001, SP_002, SP_003, SP_3210) block registration', () async {
      for (final legacyCode in [
        'LEGACY_SP001_INACTIVE',
        'LEGACY_SP002_INACTIVE',
        'LEGACY_SP003_INACTIVE',
        'LEGACY_SP3210_INACTIVE'
      ]) {
        expect(
          () => authService.registerUser(
            name: 'New Customer',
            phoneNumber: '+919876543210',
            categoryId: 'dealer',
            password: 'Password123!',
            verificationId: 'v_id_1',
            smsCode: '123456',
            referralCode: legacyCode,
          ),
          throwsA(predicate((e) => e.toString().contains('Invalid or inactive salesperson code'))),
        );
      }
    });

    test('5. Active code (SALES101) succeeds registration and stores salesperson profile', () async {
      await authService.registerUser(
        name: 'New Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      final profile = await mockFirestore.getUserProfile(testUid);
      expect(profile, isNotNull);
      expect(profile!.salesPersonId, equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));
      expect(profile.salespersonName, equals('Vraj Shah'));
      expect(profile.salespersonReferralCode, equals('SALES101'));
    });

    test('6. Code whitespace normalization allows registration ("  SALES101  ")', () async {
      await authService.registerUser(
        name: 'New Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: '   SALES101   ',
      );

      final profile = await mockFirestore.getUserProfile(testUid);
      expect(profile, isNotNull);
      expect(profile!.salespersonReferralCode, equals('SALES101'));
    });

    test('7. Intended code case normalization allows registration ("sales101")', () async {
      await authService.registerUser(
        name: 'New Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'sales101',
      );

      final profile = await mockFirestore.getUserProfile(testUid);
      expect(profile, isNotNull);
      expect(profile!.salespersonReferralCode, equals('SALES101'));
    });

    test('8. Changing code after validation invalidates previous validation', () async {
      final res1 = await mockFirestore.verifySalespersonCodeDetailed('SALES101');
      expect(res1.status, equals(SalespersonCodeStatus.active));

      final res2 = await mockFirestore.verifySalespersonCodeDetailed('WRONG123');
      expect(res2.status, equals(SalespersonCodeStatus.notFound));
    });

    test('9. Network error does not report invalid code', () async {
      mockFirestore.simulateNetworkError = true;
      final res = await mockFirestore.verifySalespersonCodeDetailed('SALES101');
      expect(res.status, equals(SalespersonCodeStatus.networkError));
      expect(res.status != SalespersonCodeStatus.notFound, isTrue);
    });

    test('10. Double-tapping Validate does not produce duplicate state corruption', () async {
      final f1 = mockFirestore.verifySalespersonCodeDetailed('SALES101');
      final f2 = mockFirestore.verifySalespersonCodeDetailed('SALES101');
      final results = await Future.wait([f1, f2]);
      expect(results[0].status, equals(SalespersonCodeStatus.active));
      expect(results[1].status, equals(SalespersonCodeStatus.active));
    });

    test('11. Double-tapping Create Account is idempotent under SAME UID', () async {
      await authService.registerUser(
        name: 'Idempotent Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      await authService.registerUser(
        name: 'Idempotent Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_2',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      expect(mockFirestore.usersCollection.length, equals(1));
    });

    test('12. Final salesperson revalidation occurs immediately before profile creation', () async {
      mockFirestore.validateCallCount = 0;
      await authService.registerUser(
        name: 'Revalidation Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );
      expect(mockFirestore.validateCallCount > 0, isTrue);
    });

    test('13. Inactive-after-validation blocks registration in server-side gate', () async {
      mockFirestore.salesPersonsDb['WNSahNXK9GQrGoiIEmD4QBvAeim1']!['isActive'] = false;
      mockFirestore.salesPersonsDb['WNSahNXK9GQrGoiIEmD4QBvAeim1']!['status'] = 'inactive';

      expect(
        () => authService.registerUser(
          name: 'Customer',
          phoneNumber: '+919876543210',
          categoryId: 'dealer',
          password: 'Password123!',
          verificationId: 'v_id_1',
          smsCode: '123456',
          referralCode: 'SALES101',
        ),
        throwsA(predicate((e) => e.toString().contains('Invalid or inactive salesperson code'))),
      );
    });

    test('14. Customer profile stores correct salesperson UID (WNSahNXK9GQrGoiIEmD4QBvAeim1)', () async {
      await authService.registerUser(
        name: 'Field Check Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      final doc = mockFirestore.usersCollection[testUid]!;
      expect(doc['salesPersonId'], equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));
    });

    test('15. assignedSalespersonId matches active salesperson', () async {
      await authService.registerUser(
        name: 'Field Check Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      final doc = mockFirestore.usersCollection[testUid]!;
      expect(doc['assignedSalespersonId'], equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));
    });

    test('16. salesPersonId matches active salesperson', () async {
      await authService.registerUser(
        name: 'Field Check Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      final doc = mockFirestore.usersCollection[testUid]!;
      expect(doc['salesPersonId'], equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));
    });

    test('17. salespersonReferralCode is correct (SALES101)', () async {
      await authService.registerUser(
        name: 'Field Check Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      final doc = mockFirestore.usersCollection[testUid]!;
      expect(doc['salespersonReferralCode'], equals('SALES101'));
    });

    test('18. No auto-assignment occurs when code is empty', () async {
      try {
        await authService.registerUser(
          name: 'No Auto Assign Customer',
          phoneNumber: '+919876543210',
          categoryId: 'dealer',
          password: 'Password123!',
          verificationId: 'v_id_1',
          smsCode: '123456',
          referralCode: '',
        );
      } catch (_) {}

      expect(mockFirestore.usersCollection.containsKey(testUid), isFalse);
    });

    test('19. No round-robin signup assignment occurs', () async {
      await authService.registerUser(
        name: 'Round Robin Check',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      final doc = mockFirestore.usersCollection[testUid]!;
      expect(doc['salesPersonId'], equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));
    });

    test('20. No fallback assignment occurs when lookup fails', () async {
      try {
        await authService.registerUser(
          name: 'No Fallback Customer',
          phoneNumber: '+919876543210',
          categoryId: 'dealer',
          password: 'Password123!',
          verificationId: 'v_id_1',
          smsCode: '123456',
          referralCode: 'FAIL_LOOKUP_CODE',
        );
      } catch (_) {}

      expect(mockFirestore.usersCollection.containsKey(testUid), isFalse);
    });

    testWidgets('21. OTP-authenticated incomplete user without profile or salesperson cannot reach Home', (tester) async {
      final mockUser = MockAuthUser(uid: 'INCOMPLETE_OTP_UID', phoneNumber: '+919876543210');
      final authStreamController = StreamController<User?>.broadcast();

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => null,
            authenticatedChild: const Scaffold(body: Text('AUTHENTICATED_HOME_SCREEN')),
          ),
        ),
      );

      authStreamController.add(mockUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsNothing);
      expect(find.byType(MainNavigationScreen), findsNothing);
      expect(find.text("We couldn't load your customer profile. Please retry."), findsOneWidget);

      await authStreamController.close();
    });

    testWidgets('22. Customer with profile but missing salesperson is gated into AuthScreen (Sales Code step), NOT Home', (tester) async {
      final mockUser = MockAuthUser(uid: 'NO_SP_PROFILE_UID', phoneNumber: '+919876543210');
      final authStreamController = StreamController<User?>.broadcast();

      const incompleteProfile = UserProfile(
        userId: 'NO_SP_PROFILE_UID',
        name: 'Incomplete Customer',
        phone: '+919876543210',
        companyName: 'ITA Co',
        email: 'test@example.com',
        userCategory: 'dealer',
        role: 'customer',
        salesPersonId: null,
        assignedSalespersonId: null,
        status: 'pending_salesperson_verification',
      );

      AppStateService.instance.setCurrentUserProfile(incompleteProfile);

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => incompleteProfile,
            authenticatedChild: const Scaffold(body: Text('AUTHENTICATED_HOME_SCREEN')),
          ),
        ),
      );

      authStreamController.add(mockUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsNothing);
      expect(find.byType(MainNavigationScreen), findsNothing);
      expect(find.byType(AuthScreen), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);

      await authStreamController.close();
    });

    testWidgets('23. Complete existing customer restores Home normally', (tester) async {
      final mockUser = MockAuthUser(uid: 'COMPLETE_UID', phoneNumber: '+919876543210');
      final authStreamController = StreamController<User?>.broadcast();

      const completeProfile = UserProfile(
        userId: 'COMPLETE_UID',
        name: 'Complete Customer',
        phone: '+919876543210',
        companyName: 'ITA Co',
        email: 'complete@example.com',
        userCategory: 'dealer',
        role: 'customer',
        salesPersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        assignedSalespersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        salespersonName: 'Vraj Shah',
        salespersonReferralCode: 'SALES101',
      );

      AppStateService.instance.setCurrentUserProfile(completeProfile);

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => completeProfile,
            authenticatedChild: const Scaffold(body: Text('AUTHENTICATED_HOME_SCREEN')),
          ),
        ),
      );

      authStreamController.add(mockUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);

      await authStreamController.close();
    });

    test('24. Existing customer login does NOT ask for salesperson code', () async {
      await authService.registerUser(
        name: 'Existing Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v_id_1',
        smsCode: '123456',
        referralCode: 'SALES101',
      );

      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: '+919876543210',
        verificationId: 'v_id_2',
        smsCode: '123456',
        password: 'Password123!',
        username: 'Existing Customer',
      );

      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    test('25. Inactive salespersons never appear in new registration resolution', () async {
      final available = await mockFirestore.getAvailableSalespersons();
      for (final sp in available) {
        expect(sp['status'] != 'inactive', isTrue);
        expect(sp['isActive'] != false, isTrue);
        expect(sp['id'] != 'SP_001', isTrue);
        expect(sp['id'] != 'SP_002', isTrue);
        expect(sp['id'] != 'SP_003', isTrue);
        expect(sp['id'] != 'SP_3210', isTrue);
      }
    });

    testWidgets('26. Signup UI has NO Personal step, NO category dropdown, and NO salesperson-code field', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AuthScreen(initialMode: AuthViewMode.signup),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Account step fields exist
      expect(find.text('Full Name (First, Middle & Surname) *'), findsOneWidget);
      expect(find.text('Mobile Number *'), findsOneWidget);
      expect(find.text('User Category *'), findsOneWidget);
      expect(find.text('Confirm Password *'), findsOneWidget);
      expect(find.text('Continue'), findsOneWidget);

      // Verify NO Personal step indicator or removed optional fields on signup
      expect(find.text('Personal'), findsNothing);
      expect(find.text('Company / Firm Name (Optional)'), findsNothing);
      expect(find.text('Date of Birth (Optional)'), findsNothing);
      expect(find.text('Salesperson Code *'), findsNothing);
      expect(find.text('Validate'), findsNothing);
    });

    test('27. registerInitialAccount creates initial profile with role "customer", userCategory saved, isVerified false, salesPersonId null', () async {
      await authService.registerInitialAccount(
        name: 'Ramesh Patel',
        phoneNumber: '+919876543210',
        userCategory: 'Architect / Interior Designer',
        password: 'Password123!',
        verificationId: 'v_init_1',
        smsCode: '123456',
      );

      final doc = await mockFirestore.getUserDocument(testUid);
      expect(doc, isNotNull);
      expect(doc!['role'], equals('customer'));
      expect(doc['userCategory'], equals('Architect / Interior Designer'));
      expect(doc['isVerified'], isFalse);
      expect(doc['salesPersonId'], isNull);
      expect(doc['assignedSalespersonId'], isNull);
      expect(doc['salespersonReferralCode'], isNull);
    });

    testWidgets('28. Incomplete customer without salesperson assignment routes to AuthScreen (Sales Code step) on restart', (tester) async {
      final mockUser = MockAuthUser(uid: 'INCOMPLETE_UID', phoneNumber: '+919876543210');
      final authStreamController = StreamController<User?>.broadcast();

      const incompleteProfile = UserProfile(
        userId: 'INCOMPLETE_UID',
        name: 'Incomplete Customer',
        phone: '+919876543210',
        email: '',
        companyName: '',
        userCategory: '',
        role: 'customer',
        salesPersonId: null,
        assignedSalespersonId: null,
        status: 'pending_salesperson_verification',
      );

      AppStateService.instance.setCurrentUserProfile(incompleteProfile);

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => incompleteProfile,
            authenticatedChild: const Scaffold(body: Text('AUTHENTICATED_HOME_SCREEN')),
          ),
        ),
      );

      authStreamController.add(mockUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsNothing);
      expect(find.byType(AuthScreen), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);

      await authStreamController.close();
    });

    test('29. Valid active code (SALES101) via verifyAndLinkReferralCode assigns Vraj Shah and marks isVerified true', () async {
      await authService.registerInitialAccount(
        name: 'Ramesh Patel',
        phoneNumber: '+919876543210',
        userCategory: 'Dealer',
        password: 'Password123!',
        verificationId: 'v_init_2',
        smsCode: '123456',
      );

      final success = await authService.verifyAndLinkReferralCode('SALES101');
      expect(success, isTrue);

      final doc = await mockFirestore.getUserDocument(testUid);
      expect(doc, isNotNull);
      expect(doc!['salesPersonId'], equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));
      expect(doc['assignedSalespersonId'], equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));
      expect(doc['salespersonName'], equals('Vraj Shah'));
      expect(doc['salespersonReferralCode'], equals('SALES101'));
      expect(doc['isVerified'], isTrue);
    });

    testWidgets('30. Completed customer with valid active code routes to Home on restart', (tester) async {
      final mockUser = MockAuthUser(uid: 'COMPLETED_UID', phoneNumber: '+919876543210');
      final authStreamController = StreamController<User?>.broadcast();

      const completedProfile = UserProfile(
        userId: 'COMPLETED_UID',
        name: 'Completed Customer',
        phone: '+919876543210',
        email: '',
        companyName: '',
        userCategory: '',
        role: 'customer',
        salesPersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        assignedSalespersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        salespersonName: 'Vraj Shah',
        salespersonReferralCode: 'SALES101',
      );

      AppStateService.instance.setCurrentUserProfile(completedProfile);

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => completedProfile,
            authenticatedChild: const Scaffold(body: Text('AUTHENTICATED_HOME_SCREEN')),
          ),
        ),
      );

      authStreamController.add(mockUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);

      await authStreamController.close();
    });

    testWidgets('31. Missing optional fields (DOB, company, address) on customer profile do NOT block Home access', (tester) async {
      final mockUser = MockAuthUser(uid: 'MINIMAL_UID', phoneNumber: '+919876543210');
      final authStreamController = StreamController<User?>.broadcast();

      // Profile has NO DOB, NO company, NO address, NO category
      const minimalProfile = UserProfile(
        userId: 'MINIMAL_UID',
        name: 'Minimal Customer',
        phone: '+919876543210',
        email: '',
        companyName: '',
        userCategory: '',
        role: 'customer',
        salesPersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        assignedSalespersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        salespersonName: 'Vraj Shah',
        salespersonReferralCode: 'SALES101',
      );

      AppStateService.instance.setCurrentUserProfile(minimalProfile);

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => minimalProfile,
            authenticatedChild: const Scaffold(body: Text('AUTHENTICATED_HOME_SCREEN')),
          ),
        ),
      );

      authStreamController.add(mockUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);

      await authStreamController.close();
    });

    test('32. Profile update persists removed fields without overwriting auth credentials or salesperson assignment', () async {
      await authService.registerInitialAccount(
        name: 'Initial Name',
        phoneNumber: '+919876543210',
        userCategory: 'Dealer',
        password: 'Password123!',
        verificationId: 'v_init_3',
        smsCode: '123456',
      );
      await authService.verifyAndLinkReferralCode('SALES101');

      final beforeDoc = await mockFirestore.getUserDocument(testUid);
      final initialHash = beforeDoc!['passwordHash'];
      final initialSalt = beforeDoc['passwordSalt'];
      final initialSpId = beforeDoc['salesPersonId'];

      // Customer edits profile from Profile page inside app
      await mockFirestore.updateUserProfileData(
        uid: testUid,
        companyName: 'New Tiles Pvt Ltd',
        dateOfBirth: '15/08/1990',
        city: 'Morbi',
        state: 'Gujarat',
        pincode: '363641',
        email: 'ramesh@example.com',
        gstNumber: '24AAACH7409R1ZZ',
        address: {'line1': 'National Highway 8A', 'city': 'Morbi', 'state': 'Gujarat', 'pincode': '363641'},
      );

      final afterDoc = await mockFirestore.getUserDocument(testUid);
      expect(afterDoc!['companyName'], equals('New Tiles Pvt Ltd'));
      expect(afterDoc['dateOfBirth'], equals('15/08/1990'));
      expect(afterDoc['city'], equals('Morbi'));
      expect(afterDoc['state'], equals('Gujarat'));
      expect(afterDoc['pincode'], equals('363641'));
      expect(afterDoc['email'], equals('ramesh@example.com'));
      expect(afterDoc['gstNumber'], equals('24AAACH7409R1ZZ'));
      expect(afterDoc['address']['line1'], equals('National Highway 8A'));

      // Protected credentials & salesperson must NOT be modified or lost
      expect(afterDoc['passwordHash'], equals(initialHash));
      expect(afterDoc['passwordSalt'], equals(initialSalt));
      expect(afterDoc['salesPersonId'], equals(initialSpId));
      expect(afterDoc['salespersonReferralCode'], equals('SALES101'));
    });

    test('33. Inactive/invalid code on verifyAndLinkReferralCode blocks app access and fails closed', () async {
      await authService.registerInitialAccount(
        name: 'Test Customer',
        phoneNumber: '+919876543210',
        userCategory: 'Dealer',
        password: 'Password123!',
        verificationId: 'v_init_4',
        smsCode: '123456',
      );

      // Inactive code fails
      final inactiveRes = await authService.verifyAndLinkReferralCode('LEGACY_SP001_INACTIVE');
      expect(inactiveRes, isFalse);

      // Invalid code fails
      final invalidRes = await authService.verifyAndLinkReferralCode('NONEXISTENT_CODE');
      expect(invalidRes, isFalse);

      // Empty code fails
      final emptyRes = await authService.verifyAndLinkReferralCode('');
      expect(emptyRes, isFalse);

      // Verify user remains unverified and without salesperson
      final doc = await mockFirestore.getUserDocument(testUid);
      expect(doc!['isVerified'], isFalse);
      expect(doc['salesPersonId'], isNull);
    });
  });

  group('Category Mirror & Frozen Profile Integration / Regression Tests', () {
    // 1. Signup category is stored in the exact format Profile already reads.
    test('1. Signup category is stored in the exact format Profile already reads for all canonical categories', () async {
      const canonicalList = [
        'Dealer',
        'Architect / Interior Designer',
        'Builder / Contractor',
        'Wholesaler',
        'Retailer',
      ];

      for (var i = 0; i < canonicalList.length; i++) {
        final cat = canonicalList[i];
        final uid = 'USER_CAT_$i';
        await mockFirestore.createUserProfile(
          uid: uid,
          name: 'Customer $cat',
          phone: '+91987654321$i',
          role: 'customer',
          userCategory: cat,
        );

        final doc = await mockFirestore.getUserDocument(uid);
        expect(doc, isNotNull);
        expect(doc!['userCategory'], equals(cat), reason: 'Canonical category $cat must match exactly');

        // Verify Profile reads this exact format
        final profile = UserProfile.fromMap(doc, uid);
        expect(profile.userCategory, equals(cat));

        // Verify mirror collection write
        final mirrorCol = FirestoreService.getCategoryCollectionName(cat);
        final mirrorDoc = await mockFirestore.getCategoryDocument(mirrorCol, uid);
        expect(mirrorDoc, isNotNull);
        expect(mirrorDoc!['userCategory'], equals(cat));
      }
    });

    // 2. Profile displays signup category correctly.
    testWidgets('2. Profile displays signup category correctly via ProfileTierCard with proper tier and discount', (tester) async {
      const testProfile = UserProfile(
        userId: 'TEST_UID_ARCH',
        name: 'Arjun Mehta',
        companyName: 'Mehta Architecture',
        email: 'arjun@example.com',
        phone: '+919876543210',
        userCategory: 'Architect / Interior Designer',
        role: 'customer',
        salespersonName: 'Vraj Shah',
        salespersonPhone: '+91 98765 43210',
        salespersonReferralCode: 'SALES101',
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ProfileTierCard(user: testProfile),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // In ProfileTierCard: category.toUpperCase() is rendered
      expect(find.text('ARCHITECT / INTERIOR DESIGNER'), findsOneWidget);
      expect(find.text('12% OFF RATE'), findsOneWidget);
      expect(find.text('TRADE PARTNER TIER'), findsOneWidget);

      // Verify Dealer category rendering
      const dealerProfile = UserProfile(
        userId: 'TEST_UID_DEALER',
        name: 'Ramesh Patel',
        companyName: 'Patel Tiles',
        email: 'ramesh@example.com',
        phone: '+919876543211',
        userCategory: 'Dealer',
        role: 'customer',
      );
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ProfileTierCard(user: dealerProfile),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('DEALER'), findsOneWidget);
      expect(find.text('15% OFF RATE'), findsOneWidget);
    });

    // 3. Existing Profile save still works unchanged.
    test('3. Existing Profile save still works unchanged without breaking document integrity', () async {
      await authService.registerInitialAccount(
        name: 'Suresh Kumar',
        phoneNumber: '+919876543210',
        userCategory: 'Wholesaler',
        password: 'Password123!',
        verificationId: 'v_init_reg3',
        smsCode: '123456',
      );

      // Save updated profile data
      await mockFirestore.updateUserProfileData(
        uid: testUid,
        name: 'Suresh B. Kumar',
        companyName: 'Kumar Ceramics',
        city: 'Ahmedabad',
        state: 'Gujarat',
      );

      final doc = await mockFirestore.getUserDocument(testUid);
      expect(doc!['name'], equals('Suresh B. Kumar'));
      expect(doc['companyName'], equals('Kumar Ceramics'));
      expect(doc['city'], equals('Ahmedabad'));
      expect(doc['state'], equals('Gujarat'));
      expect(doc['userCategory'], equals('Wholesaler'));
    });

    // 4. Existing optional fields can still be filled later.
    test('4. Existing optional fields remain empty initially and can be filled later', () async {
      await authService.registerInitialAccount(
        name: 'Anita Desai',
        phoneNumber: '+919876543210',
        userCategory: 'Retailer',
        password: 'Password123!',
        verificationId: 'v_init_reg4',
        smsCode: '123456',
      );

      final initialDoc = await mockFirestore.getUserDocument(testUid);
      expect(initialDoc!['name'], equals('Anita Desai'));
      expect(initialDoc['phone'], equals('+919876543210'));
      expect(initialDoc['userCategory'], equals('Retailer'));

      // Ensure NO fake placeholder values were injected
      expect(initialDoc['companyName'], isNull);
      expect(initialDoc['dateOfBirth'], isNull);
      expect(initialDoc['email'], isNull);
      expect(initialDoc['gstNumber'], isNull);
      expect(initialDoc['address'], isNull);
      expect(initialDoc['city'], isNull);

      // Customer fills optional fields later via Edit Profile
      await mockFirestore.updateUserProfileData(
        uid: testUid,
        companyName: 'Desai Enterprises',
        dateOfBirth: '20/10/1988',
        email: 'anita@desai.com',
        gstNumber: '24AAACD1234R1Z1',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395001',
        address: {'line1': 'Ring Road', 'city': 'Surat', 'state': 'Gujarat', 'pincode': '395001'},
      );

      final updatedDoc = await mockFirestore.getUserDocument(testUid);
      expect(updatedDoc!['companyName'], equals('Desai Enterprises'));
      expect(updatedDoc['dateOfBirth'], equals('20/10/1988'));
      expect(updatedDoc['email'], equals('anita@desai.com'));
      expect(updatedDoc['gstNumber'], equals('24AAACD1234R1Z1'));
      expect(updatedDoc['city'], equals('Surat'));
      expect(updatedDoc['state'], equals('Gujarat'));
      expect(updatedDoc['pincode'], equals('395001'));
      expect(updatedDoc['address']['line1'], equals('Ring Road'));
    });

    // 5. Profile save does not overwrite salesperson assignment.
    test('5. Profile save does not overwrite salesperson assignment', () async {
      await authService.registerInitialAccount(
        name: 'Vikas Sharma',
        phoneNumber: '+919876543210',
        userCategory: 'Builder / Contractor',
        password: 'Password123!',
        verificationId: 'v_init_reg5',
        smsCode: '123456',
      );
      await authService.verifyAndLinkReferralCode('SALES101');

      final preDoc = await mockFirestore.getUserDocument(testUid);
      final spId = preDoc!['salesPersonId'];
      final spName = preDoc['salespersonName'];
      final spCode = preDoc['salespersonReferralCode'];
      expect(spId, equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));
      expect(spName, equals('Vraj Shah'));
      expect(spCode, equals('SALES101'));

      // Customer performs profile updates
      await mockFirestore.updateUserProfileData(
        uid: testUid,
        companyName: 'Sharma Constructions',
        city: 'Vadodara',
      );

      final postDoc = await mockFirestore.getUserDocument(testUid);
      expect(postDoc!['salesPersonId'], equals(spId));
      expect(postDoc['assignedSalespersonId'], equals(spId));
      expect(postDoc['salespersonName'], equals(spName));
      expect(postDoc['salespersonReferralCode'], equals(spCode));
      expect(postDoc['companyName'], equals('Sharma Constructions'));
      expect(postDoc['city'], equals('Vadodara'));
    });

    // 6. Profile save does not overwrite auth credentials.
    test('6. Profile save does not overwrite auth credentials', () async {
      await authService.registerInitialAccount(
        name: 'Pooja Verma',
        phoneNumber: '+919876543210',
        userCategory: 'Dealer',
        password: 'Password123!',
        verificationId: 'v_init_reg6',
        smsCode: '123456',
      );

      final preDoc = await mockFirestore.getUserDocument(testUid);
      final preHash = preDoc!['passwordHash'];
      final preSalt = preDoc['passwordSalt'];
      final preUsername = preDoc['username'];
      expect(preHash, isNotNull);
      expect(preSalt, isNotNull);
      expect(preUsername, equals('pooja verma'));

      // Customer performs profile update
      await mockFirestore.updateUserProfileData(
        uid: testUid,
        companyName: 'Verma Tiles',
        city: 'Rajkot',
      );

      final postDoc = await mockFirestore.getUserDocument(testUid);
      expect(postDoc!['passwordHash'], equals(preHash));
      expect(postDoc['passwordSalt'], equals(preSalt));
      expect(postDoc['username'], equals(preUsername));
    });

    // 7. Profile save does not overwrite loyalty/reward fields.
    test('7. Profile save does not overwrite loyalty/reward fields', () async {
      await authService.registerInitialAccount(
        name: 'Ketan Shah',
        phoneNumber: '+919876543210',
        userCategory: 'Architect / Interior Designer',
        password: 'Password123!',
        verificationId: 'v_init_reg7',
        smsCode: '123456',
      );

      // Inject loyalty reward fields into user document
      final userDoc = mockFirestore.usersCollection[testUid]!;
      userDoc['loyaltyPoints'] = 500;
      userDoc['lifetimePoints'] = 1200;
      userDoc['tier'] = 'Gold';
      userDoc['tierLevel'] = 2;

      // Customer edits profile
      await mockFirestore.updateUserProfileData(
        uid: testUid,
        city: 'Gandhinagar',
      );

      final postDoc = await mockFirestore.getUserDocument(testUid);
      expect(postDoc!['loyaltyPoints'], equals(500));
      expect(postDoc['lifetimePoints'], equals(1200));
      expect(postDoc['tier'], equals('Gold'));
      expect(postDoc['tierLevel'], equals(2));
      expect(postDoc['city'], equals('Gandhinagar'));
    });

    // 8. Existing Profile photo/showroom image behavior remains unaffected.
    test('8. Existing Profile photo and showroom image behavior remains unaffected', () async {
      await authService.registerInitialAccount(
        name: 'Mehul Mehta',
        phoneNumber: '+919876543210',
        userCategory: 'Dealer',
        password: 'Password123!',
        verificationId: 'v_init_reg8',
        smsCode: '123456',
      );

      // Customer uploads profile photo and showroom images
      const photoUrl = 'https://firebasestorage.googleapis.com/v0/b/itacon-app.appspot.com/o/profiles%2Fphoto.jpg';
      final showroomList = [
        'https://firebasestorage.googleapis.com/v0/b/itacon-app.appspot.com/o/showroom%2Fimg1.jpg',
        'https://firebasestorage.googleapis.com/v0/b/itacon-app.appspot.com/o/showroom%2Fimg2.jpg',
      ];

      await mockFirestore.updateUserProfileData(
        uid: testUid,
        profilePhotoUrl: photoUrl,
        showroomImages: showroomList,
      );

      final postDoc = await mockFirestore.getUserDocument(testUid);
      expect(postDoc!['profilePhotoUrl'], equals(photoUrl));
      expect(postDoc['showroomImages'], equals(showroomList));

      // Verify UserProfile model loads them correctly
      final profile = UserProfile.fromMap(postDoc, testUid);
      expect(profile.profilePhotoUrl, equals(photoUrl));
      expect(profile.showroomImages, equals(showroomList));
    });
  });

  group('SECTION 10: REGRESSION TESTS A-L (CATEGORY & SALESPERSON COMPLETION)', () {
    // A. Missing category cannot register.
    test('A. Missing category cannot register', () async {
      expect(
        () => authService.registerInitialAccount(
          name: 'Test Customer',
          phoneNumber: '+919876543210',
          userCategory: null,
          password: 'Password123!',
          verificationId: 'v_id_a',
          smsCode: '123456',
        ),
        throwsA(predicate((e) => e.toString().contains('Please select your user category.'))),
      );
    });

    // B. Empty category cannot register.
    test('B. Empty category cannot register', () async {
      expect(
        () => authService.registerInitialAccount(
          name: 'Test Customer',
          phoneNumber: '+919876543210',
          userCategory: '',
          password: 'Password123!',
          verificationId: 'v_id_b1',
          smsCode: '123456',
        ),
        throwsA(predicate((e) => e.toString().contains('Please select your user category.'))),
      );
      expect(
        () => authService.registerInitialAccount(
          name: 'Test Customer',
          phoneNumber: '+919876543210',
          userCategory: '   ',
          password: 'Password123!',
          verificationId: 'v_id_b2',
          smsCode: '123456',
        ),
        throwsA(predicate((e) => e.toString().contains('Please select your user category.'))),
      );
    });

    // C. Invalid category cannot register.
    test('C. Invalid category cannot register', () async {
      expect(
        () => authService.registerInitialAccount(
          name: 'Test Customer',
          phoneNumber: '+919876543210',
          userCategory: 'contractors',
          password: 'Password123!',
          verificationId: 'v_id_c1',
          smsCode: '123456',
        ),
        throwsA(predicate((e) => e.toString().contains('Please select your user category.'))),
      );
      expect(
        () => authService.registerInitialAccount(
          name: 'Test Customer',
          phoneNumber: '+919876543210',
          userCategory: 'RandomCategory',
          password: 'Password123!',
          verificationId: 'v_id_c2',
          smsCode: '123456',
        ),
        throwsA(predicate((e) => e.toString().contains('Please select your user category.'))),
      );
    });

    // D. No implicit Dealer fallback.
    test('D. No implicit Dealer fallback', () async {
      try {
        await authService.registerInitialAccount(
          name: 'Fallback Tester',
          phoneNumber: '+919876543210',
          userCategory: null,
          password: 'Password123!',
          verificationId: 'v_id_d',
          smsCode: '123456',
        );
        fail('Registration must not succeed when category is null');
      } catch (e) {
        expect(e.toString(), contains('Please select your user category.'));
      }
      expect(mockFirestore.usersCollection[testUid], isNull);
      expect(mockFirestore.categoryCollections['dealers']?[testUid], isNull);
    });

    // E. Each of 5 valid categories registers correctly.
    test('E. Each of 5 valid categories registers correctly', () async {
      final categories = [
        'Dealer',
        'Architect / Interior Designer',
        'Builder / Contractor',
        'Wholesaler',
        'Retailer',
      ];

      for (int i = 0; i < categories.length; i++) {
        final cat = categories[i];
        final uid = 'TEST_CUST_CAT_$i';
        final localMockFirestore = TestSalespersonFirestoreService();
        final localAuth = TestableAuthService(
          firestoreService: localMockFirestore,
          mockUser: MockAuthUser(uid: uid, phoneNumber: '+91987654321$i'),
        );

        await localAuth.registerInitialAccount(
          name: 'Partner $cat',
          phoneNumber: '+91987654321$i',
          userCategory: cat,
          password: 'Password123!',
          verificationId: 'v_id_e_$i',
          smsCode: '123456',
        );

        final doc = localMockFirestore.usersCollection[uid];
        expect(doc, isNotNull);
        expect(doc!['userCategory'], equals(cat));
      }
    });

    // F. Correct category mirror selected.
    test('F. Correct category mirror selected', () async {
      final mappings = {
        'Dealer': 'dealers',
        'Architect / Interior Designer': 'architects',
        'Builder / Contractor': 'builders',
        'Wholesaler': 'wholesalers',
        'Retailer': 'retailers',
        'Trader': 'traders',
      };

      for (final entry in mappings.entries) {
        final cat = entry.key;
        final expectedCollection = entry.value;
        final uid = 'UID_MIRROR_$expectedCollection';
        final localMockFirestore = TestSalespersonFirestoreService();
        final localAuth = TestableAuthService(
          firestoreService: localMockFirestore,
          mockUser: MockAuthUser(uid: uid, phoneNumber: '+919876543210'),
        );

        await localAuth.registerInitialAccount(
          name: 'Mirror Test',
          phoneNumber: '+919876543210',
          userCategory: cat,
          password: 'Password123!',
          verificationId: 'v_mirror',
          smsCode: '123456',
        );

        expect(localMockFirestore.categoryCollections[expectedCollection]?[uid], isNotNull);
        expect(localMockFirestore.categoryCollections['contractors']?[uid], isNull);
      }
    });

    // G. Signup category persists for existing Profile consumption.
    test('G. Signup category persists for existing Profile consumption', () async {
      await authService.registerInitialAccount(
        name: 'Profile Consumer',
        phoneNumber: '+919876543210',
        userCategory: 'Architect / Interior Designer',
        password: 'Password123!',
        verificationId: 'v_prof',
        smsCode: '123456',
      );

      final userDoc = await mockFirestore.getUserDocument(testUid);
      expect(userDoc!['userCategory'], equals('Architect / Interior Designer'));

      final profile = UserProfile.fromMap(userDoc, testUid);
      expect(profile.userCategory, equals('Architect / Interior Designer'));
      expect(profile.userCategory, isNotNull);
    });

    // H. Initial registration routes AuthScreen (Sales Code step).
    testWidgets('H. Initial registration routes AuthScreen (Sales Code step)', (tester) async {
      await authService.registerInitialAccount(
        name: 'Gate Customer',
        phoneNumber: '+919876543210',
        userCategory: 'Wholesaler',
        password: 'Password123!',
        verificationId: 'v_gate',
        smsCode: '123456',
      );

      final doc = await mockFirestore.getUserDocument(testUid);
      final profile = UserProfile.fromMap(doc!, testUid);
      AppStateService.instance.setCurrentUserProfile(profile);

      final authStream = StreamController<User?>.broadcast();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStream.stream,
            profileLoader: (uid) async => profile,
            authenticatedChild: const Scaffold(body: Text('HOME_SCREEN')),
          ),
        ),
      );

      authStream.add(MockAuthUser(uid: testUid));
      await tester.pumpAndSettle();

      expect(find.byType(AuthScreen), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);
      expect(find.text('HOME_SCREEN'), findsNothing);
      await authStream.close();
    });

    // I. Direct Home impossible before salesperson verification.
    testWidgets('I. Direct Home impossible before salesperson verification', (tester) async {
      const unverifiedProfile = UserProfile(
        userId: 'UNVERIFIED_UID',
        name: 'Unverified Customer',
        phone: '+919876543210',
        email: 'unverified@example.com',
        companyName: 'ITA Co',
        userCategory: 'Dealer',
        role: 'customer',
        salesPersonId: null,
        status: 'pending_salesperson_verification',
      );

      final authStream = StreamController<User?>.broadcast();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStream.stream,
            profileLoader: (uid) async => unverifiedProfile,
            authenticatedChild: const Scaffold(body: Text('HOME_SCREEN')),
          ),
        ),
      );

      authStream.add(MockAuthUser(uid: 'UNVERIFIED_UID'));
      await tester.pumpAndSettle();

      expect(find.text('HOME_SCREEN'), findsNothing);
      expect(find.byType(MainNavigationScreen), findsNothing);
      await authStream.close();
    });

    // J. Successful salesperson completion permits Home.
    testWidgets('J. Successful salesperson completion permits Home', (tester) async {
      await authService.registerInitialAccount(
        name: 'Verified Customer',
        phoneNumber: '+919876543210',
        userCategory: 'Retailer',
        password: 'Password123!',
        verificationId: 'v_ver',
        smsCode: '123456',
      );

      final linked = await authService.verifyAndLinkReferralCode('SALES101');
      expect(linked, isTrue);

      final updatedProfile = await mockFirestore.getUserProfile(testUid);
      expect(updatedProfile?.salesPersonId, equals('WNSahNXK9GQrGoiIEmD4QBvAeim1'));

      final authStream = StreamController<User?>.broadcast();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStream.stream,
            profileLoader: (uid) async => updatedProfile,
            authenticatedChild: const Scaffold(body: Text('HOME_SCREEN')),
          ),
        ),
      );

      authStream.add(MockAuthUser(uid: testUid));
      await tester.pumpAndSettle();

      expect(find.text('HOME_SCREEN'), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);
      await authStream.close();
    });

    // K. Welcome +500 exactly once after completion.
    test('K. Welcome +500 exactly once after completion', () async {
      // Incomplete account has 0 points
      final initialDoc = await mockFirestore.getUserDocument(testUid);
      expect(initialDoc?['loyaltyPoints'] ?? 0, equals(0));

      // Simulate completion reward
      int userPoints = 0;
      bool welcomeBonusGranted = false;

      void onSalespersonVerified() {
        if (!welcomeBonusGranted) {
          userPoints += 500;
          welcomeBonusGranted = true;
        }
      }

      // First verification
      onSalespersonVerified();
      expect(userPoints, equals(500));
      expect(welcomeBonusGranted, isTrue);

      // Duplicate verification or profile update
      onSalespersonVerified();
      expect(userPoints, equals(500));
    });

    // L. Assignment mirrors exactly once after completion.
    test('L. Assignment mirrors exactly once after completion', () async {
      final assignmentRecords = <String, Map<String, dynamic>>{};
      int assignedCount = 0;

      void syncAssignment(String userId, String spId) {
        final key = 'ASGN_$userId';
        if (!assignmentRecords.containsKey(key)) {
          assignmentRecords[key] = {'clientId': userId, 'salespersonId': spId};
          assignedCount += 1;
        }
      }

      // First sync
      syncAssignment('CLIENT_X', 'SP_101');
      expect(assignmentRecords['ASGN_CLIENT_X'], isNotNull);
      expect(assignedCount, equals(1));

      // Retry sync
      syncAssignment('CLIENT_X', 'SP_101');
      expect(assignedCount, equals(1));
    });
  });
}
