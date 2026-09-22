import 'package:flutter/foundation.dart';
import 'package:firebase_storage/firebase_storage.dart';

/// Centralized service for resolving Firebase Storage product image paths to HTTPS URLs,
/// managing in-memory resolution caches, and providing local asset fallback paths.
class StorageImageService {
  static const String storageBucket = 'itacon-app.firebasestorage.app';

  // In-memory cache for resolved download URLs (avoids repeated network calls to getDownloadURL)
  static final Map<String, String> _urlCache = {};
  static final Map<String, Future<String?>> _inFlightFutures = {};

  /// Checks if the given path is a Firebase Storage path.
  /// Recognizes:
  /// Checks if the given path is a Firebase Storage path.
  /// Recognizes:
  /// - products/thumbnails/...
  /// - products/tiles/...
  /// - products/mockups/...
  /// - products/adhesives/...
  /// - gs://itacon-app.firebasestorage.app/...
  static bool isStoragePath(String path) {
    if (path.isEmpty) return false;
    final clean = path.trim();
    return clean.startsWith('products/') ||
        clean.startsWith('gs://') ||
        clean.startsWith('/products/');
  }

  /// Checks if the path points to an optimized WebP thumbnail.
  static bool isThumbnailPath(String path) {
    if (path.isEmpty) return false;
    final clean = normalizeStoragePath(path);
    return clean.startsWith('products/thumbnails/');
  }

  /// Centralized mapping: converts an original Firebase Storage or local path
  /// to its corresponding optimized WebP thumbnail path.
  ///
  /// Examples:
  /// - 'products/mockups/XYZ.jpeg' -> 'products/thumbnails/mockups/XYZ.webp'
  /// - 'products/tiles/XYZ.jpeg'   -> 'products/thumbnails/tiles/XYZ.webp'
  /// - 'products/adhesives/XYZ.png'-> 'products/thumbnails/adhesives/XYZ.webp'
  static String thumbnailPathFromOriginal(String originalPath) {
    if (originalPath.isEmpty) return originalPath;
    final clean = normalizeStoragePath(originalPath);

    // If it's already a thumbnail path, return as-is
    if (clean.startsWith('products/thumbnails/')) {
      return clean;
    }

    if (clean.startsWith('products/mockups/')) {
      final filename = clean.substring('products/mockups/'.length);
      final lastDot = filename.lastIndexOf('.');
      final base = lastDot != -1 ? filename.substring(0, lastDot) : filename;
      return 'products/thumbnails/mockups/$base.webp';
    }

    if (clean.startsWith('products/tiles/')) {
      final filename = clean.substring('products/tiles/'.length);
      final lastDot = filename.lastIndexOf('.');
      final base = lastDot != -1 ? filename.substring(0, lastDot) : filename;
      return 'products/thumbnails/tiles/$base.webp';
    }

    if (clean.startsWith('products/adhesives/')) {
      final filename = clean.substring('products/adhesives/'.length);
      final lastDot = filename.lastIndexOf('.');
      final base = lastDot != -1 ? filename.substring(0, lastDot) : filename;
      return 'products/thumbnails/adhesives/$base.webp';
    }

    // Also support mapping from assets/images/... paths if encountered
    if (clean.startsWith('assets/images/mockups/')) {
      final filename = clean.substring('assets/images/mockups/'.length);
      final lastDot = filename.lastIndexOf('.');
      final base = lastDot != -1 ? filename.substring(0, lastDot) : filename;
      return 'products/thumbnails/mockups/$base.webp';
    }
    if (clean.startsWith('assets/images/tiles/')) {
      final filename = clean.substring('assets/images/tiles/'.length);
      final lastDot = filename.lastIndexOf('.');
      final base = lastDot != -1 ? filename.substring(0, lastDot) : filename;
      return 'products/thumbnails/tiles/$base.webp';
    }
    if (clean.startsWith('assets/images/adhesives/') || clean.startsWith('assets/adhesives/')) {
      final filename = clean.split('/').last;
      final lastDot = filename.lastIndexOf('.');
      final base = lastDot != -1 ? filename.substring(0, lastDot) : filename;
      return 'products/thumbnails/adhesives/$base.webp';
    }

    return clean;
  }

  /// Inversely derives candidate original storage paths for thumbnail fallback.
  /// Used if a thumbnail fails to resolve or download.
  static String? originalPathFromThumbnail(String thumbnailPath) {
    if (thumbnailPath.isEmpty) return null;
    final clean = normalizeStoragePath(thumbnailPath);

    if (clean.startsWith('products/thumbnails/mockups/')) {
      final base = clean
          .substring('products/thumbnails/mockups/'.length)
          .replaceAll('.webp', '');
      return 'products/mockups/$base.jpeg';
    }

    if (clean.startsWith('products/thumbnails/tiles/')) {
      final base = clean
          .substring('products/thumbnails/tiles/'.length)
          .replaceAll('.webp', '');
      return 'products/tiles/$base.jpeg';
    }

    if (clean.startsWith('products/thumbnails/adhesives/')) {
      final base = clean
          .substring('products/thumbnails/adhesives/'.length)
          .replaceAll('.webp', '');
      return 'products/adhesives/$base.png';
    }

    return null;
  }

