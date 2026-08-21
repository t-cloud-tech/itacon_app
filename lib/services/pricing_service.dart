import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/tile_product.dart';
import '../models/user_profile.dart';
import 'app_state_service.dart';

/// Pricing resolution result containing effective unit price, base price,
/// discount details, and UI chip metadata.
class ResolvedPrice {
  final double unitPrice;
  final double basePrice;
  final double discountPercent;
  final bool isCustomOverride;
  final bool isTierDiscounted;
  final String discountBadgeLabel;

  const ResolvedPrice({
    required this.unitPrice,
    required this.basePrice,
    this.discountPercent = 0.0,
    this.isCustomOverride = false,
    this.isTierDiscounted = false,
    this.discountBadgeLabel = '',
  });

  bool get hasDiscount => isCustomOverride || isTierDiscounted || unitPrice < basePrice;
}

/// Service handling trade tier discounts, SKU overrides, and price resolution waterfall
class PricingService extends ChangeNotifier {
  static final PricingService instance = PricingService._internal();
  PricingService._internal();

  factory PricingService() => instance;

  FirebaseFirestore get _firestore => FirebaseFirestore.instance;

  // In-memory cache for user custom prices: Map<"uid_productId", customPrice>
  final Map<String, double> _customPriceCache = {
    // Mock sample custom partner overrides for quick demonstration
    'USER_LOGIN_PROD_6012_01': 98.0, // Statuario Marble @ 98 instead of 120
    'GUEST_USER_PROD_6012_01': 102.0,
  };

  /// Category trade tier discount percentages matrix
  static const Map<String, double> tierDiscountMap = {
    'Wholesaler': 0.20, // 20% OFF
    'Wholesale': 0.20,
    'Dealer': 0.15, // 15% OFF
    'Authorized Dealer': 0.15,
    'Architect': 0.12, // 12% OFF
    'Builder': 0.10, // 10% OFF
    'Contractor': 0.08, // 8% OFF
    'Retailer': 0.00,
    'Retail': 0.00,
  };

  /// Registers a custom SKU price override for a specific user
  void setCustomPriceOverride(String userId, String productId, double customPrice) {
    _customPriceCache['${userId}_$productId'] = customPrice;
    notifyListeners();
  }

  /// Resolves the price waterfall for a product based on active user session:
  /// Waterfall: Custom User SKU Price -> Trade Category Tier Discount -> Standard Base Price
  ResolvedPrice resolvePrice(TileProduct product, [UserProfile? user]) {
    final activeUser = user ?? AppStateService.instance.currentUserProfile;
    final base = product.basePrice > 0 ? product.basePrice : product.basePricePerSqFt;

    // 1. Level 1: Custom User SKU Rate Override
    final cacheKey = '${activeUser.userId}_${product.id}';
    final skuCacheKey = '${activeUser.userId}_${product.productId}';
    final customPrice = _customPriceCache[cacheKey] ?? _customPriceCache[skuCacheKey];

    if (customPrice != null && customPrice > 0 && customPrice < base) {
      final discountPct = ((base - customPrice) / base) * 100.0;
      return ResolvedPrice(
        unitPrice: customPrice,
        basePrice: base,
        discountPercent: discountPct,
        isCustomOverride: true,
        isTierDiscounted: false,
        discountBadgeLabel: 'Your Partner Rate',
      );
    }

    // 2. Level 2: Category Trade Tier Discount
    final category = activeUser.userCategory;
    final tierDiscountRatio = tierDiscountMap[category] ?? 0.0;

    if (tierDiscountRatio > 0.0) {
      final tierPrice = base * (1.0 - tierDiscountRatio);
      final discountPct = tierDiscountRatio * 100.0;
      return ResolvedPrice(
        unitPrice: tierPrice,
        basePrice: base,
        discountPercent: discountPct,
        isCustomOverride: false,
        isTierDiscounted: true,
        discountBadgeLabel: '${category.toUpperCase()} RATE (${discountPct.toStringAsFixed(0)}% OFF)',
      );
    }

    // 3. Level 3: Standard Base Price
    return ResolvedPrice(
      unitPrice: base,
      basePrice: base,
      discountPercent: 0.0,
      isCustomOverride: false,
      isTierDiscounted: false,
      discountBadgeLabel: '',
    );
  }

  /// Fetches all custom contract rates assigned to this user in `customerPricing`
  Future<List<Map<String, dynamic>>> fetchUserContractRates(String userId) async {
    final List<Map<String, dynamic>> contractRates = [];

    // Include cached local overrides
    _customPriceCache.forEach((key, price) {
      if (key.startsWith('${userId}_')) {
        final prodId = key.substring(userId.length + 1);
        contractRates.add({
          'productId': prodId,
          'customPrice': price,
          'updatedAt': DateTime.now(),
        });
      }
    });

    try {
      final snap = await _firestore
          .collection('customerPricing')
          .where('userId', isEqualTo: userId)
          .get();

      for (var doc in snap.docs) {
        final data = doc.data();
        final pId = data['productId'] as String? ?? '';
        final cPrice = (data['customPrice'] as num?)?.toDouble() ?? 0.0;

        if (pId.isNotEmpty && cPrice > 0) {
          _customPriceCache['${userId}_$pId'] = cPrice;
          contractRates.add({
            'productId': pId,
            'customPrice': cPrice,
            'updatedAt': (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
          });
        }
      }
    } catch (_) {}

    return contractRates;
  }
}
