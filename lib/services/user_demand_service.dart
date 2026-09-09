import 'package:flutter/foundation.dart';
import '../models/tile_product.dart';
import '../models/user_profile.dart';
import '../models/wishlist.dart';
import 'firestore_service.dart';

/// Represents a recommended product with its contextual recommendation reasoning
class RecommendedProduct {
  final TileProduct product;
  final String reason;
  final double score;

  const RecommendedProduct({
    required this.product,
    required this.reason,
    this.score = 0.0,
  });
}

/// UserDemandService tracks user demand signals (wishlist additions, removals, and repeat searches)
/// and computes real-time, user-specific personalized product recommendations.
class UserDemandService extends ChangeNotifier {
  static final UserDemandService instance = UserDemandService._internal();
  UserDemandService._internal();

  factory UserDemandService() => instance;

  final FirestoreService _firestoreService = FirestoreService();

  // In-memory demand weights per user session
  final Map<String, int> _demandedCategories = {};
  final Map<String, int> _demandedSurfaces = {};
  final Map<String, int> _demandedFinishes = {};
  final Map<String, int> _demandedSizes = {};
  final Map<String, int> _demandedSpaces = {};
  final List<String> _recentSearches = [];
  final Set<String> _wishlistedProductIds = {};
  String? _lastWishlistedProductName;

  // Cached recommendation results for 60fps UI performance
  List<RecommendedProduct>? _cachedRecommendations;
  int _lastProductCount = 0;

  List<String> get recentSearches => List.unmodifiable(_recentSearches);
  Set<String> get wishlistedProductIds => Set.unmodifiable(_wishlistedProductIds);

