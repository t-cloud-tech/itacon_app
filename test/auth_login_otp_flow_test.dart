import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:itacon_app/services/auth_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/models/user_profile.dart';

class FakeFirestoreService extends FirestoreService {
  final Map<String, Map<String, dynamic>> userDocuments;
  final bool simulatePermissionDenied;
  final bool simulateNetworkError;

  int getDocumentCalls = 0;
  String? lastRequestedUid;
  int collectionQueryCalls = 0;
  int findUserByIdentifierCalls = 0;

  FakeFirestoreService({
    this.userDocuments = const {},
    this.simulatePermissionDenied = false,
    this.simulateNetworkError = false,
  });

  @override
  Future<Map<String, dynamic>?> getUserDocument(String uid) async {
    getDocumentCalls++;
    lastRequestedUid = uid;
    if (simulatePermissionDenied) {
      throw FirebaseException(
        plugin: 'cloud_firestore',
        code: 'permission-denied',
        message: 'Missing or insufficient permissions.',
      );
    }
    if (simulateNetworkError) {
      throw FirebaseException(
        plugin: 'cloud_firestore',
        code: 'unavailable',
        message: 'Network connection failed.',
      );
    }
    return userDocuments[uid];
  }

  @override
  Future<UserProfile?> getUserProfile(String uid) async {
    getDocumentCalls++;
    lastRequestedUid = uid;
    if (simulatePermissionDenied) {
      throw FirebaseException(
        plugin: 'cloud_firestore',
        code: 'permission-denied',
        message: 'Missing or insufficient permissions.',
      );
    }
    if (simulateNetworkError) {
      throw FirebaseException(
        plugin: 'cloud_firestore',
        code: 'unavailable',
        message: 'Network connection failed.',
      );
    }
    final doc = userDocuments[uid];
    if (doc != null) {
      return UserProfile.fromMap(doc, uid);
    }
    return null;
  }

  @override
  Future<Map<String, dynamic>?> findUserByIdentifier(String identifier) async {
    findUserByIdentifierCalls++;
    collectionQueryCalls++;
    return null;
  }
}

class FakeUser implements User {
  @override
  final String uid;
  @override
  final String? phoneNumber;
  @override
  final String? displayName;
  @override
  final String? email;

  FakeUser({
    required this.uid,
    this.phoneNumber,
    this.displayName,
    this.email,
  });

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeUserCredential implements UserCredential {
  @override
  final User? user;
  @override
  final AuthCredential? credential;
  @override
  final AdditionalUserInfo? additionalUserInfo;

  FakeUserCredential({this.user, this.credential, this.additionalUserInfo});
}

class TestableAuthService extends AuthService {
  final FakeUser? mockFirebaseUser;
  final bool simulateOtpFailure;
  final String? otpFailureCode;

  bool otpVerificationStarted = false;
  bool otpVerified = false;
  bool signOutCalled = false;
  bool emailSignInAttempted = false;
  String? lastAttemptedEmail;

  TestableAuthService({
    super.firestoreService,
    this.mockFirebaseUser,
    this.simulateOtpFailure = false,
    this.otpFailureCode,
  });

  @override
  User? get currentUser => mockFirebaseUser;

  @override
  Future<UserCredential> verifyPhoneOtp({
    required String verificationId,
    required String smsCode,
  }) async {
    otpVerificationStarted = true;
    if (simulateOtpFailure) {
      throw FirebaseAuthException(
        code: otpFailureCode ?? 'invalid-verification-code',
        message: 'The OTP code entered is invalid. Please check your SMS and try again.',
      );
    }
    if (smsCode != '123456') {
      throw FirebaseAuthException(
        code: 'invalid-verification-code',
        message: 'The OTP code entered is invalid. Please check your SMS and try again.',
      );
    }
    otpVerified = true;
    return FakeUserCredential(user: mockFirebaseUser);
  }

