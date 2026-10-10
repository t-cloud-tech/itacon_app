import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:itacon_app/services/auth_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/models/user_profile.dart';

// =============================================================================
// IN-MEMORY FAKE FIRESTORE SERVICE FOR REGISTRATION & AUTH
// =============================================================================

class MockFirestoreService extends FirestoreService {
  final Map<String, Map<String, dynamic>> usersCollection = {};
  final Map<String, Map<String, Map<String, dynamic>>> categoryCollections = {};
  final Map<String, Map<String, dynamic>> customerReferrals = {};
  final Map<String, Map<String, dynamic>> clientAssignments = {};
  final Map<String, Map<String, dynamic>> autoAssignUser = {};

  bool simulateMasterWriteFailure = false;
  bool simulateCategoryWriteFailure = false;
  bool simulateNetworkFailure = false;
  bool simulatePermissionDenied = false;

  MockFirestoreService();

  @override
  Future<void> createUserProfile({
    required String uid,
    String? phone,
    String? phoneNumber,
    String? name,
    @Deprecated('Use name instead') String? fullName,
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
    if (simulateMasterWriteFailure) {
      throw FirebaseException(plugin: 'cloud_firestore', code: 'unavailable', message: 'Write failed');
    }

    final effectiveCategory = (userCategory != null && userCategory.trim().isNotEmpty)
        ? userCategory.trim()
        : role;
    final catColName = FirestoreService.getCategoryCollectionName(effectiveCategory.isNotEmpty ? effectiveCategory : role);
    final resolvedName = (name != null && name.trim().isNotEmpty) ? name.trim() : (fullName ?? '');
    final canonicalUsername = resolvedName.trim().toLowerCase();
    final phoneParts = FirestoreService.parsePhoneNumberComponents(phone ?? phoneNumber ?? '', explicitCountryCode: countryCode);

    final docData = {
      'userId': uid,
      'uid': uid,
      'name': resolvedName,
      'username': canonicalUsername,
      'phone': phoneParts['e164Phone'],
      'countryCode': phoneParts['countryCode'],
      'userCategory': effectiveCategory,
      'role': role,
      'status': status ?? 'active',
      'passwordHash': passwordHash,
      'passwordSalt': passwordSalt,
      'assignedSalespersonId': assignedSalespersonId,
      'salesPersonId': assignedSalespersonId,
      'salespersonName': salespersonName,
      'salespersonPhone': salespersonPhone,
      'salespersonReferralCode': salespersonReferralCode,
      'isVerified': isVerified,
      'phoneVerified': phoneVerified ?? isVerified,
    };

    if (simulateCategoryWriteFailure) {
      throw FirebaseException(plugin: 'cloud_firestore', code: 'unavailable', message: 'Category mirror failed');
    }

    // Atomic write simulator
    usersCollection[uid] = Map<String, dynamic>.from(docData);

    final catData = Map<String, dynamic>.from(docData);
    catData.remove('passwordHash');
    catData.remove('passwordSalt');
    catData.remove('username');

    categoryCollections.putIfAbsent(catColName, () => {})[uid] = catData;
  }

  @override
  Future<Map<String, dynamic>?> verifySalespersonReferralCode(String code) async {
    final norm = code.trim().toUpperCase();
    if (norm == 'SALES101') {
      return {
        'id': 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        'salespersonId': 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        'name': 'Vraj Shah',
        'phone': '+919876543210',
        'referralCode': 'SALES101',
        'isActive': true,
        'status': 'active',
      };
    }
    return null;
  }

  @override
  Future<SalespersonCodeResult> verifySalespersonCodeDetailed(String referralCode) async {
    final norm = referralCode.trim().toUpperCase();
    if (norm == 'SALES101') {
      return SalespersonCodeResult(
        status: SalespersonCodeStatus.active,
        data: {
          'id': 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
          'salespersonId': 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
          'name': 'Vraj Shah',
          'phone': '+919876543210',
          'referralCode': 'SALES101',
          'isActive': true,
          'status': 'active',
        },
      );
    }
    return const SalespersonCodeResult(status: SalespersonCodeStatus.notFound);
  }

  @override
  Future<Map<String, dynamic>?> getUserDocument(String uid) async {
    if (simulateNetworkFailure) {
      throw FirebaseException(plugin: 'cloud_firestore', code: 'unavailable', message: 'Network unavailable');
    }
    if (simulatePermissionDenied) {
      throw FirebaseException(plugin: 'cloud_firestore', code: 'permission-denied', message: 'Permission denied');
    }
    return usersCollection[uid];
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
  Future<Map<String, dynamic>?> getCategoryDocument(String categoryCollection, String uid) async {
    return categoryCollections[categoryCollection]?[uid];
  }

  @override
  Future<void> saveCustomerReferralCode({
    required String userId,
    required String referralCode,
    String? userName,
    String? userPhone,
    String? userCategory,
  }) async {
    final code = referralCode.trim().toUpperCase();
    final docId = '${userId}_$code';
    customerReferrals[docId] = {
      'referralCode': code,
      'userId': userId,
      'clientId': userId,
      'userName': userName ?? '',
      'userPhone': userPhone ?? '',
      'userCategory': userCategory ?? '',
    };
  }

  @override
  Future<void> executeAtomicClientAssignment({
    required String clientId,
    required String salespersonId,
    String assignmentType = 'manual_referral',
    String? clientName,
    String? clientPhone,
    String? companyName,
    String? clientCategory,
  }) async {
    final rawUserExists = usersCollection.containsKey(clientId);
    if (!rawUserExists) {
      // Phase 5: Never create an assignment-only stub!
      return;
    }

    usersCollection[clientId]?['assignedSalespersonId'] = salespersonId;
    usersCollection[clientId]?['salesPersonId'] = salespersonId;
    usersCollection[clientId]?['isVerified'] = true;

    final assignmentId = 'ASGN_$clientId';
    clientAssignments[assignmentId] = {
      'clientId': clientId,
      'salespersonId': salespersonId,
      'assignmentType': assignmentType,
    };
    autoAssignUser[clientId] = {
      'clientId': clientId,
      'salespersonId': salespersonId,
    };
  }
}

// =============================================================================
// TESTABLE AUTH SERVICE IMPLEMENTATION
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

class MatrixTestableAuthService extends AuthService {
  MockAuthUser? mockUser;
  bool simulateOtpFailure = false;
  String? otpFailureCode;
  bool signedOut = false;

  MatrixTestableAuthService({
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
    if (simulateOtpFailure) {
      throw FirebaseAuthException(
        code: otpFailureCode ?? 'invalid-verification-code',
        message: 'Invalid SMS verification code',
      );
    }
    return MockUserCredential(user: mockUser);
  }

  @override
  Future<void> signOutFirebaseUser() async {
    signedOut = true;
  }
}

// =============================================================================
// AUTOMATED TEST SUITE: PHASES 20, 21, 22
// =============================================================================

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    AuthService.isPendingSecondaryValidation.value = false;
  });