  /// Initializes the demand profile from Firestore or previous state
  Future<void> initUserDemand(String userId) async {
    if (userId.isEmpty || userId == 'guest_user') return;
    try {
      final profile = await _firestoreService.getUserDemandProfile(userId);
      if (profile != null) {
        if (profile['demandedCategories'] is Map) {
          (profile['demandedCategories'] as Map).forEach((k, v) {
            if (v is num) _demandedCategories[k.toString()] = v.toInt();
          });
        }
        if (profile['demandedSurfaces'] is Map) {
          (profile['demandedSurfaces'] as Map).forEach((k, v) {
            if (v is num) _demandedSurfaces[k.toString()] = v.toInt();
          });
        }
        if (profile['demandedFinishes'] is Map) {
          (profile['demandedFinishes'] as Map).forEach((k, v) {
            if (v is num) _demandedFinishes[k.toString()] = v.toInt();
          });
        }
        if (profile['demandedSizes'] is Map) {
          (profile['demandedSizes'] as Map).forEach((k, v) {
            if (v is num) _demandedSizes[k.toString()] = v.toInt();
          });
        }
        if (profile['recentSearches'] is List) {
          _recentSearches.clear();
          _recentSearches.addAll(
            (profile['recentSearches'] as List).map((e) => e.toString()),
          );
        }
        if (profile['wishlistProductIds'] is List) {
          _wishlistedProductIds.clear();
          _wishlistedProductIds.addAll(
            (profile['wishlistProductIds'] as List).map((e) => e.toString()),
          );
        }
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Records when a user adds a product to their wishlist.
  /// Stores in Firestore with complete user data and updates demand weights.
  Future<void> recordWishlistAdd({
    required TileProduct product,
    required UserProfile user,
  }) async {
    final effectiveUserId = user.userId.isNotEmpty ? user.userId : 'guest_user';

    // 1. Update in-memory demand model
    _wishlistedProductIds.add(product.id);
    _lastWishlistedProductName = product.name;

    if (product.tileCategory.isNotEmpty) {
      _demandedCategories[product.tileCategory] =
          (_demandedCategories[product.tileCategory] ?? 0) + 1;
    }
    if (product.surface.isNotEmpty) {
      _demandedSurfaces[product.surface] =
          (_demandedSurfaces[product.surface] ?? 0) + 1;
    }
    if (product.finish.isNotEmpty) {
      _demandedFinishes[product.finish] =
          (_demandedFinishes[product.finish] ?? 0) + 1;
    }
    if (product.size.isNotEmpty) {
      _demandedSizes[product.size] =
          (_demandedSizes[product.size] ?? 0) + 1;
    }
    for (final space in product.spaces) {
      _demandedSpaces[space] = (_demandedSpaces[space] ?? 0) + 1;
    }

    _cachedRecommendations = null;
    notifyListeners();

    // 2. Persist to Firestore with full user and product data
    final wishlistItem = WishlistItem(
      productId: product.id,
      addedAt: DateTime.now(),
      userId: effectiveUserId,
      userName: user.name,
      userPhone: user.phone,
      userEmail: user.email,
      userCategory: user.userCategory,
      companyName: user.companyName,
      city: user.city,
      state: user.state,
      productName: product.name,
      sku: product.sku,
      tileCategory: product.tileCategory,
      productLine: product.productLine,
      surface: product.surface,
      finish: product.finish,
      size: product.size,
      color: product.color,
      pattern: product.pattern,
      basePrice: product.basePrice,
      imageUrl: product.images.isNotEmpty ? product.images.first : '',
      collection: product.collection,
      spaces: product.spaces,
      demandTags: [
        if (product.tileCategory.isNotEmpty) product.tileCategory,
        if (product.surface.isNotEmpty) product.surface,
        if (product.finish.isNotEmpty) product.finish,
        if (product.size.isNotEmpty) product.size,
        if (product.color.isNotEmpty) product.color,
        if (product.pattern.isNotEmpty) product.pattern,
      ],
    );

    try {
      await _firestoreService.addToWishlist(effectiveUserId, wishlistItem);
      await _firestoreService.logUserDemand(
        userId: effectiveUserId,
        action: 'wishlist_add',
        userName: user.name,
        userPhone: user.phone,
        userEmail: user.email,
        userCategory: user.userCategory,
        companyName: user.companyName,
        city: user.city,
        state: user.state,
        productId: product.id,
        productName: product.name,
        tileCategory: product.tileCategory,
        surface: product.surface,
        finish: product.finish,
        size: product.size,
        color: product.color,
      );
    } catch (_) {}
  }

  /// Records when a user removes a product from their wishlist
  Future<void> recordWishlistRemove({
    required String productId,
    required UserProfile user,
  }) async {
    final effectiveUserId = user.userId.isNotEmpty ? user.userId : 'guest_user';
    _wishlistedProductIds.remove(productId);
    _cachedRecommendations = null;
    notifyListeners();

    try {
      await _firestoreService.removeFromWishlist(effectiveUserId, productId);
      await _firestoreService.logUserDemand(
        userId: effectiveUserId,
        action: 'wishlist_remove',
        userName: user.name,
        userPhone: user.phone,
        userEmail: user.email,
        userCategory: user.userCategory,
        companyName: user.companyName,
        city: user.city,
        state: user.state,
        productId: productId,
      );
    } catch (_) {}
  }

  /// Records user search queries to analyze repeated searches and enhance recommendations
  Future<void> recordSearchDemand({
    required String query,
    required UserProfile user,
  }) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty || trimmed.length < 2) return;

    final effectiveUserId = user.userId.isNotEmpty ? user.userId : 'guest_user';

    // Avoid duplicate contiguous searches
    if (_recentSearches.isEmpty || _recentSearches.first.toLowerCase() != trimmed.toLowerCase()) {
      _recentSearches.insert(0, trimmed);
      if (_recentSearches.length > 10) {
        _recentSearches.removeLast();
      }
    }

    _cachedRecommendations = null;
    notifyListeners();

    try {
      await _firestoreService.logUserDemand(
        userId: effectiveUserId,
        action: 'search_repeat',
        userName: user.name,
        userPhone: user.phone,
        userEmail: user.email,
        userCategory: user.userCategory,
        companyName: user.companyName,
        city: user.city,
        state: user.state,
        searchQuery: trimmed,
      );
    } catch (_) {}
  }

  /// Computes personalized recommendations tailored specifically to the user
  /// based on their wishlist demand and search history.
  List<RecommendedProduct> getPersonalizedRecommendations({
    required List<TileProduct> allProducts,
    int limit = 6,
  }) {
    if (allProducts.isEmpty) return const [];

    // O(1) Instant Cache Hit to prevent lag during list scrolling and rebuilds
    if (_cachedRecommendations != null &&
        _lastProductCount == allProducts.length) {
      return _cachedRecommendations!.take(limit).toList();
    }

    final scoredList = <RecommendedProduct>[];

    for (final product in allProducts) {
      double score = 0.0;
      String? matchedReason;

      // 1. Check against active Wishlist attributes
      if (_lastWishlistedProductName != null &&
          _lastWishlistedProductName!.isNotEmpty &&
          product.name != _lastWishlistedProductName) {
        // High affinity for similar products
        if (_demandedSurfaces.containsKey(product.surface)) {
          score += 12.0 * (_demandedSurfaces[product.surface] ?? 1);
          matchedReason ??= 'Based on your Wishlist (${product.surface})';
        }
        if (_demandedCategories.containsKey(product.tileCategory)) {
          score += 10.0 * (_demandedCategories[product.tileCategory] ?? 1);
          matchedReason ??= 'Similar to your Wishlisted Tiles';
        }
        if (_demandedFinishes.containsKey(product.finish)) {
          score += 8.0 * (_demandedFinishes[product.finish] ?? 1);
          matchedReason ??= 'Preferred ${product.finish} finish';
        }
        if (_demandedSizes.containsKey(product.size)) {
          score += 7.0 * (_demandedSizes[product.size] ?? 1);
          matchedReason ??= 'Matches your favored size ${product.size}';
        }
      }

      // 2. Check against recent and repeated searches
      for (final search in _recentSearches) {
        final queryLower = search.toLowerCase();
        final nameLower = product.name.toLowerCase();
        final surfaceLower = product.surface.toLowerCase();
        final finishLower = product.finish.toLowerCase();
        final sizeLower = product.size.toLowerCase();
        final patternLower = product.pattern.toLowerCase();
        final catLower = product.tileCategory.toLowerCase();

        if (nameLower.contains(queryLower) ||
            surfaceLower.contains(queryLower) ||
            finishLower.contains(queryLower) ||
            patternLower.contains(queryLower) ||
            catLower.contains(queryLower)) {
          score += 15.0;
          matchedReason ??= 'Matches your search: "$search"';
        } else if (sizeLower.contains(queryLower)) {
          score += 10.0;
          matchedReason ??= 'Popular in $search';
        }
      }

      // 3. Demanded Spaces affinity
      for (final space in product.spaces) {
        if (_demandedSpaces.containsKey(space)) {
          score += 6.0 * (_demandedSpaces[space] ?? 1);
          matchedReason ??= 'Recommended for $space';
        }
      }

      // 4. Products already wishlisted receive penalty so user discovers NEW tiles
      if (_wishlistedProductIds.contains(product.id)) {
        score -= 50.0;
      }

      // 5. Default fallback score for top-rated / trending items
      if (score <= 0.0) {
        score = 1.0;
        matchedReason = 'Trending Luxury Pick';
      }

      scoredList.add(
        RecommendedProduct(
          product: product,
          reason: matchedReason ?? 'Suggested for You',
          score: score,
        ),
      );
    }

    // Sort descending by calculated affinity score
    scoredList.sort((a, b) => b.score.compareTo(a.score));

    _lastProductCount = allProducts.length;
    _cachedRecommendations = scoredList;

    return scoredList.take(limit).toList();
  }

  void reset() {
    _demandedCategories.clear();
    _demandedSurfaces.clear();
    _demandedFinishes.clear();
    _demandedSizes.clear();
    _demandedSpaces.clear();
    _recentSearches.clear();
    _wishlistedProductIds.clear();
    _lastWishlistedProductName = null;
    _cachedRecommendations = null;
    notifyListeners();
  }
}