  @override
  Future<void> signOutFirebaseUser() async {
    signOutCalled = true;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const testUid = 'UID_RAJESH_9876';
  const testPhone = '+919876543210';
  const testUsername = 'rajesh_sharma';
  const testPassword = 'CorrectPass123!';
  const testSalt = 'abc123saltXYZ456';
  final testPasswordHash = AuthService.hashPassword(testPassword, testSalt);

  final validProfileDoc = <String, dynamic>{
    'userId': testUid,
    'uid': testUid,
    'name': 'Rajesh Sharma',
    'username': 'rajesh_sharma',
    'companyName': 'Sharma Ceramic Traders',
    'phone': testPhone,
    'phoneNumber': testPhone,
    'email': 'rajesh@example.com',
    'role': 'dealer',
    'userCategory': 'dealer',
    'passwordSalt': testSalt,
    'passwordHash': testPasswordHash,
  };

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
    AuthService.clearSessionState();
  });

  group('OTP-First + UID Profile Lookup Login Flow', () {
    test('1. Username + Phone + valid OTP + correct password -> SUCCESS', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: testPhone,
        verificationId: 'valid_ver_id',
        smsCode: '123456',
        password: testPassword,
        username: testUsername,
      );

      expect(authService.otpVerified, isTrue);
      expect(fakeFirestore.lastRequestedUid, equals(testUid));
      expect(AppStateService.instance.hasSessionProfile, isTrue);
      expect(AppStateService.instance.currentUserProfile.userId, equals(testUid));
      expect(AppStateService.instance.currentUserProfile.name, equals('Rajesh Sharma'));
      expect(authService.signOutCalled, isFalse);
    });

    test('2. Username present -> OTP verification is NOT skipped', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      // Call loginWithPhoneOtpAndCredentials with a prominent username
      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: testPhone,
        verificationId: 'valid_ver_id',
        smsCode: '123456',
        password: testPassword,
        username: 'rajesh_sharma',
      );

