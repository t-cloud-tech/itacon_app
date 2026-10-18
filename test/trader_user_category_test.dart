import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/user_category.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/screens/profile/edit_profile_screen.dart';

class MockTraderFirestoreService extends FirestoreService {
  final Map<String, dynamic> _userDb = {};

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
    _userDb['userId'] = uid;
    if (name != null) _userDb['name'] = name;
    if (role != null) {
      _userDb['userCategory'] = role;
      _userDb['role'] = role;
    }
  }

  @override
  Future<void> updateUserRegionAndToken(
    String userId, {
    String? region,
    String? fcmToken,
  }) async {
    if (region != null) _userDb['region'] = region;
  }

  @override
  Future<UserProfile?> getUserProfile(String userId) async {
    return UserProfile.fromMap(_userDb, userId);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
  });

  group('Trader User Category Architectural & Verification Tests', () {
    // -------------------------------------------------------------------------
    // 1. Model & Serialization Verification
    // -------------------------------------------------------------------------
    test('1. UserCategory model supports Trader with canonical id "trader"', () {
      expect(UserCategory.isValidCategory('trader'), isTrue);
      expect(UserCategory.isValidCategory('Trader'), isTrue);
      expect(UserCategory.getLabel('trader'), equals('Trader'));
      expect(UserCategory.getLabel('Trader'), equals('Trader'));
      expect(UserCategory.categoryIds, contains('trader'));
      expect(UserCategory.canonicalCategories, contains('Trader'));

      final traderItem = UserCategory.allCategories.firstWhere((c) => c.id == 'trader');
      expect(traderItem.id, equals('trader'));
      expect(traderItem.label, equals('Trader'));
    });

    test('2. FirestoreService correctly maps trader -> traders mirror collection', () {
      expect(FirestoreService.getCategoryCollectionName('trader'), equals('traders'));
      expect(FirestoreService.getCategoryCollectionName('Trader'), equals('traders'));
      expect(FirestoreService.getCategoryCollectionName('traders'), equals('traders'));
    });

    test('3. Regression test: All existing 5 categories continue working identically', () {
      final existingCategories = {
        'dealer': 'dealers',
        'architect': 'architects',
        'builder': 'builders',
        'wholesaler': 'wholesalers',
        'retailer': 'retailers',
      };

      for (final entry in existingCategories.entries) {
        expect(UserCategory.isValidCategory(entry.key), isTrue);
        expect(FirestoreService.getCategoryCollectionName(entry.key), equals(entry.value));
      }

      // Invalid categories are still rejected
      expect(UserCategory.isValidCategory('contractor_invalid'), isFalse);
      expect(() => FirestoreService.getCategoryCollectionName('invalid_cat'), throwsArgumentError);
    });

    // -------------------------------------------------------------------------
    // 2. Edit Profile UI & Dropdown Verification
    // -------------------------------------------------------------------------
    testWidgets('4. Trader is available in Edit Profile dropdown and selectable from empty state', (tester) async {
      const emptyProfile = UserProfile(
        userId: 'USER_EMPTY_TEST',
        name: 'Test Empty User',
        companyName: '',
        phone: '+919876543210',
        email: '',
        userCategory: '',
        role: 'customer',
      );

      AppStateService.instance.setCurrentUserProfile(emptyProfile);

      await tester.pumpWidget(
        const MaterialApp(
          home: EditProfileScreen(),
        ),
      );
      await tester.pumpAndSettle();

      final dropdownFinder = find.byType(DropdownButton<String>);
      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(dropdownFinder, 200, scrollable: scrollable);
      await tester.pumpAndSettle();

      expect(find.text('Select business category'), findsOneWidget);

      // Tap dropdown to open options menu
      await tester.tap(dropdownFinder);
      await tester.pumpAndSettle();

      // Verify all 6 options are present in the menu
      expect(find.text('Dealer'), findsWidgets);
      expect(find.text('Architect'), findsWidgets);
      expect(find.text('Builder / Contractor'), findsWidgets);
      expect(find.text('Wholesaler'), findsWidgets);
      expect(find.text('Retailer'), findsWidgets);
      expect(find.text('Trader'), findsWidgets);

      // Select 'Trader'
      final traderItem = find.text('Trader').last;
      await tester.tap(traderItem);
      await tester.pumpAndSettle();

      // Now 'Trader' is selected and visible
      expect(find.text('Trader'), findsOneWidget);
    });

    testWidgets('5. Existing Trader profile displays Trader as selected when opening Edit Profile', (tester) async {
      const traderProfile = UserProfile(
        userId: 'USER_TRADER_TEST',
        name: 'Vikram Mehta',
        companyName: 'Mehta Ceramic Traders',
        phone: '+919876543210',
        email: 'vikram@mehtatraders.com',
        userCategory: 'trader',
        role: 'trader',
        city: 'Morbi',
        state: 'Gujarat',
      );

      AppStateService.instance.setCurrentUserProfile(traderProfile);

      await tester.pumpWidget(
        const MaterialApp(
          home: EditProfileScreen(),
        ),
      );
      await tester.pumpAndSettle();

      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.text('Mehta Ceramic Traders'), 200, scrollable: scrollable);
      await tester.pumpAndSettle();

      // 'Trader' should be displayed in the dropdown value
      expect(find.text('Trader'), findsOneWidget);
      expect(find.text('Mehta Ceramic Traders'), findsOneWidget);
      expect(find.text('Morbi'), findsOneWidget);
    });

    testWidgets('6. Saving profile with Trader category persists correctly', (tester) async {
      const emptyProfile = UserProfile(
        userId: 'USER_SAVE_TRADER_TEST',
        name: 'Anil Kumar',
        companyName: 'Anil Trading Co',
        phone: '+919876543210',
        email: 'anil@trading.com',
        userCategory: '',
        role: 'customer',
      );

      AppStateService.instance.setCurrentUserProfile(emptyProfile);

      await tester.pumpWidget(
        MaterialApp(
          home: EditProfileScreen(
            firestoreService: MockTraderFirestoreService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final scrollable = find.byType(Scrollable).first;
      final dropdownFinder = find.byType(DropdownButton<String>);
      await tester.scrollUntilVisible(dropdownFinder, 200, scrollable: scrollable);
      await tester.pumpAndSettle();

      // Select Trader
      await tester.tap(dropdownFinder);
      await tester.pumpAndSettle();
      final traderItem = find.text('Trader').last;
      await tester.tap(traderItem);
      await tester.pumpAndSettle();

      // Save profile
      final saveButton = find.text('Save Profile & Showroom Details');
      await tester.scrollUntilVisible(saveButton, 200, scrollable: scrollable);
      await tester.pumpAndSettle();
      await tester.tap(saveButton);
      await tester.pumpAndSettle();

      final saved = AppStateService.instance.currentUserProfile;
      expect(saved.userCategory, equals('Trader'));
      expect(saved.name, equals('Anil Kumar'));
    });
  });
}
