import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/theme/app_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    try {
      final fontFile = File(r'C:\Windows\Fonts\arial.ttf');
      if (fontFile.existsSync()) {
        final fontLoader = FontLoader('Roboto');
        fontLoader.addFont(fontFile.readAsBytes().then((b) => ByteData.view(b.buffer)));
        await fontLoader.load();
      }
    } catch (_) {}
  });

  // Helper to build the Item Card
  Widget buildItemCard({
    required bool isFixed,
    required double screenWidth,
    double textScale = 1.0,
    String productName = '001-ADLINE SATUARIO High Gloss Vitrified Tile',
    String priceTotal = '₹543',
    String unitPrice = '₹35 / sq ft',
    String sizeFinish = '600x1200 mm • Glossy',
    String qtyCoverage = '10 Boxes (155.0 sq.ft)',
  }) {
    return MediaQuery(
      data: MediaQueryData(
        size: Size(screenWidth, 800),
        textScaler: TextScaler.linear(textScale),
      ),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Container(
          width: screenWidth,
          color: const Color(0xFFF4F6F9),
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Finalized Order Items & Unit Rates (${isFixed ? "AFTER FIX" : "BEFORE FIX"} - ${screenWidth.toInt()}w)',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textDark),
              ),
              const SizedBox(height: 8),
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.black12, width: 1),
                  boxShadow: const [
                    BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2)),
                  ],
                ),
                child: Row(
                  children: [
                    // Product Thumbnail Mock
                    Container(
                      width: 55,
                      height: 55,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Center(
                        child: Icon(Icons.grid_view_rounded, color: AppTheme.primaryNavy, size: 28),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Item Details
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            productName,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            sizeFinish,
                            style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            qtyCoverage,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.primaryNavy),
                          ),
                        ],
                      ),
                    ),

                    if (isFixed) ...[
                      const SizedBox(width: 8),
                      // AFTER FIX: Hugs content, flush against card right padding (12px), right-aligned
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            priceTotal,
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.accentOrange),
                            textAlign: TextAlign.right,
                          ),
                          Text(
                            unitPrice,
                            style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                            textAlign: TextAlign.right,
                          ),
                        ],
                      ),
                    ] else ...[
                      // BEFORE FIX: Flexible wrapper with loose fit causes 50/50 Row flex split & empty gap
                      Flexible(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                priceTotal,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.accentOrange),
                              ),
                            ),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                unitPrice,
                                style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  group('Finalized Order Items UI Fix Tests', () {
    testWidgets('Capture Before and After Visual Screenshots', (WidgetTester tester) async {
      final artifactDir = Directory(r'C:\Users\ttirt\.gemini\antigravity-ide\brain\45dab46e-02ab-46c7-94bf-d1a37c9bc4ef');
      if (!artifactDir.existsSync()) {
        artifactDir.createSync(recursive: true);
      }

      final beforeKey = GlobalKey();
      final afterKey = GlobalKey();
      final compKey = GlobalKey();

      // 1. Render Before on iPhone SE (375w)
      tester.view.physicalSize = const Size(375 * 2.0, 300 * 2.0);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        RepaintBoundary(
          key: beforeKey,
          child: buildItemCard(isFixed: false, screenWidth: 375),
        ),
      );
      await tester.pumpAndSettle();

      final beforeBoundary = beforeKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final beforeImage = await beforeBoundary.toImage(pixelRatio: 2.0);
        final beforeBytes = (await beforeImage.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
        File('${artifactDir.path}/order_item_before_375.png').writeAsBytesSync(beforeBytes);
      });

      // 2. Render After on iPhone SE (375w)
      await tester.pumpWidget(
        RepaintBoundary(
          key: afterKey,
          child: buildItemCard(isFixed: true, screenWidth: 375),
        ),
      );
      await tester.pumpAndSettle();

      final afterBoundary = afterKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final afterImage = await afterBoundary.toImage(pixelRatio: 2.0);
        final afterBytes = (await afterImage.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
        File('${artifactDir.path}/order_item_after_375.png').writeAsBytesSync(afterBytes);
      });

      // 3. Render Comparison Board (Small 320, iPhone SE 375, Large 412, TextScale 1.3)
      tester.view.physicalSize = const Size(412 * 2.0, 800 * 2.0);
      await tester.pumpWidget(
        RepaintBoundary(
          key: compKey,
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: SingleChildScrollView(
              child: Column(
                children: [
                  buildItemCard(isFixed: false, screenWidth: 375),
                  buildItemCard(isFixed: true, screenWidth: 375),
                  buildItemCard(isFixed: true, screenWidth: 320),
                  buildItemCard(isFixed: true, screenWidth: 412),
                  buildItemCard(isFixed: true, screenWidth: 375, textScale: 1.3),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final compBoundary = compKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final compImage = await compBoundary.toImage(pixelRatio: 2.0);
        final compBytes = (await compImage.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
        File('${artifactDir.path}/order_item_comparison_all_devices.png').writeAsBytesSync(compBytes);
      });
    });

    testWidgets('Verify layout measurements: Before has wasted gap, After hugs right edge', (WidgetTester tester) async {
      const double screenWidth = 375.0;
      // Total row inner width = screenWidth - 32 (screen padding) - 24 (card padding 12+12) - 2 (borders) = 317.0

      // Test BEFORE
      await tester.pumpWidget(buildItemCard(isFixed: false, screenWidth: screenWidth));
      await tester.pumpAndSettle();

      final beforeRowFinder = find.byType(Row).first;
      final beforeRowRect = tester.getRect(beforeRowFinder);
      final beforePriceFinder = find.text('₹543');
      final beforePriceRect = tester.getRect(beforePriceFinder);

      final double beforeGapToRight = beforeRowRect.right - beforePriceRect.right;
      // In BEFORE, there is a large gap between price right and Row right edge
      expect(beforeGapToRight, greaterThan(40.0), reason: 'Before fix must exhibit the wasted gap');

      // Test AFTER
      await tester.pumpWidget(buildItemCard(isFixed: true, screenWidth: screenWidth));
      await tester.pumpAndSettle();

      final afterRowFinder = find.byType(Row).first;
      final afterRowRect = tester.getRect(afterRowFinder);
      final afterPriceFinder = find.text('₹543');
      final afterPriceRect = tester.getRect(afterPriceFinder);
      final afterUnitPriceFinder = find.text('₹35 / sq ft');
      final afterUnitPriceRect = tester.getRect(afterUnitPriceFinder);

      final double afterGapToRight = afterRowRect.right - afterUnitPriceRect.right;
      // In AFTER, the price column sits flush against the Row's right edge (gap == 0)
      expect(afterGapToRight, closeTo(0.0, 1.0), reason: 'After fix must sit flush with card right padding');

      // Price and unit price are right-aligned under each other
      expect(afterPriceRect.right, closeTo(afterUnitPriceRect.right, 1.0));
    });

    testWidgets('Test across Small Phone (320w), Large Phone (412w), TextScale 1.3 without overflow', (WidgetTester tester) async {
      // 1. Small phone 320w
      await tester.pumpWidget(buildItemCard(isFixed: true, screenWidth: 320));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      // 2. Large phone 412w
      await tester.pumpWidget(buildItemCard(isFixed: true, screenWidth: 412));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      // 3. Text Scale 1.3
      await tester.pumpWidget(buildItemCard(isFixed: true, screenWidth: 375, textScale: 1.3));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      // 4. Small phone 320w with Text Scale 1.3
      await tester.pumpWidget(buildItemCard(isFixed: true, screenWidth: 320, textScale: 1.3));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
