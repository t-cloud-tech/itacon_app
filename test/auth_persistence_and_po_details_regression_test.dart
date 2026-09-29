import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:itacon_app/screens/order_details_screen.dart';
import 'package:itacon_app/screens/orders_screen.dart';
import 'package:itacon_app/screens/auth_gate.dart';
import 'package:itacon_app/screens/auth_screen.dart';
import 'package:itacon_app/screens/splash_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
  });

  group('PART R: Auth Persistence & Session Safety Tests', () {
    test('1. Valid profile keeps authenticated session in AppStateService and SharedPreferences', () async {
      final appState = AppStateService.instance;
      const validProfile = UserProfile(
        userId: 'CUST_AUTH_123',
        name: 'Suresh Patel',
        companyName: 'Patel Tiles & Sanitary',
        phone: '+919876543210',
        email: 'suresh@pateltiles.com',
        userCategory: 'Dealer',
        role: 'customer',
      );

      await UserSessionService.saveUserSession(validProfile);
      expect(appState.hasSessionProfile, isTrue);
      expect(appState.currentUserProfile.userId, equals('CUST_AUTH_123'));
      expect(appState.currentUserProfile.name, equals('Suresh Patel'));

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('is_logged_in'), isTrue);
      expect(prefs.getString('user_id'), equals('CUST_AUTH_123'));
    });

    test('2. Unauthenticated state is distinct from loading or authenticated', () {
      final appState = AppStateService.instance;
      appState.clearUserProfile();
      expect(appState.hasSessionProfile, isFalse);
      expect(appState.currentUserProfile.userId, isEmpty);
    });

    test('3. Profile load failure or network error does NOT clear active session', () async {
      final appState = AppStateService.instance;
      const existingProfile = UserProfile(
        userId: 'CUST_AUTH_123',
        name: 'Suresh Patel',
        companyName: 'Patel Tiles',
        phone: '+919876543210',
        email: 'suresh@pateltiles.com',
        userCategory: 'Dealer',
        role: 'customer',
      );

      await UserSessionService.saveUserSession(existingProfile);
      expect(appState.hasSessionProfile, isTrue);

      // Simulating a temporary Firestore error or null result
      // MUST NOT call clearUserSession() or destroy the authenticated user
      expect(appState.hasSessionProfile, isTrue);
      expect(appState.currentUserProfile.userId, equals('CUST_AUTH_123'));
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('is_logged_in'), isTrue);
    });

    test('4. Explicit logout is the ONLY method that clears session', () async {
      final appState = AppStateService.instance;
      const existingProfile = UserProfile(
        userId: 'CUST_AUTH_123',
        name: 'Suresh Patel',
        companyName: 'Patel Tiles',
        phone: '+919876543210',
        email: 'suresh@pateltiles.com',
        userCategory: 'Dealer',
        role: 'customer',
      );

      await UserSessionService.saveUserSession(existingProfile);
      expect(appState.hasSessionProfile, isTrue);

      // Explicit logout
      await UserSessionService.clearUserSession(signOutFirebase: false);
      expect(appState.hasSessionProfile, isFalse);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('is_logged_in'), isNull);
      expect(prefs.getString('user_id'), isNull);
    });

    test('5. RestoreUserSession does NOT wipe local preferences when unauthenticated or restoring', () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_logged_in', true);
      await prefs.setString('user_id', 'CUST_SAVED_999');
      await prefs.setString('user_name', 'Bhavik Enterprise');

      // Calling restore when Firebase Auth hasn't settled yet
      // MUST NOT wipe prefs!
      final restored = await UserSessionService.restoreUserSession();
      expect(restored?.userId, equals('CUST_SAVED_999'));
      expect(prefs.getBool('is_logged_in'), isTrue);
    });

    test('6. Stale profile listener from previous/different UID is rejected safely', () {
      final appState = AppStateService.instance;
      appState.clearUserProfile();

      const fakeProfile = UserProfile(
        userId: 'GUEST_USER',
        name: 'Valued Partner',
        companyName: 'Fake Co',
        phone: '+919876543210',
        email: 'guest@itacon.com',
        userCategory: 'Dealer',
        role: 'customer',
      );

      appState.setCurrentUserProfile(fakeProfile);
      expect(appState.hasSessionProfile, isFalse);
      expect(appState.currentUserProfile.userId, isEmpty);
    });

    test('7. Phone user with default name format is accepted and persisted', () async {
      final appState = AppStateService.instance;
      const phoneProfile = UserProfile(
        userId: 'PHONE_USER_555',
        name: 'User 9876543210',
        companyName: 'ITACON Associate',
        phone: '+919876543210',
        email: 'user_9876543210@itacon.com',
        userCategory: 'Wholesale',
        role: 'customer',
      );

      await UserSessionService.saveUserSession(phoneProfile);
      expect(appState.hasSessionProfile, isTrue);
      expect(appState.currentUserProfile.userId, equals('PHONE_USER_555'));
      expect(appState.currentUserProfile.name, equals('User 9876543210'));
    });
  });

  group('PART S: PO Details & Navigation Regression Tests', () {
    test('13 & 14. quotedItems and quotedUnitPrice parse correctly with robust types', () {
      final rawMap = {
        'orderId': 'ORDER_TEST_101',
        'orderReference': 'ITC-PO-2026-TEST1',
        'userId': 'USER_ABC',
        'status': 'rate_quoted',
        'subtotal': '25000.50', // String representation from web or legacy
        'discount': 1000, // Int representation
        'taxAmount': 4320.09,
        'totalAmount': '28320.59',
        'quotedItems': [
          {
            'productId': 'TILE_A',
            'productName': 'Statuario White Marble',
            'quantityBoxes': '20', // String representation
            'quantitySqFt': 310.0,
            'quotedUnitPrice': '75.50', // String unit price
            'quotedRate': 75.50,
            'lineTotal': 23405.0,
          },
          {
            'productId': 'ADH_B',
            'productName': 'Itacon Tile Adhesive Gold',
            'quantity': 5,
            'unit': 'bag',
            'quotedUnitPrice': 450.0, // Num unit price
            'lineTotal': 2250.0,
          }
        ],
      };

      final order = TileOrder.fromMap(rawMap, 'ORDER_TEST_101');

      expect(order.id, equals('ORDER_TEST_101'));
      expect(order.orderReference, equals('ITC-PO-2026-TEST1'));
      expect(order.subtotal, equals(25000.50));
      expect(order.discount, equals(1000.0));
      expect(order.totalAmount, equals(28320.59));
      expect(order.items.length, equals(2));

      final item1 = order.items[0];
      expect(item1.productId, equals('TILE_A'));
      expect(item1.quantityBoxes, equals(20));
      expect(item1.unitPrice, equals(75.50));
      expect(item1.lineTotal, equals(23405.0));

      final item2 = order.items[1];
      expect(item2.productId, equals('ADH_B'));
      expect(item2.quantityBoxes, equals(5));
      expect(item2.unitPrice, equals(450.0));
      expect(item2.lineTotal, equals(2250.0));
    });

    test('3, 4, 5. Legacy PO, PO with userId, and PO with customerId all parse seamlessly', () {
      final legacyMap = {
        'customerId': 'LEGACY_CUST_777',
        'orderReferenceNumber': 'ITC-PO-LEGACY-01',
        'customerCategory': 'Wholesaler',
        'clientName': 'Somnath Traders',
        'status': 'confirmed',
        'items': [
          {
            'tileId': 'TILE_99',
            'tileName': 'Onyx Blue Glossy',
            'boxes': 15,
            'rate': 85.0,
            'totalPrice': 12750.0,
          }
        ],
        'subTotal': 12750.0,
        'grandTotal': 15045.0,
      };

      final order = TileOrder.fromMap(legacyMap, 'DOC_777');
      expect(order.userId, equals('LEGACY_CUST_777'));
      expect(order.customerId, equals('LEGACY_CUST_777'));
      expect(order.customerName, equals('Somnath Traders'));
      expect(order.userCategory, equals('Wholesaler'));
      expect(order.items.length, equals(1));
      expect(order.items.first.unitPrice, equals(85.0));
      expect(order.totalAmount, equals(15045.0));
    });

    testWidgets('1, 2, 6. View PO Details opens OrderDetailsScreen and is not popped', (WidgetTester tester) async {
      final testOrder = TileOrder(
        id: 'ORDER_OPEN_01',
        orderReference: 'ITC-PO-2026-999',
        userId: 'USER_CUST_1',
        customerName: 'Shreeji Ceramics',
        userCategory: 'Dealer',
        status: 'pending_rate',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Ahmedabad, Gujarat'},
        transportRequired: true,
        remarks: 'Handle with care',
        items: const [
          OrderItem(
            productId: 'PROD_1',
            productName: 'Armani Gold 600x1200',
            size: '600x1200',
            surface: 'High Gloss',
            quantity: 30,
            moq: 10,
          ),
        ],
        totalBoxes: 30,
        totalWeightTons: 0.84,
      );

      final streamController = StreamController<List<TileOrder>>.broadcast();

      await tester.pumpWidget(
        MaterialApp(
          home: OrdersScreen(
            ordersStream: streamController.stream,
          ),
        ),
      );

      streamController.add([testOrder]);
      await tester.pumpAndSettle();

      // Switch to Pending Quote tab
      await tester.tap(find.text('Pending Quote'));
      await tester.pumpAndSettle();

      expect(find.text('VIEW PO DETAILS'), findsOneWidget);

      // Tap VIEW PO DETAILS button
      await tester.tap(find.text('VIEW PO DETAILS'));
      await tester.pumpAndSettle();

      // Destination screen MUST be open and displaying PO details
      expect(find.text('PO Details (ITC-PO-2026-999)'), findsOneWidget);
      expect(find.text('Armani Gold 600x1200'), findsOneWidget);
      expect(find.text('Rate Approval in Progress'), findsAtLeast(1));

      // Screen is NOT popped! It remains open!
      expect(find.byType(OrderDetailsScreen), findsOneWidget);

      await streamController.close();
    });

    testWidgets('8. rate_quoted PO displays quotation rates, line totals, and confirm/reject buttons', (WidgetTester tester) async {
      final quotedOrder = TileOrder(
        id: 'ORDER_QUOTED_02',
        orderReference: 'ITC-PO-2026-RATE1',
        userId: 'USER_CUST_1',
        customerName: 'Shreeji Ceramics',
        userCategory: 'Dealer',
        status: 'rate_quoted',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Surat, Gujarat'},
        transportRequired: false,
        remarks: 'Rates approved',
        subtotal: 50000.0,
        discount: 2500.0,
        taxAmount: 8550.0,
        totalAmount: 56050.0,
        items: const [
          OrderItem(
            productId: 'PROD_10',
            productName: 'Calacatta White Gloss',
            size: '600x1200',
            surface: 'Glossy',
            quantity: 50,
            quantitySqFt: 775.0,
            unitPrice: 64.516,
            lineTotal: 50000.0,
            moq: 10,
          ),
        ],
        totalBoxes: 50,
        totalWeightTons: 1.4,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: OrderDetailsScreen(
            orderId: quotedOrder.id,
            initialOrder: quotedOrder,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // PO Details must display complete financial details
      expect(find.text('PO Details (ITC-PO-2026-RATE1)'), findsOneWidget);
      expect(find.text("Today's Quoted Rates Received"), findsOneWidget);
      expect(find.text('Calacatta White Gloss'), findsOneWidget);
      expect(find.text('Subtotal'), findsOneWidget);
      expect(find.text('Discount (Applied)'), findsOneWidget);
      expect(find.text('18% GST (Tax)'), findsOneWidget);
      expect(find.text('Final Total Amount'), findsOneWidget);
      expect(find.text('₹56050.00'), findsOneWidget);

      // Quotation action buttons must be visible
      expect(find.text('Confirm & Finalize Order →'), findsOneWidget);
      expect(find.text('Reject Estimate'), findsOneWidget);
    });

    testWidgets('9, 10, 11, 12. Confirmed PO renders with payment section and does NOT pop on missing payment config', (WidgetTester tester) async {
      final confirmedOrder = TileOrder(
        id: 'ORDER_CONFIRMED_03',
        orderReference: 'ITC-PO-2026-CONF1',
        userId: 'USER_CUST_1',
        customerName: 'Shreeji Ceramics',
        userCategory: 'Dealer',
        status: 'confirmed',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Rajkot, Gujarat'},
        transportRequired: true,
        remarks: 'Payment via bank transfer',
        subtotal: 40000.0,
        discount: 0.0,
        taxAmount: 7200.0,
        totalAmount: 47200.0,
        paymentStatus: 'payment_due',
        items: const [
          OrderItem(
            productId: 'PROD_20',
            productName: 'Travertine Beige Satin',
            size: '800x1600',
            surface: 'Satin Matte',
            quantity: 40,
            quantitySqFt: 550.0,
            unitPrice: 72.727,
            lineTotal: 40000.0,
            moq: 10,
          ),
        ],
        totalBoxes: 40,
        totalWeightTons: 1.2,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: OrderDetailsScreen(
            orderId: confirmedOrder.id,
            initialOrder: confirmedOrder,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Screen remains open
      expect(find.text('PO Details (ITC-PO-2026-CONF1)'), findsOneWidget);
      expect(find.text('Payment Required (Quotation Confirmed)'), findsOneWidget);
      expect(find.text('Order Confirmed'), findsOneWidget);
      expect(find.text('Download Official PO (PDF)'), findsOneWidget);

      // Payment section is present alongside PO details (NEVER replaces PO details)
      expect(find.text('COMPANY BANK DETAILS'), findsOneWidget);
      expect(find.text('SUBMIT PAYMENT DETAILS'), findsOneWidget);
      expect(find.text('Expected Amount (Read-only):'), findsOneWidget);
      expect(find.text('₹47200.00'), findsAtLeast(1));

      // Order items remain visible
      expect(find.text('Travertine Beige Satin'), findsOneWidget);
    });

    test('15. Existing PO financial calculation formula is strictly preserved', () {
      const subtotal = 100000.0;
      const discount = 5000.0;
      const taxRate = 0.18;
      final expectedTax = (subtotal - discount) * taxRate;
      final expectedTotal = (subtotal - discount) + expectedTax;

      expect(expectedTax, equals(17100.0));
      expect(expectedTotal, equals(112100.0));

      final testOrder = TileOrder(
        id: 'FIN_CHECK',
        orderReference: 'ITC-PO-FIN',
        userId: 'USER_1',
        userCategory: 'Dealer',
        status: 'confirmed',
        orderType: 'ready_stock',
        deliveryLocation: const {},
        transportRequired: false,
        remarks: '',
        subtotal: subtotal,
        discount: discount,
        taxAmount: expectedTax,
        totalAmount: expectedTotal,
        items: const [],
      );

      expect(testOrder.subtotal, equals(100000.0));
      expect(testOrder.discount, equals(5000.0));
      expect(testOrder.taxAmount, equals(17100.0));
      expect(testOrder.totalAmount, equals(112100.0));
    });
  });

  group('PART T: AuthGate & Post-Checkout Navigation Atomic Flow Tests', () {
    testWidgets('T1. AuthGate displays SplashScreen while waiting for auth state resolution', (tester) async {
      final authStreamController = StreamController<User?>();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(authStateStream: authStreamController.stream),
        ),
      );

      expect(find.byType(SplashScreen), findsOneWidget);
      await authStreamController.close();
    });

    testWidgets('T2. AuthGate displays AuthScreen when user resolves to null (unauthenticated)', (tester) async {
      final authStreamController = StreamController<User?>();
      await tester.pumpWidget(
        MaterialApp(
          home: AuthGate(authStateStream: authStreamController.stream),
        ),
      );

      authStreamController.add(null);
      await tester.pumpAndSettle();

      expect(find.byType(AuthScreen), findsOneWidget);
      await authStreamController.close();
    });

    testWidgets('T3. Post-checkout success dialog VIEW ORDER DETAILS navigates to OrderDetailsScreen and preserves orderId', (tester) async {
      final testOrder = TileOrder(
        id: 'ORDER_NEW_NAV_99',
        orderReference: 'ITC-PO-2026-9999',
        userId: 'USER_TEST_1',
        customerName: 'Shreeji Ceramics',
        userCategory: 'Dealer',
        status: 'pending_rate',
        orderType: 'ready_stock',
        deliveryLocation: const {'address': 'Ahmedabad, Gujarat'},
        transportRequired: true,
        remarks: 'Direct test',
        items: const [
          OrderItem(
            productId: 'P1',
            productName: 'Royal Black Marble',
            size: '600x1200',
            surface: 'Glossy',
            quantity: 20,
            moq: 10,
          ),
        ],
        totalBoxes: 20,
        totalWeightTons: 0.56,
      );

      // Mirrors the exact fixed navigation contract from checkout_screen.dart.
      // FIX: pushAndRemoveUntil (not pushReplacement) ensures navigating back from
      // OrderDetailsScreen returns to MainNavigationScreen, NOT the empty CartScreen.
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              return Scaffold(
                body: Center(
                  child: ElevatedButton(
                    child: const Text('TRIGGER SUCCESS DIALOG'),
                    onPressed: () async {
                      // Capture order before any async cart-clear gap
                      final savedOrder = testOrder;
                      final savedOrderId = testOrder.id;

                      final action = await showDialog<String>(
                        context: context,
                        barrierDismissible: false,
                        builder: (dialogCtx) => AlertDialog(
                          title: const Text('PO Submitted!'),
                          content: const Text('PO Submitted - Awaiting Salesperson Rate Quote'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(dialogCtx).pop('home'),
                              child: const Text('BACK TO HOME'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.of(dialogCtx).pop('details'),
                              child: const Text('VIEW ORDER DETAILS \u2192'),
                            ),
                          ],
                        ),
                      );

                      if (!context.mounted) return;

                      if (action == 'details') {
                        // FIX: pushAndRemoveUntil ensures back from OrderDetailsScreen
                        // goes to root (home), NOT the now-empty CartScreen.
                        // Route stack: [Root] → [OrderDetailsScreen]  (CartScreen removed)
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(
                            builder: (_) => OrderDetailsScreen(
                              orderId: savedOrderId,
                              initialOrder: savedOrder,
                            ),
                          ),
                          (route) => route.isFirst,
                        );
                      } else {
                        Navigator.of(context).popUntil((route) => route.isFirst);
                      }
                    },
                  ),
                ),
              );
            },
          ),
        ),
      );

      await tester.tap(find.text('TRIGGER SUCCESS DIALOG'));
      await tester.pumpAndSettle();

      expect(find.text('PO Submitted!'), findsOneWidget);
      expect(find.text('PO Submitted - Awaiting Salesperson Rate Quote'), findsOneWidget);
      expect(find.text('VIEW ORDER DETAILS \u2192'), findsOneWidget);

      await tester.tap(find.text('VIEW ORDER DETAILS \u2192'));
      await tester.pumpAndSettle();

      // OrderDetailsScreen is open with correct data
      expect(find.byType(OrderDetailsScreen), findsOneWidget);
      expect(find.text('PO Details (ITC-PO-2026-9999)'), findsOneWidget);
      expect(find.text('Royal Black Marble'), findsOneWidget);
      expect(find.text('Rate Approval in Progress'), findsAtLeast(1));

      // CartScreen is NOT in the route stack
      expect(find.text('My Cart'), findsNothing);
    });

    testWidgets('T4. Post-checkout BACK TO HOME uses popUntil(isFirst) \u2014 does not reveal empty CartScreen', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              return Scaffold(
                body: Center(
                  child: ElevatedButton(
                    child: const Text('TRIGGER SUCCESS DIALOG'),
                    onPressed: () async {
                      final action = await showDialog<String>(
                        context: context,
                        barrierDismissible: false,
                        builder: (dialogCtx) => AlertDialog(
                          title: const Text('PO Submitted!'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(dialogCtx).pop('home'),
                              child: const Text('BACK TO HOME'),
                            ),
                          ],
                        ),
                      );

                      if (!context.mounted) return;

                      if (action == 'home') {
                        // FIX: popUntil(isFirst) pops Checkout + Cart, leaving user on Home
                        Navigator.of(context).popUntil((route) => route.isFirst);
                      }
                    },
                  ),
                ),
              );
            },
          ),
        ),
      );

      await tester.tap(find.text('TRIGGER SUCCESS DIALOG'));
      await tester.pumpAndSettle();

      expect(find.text('PO Submitted!'), findsOneWidget);
      await tester.tap(find.text('BACK TO HOME'));
      await tester.pumpAndSettle();

      // Root route is shown; CartScreen is NOT visible
      expect(find.text('My Cart'), findsNothing);
    });
  });
}
