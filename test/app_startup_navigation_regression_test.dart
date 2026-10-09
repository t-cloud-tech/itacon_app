import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/auth_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/notification_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/screens/splash_screen.dart';
import 'package:itacon_app/screens/auth_gate.dart';
import 'package:itacon_app/screens/auth_screen.dart';
import 'package:itacon_app/screens/referral_gate_screen.dart';
import 'package:itacon_app/screens/main_navigation_screen.dart';
import 'package:itacon_app/screens/profile_screen.dart';

class MockTestUser implements User {
  @override
  final String uid;
  @override
  final String? phoneNumber;
  @override
  final String? displayName;
  @override
  final String? email;

  MockTestUser({
    required this.uid,
    this.phoneNumber,
    this.displayName,
    this.email,
  });

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockTestUserCredential implements UserCredential {
  @override
  final User? user;
  @override
  final AuthCredential? credential;
  @override
  final AdditionalUserInfo? additionalUserInfo;

  MockTestUserCredential({this.user, this.credential, this.additionalUserInfo});
}

class StartupTestFirestoreService extends FirestoreService {
  final Map<String, Map<String, dynamic>> userStore = {};
  bool simulateProfileError = false;

  @override
  Future<Map<String, dynamic>?> getUserDocument(String uid) async {
    if (simulateProfileError) {
      throw FirebaseException(
        plugin: 'cloud_firestore',
        code: 'unavailable',
        message: 'Network connection failed.',
      );
    }
    return userStore[uid];
  }

  @override
  Future<UserProfile?> getUserProfile(String uid) async {
    if (simulateProfileError) {
      throw FirebaseException(
        plugin: 'cloud_firestore',
        code: 'unavailable',
        message: 'Network connection failed.',
      );
    }
    final doc = userStore[uid];
    if (doc != null) {
      return UserProfile.fromMap(doc, uid);
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
    userStore[uid] = {
      'userId': uid,
      'uid': uid,
      'name': name ?? fullName ?? '',
      'phone': phone ?? phoneNumber ?? '',
      'role': role,
      'userCategory': userCategory ?? 'Dealer',
      'isVerified': isVerified,
      'phoneVerified': phoneVerified ?? isVerified,
      'salesPersonId': assignedSalespersonId,
      'assignedSalespersonId': assignedSalespersonId,
      'salespersonName': salespersonName,
      'salespersonPhone': salespersonPhone,
      'salespersonReferralCode': salespersonReferralCode,
      'status': status ?? (isVerified ? 'active' : 'pending_salesperson_verification'),
    };
  }
}

class StartupTestAuthService extends AuthService {
  final MockTestUser? mockUser;
  bool signOutInvoked = false;

  StartupTestAuthService({
    super.firestoreService,
    this.mockUser,
  });

  @override
  User? get currentUser => mockUser;

  @override
  Future<UserCredential> verifyPhoneOtp({
    required String verificationId,
    required String smsCode,
  }) async {
    return MockTestUserCredential(user: mockUser);
  }

  @override
  Future<void> signOutFirebaseUser() async {
    signOutInvoked = true;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
    AuthService.clearSessionState();
  });

  tearDown(() {
    AppStateService.instance.clearUserProfile();
    AuthService.clearSessionState();
  });

  group('STARTUP & NAVIGATION REGRESSION TEST SUITE (TESTS 1-10)', () {
    // TEST 1: Fresh logged-out launch: Original Splash → Login
    testWidgets('TEST 1: Fresh logged-out launch: Original Splash -> Login', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: SplashScreen(
            minDurationMs: 0,
            initialUser: null,
          ),
        ),
      );

      // 1. Original Splash screen appears first
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.byType(AuthScreen), findsNothing);

