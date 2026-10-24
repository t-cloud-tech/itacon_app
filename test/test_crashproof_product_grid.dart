import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/widgets/adhesive_card.dart';
import 'package:itacon_app/widgets/app_product_image.dart';

void main() {
  group('Crash-Proof Products Collection & Home Grid Tests', () {
    testWidgets('1. Real 303 products render cleanly without unbounded flex or null errors', (WidgetTester tester) async {
      final backupFile = File('scripts/backup/products_backup_20261023.json');
      final jsonStr = backupFile.readAsStringSync();
      final Map<String, dynamic> rawMap = jsonDecode(jsonStr);

      final List<TileProduct> products = [];
      rawMap.forEach((docId, docData) {
        products.add(TileProduct.fromMap(Map<String, dynamic>.from(docData as Map), docId));
      });

      expect(products.length, 303);

      final originalOnError = FlutterError.onError;
      final List<dynamic> caughtErrors = [];
      FlutterError.onError = (FlutterErrorDetails details) {
        caughtErrors.add(details.exception);
      };

      try {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: MasonryGridView.count(
                crossAxisCount: 2,
                itemCount: products.length,
                itemBuilder: (context, index) {
                  final product = products[index];
                  if (product.isAdhesive) {
                    return AdhesiveCard(product: product);
                  }
                  return Container(
                    height: 220,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      children: [
                        AspectRatio(
                          aspectRatio: 1.0,
                          child: AppProductImage(
                            imagePath: product.frontCardThumbnail,
                            originalPath: product.frontCardImage,
                            imageRole: ImageRole.collectionThumbnail,
                          ),
                        ),
                        Text(product.name),
                        Text(product.size),
                        Text(product.basePrice <= 0 ? 'Price on request' : '₹${product.basePrice}'),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        );

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
      } finally {
        FlutterError.onError = originalOnError;
      }

      expect(caughtErrors, isEmpty, reason: 'Expected 0 layout or rendering errors across all 303 products');
    });

    testWidgets('2. Malformed test doc (price "abc", empty images, null name/size) handles safely with no crash', (WidgetTester tester) async {
      final malformedDoc = <String, dynamic>{
        'id': 'TEST_MALFORMED_DOC_001',
        'name': null,
        'size': null,
        'price': 'abc',
        'basePrice': 'abc',
        'images': <String>[],
        'isActive': true,
      };

      final product = TileProduct.fromMap(malformedDoc, 'TEST_MALFORMED_DOC_001');

      expect(product.basePrice, 0.0);
      expect(product.name, isNotNull);
      expect(product.size, isNotNull);
      expect(product.frontCardImage, '');
      expect(product.frontCardThumbnail, '');

      final originalOnError = FlutterError.onError;
      final List<dynamic> caughtErrors = [];
      FlutterError.onError = (FlutterErrorDetails details) {
        caughtErrors.add(details.exception);
      };

      try {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: MasonryGridView.count(
                crossAxisCount: 2,
                itemCount: 1,
                itemBuilder: (context, index) {
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AspectRatio(
                        aspectRatio: 1.0,
                        child: AppProductImage(
                          imagePath: product.frontCardThumbnail,
                          originalPath: product.frontCardImage,
                          imageRole: ImageRole.collectionThumbnail,
                        ),
                      ),
                      Text(product.name.isEmpty ? 'Unnamed Product' : product.name),
                      Text(product.size.isEmpty ? 'Standard' : product.size),
                      Text(product.basePrice <= 0 ? 'Price on request' : '₹${product.basePrice}'),
                    ],
                  );
                },
              ),
            ),
          ),
        );

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
      } finally {
        FlutterError.onError = originalOnError;
      }

      expect(caughtErrors, isEmpty, reason: 'Malformed doc must render cleanly without crash');
      expect(find.text('Price on request'), findsOneWidget);
    });
  });
}
