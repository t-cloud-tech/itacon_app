import 'dart:typed_data';

/// Result of validating a payment receipt file before upload.
class PaymentReceiptValidationResult {
  final bool isValid;
  final String? errorMessage;
  final String? normalizedExtension;
  final String? contentType;

  const PaymentReceiptValidationResult({
    required this.isValid,
    this.errorMessage,
    this.normalizedExtension,
    this.contentType,
  });

  factory PaymentReceiptValidationResult.valid({
    required String normalizedExtension,
    required String contentType,
  }) {
    return PaymentReceiptValidationResult(
      isValid: true,
      normalizedExtension: normalizedExtension,
      contentType: contentType,
    );
  }

  factory PaymentReceiptValidationResult.invalid(String errorMessage) {
    return PaymentReceiptValidationResult(
      isValid: false,
      errorMessage: errorMessage,
    );
  }
}

/// Centralized validator for customer payment receipts (PDF & Images).
///
/// Supported formats:
/// - PDF (`.pdf`) -> `application/pdf`
/// - JPG / JPEG (`.jpg`, `.jpeg`) -> `image/jpeg`
/// - PNG (`.png`) -> `image/png`
/// - WEBP (`.webp`) -> `image/webp`
/// - Maximum size: 10 MB (10 * 1024 * 1024 bytes)
class PaymentReceiptValidator {
  static const int maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

  static const List<String> allowedExtensions = [
    'pdf',
    'jpg',
    'jpeg',
    'png',
    'webp',
  ];

  /// Extracts the lowercase file extension from [fileName].
  static String getFileExtension(String fileName) {
    final clean = fileName.trim();
    if (!clean.contains('.')) return '';
    return clean.split('.').last.toLowerCase();
  }

  /// Checks if [fileName] has an allowed file extension.
  static bool isValidExtension(String fileName) {
    final ext = getFileExtension(fileName);
    return allowedExtensions.contains(ext);
  }

  /// Checks if [sizeBytes] is within the 10 MB limit (> 0 and <= 10MB).
  static bool isValidFileSize(int sizeBytes) {
    return sizeBytes > 0 && sizeBytes <= maxFileSizeBytes;
  }

