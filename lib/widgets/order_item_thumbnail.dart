import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../models/tile_order.dart';
import '../models/tile_product.dart';
import '../services/firestore_service.dart';
import '../services/product_catalog_service.dart';
import '../services/storage_image_service.dart';
import '../theme/app_theme.dart';
import 'app_product_image.dart';

/// Centralized service to look up and cache TileProducts by productId / sku.
/// Avoids repeated Firestore queries by checking static catalog and in-memory cache first.
class ProductLookupService {
  static final Map<String, TileProduct?> _cache = {};
  static final Map<String, Future<TileProduct?>> _inFlight = {};

  /// Synchronous cache lookup:
  /// 1. Memory cache
  /// 2. ProductCatalogService.allCatalogProducts (static preloaded catalogue)
  static TileProduct? getCachedProduct(String productId, [String? sku]) {
    final cleanId = productId.trim();
    final cleanSku = sku?.trim();

    if (cleanId.isEmpty && (cleanSku == null || cleanSku.isEmpty)) return null;

    if (cleanId.isNotEmpty && _cache.containsKey(cleanId)) {
      return _cache[cleanId];
    }
    if (cleanSku != null && cleanSku.isNotEmpty && _cache.containsKey(cleanSku)) {
      return _cache[cleanSku];
    }

    // Check static catalog (instant synchronous match in memory)
    for (final p in ProductCatalogService.allCatalogProducts) {
      final matchesId = cleanId.isNotEmpty && (p.id == cleanId || p.productId == cleanId);
      final matchesSku = cleanSku != null && cleanSku.isNotEmpty && p.sku.toLowerCase() == cleanSku.toLowerCase();

      if (matchesId || matchesSku) {
        _cache[p.id] = p;
        _cache[p.productId] = p;
        if (p.sku.isNotEmpty) _cache[p.sku] = p;
        return p;
      }
    }

    return null;
  }

  /// Asynchronous lookup with deduplicated in-flight requests and memory caching
  static Future<TileProduct?> lookupProduct(String productId, [String? sku]) async {
    final cached = getCachedProduct(productId, sku);
    if (cached != null) return cached;

    final cleanId = productId.trim();
    final cleanSku = sku?.trim();
    if (cleanId.isEmpty && (cleanSku == null || cleanSku.isEmpty)) return null;

    final key = cleanId.isNotEmpty ? cleanId : cleanSku!;
    if (_inFlight.containsKey(key)) {
      return await _inFlight[key];
    }

    final future = _fetchFromFirestore(cleanId, cleanSku);
    _inFlight[key] = future;
    try {
      final result = await future;
      _cache[key] = result;
      if (result != null) {
        _cache[result.id] = result;
        _cache[result.productId] = result;
        if (result.sku.isNotEmpty) _cache[result.sku] = result;
      }
      return result;
    } finally {
      _inFlight.remove(key);
    }
  }

  static Future<TileProduct?> _fetchFromFirestore(String cleanId, String? cleanSku) async {
    if (cleanId.isNotEmpty) {
      try {
        final p = await FirestoreService.instance.getProductById(cleanId);
        if (p != null) return p;
      } catch (e) {
        debugPrint('[ProductLookupService] Error fetching product by id $cleanId: $e');
      }
    }

    if (cleanSku != null && cleanSku.isNotEmpty) {
      try {
        final snap = await FirebaseFirestore.instance
            .collection('products')
            .where('sku', isEqualTo: cleanSku)
            .limit(1)
            .get();
        if (snap.docs.isNotEmpty) {
          return TileProduct.fromMap(snap.docs.first.data(), snap.docs.first.id);
        }
      } catch (e) {
        debugPrint('[ProductLookupService] Error fetching product by sku $cleanSku: $e');
      }
    }

    return null;
  }
}

