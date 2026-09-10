import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Rock-solid cross-platform avatar image widget.
/// Handles network (http/https), web blobs (blob:), Base64 data URIs (data:image/...),
/// local assets (assets/...), and local files (!kIsWeb) without crashing on Web
/// with "Unsupported operation: _Namespace".
class AppAvatarImage extends StatelessWidget {
  final String? photoUrl;
  final String initials;
  final double size;
  final Color? backgroundColor;
  final Color? textColor;

  const AppAvatarImage({
    super.key,
    required this.photoUrl,
    required this.initials,
    required this.size,
    this.backgroundColor,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    final clean = photoUrl?.trim() ?? '';
    final fallback = _buildFallback();

    if (clean.isEmpty) {
      return fallback;
    }

    // 1. Base64 Data URI or raw base64 string
    if (clean.startsWith('data:image') || (clean.startsWith('data:') && clean.contains('base64,'))) {
      try {
        final commaIdx = clean.indexOf(',');
        final base64String = commaIdx != -1 ? clean.substring(commaIdx + 1) : clean;
        final bytes = base64Decode(base64String);
        return Image.memory(
          bytes,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => fallback,
        );
      } catch (_) {
        return fallback;
      }
    }

    // 2. Remote Network or Web Blob URL
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:')) {
      return Image.network(
        clean,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => fallback,
      );
    }

    // 3. Asset Image
    if (clean.startsWith('assets/')) {
      return Image.asset(
        clean,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => fallback,
      );
    }

    // 4. Local File (ONLY on non-web platforms to avoid "Unsupported operation: _Namespace")
    if (!kIsWeb) {
      try {
        final file = File(clean);
        if (file.existsSync()) {
          return Image.file(
            file,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => fallback,
          );
        }
      } catch (_) {
        return fallback;
      }
    }

    return fallback;
  }

  Widget _buildFallback() {
    return Container(
      width: size,
      height: size,
      color: backgroundColor ?? AppTheme.primaryNavy.withValues(alpha: 0.1),
      alignment: Alignment.center,
      child: Text(
        initials.isNotEmpty ? initials : 'U',
        style: TextStyle(
          fontSize: size * 0.38,
          fontWeight: FontWeight.bold,
          color: textColor ?? AppTheme.primaryNavy,
        ),
      ),
    );
  }
}

/// Universal showroom image builder that avoids _Namespace on Web
class AppShowroomImage extends StatelessWidget {
  final String imagePath;
  final double width;
  final double height;
  final BoxFit fit;

  const AppShowroomImage({
    super.key,
    required this.imagePath,
    this.width = 100,
    this.height = 100,
    this.fit = BoxFit.cover,
  });

  @override
  Widget build(BuildContext context) {
    final clean = imagePath.trim();
    final fallback = Container(
      width: width,
      height: height,
      color: AppTheme.primaryNavy.withValues(alpha: 0.08),
      child: const Center(
        child: Icon(
          Icons.storefront_rounded,
          color: AppTheme.primaryNavy,
          size: 32,
        ),
      ),
    );

    if (clean.isEmpty) return fallback;

    if (clean.startsWith('data:image') || (clean.startsWith('data:') && clean.contains('base64,'))) {
      try {
        final commaIdx = clean.indexOf(',');
        final base64String = commaIdx != -1 ? clean.substring(commaIdx + 1) : clean;
        final bytes = base64Decode(base64String);
        return Image.memory(
          bytes,
          width: width,
          height: height,
          fit: fit,
          errorBuilder: (context, error, stackTrace) => fallback,
        );
      } catch (_) {
        return fallback;
      }
    }

    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:')) {
      return Image.network(
        clean,
        width: width,
        height: height,
        fit: fit,
        cacheWidth: 300,
        cacheHeight: 300,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => fallback,
      );
    }

    if (clean.startsWith('assets/')) {
      return Image.asset(
        clean,
        width: width,
        height: height,
        fit: fit,
        cacheWidth: 300,
        cacheHeight: 300,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => fallback,
      );
    }

    if (!kIsWeb) {
      try {
        final file = File(clean);
        if (file.existsSync()) {
          return Image.file(
            file,
            width: width,
            height: height,
            fit: fit,
            cacheWidth: 300,
            cacheHeight: 300,
            filterQuality: FilterQuality.medium,
            errorBuilder: (context, error, stackTrace) => fallback,
          );
        }
      } catch (_) {}
    }

    return fallback;
  }
}
