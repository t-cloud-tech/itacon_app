import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class SavedPoFile {
  final String uri;
  final String path;
  final String fileName;

  const SavedPoFile({
    required this.uri,
    required this.path,
    required this.fileName,
  });
}

class PoDownloadService {
  static const MethodChannel _channel = MethodChannel('com.itacongranito.app/po_downloader');

  /// Downloads raw PDF bytes directly inside the application over HTTP.
  static Future<Uint8List> downloadBytes(String url) async {
    final client = HttpClient();
    try {
      final request = await client.getUrl(Uri.parse(url));
      final response = await request.close();
      if (response.statusCode != HttpStatus.ok) {
        throw Exception('Server returned HTTP ${response.statusCode} while downloading document');
      }
      final bytes = await response.fold<List<int>>(
        <int>[],
        (buffer, data) => buffer..addAll(data),
      );
      return Uint8List.fromList(bytes);
    } finally {
      client.close();
    }
  }

  /// Saves PDF bytes to phone storage:
  /// - Android 10+: public Downloads folder via MediaStore (no storage permission required)
  /// - Android 9 and below: public Downloads folder via external storage
  /// - iOS: app Documents folder (visible in Files app under "On My iPhone → Itacon")
  static Future<SavedPoFile> savePdf({
    required Uint8List bytes,
    required String fileName,
  }) async {
    if (Platform.isAndroid) {
      final res = await _channel.invokeMapMethod<String, dynamic>('savePdfToDownloads', {
        'bytes': bytes,
        'fileName': fileName,
      });
      return SavedPoFile(
        uri: res?['uri']?.toString() ?? '',
        path: res?['path']?.toString() ?? fileName,
        fileName: fileName,
      );
    } else if (Platform.isIOS) {
      final res = await _channel.invokeMapMethod<String, dynamic>('savePdfToDocuments', {
        'bytes': bytes,
        'fileName': fileName,
      });
      return SavedPoFile(
        uri: res?['uri']?.toString() ?? '',
        path: res?['path']?.toString() ?? fileName,
        fileName: fileName,
      );
    } else {
      throw UnsupportedError('Saving PO PDF is only supported on Android and iOS.');
    }
  }

  /// Opens the PDF in the phone's native PDF viewer. Never opens Chrome or browser.
  static Future<bool> openPdf({String? uri, String? path}) async {
    try {
      final res = await _channel.invokeMethod<bool>('openPdf', {
        'uri': uri,
        'path': path,
      });
      return res ?? false;
    } catch (e) {
      debugPrint('[PoDownloadService] Error opening PDF in native viewer: $e');
      return false;
    }
  }

  /// Triggers the native iOS share sheet (e.g. for "Save to Files")
  static Future<bool> sharePdf({required String path}) async {
    if (!Platform.isIOS) return false;
    try {
      final res = await _channel.invokeMethod<bool>('sharePdf', {'path': path});
      return res ?? false;
    } catch (e) {
      debugPrint('[PoDownloadService] Error sharing PDF: $e');
      return false;
    }
  }
}
