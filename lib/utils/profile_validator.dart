import '../models/user_profile.dart';
import '../models/user_category.dart';

/// Represents the result of validating a customer profile for ordering eligibility.
class ProfileOrderingEligibility {
  final bool isEligible;
  final List<String> missingFields;
  final List<String> invalidFields;

  const ProfileOrderingEligibility({
    required this.isEligible,
    this.missingFields = const [],
    this.invalidFields = const [],
  });

  /// All issues (missing + invalid format) formatted for user presentation.
  List<String> get allIssues => [...missingFields, ...invalidFields];

  /// Human-readable explanation of why the profile cannot place an order yet.
  String get summaryMessage {
    if (isEligible) {
      return 'Profile is complete and eligible for ordering.';
    }
    final issues = allIssues.join(', ');
    return 'Please complete your profile to place an order: $issues.';
  }
}

/// Centralized, reusable profile validator for tile purchase ordering.
///
/// Rules:
/// - Customer full name: non-empty, at least 2 chars
/// - Verified phone number: non-empty, phoneVerified or isVerified == true
/// - Genuine email address: non-empty, valid email format, not dummy user_*@itacon.com
/// - Customer category: non-empty and one of the valid customer categories
/// - Company / firm name: non-empty
/// - Street address: non-empty line1 / addressLine
/// - City: non-empty
/// - State: non-empty
/// - PIN code: valid 6-digit Indian PIN code (100000 - 999999)
/// - Religion: OPTIONAL for ordering (does not block order)
/// - Date of birth: OPTIONAL for ordering (does not block order)
/// - GSTIN: Not mandatory solely for being wholesaler/dealer/trader.
///   If provided, its 15-character format is validated.
class ProfileOrderingValidator {
  static final RegExp _emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  );

  static final RegExp _pincodeRegex = RegExp(
    r'^[1-9][0-9]{5}$',
  );

  static final RegExp _gstinRegex = RegExp(
    r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
  );

  /// Validates a [UserProfile] for tile purchase order submission.
  static ProfileOrderingEligibility validate(UserProfile? profile) {
    if (profile == null) {
      return const ProfileOrderingEligibility(
        isEligible: false,
        missingFields: ['Customer Profile'],
      );
    }

    final missing = <String>[];
    final invalid = <String>[];

    // 1. Customer full name
    final name = profile.name.trim();
    if (name.isEmpty) {
      missing.add('Full Name');
    } else if (name.length < 2) {
      invalid.add('Full Name (at least 2 characters)');
    }

    // 2. Verified phone number
    final phone = profile.phone.trim();
    if (phone.isEmpty) {
      missing.add('Phone Number');
    } else if (!profile.phoneVerified && !profile.isVerified) {
      invalid.add('Verified Phone Number');
    }

    // 3. Valid genuine email address
    final email = profile.email.trim();
    if (email.isEmpty) {
      missing.add('Email Address');
    } else if (email.toLowerCase().startsWith('user_') &&
        email.toLowerCase().endsWith('@itacon.com')) {
      missing.add('Genuine Email Address');
    } else if (!_emailRegex.hasMatch(email)) {
      invalid.add('Valid Email Address');
    }

    // 4. Customer category
    final category = profile.userCategory.trim();
    if (category.isEmpty || !UserCategory.isValidCategory(category)) {
      missing.add('Customer Category');
    }

    // 5. Company / firm name
    final company = profile.companyName.trim();
    if (company.isEmpty) {
      missing.add('Company / Firm Name');
    }

    // 6. Street address
    final street = (profile.address['line1'] ??
            profile.address['addressLine'] ??
            profile.address['street'] ??
            profile.address['address'] ??
            '')
        .toString()
        .trim();
    if (street.isEmpty) {
      missing.add('Street Address');
    }

    // 7. City
    final city = profile.city.trim().isNotEmpty
        ? profile.city.trim()
        : (profile.address['city'] ?? profile.address['district'] ?? '')
            .toString()
            .trim();
    if (city.isEmpty) {
      missing.add('City');
    }

    // 8. State
    final state = profile.state.trim().isNotEmpty
        ? profile.state.trim()
        : (profile.address['state'] ?? profile.address['stateCode'] ?? '')
            .toString()
            .trim();
    if (state.isEmpty) {
      missing.add('State');
    }

    // 9. Valid 6-digit PIN code
    final pincode = profile.pincode.trim().isNotEmpty
        ? profile.pincode.trim()
        : (profile.address['pincode'] ??
                profile.address['postalCode'] ??
                profile.address['pin'] ??
                '')
            .toString()
            .trim();
    if (pincode.isEmpty) {
      missing.add('PIN Code');
    } else if (!_pincodeRegex.hasMatch(pincode)) {
      invalid.add('Valid 6-digit PIN Code');
    }

    // 10. Account status check
    final status = profile.status.trim().toLowerCase();
    if (status.isNotEmpty &&
        (status == 'blocked' ||
            status == 'inactive' ||
            status == 'suspended' ||
            status == 'pending' ||
            status == 'rejected' ||
            status == 'pending_salesperson_verification')) {
      invalid.add('Active Account Status');
    }

    // 11. GSTIN validation:
    // Follow confirmed ITACON business policy:
    // Do NOT automatically require GSTIN solely because the customer is a wholesaler, dealer, or trader.
    // If GSTIN is provided, validate its 15-character format.
    final gst = profile.gstNumber.trim().toUpperCase();
    if (gst.isNotEmpty) {
      if (!_gstinRegex.hasMatch(gst)) {
        invalid.add('Valid 15-character GSTIN');
      }
    }

    final isEligible = missing.isEmpty && invalid.isEmpty;
    return ProfileOrderingEligibility(
      isEligible: isEligible,
      missingFields: missing,
      invalidFields: invalid,
    );
  }
}
