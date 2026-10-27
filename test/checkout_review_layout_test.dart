import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/screens/checkout_screen.dart';
import 'package:itacon_app/services/app_state_service.dart';

void main() {
  setUp(() {
    final appState = AppStateService.instance;
    appState.clearCart();
    appState.setCurrentUserProfile(
      const UserProfile(
        userId: 'test-user',
        name: 'Tirth Kalpesh Patel',
        email: 'tirth@example.com',
        role: 'dealer',
        phone: '9876543210',
        companyName: 'Dero By Zero',
        gstNumber: '24AAAFT2820R1Z0',
        userCategory: 'A',
        address: {
          'addressLine': 'VIP-ROAD',
          'city': 'Surat',
          'state': 'Gujarat',
          'pincode': '395002',
        },
      ),
    );

    final product = TileProduct(
      id: 'p1',
      name: 'ITA 001-ADLINE SATUARIO PREMIUM POLISHED',
      collection: 'Glazed Vitrified Tiles',
      size: '600x1200 mm',
      surface: 'Glossy',
      color: 'White',
      pattern: 'Marble',
      basePrice: 35,
      moq: 1,
      stockStatus: 'In Stock',
      images: ['assets/tiles/test.jpg'],
      sqFtPerBox: 15.5,
      boxWeightKg: 27.0,
      isActive: true,
    );

    appState.addToCart(product, size: '600x1200 mm', finish: 'Glossy', quantity: 1);
  });

  group('Order Review Step Spacing and Layout Tests', () {
    for (final size in [
      const Size(320, 600),
      const Size(375, 667),
      const Size(412, 915),
    ]) {
      testWidgets('Equal side margins, flush buttons, and hugging price at ${size.width}x${size.height}', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(useMaterial3: true),
            home: const CheckoutScreen(),
          ),
        );
        await tester.pumpAndSettle();

        // Advance step 0 -> step 1 -> step 2 -> step 3
        await tester.tap(find.text('CONTINUE TO ADDRESS →'));
        await tester.pumpAndSettle();

        await tester.tap(find.text('CONFIRM ADDRESS & PROCEED →'));
        await tester.pumpAndSettle();

        await tester.tap(find.text('CONTINUE TO FINAL REVIEW →'));
        await tester.pumpAndSettle();

        // 1. Heading verification
        final headingFinder = find.text('Review Your Purchase Order');
        expect(headingFinder, findsOneWidget);
        final headingRect = tester.getRect(headingFinder);
        expect(headingRect.left, equals(20.0), reason: 'Heading left must match 20px page padding');

        // 2. Order Items Card verification
        final orderItemsTitle = find.textContaining('Order Items (1)');
        expect(orderItemsTitle, findsOneWidget);
        final card1Finder = find.ancestor(
          of: orderItemsTitle,
          matching: find.byType(Container),
        ).first;
        final card1Rect = tester.getRect(card1Finder);

        // Verify side margins are equal (20px left, 20px right)
        final leftMargin1 = card1Rect.left;
        final rightMargin1 = size.width - card1Rect.right;
        expect(leftMargin1, equals(20.0), reason: 'Card 1 left margin must be exactly 20.0');
        expect(rightMargin1, equals(20.0), reason: 'Card 1 right margin must be exactly 20.0');

        // 3. Edit Items button flush against card inner right padding (16px)
        final editItems = find.text('Edit Items');
        final editRect = tester.getRect(editItems);
        final editGapToCardRight = card1Rect.right - editRect.right;
        expect(editGapToCardRight, closeTo(16.0, 1.0), reason: 'Edit Items label must sit flush against card 16px inner padding');

        // 4. Price column hugs content and is flush against card inner right padding (16px)
        final unitPriceFinder = find.textContaining('/ sq ft');
        expect(unitPriceFinder, findsOneWidget);
        final unitPriceRect = tester.getRect(unitPriceFinder);
        final priceGapToCardRight = card1Rect.right - unitPriceRect.right;
        expect(priceGapToCardRight, closeTo(16.0, 1.0), reason: 'Price column must hug content and sit flush against card 16px inner padding');

        // 5. Product name has 2 lines allowed
        final nameFinder = find.text('ITA 001-ADLINE SATUARIO PREMIUM POLISHED');
        expect(nameFinder, findsOneWidget);
        final nameWidget = tester.widget<Text>(nameFinder);
        expect(nameWidget.maxLines, equals(2), reason: 'Product name must allow up to 2 lines');

        // 6. Shipping Card verification
        final shippingText = find.text('Shipping Address');
        final card2Finder = find.ancestor(
          of: shippingText,
          matching: find.byType(Container),
        ).first;
        final card2Rect = tester.getRect(card2Finder);
        expect(card2Rect.left, equals(20.0));
        expect(size.width - card2Rect.right, equals(20.0));

        // 7. Payment Card verification
        final paymentText = find.text('Payment Method');
        final card3Finder = find.ancestor(
          of: paymentText,
          matching: find.byType(Container),
        ).first;
        final card3Rect = tester.getRect(card3Finder);
        expect(card3Rect.left, equals(20.0));
        expect(size.width - card3Rect.right, equals(20.0));

        // 8. Order Summary Card verification
        final summaryText = find.text('Final Purchase Order Summary');
        final card4Finder = find.ancestor(
          of: summaryText,
          matching: find.byType(Container),
        ).first;
        final card4Rect = tester.getRect(card4Finder);
        expect(card4Rect.left, equals(20.0));
        expect(size.width - card4Rect.right, equals(20.0));

        // 9. Scroll to bottom and verify entire summary is visible above bottom button
        await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -600));
        await tester.pumpAndSettle();

        final placeOrderButton = find.text('PLACE PURCHASE ORDER');
        expect(placeOrderButton, findsOneWidget);
        final buttonRect = tester.getRect(placeOrderButton);

        final totalValueFinder = find.byWidgetPredicate(
          (w) => w is Text && (w.data == 'ESTIMATED TOTAL*' || w.data == 'ESTIMATED TOTAL VALUE'),
        );
        expect(totalValueFinder, findsOneWidget);
        final totalValueRect = tester.getRect(totalValueFinder);
        expect(totalValueRect.bottom, lessThan(buttonRect.top), reason: 'Entire summary must be visible above the fixed bottom button');
      });
    }

    testWidgets('Step 4 review with text scale factor 1.3 has no overflow', (tester) async {
      tester.view.physicalSize = const Size(375, 667);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(useMaterial3: true),
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
            child: const CheckoutScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('CONTINUE TO ADDRESS →'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('CONFIRM ADDRESS & PROCEED →'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('CONTINUE TO FINAL REVIEW →'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull, reason: 'Zero layout overflow errors with text scale 1.3');
    });
  });
}
