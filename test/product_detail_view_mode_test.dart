import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/screens/product_detail_screen.dart';

void main() {
  testWidgets('ProductDetailScreen defaults to Tile View even when mockupImages are present', (WidgetTester tester) async {
    final product = TileProduct(
      id: 'PROD_TEST_01',
      name: 'Test Marble Tile',
      size: '600x1200 mm',
      surface: 'Glossy',
      color: 'White',
      pattern: 'Marble',
      basePrice: 100.0,
      moq: 10,
      stockStatus: 'available_now',
      images: [
        'assets/images/tiles/face1.jpeg',
        'assets/images/tiles/face2.jpeg',
      ],
      mockupImages: [
        'assets/images/mockups/room1.jpeg',
        'assets/images/mockups/room2.jpeg',
      ],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ProductDetailScreen(product: product),
      ),
    );
    await tester.pump();

    // Verify Tile View is the default mode
    expect(find.text('Tile View'), findsWidgets);
    expect(find.text('Mockup'), findsOneWidget);
    expect(find.text('Faces'), findsOneWidget);
    expect(find.text('See Mockup'), findsOneWidget);

    // Tap 'See Mockup' button to switch to Mockup mode
    await tester.tap(find.text('See Mockup'));
    await tester.pump();

    // Verify switched to Mockup
    expect(find.text('Rooms'), findsOneWidget);
    expect(find.text('Tile View'), findsWidgets);

    // Tap 'Tile View' pill in toggle switch to switch back
    await tester.tap(find.text('Tile View').first);
    await tester.pump();

    // Verify back in Tile View mode
    expect(find.text('Faces'), findsOneWidget);
    expect(find.text('See Mockup'), findsOneWidget);
  });
}
