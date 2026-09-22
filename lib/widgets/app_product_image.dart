import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../services/storage_image_service.dart';
import '../theme/app_theme.dart';
import 'interactive_pressable.dart';

/// Semantic display role for adaptive decode sizing across device screens
enum ImageRole {
  /// Product Collection grid cards (~480 physical px)
  collectionThumbnail,

  /// Mini face selector chips in Product Detail (~200 physical px)
  faceThumbnail,

  /// Adhesive product cards (~480 physical px)
  adhesiveCard,

  /// Detail hero view (~1080 physical px)
  detailHero,

  /// Custom sizing derived from width / height
  custom,
}

/// Universal Product Image Widget that seamlessly handles:
/// 1. Remote Firebase Storage paths (`products/thumbnails/...`, `products/tiles/...`, `products/mockups/...`, `products/adhesives/...`)
/// 2. Instant progressive loading (Cached Thumbnail renders at 0ms while High-Res Hero loads in background)
/// 3. Smooth skeleton/shimmer loading with matching geometry to eliminate layout jump
/// 4. Automatic two-tier fallback (Thumbnail -> Original Storage -> Local Asset -> Fallback Placeholder)
/// 5. HTTPS/HTTP network image URLs (`https://...`) with memory and disk caching
/// 6. Adaptive decode dimension (`ImageRole` or `cacheWidth`) to optimize GPU VRAM
class AppProductImage extends StatelessWidget {
  final String imagePath;
  final String? originalPath;
  final String? thumbnailPath;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget? fallback;
  final int? cacheWidth;
  final ImageRole? imageRole;
  final BorderRadius? borderRadius;

