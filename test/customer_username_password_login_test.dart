import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:itacon_app/screens/auth_gate.dart';
import 'package:itacon_app/screens/auth_screen.dart';
import 'package:itacon_app/services/auth_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/models/user_profile.dart';

// =============================================================================
// MOCKS FOR FIREBASE AUTH, FIRESTORE & CLOUD FUNCTIONS
// =============================================================================

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

class MockFirebaseAuth implements FirebaseAuth {
  MockUser? _currentUser;
  String? lastSignedInCustomToken;

  MockFirebaseAuth({MockUser? initialUser}) : _currentUser = initialUser;

  @override
  User? get currentUser => _currentUser;

  @override
  Future<UserCredential> signInWithCustomToken(String token) async {
    lastSignedInCustomToken = token;
    final uid = token.replaceFirst('mock_custom_token_for_', '');
    _currentUser = MockUser(uid: uid, phoneNumber: '+919876543210');
    return MockUserCredential(user: _currentUser);
  }

  @override
  Future<void> signOut() async {
    _currentUser = null;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockHttpsCallableResult<T> implements HttpsCallableResult<T> {
  @override
  final T data;

  MockHttpsCallableResult(this.data);
}

class MockHttpsCallable implements HttpsCallable {
  final Map<String, dynamic> Function(dynamic parameters) handler;

  MockHttpsCallable(this.handler);

  @override
  Future<HttpsCallableResult<T>> call<T>([dynamic parameters]) async {
    final result = handler(parameters);
    return MockHttpsCallableResult<T>(result as T);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockFirebaseFunctions implements FirebaseFunctions {
  final Map<String, Map<String, dynamic> Function(dynamic parameters)> callables = {};

  void registerCallable(String name, Map<String, dynamic> Function(dynamic parameters) handler) {
    callables[name] = handler;
  }

  @override
  HttpsCallable httpsCallable(String name, {HttpsCallableOptions? options}) {
    final handler = callables[name];
    if (handler == null) {
      throw FirebaseFunctionsException(
        message: 'Callable function not found: $name',
        code: 'not-found',
      );
    }
    return MockHttpsCallable(handler);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockFirestoreService extends FirestoreService {
  final Map<String, Map<String, dynamic>> userDocuments;

  MockFirestoreService({this.userDocuments = const {}});

  @override
  Future<Map<String, dynamic>?> getUserDocument(String uid) async {
    return userDocuments[uid];
  }

  @override
  Future<UserProfile?> getUserProfile(String uid) async {
    final doc = userDocuments[uid];
    if (doc != null) {
      return UserProfile.fromMap(doc, uid);
    }
    return null;
  }
}

// =============================================================================
// TEST SUITE
// =============================================================================

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await UserSessionService.clearUserSession();
    AuthService.clearSessionState();
  });

  tearDown(() async {
    await UserSessionService.clearUserSession();
    AuthService.clearSessionState();
  });

  group('ITACON Customer Username + Password Authentication Suite', () {
    test('1. Valid Customer Login signs in via Custom Token and hydrates profile', () async {
      final mockAuth = MockFirebaseAuth();
      final mockFunctions = MockFirebaseFunctions();
      final mockFirestore = MockFirestoreService(
        userDocuments: {
          'CUST_UID_101': {
            'userId': 'CUST_UID_101',
            'uid': 'CUST_UID_101',
            'name': 'Patel Tiles',
            'username': 'pateltiles',
            'phone': '+919876543210',
            'role': 'dealer',
            'userCategory': 'dealer',
            'status': 'active',
            'isVerified': true,
            'phoneVerified': true,
            'salesPersonId': 'SP_001',
          },
        },
      );

      mockFunctions.registerCallable('verifyCustomerCredentials', (params) {
        final p = params as Map;
        if (p['username'] == 'pateltiles' && p['password'] == 'Customer@123') {
          return {'customToken': 'mock_custom_token_for_CUST_UID_101'};
        }
        throw FirebaseFunctionsException(
          message: 'Invalid username or password. Please check your credentials and try again.',
          code: 'unauthenticated',
        );
      });

      final authService = AuthService(
        auth: mockAuth,
        firestoreService: mockFirestore,
        functions: mockFunctions,
      );

      await authService.loginCustomerWithUsernamePassword(
        username: 'pateltiles',
        password: 'Customer@123',
      );

      expect(mockAuth.currentUser?.uid, equals('CUST_UID_101'));
      expect(mockAuth.lastSignedInCustomToken, equals('mock_custom_token_for_CUST_UID_101'));
      expect(AppStateService.instance.hasSessionProfile, isTrue);
      expect(AppStateService.instance.currentUserProfile.name, equals('Patel Tiles'));
      expect(AppStateService.instance.currentUserProfile.role, equals('dealer'));
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    test('2. Incorrect Password throws generic unauthenticated error', () async {
      final mockAuth = MockFirebaseAuth();
      final mockFunctions = MockFirebaseFunctions();
      final mockFirestore = MockFirestoreService();

      mockFunctions.registerCallable('verifyCustomerCredentials', (params) {
        throw FirebaseFunctionsException(
          message: 'Invalid username or password. Please check your credentials and try again.',
          code: 'unauthenticated',
        );
      });

      final authService = AuthService(
        auth: mockAuth,
        firestoreService: mockFirestore,
        functions: mockFunctions,
      );

      await expectLater(
        () => authService.loginCustomerWithUsernamePassword(
          username: 'pateltiles',
          password: 'WrongPassword!',
        ),
        throwsA(predicate((e) =>
            e.toString().contains('Invalid username or password'))),
      );
      expect(mockAuth.currentUser, isNull);
      expect(AuthService.isPendingSecondaryValidation.value, isFalse);
    });

    test('3. Blocked or Inactive account is rejected with error', () async {
      final mockAuth = MockFirebaseAuth();
      final mockFunctions = MockFirebaseFunctions();
      final mockFirestore = MockFirestoreService();

      mockFunctions.registerCallable('verifyCustomerCredentials', (params) {
        throw FirebaseFunctionsException(
          message: 'Your account is currently inactive or blocked. Please contact support.',
          code: 'failed-precondition',
        );
      });

      final authService = AuthService(
        auth: mockAuth,
        firestoreService: mockFirestore,
        functions: mockFunctions,
      );

      await expectLater(
        () => authService.loginCustomerWithUsernamePassword(
          username: 'blockeduser',
          password: 'Password@123',
        ),
        throwsA(predicate((e) =>
            e.toString().contains('inactive or blocked'))),
      );
      expect(mockAuth.currentUser, isNull);
    });

    test('4. Rate Limiting exhaustion throws resource-exhausted error', () async {
      final mockAuth = MockFirebaseAuth();
      final mockFunctions = MockFirebaseFunctions();
      final mockFirestore = MockFirestoreService();

      mockFunctions.registerCallable('verifyCustomerCredentials', (params) {
        throw FirebaseFunctionsException(
          message: 'Too many failed login attempts. Please wait 15 minute(s) before trying again.',
          code: 'resource-exhausted',
        );
      });

      final authService = AuthService(
        auth: mockAuth,
        firestoreService: mockFirestore,
        functions: mockFunctions,
      );

      await expectLater(
        () => authService.loginCustomerWithUsernamePassword(
          username: 'bruteforceuser',
          password: 'Password@123',
        ),
        throwsA(predicate((e) =>
            e.toString().contains('Too many failed login attempts'))),
      );
    });

    test('5. Empty username or password throws upfront validation error', () async {
      final authService = AuthService();

      expect(
        () => authService.loginCustomerWithUsernamePassword(
          username: '',
          password: 'Password@123',
        ),
        throwsA(predicate((e) => e.toString().contains('Please enter your username.'))),
      );

      expect(
        () => authService.loginCustomerWithUsernamePassword(
          username: 'validuser',
          password: '',
        ),
        throwsA(predicate((e) => e.toString().contains('Please enter your password.'))),
      );
    });

    test('6. Referral gate check distinguishes verified vs pending salesperson', () {
      final verifiedProfile = UserProfile(
        userId: 'CUST_1',
        name: 'Active Dealer',
        companyName: 'Active Tiles Pvt Ltd',
        phone: '+919876543210',
        email: 'dealer@example.com',
        userCategory: 'Customer',
        role: 'dealer',
        status: 'active',
        phoneVerified: true,
        salesPersonId: 'SP_101',
      );

      expect(AuthGate.requiresSalespersonCompletion(verifiedProfile), isFalse);

      final pendingProfile = UserProfile(
        userId: 'CUST_2',
        name: 'Pending Wholesaler',
        companyName: 'Pending Ceramics Ltd',
        phone: '+919876543211',
        email: 'wholesaler@example.com',
        userCategory: 'Customer',
        role: 'wholesaler',
        status: 'pending_salesperson_verification',
        phoneVerified: false,
        salesPersonId: null,
      );

      expect(AuthGate.requiresSalespersonCompletion(pendingProfile), isTrue);
    });

    test('7. loginUser delegates to loginCustomerWithUsernamePassword when username provided', () async {
      final mockAuth = MockFirebaseAuth();
      final mockFunctions = MockFirebaseFunctions();
      final mockFirestore = MockFirestoreService(
        userDocuments: {
          'CUST_UID_202': {
            'userId': 'CUST_UID_202',
            'uid': 'CUST_UID_202',
            'name': 'Ceramic Hub',
            'username': 'ceramichub',
            'phone': '+919876543222',
            'role': 'wholesaler',
            'status': 'active',
            'isVerified': true,
          },
        },
      );

      mockFunctions.registerCallable('verifyCustomerCredentials', (params) {
        return {'customToken': 'mock_custom_token_for_CUST_UID_202'};
      });

      final authService = AuthService(
        auth: mockAuth,
        firestoreService: mockFirestore,
        functions: mockFunctions,
      );

      await authService.loginUser(
        username: 'ceramichub',
        password: 'Password@123',
      );

      expect(mockAuth.currentUser?.uid, equals('CUST_UID_202'));
    });

    testWidgets('8. Login Screen UI renders Username and Password without Mobile Number or OTP', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        const MaterialApp(
          home: AuthScreen(initialMode: AuthViewMode.login),
        ),
      );
      await tester.pumpAndSettle();

      // Verified: Username & Password fields present
      expect(find.widgetWithText(TextFormField, 'Enter Username'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Enter your password'), findsOneWidget);
      expect(find.text('Forgot Password?'), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);
      expect(find.text('Sign up'), findsOneWidget);

      // Verified: Mobile Number and Send OTP REMOVED from Login screen
      expect(find.text('Mobile Number *'), findsNothing);
      expect(find.text('Send OTP'), findsNothing);
      expect(find.text('Enter 6-Digit OTP *'), findsNothing);
      expect(find.text('Resend'), findsNothing);
    });

    testWidgets('9. Signup Screen UI preserves Mobile Number and Send OTP', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        const MaterialApp(
          home: AuthScreen(initialMode: AuthViewMode.signup),
        ),
      );
      await tester.pumpAndSettle();

      // Verified: Mobile Number and Send OTP are PRESERVED on Signup screen
      expect(find.text('Mobile Number *'), findsOneWidget);
      expect(find.text('Send OTP'), findsOneWidget);
      expect(find.text('Log in'), findsOneWidget);
    });

    testWidgets('10. Session persistence and restoration safeguards', (WidgetTester tester) async {
      SharedPreferences.setMockInitialValues({});
      final profile = UserProfile(
        userId: 'SESSION_USER_101',
        name: 'Session Customer',
        companyName: 'Session Ceramics Ltd',
        phone: '+919876543299',
        email: 'session@example.com',
        userCategory: 'Customer',
        role: 'dealer',
        status: 'active',
        phoneVerified: true,
        salesPersonId: 'SP_999',
      );

      // Save session
      await UserSessionService.saveUserSession(profile);
      AppStateService.instance.setCurrentUserProfile(profile);

      expect(AppStateService.instance.hasSessionProfile, isTrue);
      expect(AppStateService.instance.currentUserProfile.userId, equals('SESSION_USER_101'));

      // Logout cleans up session
      await UserSessionService.clearUserSession();
      expect(AppStateService.instance.hasSessionProfile, isFalse);
    });

    testWidgets('11. Password visibility toggle works without clearing password text', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        const MaterialApp(
          home: AuthScreen(initialMode: AuthViewMode.login),
        ),
      );
      await tester.pumpAndSettle();

      // Enter password
      final passwordFieldFinder = find.widgetWithText(TextFormField, 'Enter your password');
      await tester.enterText(passwordFieldFinder, 'SecretPass123!');
      await tester.pump();

      // Initial state: obscureText is true
      final editableTextBefore = tester.widget<EditableText>(
        find.descendant(of: passwordFieldFinder, matching: find.byType(EditableText)),
      );
      expect(editableTextBefore.obscureText, isTrue);

      // Tap visibility toggle icon
      final toggleIconFinder = find.byIcon(Icons.visibility_off_outlined);
      expect(toggleIconFinder, findsOneWidget);
      await tester.tap(toggleIconFinder);
      await tester.pumpAndSettle();

      // Obscure text is now false, and password text is still intact
      final editableTextAfter = tester.widget<EditableText>(
        find.descendant(of: passwordFieldFinder, matching: find.byType(EditableText)),
      );
      expect(editableTextAfter.obscureText, isFalse);
      expect(editableTextAfter.controller.text, equals('SecretPass123!'));
    });

    test('12. Customers with completed referral verification never asked to repeat', () {
      final completedCustomer = UserProfile(
        userId: 'CUST_VERIFIED_99',
        name: 'Verified Customer',
        companyName: 'Verified Ceramics Ltd',
        phone: '+919876543299',
        email: 'verified@example.com',
        userCategory: 'Customer',
        role: 'dealer',
        status: 'active',
        phoneVerified: true,
        salesPersonId: 'SP_101',
      );

      // Verified customer does NOT require salesperson completion
      expect(AuthGate.requiresSalespersonCompletion(completedCustomer), isFalse);

      final unverifiedCustomer = UserProfile(
        userId: 'CUST_UNVERIFIED_99',
        name: 'Unverified Customer',
        companyName: 'New Ceramics Ltd',
        phone: '+919876543298',
        email: 'unverified@example.com',
        userCategory: 'Customer',
        role: 'dealer',
        status: 'pending_salesperson_verification',
        phoneVerified: false,
        salesPersonId: null,
      );

      // Unverified customer strictly requires salesperson completion
      expect(AuthGate.requiresSalespersonCompletion(unverifiedCustomer), isTrue);
    });
  });
}

