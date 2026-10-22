import 'dart:typed_data';
import 'package:flutter/widgets.dart';

/// Web / Stub implementation: Avoids importing 'dart:io' entirely on browser platforms.

/// Returns null on web since direct filesystem access by path does not exist.
Future<Uint8List?> readFileBytes(String path) async {
  return null;
}

/// Always returns false on web for local file path checks.
bool fileExists(String path) {
  return false;
}

/// Returns an empty placeholder on web; web uses Image.network or Image.memory.
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
  return const SizedBox.shrink();
}

/// On web, Platform.isWindows is false.
bool get isWindowsPlatform => false;
