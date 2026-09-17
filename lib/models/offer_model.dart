import 'package:cloud_firestore/cloud_firestore.dart';
import 'user_profile.dart';

/// Target audience options for promotional offers
class OfferTargetAudience {
  static const String allCustomers = 'all_customers';
  static const String existingCustomers = 'existing_customers';
  static const String selectedCustomers = 'selected_customers';
  static const String regionBased = 'region_based';

  static const List<String> all = [
    allCustomers,
    existingCustomers,
    selectedCustomers,
    regionBased,
  ];
}

/// Offer type options
class OfferType {
  static const String percentageDiscount = 'percentage_discount';
  static const String flatDiscount = 'flat_discount';
  static const String tierBonus = 'tier_bonus';
  static const String clearance = 'clearance';
  static const String festiveDeal = 'festive_deal';
  static const String general = 'general';

  static const List<String> all = [
    percentageDiscount,
    flatDiscount,
    tierBonus,
    clearance,
    festiveDeal,
    general,
  ];
}

/// Represents an Offer document in the `offers` collection
class OfferModel {
  final String offerId; // Unique document ID
  final String title; // Short headline
  final String message; // Detailed description / marketing copy
  final String? bannerImageUrl; // Optional promotional graphic
  final String offerType; // percentage_discount, flat_discount, etc.
  final String? discountText; // e.g. "20% OFF", "Flat ₹5,000 Off"
  final DateTime? validFrom; // Start date of offer
  final DateTime? validUntil; // Expiration date of offer
  final List<String> applicableRegions; // ['All'] or specific region list
  final String targetAudience; // all_customers, existing_customers, selected_customers, region_based
  final List<String> selectedCustomerIds; // List of user IDs when targetAudience == 'selected_customers'
  final double? minimumOrderValue; // Optional minimum purchase requirement
  final String? termsAndConditions; // Optional fine print
  final bool isActive; // Master toggle
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const OfferModel({
    required this.offerId,
    required this.title,
    required this.message,
    this.bannerImageUrl,
    this.offerType = OfferType.general,
    this.discountText,
    this.validFrom,
    this.validUntil,
    this.applicableRegions = const ['All'],
    this.targetAudience = OfferTargetAudience.allCustomers,
    this.selectedCustomerIds = const [],
    this.minimumOrderValue,
    this.termsAndConditions,
    this.isActive = true,
    this.createdAt,
    this.updatedAt,
  });

  String get id => offerId;

  /// Whether the offer is currently expired based on [validUntil]
  bool get isExpired {
    if (validUntil == null) return false;
    return DateTime.now().isAfter(validUntil!);
  }

  /// Whether the offer has not yet started based on [validFrom]
  bool get isUpcoming {
    if (validFrom == null) return false;
    return DateTime.now().isBefore(validFrom!);
  }

  /// Whether the offer is currently active and within its valid date window
  bool get isCurrentlyValid {
    return isActive && !isExpired && !isUpcoming;
  }

  /// Evaluates whether this offer applies to the given user based on [targetAudience],
  /// [selectedCustomerIds], and [applicableRegions].
  bool matchesUser({
    required UserProfile user,
    int totalOrders = 0,
  }) {
    if (!isCurrentlyValid) return false;

    // Inactive or blocked users are not eligible
    if (user.status == 'inactive' || user.status == 'blocked') {
      return false;
    }

    switch (targetAudience) {
      case OfferTargetAudience.allCustomers:
        // Applies to all registered customers
        return true;

      case OfferTargetAudience.existingCustomers:
        // Must have at least 1 confirmed order
        return totalOrders > 0;

      case OfferTargetAudience.selectedCustomers:
        // Must be explicitly listed in selectedCustomerIds
        return selectedCustomerIds.contains(user.userId);

      case OfferTargetAudience.regionBased:
        // Must match one of the applicable regions
        if (applicableRegions.contains('All')) return true;
        final userRegion = user.region.trim();
        return applicableRegions.any((r) => r.trim().toLowerCase() == userRegion.toLowerCase());

      default:
        return false;
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'offerId': offerId,
      'id': offerId,
      'title': title,
      'message': message,
      if (bannerImageUrl != null && bannerImageUrl!.isNotEmpty) 'bannerImageUrl': bannerImageUrl,
      'offerType': offerType,
      if (discountText != null && discountText!.isNotEmpty) 'discountText': discountText,
      'validFrom': validFrom != null ? Timestamp.fromDate(validFrom!) : null,
      'validUntil': validUntil != null ? Timestamp.fromDate(validUntil!) : null,
      'applicableRegions': applicableRegions,
      'targetAudience': targetAudience,
      'selectedCustomerIds': selectedCustomerIds,
      if (minimumOrderValue != null) 'minimumOrderValue': minimumOrderValue,
      if (termsAndConditions != null && termsAndConditions!.isNotEmpty)
        'termsAndConditions': termsAndConditions,
      'isActive': isActive,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory OfferModel.fromMap(Map<String, dynamic> map, String docId) {
    DateTime? parseDate(dynamic value) {
      if (value is Timestamp) return value.toDate();
      if (value is String) return DateTime.tryParse(value);
      return null;
    }

    return OfferModel(
      offerId: docId.isNotEmpty ? docId : (map['offerId'] ?? map['id'] ?? ''),
      title: map['title'] ?? '',
      message: map['message'] ?? '',
      bannerImageUrl: map['bannerImageUrl'] as String?,
      offerType: map['offerType'] ?? OfferType.general,
      discountText: map['discountText'] as String?,
      validFrom: parseDate(map['validFrom']),
      validUntil: parseDate(map['validUntil']),
      applicableRegions: List<String>.from(map['applicableRegions'] ?? ['All']),
      targetAudience: map['targetAudience'] ?? OfferTargetAudience.allCustomers,
      selectedCustomerIds: List<String>.from(map['selectedCustomerIds'] ?? []),
      minimumOrderValue: (map['minimumOrderValue'] as num?)?.toDouble(),
      termsAndConditions: map['termsAndConditions'] as String?,
      isActive: map['isActive'] as bool? ?? true,
      createdAt: parseDate(map['createdAt']),
      updatedAt: parseDate(map['updatedAt']),
    );
  }

  factory OfferModel.fromSnapshot(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return OfferModel.fromMap(data, doc.id);
  }

  OfferModel copyWith({
    String? offerId,
    String? title,
    String? message,
    String? bannerImageUrl,
    String? offerType,
    String? discountText,
    DateTime? validFrom,
    DateTime? validUntil,
    List<String>? applicableRegions,
    String? targetAudience,
    List<String>? selectedCustomerIds,
    double? minimumOrderValue,
    String? termsAndConditions,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return OfferModel(
      offerId: offerId ?? this.offerId,
      title: title ?? this.title,
      message: message ?? this.message,
      bannerImageUrl: bannerImageUrl ?? this.bannerImageUrl,
      offerType: offerType ?? this.offerType,
      discountText: discountText ?? this.discountText,
      validFrom: validFrom ?? this.validFrom,
      validUntil: validUntil ?? this.validUntil,
      applicableRegions: applicableRegions ?? this.applicableRegions,
      targetAudience: targetAudience ?? this.targetAudience,
      selectedCustomerIds: selectedCustomerIds ?? this.selectedCustomerIds,
      minimumOrderValue: minimumOrderValue ?? this.minimumOrderValue,
      termsAndConditions: termsAndConditions ?? this.termsAndConditions,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
