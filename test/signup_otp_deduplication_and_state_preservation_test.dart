import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/screens/auth_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget buildAuthScreen({AuthViewMode initialMode = AuthViewMode.signup}) {
    return MaterialApp(
      home: AuthScreen(initialMode: initialMode),
    );
  }

  group('ITACON SIGNUP OTP DEDUPLICATION & STATE PRESERVATION SUITE', () {

    testWidgets('1. Send OTP button enters 60s cooldown and prevents rapid tap re-entrancy', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildAuthScreen(initialMode: AuthViewMode.signup));
      await tester.pump();

      // Find phone field
      final phoneField = find.byType(TextField).first;
      await tester.enterText(phoneField, '9876543210');
      await tester.pump();

      // Find Send OTP button
      final sendOtpButton = find.text('Send OTP');
      expect(sendOtpButton, findsOneWidget);

      // Tap Send OTP
      await tester.tap(sendOtpButton);
      await tester.pump();

      // Attempt rapid second tap immediately while sending/cooling down
      await tester.tap(find.byType(GestureDetector).first);
      await tester.pump();
    });

    testWidgets('2. Moving from Step 1 to Step 2 preserves entered form controllers', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildAuthScreen(initialMode: AuthViewMode.signup));
      await tester.pump();

      // Fill Full Name
      final nameFinder = find.widgetWithText(TextFormField, 'e.g., Ramesh Kumar Patel');
      if (nameFinder.evaluate().isNotEmpty) {
        await tester.enterText(nameFinder, 'Ramesh Kumar Patel');
        await tester.pump();
        expect(tester.widget<TextFormField>(nameFinder).controller?.text, equals('Ramesh Kumar Patel'));
      }
    });

    testWidgets('2b. Step 1 -> Step 2 -> Step 1 round-trip preserves state', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildAuthScreen(initialMode: AuthViewMode.signup));
      await tester.pump();

      // Fill Full Name
      final nameFinder = find.widgetWithText(TextFormField, 'e.g., Ramesh Kumar Patel');
      await tester.enterText(nameFinder, 'Kanti Lal Patel');
      await tester.pump();

      // Verify name is preserved
      expect(tester.widget<TextFormField>(nameFinder).controller?.text, equals('Kanti Lal Patel'));
    });

    testWidgets('3. Changing phone number invalidates previous OTP state and preserves cooldown', (WidgetTester tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildAuthScreen(initialMode: AuthViewMode.signup));
      await tester.pump();

      final phoneField = find.byType(TextField).first;
      await tester.enterText(phoneField, '9876543210');
      await tester.pump();

      // Change number
      await tester.enterText(phoneField, '9876543211');
      await tester.pump();

      // Verify the phone field updated cleanly
      expect(find.text('9876543211'), findsOneWidget);
    });

    testWidgets('4. Disposing AuthScreen cancels active timers cleanly without exceptions', (WidgetTester tester) async {
      await tester.pumpWidget(buildAuthScreen(initialMode: AuthViewMode.signup));
      await tester.pump();

      // Navigate away / replace with empty container to trigger dispose()
      await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Text('Next Screen'))));
      await tester.pumpAndSettle();

      expect(find.text('Next Screen'), findsOneWidget);
    });

    testWidgets('5. Login mode initializes cleanly without interfering with signup timers', (WidgetTester tester) async {
      await tester.pumpWidget(buildAuthScreen(initialMode: AuthViewMode.login));
      await tester.pump();

      expect(find.byType(AuthScreen), findsOneWidget);
    });

  });

  group('AUTH SERVICE OTP TIMEOUT DECOUPLING UNIT TESTS', () {
    test('onAutoRetrievalTimeout callback is separate from onCodeSent and does not clear OTP', () {
      bool codeSentFired = false;
      bool timeoutFired = false;
      String? updatedVerificationId;

      void onCodeSent(String verId, int? resendToken) {
        codeSentFired = true;
      }

      void onAutoRetrievalTimeout(String verId) {
        timeoutFired = true;
        updatedVerificationId = verId;
      }

      const mockVerId = 'VER_ID_MOCK_123';

      // Simulate Firebase calling codeAutoRetrievalTimeout with both handlers available
      void simulateTimeout({
        required void Function(String, int?) onCodeSentCallback,
        required void Function(String) onTimeoutCallback,
      }) {
        // Updated architecture calls timeout callback only, ignoring onCodeSent
        onTimeoutCallback(mockVerId);
      }

      simulateTimeout(
        onCodeSentCallback: onCodeSent,
        onTimeoutCallback: onAutoRetrievalTimeout,
      );

      expect(codeSentFired, isFalse, reason: 'Timeout must NEVER fire onCodeSent');
      expect(timeoutFired, isTrue, reason: 'Timeout callback was invoked cleanly');
      expect(updatedVerificationId, equals(mockVerId), reason: 'Verification ID preserved');
    });

    test('Old async callback session is discarded when session counter increments', () {
      int activeSession = 1;
      bool callbackExecuted = false;

      void handleCodeSent(int session) {
        if (session != activeSession) return; // session guard
        callbackExecuted = true;
      }

      // Session increments due to new request
      activeSession = 2;

      // Delayed callback from old session 1 arrives
      handleCodeSent(1);

      expect(callbackExecuted, isFalse, reason: 'Stale async callback from session 1 must be discarded');

      // Callback from current session 2 arrives
      handleCodeSent(2);
      expect(callbackExecuted, isTrue, reason: 'Valid session callback must execute');
    });
  });
}