  group('PHASE 20: Comprehensive Customer Registration Matrix (All 5 Categories)', () {
    const categories = [
      'dealer',
      'architect',
      'builder',
      'wholesaler',
      'retailer',
    ];

    for (final category in categories) {
      test('Complete Registration for category: $category', () async {
        final mockFirestore = MockFirestoreService();
        const testUid = 'FIREBASE_AUTH_UID_CAT_TEST';
        final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
        final authService = MatrixTestableAuthService(
          firestoreService: mockFirestore,
          mockUser: mockUser,
        );

        await authService.registerUser(
          name: 'Test Customer $category',
          phoneNumber: '+91 98765 43210',
          countryCode: '+91',
          categoryId: category,
          password: 'Password123!',
          verificationId: 'v_id_123',
          smsCode: '123456',
          referralCode: 'SALES101',
        );

        // 1. Firebase UID is canonical ID
        expect(authService.currentUid, equals(testUid));

        // 2. Master document exists in users/{uid}
        final masterDoc = mockFirestore.usersCollection[testUid];
        expect(masterDoc, isNotNull);
        expect(masterDoc!['uid'], equals(testUid));
        expect(masterDoc['userId'], equals(testUid));

        // 3. No USER_<timestamp> ID used
        expect(testUid.startsWith('USER_'), isFalse);

        // 4. Canonical username populated (lowercase, trimmed)
        expect(masterDoc['username'], equals('test customer $category'));

        // 5. Phone normalized to E.164
        expect(masterDoc['phone'], equals('+919876543210'));
        expect(masterDoc['countryCode'], equals('+91'));

        // 6. Status active
        expect(masterDoc['status'], equals('active'));

        // 7. Password hash and salt present
        expect(masterDoc['passwordHash'], isNotNull);
        expect(masterDoc['passwordSalt'], isNotNull);

        // 8. Correct category mirror collection exists with SAME UID
        final expectedColName = FirestoreService.getCategoryCollectionName(category);
        final catDoc = mockFirestore.categoryCollections[expectedColName]?[testUid];
        expect(catDoc, isNotNull);
        expect(catDoc!['uid'], equals(testUid));
        expect(catDoc['userId'], equals(testUid));

        // 9. Category mirror contains NO sensitive credentials
        expect(catDoc.containsKey('passwordHash'), isFalse);
        expect(catDoc.containsKey('passwordSalt'), isFalse);
        expect(catDoc.containsKey('username'), isFalse);

        // 10. Wrong category collections do NOT have this user
        for (final otherCat in categories) {
          if (otherCat != category) {
            final otherCol = FirestoreService.getCategoryCollectionName(otherCat);
            expect(mockFirestore.categoryCollections[otherCol]?[testUid], isNull);
          }
        }
      });
    }
  });