  /// Resolves the official MIME contentType for Firebase Storage.
  static String getContentType(String extensionOrFileName) {
    final ext = extensionOrFileName.contains('.')
        ? getFileExtension(extensionOrFileName)
        : extensionOrFileName.trim().toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  /// Normalizes extension for the deterministic storage file name (`receipt.<ext>`).
  static String normalizeExtension(String fileName) {
    final ext = getFileExtension(fileName);
    if (ext == 'jpeg') return 'jpeg';
    if (ext == 'jpg') return 'jpg';
    if (ext == 'png') return 'png';
    if (ext == 'webp') return 'webp';
    if (ext == 'pdf') return 'pdf';
    return 'jpg';
  }

  /// Inspects magic header bytes to verify actual content type where feasible.
  /// Returns false if header is known and definitely mismatched or corrupted.
  static bool isValidHeader(List<int> bytes, String extension) {
    if (bytes.isEmpty) return false;
    final ext = extension.toLowerCase();

    if (ext == 'pdf') {
      // PDF header: starts with '%PDF-' (0x25, 0x50, 0x44, 0x46)
      if (bytes.length < 4) return false;
      return bytes[0] == 0x25 &&
          bytes[1] == 0x50 &&
          bytes[2] == 0x44 &&
          bytes[3] == 0x46;
    } else if (ext == 'jpg' || ext == 'jpeg') {
      // JPEG SOI marker: 0xFF, 0xD8, 0xFF
      if (bytes.length < 3) return false;
      return bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
    } else if (ext == 'png') {
      // PNG header: 0x89, 'PNG\r\n\x1a\n'
      if (bytes.length < 8) return false;
      return bytes[0] == 0x89 &&
          bytes[1] == 0x50 &&
          bytes[2] == 0x4E &&
          bytes[3] == 0x47 &&
          bytes[4] == 0x0D &&
          bytes[5] == 0x0A &&
          bytes[6] == 0x1A &&
          bytes[7] == 0x0A;
    } else if (ext == 'webp') {
      // WEBP header: 'RIFF' .... 'WEBP'
      if (bytes.length < 12) return false;
      return bytes[0] == 0x52 &&
          bytes[1] == 0x49 &&
          bytes[2] == 0x46 &&
          bytes[3] == 0x46 &&
          bytes[8] == 0x57 &&
          bytes[9] == 0x45 &&
          bytes[10] == 0x42 &&
          bytes[11] == 0x50;
    }

    return false;
  }

  /// Full pre-upload validation for customer payment receipts.
  static PaymentReceiptValidationResult validate({
    required String fileName,
    required int fileSizeBytes,
    Uint8List? bytes,
  }) {
    final cleanName = fileName.trim();
    if (cleanName.isEmpty) {
      return PaymentReceiptValidationResult.invalid('Please select a payment receipt file.');
    }

    final ext = getFileExtension(cleanName);
    if (!allowedExtensions.contains(ext)) {
      return PaymentReceiptValidationResult.invalid(
        'Invalid file format ($ext). Only PDF, JPG, PNG, and WEBP files are supported.',
      );
    }

    if (fileSizeBytes <= 0) {
      return PaymentReceiptValidationResult.invalid('Selected file is empty.');
    }

    if (fileSizeBytes > maxFileSizeBytes) {
      final sizeMb = (fileSizeBytes / (1024 * 1024)).toStringAsFixed(2);
      return PaymentReceiptValidationResult.invalid(
        'File size ($sizeMb MB) exceeds the maximum allowed limit of 10 MB.',
      );
    }

    if (bytes != null && bytes.isNotEmpty) {
      if (!isValidHeader(bytes, ext)) {
        return PaymentReceiptValidationResult.invalid(
          'Corrupted or invalid ${ext.toUpperCase()} file header.',
        );
      }
    }

    return PaymentReceiptValidationResult.valid(
      normalizedExtension: normalizeExtension(cleanName),
      contentType: getContentType(ext),
    );
  }

  /// Maximum allowed attachments per payment submission.
  static const int maxAttachments = 5;

  /// Checks if attachment count is within allowed bounds (1 to 5).
  static bool isValidAttachmentCount(int count) {
    return count >= 1 && count <= maxAttachments;
  }

  /// Validates a list of payment receipt attachments.
  ///
  /// Requirements:
  /// - At least 1 valid attachment is required.
  /// - Maximum 5 attachments allowed per submission.
  /// - PDF and images are alternative formats (or can be mixed).
  /// - Customers are never forced to upload both a PDF and an image.
  static PaymentReceiptValidationResult validateAttachments(List<ReceiptAttachmentItem> attachments) {
    if (attachments.isEmpty) {
      return PaymentReceiptValidationResult.invalid(
        'Please select at least one payment receipt or screenshot to upload.',
      );
    }

    if (attachments.length > maxAttachments) {
      return PaymentReceiptValidationResult.invalid(
        'Maximum $maxAttachments payment receipt attachments allowed per submission.',
      );
    }

    for (int i = 0; i < attachments.length; i++) {
      final item = attachments[i];
      final res = validate(
        fileName: item.name,
        fileSizeBytes: item.sizeBytes,
        bytes: item.bytes,
      );
      if (!res.isValid) {
        return PaymentReceiptValidationResult.invalid(
          'Attachment ${i + 1} (${item.name}): ${res.errorMessage}',
        );
      }
    }

    return PaymentReceiptValidationResult.valid(
      normalizedExtension: attachments.first.normalizedExtension,
      contentType: attachments.first.contentType,
    );
  }
}

/// Represents an attached payment receipt file in memory.
class ReceiptAttachmentItem {
  final String name;
  final int sizeBytes;
  final Uint8List? bytes;
  final String? path;

  const ReceiptAttachmentItem({
    required this.name,
    required this.sizeBytes,
    this.bytes,
    this.path,
  });

  String get normalizedExtension => PaymentReceiptValidator.normalizeExtension(name);
  String get contentType => PaymentReceiptValidator.getContentType(name);
  bool get isPdf => PaymentReceiptValidator.getFileExtension(name) == 'pdf';
}

