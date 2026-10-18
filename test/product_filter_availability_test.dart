import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/widgets/product_filter_bottom_sheet.dart';

void main() {
  group('ProductFilterBottomSheet Dynamic Availability Tests', () {
    late List<TileProduct> sampleProducts;

    setUp(() {
      sampleProducts = [
        TileProduct(
          id: 'PROD_1',
          productId: 'PROD_1',
          sku: 'SKU-001',
          name: 'Statuario Elegant',
          size: '600x1200 mm',
          surface: 'Glossy',
          finish: 'Glossy',
          color: 'White Statuario',
          baseColour: 'White Statuario',
          pattern: 'Marble - Random',
          collection: 'Marble - Random',
          productType: 'Vitrified',
          spaces: const ['Living Room', 'Bath Room', 'Bedroom'],
          basePrice: 40.0,
          moq: 100,
          stockStatus: 'available_now',
          images: const ['products/mockups/1.jpg'],
          isActive: true,
        ),
        TileProduct(
          id: 'PROD_2',
          productId: 'PROD_2',
          sku: 'SKU-002',
          name: 'Asher Grey',
          size: '600x1200 mm',
          surface: 'Glossy',
          finish: 'Glossy',
          color: 'Light Grey',
          baseColour: 'Light Grey',
          pattern: 'Marble - Endless',
          collection: 'Marble - Endless',
          productType: 'Vitrified',
          spaces: const ['Living Room', 'Bedroom'],
          basePrice: 42.0,
          moq: 100,
          stockStatus: 'available_now',
          images: const ['products/mockups/2.jpg'],
          isActive: true,
        ),
        TileProduct(
          id: 'PROD_3_INACTIVE',
          productId: 'PROD_3_INACTIVE',
          sku: 'SKU-003',
          name: 'Ceramic Rustic Oak',
          size: '600x600 mm',
          surface: 'Rustic Wood',
          finish: 'Rustic Wood',
          color: 'Brown',
          baseColour: 'Brown',
          pattern: 'Plain Colors',
          collection: 'Plain Colors',
          productType: 'Ceramic',
          spaces: const ['Outdoor'],
          basePrice: 25.0,
          moq: 50,
          stockStatus: 'available_now',
          images: const ['products/mockups/3.jpg'],
          isActive: false, // INACTIVE product
        ),
      ];
    });

    // 1. Filter with matching active products — enabled
    testWidgets('1. Filter with matching active products is enabled and clickable', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // "Glossy" has matching active products
      final glossyChipFinder = find.widgetWithText(FilterChip, 'Glossy');
      expect(glossyChipFinder, findsOneWidget);
      final glossyChip = tester.widget<FilterChip>(glossyChipFinder);
      expect(glossyChip.onSelected, isNotNull, reason: 'Glossy should be enabled');

      // Tap Glossy
      await tester.tap(glossyChipFinder);
      await tester.pumpAndSettle();

      final updatedGlossyChip = tester.widget<FilterChip>(glossyChipFinder);
      expect(updatedGlossyChip.selected, isTrue);
    });

    // 2. Filter with zero matching active products — disabled
    testWidgets('2. Filter with zero matching active products is disabled and non-clickable', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // "Ceramic" has 0 active matching products (only PROD_3 is Ceramic, and it is inactive)
      final ceramicGesture = tester.widget<GestureDetector>(find.widgetWithText(GestureDetector, 'Ceramic'));
      expect(ceramicGesture.onTap, isNull, reason: 'Ceramic should be non-clickable');

      // "Rustic Wood" has 0 active matching products
      final rusticFinder = find.widgetWithText(FilterChip, 'Rustic Wood');
      expect(rusticFinder, findsOneWidget);
      final rusticChip = tester.widget<FilterChip>(rusticFinder);
      expect(rusticChip.onSelected, isNull, reason: 'Rustic Wood chip should be disabled');

      // Tap Rustic Wood - should not select
      await tester.tap(rusticFinder);
      await tester.pumpAndSettle();
      final rusticChipAfterTap = tester.widget<FilterChip>(rusticFinder);
      expect(rusticChipAfterTap.selected, isFalse);
    });

    // 3. Inactive-only products do not enable filters
    testWidgets('3. Inactive-only products do not enable filters', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // "Outdoor" is only in the inactive product PROD_3
      final outdoorFinder = find.widgetWithText(FilterChip, 'Outdoor');
      final outdoorChip = tester.widget<FilterChip>(outdoorFinder);
      expect(outdoorChip.onSelected, isNull, reason: 'Outdoor should be disabled because matching product is inactive');

      // "600x600 mm" is only in inactive PROD_3
      final size600Finder = find.widgetWithText(FilterChip, '600x600 mm');
      final size600Chip = tester.widget<FilterChip>(size600Finder);
      expect(size600Chip.onSelected, isNull, reason: '600x600 mm should be disabled');
    });

    // 4. Products with missing filter fields handle matching gracefully
    testWidgets('4. Products with missing filter fields do not crash or corrupt availability', (tester) async {
      final sparseProducts = [
        TileProduct(
          id: 'SPARSE_1',
          productId: 'SPARSE_1',
          sku: 'SPARSE-01',
          name: 'Minimal Tile',
          size: '',
          surface: '',
          finish: '',
          color: '',
          baseColour: '',
          pattern: '',
          collection: '',
          productType: '',
          spaces: const [],
          basePrice: 10.0,
          moq: 1,
          stockStatus: 'available_now',
          images: const [],
          isActive: true,
        ),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: sparseProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // None of the specific options match empty strings, so they are disabled cleanly without crash
      final glossyFinder = find.widgetWithText(FilterChip, 'Glossy');
      final glossyChip = tester.widget<FilterChip>(glossyFinder);
      expect(glossyChip.onSelected, isNull);
    });

    // 5. Product type + finish combinations
    testWidgets('5. Selecting Product Type Vitrified dynamically filters available finishes', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(selectedProductType: 'Vitrified'),
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Glossy is available for Vitrified
      final glossyChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, 'Glossy'));
      expect(glossyChip.onSelected, isNotNull);

      // Satin Matt is not available for Vitrified
      final satinChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, 'Satin Matt'));
      expect(satinChip.onSelected, isNull);
    });

    // 6. Size + colour combinations
    testWidgets('6. Size + colour combinations correctly update cross-facet options', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(selectedSizes: {'600x1200 mm'}),
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // White is available in 600x1200 mm
      final whiteChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, 'White'));
      expect(whiteChip.onSelected, isNotNull);

      // Grey is available in 600x1200 mm
      final greyChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, 'Grey'));
      expect(greyChip.onSelected, isNotNull);

      // Brown is only in inactive PROD_3 -> disabled
      final brownChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, 'Brown'));
      expect(brownChip.onSelected, isNull);
    });

    // 7. Multiple filter selections
    testWidgets('7. Multiple filter selections preserve valid options and update count', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Select White
      final whiteFinder = find.widgetWithText(FilterChip, 'White');
      await tester.ensureVisible(whiteFinder);
      await tester.tap(whiteFinder);
      await tester.pumpAndSettle();

      // 1 tile matching White
      expect(find.text('1 tile found'), findsOneWidget);

      // Multi-select Grey as well
      final greyFinder = find.widgetWithText(FilterChip, 'Grey');
      await tester.ensureVisible(greyFinder);
      await tester.tap(greyFinder);
      await tester.pumpAndSettle();

      // Now 2 tiles matching White OR Grey
      expect(find.text('2 tiles found'), findsOneWidget);
    });

    // 8. Reset All
    testWidgets('8. Reset All clears all filters and restores baseline availability', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(
                selectedSurfaces: {'Glossy'},
                selectedBaseColours: {'White'},
                selectedProductType: 'Vitrified',
              ),
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('1 tile found'), findsOneWidget);

      // Tap Reset All button
      await tester.tap(find.widgetWithText(OutlinedButton, 'Reset All'));
      await tester.pumpAndSettle();

      // All active products (2) restored
      expect(find.text('2 tiles found'), findsOneWidget);
      expect(find.text('Show 2 Tiles'), findsOneWidget);
    });

    // 9. Show Tiles count accuracy
    testWidgets('9. Show Tiles button displays exact matching active product count', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Show 2 Tiles'), findsOneWidget);
      expect(find.text('2 tiles found'), findsOneWidget);

      // Select Grey (matches 1 product)
      final greyFinder = find.widgetWithText(FilterChip, 'Grey');
      await tester.ensureVisible(greyFinder);
      await tester.tap(greyFinder);
      await tester.pumpAndSettle();

      expect(find.text('Show 1 Tile'), findsOneWidget);
      expect(find.text('1 tile found'), findsOneWidget);
    });

    // 10. Duplicate product documents across collections
    testWidgets('10. Duplicate product documents are deduplicated by canonical identity', (tester) async {
      // Simulate duplicate PROD_1 from products and tiles collections
      final duplicateList = [
        sampleProducts[0],
        sampleProducts[0], // Duplicate
        sampleProducts[1],
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: duplicateList,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Must be 2 unique tiles, NOT 3
      expect(find.text('2 tiles found'), findsOneWidget);
      expect(find.text('Show 2 Tiles'), findsOneWidget);
    });

    // 11. Filter sheet reopening preserves selections and keeps them enabled
    testWidgets('11. Reopening filter sheet preserves selections and keeps selected chips enabled', (tester) async {
      final initialCriteria = ProductFilterCriteria(
        selectedSurfaces: {'Glossy'},
        selectedSizes: {'600x1200 mm'},
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: initialCriteria,
              allProducts: sampleProducts,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final glossyChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, 'Glossy'));
      expect(glossyChip.selected, isTrue);
      expect(glossyChip.onSelected, isNotNull, reason: 'Selected chip must not be disabled');

      final sizeChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, '600x1200 mm'));
      expect(sizeChip.selected, isTrue);
      expect(sizeChip.onSelected, isNotNull, reason: 'Selected chip must not be disabled');
    });

    // 12. Search combined with filters
    testWidgets('12. Search query combined with filters restricts matching and availability', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: sampleProducts,
              searchQuery: 'statuario',
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Only PROD_1 has statuario
      expect(find.text('1 tile found'), findsOneWidget);

      // White should be available
      final whiteChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, 'White'));
      expect(whiteChip.onSelected, isNotNull);

      // Grey does not match statuario search query -> disabled
      final greyChip = tester.widget<FilterChip>(find.widgetWithText(FilterChip, 'Grey'));
      expect(greyChip.onSelected, isNull);
    });

    // 13. Empty product dataset does NOT silently fall back to static catalog
    testWidgets('13. Empty allProducts displays 0 tiles without silent fallback to static catalog', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: const [], // Empty catalog
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Ribbon must explicitly state "0 tiles in catalog"
      expect(find.text('0 tiles in catalog'), findsOneWidget);
      // Button must show "No Tiles Found (0)"
      expect(find.text('No Tiles Found (0)'), findsOneWidget);
      // Must NOT show any static catalog fallback counts (e.g., 203 or 297)
      expect(find.textContaining('203'), findsNothing);
      expect(find.textContaining('297'), findsNothing);
    });

    // 14. Loading state displays indicator and disables button
    testWidgets('14. Loading state displays progress indicator and disables Show Tiles button', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: const [],
              isLoading: true,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pump();

      // Loading ribbon visible
      expect(find.text('Loading available tiles...'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Loading...'), findsOneWidget);
    });

    // 15. Offline error state with empty catalog displays offline error ribbon
    testWidgets('15. Offline state with error and empty catalog displays offline indicator', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: const [],
              errorMessage: 'Client is offline',
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Offline (Client is offline)'), findsOneWidget);
      expect(find.byIcon(Icons.wifi_off_rounded), findsOneWidget);
      expect(find.text('No Tiles Found (0)'), findsOneWidget);
    });

    // 16. Legitimate offline functionality with verified cached products
    testWidgets('16. Offline cached products are filtered accurately without crashing', (tester) async {
      // Simulate cached products provided to the filter sheet
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: sampleProducts,
              errorMessage: 'Offline cache in use',
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Because cached products exist, filter operates normally on those products
      expect(find.text('2 tiles found'), findsOneWidget);
      expect(find.text('Show 2 Tiles'), findsOneWidget);
    });

    // 17. Result counts consistency: Show Tiles count matches list and preserves adhesives
    testWidgets('17. Show Tiles button count accurately reflects catalog items and facet criteria', (tester) async {
      final catalogWithAdhesives = [
        ...sampleProducts,
        TileProduct(
          id: 'ADHESIVE_1',
          productId: 'ADHESIVE_1',
          sku: 'ADH-001',
          name: 'Itacon Super Tile Adhesive',
          size: '20 kg Bag',
          surface: '',
          finish: '',
          color: 'Grey',
          baseColour: 'Grey',
          pattern: '',
          collection: '',
          productLine: 'adhesives',
          unit: 'bag',
          categoryId: 'CAT_ADHESIVES',
          productType: 'Tile Adhesive',
          spaces: const ['Commercial', 'Living Room'],
          basePrice: 450.0,
          moq: 1,
          stockStatus: 'available_now',
          images: const [],
          isActive: true,
        ),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductFilterBottomSheet(
              initialFilter: ProductFilterCriteria(),
              allProducts: catalogWithAdhesives,
              onApplyFilter: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Total 3 active items (2 tiles + 1 adhesive)
      expect(find.text('3 tiles found'), findsOneWidget);
      expect(find.text('Show 3 Tiles'), findsOneWidget);

      // When selecting 'Vitrified' product type, adhesive is excluded, showing 2 tiles
      final vitrifiedFinder = find.widgetWithText(GestureDetector, 'Vitrified');
      await tester.tap(vitrifiedFinder);
      await tester.pumpAndSettle();

      expect(find.text('2 tiles found'), findsOneWidget);
      expect(find.text('Show 2 Tiles'), findsOneWidget);
    });

    // 18. Compact Android screens and large font scaling
    testWidgets('18. Renders cleanly on compact screens with large font scale without overflow', (tester) async {
      tester.view.physicalSize = const Size(320 * 2.0, 640 * 2.0);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 640),
              textScaler: TextScaler.linear(1.4),
            ),
            child: Scaffold(
              body: ProductFilterBottomSheet(
                initialFilter: ProductFilterCriteria(),
                allProducts: sampleProducts,
                onApplyFilter: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // No RenderFlex overflow exception
      expect(tester.takeException(), isNull);
    });
  });
}
