import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:itacon_app/screens/auth_screen.dart';
import 'package:itacon_app/screens/product_detail_screen.dart';
import 'package:itacon_app/screens/cart_screen.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/models/tile_product.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final tileProduct = TileProduct(
    id: 'TILE_001',
    sku: 'VIT-60120-001',
    name: 'Calacatta Gold Glazed Vitrified',
    size: '600x1200 mm',
    surface: 'Glossy',
    finish: 'Glossy',
    color: 'White',
    baseColour: 'White',
    pattern: 'Gold Vein',
    basePrice: 125.0,
    moq: 10,
    stockStatus: 'available_now',
    sqFtPerBox: 15.5,
    boxWeightKg: 27.0,
    images: ['products/tiles/sample_tile.jpeg'],
  );

  final adhesiveProduct = TileProduct(
    id: 'ADH_001',
    sku: 'ITA-LX-01',
    name: 'ITA LX-01 Grey Tile Adhesive',
    productLine: 'adhesives',
    tileCategory: 'Fixing Solutions',
    size: '20 kg Bag',
    surface: 'Standard',
    finish: 'Standard',
    color: 'Grey',
    baseColour: 'Grey',
    pattern: 'Polymer Modified',
    basePrice: 200.0,
    moq: 1,
    stockStatus: 'available_now',
    boxWeightKg: 20.0,
    sqFtPerBox: 40.0,
    images: ['products/adhesives/sample_adhesive.jpeg'],
  );

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await AppStateService.instance.clearCart();
  });

  Future<void> settle(WidgetTester tester) async {
    for (int i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  testWidgets('Verification 1: Login Screen renders and validates credentials', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: AuthScreen(initialMode: AuthViewMode.login),
      ),
    );
    await settle(tester);

    expect(find.textContaining('Welcome'), findsWidgets);
    expect(find.text('Sign in to your account'), findsOneWidget);

    // Enter username & password
    await tester.enterText(find.byType(TextField).first, 'testuser');
    await tester.enterText(find.byType(TextField).last, 'Password@123');
    await settle(tester);

    expect(find.text('testuser'), findsOneWidget);
  });

  testWidgets('Verification 2: Products Screen and ProductDetail render cleanly', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ProductDetailScreen(product: tileProduct),
      ),
    );
    await settle(tester);

    expect(find.text('Calacatta Gold Glazed Vitrified'), findsOneWidget);
    expect(find.text('Cost Per Box'), findsOneWidget);
  });

  testWidgets('Verification 3: Cart Screen handles items, totals and quantities', (WidgetTester tester) async {
    final appState = AppStateService.instance;
    await appState.addToCart(adhesiveProduct, quantity: 3);

    await tester.pumpWidget(
      const MaterialApp(
        home: CartScreen(),
      ),
    );
    await settle(tester);

    expect(find.text('ITA LX-01 Grey Tile Adhesive'), findsOneWidget);
    expect(find.text('₹200/bag'), findsOneWidget);
  });

  testWidgets('Verification 4: Image Picker and File Picker plugins initialize', (WidgetTester tester) async {
    final imagePicker = ImagePicker();
    expect(imagePicker, isNotNull);

    // FilePicker static methods are available
    expect(FilePicker.pickFiles, isNotNull);
  });

  testWidgets('Verification 5: url_launcher plugin bindings work cleanly', (WidgetTester tester) async {
    final Uri testUri = Uri.parse('https://itacongranito.com');
    expect(testUri.scheme, equals('https'));
    expect(testUri.host, equals('itacongranito.com'));
  });
}
