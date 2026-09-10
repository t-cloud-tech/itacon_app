import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Universal Product Image Widget that handles local assets (with path normalization for adhesives),
/// network images, file images, and graceful fallback UI.
class AppProductImage extends StatelessWidget {
  final String imagePath;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget? fallback;

  const AppProductImage({
    super.key,
    required this.imagePath,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    if (imagePath.isEmpty) {
      return _buildFallback();
    }

    // Adaptive decode cache dimension (only computed for finite dimensions)
    int? effectiveCacheWidth;
    if (width != null && width!.isFinite && width! > 0) {
      effectiveCacheWidth = (width! * 2.0).round().clamp(160, 800);
    } else if (height != null && height!.isFinite && height! > 0) {
      effectiveCacheWidth = (height! * 2.0).round().clamp(160, 800);
    }

    // 1. Network Image
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return Image.network(
        imagePath,
        width: width,
        height: height,
        fit: fit,
        cacheWidth: effectiveCacheWidth,
        filterQuality: FilterQuality.low,
        frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
          if (wasSynchronouslyLoaded || frame != null) {
            return child;
          }
          return _buildFallback();
        },
        errorBuilder: (context, error, stackTrace) => _buildFallback(),
      );
    }

    // 2. Local File (only check if path explicitly looks like a filesystem path and NOT on web)
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

    // 3. Asset Image (Normalize asset paths e.g. adhesives)
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
          errorBuilder: (context, error2, stackTrace2) => _buildFallback(),
        );
      },
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
