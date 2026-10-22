import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/widgets.dart';

/// Native (Android, iOS, Desktop) implementation: Uses dart:io File and Platform safely.

/// Reads bytes from native local filesystem.
Future<Uint8List?> readFileBytes(String path) async {
  try {
    final file = File(path);
    if (await file.exists()) {
      return await file.readAsBytes();
    }
  } catch (_) {}
  return null;
}

/// Checks if file exists on native local filesystem.
bool fileExists(String path) {
  try {
    return File(path).existsSync();
  } catch (_) {
    return false;
  }
}

/// Builds an Image.file widget on native platforms.
Widget buildFileImage({
  required String path,
  double? width,
  double? height,
  BoxFit fit = BoxFit.cover,
  int? cacheWidth,
  int? cacheHeight,
  FilterQuality filterQuality = FilterQuality.medium,
  Widget Function(BuildContext, Object, StackTrace?)? errorBuilder,
}) {
  return Image.file(
    File(path),
    width: width,
    height: height,
    fit: fit,
    cacheWidth: cacheWidth,
    cacheHeight: cacheHeight,
    filterQuality: filterQuality,
    errorBuilder: errorBuilder,
  );
}

/// Checks if native host platform is Windows.
bool get isWindowsPlatform {
  try {
    return Platform.isWindows;
  } catch (_) {
    return false;
  }
}
