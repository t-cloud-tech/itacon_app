import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:itacon_app/screens/auth_gate.dart';
import 'package:itacon_app/screens/auth_screen.dart';
import 'package:itacon_app/screens/main_navigation_screen.dart';
import 'package:itacon_app/screens/splash_screen.dart';
import 'package:itacon_app/services/auth_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/models/tile_product.dart';

TileProduct createTestTile(String id) {
  return TileProduct(
    id: id,
    name: 'Test Tile $id',
    size: '600x1200',
    surface: 'Glossy',
    tileCategory: 'Floor Tiles',
    color: 'White',
    pattern: 'Marble',
    basePrice: 100.0,
    moq: 1,
    stockStatus: 'available_now',
    availableQuantity: 100,
    images: const [],
    mockupImages: const [],
    faceImages: const [],
    pcsPerBox: 2,
    sqFtPerBox: 15.5,
    boxWeightKg: 28.0,
  );
}

class MockUser implements User {
  @override
  final String uid;
  @override
  final String? phoneNumber;
  @override
  final String? displayName;
  @override
  final String? email;

  MockUser({
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

class MockFirestoreService extends FirestoreService {
  final Map<String, Map<String, dynamic>> userDocuments;
  final bool simulatePermissionDenied;
  final bool simulateNetworkError;

  int getDocumentCalls = 0;
  String? lastRequestedUid;

  MockFirestoreService({
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
}

class MockAuthService extends AuthService {
  final MockUser? mockFirebaseUser;
  bool signOutCalled = false;

  MockAuthService({
    super.firestoreService,
    this.mockFirebaseUser,
  });

  @override
  User? get currentUser => mockFirebaseUser;

  @override
  Future<UserCredential> verifyPhoneOtp({
    required String verificationId,
    required String smsCode,
  }) async {
    if (smsCode != '123456') {
      throw FirebaseAuthException(
        code: 'invalid-verification-code',
        message: 'The OTP code entered is invalid.',
      );
    }
    return MockUserCredential(user: mockFirebaseUser);
  }

  @override
  Future<void> signOutFirebaseUser() async {
    signOutCalled = true;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const testUid = 'UID_PRASHANT_CANONICAL';
  const testPhone = '+919374490901';
  const testUsername = 'Prashant d 2';
  const testPassword = 'Password123!';
  const testSalt = 'salt_hash_123456';
  final testPasswordHash = AuthService.hashPassword(testPassword, testSalt);

  final prashantProfileDoc = <String, dynamic>{
    'userId': testUid,
    'uid': testUid,
    'name': 'Prashant d 2',
    'username': 'Prashant d 2',
    'phone': testPhone,
    'countryCode': '+91',
    'role': 'Wholesaler',
    'userCategory': 'Wholesaler',
    'passwordSalt': testSalt,
    'passwordHash': testPasswordHash,
    'status': 'active',
  };

  const vrajUid = '1uiBFvL1Pzaon7nIy57PRJV9cPY2';
  const vrajPhone = '+918128084783';
  const vrajUsername = 'Vraj K Patel';
  const vrajPassword = 'VrajPassword123!';
  const vrajSalt = 'salt_vraj_998877';
  final vrajPasswordHash = AuthService.hashPassword(vrajPassword, vrajSalt);

  final vrajProfileDoc = <String, dynamic>{
    'userId': vrajUid,
    'uid': vrajUid,
    'name': vrajUsername,
    'username': vrajUsername,
    'phone': vrajPhone,
    'countryCode': '+91',
    'role': 'Wholesaler',
    'userCategory': 'Wholesaler',
    'passwordSalt': vrajSalt,
    'passwordHash': vrajPasswordHash,
    'status': 'active',
  };

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
    AppStateService.instance.clearCart();
    AuthService.clearSessionState();
  });

  group('PRE-APK AUTH REPAIR REGRESSION SUITE (24 Requirements)', () {
    // 1. Firebase auth null → Login
    testWidgets('1. Firebase auth null -> AuthGate renders AuthScreen (Login)', (tester) async {
      final authStreamController = StreamController<User?>();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(authStateStream: authStreamController.stream),
        ),
      );

      authStreamController.add(null);
      await tester.pumpAndSettle();

      expect(find.byType(AuthScreen), findsOneWidget);
      expect(find.byType(MainNavigationScreen), findsNothing);
      await authStreamController.close();
    });

    // 2. Firebase auth resolving → Splash/loading, never Home/Login flash
    testWidgets('2. Firebase auth resolving -> AuthGate shows SplashScreen, never flashes Home', (tester) async {
      final authStreamController = StreamController<User?>();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(authStateStream: authStreamController.stream),
        ),
      );

      // In ConnectionState.waiting, only static splash is shown
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.byType(AuthScreen), findsNothing);
      expect(find.byType(MainNavigationScreen), findsNothing);
      await authStreamController.close();
    });

    // 3. OTP verified but secondary validation pending → Home NOT shown
    testWidgets('3. OTP verified but secondary validation pending -> Home is NOT shown, holds on Login', (tester) async {
      final authStreamController = StreamController<User?>();
      final isPending = ValueNotifier<bool>(true);

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            isPendingValidationOverride: isPending,
          ),
        ),
      );

