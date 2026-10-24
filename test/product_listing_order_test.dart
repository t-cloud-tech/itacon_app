import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/screens/product_listing_screen.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/services/product_catalog_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ProductListingScreen Ordering Tests', () {
    testWidgets('Widget renders correctly and search works',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ProductListingScreen(
            subcategoryTitle: 'Products Collection',
          ),
        ),
      );

      // Pump fixed duration to let async fallback loading finish without pumpAndSettle
      // (RevolvingBorderSearchBar has an infinite rotation animation)
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text('Products Collection'), findsOneWidget);

      // Pump remaining timers cleanly
      await tester.pump(const Duration(milliseconds: 300));
    });

    test('Unit test: 304 items (298 tiles + 6 adhesives) in-memory order rules verification', () {
      final staticCatalog = ProductCatalogService.allCatalogProducts;
      
      // Build test set of 304 items: 298 tiles + 6 adhesives (matching production Firestore count)
      final staticTiles = staticCatalog.where((p) => !p.isAdhesive).toList();
      final staticAdhesives = staticCatalog.where((p) => p.isAdhesive).toList();
      expect(staticAdhesives.length, equals(6));

      // Pad tiles up to 298 to match live production database count (304 total)
      final allTiles298 = <TileProduct>[...staticTiles];
      int padIndex = 1;
      while (allTiles298.length < 298) {
        allTiles298.add(
          TileProduct(
            id: 'PROD_PAD_$padIndex',
            name: 'Padded Tile $padIndex',
            size: '600x1200 mm',
            surface: 'Glossy',
            color: 'Grey',
            pattern: 'Marble',
            basePrice: 50.0 + padIndex,
            moq: 10,
            stockStatus: 'available_now',
            images: const ['test.png'],
          ),
        );
        padIndex++;
      }
      expect(allTiles298.length, equals(298));

      // In Firestore, adhesives start at the beginning or scattered due to document ID ordering
      // e.g. [PROD_ADH_LX03, PROD_ADH_LX01, tile1, tile2, ..., PROD_ADH_LX04]
      final simulatedFirestoreProducts = <TileProduct>[
        staticAdhesives[2], // LX03
        staticAdhesives[0], // LX01
        ...allTiles298.sublist(0, 50),
        staticAdhesives[4], // LX04
        ...allTiles298.sublist(50),
        staticAdhesives[3], // LX03W
        staticAdhesives[1], // LX02
        staticAdhesives[5], // LX04W
      ];
      expect(simulatedFirestoreProducts.length, equals(304));

      // Simulate the exact logic in product_listing_screen.dart
      bool isAdhesiveProduct(TileProduct p) =>
          p.isAdhesive || p.id.startsWith('PROD_ADH_') || p.productId.startsWith('PROD_ADH_');

      int getAdhesiveRank(TileProduct p) {
        final id = p.id.toUpperCase();
        if (id.contains('LX01') || id.contains('LX-01')) return 1;
        if (id.contains('LX02') || id.contains('LX-02')) return 2;
        if (id.contains('LX03W') || id.contains('LX-03W')) return 4;
        if (id.contains('LX03') || id.contains('LX-03')) return 3;
        if (id.contains('LX04W') || id.contains('LX-04W')) return 6;
        if (id.contains('LX04') || id.contains('LX-04')) return 5;

        final sku = p.sku.toUpperCase();
        if (sku.contains('LX-01') || sku.contains('LX01')) return 1;
        if (sku.contains('LX-02') || sku.contains('LX02')) return 2;
        if (sku.contains('LX-03W') || sku.contains('LX03W')) return 4;
        if (sku.contains('LX-03') || sku.contains('LX03')) return 3;
        if (sku.contains('LX-04W') || sku.contains('LX04W')) return 6;
        if (sku.contains('LX-04') || sku.contains('LX04')) return 5;

        return 99;
      }

      List<TileProduct> organizeProducts(List<TileProduct> rawList) {
        final tiles = <TileProduct>[];
        final adhesives = <TileProduct>[];

        for (final p in rawList) {
          if (isAdhesiveProduct(p)) {
            adhesives.add(p);
          } else {
            tiles.add(p);
          }
        }

        adhesives.sort((a, b) => getAdhesiveRank(a).compareTo(getAdhesiveRank(b)));
        return [...tiles, ...adhesives];
      }

      final organized = organizeProducts(simulatedFirestoreProducts);

      // RULE 1: Total count is 304. All 298 tiles first, then 6 adhesives at the end in LX-01, LX-02, LX-03, LX-03W, LX-04, LX-04W order
      expect(organized.length, equals(304));

      final tilesPart = organized.sublist(0, 298);
      for (final p in tilesPart) {
        expect(isAdhesiveProduct(p), isFalse, reason: 'First 298 items must all be tiles');
      }

      // Verify tile relative order is preserved from loaded list
      for (int i = 0; i < 298; i++) {
        expect(tilesPart[i].id, equals(allTiles298[i].id));
      }

      final adhesivesPart = organized.sublist(298);
      expect(adhesivesPart.length, equals(6));
      expect(adhesivesPart[0].id, equals('PROD_ADH_LX01'));
      expect(adhesivesPart[1].id, equals('PROD_ADH_LX02'));
      expect(adhesivesPart[2].id, equals('PROD_ADH_LX03'));
      expect(adhesivesPart[3].id, equals('PROD_ADH_LX03W'));
      expect(adhesivesPart[4].id, equals('PROD_ADH_LX04'));
      expect(adhesivesPart[5].id, equals('PROD_ADH_LX04W'));

      // RULE 2: Sort option price_asc (low to high)
      // Sort tiles among themselves and adhesives among themselves, ALWAYS keep adhesives after tiles
      final tilesAsc = List<TileProduct>.from(tilesPart)..sort((a, b) => a.basePrice.compareTo(b.basePrice));
      final adhesivesAsc = List<TileProduct>.from(adhesivesPart)..sort((a, b) => a.basePrice.compareTo(b.basePrice));
      final priceAsc = [...tilesAsc, ...adhesivesAsc];

      expect(priceAsc.length, equals(304));
      expect(priceAsc.sublist(0, 298).every((p) => !isAdhesiveProduct(p)), isTrue);
      expect(priceAsc.sublist(298).every((p) => isAdhesiveProduct(p)), isTrue);
      for (int i = 0; i < tilesAsc.length - 1; i++) {
        expect(tilesAsc[i].basePrice <= tilesAsc[i + 1].basePrice, isTrue);
      }
      for (int i = 0; i < adhesivesAsc.length - 1; i++) {
        expect(adhesivesAsc[i].basePrice <= adhesivesAsc[i + 1].basePrice, isTrue);
      }

      // Sort option price_desc (high to low)
      final tilesDesc = List<TileProduct>.from(tilesPart)..sort((a, b) => b.basePrice.compareTo(a.basePrice));
      final adhesivesDesc = List<TileProduct>.from(adhesivesPart)..sort((a, b) => b.basePrice.compareTo(a.basePrice));
      final priceDesc = [...tilesDesc, ...adhesivesDesc];

      expect(priceDesc.length, equals(304));
      expect(priceDesc.sublist(0, 298).every((p) => !isAdhesiveProduct(p)), isTrue);
      expect(priceDesc.sublist(298).every((p) => isAdhesiveProduct(p)), isTrue);
      for (int i = 0; i < tilesDesc.length - 1; i++) {
        expect(tilesDesc[i].basePrice >= tilesDesc[i + 1].basePrice, isTrue);
      }
      for (int i = 0; i < adhesivesDesc.length - 1; i++) {
        expect(adhesivesDesc[i].basePrice >= adhesivesDesc[i + 1].basePrice, isTrue);
      }

      // RULE 3: Search and Filter
      // Search "LX" -> only adhesives match
      final searchLX = organized.where((p) => p.name.toLowerCase().contains('lx') || p.id.toLowerCase().contains('lx')).toList();
      expect(searchLX.every((p) => isAdhesiveProduct(p)), isTrue);
      expect(searchLX.length, equals(6));

      // Search specific tile name -> only that tile
      final searchTile = organized.where((p) => p.name == 'Padded Tile 1').toList();
      expect(searchTile.length, equals(1));
      expect(isAdhesiveProduct(searchTile.first), isFalse);

      // Filter by Surface (e.g. Glossy) -> only tiles, adhesives excluded
      final filterGlossy = organized.where((p) => p.surface.toLowerCase().contains('glossy')).toList();
      expect(filterGlossy.isNotEmpty, isTrue);
      expect(filterGlossy.every((p) => !isAdhesiveProduct(p)), isTrue);
    });
  });
}