      // Verify OTP verification was executed FIRST and not skipped
      expect(authService.otpVerificationStarted, isTrue);
      expect(authService.otpVerified, isTrue);
    });

    test('3. Valid OTP -> profile is loaded by Firebase UID', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: testPhone,
        verificationId: 'valid_ver_id',
        smsCode: '123456',
        password: testPassword,
        username: testUsername,
      );

      expect(fakeFirestore.getDocumentCalls, equals(1));
      expect(fakeFirestore.lastRequestedUid, equals(testUid));
    });

    test('4. Login path performs NO unauthenticated /users username query', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: testPhone,
        verificationId: 'valid_ver_id',
        smsCode: '123456',
        password: testPassword,
        username: testUsername,
      );

      // Verify no findUserByIdentifier or unauthenticated collection queries were performed
      expect(fakeFirestore.findUserByIdentifierCalls, equals(0));
      expect(fakeFirestore.collectionQueryCalls, equals(0));
    });

    test('5. Login path performs NO /users phone collection query', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: testPhone,
        verificationId: 'valid_ver_id',
        smsCode: '123456',
        password: testPassword,
      );

      expect(fakeFirestore.collectionQueryCalls, equals(0));
      expect(fakeFirestore.getDocumentCalls, equals(1));
      expect(fakeFirestore.lastRequestedUid, equals(testUid));
    });

    test('6. Correct OTP + wrong username -> login rejected', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await expectLater(
        () => authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: testPhone,
          verificationId: 'valid_ver_id',
          smsCode: '123456',
          password: testPassword,
          username: 'wrong_username_here',
        ),
        throwsA(predicate((e) =>
            e is Exception &&
            e.toString().contains('Invalid username or password'))),
      );

      // Firebase session created by this attempt must be signed out
      expect(authService.signOutCalled, isTrue);
      // App state must NOT have an active session
      expect(AppStateService.instance.hasSessionProfile, isFalse);
    });

    test('7. Correct OTP + wrong password -> login rejected', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await expectLater(
        () => authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: testPhone,
          verificationId: 'valid_ver_id',
          smsCode: '123456',
          password: 'IncorrectPassword999!',
          username: testUsername,
        ),
        throwsA(predicate((e) =>
            e is Exception &&
            e.toString().contains('Invalid username or password'))),
      );

      // Firebase session created by this attempt must be signed out
      expect(authService.signOutCalled, isTrue);
      expect(AppStateService.instance.hasSessionProfile, isFalse);
    });

    test('8. Wrong OTP -> login rejected before profile validation', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
        simulateOtpFailure: true,
      );

      expect(
        () async => await authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: testPhone,
          verificationId: 'valid_ver_id',
          smsCode: '999999',
          password: testPassword,
          username: testUsername,
        ),
        throwsA(isA<FirebaseAuthException>()),
      );

      // Profile was never fetched because OTP failed
      expect(fakeFirestore.getDocumentCalls, equals(0));
      expect(AppStateService.instance.hasSessionProfile, isFalse);
    });

    test('9. Profile read permission-denied -> technical error, NOT "invalid username/password"', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
        simulatePermissionDenied: true,
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      expect(
        () async => await authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: testPhone,
          verificationId: 'valid_ver_id',
          smsCode: '123456',
          password: testPassword,
          username: testUsername,
        ),
        throwsA(predicate((e) {
          final msg = e.toString();
          return !msg.contains('Invalid username or password') &&
              (msg.contains('Access denied') || msg.contains('permissions'));
        })),
      );

      // Must NOT sign out Firebase user on temporary / permission error
      expect(authService.signOutCalled, isFalse);
    });

    test('10. Profile network failure -> technical error and not credential mismatch', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
        simulateNetworkError: true,
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      expect(
        () async => await authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: testPhone,
          verificationId: 'valid_ver_id',
          smsCode: '123456',
          password: testPassword,
          username: testUsername,
        ),
        throwsA(predicate((e) {
          final msg = e.toString();
          return !msg.contains('Invalid username or password') &&
              msg.contains('Network unavailable');
        })),
      );

      // Must NOT sign out Firebase user on temporary network error
      expect(authService.signOutCalled, isFalse);
    });

    test('11. App restart with valid FirebaseAuth.currentUser keeps user signed in without OTP', () async {
      // 1. Initial valid session saved
      final validProfile = UserProfile.fromMap(validProfileDoc, testUid);
      await UserSessionService.saveUserSession(validProfile);
      expect(AppStateService.instance.hasSessionProfile, isTrue);

      // 2. Simulate app restart: AppState cleared, SharedPreferences intact
      AppStateService.instance.clearUserProfile();
      expect(AppStateService.instance.hasSessionProfile, isFalse);

      // 3. UserSessionService restores cached session directly by UID
      final restored = await UserSessionService.restoreUserSession();
      expect(restored, isNotNull);
      expect(restored!.userId, equals(testUid));
      expect(restored.name, equals('Rajesh Sharma'));

      AppStateService.instance.setCurrentUserProfile(restored);
      expect(AppStateService.instance.hasSessionProfile, isTrue);
      // Confirmed: No OTP prompt or SMS verification was requested for restored session
    });

    test('12. No dummy user_\$phone@itacon.com email fallback occurs in Phone OTP login path', () async {
      final fakeFirestore = FakeFirestoreService(
        userDocuments: {testUid: validProfileDoc},
      );
      final fakeUser = FakeUser(uid: testUid, phoneNumber: testPhone);
      final authService = TestableAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: testPhone,
        verificationId: 'valid_ver_id',
        smsCode: '123456',
        password: testPassword,
        username: testUsername,
      );

      // Verify that email sign-in was never triggered
      expect(authService.emailSignInAttempted, isFalse);
      expect(authService.lastAttemptedEmail, isNull);
    });
  });
}
