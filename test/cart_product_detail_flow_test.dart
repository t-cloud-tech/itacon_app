import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/screens/cart_screen.dart';
import 'package:itacon_app/screens/product_detail_screen.dart';
import 'package:itacon_app/services/app_state_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final tileProduct = TileProduct(
    id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_001',
    productId: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_00_001',
    sku: 'VIT-60120-001',
    name: '001-ADLINE SATUARIO',
    size: '600x1200 mm',
    surface: 'Glossy',
    finish: 'Glossy',
    color: 'White Statuario',
    baseColour: 'White Statuario',
    pattern: 'Marble - Random',
    basePrice: 35.0,
    moq: 10,
    stockStatus: 'available_now',
    sqFtPerBox: 15.5,
    boxWeightKg: 27.0,
    isActive: true,
    images: ['products/tiles/sample_tile.jpeg'],
  );

  final adhesiveProduct = TileProduct(
    id: 'PROD_ADH_LX01',
    productId: 'PROD_ADH_LX01',
    sku: 'ITA-LX-01',
    name: 'ITA LX-01 Grey Tile Adhesive (20 kg Bag)',
    productLine: 'adhesives',
    tileCategory: 'Fixing Solutions',
    size: '20 kg Bag',
    surface: 'TYPE-1 (C1T)',
    finish: 'TYPE-1 (C1T)',
    color: 'Grey',
    baseColour: 'Grey',
    pattern: 'Polymer Modified Powder',
    basePrice: 200.0,
    moq: 1,
    stockStatus: 'available_now',
    boxWeightKg: 20.0,
    sqFtPerBox: 40.0,
    isActive: true,
    images: ['products/adhesives/ITA-LX-01.png'],
  );

  final inactiveTileProduct = TileProduct(
    id: 'PROD_INACTIVE_01',
    productId: 'PROD_INACTIVE_01',
    sku: 'VIT-INACTIVE-01',
    name: 'Discontinued Porcelain Slab',
    size: '600x1200 mm',
    surface: 'Matt',
    finish: 'Matt',
    color: 'Beige',
    baseColour: 'Beige',
    pattern: 'Stone',
    basePrice: 40.0,
    moq: 1,
    stockStatus: 'available_now',
    isActive: false,
    images: ['products/tiles/sample_tile.jpeg'],
  );

  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearInMemoryCart();
  });

  testWidgets('Rule 1 & 2: Tapping tile name/image opens ProductDetailScreen', (WidgetTester tester) async {
    final appState = AppStateService.instance;
    await appState.addToCart(tileProduct, quantity: 5);

    await tester.pumpWidget(
      const MaterialApp(
        home: CartScreen(),
      ),
    );
    await settle(tester);

    expect(find.text('001-ADLINE SATUARIO'), findsOneWidget);
    expect(find.byType(ProductDetailScreen), findsNothing);

    // Tap the product name in the cart
    await tester.tap(find.text('001-ADLINE SATUARIO'));
    await settle(tester);

    // Verify ProductDetailScreen is pushed
    expect(find.byType(ProductDetailScreen), findsOneWidget);
    expect(find.text('001-ADLINE SATUARIO'), findsWidgets);

    // Rule 4: Shows "In cart: 5 boxes" on the detail page
    expect(find.text('In cart: 5 boxes'), findsWidgets);
  });

  testWidgets('Rule 2: Tapping adhesive (LX-01) opens correctly showing ₹200 and bag rate', (WidgetTester tester) async {
    final appState = AppStateService.instance;
    await appState.addToCart(adhesiveProduct, quantity: 3);

    await tester.pumpWidget(
      const MaterialApp(
        home: CartScreen(),
      ),
    );
    await settle(tester);

    expect(find.text('ITA LX-01 Grey Tile Adhesive (20 kg Bag)'), findsOneWidget);

    // Tap adhesive name
    await tester.tap(find.text('ITA LX-01 Grey Tile Adhesive (20 kg Bag)'));
    await settle(tester);

    // Verify ProductDetailScreen opens in adhesive mode
    expect(find.byType(ProductDetailScreen), findsOneWidget);
    expect(find.text('In cart: 3 bags'), findsWidgets);
    expect(find.text('₹200 / Bag + Tax'), findsOneWidget);
    expect(find.text('Bag Rate'), findsOneWidget);
  });

  testWidgets('Rule 1: Quantity stepper (+/-) and remove buttons in Cart do NOT open ProductDetailScreen', (WidgetTester tester) async {
    final appState = AppStateService.instance;
    await appState.addToCart(tileProduct, quantity: 2);

    await tester.pumpWidget(
      const MaterialApp(
        home: CartScreen(),
      ),
    );
    await settle(tester);

    expect(find.text('2'), findsOneWidget);

    // Tap the '+' stepper button in Cart
    await tester.tap(find.byIcon(Icons.add));
    await settle(tester);

    // Detail screen should NOT be open
    expect(find.byType(ProductDetailScreen), findsNothing);
    expect(find.text('3'), findsOneWidget);
    expect(appState.cartItems.first.quantity, 3);

    // Tap '-' stepper button in Cart
    await tester.tap(find.byIcon(Icons.remove));
    await settle(tester);

    expect(find.byType(ProductDetailScreen), findsNothing);
    expect(find.text('2'), findsOneWidget);
    expect(appState.cartItems.first.quantity, 2);

    // Tap delete button in Cart
    await tester.tap(find.byIcon(Icons.delete_outline));
    await settle(tester);

    expect(find.byType(ProductDetailScreen), findsNothing);
    expect(appState.cartItems.isEmpty, isTrue);
  });

  testWidgets('Rule 4 & 5: Changing quantity on detail page automatically updates Cart without duplicate line', (WidgetTester tester) async {
    final appState = AppStateService.instance;
    await appState.addToCart(tileProduct, quantity: 3);

    await tester.pumpWidget(
      const MaterialApp(
        home: CartScreen(),
      ),
    );
    await settle(tester);

    // Tap item to open detail page
    await tester.tap(find.text('001-ADLINE SATUARIO'));
    await settle(tester);

    expect(find.byType(ProductDetailScreen), findsOneWidget);
    expect(find.text('In cart: 3 boxes'), findsWidgets);

    // Tap '+' on the detail screen bottom bar to increase quantity to 4
    await tester.tap(find.descendant(
      of: find.byType(ProductDetailScreen),
      matching: find.byIcon(Icons.add),
    ));
    await settle(tester);

    // Should immediately show In cart: 4 boxes and appState has updated
    expect(find.text('In cart: 4 boxes'), findsWidgets);
    expect(appState.cartItems.length, 1);
    expect(appState.cartItems.first.quantity, 4);

    // Tap 'Update Cart' button
    await tester.tap(find.text('Update Cart'));
    await settle(tester);

    // Verify still exactly 1 item in cart (no duplicate line)
    expect(appState.cartItems.length, 1);
    expect(appState.cartItems.first.quantity, 4);

    // Back button to CartScreen
    final NavigatorState navigator = tester.state(find.byType(Navigator));
    navigator.pop();
    await settle(tester);

    // Returned to CartScreen with updated quantity
    expect(find.byType(CartScreen), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
    expect(appState.cartItems.length, 1);
  });

  testWidgets('Rule 6: Inactive product opens detail screen showing "This product is currently unavailable"', (WidgetTester tester) async {
    final appState = AppStateService.instance;
    await appState.addToCart(inactiveTileProduct, quantity: 2);

    await tester.pumpWidget(
      const MaterialApp(
        home: CartScreen(),
      ),
    );
    await settle(tester);

    // Cart shows unavailable banner
    expect(find.text('This product is currently unavailable'), findsOneWidget);

    // Tap inactive product
    await tester.tap(find.text('Discontinued Porcelain Slab'));
    await settle(tester);

    // ProductDetailScreen opens with unavailable banner, no crash, no blank page
    expect(find.byType(ProductDetailScreen), findsOneWidget);
    expect(find.text('This product is currently unavailable'), findsWidgets);
    expect(find.text('Discontinued Porcelain Slab'), findsOneWidget);
  });

  testWidgets('Device compatibility: iPhone SE (375x667) renders without overflows', (WidgetTester tester) async {
    final appState = AppStateService.instance;
    await appState.addToCart(tileProduct, quantity: 2);
    await appState.addToCart(adhesiveProduct, quantity: 5);

    tester.view.physicalSize = const Size(375, 667);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    await tester.pumpWidget(
      const MaterialApp(
        home: CartScreen(),
      ),
    );
    await settle(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(CartScreen), findsOneWidget);

    // Tap adhesive to open detail screen
    await tester.tap(find.text('ITA LX-01 Grey Tile Adhesive (20 kg Bag)'));
    await settle(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(ProductDetailScreen), findsOneWidget);

    // Back navigation
    final NavigatorState navigator = tester.state(find.byType(Navigator));
    navigator.pop();
    await settle(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(CartScreen), findsOneWidget);
  });

  testWidgets('Device compatibility: Large device (430x932) renders without overflows', (WidgetTester tester) async {
    final appState = AppStateService.instance;
    await appState.addToCart(tileProduct, quantity: 2);
    await appState.addToCart(adhesiveProduct, quantity: 5);

    tester.view.physicalSize = const Size(430, 932);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    await tester.pumpWidget(
      const MaterialApp(
        home: CartScreen(),
      ),
    );
    await settle(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(CartScreen), findsOneWidget);

    // Tap adhesive to open detail screen
    await tester.tap(find.text('ITA LX-01 Grey Tile Adhesive (20 kg Bag)'));
    await settle(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(ProductDetailScreen), findsOneWidget);

    // Back navigation
    final NavigatorState navigator = tester.state(find.byType(Navigator));
    navigator.pop();
    await settle(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(CartScreen), findsOneWidget);
  });
}
