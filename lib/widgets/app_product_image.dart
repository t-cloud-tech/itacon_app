import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../services/storage_image_service.dart';
import '../theme/app_theme.dart';

/// Universal Product Image Widget that seamlessly handles:
/// 1. Remote Firebase Storage paths (`products/tiles/...`, `products/mockups/...`, `products/adhesives/...`)
/// 2. HTTPS/HTTP network image URLs (`https://...`) with memory and disk caching
/// 3. Local bundled Flutter assets (`assets/images/...`) with automatic adhesive path normalization
/// 4. Local file images on physical storage
/// 5. Graceful multi-tier fallback UI (Storage -> Local Asset -> Fallback Placeholder)
class AppProductImage extends StatelessWidget {
  final String imagePath;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget? fallback;
  final int? cacheWidth;

  const AppProductImage({
    super.key,
    required this.imagePath,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.fallback,
    this.cacheWidth,
  });

  @override
  Widget build(BuildContext context) {
    if (imagePath.isEmpty) {
      return _buildFallback();
    }

    // Adaptive decode cache dimension to optimize GPU RAM across all devices
    int? effectiveCacheWidth = cacheWidth;
    if (effectiveCacheWidth == null) {
      if (width != null && width!.isFinite && width! > 0) {
        effectiveCacheWidth = (width! * 2.0).round().clamp(160, 900);
      } else if (height != null && height!.isFinite && height! > 0) {
        effectiveCacheWidth = (height! * 2.0).round().clamp(160, 900);
      } else {
        effectiveCacheWidth = 600;
      }
    }

    // 1. Firebase Storage Path (e.g. products/tiles/..., products/mockups/..., products/adhesives/...)
    if (StorageImageService.isStoragePath(imagePath)) {
      final cachedUrl = StorageImageService.getCachedUrl(imagePath);
      if (cachedUrl != null && cachedUrl.isNotEmpty) {
        return CachedNetworkImage(
          imageUrl: cachedUrl,
          width: width,
          height: height,
          fit: fit,
          memCacheWidth: effectiveCacheWidth,
          filterQuality: FilterQuality.low,
          placeholder: (context, url) =>
              _buildLocalFallbackOrPlaceholder(imagePath, effectiveCacheWidth),
          errorWidget: (context, url, error) =>
              _buildLocalFallbackOrGeneric(imagePath, effectiveCacheWidth),
        );
      }

      return FutureBuilder<String?>(
        future: StorageImageService.getDownloadUrl(imagePath),
        builder: (context, snapshot) {
          final resolvedUrl = snapshot.data;
          if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
            return CachedNetworkImage(
              imageUrl: resolvedUrl,
              width: width,
              height: height,
              fit: fit,
              memCacheWidth: effectiveCacheWidth,
              filterQuality: FilterQuality.low,
              placeholder: (context, url) =>
                  _buildLocalFallbackOrPlaceholder(imagePath, effectiveCacheWidth),
              errorWidget: (context, url, error) =>
                  _buildLocalFallbackOrGeneric(imagePath, effectiveCacheWidth),
            );
          }
          // While resolving or if network lookup fails, display local asset or placeholder
          return _buildLocalFallbackOrPlaceholder(imagePath, effectiveCacheWidth);
        },
      );
    }

    // 2. Direct HTTP/HTTPS Network Image
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return CachedNetworkImage(
        imageUrl: imagePath,
        width: width,
        height: height,
        fit: fit,
        memCacheWidth: effectiveCacheWidth,
        filterQuality: FilterQuality.low,
        placeholder: (context, url) => _buildPlaceholder(),
        errorWidget: (context, url, error) =>
            _buildLocalFallbackOrGeneric(imagePath, effectiveCacheWidth),
      );
    }

    // 3. Local Filesystem File (only check if path explicitly looks like a filesystem path and NOT on web)
    if (!kIsWeb) {
      final isExplicitFilePath = imagePath.startsWith('/') ||
          imagePath.startsWith('file://') ||
          (Platform.isWindows && imagePath.contains(r':\'));

      if (isExplicitFilePath &&
          !imagePath.startsWith('assets/') &&
          !imagePath.contains('adhesives/')) {
        try {
          final file = File(imagePath.replaceFirst('file://', ''));
          if (file.existsSync()) {
            return Image.file(
              file,
              width: width,
              height: height,
              fit: fit,
              cacheWidth: effectiveCacheWidth,
              filterQuality: FilterQuality.low,
              errorBuilder: (context, error, stackTrace) => _buildFallback(),
            );
          }
        } catch (_) {}
      }
    }

    // 4. Local Bundled Flutter Asset Image (with path normalization e.g. adhesives)
    String cleanPath = imagePath;
    if (!cleanPath.startsWith('assets/images/adhesives/') &&
        cleanPath.contains('adhesives/')) {
      final fileName = cleanPath.split('adhesives/').last;
      cleanPath = 'assets/images/adhesives/$fileName';
    }

    final String altPath = cleanPath.contains('assets/images/adhesives')
        ? cleanPath.replaceFirst('assets/images/adhesives', 'assets/adhesives')
        : cleanPath;

    return Image.asset(
      cleanPath,
      width: width,
      height: height,
      fit: fit,
      cacheWidth: effectiveCacheWidth,
      filterQuality: FilterQuality.low,
      errorBuilder: (context, error, stackTrace) {
        return Image.asset(
          altPath,
          width: width,
          height: height,
          fit: fit,
          cacheWidth: effectiveCacheWidth,
          filterQuality: FilterQuality.low,
          errorBuilder: (context, error2, stackTrace2) {
            // If local asset is not found, try remote storage fallback if mapping exists
            final storagePath =
                StorageImageService.getStoragePathFromLocalAsset(cleanPath);
            if (storagePath != null) {
              return AppProductImage(
                imagePath: storagePath,
                width: width,
                height: height,
                fit: fit,
                fallback: fallback,
                cacheWidth: cacheWidth,
              );
            }
            return _buildFallback();
          },
        );
      },
    );
  }

  /// Builds the local asset fallback if available; otherwise returns the placeholder container
  Widget _buildLocalFallbackOrPlaceholder(
      String storagePath, int? effectiveCacheWidth) {
    final localPath = StorageImageService.getLocalFallbackPath(storagePath);
    if (localPath != null) {
      return Image.asset(
        localPath,
        width: width,
        height: height,
        fit: fit,
        cacheWidth: effectiveCacheWidth,
        filterQuality: FilterQuality.low,
        errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
      );
    }
    return _buildPlaceholder();
  }

  /// Builds the local asset fallback if available; otherwise returns the standard fallback icon
  Widget _buildLocalFallbackOrGeneric(
      String storagePath, int? effectiveCacheWidth) {
    final localPath = StorageImageService.getLocalFallbackPath(storagePath);
    if (localPath != null) {
      return Image.asset(
        localPath,
        width: width,
        height: height,
        fit: fit,
        cacheWidth: effectiveCacheWidth,
        filterQuality: FilterQuality.low,
        errorBuilder: (context, error, stackTrace) => _buildFallback(),
      );
    }
    return _buildFallback();
  }

  Widget _buildPlaceholder() {
    return Container(
      width: width,
      height: height,
      color: AppTheme.primaryNavy.withValues(alpha: 0.05),
    );
  }

  Widget _buildFallback() {
    return fallback ??
        Container(
          width: width,
          height: height,
          color: AppTheme.primaryNavy.withValues(alpha: 0.08),
          child: const Center(
            child: Icon(
              Icons.inventory_2_rounded,
              color: AppTheme.primaryNavy,
              size: 32,
            ),
          ),
        );
  }
}