  /// Normalizes a path to the standard Storage reference path (e.g. 'products/tiles/xxx.jpeg').
  static String normalizeStoragePath(String path) {
    String clean = path.trim();
    if (clean.startsWith('gs://$storageBucket/')) {
      clean = clean.substring('gs://$storageBucket/'.length);
    } else if (clean.startsWith('gs://')) {
      final idx = clean.indexOf('/', 5);
      if (idx != -1) {
        clean = clean.substring(idx + 1);
      }
    }
    if (clean.startsWith('/')) {
      clean = clean.substring(1);
    }
    return clean;
  }

  /// Returns the corresponding local asset fallback path for a Firebase Storage path,
  /// or null if the path doesn't map to a known product asset.
  /// Examples:
  /// - 'products/tiles/XYZ.jpeg' -> 'assets/images/tiles/XYZ.jpeg'
  /// - 'products/mockups/XYZ.jpeg' -> 'assets/images/mockups/XYZ.jpeg'
  /// - 'products/adhesives/XYZ.png' -> 'assets/images/adhesives/XYZ.png'
  static String? getLocalFallbackPath(String path) {
    if (path.isEmpty) return null;
    final clean = normalizeStoragePath(path);

    if (clean.startsWith('products/thumbnails/mockups/')) {
      final base = clean.substring('products/thumbnails/mockups/'.length).replaceAll('.webp', '');
      return 'assets/images/mockups/$base.jpeg';
    }
    if (clean.startsWith('products/thumbnails/tiles/')) {
      final base = clean.substring('products/thumbnails/tiles/'.length).replaceAll('.webp', '');
      return 'assets/images/tiles/$base.jpeg';
    }
    if (clean.startsWith('products/thumbnails/adhesives/')) {
      final base = clean.substring('products/thumbnails/adhesives/'.length).replaceAll('.webp', '');
      return 'assets/images/adhesives/$base.png';
    }
    if (clean.startsWith('products/tiles/')) {
      return 'assets/images/tiles/${clean.substring('products/tiles/'.length)}';
    }
    if (clean.startsWith('products/mockups/')) {
      return 'assets/images/mockups/${clean.substring('products/mockups/'.length)}';
    }
    if (clean.startsWith('products/adhesives/')) {
      return 'assets/images/adhesives/${clean.substring('products/adhesives/'.length)}';
    }
    if (clean.startsWith('products/')) {
      return 'assets/images/${clean.substring('products/'.length)}';
    }
    if (clean.startsWith('assets/images/')) {
      return clean;
    }
    if (clean.startsWith('assets/adhesives/')) {
      return 'assets/images/adhesives/${clean.substring('assets/adhesives/'.length)}';
    }
    return null;
  }

  /// Returns the corresponding Firebase Storage path for a local asset path,
  /// or null if it does not map to a standard product category.
  /// Examples:
  /// - 'assets/images/tiles/XYZ.jpeg' -> 'products/tiles/XYZ.jpeg'
  /// - 'assets/images/mockups/XYZ.jpeg' -> 'products/mockups/XYZ.jpeg'
  /// - 'assets/images/adhesives/XYZ.png' -> 'products/adhesives/XYZ.png'
  /// - 'assets/adhesives/XYZ.png' -> 'products/adhesives/XYZ.png'
  static String? getStoragePathFromLocalAsset(String assetPath) {
    if (assetPath.isEmpty) return null;
    final clean = assetPath.trim();

    if (clean.startsWith('assets/images/tiles/')) {
      return 'products/tiles/${clean.substring('assets/images/tiles/'.length)}';
    }
    if (clean.startsWith('assets/images/mockups/')) {
      return 'products/mockups/${clean.substring('assets/images/mockups/'.length)}';
    }
    if (clean.startsWith('assets/images/adhesives/')) {
      return 'products/adhesives/${clean.substring('assets/images/adhesives/'.length)}';
    }
    if (clean.startsWith('assets/adhesives/')) {
      return 'products/adhesives/${clean.substring('assets/adhesives/'.length)}';
    }
    if (clean.startsWith('products/')) {
      return normalizeStoragePath(clean);
    }
    return null;
  }

  /// Synchronously checks if a download URL is already cached in memory.
  static String? getCachedUrl(String path) {
    final normalized = normalizeStoragePath(path);
    return _urlCache[normalized];
  }

  /// Resolves a Firebase Storage path to an HTTPS download URL.
  /// Returns null if resolving fails, without throwing.
  static Future<String?> getDownloadUrl(String path) async {
    if (path.isEmpty) return null;
    final normalized = normalizeStoragePath(path);

    if (_urlCache.containsKey(normalized)) {
      return _urlCache[normalized];
    }

    if (_inFlightFutures.containsKey(normalized)) {
      return _inFlightFutures[normalized];
    }

    final future = () async {
      try {
        final storage = FirebaseStorage.instanceFor(bucket: storageBucket);
        final ref = storage.ref(normalized);
        final url = await ref.getDownloadURL();
        _urlCache[normalized] = url;
        return url;
      } catch (e) {
        debugPrint('StorageImageService: Could not resolve download URL for $normalized: $e');
        return null;
      } finally {
        _inFlightFutures.remove(normalized);
      }
    }();

    _inFlightFutures[normalized] = future;
    return future;
  }

  /// Optional helper to warm the in-memory cache for a list of paths lazily.
  static void warmCache(List<String> paths) {
    for (final p in paths) {
      if (isStoragePath(p) && getCachedUrl(p) == null) {
        getDownloadUrl(p);
      }
    }
  }

  /// Clears in-memory URL cache (useful for testing or cache reset).
  static void clearCache() {
    _urlCache.clear();
    _inFlightFutures.clear();
  }
}
