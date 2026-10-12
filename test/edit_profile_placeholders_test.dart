import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/screens/profile/edit_profile_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
  });

  const emptyProfile = UserProfile(
    userId: 'TEST_USER_EMPTY',
    name: '',
    dateOfBirth: '',
    religion: '',
    companyName: '',
    phone: '',
    email: '',
    userCategory: '',
    role: 'customer',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    address: {},
  );

  const populatedProfile = UserProfile(
    userId: 'TEST_USER_POPULATED',
    name: 'Rajesh Sharma',
    dateOfBirth: '15/08/1990',
    religion: 'Hindu',
    companyName: 'Sharma Tiles & Ceramics',
    phone: '+919876543210',
    email: 'rajesh@sharmatiles.com',
    userCategory: 'Dealer',
    role: 'customer',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380001',
    gstNumber: '24AAACH7409R1ZZ',
    address: {'line1': '101, Ceramic Plaza, SG Highway'},
  );

  Widget createTestWidget({
    double width = 360,
    double height = 800,
    TextScaler textScaler = TextScaler.noScaling,
  }) {
    return MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(
          size: Size(width, height),
          textScaler: textScaler,
        ),
        child: const EditProfileScreen(),
      ),
    );
  }

  group('Edit Profile Screen Placeholders & Responsive Tests', () {
    testWidgets('1. Displays meaningful placeholders for all empty input fields', (tester) async {
      AppStateService.instance.setCurrentUserProfile(emptyProfile);

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Top fields visible immediately
      expect(find.text('Enter full name'), findsOneWidget);
      expect(find.text('Select date of birth (DD/MM/YYYY)'), findsOneWidget);
      expect(find.text('Enter or select religion'), findsOneWidget);
      expect(find.text('Enter mobile number'), findsOneWidget);
      expect(find.text('Enter your email address'), findsOneWidget);
      expect(find.text('Enter company or business name'), findsOneWidget);
      expect(find.text('Select business category'), findsOneWidget);

      // Scroll down to check remaining address and business details
      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.text('Enter GSTIN number (if applicable)'), 200, scrollable: scrollable);
      await tester.pumpAndSettle();

      expect(find.text('Enter your complete delivery address'), findsOneWidget);
      expect(find.text('Enter city'), findsOneWidget);
      expect(find.text('Select state'), findsOneWidget);
      expect(find.text('Enter 6-digit pincode'), findsOneWidget);
      expect(find.text('Enter GSTIN number (if applicable)'), findsOneWidget);
    });

    testWidgets('2. Displays saved values normally when profile contains data', (tester) async {
      AppStateService.instance.setCurrentUserProfile(populatedProfile);

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Check pre-populated field values
      expect(find.text('Rajesh Sharma'), findsOneWidget);
      expect(find.text('15/08/1990'), findsOneWidget);
      expect(find.text('Hindu'), findsWidgets); // TextField value + ActionChip
      expect(find.text('+919876543210'), findsOneWidget);
      expect(find.text('rajesh@sharmatiles.com'), findsOneWidget);
      expect(find.text('Sharma Tiles & Ceramics'), findsOneWidget);
      expect(find.text('Dealer'), findsOneWidget);

      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.text('24AAACH7409R1ZZ'), 200, scrollable: scrollable);
      await tester.pumpAndSettle();

      expect(find.text('101, Ceramic Plaza, SG Highway'), findsOneWidget);
      expect(find.text('Ahmedabad'), findsOneWidget);
      expect(find.text('Gujarat'), findsOneWidget);
      expect(find.text('380001'), findsOneWidget);
      expect(find.text('24AAACH7409R1ZZ'), findsOneWidget);
    });

    testWidgets('3. Dropdown allows selecting category from empty placeholder state', (tester) async {
      AppStateService.instance.setCurrentUserProfile(emptyProfile);

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      final dropdownFinder = find.byType(DropdownButton<String>);
      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(dropdownFinder, 200, scrollable: scrollable);
      await tester.pumpAndSettle();

      expect(find.text('Select business category'), findsOneWidget);

      // Tap dropdown to open menu
      await tester.tap(dropdownFinder);
      await tester.pumpAndSettle();

      // Tap 'Architect' in dropdown menu
      final architectItem = find.text('Architect').last;
      await tester.tap(architectItem);
      await tester.pumpAndSettle();

      // Now 'Architect' is selected and visible
      expect(find.text('Architect'), findsOneWidget);
    });

    testWidgets('4. No RenderFlex overflow on small screen width (320px) with 1.3x text scaling', (tester) async {
      AppStateService.instance.setCurrentUserProfile(emptyProfile);

      await tester.pumpWidget(createTestWidget(
        width: 320,
        height: 568,
        textScaler: const TextScaler.linear(1.3),
      ));
      await tester.pumpAndSettle();

      // Verify no exceptions or overflow errors thrown
      expect(tester.takeException(), isNull);

      final scrollable = find.byType(Scrollable).first;
      await tester.drag(scrollable, const Offset(0, -600));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('5. Saving profile with empty fields does not persist placeholder text', (tester) async {
      AppStateService.instance.setCurrentUserProfile(emptyProfile);

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      final scrollable = find.byType(Scrollable).first;
      final saveButton = find.text('Save Profile & Showroom Details');
      await tester.scrollUntilVisible(saveButton, 200, scrollable: scrollable);
      await tester.pumpAndSettle();

      await tester.tap(saveButton);
      await tester.pumpAndSettle();

      final saved = AppStateService.instance.currentUserProfile;
      expect(saved.name, isNot(contains('Enter full name')));
      expect(saved.name, isEmpty);
      expect(saved.dateOfBirth, isNot(contains('Select date of birth')));
      expect(saved.dateOfBirth, isEmpty);
      expect(saved.religion, isNot(contains('Enter or select religion')));
      expect(saved.religion, isEmpty);
      expect(saved.userCategory, isNot(contains('Select business category')));
      expect(saved.userCategory, isEmpty);
      expect(saved.companyName, isNot(contains('Enter company or business name')));
      expect(saved.companyName, isEmpty);
      expect(saved.city, isNot(contains('Enter city')));
      expect(saved.city, isEmpty);
      expect(saved.state, isNot(contains('Select state')));
      expect(saved.state, isEmpty);
      expect(saved.pincode, isNot(contains('Enter 6-digit pincode')));
      expect(saved.pincode, isEmpty);
      expect(saved.gstNumber, isNot(contains('Enter GSTIN number')));
      expect(saved.gstNumber, isEmpty);
    });
  });
}
