import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';

/// Represents the sanitized business entity lookup result returned by the secure Cloud Function
class GstLookupResult {
  final bool success;
  final String? error; // 'invalid-gst', 'not-found', 'unavailable'
  final String? message;
  final String? gstin;
  final String? companyName;
  final String? address;
  final String? city;
  final String? state;
  final String? stateCode;
  final String? pan;
  final String? pincode;
  final String? gstStatus; // 'Active', 'Cancelled', 'Inactive', 'Not found'
  final bool cached;

  const GstLookupResult({
    required this.success,
    this.error,
    this.message,
    this.gstin,
    this.companyName,
    this.address,
    this.city,
    this.state,
    this.stateCode,
    this.pan,
    this.pincode,
    this.gstStatus,
    this.cached = false,
  });

  bool get isActive => (gstStatus ?? '').toLowerCase() == 'active';
  bool get isCancelledOrInactive {
    final s = (gstStatus ?? '').toLowerCase();
    return s == 'cancelled' || s == 'inactive';
  }

  factory GstLookupResult.fromMap(Map<String, dynamic> map) {
    return GstLookupResult(
      success: map['success'] == true,
      error: map['error'] as String?,
      message: map['message'] as String?,
      gstin: map['gstin'] as String?,
      companyName: map['companyName'] as String?,
      address: map['address'] as String?,
      city: map['city'] as String?,
      state: map['state'] as String?,
      stateCode: map['stateCode'] as String?,
      pan: map['pan'] as String?,
      pincode: map['pincode'] as String?,
      gstStatus: map['gstStatus'] as String?,
      cached: map['cached'] == true,
    );
  }

  factory GstLookupResult.error({
    required String error,
    required String message,
    String? gstStatus,
  }) {
    return GstLookupResult(
      success: false,
      error: error,
      message: message,
      gstStatus: gstStatus,
    );
  }
}

/// Service to lookup official Indian GST business entity details via server-side Cloud Function proxy
class GstService {
  final FirebaseFunctions? customFunctions;

  GstService({this.customFunctions});

  FirebaseFunctions get _functions =>
      customFunctions ?? FirebaseFunctions.instanceFor(region: 'asia-south1');

  static final RegExp gstRegex =
      RegExp(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');

  /// Validates format of an Indian GSTIN (15 characters alphanumeric with standard pattern)
  static bool isValidGstFormat(String? gst) {
    if (gst == null) return false;
    final cleaned = gst.trim().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    if (cleaned.length != 15) return false;
    return gstRegex.hasMatch(cleaned);
  }

  /// Extracts 10-character Permanent Account Number (PAN) from GSTIN (characters 3-12)
  static String? extractPan(String? gst) {
    if (gst == null) return null;
    final cleaned = gst.trim().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    if (cleaned.length >= 12) {
      return cleaned.substring(2, 12);
    }
    return null;
  }

  /// Extracts 2-digit Indian State code from GSTIN (first 2 digits)
  static String? extractStateCode(String? gst) {
    if (gst == null) return null;
    final cleaned = gst.trim().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2);
    }
    return null;
  }

  /// Standard mapping table for Indian 2-digit GST state codes
  static const Map<String, String> stateCodeMap = {
    '01': 'Jammu & Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh',
    '97': 'Other Territory',
  };

  /// Resolves State name from 2-digit GST state code
  static String? getStateNameFromCode(String? code) {
    if (code == null) return null;
    return stateCodeMap[code.trim()];
  }

  /// Looks up business details from server callable Cloud Function `lookupGstDetails`.
  /// Never throws exceptions; returns typed GstLookupResult.
  Future<GstLookupResult> lookupGst(String rawGst) async {
    final cleaned = rawGst.trim().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

    if (cleaned.length != 15 || !gstRegex.hasMatch(cleaned)) {
      return GstLookupResult.error(
        error: 'invalid-gst',
        message: 'Invalid GSTIN format. Must be a 15-character valid Indian GSTIN.',
      );
    }

    try {
      final callable = _functions.httpsCallable(
        'lookupGstDetails',
        options: HttpsCallableOptions(timeout: const Duration(seconds: 12)),
      );

      final response = await callable.call<Map<String, dynamic>>({
        'gstin': cleaned,
      });

      final data = Map<String, dynamic>.from(response.data);
      return GstLookupResult.fromMap(data);
    } on FirebaseFunctionsException catch (e) {
      debugPrint('[GstService] FirebaseFunctionsException: code=${e.code}, msg=${e.message}');
      if (e.code == 'invalid-argument') {
        return GstLookupResult.error(
          error: 'invalid-gst',
          message: e.message ?? 'Invalid GSTIN format.',
        );
      }
      return GstLookupResult.error(
        error: 'unavailable',
        message: "Couldn't fetch GST details. Please enter details manually.",
      );
    } catch (e) {
      debugPrint('[GstService] Unexpected error: $e');
      return GstLookupResult.error(
        error: 'unavailable',
        message: "Couldn't fetch GST details. Please enter details manually.",
      );
    }
  }
}