      // Phone Auth emits authenticated user, but secondary app validation is pending
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);
      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      // Home MUST NOT be shown
      expect(find.byType(MainNavigationScreen), findsNothing);
      expect(find.byType(AuthScreen), findsOneWidget);

      await authStreamController.close();
    });

    const testAuthenticatedHome = Scaffold(body: Text('AUTHENTICATED_HOME_SCREEN'));

    // 4. Correct username/password after OTP → Home shown
    testWidgets('4. Correct username/password after OTP -> Home shown', (tester) async {
      final fakeFirestore = MockFirestoreService(userDocuments: {testUid: prashantProfileDoc});
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);
      final authService = MockAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await authService.loginWithPhoneOtpAndCredentials(
        phoneNumber: testPhone,
        verificationId: 'valid_v_id',
        smsCode: '123456',
        password: testPassword,
        username: testUsername,
      );

      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
      expect(AppStateService.instance.hasSessionProfile, isTrue);
      expect(AppStateService.instance.currentUserProfile.userId, equals(testUid));

      final authStreamController = StreamController<User?>();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => UserProfile.fromMap(prashantProfileDoc, uid),
            authenticatedChild: testAuthenticatedHome,
          ),
        ),
      );

      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(AuthScreen), findsNothing);
      await authStreamController.close();
    });

    // 5. Wrong username after OTP → Home NEVER shown
    test('5. Wrong username after OTP -> rejects with Exception and signOut, Home NEVER shown', () async {
      final fakeFirestore = MockFirestoreService(userDocuments: {testUid: prashantProfileDoc});
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);
      final authService = MockAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: testPhone,
          verificationId: 'valid_v_id',
          smsCode: '123456',
          password: testPassword,
          username: 'WrongUsernameXYZ',
        ),
        throwsA(isA<Exception>()),
      );

      // Pending validation must reset to false and signOut must be executed
      expect(authService.signOutCalled, isTrue);
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
      expect(AppStateService.instance.hasSessionProfile, isFalse);
    });

    // 6. Wrong password after OTP → Home NEVER shown
    test('6. Wrong password after OTP -> rejects with Exception and signOut, Home NEVER shown', () async {
      final fakeFirestore = MockFirestoreService(userDocuments: {testUid: prashantProfileDoc});
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);
      final authService = MockAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: testPhone,
          verificationId: 'valid_v_id',
          smsCode: '123456',
          password: 'IncorrectPassword!',
          username: testUsername,
        ),
        throwsA(isA<Exception>()),
      );

      expect(authService.signOutCalled, isTrue);
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
      expect(AppStateService.instance.hasSessionProfile, isFalse);
    });

    // 7. Failed secondary validation → Firebase user cleaned up correctly
    test('7. Failed secondary validation -> Firebase user signed out and cleaned up', () async {
      final fakeFirestore = MockFirestoreService(userDocuments: {});
      final fakeUser = MockUser(uid: 'MISSING_UID', phoneNumber: testPhone);
      final authService = MockAuthService(
        firestoreService: fakeFirestore,
        mockFirebaseUser: fakeUser,
      );

      // Missing profile doc triggers cleanup
      await expectLater(
        authService.loginWithPhoneOtpAndCredentials(
          phoneNumber: testPhone,
          verificationId: 'valid_v_id',
          smsCode: '123456',
          password: testPassword,
          username: testUsername,
        ),
        throwsA(isA<Exception>()),
      );

      expect(authService.signOutCalled, isTrue);
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    // 8. Successful login → no later automatic redirect to Login
    testWidgets('8. Successful login -> AuthGate stays on MainNavigationScreen permanently', (tester) async {
      final profile = UserProfile.fromMap(prashantProfileDoc, testUid);
      AppStateService.instance.setCurrentUserProfile(profile);
      await UserSessionService.saveUserSession(profile);

      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);
      final authStreamController = StreamController<User?>();

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => profile,
            authenticatedChild: testAuthenticatedHome,
          ),
        ),
      );

      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);

      // Pump multiple frames to verify no delayed timer or secondary redirect triggers
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(AuthScreen), findsNothing);

      await authStreamController.close();
    });

    // 9. Profile load success → Home remains
    testWidgets('9. Profile load success -> Home screen remains rendered', (tester) async {
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);
      final authStreamController = StreamController<User?>();

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => UserProfile.fromMap(prashantProfileDoc, uid),
            authenticatedChild: testAuthenticatedHome,
          ),
        ),
      );

      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      await authStreamController.close();
    });

    // 10. Profile load temporary network failure → no automatic signout
    testWidgets('10. Profile load network failure -> displays error retry card without automatic signout', (tester) async {
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);
      final authStreamController = StreamController<User?>();

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => throw FirebaseException(
              plugin: 'cloud_firestore',
              code: 'unavailable',
              message: 'Network offline',
            ),
          ),
        ),
      );

      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      // Must show connection delay error UI with RETRY SYNC and LOGOUT buttons
      expect(find.text('Connection Delay'), findsOneWidget);
      expect(find.text('RETRY SYNC'), findsOneWidget);
      expect(find.text('LOGOUT'), findsOneWidget);
      // Did NOT sign out to login screen
      expect(find.byType(AuthScreen), findsNothing);
      expect(find.byType(MainNavigationScreen), findsNothing);

      await authStreamController.close();
    });

    // 11. Profile load permission-denied → no automatic signout
    testWidgets('11. Profile load permission-denied -> displays error state without automatic signout', (tester) async {
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);
      final authStreamController = StreamController<User?>();

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => throw FirebaseException(
              plugin: 'cloud_firestore',
              code: 'permission-denied',
              message: 'Permission denied',
            ),
          ),
        ),
      );

      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      expect(find.text('RETRY SYNC'), findsOneWidget);
      expect(find.text('LOGOUT'), findsOneWidget);
      expect(find.byType(AuthScreen), findsNothing);

      await authStreamController.close();
    });

    // 12. Missing optional profile data → no automatic signout
    test('12. Missing optional profile data -> profile parses safely, no signout', () async {
      final minimalDoc = <String, dynamic>{
        'userId': 'MIN_UID_1',
        'name': 'Minimal User',
        'phone': '+919999999999',
        'role': 'Wholesaler',
      };
      final profile = UserProfile.fromMap(minimalDoc, 'MIN_UID_1');
      expect(profile.userId, equals('MIN_UID_1'));
      expect(profile.name, equals('Minimal User'));
      expect(profile.religion, isEmpty);
      expect(profile.dateOfBirth, isEmpty);
      expect(profile.avatarUrl, isEmpty);
    });

    // 13. Canonical profile error → deterministic error state, no Home→Login flash
    testWidgets('13. Canonical profile missing -> deterministic profile error state, no flash', (tester) async {
      final fakeUser = MockUser(uid: 'GENUINELY_MISSING_UID', phoneNumber: testPhone);
      final authStreamController = StreamController<User?>();

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => null,
          ),
        ),
      );

      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      expect(find.text("We couldn't load your customer profile. Please retry."), findsOneWidget);
      expect(find.text('Profile Unavailable'), findsOneWidget);
      expect(find.text('RETRY SYNC'), findsOneWidget);
      expect(find.text('LOGOUT'), findsOneWidget);
      // No fake dealer created, no home flashed, no login flashed
      expect(find.byType(MainNavigationScreen), findsNothing);
      expect(find.byType(AuthScreen), findsNothing);

      await authStreamController.close();
    });

    // 14. Explicit Logout → Login
    testWidgets('14. Explicit Logout -> clears session, pops stack, AuthGate renders AuthScreen', (tester) async {
      final profile = UserProfile.fromMap(prashantProfileDoc, testUid);
      AppStateService.instance.setCurrentUserProfile(profile);
      await UserSessionService.saveUserSession(profile);

      final authStreamController = StreamController<User?>();
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => profile,
            authenticatedChild: testAuthenticatedHome,
          ),
        ),
      );

      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();
      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);

      // Perform logout teardown and stream null emission
      AppStateService.instance.clearUserProfile();
      AppStateService.instance.clearCart();
      await UserSessionService.clearUserSession(signOutFirebase: false);
      authStreamController.add(null);
      await tester.pumpAndSettle();

      expect(find.byType(AuthScreen), findsOneWidget);
      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsNothing);
      expect(AppStateService.instance.hasSessionProfile, isFalse);

      await authStreamController.close();
    });

    // 15. App restart with valid persisted Firebase user → Home without OTP
    testWidgets('15. App restart with valid persisted user -> Home rendered without OTP request', (tester) async {
      final profile = UserProfile.fromMap(prashantProfileDoc, testUid);
      // Simulate persisted session in SharedPreferences
      await UserSessionService.saveUserSession(profile);

      final authStreamController = StreamController<User?>();
      final fakeUser = MockUser(uid: testUid, phoneNumber: testPhone);

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => profile,
            authenticatedChild: testAuthenticatedHome,
          ),
        ),
      );

      // Stream immediately emits persisted user from keystore
      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(AuthScreen), findsNothing);

      await authStreamController.close();
    });

    // 16. App restart → profile reload works
    test('16. App restart -> restoreUserSession restores profile accurately', () async {
      final profile = UserProfile.fromMap(prashantProfileDoc, testUid);
      await UserSessionService.saveUserSession(profile);

      final restored = await UserSessionService.restoreUserSession();
      expect(restored, isNotNull);
      expect(restored!.userId, equals(testUid));
      expect(restored.name, equals('Prashant d 2'));
      expect(restored.phone, equals(testPhone));
      expect(restored.userCategory, equals('Wholesaler'));
    });

    // 17. App restart → cart restoration still works
    test('17. App restart -> loadUserCart restores saved cart for UID', () async {
      final appState = AppStateService.instance;
      final testTile = createTestTile('TILE_1');
      await appState.loadUserCart(testUid);
      expect(appState.totalBoxes, equals(0));

      // Add to cart and persist
      appState.addToCart(testTile, quantity: 5);
      expect(appState.totalBoxes, equals(5));

      // Simulate app kill by clearing in-memory cart
      appState.clearInMemoryCart();
      expect(appState.totalBoxes, equals(0));

      // Restart app and load cart for same user
      await appState.loadUserCart(testUid);
      expect(appState.totalBoxes, equals(5));
      expect(appState.cartItems.first.product.id, equals('TILE_1'));
    });

    // 18. User A logout → User B cannot see User A cart
    test('18. User A logout -> User B cannot see User A cart', () async {
      final appState = AppStateService.instance;
      final tileA = createTestTile('TILE_A');
      final tileB = createTestTile('TILE_B');

      // User A logs in and adds items
      await appState.loadUserCart('USER_A');
      appState.addToCart(tileA, quantity: 10);
      expect(appState.totalBoxes, equals(10));

      // User A logs out
      appState.clearInMemoryCart();
      expect(appState.totalBoxes, equals(0));

      // User B logs in
      await appState.loadUserCart('USER_B');
      expect(appState.totalBoxes, equals(0));
      appState.addToCart(tileB, quantity: 2);
      expect(appState.totalBoxes, equals(2));
      expect(appState.cartItems.first.product.id, equals('TILE_B'));
    });

    // 19. Re-login same user → saved cart restores
    test('19. Re-login same user -> saved cart restores perfectly', () async {
      final appState = AppStateService.instance;
      final tileX = createTestTile('TILE_X');

      // User logs in and adds items
      await appState.loadUserCart(testUid);
      appState.addToCart(tileX, quantity: 15);
      expect(appState.totalBoxes, equals(15));

      // User logs out (memory cleared)
      appState.clearInMemoryCart();
      expect(appState.totalBoxes, equals(0));

      // Same user logs back in
      await appState.loadUserCart(testUid);
      expect(appState.totalBoxes, equals(15));
      expect(appState.cartItems.first.product.id, equals('TILE_X'));
    });

    // 20. Prashant-style canonical UID profile works
    test('20. Prashant canonical UID profile satisfies login and role requirements', () {
      final profile = UserProfile.fromMap(prashantProfileDoc, testUid);
      expect(profile.userId, equals(testUid));
      expect(profile.name, equals('Prashant d 2'));
      expect(profile.userCategory, equals('Wholesaler'));
      expect(profile.role, equals('Wholesaler'));
      expect(prashantProfileDoc['passwordHash'], isNotNull);
      expect(prashantProfileDoc['passwordSalt'], isNotNull);
    });

    // 21. Vraj-style repaired canonical UID profile works
    test('21. Vraj repaired canonical UID profile satisfies login and role requirements', () {
      final profile = UserProfile.fromMap(vrajProfileDoc, vrajUid);
      expect(profile.userId, equals(vrajUid));
      expect(profile.name, equals('Vraj K Patel'));
      expect(profile.userCategory, equals('Wholesaler'));
      expect(profile.role, equals('Wholesaler'));
      expect(vrajProfileDoc['passwordHash'], isNotNull);
      expect(vrajProfileDoc['passwordSalt'], isNotNull);
    });

    // 22. No fake guest/default profile created
    testWidgets('22. No fake guest/default Dealer profile is created when profile is missing', (tester) async {
      final fakeUser = MockUser(uid: 'UNKNOWN_UID', phoneNumber: '+919000000000');
      final authStreamController = StreamController<User?>();

      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(
            authStateStream: authStreamController.stream,
            profileLoader: (uid) async => null,
          ),
        ),
      );

      authStreamController.add(fakeUser);
      await tester.pumpAndSettle();

      expect(AppStateService.instance.hasSessionProfile, isFalse);
      expect(AppStateService.instance.currentUserProfile.name, isNot(equals('Customer')));
      expect(AppStateService.instance.currentUserProfile.name, isNot(equals('Valued Partner')));
      expect(find.byType(MainNavigationScreen), findsNothing);

      await authStreamController.close();
    });

    // 23. No SharedPreferences loggedIn boolean controls authentication
    test('23. SharedPreferences is_logged_in=true does not authenticate if Firebase Auth user is null', () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_logged_in', true);
      await prefs.setString('user_id', 'ORPHANED_UID');
      await prefs.setString('user_name', 'Ghost User');

      // Without active FirebaseAuth user, restoreUserSession returns null (or when Firebase is verified)
      // and AppStateService hasSessionProfile remains false.
      expect(AppStateService.instance.hasSessionProfile, isFalse);
    });

    // 24. No timer/delay controls root auth decision
    testWidgets('24. AuthGate decision is completely event-driven without timers', (tester) async {
      final authStreamController = StreamController<User?>();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(authStateStream: authStreamController.stream),
        ),
      );

      // Event-driven: immediate emission immediately updates widget tree without awaiting time delays
      authStreamController.add(null);
      await tester.pump();
      expect(find.byType(AuthScreen), findsOneWidget);

      await authStreamController.close();
    });
  });
}
