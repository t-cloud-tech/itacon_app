import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/screens/product_listing_screen.dart';

void main() {
  testWidgets('Clicking back button when search bar is focused dismisses keyboard first without navigating to home',
      (WidgetTester tester) async {
    bool backToHomeCalled = false;

    await tester.pumpWidget(
      MaterialApp(
        home: ProductListingScreen(
          subcategoryTitle: 'Products Collection',
          onBackToHome: () {
            backToHomeCalled = true;
          },
        ),
      ),
    );
    // Allow entrance timers to complete
    await tester.pump(const Duration(milliseconds: 600));

    // Verify on Products Collection screen
    expect(find.text('Products Collection'), findsOneWidget);
    expect(backToHomeCalled, isFalse);

    // Tap search bar to give it focus
    final searchTextField = find.byType(TextField);
    expect(searchTextField, findsOneWidget);
    await tester.tap(searchTextField);
    await tester.pump(const Duration(milliseconds: 350));

    // Verify search bar has focus
    final textFieldWidget = tester.widget<TextField>(searchTextField);
    expect(textFieldWidget.focusNode?.hasFocus, isTrue);

    // Now click the AppBar leading back arrow
    final backButton = find.byTooltip('Back');
    expect(backButton, findsOneWidget);
    await tester.tap(backButton);
    await tester.pump(const Duration(milliseconds: 350));

    // VERIFICATION:
    // 1. Focus must be dismissed (keyboard dismissed)
    expect(textFieldWidget.focusNode?.hasFocus, isFalse);
    // 2. User MUST STILL be on Products Collection screen, NOT sent to home!
    expect(backToHomeCalled, isFalse);
    expect(find.text('Products Collection'), findsOneWidget);

    // Now tap back button a second time (when keyboard/focus is gone)
    await tester.tap(backButton);
    await tester.pump(const Duration(milliseconds: 350));

    // VERIFICATION:
    // Now that search is inactive, onBackToHome should be called!
    expect(backToHomeCalled, isTrue);

    // Drain any remaining animation timers before exiting test
    await tester.pump(const Duration(milliseconds: 500));
  });
}