/// Universal Order Item Thumbnail Widget.
///
/// Implements the required 3-tier image resolution hierarchy:
///   1. Image path saved directly on the order item (if any)
///   2. Product lookup by productId / sku -> Tile FACE image (or adhesive bag image)
///   3. Existing app placeholder icon (terrain for tiles, bag for adhesives)
///
/// Geometric specifications:
///   - Square container (default size: 44, matching app style)
///   - TILES: BoxFit.cover, centered. Fills the square with the middle of the portrait tile without distortion.
///   - ADHESIVES: BoxFit.contain on a soft light background, so the whole bag is visible and never cropped.
///   - Decoded at exact physical pixel size (cacheWidth = size × devicePixelRatio) for performance.
///   - Shimmer/placeholder loading state with fixed geometry to avoid layout jump.
class OrderItemThumbnail extends StatelessWidget {
  final OrderItem? orderItem;
  final TileProduct? product;
  final String? productId;
  final String? sku;
  final String? productName;
  final String? image;
  final bool? isAdhesive;
  final double size;
  final BorderRadius? borderRadius;

  const OrderItemThumbnail({
    super.key,
    this.orderItem,
    this.product,
    this.productId,
    this.sku,
    this.productName,
    this.image,
    this.isAdhesive,
    this.size = 44,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveRadius = borderRadius ?? BorderRadius.circular(8);
    final pixelRatio = MediaQuery.maybeOf(context)?.devicePixelRatio ?? 2.0;
    final cacheWidth = (size * pixelRatio).round().clamp(80, 480);

    // 1. Direct Product Object provided (e.g. from Cart / Review step)
    if (product != null) {
      return _renderProduct(product!, effectiveRadius, cacheWidth);
    }

    // 2. OrderItem provided
    if (orderItem != null) {
      // (a) Image saved on the order item itself
      if (orderItem!.image != null && orderItem!.image!.trim().isNotEmpty) {
        return _renderImage(
          orderItem!.image!.trim(),
          orderItem!.isAdhesive,
          effectiveRadius,
          cacheWidth,
        );
      }

      // (b) Look up the product by productId / sku
      final cached = ProductLookupService.getCachedProduct(
        orderItem!.productId,
        orderItem!.sku,
      );
      if (cached != null) {
        return _renderProduct(cached, effectiveRadius, cacheWidth);
      }

      // Asynchronous lookup fallback
      return FutureBuilder<TileProduct?>(
        future: ProductLookupService.lookupProduct(
          orderItem!.productId,
          orderItem!.sku,
        ),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return _buildLoading(size, orderItem!.isAdhesive, effectiveRadius);
          }
          final resolvedProduct = snapshot.data;
          if (resolvedProduct != null) {
            return _renderProduct(resolvedProduct, effectiveRadius, cacheWidth);
          }
          // (c) App's existing placeholder
          return _buildPlaceholder(size, orderItem!.isAdhesive, effectiveRadius);
        },
      );
    }

    // 3. Manual properties provided (e.g. Orders list fallback or custom callers)
    if (image != null && image!.trim().isNotEmpty) {
      final isAdh = isAdhesive ?? _checkAdhesiveByName(productName, sku);
      return _renderImage(image!.trim(), isAdh, effectiveRadius, cacheWidth);
    }

    final pId = productId ?? '';
    final pSku = sku;
    final isAdh = isAdhesive ?? _checkAdhesiveByName(productName, pSku);

