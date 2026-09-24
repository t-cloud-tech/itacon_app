import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/services/product_catalog_service.dart';

void main() {
  test('All 209 products use Firebase Storage paths', () {
    final products = ProductCatalogService.allCatalogProducts;
    expect(products.length, 209);

    final invalidEntries = <String>[];

    for (final product in products) {
      // TELER CREMA intentionally has no supplied images
      if (product.sku == 'VIT-60120-8.50-GLO-MAR-WHIT-182') {
        expect(product.images, isEmpty);
        expect(product.frontCardImage, isEmpty);
        continue;
      }

      for (final img in product.images) {
        if (!img.startsWith('products/')) {
          invalidEntries.add('${product.sku} images: $img');
        }
      }
      if (product.faceImages != null) {
        for (final img in product.faceImages!) {
          if (!img.startsWith('products/')) {
            invalidEntries.add('${product.sku} faceImages: $img');
          }
        }
      }
      if (product.mockupImages != null) {
        for (final img in product.mockupImages!) {
          if (!img.startsWith('products/')) {
            invalidEntries.add('${product.sku} mockupImages: $img');
          }
        }
      }
      for (final img in product.lifestyleImages) {
        if (!img.startsWith('products/')) {
          invalidEntries.add('${product.sku} lifestyleImages: $img');
        }
      }
    }

    expect(invalidEntries, isEmpty,
        reason: 'All images must use remote Firebase Storage paths (products/...)');
  });

  test('All products map correctly to WebP thumbnail paths', () {
    final products = ProductCatalogService.allCatalogProducts;

    for (final product in products) {
      // TELER CREMA intentionally has no images
      if (product.sku == 'VIT-60120-8.50-GLO-MAR-WHIT-182') {
        expect(product.frontCardThumbnail, isEmpty);
        continue;
      }

      final thumb = product.frontCardThumbnail;
      expect(thumb.startsWith('products/thumbnails/'), isTrue,
          reason: '${product.sku} frontCardThumbnail must use products/thumbnails/... but was $thumb');
      expect(thumb.endsWith('.webp'), isTrue,
          reason: '${product.sku} thumbnail must be .webp but was $thumb');
    }
  });
}
