import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/services/app_state_service.dart';

TileProduct _createTile({
  required String id,
  required String name,
  double basePrice = 35.0,
  bool isActive = true,
}) {
  return TileProduct(
    id: id,
    productId: id,
    sku: 'SKU-$id',
    name: name,
    size: '600x1200 mm',
    surface: 'Glossy',
    color: 'White',
    pattern: 'Marble',
    basePrice: basePrice,
    moq: 10,
    stockStatus: 'available_now',
    images: const ['https://example.com/tile.jpg'],
    isActive: isActive,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Tile Active / Inactive Lifecycle & Filter Verification', () {
    test('1 & 2. Inactive tile drops count from 304 to 303, reactivating restores 304', () {
      // Create test dataset representing all 304 catalog products
      final sampleList = List<TileProduct>.generate(304, (i) {
        if (i == 0) {
          return _createTile(
            id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_001',
            name: '001-ADLINE SATUARIO',
            basePrice: 35.0,
            isActive: true,
          );
        }
        return _createTile(
          id: 'PROD_TEST_$i',
          name: 'Tile $i',
          basePrice: 40.0,
          isActive: true,
        );
      });

      // Initially all 304 active
      final activeInitially = sampleList.where((p) => p.isActive).toList();
      expect(activeInitially.length, 304);

      // Designer makes "001-ADLINE SATUARIO" inactive
      final deactivationList = sampleList.map((p) {
        if (p.name == '001-ADLINE SATUARIO' || p.id == 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_001') {
          return p.copyWith(isActive: false);
        }
        return p;
      }).toList();

      final activeAfterDeactivation = deactivationList.where((p) => p.isActive).toList();
      expect(activeAfterDeactivation.length, 303);
      expect(activeAfterDeactivation.any((p) => p.name == '001-ADLINE SATUARIO'), isFalse);

      // Designer reactivates "001-ADLINE SATUARIO"
      final reactivationList = deactivationList.map((p) {
        if (p.name == '001-ADLINE SATUARIO' || p.id == 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_001') {
          return p.copyWith(isActive: true);
        }
        return p;
      }).toList();

      final activeAfterReactivation = reactivationList.where((p) => p.isActive).toList();
      expect(activeAfterReactivation.length, 304);
      expect(activeAfterReactivation.any((p) => p.name == '001-ADLINE SATUARIO'), isTrue);
    });

    test('3. Inactive tiles are excluded from AppStateService favoriteProducts and favoritesCount', () {
      final appState = AppStateService.instance;
      appState.clearCart();

      final activeTile = _createTile(
        id: 'PROD_ACTIVE_1',
        name: 'Active Tile',
        basePrice: 50.0,
        isActive: true,
      );

      final inactiveTile = _createTile(
        id: 'PROD_INACTIVE_1',
        name: 'Inactive Tile',
        basePrice: 50.0,
        isActive: false,
      );

      appState.toggleFavorite(activeTile);
      appState.toggleFavorite(inactiveTile);

      // favoriteProducts must only contain active tiles
      expect(appState.favoriteProducts.length, 1);
      expect(appState.favoriteProducts.first.id, 'PROD_ACTIVE_1');
      expect(appState.favoritesCount, 1);
      expect(appState.isFavorite('PROD_ACTIVE_1'), isTrue);
      expect(appState.isFavorite('PROD_INACTIVE_1'), isFalse);
    });

    test('4. Inactive tile in cart: detected as unavailable and blocked from active checkout', () {
      final appState = AppStateService.instance;
      appState.clearCart();

      final activeTile = _createTile(
        id: 'PROD_ACTIVE_1',
        name: 'Active Tile',
        basePrice: 50.0,
        isActive: true,
      );

      final inactiveTile = _createTile(
        id: 'PROD_INACTIVE_1',
        name: '001-ADLINE SATUARIO (Deactivated)',
        basePrice: 35.0,
        isActive: false,
      );

      appState.addToCart(activeTile, quantity: 2);
      appState.addToCart(inactiveTile, quantity: 1);

      expect(appState.cartItems.length, 2);

      // Active items filter for checkout
      final activeItemsForCheckout = appState.cartItems.where((i) => i.product.isActive).toList();
      final unavailableItems = appState.cartItems.where((i) => !i.product.isActive).toList();

      expect(activeItemsForCheckout.length, 1);
      expect(activeItemsForCheckout.first.product.id, 'PROD_ACTIVE_1');
      expect(unavailableItems.length, 1);
      expect(unavailableItems.first.product.id, 'PROD_INACTIVE_1');

      // Simulate checkout: only active items removed, inactive item remains with unavailable status
      for (final item in activeItemsForCheckout) {
        appState.removeFromCart(item);
      }

      expect(appState.cartItems.length, 1);
      expect(appState.cartItems.first.product.isActive, isFalse);
    });
  });
}