    if (pId.isNotEmpty || (pSku != null && pSku.isNotEmpty)) {
      final cached = ProductLookupService.getCachedProduct(pId, pSku);
      if (cached != null) {
        return _renderProduct(cached, effectiveRadius, cacheWidth);
      }

      return FutureBuilder<TileProduct?>(
        future: ProductLookupService.lookupProduct(pId, pSku),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return _buildLoading(size, isAdh, effectiveRadius);
          }
          final resolved = snapshot.data;
          if (resolved != null) {
            return _renderProduct(resolved, effectiveRadius, cacheWidth);
          }
          return _buildPlaceholder(size, isAdh, effectiveRadius);
        },
      );
    }

    // Default placeholder
    return _buildPlaceholder(size, isAdh, effectiveRadius);
  }

  /// Extracts the appropriate face / bag image from a TileProduct
  Widget _renderProduct(TileProduct p, BorderRadius radius, int cacheWidth) {
    final isAdh = p.isAdhesive;
    final img = _resolveProductFaceOrBagImage(p);
    if (img.isEmpty) {
      return _buildPlaceholder(size, isAdh, radius);
    }
    return _renderImage(img, isAdh, radius, cacheWidth);
  }

  /// Resolves the tile FACE image (for tiles) or bag image (for adhesives)
  static String _resolveProductFaceOrBagImage(TileProduct p) {
    if (p.isAdhesive) {
      if (p.images.isNotEmpty && p.images.first.isNotEmpty) {
        return p.images.first;
      }
      if (p.frontCardImage.isNotEmpty) {
        return p.frontCardImage;
      }
      return '';
    }

    // TILES: Use tile FACE image (same face image used on product card / face selector)
    if (p.faceImages != null && p.faceImages!.isNotEmpty && p.faceImages!.first.isNotEmpty) {
      return p.faceImages!.first;
    }
    if (p.resolvedFaceImages.isNotEmpty && p.resolvedFaceImages.first.isNotEmpty) {
      return p.resolvedFaceImages.first;
    }
    if (p.images.isNotEmpty && p.images.first.isNotEmpty) {
      return p.images.first;
    }
    return p.frontCardImage;
  }

  /// Renders the square image thumbnail with distinct styling for tiles vs adhesives
  Widget _renderImage(String rawPath, bool isAdh, BorderRadius radius, int cacheWidth) {
    final String? thumbPath = StorageImageService.isStoragePath(rawPath) &&
            !StorageImageService.isThumbnailPath(rawPath)
        ? StorageImageService.thumbnailPathFromOriginal(rawPath)
        : null;

    final imageWidget = AppProductImage(
      imagePath: thumbPath ?? rawPath,
      originalPath: rawPath,
      thumbnailPath: thumbPath,
      width: size,
      height: size,
      // TILES: BoxFit.cover, centered fills the square with the middle of the tile without stretching
      // ADHESIVES: BoxFit.contain keeps the whole bag visible without cropping
      fit: isAdh ? BoxFit.contain : BoxFit.cover,
      cacheWidth: cacheWidth,
      borderRadius: radius,
      fallback: _buildPlaceholder(size, isAdh, radius),
    );

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isAdh ? const Color(0xFFF7F8FA) : AppTheme.primaryNavy.withValues(alpha: 0.04),
        borderRadius: radius,
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: isAdh
            ? Padding(
                padding: const EdgeInsets.all(3.0),
                child: Center(child: imageWidget),
              )
            : Center(child: imageWidget),
      ),
    );
  }

  static bool _checkAdhesiveByName(String? name, String? sku) {
    final n = (name ?? '').toLowerCase();
    final s = (sku ?? '').toUpperCase();
    return n.contains('adhesive') || n.contains('bag') || s.startsWith('ITA-LX') || s.startsWith('PROD_ADH');
  }

  /// App's existing placeholder icon
  Widget _buildPlaceholder(double size, bool isAdh, BorderRadius radius) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppTheme.primaryNavy.withValues(alpha: 0.08),
        borderRadius: radius,
      ),
      child: Icon(
        isAdh ? Icons.shopping_bag_outlined : Icons.terrain_rounded,
        color: AppTheme.primaryNavy,
        size: size * 0.5,
      ),
    );
  }

  /// Shimmer / skeleton loading placeholder with identical geometry
  Widget _buildLoading(double size, bool isAdh, BorderRadius radius) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppTheme.primaryNavy.withValues(alpha: 0.05),
        borderRadius: radius,
      ),
      child: Icon(
        isAdh ? Icons.shopping_bag_outlined : Icons.terrain_rounded,
        color: AppTheme.primaryNavy.withValues(alpha: 0.2),
        size: size * 0.5,
      ),
    );
  }
}
