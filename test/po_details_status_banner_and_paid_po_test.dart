import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/screens/order_details_screen.dart';
import 'package:itacon_app/screens/orders_screen.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/utils/po_calculation.dart';

void main() {
  setUp(() {
      AppStateService.instance.setCurrentUserProfile(
      const UserProfile(
        userId: 'USER_CUST_100',
        name: 'Suresh Patel',
        phone: '+919876543210',
        companyName: 'Patel Ceramics',
        email: 'suresh@patelceramics.com',
        userCategory: 'Dealer',
        role: 'customer',
      ),
    );
  });

  Widget createTestOrderDetailsWidget(TileOrder order) {
    final streamController = StreamController<TileOrder?>.broadcast();
    return MaterialApp(
      home: OrderDetailsScreen(
        key: ValueKey(order.id),
        orderId: order.id,
        initialOrder: order,
        orderStream: streamController.stream,
      ),
    );
  }

  group('PO Details Status Banner & Paid PO Download Tests', () {
    testWidgets('1. Rate approval pending order displays rate-approval notification', (WidgetTester tester) async {
      final order = TileOrder(
        id: 'ORDER_PENDING_01',
        orderReference: 'ITC-PO-2026-P01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'pending_rate',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Please quote today rates',
        items: const [
          OrderItem(
            productId: 'TILE_01',
            productName: 'Armani Gold 600x1200',
            size: '600x1200',
            surface: 'High Gloss',
            quantity: 50,
            quantityBoxes: 50,
            quantitySqFt: 775.0,
            moq: 10,
          ),
        ],
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(order));
      await tester.pumpAndSettle();

      expect(find.text('Rate Approval in Progress'), findsAtLeast(1));
      expect(find.text("Your assigned salesperson is currently quoting today's factory rates."), findsOneWidget);
      expect(find.text('Payment Completed — In Production'), findsNothing);
      expect(find.text('Download Paid PO (PDF)'), findsNothing);
    });

    testWidgets('2. Rates quoted order displays quoted-rates notification and finalize buttons', (WidgetTester tester) async {
      final order = TileOrder(
        id: 'ORDER_QUOTED_01',
        orderReference: 'ITC-PO-2026-Q01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'rate_quoted',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Quoted',
        subtotal: 50000.0,
        discount: 2000.0,
        taxAmount: 8640.0,
        totalAmount: 56640.0,
        items: const [
          OrderItem(
            productId: 'TILE_01',
            productName: 'Armani Gold 600x1200',
            size: '600x1200',
            surface: 'High Gloss',
            quantity: 50,
            quantityBoxes: 50,
            quantitySqFt: 775.0,
            moq: 10,
            unitPrice: 64.516,
            lineTotal: 50000.0,
          ),
        ],
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(order));
      await tester.pumpAndSettle();

      expect(find.text("Today's Quoted Rates Received"), findsOneWidget);
      expect(find.text("Please review today's quoted rates and confirm to finalize your Purchase Order."), findsOneWidget);
      expect(find.text("I agree with today's quoted rates and terms for this Purchase Order."), findsOneWidget);
      expect(find.text('Confirm & Finalize Order →'), findsOneWidget);
      expect(find.text('Reject Estimate'), findsOneWidget);
      expect(find.text('Payment Completed — In Production'), findsNothing);
    });

    testWidgets('3. Payment verification pending order displays verification banner', (WidgetTester tester) async {
      final order = TileOrder(
        id: 'ORDER_PENDING_PAY_01',
        orderReference: 'ITC-PO-2026-PAY01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'confirmed',
        paymentStatus: 'pending_verification',
        paymentSubmissionId: 'SUB_REF_9981',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Transferred via NEFT',
        subtotal: 50000.0,
        totalAmount: 59000.0,
        items: const [],
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(order));
      await tester.pumpAndSettle();

      expect(find.text('Payment Verification in Progress'), findsAtLeast(1));
      expect(find.text('Your bank transfer details have been submitted and are being verified by our accounts team.'), findsOneWidget);
      expect(find.text('PAYMENT VERIFICATION IN PROGRESS'), findsOneWidget);
      expect(find.text('SUB_REF_9981'), findsOneWidget);
      expect(find.text('Rate Approval in Progress'), findsNothing);
    });

    testWidgets('4. Paid order in production displays Payment Completed — In Production and Download Paid PO', (WidgetTester tester) async {
      final now = DateTime.now();
      final paidOrder = TileOrder(
        id: 'ORDER_PAID_01',
        orderReference: 'ITC-PO-2026-PROD01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'processing',
        paymentStatus: 'paid',
        paidAmount: 59000.0,
        paymentId: 'HDFC_UTR_99887766',
        paidAt: now,
        poDocumentUrl: 'https://storage.googleapis.com/itacon/purchase_orders/ORDER_PAID_01.pdf',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Paid in full',
        subtotal: 50000.0,
        taxAmount: 9000.0,
        totalAmount: 59000.0,
        items: const [
          OrderItem(
            productId: 'TILE_01',
            productName: 'Armani Gold 600x1200',
            size: '600x1200',
            surface: 'High Gloss',
            quantity: 50,
            quantityBoxes: 50,
            quantitySqFt: 775.0,
            moq: 10,
            unitPrice: 64.516,
            lineTotal: 50000.0,
          ),
        ],
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(paidOrder));
      await tester.pumpAndSettle();

      // Top status alert banner MUST display Payment Completed — In Production
      expect(find.text('Payment Completed — In Production'), findsOneWidget);
      expect(find.text('Your payment has been verified and your order is being processed.'), findsOneWidget);

      // Must NOT display Rate Approval in Progress
      expect(find.text('Rate Approval in Progress'), findsNothing);

      // Status pill displays In Production
      expect(find.text('In Production'), findsOneWidget);

      // Paid PO PDF download action MUST be visible
      expect(find.text('Download Paid PO (PDF)'), findsOneWidget);

      // Payment verified card MUST be rendered with details
      expect(find.text('PAYMENT VERIFIED & RECEIVED'), findsOneWidget);
      expect(find.text('HDFC_UTR_99887766'), findsOneWidget);
      expect(find.text('₹59000.00'), findsAtLeast(1));
    });

    testWidgets('5. Completed paid order displays Order Completed notification', (WidgetTester tester) async {
      final now = DateTime.now();
      final completedOrder = TileOrder(
        id: 'ORDER_COMPLETED_01',
        orderReference: 'ITC-PO-2026-DONE01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'completed',
        paymentStatus: 'paid',
        paidAmount: 85000.0,
        paymentId: 'SBI_UTR_55443322',
        paidAt: now,
        poDocumentUrl: 'https://storage.googleapis.com/itacon/purchase_orders/ORDER_COMPLETED_01.pdf',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Surat, Gujarat'},
        transportRequired: true,
        remarks: 'Delivered',
        subtotal: 72033.9,
        taxAmount: 12966.1,
        totalAmount: 85000.0,
        items: const [],
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(completedOrder));
      await tester.pumpAndSettle();

      expect(find.text('Order Completed'), findsAtLeast(1));
      expect(find.text('This order has been fulfilled, delivered, and payment has been verified.'), findsOneWidget);
      expect(find.text('Rate Approval in Progress'), findsNothing);
      expect(find.text('Download Paid PO (PDF)'), findsOneWidget);
    });

    testWidgets('6. Rejected payment displays Payment Verification Failed with rejection reason', (WidgetTester tester) async {
      final rejectedPaymentOrder = TileOrder(
        id: 'ORDER_REJ_01',
        orderReference: 'ITC-PO-2026-REJ01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'confirmed',
        paymentStatus: 'rejected',
        rejectionReason: 'UTR reference not found in bank ledger statement',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: '',
        subtotal: 40000.0,
        totalAmount: 47200.0,
        items: const [],
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(rejectedPaymentOrder));
      await tester.pumpAndSettle();

      expect(find.text('Payment Verification Failed'), findsAtLeast(1));
      expect(find.text('Reason: UTR reference not found in bank ledger statement'), findsAtLeast(1));
      expect(find.text('RESUBMIT PAYMENT PROOF'), findsOneWidget);
      expect(find.text('Rate Approval in Progress'), findsNothing);
    });

    testWidgets('7. Legacy orders with missing status fields resolve correctly and do not crash', (WidgetTester tester) async {
      // Legacy order with empty status but payment marked paid
      final legacyPaidOrder = TileOrder.fromMap(
        const {
          'id': 'LEGACY_PAID_01',
          'orderReference': 'ITC-PO-2025-LEG01',
          'userId': 'USER_CUST_100',
          'customerName': 'Patel Ceramics',
          'userCategory': 'Dealer',
          'status': '', // Empty status
          'paymentStatus': 'paid',
          'paidAmount': 35000.0,
          'paymentId': 'LEGACY_UTR_001',
          'totalAmount': 35000.0,
        },
        'LEGACY_PAID_01',
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(legacyPaidOrder));
      await tester.pumpAndSettle();

      expect(find.text('Payment Completed — In Production'), findsOneWidget);
      expect(find.text('Rate Approval in Progress'), findsNothing);
      expect(find.text('Download Paid PO (PDF)'), findsOneWidget);

      // Legacy order with completely missing payment fields and no status safely defaults to rate approval without crashing
      final legacyPendingOrder = TileOrder.fromMap(
        const {
          'id': 'LEGACY_UNSET_02',
          'orderReference': 'ITC-PO-2025-LEG02',
          'userId': 'USER_CUST_100',
          'userCategory': 'Dealer',
          'status': '',
        },
        'LEGACY_UNSET_02',
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(legacyPendingOrder));
      await tester.pumpAndSettle();

      expect(find.text('Rate Approval in Progress'), findsAtLeast(1));
    });

    testWidgets('8. Security check: Customer can only access their own paid PO', (WidgetTester tester) async {
      // Order belongs to USER_OTHER_999
      final otherCustomerPaidOrder = TileOrder(
        id: 'ORDER_OTHER_01',
        orderReference: 'ITC-PO-2026-OTH01',
        userId: 'USER_OTHER_999',
        customerName: 'Other Ceramics',
        userCategory: 'Dealer',
        status: 'processing',
        paymentStatus: 'paid',
        paidAmount: 50000.0,
        paymentId: 'UTR_SECRET_999',
        poDocumentUrl: 'https://storage.googleapis.com/itacon/purchase_orders/ORDER_OTHER_01.pdf',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi'},
        transportRequired: true,
        remarks: '',
        items: const [],
      );

      // Current app state user is USER_CUST_100
        AppStateService.instance.setCurrentUserProfile(
        const UserProfile(
          userId: 'USER_CUST_100',
          name: 'Suresh Patel',
          phone: '+919876543210',
          companyName: 'Patel Ceramics',
          email: 'suresh@patelceramics.com',
          userCategory: 'Dealer',
          role: 'customer',
        ),
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(otherCustomerPaidOrder));
      await tester.pumpAndSettle();

      // Tap Download Paid PO
      await tester.ensureVisible(find.text('Download Paid PO (PDF)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Download Paid PO (PDF)'));
      await tester.pumpAndSettle();

      // Security SnackBar MUST appear denying access
      expect(find.text('Access Denied: You may only download PO documents for your own account.'), findsOneWidget);
    });

    testWidgets('9. Existing My Orders → History navigation works correctly for paid orders', (WidgetTester tester) async {
      final now = DateTime.now();
      final streamController = StreamController<List<TileOrder>>.broadcast();

      final paidOrder = TileOrder(
        id: 'ORDER_HIST_01',
        orderReference: 'ITC-PO-2026-HIST01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'processing',
        paymentStatus: 'paid',
        paidAmount: 75000.0,
        paymentId: 'AXIS_UTR_112233',
        paidAt: now,
        poDocumentUrl: 'https://storage.googleapis.com/itacon/purchase_orders/ORDER_HIST_01.pdf',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Paid order in factory history',
        subtotal: 63559.3,
        taxAmount: 11440.7,
        totalAmount: 75000.0,
        items: const [
          OrderItem(
            productId: 'TILE_01',
            productName: 'Royal Black Marble 600x1200',
            size: '600x1200',
            surface: 'High Gloss',
            quantity: 60,
            quantityBoxes: 60,
            quantitySqFt: 930.0,
            moq: 10,
            unitPrice: 68.34,
            lineTotal: 63559.3,
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: OrdersScreen(
            ordersStream: streamController.stream,
          ),
        ),
      );

      streamController.add([paidOrder]);
      await tester.pumpAndSettle();

      // Tab 0 is History: paidOrder MUST appear in History
      expect(find.text('ITC-PO-2026-HIST01'), findsOneWidget);
      expect(find.text('VIEW PO DETAILS'), findsOneWidget);

      // Tap VIEW PO DETAILS to navigate to OrderDetailsScreen
      await tester.tap(find.text('VIEW PO DETAILS'));
      await tester.pumpAndSettle();

      // Destination screen is open
      expect(find.byType(OrderDetailsScreen), findsOneWidget);
      expect(find.text('PO Details (ITC-PO-2026-HIST01)'), findsOneWidget);

      // Verify the banner on PO Details says Payment Completed — In Production, NOT Rate Approval in Progress
      expect(find.text('Payment Completed — In Production'), findsOneWidget);
      expect(find.text('Rate Approval in Progress'), findsNothing);
      expect(find.text('Download Paid PO (PDF)'), findsOneWidget);

      await streamController.close();
    });

    testWidgets('10. When Paid PO is generating, tapping Download shows preparation notice', (WidgetTester tester) async {
      final generatingOrder = TileOrder(
        id: 'ORDER_GEN_01',
        orderReference: 'ITC-PO-2026-GEN01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'processing',
        paymentStatus: 'paid',
        paidAmount: 50000.0,
        paymentId: 'UTR_GEN_123',
        paidPoStatus: 'generating',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Generating Paid PO',
        items: const [],
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(generatingOrder));
      await tester.pumpAndSettle();

      expect(find.text('Download Paid PO (PDF)'), findsOneWidget);
      await tester.ensureVisible(find.text('Download Paid PO (PDF)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Download Paid PO (PDF)'));
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Preparing your PO...'), findsOneWidget);
    });

    test('11. TileOrder correctly serializes and deserializes Paid PO fields', () {
      final now = DateTime.now();
      final order = TileOrder(
        id: 'ORD_TEST_SER_01',
        orderReference: 'ITC-PO-2026-SER01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'processing',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Serialization test',
        items: const [],
        paymentStatus: 'paid',
        paidPoDocumentPath: 'purchase_orders/ORD_TEST_SER_01/paid_po.pdf',
        paidPoStatus: 'ready',
        paidPoGeneratedAt: now,
      );

      expect(order.isPaidPoReady, isTrue);
      expect(order.isPaidPoGenerating, isFalse);
      expect(order.isPaidPoFailed, isFalse);

      final map = order.toMap();
      expect(map['paidPoDocumentPath'], 'purchase_orders/ORD_TEST_SER_01/paid_po.pdf');
      expect(map['paidPoStatus'], 'ready');

      final deserialized = TileOrder.fromMap(map, 'ORD_TEST_SER_01');
      expect(deserialized.paidPoDocumentPath, 'purchase_orders/ORD_TEST_SER_01/paid_po.pdf');
      expect(deserialized.paidPoStatus, 'ready');
      expect(deserialized.isPaidPoReady, isTrue);
    });

    testWidgets('12. Unpaid PO displays Download Official PO and blocks unauthorized customer', (WidgetTester tester) async {
      // 1. Order approved, payment pending
      final unpaidOrder = TileOrder(
        id: 'ORDER_UNPAID_01',
        orderReference: 'ITC-PO-2026-UNP01',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'confirmed',
        paymentStatus: 'pending',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Unpaid order test',
        subtotal: 50000.0,
        taxAmount: 9000.0,
        totalAmount: 59000.0,
        items: const [],
      );

      AppStateService.instance.setCurrentUserProfile(
        const UserProfile(
          userId: 'USER_CUST_100',
          name: 'Suresh Patel',
          phone: '+919876543210',
          companyName: 'Patel Ceramics',
          email: 'suresh@patelceramics.com',
          userCategory: 'Dealer',
          role: 'customer',
        ),
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(unpaidOrder));
      await tester.pumpAndSettle();

      // Flow B: Must show 'Download Official PO (PDF)', NOT 'Download Paid PO (PDF)'
      expect(find.text('Download Official PO (PDF)'), findsOneWidget);
      expect(find.text('Download Paid PO (PDF)'), findsNothing);

      // 2. Unauthorized customer attempting to download
      AppStateService.instance.setCurrentUserProfile(
        const UserProfile(
          userId: 'ANOTHER_CUSTOMER_999',
          name: 'Intruder User',
          phone: '+919999999999',
          companyName: 'Other Firm',
          email: 'intruder@other.com',
          userCategory: 'Dealer',
          role: 'customer',
        ),
      );

      await tester.ensureVisible(find.text('Download Official PO (PDF)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Download Official PO (PDF)'));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied: You may only download PO documents for your own account.'), findsOneWidget);
    });

    test('13. PO file naming format adheres strictly to PAID and UNPAID standards', () {
      const orderRef = 'ITC-PO-2026-9095';
      final sanitized = orderRef.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');

      final paidFileName = '${sanitized}_PAID.pdf';
      final unpaidFileName = '${sanitized}_UNPAID.pdf';

      expect(paidFileName, 'ITC-PO-2026-9095_PAID.pdf');
      expect(unpaidFileName, 'ITC-PO-2026-9095_UNPAID.pdf');
      expect(paidFileName, isNot(equals(unpaidFileName)));
    });

    test('14. Shared PoCalculation: 9095 reference calculation matches exactly', () {
      final calc = PoCalculation.calculateFromBasic(6510.00, packaging: 4.29);
      expect(calc.basicAmount, 6510.00);
      expect(calc.insuranceAmount, 22.79);
      expect(calc.basicPlusInsurance, 6532.79);
      expect(calc.taxAmount, 1175.90);
      expect(calc.totalAmount, 7708.69);
      expect(calc.packagingCharges, 4.29);
    });

    testWidgets('15. Shared PoCalculation: 5765 unpaid order displays identical breakdown lines and Amount to Pay', (WidgetTester tester) async {
      final calc = PoCalculation.calculateFromBasic(1085.00);
      expect(calc.basicAmount, 1085.00);
      expect(calc.insuranceAmount, 3.80);
      expect(calc.basicPlusInsurance, 1088.80);
      expect(calc.taxAmount, 195.98);
      expect(calc.totalAmount, 1284.78);
      expect(calc.packagingCharges, 0.00);

      final order5765 = TileOrder(
        id: 'ORDER_5765',
        orderReference: 'ITC-PO-2026-5765',
        userId: 'USER_CUST_100',
        customerName: 'Patel Ceramics',
        userCategory: 'Dealer',
        status: 'confirmed',
        paymentStatus: 'payment_due',
        orderType: 'ready_stock',
        subtotal: 1085.0,
        basicAmount: 1085.0,
        insuranceAmount: 3.80,
        basicPlusInsurance: 1088.80,
        taxAmount: 195.98,
        totalAmount: 1284.78,
        quotationMode: 'mrp',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Test unpaid order 5765',
        items: const [
          OrderItem(
            productId: 'PROD_01',
            productName: 'ALBANION IRON',
            size: '600x1200 mm',
            surface: 'Glossy',
            quantity: 1,
            quantityBoxes: 1,
            quantitySqFt: 15.5,
            moq: 10,
            unitPrice: 35.0,
            lineTotal: 542.5,
          ),
          OrderItem(
            productId: 'PROD_02',
            productName: 'ALBANION PLATINUM',
            size: '600x1200 mm',
            surface: 'Glossy',
            quantity: 1,
            quantityBoxes: 1,
            quantitySqFt: 15.5,
            moq: 10,
            unitPrice: 35.0,
            lineTotal: 542.5,
          ),
        ],
      );

      await tester.pumpWidget(createTestOrderDetailsWidget(order5765));
      await tester.pumpAndSettle();

      expect(find.text('Basic amount'), findsOneWidget);
      expect(find.text('₹1085.00'), findsOneWidget);
      expect(find.text('0.35% insurance'), findsOneWidget);
      expect(find.text('₹3.80'), findsOneWidget);
      expect(find.text('Basic + 0.35%'), findsOneWidget);
      expect(find.text('₹1088.80'), findsOneWidget);
      expect(find.text('18% GST'), findsOneWidget);
      expect(find.text('₹195.98'), findsOneWidget);
      expect(find.text('₹1284.78'), findsAtLeast(1));
      expect(find.text('*Premium packaging charges: ₹0.00'), findsOneWidget);
      expect(find.text('Final Amount to Pay:'), findsOneWidget);
    });
  });
}

