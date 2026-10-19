import 'package:cloud_functions/cloud_functions.dart';
import '../models/business_defaulter_result.dart';

/// Base exception for Business Defaulter service operations
class BusinessDefaulterException implements Exception {
  final String message;
  final String? code;

  const BusinessDefaulterException(this.message, [this.code]);

  @override
  String toString() => message;
}

class DefaulterValidationException extends BusinessDefaulterException {
  const DefaulterValidationException(super.message, [super.code = 'invalid-argument']);
}

class DefaulterUnauthorizedException extends BusinessDefaulterException {
  const DefaulterUnauthorizedException(super.message, [super.code = 'permission-denied']);
}

class DefaulterRateLimitException extends BusinessDefaulterException {
  const DefaulterRateLimitException(super.message, [super.code = 'resource-exhausted']);
}

class DefaulterServiceUnavailableException extends BusinessDefaulterException {
  const DefaulterServiceUnavailableException(super.message, [super.code = 'unavailable']);
}

class DefaulterTimeoutException extends BusinessDefaulterException {
  const DefaulterTimeoutException(super.message, [super.code = 'deadline-exceeded']);
}

/// Service to interact with the secure server-side Business Defaulters Cloud Function proxy
class BusinessDefaulterService {
  final FirebaseFunctions? customFunctions;

  BusinessDefaulterService({this.customFunctions});

  FirebaseFunctions get _functions =>
      customFunctions ?? FirebaseFunctions.instanceFor(region: 'asia-south1');



  /// Normalizes and cleans GSTIN (15 alphanumeric characters, uppercase)
  static String normalizeGst(String? rawGst) {
    if (rawGst == null) return '';
    return rawGst.trim().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
  }

  /// Normalizes Indian phone number to 10 digits
  static String normalizePhone(String? rawPhone) {
    if (rawPhone == null) return '';
    final digits = rawPhone.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 12 && digits.startsWith('91')) {
      return digits.substring(2);
    }
    if (digits.length >= 10) {
      return digits.substring(digits.length - 10);
    }
    return digits;
  }

  /// Queries the Business Defaulters registry via the secure Firebase Cloud Function proxy.
  ///
  /// Requires at least one search parameter (`gst` or `phone`).
  /// Both parameters may be supplied for maximum matching precision.
  Future<BusinessDefaulterResult> checkDefaulter({
    String? gst,
    String? phone,
  }) async {
    final cleanedGst = normalizeGst(gst);
    final cleanedPhone = normalizePhone(phone);

    if (cleanedGst.isEmpty && cleanedPhone.isEmpty) {
      throw const DefaulterValidationException(
        "Please provide at least one search parameter: a valid GSTIN or 10-digit mobile number.",
      );
    }

    if (cleanedGst.isNotEmpty && cleanedGst.length != 15) {
      throw const DefaulterValidationException(
        "Invalid GSTIN. An Indian GSTIN must contain exactly 15 alphanumeric characters.",
      );
    }

    if (cleanedPhone.isNotEmpty && cleanedPhone.length != 10) {
      throw const DefaulterValidationException(
        "Invalid phone number. Please enter a valid 10-digit mobile number.",
      );
    }

    final payload = <String, dynamic>{};
    if (cleanedGst.isNotEmpty) payload['gst'] = cleanedGst;
    if (cleanedPhone.isNotEmpty) payload['phone'] = cleanedPhone;

    try {
      final callable = _functions.httpsCallable(
        'checkBusinessDefaulterCallable',
        options: HttpsCallableOptions(timeout: const Duration(seconds: 15)),
      );

      final response = await callable.call<Map<String, dynamic>>(payload);
      final data = Map<String, dynamic>.from(response.data);

      return BusinessDefaulterResult.fromJson(data);
    } on FirebaseFunctionsException catch (e) {
      switch (e.code) {
        case 'unauthenticated':
        case 'permission-denied':
          throw DefaulterUnauthorizedException(
            e.message ?? 'Access denied. You are not authorized to query the defaulter database.',
            e.code,
          );
        case 'invalid-argument':
          throw DefaulterValidationException(
            e.message ?? 'Invalid search parameters provided.',
            e.code,
          );
        case 'resource-exhausted':
          throw DefaulterRateLimitException(
            e.message ?? 'Search rate limit reached. Please wait a few minutes before retrying.',
            e.code,
          );
        case 'deadline-exceeded':
          throw DefaulterTimeoutException(
            e.message ?? 'Verification request timed out. Please check your internet connection.',
            e.code,
          );
        case 'unavailable':
        case 'failed-precondition':
        default:
          throw DefaulterServiceUnavailableException(
            e.message ?? 'The credit verification service is temporarily unavailable. Please try again shortly.',
            e.code,
          );
      }
    } catch (e) {
      if (e is BusinessDefaulterException) rethrow;
      throw BusinessDefaulterException(
        'An unexpected network error occurred while contacting the verification service. Details: $e',
      );
    }
  }
}
