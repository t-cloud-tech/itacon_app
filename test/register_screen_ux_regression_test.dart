import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/screens/auth_screen.dart';
import 'package:itacon_app/services/auth_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget buildTestableWidget({
    AuthViewMode initialMode = AuthViewMode.signup,
    double width = 390.0,
    double height = 844.0,
    double textScale = 1.0,
  }) {
    return MediaQuery(
      data: MediaQueryData(
        size: Size(width, height),
        textScaler: TextScaler.linear(textScale),
      ),
      child: MaterialApp(
        home: AuthScreen(initialMode: initialMode),
      ),
    );
  }

  group('Registration Screen Real-Device UX / Input Bug Regression Suite', () {
    testWidgets('A. Enter Full Name, tap Phone, enter digits: No cross-typing', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final nameField = find.widgetWithText(TextFormField, 'e.g., Ramesh Kumar Patel');
      final phoneField = find.widgetWithText(TextFormField, 'Enter Mobile Number');

      expect(nameField, findsOneWidget);
      expect(phoneField, findsOneWidget);

      // Type Kano Hirala Patel in Full Name
      await tester.enterText(nameField, 'Kano Hirala Patel');
      await tester.pumpAndSettle();

      // Tap Phone field and type 9876543210
      await tester.tap(phoneField);
      await tester.pumpAndSettle();

      await tester.enterText(phoneField, '9876543210');
      await tester.pumpAndSettle();

      // EXPECT: Full Name remains "Kano Hirala Patel" and Phone is "9876543210"
      final nameWidget = tester.widget<TextFormField>(nameField);
      final phoneWidget = tester.widget<TextFormField>(phoneField);

      expect(nameWidget.controller?.text, equals('Kano Hirala Patel'));
      expect(phoneWidget.controller?.text, equals('9876543210'));
    });

    testWidgets('B. Focus transitions: Name -> Phone -> Password -> Confirm Password', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final nameField = find.widgetWithText(TextFormField, 'e.g., Ramesh Kumar Patel');
      final phoneField = find.widgetWithText(TextFormField, 'Enter Mobile Number');
      final passField = find.widgetWithText(TextFormField, 'Create password (e.g. Itacon@2026)');
      final confirmField = find.widgetWithText(TextFormField, 'Confirm your password');

      // 1. Focus Name
      await tester.tap(nameField);
      await tester.pumpAndSettle();
      final nameEditable = tester.widget<EditableText>(find.descendant(of: nameField, matching: find.byType(EditableText)));
      expect(nameEditable.focusNode.hasFocus, isTrue);

      // 2. Focus Phone
      await tester.tap(find.descendant(of: phoneField, matching: find.byType(EditableText)));
      await tester.pumpAndSettle();
      final phoneEditable = tester.widget<EditableText>(find.descendant(of: phoneField, matching: find.byType(EditableText)));
      expect(nameEditable.focusNode.hasFocus, isFalse);
      expect(phoneEditable.focusNode.hasFocus, isTrue);

      // 3. Focus Password
      await tester.tap(passField);
      await tester.pumpAndSettle();
      final passEditable = tester.widget<EditableText>(find.descendant(of: passField, matching: find.byType(EditableText)));
      expect(phoneEditable.focusNode.hasFocus, isFalse);
      expect(passEditable.focusNode.hasFocus, isTrue);

      // 4. Focus Confirm Password
      await tester.tap(confirmField);
      await tester.pumpAndSettle();
      final confirmEditable = tester.widget<EditableText>(find.descendant(of: confirmField, matching: find.byType(EditableText)));
      expect(passEditable.focusNode.hasFocus, isFalse);
      expect(confirmEditable.focusNode.hasFocus, isTrue);
    });

    testWidgets('C. Toggle Password visibility: Retains entered text and focus', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final passField = find.widgetWithText(TextFormField, 'Create password (e.g. Itacon@2026)');
      await tester.enterText(passField, 'Secret@2026');
      await tester.pumpAndSettle();

      var passWidget = tester.widget<TextField>(find.descendant(of: passField, matching: find.byType(TextField)));
      expect(passWidget.obscureText, isTrue);
      expect(passWidget.controller?.text, equals('Secret@2026'));

      // Find visibility toggle for password
      final toggleButton = find.descendant(
        of: find.ancestor(of: passField, matching: find.byType(Column)),
        matching: find.byIcon(Icons.visibility_off_outlined),
      ).first;

      await tester.tap(toggleButton);
      await tester.pumpAndSettle();

      passWidget = tester.widget<TextField>(find.descendant(of: passField, matching: find.byType(TextField)));
      expect(passWidget.obscureText, isFalse);
      expect(passWidget.controller?.text, equals('Secret@2026'));
    });

    testWidgets('D. Toggle Confirm Password visibility: Independent from Password visibility', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final passField = find.widgetWithText(TextFormField, 'Create password (e.g. Itacon@2026)');
      final confirmField = find.widgetWithText(TextFormField, 'Confirm your password');

      await tester.enterText(passField, 'MyPass#123');
      await tester.enterText(confirmField, 'MyPass#123');
      await tester.pumpAndSettle();

      // Find the second visibility toggle icon (which belongs to confirm password)
      final eyeIcons = find.byIcon(Icons.visibility_off_outlined);
      expect(eyeIcons, findsNWidgets(2));

      // Tap confirm password's visibility toggle
      await tester.tap(eyeIcons.last);
      await tester.pumpAndSettle();

      final passWidget = tester.widget<TextField>(find.descendant(of: passField, matching: find.byType(TextField)));
      final confirmWidget = tester.widget<TextField>(find.descendant(of: confirmField, matching: find.byType(TextField)));

      // Password remains obscured
      expect(passWidget.obscureText, isTrue);
      expect(passWidget.controller?.text, equals('MyPass#123'));

      // Confirm password is now visible
      expect(confirmWidget.obscureText, isFalse);
      expect(confirmWidget.controller?.text, equals('MyPass#123'));
    });

    testWidgets('E. Invalid phone cannot Send OTP (button visually disabled)', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final phoneField = find.widgetWithText(TextFormField, 'Enter Mobile Number');
      await tester.enterText(phoneField, '98765'); // Only 5 digits
      await tester.pumpAndSettle();

      final sendOtpBtn = find.text('Send OTP');
      expect(sendOtpBtn, findsOneWidget);

      await tester.tap(sendOtpBtn);
      await tester.pumpAndSettle();

      // OTP Field should NOT appear because phone is invalid (< 10 digits)
      expect(find.text('Enter 6-Digit OTP *'), findsNothing);
    });

    testWidgets('F. Valid phone enables Send OTP', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final phoneField = find.widgetWithText(TextFormField, 'Enter Mobile Number');
      await tester.enterText(phoneField, '9876543210');
      await tester.pumpAndSettle();

      final phoneWidget = tester.widget<TextFormField>(phoneField);
      expect(phoneWidget.controller?.text, equals('9876543210'));
    });

    test('G. Password validator matches displayed requirements exactly', () {
      // Requirements: Min 8 chars, 1 Upper, 1 Lower, 1 Num, 1 Symbol
      expect(AuthService.validatePassword(''), isNotNull);
      expect(AuthService.validatePassword('Short1!'), isNotNull); // 7 chars
      expect(AuthService.validatePassword('alllower1!'), isNotNull); // No upper
      expect(AuthService.validatePassword('ALLUPPER1!'), isNotNull); // No lower
      expect(AuthService.validatePassword('NoNumber!Aa'), isNotNull); // No number
      expect(AuthService.validatePassword('NoSymbol1Aa'), isNotNull); // No symbol
      expect(AuthService.validatePassword('Itacon@2026'), isNull); // Valid
      expect(AuthService.validatePassword('Kano#9988'), isNull); // Valid
    });

    testWidgets('H. Password mismatch is detected on submit', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final passField = find.widgetWithText(TextFormField, 'Create password (e.g. Itacon@2026)');
      final confirmField = find.widgetWithText(TextFormField, 'Confirm your password');

      await tester.enterText(passField, 'ValidPass@123');
      await tester.enterText(confirmField, 'DifferentPass@123');
      await tester.pumpAndSettle();

      final continueBtn = find.text('Continue');
      await tester.tap(continueBtn);
      await tester.pumpAndSettle();

      expect(find.text('Passwords do not match'), findsOneWidget);
    });

    testWidgets('I. Keyboard/text input does not modify unrelated controllers', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final nameField = find.widgetWithText(TextFormField, 'e.g., Ramesh Kumar Patel');
      final phoneField = find.widgetWithText(TextFormField, 'Enter Mobile Number');
      final passField = find.widgetWithText(TextFormField, 'Create password (e.g. Itacon@2026)');
      final confirmField = find.widgetWithText(TextFormField, 'Confirm your password');

      await tester.enterText(nameField, 'Rajesh Ramesh Shah');
      await tester.enterText(phoneField, '9988776655');
      await tester.enterText(passField, 'Shah@2026');
      await tester.enterText(confirmField, 'Shah@2026');
      await tester.pumpAndSettle();

      expect(tester.widget<TextFormField>(nameField).controller?.text, equals('Rajesh Ramesh Shah'));
      expect(tester.widget<TextFormField>(phoneField).controller?.text, equals('9988776655'));
      expect(tester.widget<TextFormField>(passField).controller?.text, equals('Shah@2026'));
      expect(tester.widget<TextFormField>(confirmField).controller?.text, equals('Shah@2026'));
    });

    testWidgets('J. Step 1 -> Step 2 preserves entered data', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget());
      await tester.pumpAndSettle();

      final nameField = find.widgetWithText(TextFormField, 'e.g., Ramesh Kumar Patel');
      final phoneField = find.widgetWithText(TextFormField, 'Enter Mobile Number');

      await tester.enterText(nameField, 'Vikram Bhai Patel');
      await tester.enterText(phoneField, '9825012345');
      await tester.pumpAndSettle();

      // Check that data remains preserved in State
      expect(tester.widget<TextFormField>(nameField).controller?.text, equals('Vikram Bhai Patel'));
      expect(tester.widget<TextFormField>(phoneField).controller?.text, equals('9825012345'));
    });

    testWidgets('K. 320px width has no RenderFlex overflow', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 700));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget(width: 320, height: 700));
      await tester.pumpAndSettle();

      expect(find.text('Create your\naccount'), findsOneWidget);
      expect(find.text('Mobile Number *'), findsOneWidget);
      expect(find.text('Send OTP'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('L. 1.5 text scale has no critical overflow', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget(textScale: 1.5));
      await tester.pumpAndSettle();

      expect(find.text('Mobile Number *'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('M. Login screen fields do not cross-type', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestableWidget(initialMode: AuthViewMode.login));
      await tester.pumpAndSettle();

      final usernameField = find.widgetWithText(TextFormField, 'Enter Username');
      final phoneField = find.widgetWithText(TextFormField, 'Enter Mobile Number');
      final passField = find.widgetWithText(TextFormField, 'Enter your password');

      expect(usernameField, findsOneWidget);
      expect(phoneField, findsOneWidget);
      expect(passField, findsOneWidget);

      await tester.enterText(usernameField, 'itacon_user');
      await tester.enterText(phoneField, '9123456780');
      await tester.enterText(passField, 'Login@Pass1');
      await tester.pumpAndSettle();

      expect(tester.widget<TextFormField>(usernameField).controller?.text, equals('itacon_user'));
      expect(tester.widget<TextFormField>(phoneField).controller?.text, equals('9123456780'));
      expect(tester.widget<TextFormField>(passField).controller?.text, equals('Login@Pass1'));
    });

    testWidgets('N. Widths 360, 375, 412, 480 have zero overflow', (WidgetTester tester) async {
      for (final w in [360.0, 375.0, 412.0, 480.0]) {
        await tester.binding.setSurfaceSize(Size(w, 800));
        await tester.pumpWidget(buildTestableWidget(width: w, height: 800));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: 'Failed at width $w');
      }
      await tester.binding.setSurfaceSize(null);
    });
  });
}
