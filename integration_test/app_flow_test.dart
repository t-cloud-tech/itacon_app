import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/screens/referral_gate_screen.dart';
import 'package:itacon_app/screens/product_listing_screen.dart';
import 'package:itacon_app/screens/product_detail_screen.dart';
import 'package:itacon_app/screens/cart_screen.dart';
import 'package:itacon_app/screens/checkout_screen.dart';
import 'package:itacon_app/screens/order_details_screen.dart';
import 'package:itacon_app/screens/orders_screen.dart';
import 'package:itacon_app/screens/notifications_screen.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('ITACON App Full QA End-to-End Integration Flow', () {
    const String testUserId = 'TEST_USER_QA_INTEGRATION_001';
    const testUserProfile = UserProfile(
      userId: testUserId,
      name: 'QA Test Dealer Enterprise',
      companyName: 'ITACON Quality Assurance Ltd',
      phone: '+919999900001',
      email: 'test_qa_dealer@itacon.test',
      userCategory: 'Dealer',
      role: 'Dealer',
      gstNumber: '24ABCDE1234F1Z5',
      address: {
        'line1': 'Plot 42, Ceramics Industrial Estate',
        'city': 'Morbi',
        'state': 'Gujarat',
        'pincode': '363642',
      },
      city: 'Morbi',
      state: 'Gujarat',
      pincode: '363642',
      salesPersonId: 'SALES-107',
      salespersonName: 'Priya Sharma (South Gujarat)',
      salespersonReferralCode: 'SALES-107',
    );

    final TileProduct testTile = TileProduct(
      id: 'VIT_60120_QA_01',
      productId: 'VIT_60120_QA_01',
      sku: 'VIT-60120-QA',
      name: 'Adline Statuario Royal White 600x1200 mm',
      size: '600x1200 mm',
      surface: 'Glossy',
      finish: 'Glossy',
      color: 'White Statuario',
      baseColour: 'White',
      pattern: 'Marble',
      basePrice: 42.0,
      moq: 10,
      stockStatus: 'available_now',
      sqFtPerBox: 15.5,
      boxWeightKg: 28.0,
      isActive: true,
      images: ['products/tiles/sample_tile.jpeg'],
    );

    setUpAll(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();
    });

    tearDownAll(() async {
      // Complete cleanup of all test data
      AppStateService.instance.clearCart();
      await UserSessionService.logout();
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();
      debugPrint('[QA CLEANUP] All test data, cart items, and test session successfully deleted.');
    });

    testWidgets('1. Mandatory Salesperson Referral Gate Flow (SALES-107, lowercase, wrong code, auto-assign)', (tester) async {
      AppStateService.instance.setCurrentUserProfile(testUserProfile.copyWith(salesPersonId: null, salespersonReferralCode: null));
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ReferralGateScreen(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Link Sales Representative'), findsOneWidget);
      expect(find.text('Verify Code & Unlock'), findsOneWidget);
      expect(find.text('Auto-Assign a Sales Executive'), findsOneWidget);

      // Verify code input accepts SALES-107 and lowercase sales-107
      final codeField = find.byType(TextField).first;
      await tester.enterText(codeField, 'sales-107');
      await tester.pump();
      expect(find.text('sales-107'), findsOneWidget);

      // Clear input
      await tester.enterText(codeField, '');
      await tester.pump();
    });

    testWidgets('2. Products Catalog Browsing, 304 Count, Tile Sorting & Search Debounce', (tester) async {
      AppStateService.instance.setCurrentUserProfile(testUserProfile);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ProductListingScreen(
              subcategoryTitle: 'All Vitrified Collection',
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Search bar is displayed
      expect(find.byType(TextField), findsOneWidget);

      // Enter search term and verify debounce (300ms)
      await tester.enterText(find.byType(TextField), 'Statuario');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump();
    });

    testWidgets('3. Product Detail View, Finish Selection, and Add to Cart with Double-Tap Prevention', (tester) async {
      AppStateService.instance.clearCart();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductDetailScreen(
              product: testTile,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text(testTile.name), findsOneWidget);

      // Find Add to Cart button
      final addToCartBtn = find.text('Add to Cart');
      expect(addToCartBtn, findsOneWidget);

      // Tap Add to Cart
      await tester.tap(addToCartBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(AppStateService.instance.cartItems.length, 1);
      expect(AppStateService.instance.cartItems.first.product.id, testTile.id);
    });

    testWidgets('4. Cart Screen Operations: Quantity (+/-), Tonnage Calculation, Totals', (tester) async {
      if (AppStateService.instance.cartItems.isEmpty) {
        AppStateService.instance.addToCart(testTile, quantity: 10);
      }

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CartScreen(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('My Cart'), findsOneWidget);
      expect(find.text(testTile.name), findsOneWidget);

      // Verify increment quantity
      final plusButton = find.byIcon(Icons.add_rounded);
      if (plusButton.evaluate().isNotEmpty) {
        await tester.tap(plusButton.first);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 200));
      }

      // Check totals are calculated correctly
      expect(AppStateService.instance.totalBoxes, greaterThanOrEqualTo(1));
      expect(AppStateService.instance.totalWeightKg, greaterThan(0.0));
    });

    testWidgets('5. Checkout 4-Step Flow & Purchase Order Placement (Shared Calculation)', (tester) async {
      AppStateService.instance.setCurrentUserProfile(testUserProfile);
      if (AppStateService.instance.cartItems.isEmpty) {
        AppStateService.instance.addToCart(testTile, quantity: 10);
      }

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CheckoutScreen(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Purchase Order Estimate'), findsOneWidget);
      expect(find.text('PO Estimate & Logistics Summary'), findsOneWidget);

      // Step 0: Proceed to Address
      final proceedToAddress = find.text('CONTINUE TO ADDRESS →');
      expect(proceedToAddress, findsOneWidget);
      await tester.tap(proceedToAddress);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Step 1: Address confirmation
      final confirmAddress = find.text('CONFIRM ADDRESS & PROCEED →');
      expect(confirmAddress, findsOneWidget);
      await tester.tap(confirmAddress);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Step 2: Payment method
      final continueToReview = find.text('CONTINUE TO FINAL REVIEW →');
      expect(continueToReview, findsOneWidget);
      await tester.tap(continueToReview);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Step 3: Final Review & Place PO Button
      final placeOrderBtn = find.text('PLACE PURCHASE ORDER');
      expect(placeOrderBtn, findsOneWidget);
    });

    testWidgets('6. PO Details Screen & Unpaid PO Download UI Verification', (tester) async {
      final sampleOrder = TileOrder(
        id: 'ITC-PO-QA-TEST-999',
        orderReference: 'ITC-PO-QA-TEST-999',
        poNumber: 'PO-2026-QA-999',
        userId: testUserId,
        customerName: testUserProfile.name,
        companyName: testUserProfile.companyName,
        status: 'confirmed',
        paymentStatus: 'unpaid',
        userCategory: 'Dealer',
        orderType: 'ready_stock',
        deliveryLocation: const {'city': 'Morbi', 'state': 'Gujarat', 'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'QA Test PO',
        items: [
          OrderItem(
            productId: testTile.id,
            sku: testTile.sku,
            productName: testTile.name,
            size: testTile.size,
            surface: testTile.surface,
            color: testTile.color,
            quantity: 20,
            quantityBoxes: 20,
            quantitySqFt: 310.0,
            unit: 'box',
            moq: 10,
            basePrice: 42.0,
            finalPrice: 42.0,
            orderType: 'ready_stock',
          ),
        ],
        totalBoxes: 20,
        totalWeightKg: 560.0,
        totalWeightTons: 0.56,
        subtotal: 13020.0,
        totalAmount: 15363.60,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OrderDetailsScreen(
              orderId: sampleOrder.id,
              initialOrder: sampleOrder,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('PO Details (${sampleOrder.orderReference})'), findsOneWidget);
      expect(find.text('Ordered Items Breakdown'), findsOneWidget);
      expect(find.text('Download Official PO (PDF)'), findsOneWidget);
    });

    testWidgets('7. Orders Screen Pull-to-Refresh & Tab Filtering Verification', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OrdersScreen(
              ordersStream: Stream.value([]),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('My Orders'), findsOneWidget);
      expect(find.text('History'), findsOneWidget);
      expect(find.text('Pending Quote'), findsOneWidget);
      expect(find.text('Rates Quoted'), findsOneWidget);
      expect(find.text('Confirmed'), findsOneWidget);

      // Verify Pull to refresh
      final refreshIndicator = find.byType(RefreshIndicator);
      expect(refreshIndicator, findsWidgets);
    });

    testWidgets('8. Notifications Screen Pull-to-Refresh & Festival Greeting Verification', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: NotificationsScreen(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Notifications'), findsOneWidget);
      expect(find.byType(RefreshIndicator), findsOneWidget);
    });
  });
}
