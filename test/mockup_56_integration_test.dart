import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/services/storage_image_service.dart';

void main() {
  group('56 Verified Product Mockups Integration Test', () {
    test('Representative product 1: DYNA GREY (Unusual trailing underscore)', () {
      final product = TileProduct(
        id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_105',
        sku: 'VIT-60120-8.50-GLO-MAR-WHIT-105',
        name: 'DYNA GREY',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'Grey',
        pattern: 'Marble',
        basePrice: 120.0,
        moq: 50,
        stockStatus: 'available_now',
        images: ['products/tiles/DYNA GREY.jpeg'],
        mockupImages: ['products/mockups/DYNA GREY_.jpg'],
      );

      expect(product.mockupImages, contains('products/mockups/DYNA GREY_.jpg'));
      expect(product.resolvedMockupImages.first, equals('products/mockups/DYNA GREY_.jpg'));
      expect(product.frontCardImage, equals('products/mockups/DYNA GREY_.jpg'));
      expect(
        StorageImageService.thumbnailPathFromOriginal(product.frontCardImage),
        equals('products/thumbnails/mockups/DYNA GREY_.webp'),
      );
    });

    test('Representative product 2: SHG HARVEST GREY (Hyphenated prefix)', () {
      final product = TileProduct(
        id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_175',
        sku: 'VIT-60120-8.50-GLO-MAR-WHIT-175',
        name: 'SHG HARVEST GREY',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'Grey',
        pattern: 'Marble',
        basePrice: 120.0,
        moq: 50,
        stockStatus: 'available_now',
        images: ['products/tiles/SHG-HARVEST GREY.jpeg'],
        mockupImages: ['products/mockups/SHG-HARVEST GREY.jpg'],
      );

      expect(product.resolvedMockupImages.first, equals('products/mockups/SHG-HARVEST GREY.jpg'));
      expect(
        StorageImageService.thumbnailPathFromOriginal(product.frontCardImage),
        equals('products/thumbnails/mockups/SHG-HARVEST GREY.webp'),
      );
    });

    test('Representative product 3: SHG_PLAZMA BROWN (Underscore design, hyphen file)', () {
      final product = TileProduct(
        id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_178',
        sku: 'VIT-60120-8.50-GLO-MAR-WHIT-178',
        name: 'SHG_PLAZMA BROWN',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'Brown',
        pattern: 'Marble',
        basePrice: 120.0,
        moq: 50,
        stockStatus: 'available_now',
        images: ['products/tiles/SHG-PLAZMA BROWN.jpeg'],
        mockupImages: ['products/mockups/SHG-PLAZMA BROWN.jpg'],
      );

      expect(product.resolvedMockupImages.first, equals('products/mockups/SHG-PLAZMA BROWN.jpg'));
      expect(
        StorageImageService.thumbnailPathFromOriginal(product.frontCardImage),
        equals('products/thumbnails/mockups/SHG-PLAZMA BROWN.webp'),
      );
    });

    test('Representative product 4: ANLAYA (Standard single word)', () {
      final product = TileProduct(
        id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_076',
        sku: 'VIT-60120-8.50-GLO-MAR-WHIT-076',
        name: 'ANLAYA',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Marble',
        basePrice: 120.0,
        moq: 50,
        stockStatus: 'available_now',
        images: ['products/tiles/ANLAYA.jpeg'],
        mockupImages: ['products/mockups/ANLAYA.jpg'],
      );

      expect(product.resolvedMockupImages.first, equals('products/mockups/ANLAYA.jpg'));
      expect(
        StorageImageService.thumbnailPathFromOriginal(product.frontCardImage),
        equals('products/thumbnails/mockups/ANLAYA.webp'),
      );
    });

    test('Representative product 5: DAKOTA BEIGE (Spaced design name)', () {
      final product = TileProduct(
        id: 'PROD_VIT_60120_8_50_GLO_MAR_WHIT_099',
        sku: 'VIT-60120-8.50-GLO-MAR-WHIT-099',
        name: 'DAKOTA BEIGE',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'Beige',
        pattern: 'Marble',
        basePrice: 120.0,
        moq: 50,
        stockStatus: 'available_now',
        images: ['products/tiles/DAKOTA BEIGE.jpeg'],
        mockupImages: ['products/mockups/DAKOTA BEIGE.jpg'],
      );

      expect(product.resolvedMockupImages.first, equals('products/mockups/DAKOTA BEIGE.jpg'));
      expect(
        StorageImageService.thumbnailPathFromOriginal(product.frontCardImage),
        equals('products/thumbnails/mockups/DAKOTA BEIGE.webp'),
      );
    });

    test('Fallback safety: Product without mockup does not break and preserves tile view', () {
      final productWithoutMockup = TileProduct(
        id: 'PROD_WITHOUT_MOCKUP_01',
        sku: 'ITA-NO-MOCKUP-001',
        name: 'Plain White Vitrified',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Plain',
        basePrice: 100.0,
        moq: 50,
        stockStatus: 'available_now',
        images: ['products/tiles/plain.jpeg'],
      );

      expect(productWithoutMockup.mockupImages, isNull);
      expect(productWithoutMockup.resolvedFaceImages, contains('products/tiles/plain.jpeg'));
      // When mockup is requested, falls back safely to tile face image or default
      expect(productWithoutMockup.resolvedMockupImages.isNotEmpty, isTrue);
    });
  });
}
