import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/providers/cart_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cart & Order Pricing Calculation Specification Tests', () {
    setUp(() {
      AppStateService.instance.clearInMemoryCart();
    });

    test('Single Box Calculation: 35/sq ft * 15.5 sq ft/box = 542.50 per box', () {
      final product = TileProduct(
        id: 'ITA-001',
        name: 'ITA 001-ADLINE SATUARIO',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Marble',
        basePrice: 35.0,
        moq: 1,
        stockStatus: 'available',
        images: ['https://example.com/img1.jpg'],
        sqFtPerBox: 15.5,
      );

      final item = CartItem(
        product: product,
        selectedSize: '600x1200 mm',
        selectedFinish: 'Glossy',
        quantity: 1,
      );

      expect(item.sqFtPerBox, equals(15.5));
      expect(item.effectiveUnitPrice, equals(35.0));
      expect(item.boxPrice, equals(542.50));
      expect(item.itemTotal, equals(542.50));
    });

    test('Full Cart Calculation: 100 + 100 + 1350 = 1550 Boxes = 8,40,875 + 18% Tax = 9,92,232.50', () {
      final appState = AppStateService.instance;
      final cartProvider = CartProvider.instance;

      final prod1 = TileProduct(
        id: 'ITA-001',
        name: 'ITA 001-ADLINE SATUARIO',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Marble',
        basePrice: 35.0,
        moq: 1,
        stockStatus: 'available',
        images: ['https://example.com/img1.jpg'],
        sqFtPerBox: 15.5,
        boxWeightKg: 28.0,
      );

      final prod2 = TileProduct(
        id: 'ITA-002',
        name: 'ITA 002-PERCIANO',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'Grey',
        pattern: 'Marble',
        basePrice: 35.0,
        moq: 1,
        stockStatus: 'available',
        images: ['https://example.com/img2.jpg'],
        sqFtPerBox: 15.5,
        boxWeightKg: 28.0,
      );

      final prod3 = TileProduct(
        id: 'ITA-003',
        name: 'ITA 003-MG SILVER SATUARIO',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'Silver',
        pattern: 'Marble',
        basePrice: 35.0,
        moq: 1,
        stockStatus: 'available',
        images: ['https://example.com/img3.jpg'],
        sqFtPerBox: 15.5,
        boxWeightKg: 28.0,
      );

      appState.addToCart(prod1, quantity: 100);
      appState.addToCart(prod2, quantity: 100);
      appState.addToCart(prod3, quantity: 1350);

      expect(appState.cartCount, equals(3));
      expect(appState.totalBoxes, equals(1550));
      expect(cartProvider.totalBoxes, equals(1550));

      // Weight checks: 1550 boxes * 28 kg = 43,400 kg = 43.40 tonnes
      expect(appState.totalWeightKg, equals(43400.0));
      expect(appState.totalWeightTons, equals(43.40));

      // Individual item line totals
      expect(appState.cartItems[0].boxPrice, equals(542.50));
      expect(appState.cartItems[0].itemTotal, equals(54250.0)); // 100 * 542.50
      expect(appState.cartItems[1].itemTotal, equals(54250.0)); // 100 * 542.50
      expect(appState.cartItems[2].itemTotal, equals(732375.0)); // 1350 * 542.50

      // Subtotal calculation: 54,250 + 54,250 + 732,375 = 840,875 (542.50 * 1550)
      expect(appState.subtotal, equals(840875.0));
      expect(cartProvider.subtotal, equals(840875.0));

      // 18% Tax (GST): 840,875 * 0.18 = 151,357.50
      expect(appState.taxAmount, equals(151357.50));
      expect(cartProvider.taxAmount, equals(151357.50));

      // Total Amount: 840,875 + 151,357.50 = 992,232.50
      expect(appState.totalAmount, equals(992232.50));
      expect(cartProvider.totalAmount, equals(992232.50));
    });

    test('TileProduct.fromMap resolves default 15.5 sqFtPerBox if missing in JSON', () {
      final json = {
        'id': 'ITA-001',
        'name': 'ITA 001-ADLINE SATUARIO',
        'size': '600x1200 mm',
        'basePrice': 35.0,
      };

      final product = TileProduct.fromJson(json);
      expect(product.sqFtPerBox, equals(15.5));
    });

    test('Adhesive product calculation remains unaffected (bag pricing, not sqft)', () {
      final adhesive = TileProduct(
        id: 'ITA-ADH-001',
        name: 'ITACON Fix Tile Adhesive',
        size: '20 kg Bag',
        surface: 'TYPE-1',
        color: 'Grey',
        pattern: 'Polymer Modified',
        basePrice: 350.0,
        moq: 1,
        stockStatus: 'available',
        images: ['https://example.com/adh.jpg'],
        productLine: 'adhesives',
        unit: 'bag',
        bagWeightKg: 20.0,
      );

      final item = CartItem(
        product: adhesive,
        selectedSize: '20 kg Bag',
        selectedFinish: 'TYPE-1',
        quantity: 10,
      );

      expect(item.product.isAdhesive, isTrue);
      expect(item.boxPrice, equals(350.0));
      expect(item.itemTotal, equals(3500.0));
    });
  });
}
