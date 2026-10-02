import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/services/storage_image_service.dart';
import 'package:itacon_app/services/product_catalog_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Mockup Cache Invalidation & Path Integrity Tests', () {
    test('mockupCacheVersion is centralized and equals 3', () {
      expect(StorageImageService.mockupCacheVersion, '3');
    });

    test('Mock-up full images receive mockup-v3 cache key', () {
      const mockupPath = 'products/mockups/HARVEST BIANCO.jpg';
      final cacheKey = StorageImageService.getCacheKey(mockupPath);
      expect(cacheKey, 'products/mockups/HARVEST BIANCO.jpg::mockup-v3');
    });

    test('Mock-up WebP thumbnails receive mockup-v3 cache key', () {
      const thumbPath = 'products/thumbnails/mockups/HARVEST BIANCO.webp';
      final cacheKey = StorageImageService.getCacheKey(thumbPath);
      expect(cacheKey, 'products/thumbnails/mockups/HARVEST BIANCO.webp::mockup-v3');
    });

    test('Tile-face images do NOT receive mockup cache version (cache key unchanged)', () {
      const tilePath = 'products/tiles/VIT-60120-8.50-GLO-MAR-WHIT-124_face1.jpg';
      final cacheKey = StorageImageService.getCacheKey(tilePath);
      expect(cacheKey, 'products/tiles/VIT-60120-8.50-GLO-MAR-WHIT-124_face1.jpg');
      expect(cacheKey.contains('mockup-v'), isFalse);
    });

    test('Tile-face thumbnails do NOT receive mockup cache version', () {
      const tileThumb = 'products/thumbnails/tiles/VIT-60120-8.50-GLO-MAR-WHIT-124_face1.webp';
      final cacheKey = StorageImageService.getCacheKey(tileThumb);
      expect(cacheKey, 'products/thumbnails/tiles/VIT-60120-8.50-GLO-MAR-WHIT-124_face1.webp');
      expect(cacheKey.contains('mockup-v'), isFalse);
    });

    test('Adhesive images do NOT receive mockup cache version (cache key unchanged)', () {
      const adhesivePath = 'products/adhesives/ITA-LX-01.png';
      final cacheKey = StorageImageService.getCacheKey(adhesivePath);
      expect(cacheKey, 'products/adhesives/ITA-LX-01.png');
      expect(cacheKey.contains('mockup-v'), isFalse);
    });

    test('Adhesive thumbnails do NOT receive mockup cache version', () {
      const adhesiveThumb = 'products/thumbnails/adhesives/ITA-LX-01.webp';
      final cacheKey = StorageImageService.getCacheKey(adhesiveThumb);
      expect(cacheKey, 'products/thumbnails/adhesives/ITA-LX-01.webp');
      expect(cacheKey.contains('mockup-v'), isFalse);
    });

    test('Storage path normalization remains unchanged and clean', () {
      const rawMockup = 'gs://itacon-app.firebasestorage.app/products/mockups/SHG HARVEST GREY.jpg';
      final normalized = StorageImageService.normalizeStoragePath(rawMockup);
      expect(normalized, 'products/mockups/SHG HARVEST GREY.jpg');
      expect(normalized.contains('mockup-v'), isFalse);
    });

    test('Thumbnail mapping from original mock-up remains unchanged', () {
      const orig = 'products/mockups/HARVEST BIANCO.jpg';
      final thumb = StorageImageService.thumbnailPathFromOriginal(orig);
      expect(thumb, 'products/thumbnails/mockups/HARVEST BIANCO.webp');
    });

    test('Catalog products resolve mockup images and thumbnails without alterations to Storage paths', () {
      final products = ProductCatalogService.allCatalogProducts;
      for (final p in products) {
        if (p.mockupImages != null && p.mockupImages!.isNotEmpty) {
          for (final m in p.mockupImages!) {
            expect(m.startsWith('products/mockups/'), isTrue,
                reason: '${p.sku} mockup image must be in products/mockups/');
            expect(StorageImageService.isMockupPath(m), isTrue);
          }
        }
      }
    });
  });
}
