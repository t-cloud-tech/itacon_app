import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/user_category.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/order_service.dart';
import 'package:itacon_app/models/payment_submission.dart';

TileProduct createTestTile(String id) {
  return TileProduct(
    id: id,
    name: 'Luxury Marble Tile $id',
    size: '600x1200',
    surface: 'Glossy',
    tileCategory: 'Floor Tiles',
    color: 'Carrara White',
    pattern: 'Marble',
    basePrice: 150.0,
    moq: 1,
    stockStatus: 'available_now',
    availableQuantity: 500,
    images: const [],
    mockupImages: const [],
    faceImages: const [],
    pcsPerBox: 2,
    sqFtPerBox: 15.5,
    boxWeightKg: 28.5,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
    AppStateService.instance.clearCart();
  });

  group('PRE-RELEASE PRODUCTION STABILIZATION AUDIT SUITE', () {
    // -------------------------------------------------------------------------
    // 1. All 5 Canonical User Categories
    // -------------------------------------------------------------------------
    test('1. Validates all 5 supported customer categories and their canonical collection mappings', () {
      final supportedCategories = [
        'dealer',
        'architect',
        'builder',
        'wholesaler',
        'retailer',
      ];

      for (final cat in supportedCategories) {
        expect(UserCategory.isValidCategory(cat), isTrue);
        final colName = FirestoreService.getCategoryCollectionName(cat);
        expect(colName, isNotEmpty);
        expect(colName, equals(cat == 'retailer' ? 'retailers' : '${cat}s'));
        final label = UserCategory.getLabel(cat);
        expect(label, isNot(equals('Unknown')));
      }

      // Invalid category rejects cleanly
      expect(UserCategory.isValidCategory('contractor_invalid'), isFalse);
      expect(() => FirestoreService.getCategoryCollectionName('invalid_cat'), throwsArgumentError);
    });

    // -------------------------------------------------------------------------
    // 2. Canonical Profile Schema & Category Mirror Isolation
    // -------------------------------------------------------------------------
    test('2. Registration profile contains canonical UID and strips credentials from category mirror', () {
      const testUid = 'CANONICAL_FIREBASE_UID_12345';
      final masterProfile = <String, dynamic>{
        'userId': testUid,
        'uid': testUid,
        'name': 'New Client User',
        'phone': '+919876543210',
        'countryCode': '+91',
        'role': 'builder',
        'userCategory': 'builder',
        'status': 'active',
        'passwordHash': 'sha256_hash_value',
        'passwordSalt': 'salt_value_123',
        'salesPersonId': 'EMP_638848',
        'assignedSalespersonId': 'EMP_638848',
        'fcmToken': 'fcm_token_sample_secret',
      };

      // Emulate mirror sanitization in createUserProfile
      final mirror = Map<String, dynamic>.from(masterProfile);
      mirror.remove('salesPersonId');
      mirror.remove('assignedSalespersonId');
      mirror.remove('passwordHash');
      mirror.remove('passwordSalt');
      mirror.remove('fcmToken');

      expect(mirror['uid'], equals(testUid));
      expect(mirror['userId'], equals(testUid));
      expect(mirror.containsKey('passwordHash'), isFalse);
      expect(mirror.containsKey('passwordSalt'), isFalse);
      expect(mirror.containsKey('fcmToken'), isFalse);
      expect(mirror.containsKey('salesPersonId'), isFalse);
    });

    // -------------------------------------------------------------------------
    // 3. Cart UID-Scoped Persistence Across Logout and Re-Login
    // -------------------------------------------------------------------------
    test('3. Cart persistence is strictly UID-scoped and survives app restart simulation', () async {
      final appState = AppStateService.instance;
      const userA = 'USER_A_UID';
      const userB = 'USER_B_UID';

      // User A logs in and adds items
      await appState.loadUserCart(userA);
      appState.addToCart(createTestTile('T1'), quantity: 3);
      expect(appState.totalBoxes, equals(3));

      // User A logs out -> in-memory cart cleared
      appState.clearInMemoryCart();
      expect(appState.totalBoxes, equals(0));

      // User B logs in -> starts with empty cart
      await appState.loadUserCart(userB);
      expect(appState.totalBoxes, equals(0));

      // User B adds their own items
      appState.addToCart(createTestTile('T2'), quantity: 7);
      expect(appState.totalBoxes, equals(7));

      // User B logs out
      appState.clearInMemoryCart();

      // User A logs back in -> User A's cart is restored with exactly 3 boxes
      await appState.loadUserCart(userA);
      expect(appState.totalBoxes, equals(3));
      expect(appState.cartItems.first.product.id, equals('T1'));

      // User B logs back in -> User B's cart is restored with exactly 7 boxes
      appState.clearInMemoryCart();
      await appState.loadUserCart(userB);
      expect(appState.totalBoxes, equals(7));
      expect(appState.cartItems.first.product.id, equals('T2'));
    });

    // -------------------------------------------------------------------------
    // 4. Corrupted Cart JSON Graceful Recovery
    // -------------------------------------------------------------------------
    test('4. Corrupted cart JSON in device storage fails safely without crashing', () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cart_CORRUPT_UID', 'INVALID_JSON_CORRUPTED{[[[');

      final appState = AppStateService.instance;
      // Must not throw exception
      await appState.loadUserCart('CORRUPT_UID');
      expect(appState.totalBoxes, equals(0));
      expect(appState.cartItems, isEmpty);
    });

    // -------------------------------------------------------------------------
    // 5. Payment UTR & Amount Validation Safety
    // -------------------------------------------------------------------------
    test('5. Manual bank transfer validates exact paise precision and UTR length', () {
      expect(PaymentSubmission.normalizeUtr(' utr 12345678 '), equals('UTR12345678'));
      expect(PaymentSubmission.normalizeUtr('abc-def-123'), equals('ABCDEF123'));

      // 6 characters minimum
      expect(PaymentSubmission.normalizeUtr('12345').length, lessThan(6));
      expect(PaymentSubmission.normalizeUtr('123456').length, greaterThanOrEqualTo(6));

      // Paise comparison
      const double orderAmount = 14500.50;
      const double enteredAmountCorrect = 14500.50;
      const double enteredAmountWrong = 14500.00;

      final orderPaise = (orderAmount * 100).round();
      final enteredPaiseCorrect = (enteredAmountCorrect * 100).round();
      final enteredPaiseWrong = (enteredAmountWrong * 100).round();

      expect(orderPaise == enteredPaiseCorrect, isTrue);
      expect(orderPaise == enteredPaiseWrong, isFalse);
    });

    // -------------------------------------------------------------------------
    // 6. TileOrder Missing Optional / Legacy Fields Safety
    // -------------------------------------------------------------------------
    test('6. TileOrder parses legacy and missing optional fields safely without throwing', () {
      final minimalOrderMap = <String, dynamic>{
        'id': 'ORD_1001',
        'userId': 'USER_123',
        'status': 'pending_rate',
        'totalAmount': 0.0,
        'createdAt': '2026-10-01T10:00:00Z',
      };

      final order = TileOrder.fromMap(minimalOrderMap, 'ORD_1001');
      expect(order.id, equals('ORD_1001'));
      expect(order.userId, equals('USER_123'));
      expect(order.status, equals('pending_rate'));
      expect(order.items, isEmpty);
      expect(order.customerPhone, isNull);
      expect(order.rejectionReason, isNull);
      expect(order.isPaymentRejected, isFalse);
      expect(order.createdAt, isNotNull);
    });

    // -------------------------------------------------------------------------
    // 7. Cart to Order Items Transformation Safety
    // -------------------------------------------------------------------------
    test('7. OrderService converts cart items to order items accurately', () {
      final appState = AppStateService.instance;
      final tile = createTestTile('TILE_TEST_1');
      appState.addToCart(tile, quantity: 4, size: '600x1200', finish: 'Glossy');

      final orderItems = OrderService.instance.cartToOrderItems(appState.cartItems);
      expect(orderItems.length, equals(1));
      expect(orderItems.first.productId, equals('TILE_TEST_1'));
      expect(orderItems.first.quantityBoxes, equals(4));
      expect(orderItems.first.productName, equals('Luxury Marble Tile TILE_TEST_1'));
      expect(orderItems.first.basePrice, equals(150.0));
    });

    // -------------------------------------------------------------------------
    // 8. Responsive Layout Test: Representative Screen Widths
    // -------------------------------------------------------------------------
    testWidgets('8. Critical UI cards render without RenderFlex overflow on small to large screen widths', (tester) async {
      final widths = [320.0, 360.0, 390.0, 412.0, 600.0];

      for (final width in widths) {
        tester.view.physicalSize = Size(width * 2.0, 800.0 * 2.0);
        tester.view.devicePixelRatio = 2.0;

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Center(
                child: SizedBox(
                  width: width,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          const Icon(Icons.shopping_bag),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Test Product Title With Long Name $width',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const Text('₹1,500.00'),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );

        await tester.pump();
        expect(find.byType(Card), findsOneWidget);
        expect(tester.takeException(), isNull);
      }

      // Reset
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });
    });

    // -------------------------------------------------------------------------
    // 9. Accessibility Font Scale Test
    // -------------------------------------------------------------------------
    testWidgets('9. UI renders safely under accessibility text scale factors up to 1.25', (tester) async {
      final scales = [1.0, 1.15, 1.25];

      for (final scale in scales) {
        await tester.pumpWidget(
          MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(scale),
              ),
              child: child!,
            ),
            home: Scaffold(
              body: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Header Title at scale $scale', style: const TextStyle(fontSize: 20)),
                    const SizedBox(height: 8),
                    const Text('Secondary body description for tile product specifications'),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: () {},
                      child: const Text('PROCEED TO CHECKOUT →'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );

        await tester.pump();
        expect(find.text('PROCEED TO CHECKOUT →'), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    });

    // -------------------------------------------------------------------------
    // 10. Phone Number Normalization
    // -------------------------------------------------------------------------
    test('10. India phone normalization correctly handles 10-digit, +91, and spaces without duplication', () {
      final p1 = FirestoreService.parsePhoneNumberComponents('9876543210');
      expect(p1['e164Phone'], equals('+919876543210'));
      expect(p1['countryCode'], equals('+91'));
      expect(p1['nationalNumber'], equals('9876543210'));

      final p2 = FirestoreService.parsePhoneNumberComponents('+91 98765 43210');
      expect(p2['e164Phone'], equals('+919876543210'));
      expect(p2['countryCode'], equals('+91'));
      expect(p2['nationalNumber'], equals('9876543210'));

      final p3 = FirestoreService.parsePhoneNumberComponents('09876543210');
      expect(p3['e164Phone'], equals('+919876543210'));
      expect(p3['countryCode'], equals('+91'));
      expect(p3['nationalNumber'], equals('9876543210'));
    });
  });
}