  const AppProductImage({
    super.key,
    required this.imagePath,
    this.originalPath,
    this.thumbnailPath,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.fallback,
    this.cacheWidth,
    this.imageRole,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    if (imagePath.isEmpty) {
      return _buildFallback();
    }

    // Adaptive decode cache dimension to optimize GPU RAM across all devices
    int? effectiveCacheWidth = cacheWidth;
    if (effectiveCacheWidth == null) {
      if (imageRole != null) {
        switch (imageRole!) {
          case ImageRole.collectionThumbnail:
            effectiveCacheWidth = 440;
            break;
          case ImageRole.faceThumbnail:
            effectiveCacheWidth = 200;
            break;
          case ImageRole.adhesiveCard:
            effectiveCacheWidth = 440;
            break;
          case ImageRole.detailHero:
            effectiveCacheWidth = 1080;
            break;
          case ImageRole.custom:
            break;
        }
      }
      if (effectiveCacheWidth == null) {
        if (width != null && width!.isFinite && width! > 0) {
          effectiveCacheWidth = (width! * 2.0).round().clamp(160, 1080);
        } else if (height != null && height!.isFinite && height! > 0) {
          effectiveCacheWidth = (height! * 2.0).round().clamp(160, 1080);
        } else {
          effectiveCacheWidth = 440;
        }
      }
    }

    // Derive optimized WebP thumbnail path if rendering an original storage path
    final String? effectiveThumbnailPath = thumbnailPath ??
        (StorageImageService.isStoragePath(imagePath) &&
                !StorageImageService.isThumbnailPath(imagePath)
            ? StorageImageService.thumbnailPathFromOriginal(imagePath)
            : null);

    Widget content;

    // 1. Firebase Storage Path (thumbnails, tiles, mockups, adhesives)
    if (StorageImageService.isStoragePath(imagePath)) {
      final cacheKey = StorageImageService.normalizeStoragePath(imagePath);
      final cachedUrl = StorageImageService.getCachedUrl(imagePath);

      if (cachedUrl != null && cachedUrl.isNotEmpty) {
        content = CachedNetworkImage(
          imageUrl: cachedUrl,
          cacheKey: cacheKey,
          width: width,
          height: height,
          fit: fit,
          memCacheWidth: effectiveCacheWidth,
          fadeInDuration: const Duration(milliseconds: 140),
          fadeOutDuration: const Duration(milliseconds: 100),
          filterQuality: FilterQuality.low,
          placeholder: (context, url) =>
              _buildPlaceholder(effectiveThumbnailPath, effectiveCacheWidth),
          errorWidget: (context, url, error) =>
              _buildFallbackToOriginal(effectiveCacheWidth),
        );
      } else {
        content = FutureBuilder<String?>(
          future: StorageImageService.getDownloadUrl(imagePath),
          builder: (context, snapshot) {
            final resolvedUrl = snapshot.data;
            if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
              return CachedNetworkImage(
                imageUrl: resolvedUrl,
                cacheKey: cacheKey,
                width: width,
                height: height,
                fit: fit,
                memCacheWidth: effectiveCacheWidth,
                fadeInDuration: const Duration(milliseconds: 140),
                fadeOutDuration: const Duration(milliseconds: 100),
                filterQuality: FilterQuality.low,
                placeholder: (context, url) =>
                    _buildPlaceholder(effectiveThumbnailPath, effectiveCacheWidth),
                errorWidget: (context, url, error) =>
                    _buildFallbackToOriginal(effectiveCacheWidth),
              );
            }
            // While resolving URL over network, display thumbnail placeholder or skeleton
            if (snapshot.connectionState == ConnectionState.waiting) {
              return _buildPlaceholder(
                  effectiveThumbnailPath, effectiveCacheWidth);
            }
            // If download URL resolution failed, attempt original fallback
            return _buildFallbackToOriginal(effectiveCacheWidth);
          },
        );
      }
    } else if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // 2. Direct HTTP/HTTPS Network Image
      content = CachedNetworkImage(
        imageUrl: imagePath,
        width: width,
        height: height,
        fit: fit,
        memCacheWidth: effectiveCacheWidth,
        filterQuality: FilterQuality.medium,
        placeholder: (context, url) => _buildSkeleton(),
        errorWidget: (context, url, error) =>
            _buildLocalFallbackOrGeneric(imagePath, effectiveCacheWidth),
      );
    } else if (!kIsWeb &&
        (imagePath.startsWith('/') ||
            imagePath.startsWith('file://') ||
            (Platform.isWindows && imagePath.contains(r':\'))) &&
        !imagePath.startsWith('assets/')) {
      // 3. Local Filesystem File
      try {
        final file = File(imagePath.replaceFirst('file://', ''));
        if (file.existsSync()) {
          content = Image.file(
            file,
            width: width,
            height: height,
            fit: fit,
            cacheWidth: effectiveCacheWidth,
            filterQuality: FilterQuality.medium,
            errorBuilder: (context, error, stackTrace) => _buildFallback(),
          );
        } else {
          content = _buildFallback();
        }
      } catch (_) {
        content = _buildFallback();
      }
    } else {
      // 4. Local Bundled Flutter Asset Image (with fallback)
      String cleanPath = imagePath;
      if (!cleanPath.startsWith('assets/images/adhesives/') &&
          cleanPath.contains('adhesives/')) {
        final fileName = cleanPath.split('adhesives/').last;
        cleanPath = 'assets/images/adhesives/$fileName';
      }

      final String altPath = cleanPath.contains('assets/images/adhesives')
          ? cleanPath.replaceFirst('assets/images/adhesives', 'assets/adhesives')
          : cleanPath;

      content = Image.asset(
        cleanPath,
        width: width,
        height: height,
        fit: fit,
        cacheWidth: effectiveCacheWidth,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) {
          return Image.asset(
            altPath,
            width: width,
            height: height,
            fit: fit,
            cacheWidth: effectiveCacheWidth,
            filterQuality: FilterQuality.medium,
            errorBuilder: (context, error2, stackTrace2) {
              final storagePath =
                  StorageImageService.getStoragePathFromLocalAsset(cleanPath);
              if (storagePath != null) {
                return AppProductImage(
                  imagePath: storagePath,
                  originalPath: originalPath,
                  width: width,
                  height: height,
                  fit: fit,
                  fallback: fallback,
                  cacheWidth: cacheWidth,
                  imageRole: imageRole,
                  borderRadius: borderRadius,
                );
              }
              return _buildFallback();
            },
          );
        },
      );
    }

    if (borderRadius != null && borderRadius != BorderRadius.zero) {
      return ClipRRect(
        borderRadius: borderRadius!,
        child: content,
      );
    }

    return content;
  }

  /// Two-Tier Fallback: If thumbnail loading fails, silently falls back to the original image
  Widget _buildFallbackToOriginal(int? cacheWidth) {
    final candidateOriginal = originalPath ??
        (StorageImageService.isThumbnailPath(imagePath)
            ? StorageImageService.originalPathFromThumbnail(imagePath)
            : null);

    if (candidateOriginal != null &&
        candidateOriginal.isNotEmpty &&
        candidateOriginal != imagePath) {
      return AppProductImage(
        imagePath: candidateOriginal,
        width: width,
        height: height,
        fit: fit,
        borderRadius: borderRadius,
        cacheWidth: cacheWidth,
        fallback: fallback,
      );
    }

    return _buildLocalFallbackOrGeneric(imagePath, cacheWidth);
  }

  /// Displays an instant thumbnail preview if cached or available, seamlessly transitioning to high-res,
  /// or falls back to the subtle skeleton shimmer if no preview is available.
  Widget _buildPlaceholder(String? thumbPath, int? effectiveCacheWidth) {
    if (thumbPath != null && thumbPath.isNotEmpty && thumbPath != imagePath) {
      final cachedThumbUrl = StorageImageService.getCachedUrl(thumbPath);
      if (cachedThumbUrl != null && cachedThumbUrl.isNotEmpty) {
        return CachedNetworkImage(
          imageUrl: cachedThumbUrl,
          cacheKey: StorageImageService.normalizeStoragePath(thumbPath),
          width: width,
          height: height,
          fit: fit,
          memCacheWidth: effectiveCacheWidth != null
              ? (effectiveCacheWidth > 440 ? 440 : effectiveCacheWidth)
              : 440,
          fadeInDuration: Duration.zero,
          placeholder: (context, url) => _buildSkeleton(),
          errorWidget: (context, url, error) => _buildSkeleton(),
        );
      }

      // If thumbnail download URL is not yet in memory cache, resolve it concurrently
      return FutureBuilder<String?>(
        future: StorageImageService.getDownloadUrl(thumbPath),
        builder: (context, snap) {
          final url = snap.data;
          if (url != null && url.isNotEmpty) {
            return CachedNetworkImage(
              imageUrl: url,
              cacheKey: StorageImageService.normalizeStoragePath(thumbPath),
              width: width,
              height: height,
              fit: fit,
              memCacheWidth: 440,
              fadeInDuration: const Duration(milliseconds: 100),
              placeholder: (context, url) => _buildSkeleton(),
              errorWidget: (context, url, error) => _buildSkeleton(),
            );
          }
          return _buildSkeleton();
        },
      );
    }
    return _buildSkeleton();
  }

  /// Builds a calm, continuous skeleton shimmer matching exact card dimensions
  Widget _buildSkeleton() {
    return AppSkeleton(
      width: width,
      height: height,
      borderRadius: borderRadius ?? BorderRadius.zero,
    );
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
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => _buildFallback(),
      );
    }
    return _buildFallback();
  }

  Widget _buildFallback() {
    return fallback ??
        Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: AppTheme.primaryNavy.withValues(alpha: 0.08),
            borderRadius: borderRadius,
          ),
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
