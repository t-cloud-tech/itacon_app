import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/providers/cart_provider.dart';

TileProduct createTestTile({
  required String id,
  required String name,
  String sku = 'ITA-TEST-001',
  String size = '600x1200 mm',
  String surface = 'Glossy',
  String finish = 'Polished',
  double basePrice = 120.0,
  List<String> images = const ['https://firebasestorage.googleapis.com/v0/b/itacon/tile1.webp'],
  List<String>? mockupImages = const ['mockups/full/test_room.webp'],
  List<String>? faceImages = const ['faces/test_face1.webp'],
}) {
  return TileProduct(
    id: id,
    productId: id,
    sku: sku,
    name: name,
    size: size,
    surface: surface,
    finish: finish,
    color: 'Grey',
    baseColour: 'Grey',
    pattern: 'Marble',
    basePrice: basePrice,
    moq: 10,
    stockStatus: 'available_now',
    availableQuantity: 500,
    images: images,
    mockupImages: mockupImages,
    faceImages: faceImages,
    pcsPerBox: 2,
    sqFtPerBox: 15.5,
    boxWeightKg: 28.0,
  );
}

UserProfile createTestUser({
  required String uid,
  required String name,
  String phone = '+919876543210',
}) {
  return UserProfile(
    userId: uid,
    name: name,
    companyName: 'Test Firm',
    email: '$uid@test.com',
    phone: phone,
    userCategory: 'Dealer',
    role: 'customer',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final appState = AppStateService.instance;
    appState.clearUserProfile();
    appState.clearInMemoryCart();
  });

  group('Cart Persistence Regression Test Suite (20 Scenarios)', () {
    // 1. Add one product -> Cart persisted.
    test('1. Add one product -> Cart persisted locally under cart_<uid>', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_001', name: 'Alice');
      appState.setCurrentUserProfile(user);

      final tile1 = createTestTile(id: 'TILE_01', name: 'Statua Marble');
      await appState.addToCart(tile1, quantity: 3);

      expect(appState.cartCount, 1);
      expect(appState.cartItems.first.product.id, 'TILE_01');
      expect(appState.cartItems.first.quantity, 3);

      // Verify persisted in SharedPreferences under cart_UID_001
      final prefs = await SharedPreferences.getInstance();
      final savedJson = prefs.getString('cart_UID_001');
      expect(savedJson, isNotNull);

      final decoded = jsonDecode(savedJson!) as List;
      expect(decoded.length, 1);
      expect(decoded.first['product']['id'], 'TILE_01');
      expect(decoded.first['quantity'], 3);
    });

    // 2. Add multiple products -> Cart persisted.
    test('2. Add multiple products -> Cart persisted with all products', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_002', name: 'Bob');
      appState.setCurrentUserProfile(user);

      final tile1 = createTestTile(id: 'TILE_01', name: 'Tile One');
      final tile2 = createTestTile(id: 'TILE_02', name: 'Tile Two');
      await appState.addToCart(tile1, quantity: 2);
      await appState.addToCart(tile2, quantity: 4);

      expect(appState.cartCount, 2);

      final prefs = await SharedPreferences.getInstance();
      final savedJson = prefs.getString('cart_UID_002');
      expect(savedJson, isNotNull);

      final decoded = jsonDecode(savedJson!) as List;
      expect(decoded.length, 2);
      expect(decoded[0]['product']['id'], 'TILE_01');
      expect(decoded[0]['quantity'], 2);
      expect(decoded[1]['product']['id'], 'TILE_02');
      expect(decoded[1]['quantity'], 4);
    });

    // 3. Restart simulation -> same Cart restored.
    test('3. Restart simulation -> same Cart restored automatically', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_003', name: 'Charlie');
      appState.setCurrentUserProfile(user);

      final tile1 = createTestTile(id: 'TILE_01', name: 'Onyx Blue');
      await appState.addToCart(tile1, quantity: 5);

      // Simulate closing the app completely (in-memory state cleared)
      appState.clearInMemoryCart();
      appState.clearUserProfile();
      expect(appState.cartCount, 0);

      // Simulate opening the app: auth resolves user UID_003, loads cart
      await appState.loadUserCart('UID_003');

      expect(appState.cartCount, 1);
      expect(appState.cartItems.first.product.name, 'Onyx Blue');
      expect(appState.cartItems.first.quantity, 5);
    });

    // 4. Quantity persists after restart.
    test('4. Quantity persists after restart (not reset to 1 or 0)', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_004', name: 'David');
      appState.setCurrentUserProfile(user);

      final tileA = createTestTile(id: 'TILE_A', name: 'Product A');
      final tileB = createTestTile(id: 'TILE_B', name: 'Product B');
      await appState.addToCart(tileA, quantity: 3);
      await appState.addToCart(tileB, quantity: 5);

      expect(appState.totalBoxes, 8);

      // Simulate process restart
      appState.clearInMemoryCart();
      expect(appState.totalBoxes, 0);

      // Re-load
      await appState.loadUserCart('UID_004');
      expect(appState.cartCount, 2);
      expect(appState.cartItems[0].quantity, 3);
      expect(appState.cartItems[1].quantity, 5);
      expect(appState.totalBoxes, 8);
    });

    // 5. Remove product -> persisted state updated.
    test('5. Remove product -> persisted state updated immediately', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_005', name: 'Eve');
      appState.setCurrentUserProfile(user);

      final tile1 = createTestTile(id: 'TILE_01', name: 'Tile 1');
      final tile2 = createTestTile(id: 'TILE_02', name: 'Tile 2');
      await appState.addToCart(tile1, quantity: 2);
      await appState.addToCart(tile2, quantity: 3);

      expect(appState.cartCount, 2);

      // Remove tile 1
      await appState.removeFromCart(appState.cartItems.first);
      expect(appState.cartCount, 1);

      final prefs = await SharedPreferences.getInstance();
      final savedJson = prefs.getString('cart_UID_005');
      final decoded = jsonDecode(savedJson!) as List;
      expect(decoded.length, 1);
      expect(decoded.first['product']['id'], 'TILE_02');
    });

    // 6. Quantity increase -> persisted.
    test('6. Quantity increase -> persisted immediately', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_006', name: 'Frank');
      appState.setCurrentUserProfile(user);

      final tile = createTestTile(id: 'TILE_01', name: 'Tile 1');
      await appState.addToCart(tile, quantity: 2);

      await appState.updateQuantity(appState.cartItems.first, 3); // 2 + 3 = 5
      expect(appState.cartItems.first.quantity, 5);

      final prefs = await SharedPreferences.getInstance();
      final savedJson = prefs.getString('cart_UID_006');
      final decoded = jsonDecode(savedJson!) as List;
      expect(decoded.first['quantity'], 5);
    });

    // 7. Quantity decrease -> persisted.
    test('7. Quantity decrease -> persisted immediately', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_007', name: 'Grace');
      appState.setCurrentUserProfile(user);

      final tile = createTestTile(id: 'TILE_01', name: 'Tile 1');
      await appState.addToCart(tile, quantity: 8);

      await appState.updateQuantity(appState.cartItems.first, -3); // 8 - 3 = 5
      expect(appState.cartItems.first.quantity, 5);

      final prefs = await SharedPreferences.getInstance();
      final savedJson = prefs.getString('cart_UID_007');
      final decoded = jsonDecode(savedJson!) as List;
      expect(decoded.first['quantity'], 5);
    });

    // 8. Clear Cart -> persisted Cart removed.
    test('8. Clear Cart -> persisted Cart removed from storage', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_008', name: 'Heidi');
      appState.setCurrentUserProfile(user);

      final tile = createTestTile(id: 'TILE_01', name: 'Tile 1');
      await appState.addToCart(tile, quantity: 4);

      await appState.clearCart();
      expect(appState.cartCount, 0);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('cart_UID_008'), isNull);

      // App restart should keep cart empty
      await appState.loadUserCart('UID_008');
      expect(appState.cartCount, 0);
    });

    // 9. User A Cart isolated from User B.
    test('9. User A Cart isolated from User B', () async {
      final appState = AppStateService.instance;

      // User A
      final userA = createTestUser(uid: 'UID_A', name: 'User A');
      appState.setCurrentUserProfile(userA);
      final tileA = createTestTile(id: 'TILE_A', name: 'Tile A');
      await appState.addToCart(tileA, quantity: 10);

      // Switch to User B
      appState.clearInMemoryCart();
      final userB = createTestUser(uid: 'UID_B', name: 'User B');
      appState.setCurrentUserProfile(userB);
      final tileB = createTestTile(id: 'TILE_B', name: 'Tile B');
      await appState.addToCart(tileB, quantity: 20);

      final prefs = await SharedPreferences.getInstance();
      final rawA = prefs.getString('cart_UID_A');
      final rawB = prefs.getString('cart_UID_B');
      expect(rawA, isNotNull);
      expect(rawB, isNotNull);

      final savedA = jsonDecode(rawA!) as List;
      final savedB = jsonDecode(rawB!) as List;

      expect(savedA.first['product']['id'], 'TILE_A');
      expect(savedA.first['quantity'], 10);
      expect(savedB.first['product']['id'], 'TILE_B');
      expect(savedB.first['quantity'], 20);
    });

    // 10. Logout clears in-memory state.
    test('10. Logout clears in-memory state', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_010', name: 'Judy');
      await UserSessionService.saveUserSession(user);

      final tile = createTestTile(id: 'TILE_01', name: 'Tile 1');
      await appState.addToCart(tile, quantity: 2);
      expect(appState.cartCount, 1);
      expect(CartProvider.instance.itemCount, 1);

      await UserSessionService.clearUserSession(signOutFirebase: false);

      expect(appState.cartCount, 0);
      expect(CartProvider.instance.itemCount, 0);
      expect(appState.hasSessionProfile, isFalse);
    });

    // 11. Logout does NOT destroy User A's saved Cart.
    test('11. Logout does NOT destroy User A saved Cart', () async {
      final appState = AppStateService.instance;
      final userA = createTestUser(uid: 'UID_011', name: 'User 11');
      await UserSessionService.saveUserSession(userA);

      final tile = createTestTile(id: 'TILE_01', name: 'Tile 1');
      await appState.addToCart(tile, quantity: 3);

      await UserSessionService.clearUserSession(signOutFirebase: false);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('cart_UID_011'), isNotNull);
    });

    // 12. User A logs back in -> User A Cart restored.
    test('12. User A logs back in -> User A Cart restored', () async {
      final appState = AppStateService.instance;
      final userA = createTestUser(uid: 'UID_012', name: 'User 12');
      await UserSessionService.saveUserSession(userA);

      final tile = createTestTile(id: 'TILE_01', name: 'Tile 1');
      await appState.addToCart(tile, quantity: 7);

      // Logout
      await UserSessionService.clearUserSession(signOutFirebase: false);
      expect(appState.cartCount, 0);

      // Re-login
      await UserSessionService.saveUserSession(userA);
      expect(appState.cartCount, 1);
      expect(appState.cartItems.first.quantity, 7);
    });

    // 13. User B never sees User A Cart.
    test('13. User B never sees User A Cart', () async {
      final appState = AppStateService.instance;
      final userA = createTestUser(uid: 'UID_013_A', name: 'User 13A');
      await UserSessionService.saveUserSession(userA);

      final tile = createTestTile(id: 'TILE_SECRET', name: 'Secret Tile');
      await appState.addToCart(tile, quantity: 15);

      // Logout User A
      await UserSessionService.clearUserSession(signOutFirebase: false);

      // User B logs in
      final userB = createTestUser(uid: 'UID_013_B', name: 'User 13B');
      await UserSessionService.saveUserSession(userB);

      expect(appState.cartCount, 0);
      expect(appState.cartItems, isEmpty);
    });

    // 14. Restored Cart badge/count correct.
    test('14. Restored Cart badge/count correct on CartProvider and AppStateService', () async {
      final appState = AppStateService.instance;
      final cartProvider = CartProvider.instance;
      final user = createTestUser(uid: 'UID_014', name: 'User 14');
      appState.setCurrentUserProfile(user);

      await appState.addToCart(createTestTile(id: 'T1', name: 'T1'), quantity: 2);
      await appState.addToCart(createTestTile(id: 'T2', name: 'T2'), quantity: 3);

      appState.clearInMemoryCart();
      expect(cartProvider.itemCount, 0);
      expect(cartProvider.totalBoxes, 0);

      await appState.loadUserCart('UID_014');

      expect(cartProvider.itemCount, 2);
      expect(cartProvider.totalBoxes, 5);
      expect(appState.cartCount, 2);
    });

    // 15. Empty saved Cart restores correctly.
    test('15. Empty saved Cart restores correctly without error', () async {
      final appState = AppStateService.instance;
      await appState.loadUserCart('NON_EXISTENT_UID');
      expect(appState.cartCount, 0);
      expect(appState.cartItems, isEmpty);
    });

    // 16. Corrupted local Cart data fails safely without crashing.
    test('16. Corrupted local Cart data fails safely without crashing', () async {
      final appState = AppStateService.instance;
      final prefs = await SharedPreferences.getInstance();

      // Case A: Malformed non-JSON string
      await prefs.setString('cart_CORRUPT_1', '{invalid-json-content');
      await appState.loadUserCart('CORRUPT_1');
      expect(appState.cartCount, 0);

      // Case B: Decoded JSON is a Map instead of List
      await prefs.setString('cart_CORRUPT_2', '{"someKey": "someValue"}');
      await appState.loadUserCart('CORRUPT_2');
      expect(appState.cartCount, 0);

      // Case C: List contains an invalid item
      await prefs.setString('cart_CORRUPT_3', jsonEncode([
        {'product': {'id': 'GOOD_1', 'name': 'Good Tile', 'size': '600x1200 mm', 'surface': 'Glossy', 'color': 'White', 'pattern': 'Marble', 'basePrice': 100, 'moq': 1, 'stockStatus': 'available', 'images': <String>[]}, 'selectedSize': '600x1200 mm', 'selectedFinish': 'Glossy', 'quantity': 2},
        'corrupt_non_map_item',
      ]));
      await appState.loadUserCart('CORRUPT_3');
      expect(appState.cartCount, 1);
      expect(appState.cartItems.first.product.name, 'Good Tile');
    });

    // 17. Product image references survive serialization/restoration.
    test('17. Product image references survive serialization/restoration', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_017', name: 'User 17');
      appState.setCurrentUserProfile(user);

      const mockups = ['products/mockups/living_room.jpeg'];
      const faces = ['products/tiles/tile_face_01.jpeg'];
      const originals = ['https://storage.googleapis.com/itacon/original_tile.jpg'];

      final tile = createTestTile(
        id: 'TILE_IMG',
        name: 'Image Test Tile',
        images: originals,
        mockupImages: mockups,
        faceImages: faces,
      );

      await appState.addToCart(tile, quantity: 1);

      appState.clearInMemoryCart();
      await appState.loadUserCart('UID_017');

      final restored = appState.cartItems.first.product;
      expect(restored.mockupImages, mockups);
      expect(restored.faceImages, faces);
      expect(restored.frontCardImage, mockups.first);
      expect(restored.frontCardThumbnail, 'products/thumbnails/mockups/living_room.webp');
      expect(restored.resolvedFaceImages, faces);
    });

    // 18. Existing checkout behavior remains working (clears cart on submit).
    test('18. Existing checkout behavior remains working (clears memory and storage)', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_018', name: 'User 18');
      appState.setCurrentUserProfile(user);

      final tile = createTestTile(id: 'TILE_01', name: 'Tile 1');
      await appState.addToCart(tile, quantity: 2);

      // Verify cart exists
      expect(appState.cartCount, 1);

      // On PO submit success, CheckoutScreen calls appState.clearCart()
      await appState.clearCart();

      expect(appState.cartCount, 0);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('cart_UID_018'), isNull);
    });

    // 19. App restart does not clear Cart.
    test('19. App restart does not clear Cart', () async {
      final appState = AppStateService.instance;
      final user = createTestUser(uid: 'UID_019', name: 'User 19');
      appState.setCurrentUserProfile(user);

      final tile = createTestTile(id: 'TILE_01', name: 'Persistent Tile');
      await appState.addToCart(tile, quantity: 4);

      // Simulate 3 successive app close & reopen cycles
      for (int i = 0; i < 3; i++) {
        appState.clearInMemoryCart();
        expect(appState.cartCount, 0);

        await appState.loadUserCart('UID_019');
        expect(appState.cartCount, 1);
        expect(appState.cartItems.first.quantity, 4);
      }
    });

    // 20. Existing authentication persistence remains working.
    test('20. Existing authentication persistence remains working with cart restoration', () async {
      final user = createTestUser(uid: 'UID_020', name: 'User 20');
      await UserSessionService.saveUserSession(user);

      final appState = AppStateService.instance;
      final tile = createTestTile(id: 'TILE_AUTH', name: 'Auth Tile');
      await appState.addToCart(tile, quantity: 6);

      // Simulate app restart: restore session
      appState.clearInMemoryCart();
      appState.clearUserProfile();

      final restoredProfile = await UserSessionService.restoreUserSession();
      expect(restoredProfile, isNotNull);
      expect(restoredProfile!.userId, 'UID_020');
      expect(restoredProfile.name, 'User 20');

      // Cart is restored as part of session restoration
      expect(appState.cartCount, 1);
      expect(appState.cartItems.first.product.name, 'Auth Tile');
      expect(appState.cartItems.first.quantity, 6);
    });
  });
}