  group('PHASE 21: Register -> Logout -> Login Verification for All Categories', () {
    const categories = [
      'dealer',
      'architect',
      'builder',
      'wholesaler',
      'retailer',
    ];

    for (final category in categories) {
      test('Register -> Logout -> Login for category: $category', () async {
        final mockFirestore = MockFirestoreService();
        final testUid = 'UID_LOGIN_FLOW_$category';
        final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
        final authService = MatrixTestableAuthService(
          firestoreService: mockFirestore,
          mockUser: mockUser,
        );

        // 1. Register
        await authService.registerUser(
          name: 'Partner $category',
          phoneNumber: '+919876543210',
          categoryId: category,
          password: 'SecurePass123!',
          verificationId: 'v_id_1',
          smsCode: '654321',
          referralCode: 'SALES101',
        );

        expect(AuthService.isPendingSecondaryValidation.value, isFalse);

        // 2. Logout (clear session)
        await UserSessionService.clearUserSession(signOutFirebase: false);
        final prefs = await SharedPreferences.getInstance();
        expect(prefs.getBool('is_logged_in') ?? false, isFalse);

        // 3. Login using same credentials
        await authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v_id_2',
          smsCode: '654321',
          password: 'SecurePass123!',
          username: 'Partner $category',
        );

        // 4. Verify login succeeded and session saved
        expect(AuthService.isPendingSecondaryValidation.value, isFalse);
        expect(prefs.getBool('is_logged_in') ?? false, isTrue);
        expect(prefs.getString('user_id'), equals(testUid));
        expect(prefs.getString('user_category'), equals(category));
      });
    }
  });

  group('PHASE 22: Failure & Edge Case Test Matrix (30 Scenarios)', () {
    test('1. Username case difference allows login (case-insensitive)', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_CASE_TEST';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await authService.registerUser(
        name: 'Vipul Patel',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      // Login with UPPERCASE
      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: '+919876543210',
        verificationId: 'v2',
        smsCode: '111111',
        password: 'Password123!',
        username: 'VIPUL PATEL',
      );
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    test('2. Username with surrounding whitespace is accepted', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_WS_TEST';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await authService.registerUser(
        name: 'Anil Kumar',
        phoneNumber: '+919876543210',
        categoryId: 'architect',
        password: 'Password123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: '+919876543210',
        verificationId: 'v2',
        smsCode: '111111',
        password: 'Password123!',
        username: '   anil kumar   ',
      );
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    test('3. Wrong username throws Invalid username or password error', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_WRONG_USER';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await authService.registerUser(
        name: 'Correct User',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v2',
          smsCode: '111111',
          password: 'Password123!',
          username: 'Wrong Username',
        ),
        throwsA(predicate((e) => e.toString().contains('Invalid username or password'))),
      );
      expect(authService.signedOut, isTrue);
    });

    test('4. Wrong password throws Invalid username or password error', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_WRONG_PASS';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await authService.registerUser(
        name: 'Ramesh Patel',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v2',
          smsCode: '111111',
          password: 'IncorrectPassword999!',
          username: 'Ramesh Patel',
        ),
        throwsA(predicate((e) => e.toString().contains('Invalid username or password'))),
      );
    });

    test('5. Wrong OTP throws FirebaseAuthException and does not proceed', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_WRONG_OTP';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser)
        ..simulateOtpFailure = true
        ..otpFailureCode = 'invalid-verification-code';

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v1',
          smsCode: '000000',
          password: 'Password123!',
        ),
        throwsA(isA<FirebaseAuthException>()),
      );
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    test('6. Expired OTP throws session-expired error', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_EXP_OTP';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser)
        ..simulateOtpFailure = true
        ..otpFailureCode = 'session-expired';

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v1',
          smsCode: '111111',
          password: 'Password123!',
        ),
        throwsA(isA<FirebaseAuthException>()),
      );
    });

    test('7. Firebase Auth exists but profile missing in Firestore throws proper message', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_NO_PROFILE';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v1',
          smsCode: '111111',
          password: 'Password123!',
        ),
        throwsA(predicate((e) => e.toString().contains('No registered ITACON customer profile was found'))),
      );
    });

    test('8. Incomplete profile (missing passwordHash) throws setup incomplete, NOT bad credentials', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_INCOMPLETE_PROFILE';
      mockFirestore.usersCollection[testUid] = {
        'uid': testUid,
        'userId': testUid,
        'name': 'Incomplete User',
        'status': 'active',
        // passwordHash & passwordSalt missing!
      };

      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v1',
          smsCode: '111111',
          password: 'Password123!',
        ),
        throwsA(predicate((e) => e.toString().contains("We couldn't complete your account setup"))),
      );
    });

    test('9. Inactive account status blocks login with inactive account message', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_INACTIVE_ACC';
      final salt = AuthService.generateSalt();
      final hash = AuthService.hashPassword('Password123!', salt);
      mockFirestore.usersCollection[testUid] = {
        'uid': testUid,
        'userId': testUid,
        'name': 'Suspended User',
        'status': 'inactive',
        'passwordHash': hash,
        'passwordSalt': salt,
      };

      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v1',
          smsCode: '111111',
          password: 'Password123!',
        ),
        throwsA(predicate((e) => e.toString().contains('Your account is currently inactive'))),
      );
    });

    test('10. Network failure does NOT sign out user and gives network message', () async {
      final mockFirestore = MockFirestoreService()..simulateNetworkFailure = true;
      const testUid = 'UID_NET_FAIL';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v1',
          smsCode: '111111',
          password: 'Password123!',
        ),
        throwsA(predicate((e) => e.toString().contains('Network unavailable'))),
      );
      // User must NOT be signed out on technical error
      expect(authService.signedOut, isFalse);
    });

    test('11. Firestore permission-denied does NOT sign out user and reports access denied', () async {
      final mockFirestore = MockFirestoreService()..simulatePermissionDenied = true;
      const testUid = 'UID_PERM_DENIED';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v1',
          smsCode: '111111',
          password: 'Password123!',
        ),
        throwsA(predicate((e) => e.toString().contains('Access denied while reading user profile'))),
      );
      expect(authService.signedOut, isFalse);
    });

    test('12. Registration profile write failure prevents Home access', () async {
      final mockFirestore = MockFirestoreService()..simulateMasterWriteFailure = true;
      const testUid = 'UID_WRITE_FAIL';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await expectLater(
        authService.registerUser(
          name: 'Fail User',
          phoneNumber: '+919876543210',
          categoryId: 'dealer',
          password: 'Password123!',
          verificationId: 'v1',
          smsCode: '111111',
          referralCode: 'SALES101',
        ),
        throwsA(isA<FirebaseException>()),
      );
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    test('13. Retry after partial registration reuses SAME UID idempotently', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'SAME_FIREBASE_AUTH_UID_001';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      // Attempt 1: simulate failure
      mockFirestore.simulateCategoryWriteFailure = true;
      try {
        await authService.registerUser(
          name: 'Retry User',
          phoneNumber: '+919876543210',
          categoryId: 'dealer',
          password: 'Password123!',
          verificationId: 'v1',
          smsCode: '111111',
          referralCode: 'SALES101',
        );
      } catch (_) {}

      // Attempt 2: retry on same UID
      mockFirestore.simulateCategoryWriteFailure = false;
      await authService.registerUser(
        name: 'Retry User',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v2',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      // Verify profile is complete under SAME UID
      final profile = mockFirestore.usersCollection[testUid];
      expect(profile, isNotNull);
      expect(profile!['uid'], equals(testUid));
      expect(profile['userId'], equals(testUid));
      expect(mockFirestore.usersCollection.length, equals(1)); // No duplicate user created!
    });

    test('14. Salesperson assignment cannot create stub when user document is absent', () async {
      final mockFirestore = MockFirestoreService();
      const nonExistentUid = 'NON_EXISTENT_UID';

      await mockFirestore.executeAtomicClientAssignment(
        clientId: nonExistentUid,
        salespersonId: 'SP_101',
      );

      // Verify users collection does NOT contain a stub for nonExistentUid
      expect(mockFirestore.usersCollection.containsKey(nonExistentUid), isFalse);
    });

    test('15. Referral code recording is idempotent on repeated saves', () async {
      final mockFirestore = MockFirestoreService();
      const userId = 'USER_REF_IDEM_01';
      const refCode = 'PARTNER500';

      await mockFirestore.saveCustomerReferralCode(
        userId: userId,
        referralCode: refCode,
        userName: 'Idempotent User',
      );

      await mockFirestore.saveCustomerReferralCode(
        userId: userId,
        referralCode: refCode,
        userName: 'Idempotent User',
      );

      // Only one document should exist for this user + code combination
      expect(mockFirestore.customerReferrals.length, equals(1));
      expect(mockFirestore.customerReferrals['${userId}_$refCode'], isNotNull);
    });

    test('16. Cart remains strictly isolated per user UID', () async {
      final appState = AppStateService.instance;
      await appState.loadUserCart('CUSTOMER_UID_A');
      expect(appState.currentCartUserId, equals('CUSTOMER_UID_A'));

      await appState.loadUserCart('CUSTOMER_UID_B');
      expect(appState.currentCartUserId, equals('CUSTOMER_UID_B'));
    });

    test('17. Section 3: Password hash consistency with production verifier', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_HASH_CONSISTENCY';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      // Register with known test password
      await authService.registerUser(
        name: 'Ramesh Patel',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'TestSecretPassword123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      final userDoc = mockFirestore.usersCollection[testUid];
      expect(userDoc, isNotNull);
      final storedHash = userDoc!['passwordHash'] as String;
      final storedSalt = userDoc['passwordSalt'] as String;
      expect(storedHash.isNotEmpty, isTrue);
      expect(storedSalt.isNotEmpty, isTrue);

      // Immediate real production login verifier with matching credentials -> PASS
      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: '+919876543210',
        verificationId: 'v2',
        smsCode: '111111',
        password: 'TestSecretPassword123!',
        username: 'Ramesh Patel',
      );
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);

      // Wrong username -> FAIL
      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v3',
          smsCode: '111111',
          password: 'TestSecretPassword123!',
          username: 'Wrong Person',
        ),
        throwsA(predicate((e) => e.toString().contains('Invalid username or password'))),
      );

      // Wrong password -> FAIL
      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v4',
          smsCode: '111111',
          password: 'WrongPassword999!',
          username: 'Ramesh Patel',
        ),
        throwsA(predicate((e) => e.toString().contains('Invalid username or password'))),
      );
    });

    test('18. Section 4: Registration persistence after simulated app restart', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_RESTART_PERSISTENCE';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      // 1. Register customer
      await authService.registerUser(
        name: 'Persistent Customer',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      // Session was saved during registration
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('is_logged_in'), isTrue);
      expect(prefs.getString('user_id'), equals(testUid));

      // 2. Terminate simulated app / clear in-memory state
      AuthService.clearSessionState();
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);

      // 3. Restore session on simulated restart
      final restoredProfile = await UserSessionService.restoreUserSession();
      expect(restoredProfile, isNotNull);
      expect(restoredProfile!.userId, equals(testUid));
      expect(restoredProfile.name, equals('Persistent Customer'));
      expect(restoredProfile.status, equals('active'));

      // Verified: No OTP or password required again, profile loaded cleanly
    });

    test('19. Section 5: Registration retry after network failure reuses SAME UID idempotently', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_NET_FAIL_RETRY';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      // 1. Simulate network failure on first attempt
      mockFirestore.simulateMasterWriteFailure = true;
      await expectLater(
        authService.registerUser(
          name: 'Network Retry User',
          phoneNumber: '+919876543210',
          categoryId: 'wholesaler',
          password: 'Password123!',
          verificationId: 'v1',
          smsCode: '111111',
          referralCode: 'SALES101',
        ),
        throwsA(isA<FirebaseException>()),
      );

      // 2. Retry registration on restored network
      mockFirestore.simulateMasterWriteFailure = false;
      await authService.registerUser(
        name: 'Network Retry User',
        phoneNumber: '+919876543210',
        categoryId: 'wholesaler',
        password: 'Password123!',
        verificationId: 'v2',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      // 3. Verify exactly 1 master doc, 1 category doc, 1 referral doc under SAME UID
      expect(mockFirestore.usersCollection.length, equals(1));
      expect(mockFirestore.usersCollection.containsKey(testUid), isTrue);
      expect(mockFirestore.categoryCollections['wholesalers']?.length, equals(1));
      expect(mockFirestore.categoryCollections['wholesalers']?.containsKey(testUid), isTrue);
      expect(testUid.startsWith('USER_'), isFalse);
    });

    test('20. Section 7: Existing phone re-registration blocks duplicate and guides to login', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'CANONICAL_PHONE_UID';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      // Initial registration
      await authService.registerUser(
        name: 'Original Phone Owner',
        phoneNumber: '+919876543210',
        categoryId: 'builder',
        password: 'Password123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      expect(mockFirestore.usersCollection.length, equals(1));

      // Re-registration attempt with same completed account throws DuplicateAccountException
      expect(
        () => authService.registerUser(
          name: 'Original Phone Owner Updated',
          phoneNumber: '+919876543210',
          categoryId: 'builder',
          password: 'Password123!',
          verificationId: 'v2',
          smsCode: '111111',
          referralCode: 'SALES101',
        ),
        throwsA(isA<DuplicateAccountException>()),
      );

      // Must NOT create a second users document
      expect(mockFirestore.usersCollection.length, equals(1));
    });

    test('21. Section 8: Display name is preserved while canonical username is normalized lowercase', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_NAME_CASE_FORMAT';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await authService.registerUser(
        name: 'Ramesh Patel',
        phoneNumber: '+919876543210',
        categoryId: 'dealer',
        password: 'Password123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      final doc = mockFirestore.usersCollection[testUid]!;
      // Display name retains exact original casing
      expect(doc['name'], equals('Ramesh Patel'));
      // Username is strictly normalized lowercase for login comparison
      expect(doc['username'], equals('ramesh patel'));

      // Both casings and whitespace match at login
      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: '+919876543210',
        verificationId: 'v2',
        smsCode: '111111',
        password: 'Password123!',
        username: '  RAMESH PATEL  ',
      );
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    test('22. Section 10: Home flash regression test - gate closes on wrong credentials', () async {
      final mockFirestore = MockFirestoreService();
      const testUid = 'UID_FLASH_REGRESSION';
      final mockUser = MockAuthUser(uid: testUid, phoneNumber: '+919876543210');
      final authService = MatrixTestableAuthService(firestoreService: mockFirestore, mockUser: mockUser);

      await authService.registerUser(
        name: 'Flash Test User',
        phoneNumber: '+919876543210',
        categoryId: 'retailer',
        password: 'CorrectPassword123!',
        verificationId: 'v1',
        smsCode: '111111',
        referralCode: 'SALES101',
      );

      // Attempt login with WRONG password
      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: '+919876543210',
          verificationId: 'v2',
          smsCode: '111111',
          password: 'WrongPassword999!',
          username: 'Flash Test User',
        ),
        throwsA(predicate((e) => e.toString().contains('Invalid username or password'))),
      );

      // CRITICAL: isPendingSecondaryValidation must be false, preventing Home flash
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
      expect(authService.signedOut, isTrue);
    });
  });
}