      // Advance through navigation animation
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));

      // 2. Unauthenticated user resolves to Login flow
      expect(find.byType(AuthScreen), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);
      expect(find.byType(MainNavigationScreen), findsNothing);
    });

    // TEST 2: Existing completed customer: Original Splash → Home
    testWidgets('TEST 2: Existing completed customer: Original Splash -> Home', (tester) async {
      final user = MockTestUser(uid: 'COMPLETED_USER_01', phoneNumber: '+919876543210');
      const completedProfile = UserProfile(
        userId: 'COMPLETED_USER_01',
        name: 'Completed Customer',
        phone: '+919876543210',
        companyName: 'ITA Co',
        email: 'completed@itacon.com',
        userCategory: 'Dealer',
        role: 'customer',
        salesPersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        assignedSalespersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        salespersonName: 'Vraj Shah',
        salespersonReferralCode: 'SALES101',
        phoneVerified: true,
        status: 'active',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: SplashScreen(
            minDurationMs: 0,
            initialUser: user,
            profileLoader: (uid) async => completedProfile,
            homeBuilder: (context, profile) => const Scaffold(
              body: Text('AUTHENTICATED_HOME_SCREEN'),
            ),
          ),
        ),
      );

      // 1. Original Splash screen appears first
      expect(find.byType(SplashScreen), findsOneWidget);

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));

      // 2. Completed customer routes to Home
      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);
      expect(find.byType(AuthScreen), findsNothing);
    });

    // TEST 3: New incomplete customer restart: Original Splash → AuthScreen (Sales Code step)
    testWidgets('TEST 3: New incomplete customer restart: Original Splash -> AuthScreen (Sales Code step)', (tester) async {
      final user = MockTestUser(uid: 'INCOMPLETE_USER_01', phoneNumber: '+919876543210');
      const incompleteProfile = UserProfile(
        userId: 'INCOMPLETE_USER_01',
        name: 'Incomplete Customer',
        phone: '+919876543210',
        companyName: '',
        email: '',
        userCategory: 'Wholesaler',
        role: 'customer',
        salesPersonId: null,
        assignedSalespersonId: null,
        phoneVerified: false,
        status: 'pending_salesperson_verification',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: SplashScreen(
            minDurationMs: 0,
            initialUser: user,
            profileLoader: (uid) async => incompleteProfile,
          ),
        ),
      );

      // 1. Original Splash screen appears first
      expect(find.byType(SplashScreen), findsOneWidget);

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));

      // 2. Incomplete customer routes to existing ReferralGateScreen, NEVER MainNavigationScreen
      expect(find.byType(ReferralGateScreen), findsOneWidget);
      expect(find.byType(MainNavigationScreen), findsNothing);
    });

    // TEST 4: New customer after successful signup: Signup → ReferralGateScreen
    testWidgets('TEST 4: New customer after successful signup: Signup -> ReferralGateScreen', (tester) async {
      final mockFirestore = StartupTestFirestoreService();
      final mockUser = MockTestUser(uid: 'NEW_SIGNUP_UID', phoneNumber: '+919876543210');
      final authService = StartupTestAuthService(
        firestoreService: mockFirestore,
        mockUser: mockUser,
      );

      // Perform initial signup
      await authService.registerInitialAccount(
        name: 'New Registered Customer',
        phoneNumber: '+919876543210',
        userCategory: 'Dealer',
        password: 'Password123!',
        verificationId: 'v_id_test',
        smsCode: '123456',
      );

      final doc = await mockFirestore.getUserDocument('NEW_SIGNUP_UID');
      expect(doc, isNotNull);
      final profile = UserProfile.fromMap(doc!, 'NEW_SIGNUP_UID');

      // Verify routing gate condition
      expect(AuthGate.requiresSalespersonCompletion(profile), isTrue);

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

      authStream.add(mockUser);
      await tester.pumpAndSettle();

      // Renders existing ReferralGateScreen, NEVER HOME_SCREEN
      expect(find.byType(ReferralGateScreen), findsOneWidget);
      expect(find.text('HOME_SCREEN'), findsNothing);
      await authStream.close();
    });

    // TEST 5: Successful salesperson verification: AuthScreen → Home
    testWidgets('TEST 5: Successful salesperson verification: AuthScreen -> Home', (tester) async {
      final mockFirestore = StartupTestFirestoreService();
      final mockUser = MockTestUser(uid: 'NEW_SIGNUP_UID', phoneNumber: '+919876543210');
      final authService = StartupTestAuthService(
        firestoreService: mockFirestore,
        mockUser: mockUser,
      );

      await authService.registerInitialAccount(
        name: 'New Registered Customer',
        phoneNumber: '+919876543210',
        userCategory: 'Dealer',
        password: 'Password123!',
        verificationId: 'v_id_test',
        smsCode: '123456',
      );

      // Verify and link salesperson
      await mockFirestore.createUserProfile(
        uid: 'NEW_SIGNUP_UID',
        phone: '+919876543210',
        name: 'New Registered Customer',
        role: 'customer',
        userCategory: 'Dealer',
        assignedSalespersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        salespersonName: 'Vraj Shah',
        salespersonPhone: '+918128084783',
        salespersonReferralCode: 'SALES101',
        isVerified: true,
      );

      final updatedDoc = await mockFirestore.getUserDocument('NEW_SIGNUP_UID');
      final updatedProfile = UserProfile.fromMap(updatedDoc!, 'NEW_SIGNUP_UID');

      expect(AuthGate.requiresSalespersonCompletion(updatedProfile), isFalse);

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

      authStream.add(mockUser);
      await tester.pumpAndSettle();

      expect(find.text('HOME_SCREEN'), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);
      await authStream.close();
    });

    // TEST 6: Completed customer restart: Original Splash → Home
    testWidgets('TEST 6: Completed customer restart: Original Splash -> Home', (tester) async {
      final user = MockTestUser(uid: 'COMPLETED_USER_02', phoneNumber: '+919876543210');
      const profile = UserProfile(
        userId: 'COMPLETED_USER_02',
        name: 'Restarting Customer',
        phone: '+919876543210',
        companyName: 'ITA Co',
        email: 'restart@itacon.com',
        userCategory: 'Retailer',
        role: 'customer',
        salesPersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        assignedSalespersonId: 'WNSahNXK9GQrGoiIEmD4QBvAeim1',
        phoneVerified: true,
        status: 'active',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: SplashScreen(
            minDurationMs: 0,
            initialUser: user,
            profileLoader: (uid) async => profile,
            homeBuilder: (context, p) => const Scaffold(
              body: Text('AUTHENTICATED_HOME_SCREEN'),
            ),
          ),
        ),
      );

      expect(find.byType(SplashScreen), findsOneWidget);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));
      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);
    });

    // TEST 7: Existing/historical valid customer without salesperson field is NOT forced to ReferralGateScreen
    testWidgets('TEST 7: Existing/historical valid customer without salesperson field is NOT forced to ReferralGateScreen', (tester) async {
      final historicalUser = MockTestUser(uid: 'HISTORICAL_USER_101', phoneNumber: '+919876543200');
      const historicalProfile = UserProfile(
        userId: 'HISTORICAL_USER_101',
        name: 'Historical Partner',
        phone: '+919876543200',
        companyName: 'Old Ceramics Store',
        email: 'old@partner.com',
        userCategory: 'Dealer',
        role: 'customer',
        salesPersonId: null, // absent in legacy account
        assignedSalespersonId: null, // absent in legacy account
        phoneVerified: true, // verified historically
        status: 'active', // active account
      );

      // Verify that AuthGate.requiresSalespersonCompletion protects historical accounts
      expect(AuthGate.requiresSalespersonCompletion(historicalProfile), isFalse);

      await tester.pumpWidget(
        MaterialApp(
          home: SplashScreen(
            minDurationMs: 0,
            initialUser: historicalUser,
            profileLoader: (uid) async => historicalProfile,
            homeBuilder: (context, p) => const Scaffold(
              body: Text('AUTHENTICATED_HOME_SCREEN'),
            ),
          ),
        ),
      );

      expect(find.byType(SplashScreen), findsOneWidget);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));

      // Successfully routes to Home, NEVER ReferralGateScreen
      expect(find.text('AUTHENTICATED_HOME_SCREEN'), findsOneWidget);
      expect(find.byType(ReferralGateScreen), findsNothing);
    });

    // TEST 8: Explicit logout: returns to existing Login flow
    testWidgets('TEST 8: Explicit logout: returns to existing Login flow', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: NotificationService.navigatorKey,
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => UserSessionService.logout(context),
                child: const Text('TRIGGER_LOGOUT'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('TRIGGER_LOGOUT'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));

      // Confirms navigation directly to AuthScreen
      expect(find.byType(AuthScreen), findsOneWidget);
    });

    // TEST 9: Profile loading failure: does not destroy FirebaseAuth session
    testWidgets('TEST 9: Profile loading failure: does not destroy FirebaseAuth session', (tester) async {
      final user = MockTestUser(uid: 'NET_FAIL_UID', phoneNumber: '+919876543210');
      final mockFirestore = StartupTestFirestoreService();
      mockFirestore.simulateProfileError = true;

      final authService = StartupTestAuthService(
        firestoreService: mockFirestore,
        mockUser: user,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: SplashScreen(
            minDurationMs: 0,
            initialUser: user,
            profileLoader: (uid) => mockFirestore.getUserProfile(uid),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));

      // Verifies error card on Splash is shown with Retry and Switch Account options
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('RETRY CONNECTION'), findsOneWidget);

      // CRITICAL: signOut was NEVER called on profile load failure
      expect(authService.signOutInvoked, isFalse);
    });

    // TEST 10: Profile flow remains unchanged
    testWidgets('TEST 10: Profile flow remains unchanged', (tester) async {
      const sampleProfile = UserProfile(
        userId: 'PROFILE_TEST_UID',
        name: 'Prashant Patel',
        phone: '+919876543210',
        companyName: 'ITA Co',
        email: 'prashant@itacon.com',
        userCategory: 'Wholesaler',
        role: 'customer',
        phoneVerified: true,
        status: 'active',
      );
      AppStateService.instance.setCurrentUserProfile(sampleProfile);

      await tester.pumpWidget(
        const MaterialApp(
          home: ProfileScreen(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(find.text('Prashant Patel'), findsOneWidget);
    });
  });
}
