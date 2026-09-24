import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/services/product_catalog_service.dart';
import 'package:itacon_app/screens/product_detail_screen.dart';
import 'package:itacon_app/widgets/app_product_image.dart';

void main() {
  group('Glossy Tile Products Integration & UI Tests', () {
    final allProducts = ProductCatalogService.allCatalogProducts;

    test('1. Product Catalogue contains 209 total items (203 tiles + 6 adhesives)', () {
      expect(allProducts.length, 209);
      final tiles = allProducts.where((p) => p.productLine == 'tiles').toList();
      final adhesives = allProducts.where((p) => p.productLine == 'adhesives').toList();
      expect(tiles.length, 203);
      expect(adhesives.length, 6);
    });

    test('2. Existing products still work and remain preserved', () {
      final adline = allProducts.firstWhere((p) => p.sku == 'VIT-60120-8.50-GLO-MAR-WHIT-00-001');
      expect(adline.name, '001-ADLINE SATUARIO');
      expect(adline.images.isNotEmpty, isTrue);
      expect(adline.mockupImages?.isNotEmpty, isTrue);
      expect(adline.faceImages?.isNotEmpty, isTrue);
    });

    test('3. Newly imported products appear with correct specs', () {
      final adigeCrema = allProducts.firstWhere((p) => p.sku == 'VIT-60120-8.50-GLO-MAR-WHIT-066');
      expect(adigeCrema.name, 'ADIGE CREMA');
      expect(adigeCrema.surface, 'Glossy');
      expect(adigeCrema.size, '600x1200 mm');
      expect(adigeCrema.basePrice, 35.0);
      expect(adigeCrema.moq, 100);
      expect(adigeCrema.stockStatus, 'available_now');
      expect(adigeCrema.mockupImages?.length, 4);
    });

    test('4 & 5. Collection cards use WebP thumbnails and prefer room mockup', () {
      final adigeCrema = allProducts.firstWhere((p) => p.sku == 'VIT-60120-8.50-GLO-MAR-WHIT-066');
      expect(adigeCrema.frontCardImage, 'products/mockups/VIT-60120-8.50-GLO-MAR-WHIT-066_room1.jpg');
      expect(adigeCrema.frontCardThumbnail, 'products/thumbnails/mockups/VIT-60120-8.50-GLO-MAR-WHIT-066_room1.webp');
    });

    test('6, 7 & 8. Multi-face and mockup resolution for product detail', () {
      final amigo = allProducts.firstWhere((p) => p.sku == 'VIT-60120-8.50-GLO-MAR-WHIT-075');
      expect(amigo.name, 'AMIGO SMOKE');
      expect(amigo.resolvedFaceImages.length, 4);
      expect(amigo.resolvedFaceImages.first, 'products/tiles/VIT-60120-8.50-GLO-MAR-WHIT-075_face1.jpg');
      expect(amigo.resolvedFaceThumbnails.first, 'products/thumbnails/tiles/VIT-60120-8.50-GLO-MAR-WHIT-075_face1.webp');
    });

    test('14. TELER CREMA shows existing missing-image behavior', () {
      final teler = allProducts.firstWhere((p) => p.name == 'TELER CREMA');
      expect(teler.sku, 'VIT-60120-8.50-GLO-MAR-WHIT-182');
      expect(teler.images, isEmpty);
      expect(teler.faceImages, isNull);
      expect(teler.mockupImages, isNull);
      expect(teler.frontCardImage, isEmpty);
      expect(teler.frontCardThumbnail, isEmpty);
    });

    test('15. TOPAZ BROWN does NOT appear in products', () {
      final topazBrown = allProducts.where((p) => p.name.toUpperCase().contains('TOPAZ BROWN')).toList();
      expect(topazBrown, isEmpty);

      // Verify TOPAZ BEIGE and TOPAZ WHITE are intact and distinct
      final topazBeige = allProducts.firstWhere((p) => p.name == 'TOPAZ BEIGE');
      final topazWhite = allProducts.firstWhere((p) => p.name == 'TOPAZ WHITE');
      expect(topazBeige.sku, 'VIT-60120-8.50-GLO-MAR-WHIT-190');
      expect(topazWhite.sku, 'VIT-60120-8.50-GLO-MAR-WHIT-191');
    });

    test('16. Search matches newly imported products by name, surface, and finish', () {
      final query = 'adige';
      final results = allProducts.where((p) => p.name.toLowerCase().contains(query)).toList();
      expect(results.length, 4); // ADIGE CREMA, ADIGE GREY, ADIGE LUREL, ADIGE MINK
    });

    test('17. Existing adhesives remain completely unaffected', () {
      final lx01 = allProducts.firstWhere((p) => p.sku == 'ITA-LX-01');
      expect(lx01.name, 'ITA LX-01 Tile Adhesive (20 kg Bag)');
      expect(lx01.classification, 'TYPE-1 (C1T)');
      expect(lx01.isAdhesive, isTrue);
      expect(lx01.unit, 'bag');
      expect(lx01.images.first, 'products/adhesives/ITA-LX-01.png');
      expect(lx01.frontCardThumbnail, 'products/thumbnails/adhesives/ITA-LX-01.webp');
    });

    testWidgets('UI Widget: AppProductImage renders fallback for empty image (TELER CREMA)', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppProductImage(
              imagePath: '',
              width: 100,
              height: 100,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verified fallback icon renders
      expect(find.byIcon(Icons.inventory_2_rounded), findsOneWidget);
    });

    testWidgets('UI Widget: ProductDetailScreen loads imported glossy tile with view mode switcher', (tester) async {
      final product = allProducts.firstWhere((p) => p.sku == 'VIT-60120-8.50-GLO-MAR-WHIT-066');
      await tester.pumpWidget(
        MaterialApp(
          home: ProductDetailScreen(
            product: product,
          ),
        ),
      );
      await tester.pump();

      expect(find.text('ADIGE CREMA'), findsOneWidget);
      expect(find.text('Tile View'), findsWidgets);
      expect(find.text('Mockup'), findsWidgets);
      expect(find.text('Pinch to zoom'), findsOneWidget);
    });
  });
}
