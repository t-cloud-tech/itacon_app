import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/screens/order_details_screen.dart';

void main() {
  const String expectedPendingMessage =
      "Your assigned salesperson is currently quoting today's factory rates. You will be notified once ready.";

  final testOrderITC4909 = TileOrder(
    id: 'PO_ITC_2026_4909',
    orderReference: 'ITC-PO-2026-4909',
    userId: 'USER_CUST_4909',
    customerName: 'Shree Krishna Ceramic Mart',
    userCategory: 'Wholesaler',
    status: 'pending_rate',
    orderType: 'ready_stock',
    deliveryLocation: const {'address': 'Ring Road, Surat, Gujarat'},
    transportRequired: true,
    remarks: 'Urgent factory quote requested',
    items: const [
      OrderItem(
        productId: 'VIT-60120-4909',
        productName: 'Statuario Elegant White',
        size: '600x1200',
        surface: 'Polished Glazed Vitrified',
        quantity: 120,
        moq: 40,
      ),
    ],
    totalBoxes: 120,
    totalWeightTons: 3.36,
  );

  Widget createTestWidget({
    required TileOrder order,
    required double screenWidth,
    required double screenHeight,
    required double bottomInset,
    TextScaler textScaler = TextScaler.noScaling,
  }) {
    final streamController = StreamController<TileOrder?>.broadcast();
    return MaterialApp(
      home: Builder(
        builder: (context) {
          final parentMq = MediaQuery.of(context);
          return MediaQuery(
            data: parentMq.copyWith(
              size: Size(screenWidth, screenHeight),
              padding: EdgeInsets.only(top: 24, bottom: bottomInset),
              viewPadding: EdgeInsets.only(top: 24, bottom: bottomInset),
              textScaler: textScaler,
            ),
            child: SizedBox(
              width: screenWidth,
              height: screenHeight,
              child: OrderDetailsScreen(
                orderId: order.id,
                initialOrder: order,
                orderStream: streamController.stream,
              ),
            ),
          );
        },
      ),
    );
  }

  group('PO Details Responsive UI & Android Navigation Bar Overlap Tests', () {
    testWidgets('1. Android Three-Button Navigation (48dp inset): Bottom text is fully visible above nav bar',
        (WidgetTester tester) async {
      const double screenWidth = 392.0;
      const double screenHeight = 872.0;
      const double navBarHeight = 48.0;

      await tester.pumpWidget(
        createTestWidget(
          order: testOrderITC4909,
          screenWidth: screenWidth,
          screenHeight: screenHeight,
          bottomInset: navBarHeight,
        ),
      );
      await tester.pumpAndSettle();

      final messageFinder = find.text(expectedPendingMessage);
      expect(messageFinder, findsOneWidget);

      // Verify SafeArea is used on the Scaffold body
      expect(find.byType(SafeArea), findsWidgets);

      // Scroll down to the bottom
      final scrollableFinder = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(messageFinder, 500, scrollable: scrollableFinder);
      await tester.drag(scrollableFinder, const Offset(0, -1000));
      await tester.pumpAndSettle();

      final messageRect = tester.getRect(messageFinder);
      final maxAllowedBottom = screenHeight - navBarHeight;

      expect(
        messageRect.bottom,
        lessThanOrEqualTo(maxAllowedBottom),
        reason: 'Text bottom (${messageRect.bottom}) overlaps Android 3-button nav bar starting at $maxAllowedBottom',
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('2. Android Gesture Navigation (28dp inset): Bottom text is fully visible above nav bar',
        (WidgetTester tester) async {
      const double screenWidth = 412.0;
      const double screenHeight = 892.0;
      const double navBarHeight = 28.0;

      await tester.pumpWidget(
        createTestWidget(
          order: testOrderITC4909,
          screenWidth: screenWidth,
          screenHeight: screenHeight,
          bottomInset: navBarHeight,
        ),
      );
      await tester.pumpAndSettle();

      final messageFinder = find.text(expectedPendingMessage);
      expect(messageFinder, findsOneWidget);

      final scrollableFinder = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(messageFinder, 500, scrollable: scrollableFinder);
      await tester.drag(scrollableFinder, const Offset(0, -1000));
      await tester.pumpAndSettle();

      final messageRect = tester.getRect(messageFinder);
      final maxAllowedBottom = screenHeight - navBarHeight;

      expect(
        messageRect.bottom,
        lessThanOrEqualTo(maxAllowedBottom),
        reason: 'Text bottom (${messageRect.bottom}) overlaps Android gesture nav bar starting at $maxAllowedBottom',
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('3. Small Screen Device (360x640) with 3-button nav: Fully scrollable, no clipping or overflow',
        (WidgetTester tester) async {
      const double screenWidth = 360.0;
      const double screenHeight = 640.0;
      const double navBarHeight = 48.0;

      await tester.pumpWidget(
        createTestWidget(
          order: testOrderITC4909,
          screenWidth: screenWidth,
          screenHeight: screenHeight,
          bottomInset: navBarHeight,
        ),
      );
      await tester.pumpAndSettle();

      final scrollableFinder = find.byType(Scrollable).first;
      final messageFinder = find.text(expectedPendingMessage);

      await tester.scrollUntilVisible(messageFinder, 500, scrollable: scrollableFinder);
      await tester.drag(scrollableFinder, const Offset(0, -1000));
      await tester.pumpAndSettle();

      expect(messageFinder, findsOneWidget);

      final messageRect = tester.getRect(messageFinder);
      final maxAllowedBottom = screenHeight - navBarHeight;

      expect(
        messageRect.bottom,
        lessThanOrEqualTo(maxAllowedBottom),
        reason: 'On 360x640 small screen, text bottom (${messageRect.bottom}) must remain above $maxAllowedBottom',
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('4. Large Font Scaling (1.5x) on Small Device: No RenderFlex overflow and remains fully visible',
        (WidgetTester tester) async {
      const double screenWidth = 360.0;
      const double screenHeight = 640.0;
      const double navBarHeight = 48.0;

      await tester.pumpWidget(
        createTestWidget(
          order: testOrderITC4909,
          screenWidth: screenWidth,
          screenHeight: screenHeight,
          bottomInset: navBarHeight,
          textScaler: const TextScaler.linear(1.5),
        ),
      );
      await tester.pumpAndSettle();

      final scrollableFinder = find.byType(Scrollable).first;
      final messageFinder = find.text(expectedPendingMessage);

      await tester.scrollUntilVisible(messageFinder, 500, scrollable: scrollableFinder);
      await tester.drag(scrollableFinder, const Offset(0, -1500));
      await tester.pumpAndSettle();

      expect(messageFinder, findsOneWidget);

      final messageRect = tester.getRect(messageFinder);
      final maxAllowedBottom = screenHeight - navBarHeight;

      expect(
        messageRect.bottom,
        lessThanOrEqualTo(maxAllowedBottom),
        reason: 'With 1.5x font scaling, text bottom (${messageRect.bottom}) must remain above $maxAllowedBottom',
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('5. Large Screen Device (Tablet / Large Phone 412x915): Content remains properly padded and visible',
        (WidgetTester tester) async {
      const double screenWidth = 412.0;
      const double screenHeight = 915.0;
      const double navBarHeight = 24.0;

      await tester.pumpWidget(
        createTestWidget(
          order: testOrderITC4909,
          screenWidth: screenWidth,
          screenHeight: screenHeight,
          bottomInset: navBarHeight,
        ),
      );
      await tester.pumpAndSettle();

      final messageFinder = find.text(expectedPendingMessage);
      expect(messageFinder, findsOneWidget);

      final scrollableFinder = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(messageFinder, 500, scrollable: scrollableFinder);
      await tester.drag(scrollableFinder, const Offset(0, -1000));
      await tester.pumpAndSettle();

      final messageRect = tester.getRect(messageFinder);
      final maxAllowedBottom = screenHeight - navBarHeight;

      expect(
        messageRect.bottom,
        lessThanOrEqualTo(maxAllowedBottom),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('6. Rates Quoted PO state: Action buttons remain fully visible above Android navigation bar',
        (WidgetTester tester) async {
      final quotedOrder = TileOrder(
        id: 'PO_ITC_2026_QUOTED',
        orderReference: 'ITC-PO-2026-4910',
        userId: 'USER_CUST_4909',
        customerName: 'Shree Krishna Ceramic Mart',
        userCategory: 'Wholesaler',
        status: 'rate_quoted',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Surat, Gujarat'},
        transportRequired: true,
        remarks: 'Quoted',
        items: const [
          OrderItem(
            productId: 'VIT-1',
            productName: 'Calacatta Marble',
            size: '600x1200',
            surface: 'Glossy',
            quantity: 50,
            quantityBoxes: 50,
            moq: 10,
            unitPrice: 420.0,
            lineTotal: 21000.0,
          ),
        ],
        subtotal: 21000.0,
        taxAmount: 3780.0,
        totalAmount: 24780.0,
        totalBoxes: 50,
      );

      const double screenWidth = 392.0;
      const double screenHeight = 872.0;
      const double navBarHeight = 48.0;

      await tester.pumpWidget(
        createTestWidget(
          order: quotedOrder,
          screenWidth: screenWidth,
          screenHeight: screenHeight,
          bottomInset: navBarHeight,
        ),
      );
      await tester.pumpAndSettle();

      final rejectBtnFinder = find.text('Reject Estimate');
      final scrollableFinder = find.byType(Scrollable).first;

      await tester.scrollUntilVisible(rejectBtnFinder, 500, scrollable: scrollableFinder);
      await tester.drag(scrollableFinder, const Offset(0, -1000));
      await tester.pumpAndSettle();

      expect(rejectBtnFinder, findsOneWidget);

      final rejectRect = tester.getRect(rejectBtnFinder);
      final maxAllowedBottom = screenHeight - navBarHeight;

      expect(
        rejectRect.bottom,
        lessThanOrEqualTo(maxAllowedBottom),
        reason: 'Reject Estimate button bottom (${rejectRect.bottom}) overlaps Android nav bar ($maxAllowedBottom)',
      );
      expect(tester.takeException(), isNull);
    });
  });
}
