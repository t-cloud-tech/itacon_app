import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Universal Product Image Widget that handles local assets (with path normalization for adhesives),
/// network images, and graceful fallback UI.
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

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return Image.network(
        imagePath,
        width: width,
        height: height,
        fit: fit,
        cacheWidth: 600,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => _buildFallback(),
      );
    }

    // Normalize asset paths (e.g. assets/adhesives/ -> assets/images/adhesives/)
    String cleanPath = imagePath;
    if (!cleanPath.startsWith('assets/images/adhesives/') && cleanPath.contains('adhesives/')) {
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
      cacheWidth: 600,
      filterQuality: FilterQuality.medium,
      errorBuilder: (context, error, stackTrace) {
        return Image.asset(
          altPath,
          width: width,
          height: height,
          fit: fit,
          cacheWidth: 600,
          filterQuality: FilterQuality.medium,
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
