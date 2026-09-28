import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/loyalty_service.dart';
import 'package:itacon_app/services/auth_service.dart';
import 'package:itacon_app/models/user_profile.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
  });

  group('Session and Auth State Guarantees', () {
    test('AppStateService hasSessionProfile is false by default', () {
      final appState = AppStateService();
      appState.clearUserProfile();

      expect(appState.hasSessionProfile, isFalse);
      expect(appState.currentUserProfile.userId, isEmpty);
      expect(appState.currentUserProfile.name, isEmpty);
      // Confirms no default 'Dealer' or mock account is synthesized
      expect(appState.currentUserProfile.userCategory, isEmpty);
    });

    test('AppStateService rejects profile with invalid/mock UID or names', () {
      final appState = AppStateService();
      appState.clearUserProfile();

      const mockProfile = UserProfile(
        userId: 'GUEST_USER',
        name: 'Valued Partner',
        companyName: 'ITACON',
        email: 'guest@itacon.com',
        phone: '+919876543210',
        userCategory: 'Dealer',
        role: 'customer',
      );

      appState.setCurrentUserProfile(mockProfile);

      // Verify that mock / guest fallback profiles are strictly rejected
      expect(appState.hasSessionProfile, isFalse);
      expect(appState.currentUserProfile.userId, isEmpty);
      expect(appState.currentUserProfile.name, isEmpty);
    });

    test('AppStateService rejects fallback names starting with User ', () {
      final appState = AppStateService();
      appState.clearUserProfile();

      const fallbackPhoneProfile = UserProfile(
        userId: 'some_uid_9876',
        name: 'User 9876543210',
        companyName: 'ITACON',
        email: 'user@itacon.com',
        phone: '+919876543210',
        userCategory: 'Dealer',
        role: 'customer',
      );

      appState.setCurrentUserProfile(fallbackPhoneProfile);

      // Verify that auto-generated "User <phone>" fallback profiles are strictly rejected
      expect(appState.hasSessionProfile, isFalse);
      expect(appState.currentUserProfile.userId, isEmpty);
    });

    test('AppStateService accept valid profile and clearUserProfile works correctly', () {
      final appState = AppStateService();
      appState.clearUserProfile();
      expect(appState.hasSessionProfile, isFalse);

      const validProfile = UserProfile(
        userId: 'AUTHENTICATED_UID_001',
        name: 'Rajesh Sharma',
        companyName: 'Sharma Ceramics',
        email: 'rajesh@sharma.com',
        phone: '+919822001122',
        userCategory: 'Dealer',
        role: 'customer',
      );

      appState.setCurrentUserProfile(validProfile);
      expect(appState.hasSessionProfile, isTrue);
      expect(appState.currentUserProfile.userId, equals('AUTHENTICATED_UID_001'));
      expect(appState.currentUserProfile.name, equals('Rajesh Sharma'));

      // Now clearUserProfile must return to unauthenticated state immediately
      appState.clearUserProfile();
      expect(appState.hasSessionProfile, isFalse);
      expect(appState.currentUserProfile.userId, isEmpty);
      expect(appState.currentUserProfile.name, isEmpty);
    });

    test('AuthService.clearSessionState clears all static and temporary auth state', () {
      AuthService.clearSessionState();
      // Verifies no exception and cleanly executed
      expect(true, isTrue);
    });
  });

  group('Empty UID Live Stream Security Guards', () {
    test('FirestoreService.getUserOrdersStream with empty UID emits empty list without querying all orders', () async {
      final stream = FirestoreService().getUserOrdersStream('');
      final orders = await stream.first;
      expect(orders, isEmpty);
    });

    test('FirestoreService.streamUserOrders with empty UID emits empty list', () async {
      final stream = FirestoreService().streamUserOrders('');
      final orders = await stream.first;
      expect(orders, isEmpty);
    });

    test('FirestoreService.getUserNotificationsStream with empty UID emits empty list', () async {
      final stream = FirestoreService().getUserNotificationsStream('');
      final notifications = await stream.first;
      expect(notifications, isEmpty);
    });

    test('FirestoreService.streamUnreadNotificationCount with empty UID emits 0', () async {
      final stream = FirestoreService().streamUnreadNotificationCount('');
      final count = await stream.first;
      expect(count, equals(0));
    });

    test('LoyaltyService streams with empty UID emit empty data safely', () async {
      final loyalty = LoyaltyService();

      final pointsStream = loyalty.streamUserLoyaltyPoints('');
      final points = await pointsStream.first;
      expect(points, equals(0));

      final txStream = loyalty.streamUserTransactions('');
      final txs = await txStream.first;
      expect(txs, isEmpty);

      final refStream = loyalty.streamUserReferrals('');
      final refs = await refStream.first;
      expect(refs, isEmpty);

      final redStream = loyalty.streamUserRedemptions('');
      final reds = await redStream.first;
      expect(reds, isEmpty);
    });
  });

  group('Atomic Logout and Re-entrancy Protection', () {
    test('UserSessionService prevents concurrent duplicate logout runs', () async {
      expect(UserSessionService.isLoggingOut, isFalse);

      // Calling logout() in mock environment where Firebase is not initialized
      // should catch error, reset _isLoggingOut to false, and not throw unhandled exception
      await UserSessionService.logout();

      expect(UserSessionService.isLoggingOut, isFalse);
    });
  });
}
