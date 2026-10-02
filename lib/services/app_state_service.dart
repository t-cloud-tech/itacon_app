import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/tile_product.dart';
import '../models/user_profile.dart';
import 'firestore_service.dart';
import 'pricing_service.dart';
import 'user_demand_service.dart';

/// Represents an item in the user's cart
class CartItem {
  final TileProduct product;
  final String selectedSize;
  final String selectedFinish;
  int quantity;

  CartItem({
    required this.product,
    required this.selectedSize,
    required this.selectedFinish,
    this.quantity = 1,
  });

  Map<String, dynamic> toJson() {
    return {
      'product': product.toJson(),
      'selectedSize': selectedSize,
      'selectedFinish': selectedFinish,
      'quantity': quantity,
    };
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    final productRaw = json['product'];
    final Map<String, dynamic> productMap;
    if (productRaw is Map<String, dynamic>) {
      productMap = productRaw;
    } else if (productRaw is Map) {
      productMap = Map<String, dynamic>.from(productRaw);
    } else {
      productMap = <String, dynamic>{};
    }

    final product = TileProduct.fromJson(productMap);
    final size = json['selectedSize']?.toString() ??
        (product.size.isNotEmpty ? product.size : 'Standard');
    final finish = json['selectedFinish']?.toString() ??
        (product.surface.isNotEmpty
            ? product.surface
            : (product.finish.isNotEmpty ? product.finish : 'Standard'));
    final qty = (json['quantity'] as num?)?.toInt() ?? 1;

    return CartItem(
      product: product,
      selectedSize: size,
      selectedFinish: finish,
      quantity: qty > 0 ? qty : 1,
    );
  }

  double get effectiveUnitPrice => PricingService.instance.resolvePrice(product).unitPrice;
  double get sqFtPerBox => product.sqFtPerBox > 0 ? product.sqFtPerBox : 15.5;
  int get pcsPerBox => product.pcsPerBox > 0 ? product.pcsPerBox : 2;
  double get boxPrice => product.isAdhesive ? effectiveUnitPrice : (effectiveUnitPrice * pcsPerBox);
  double get itemTotal => boxPrice * quantity;

  int get quantityInBoxes => quantity;
  double get itemWeightKg => product.isAdhesive
      ? quantity * (product.bagWeightKg > 0 ? product.bagWeightKg : 20.0)
      : quantityInBoxes * (product.boxWeightKg > 0 ? product.boxWeightKg : 28.0);
  double get itemWeightTons => itemWeightKg / 1000.0;
}

/// AppStateService for reactive Cart, Favorites, and Live User Profile state management
class AppStateService extends ChangeNotifier {
  static final AppStateService instance = AppStateService._internal();
  AppStateService._internal();

  factory AppStateService() => instance;

  final List<CartItem> _cartItems = [];
  final Map<String, TileProduct> _favoriteProductsMap = {};

  UserProfile? _currentUserProfile;

  List<CartItem> get cartItems => List.unmodifiable(_cartItems);
  List<TileProduct> get favoriteProducts => List.unmodifiable(_favoriteProductsMap.values.toList());
  Set<String> get favoriteProductIds => Set.unmodifiable(_favoriteProductsMap.keys);

  int get cartCount => _cartItems.length;
  int get favoritesCount => _favoriteProductsMap.length;
  int get ordersCount => 0;

  int get totalBoxes => _cartItems.fold(0, (sum, item) => sum + item.quantityInBoxes);
  double get totalWeightKg => _cartItems.fold(0.0, (sum, item) => sum + item.itemWeightKg);
  double get totalWeightTons => totalWeightKg / 1000.0;

  double get subtotal =>
      _cartItems.fold(0.0, (sum, item) => sum + item.itemTotal);
  double get freightFee => 0.0;
  double get totalAmount => subtotal;

  bool isFavorite(String productId) => _favoriteProductsMap.containsKey(productId);

  // User Profile Getters & State Management
  UserProfile get currentUserProfile {
    return _currentUserProfile ??
        const UserProfile(
          userId: '',
          name: '',
          religion: '',
          dateOfBirth: '',
          companyName: '',
          phone: '',
          email: '',
          userCategory: '',
          role: '',
        );
  }

  bool get hasSessionProfile =>
      _currentUserProfile != null &&
      _currentUserProfile!.userId.isNotEmpty &&
      _currentUserProfile!.userId != 'GUEST_USER' &&
      _currentUserProfile!.name != 'Valued Partner' &&
      (Firebase.apps.isEmpty ||
          FirebaseAuth.instance.currentUser == null ||
          FirebaseAuth.instance.currentUser?.uid == _currentUserProfile!.userId);

  String? _currentCartUserId;

  /// Returns current active user ID for scoping local cart persistence
  String? get currentCartUserId {
    if (_currentCartUserId != null && _currentCartUserId!.isNotEmpty) {
      return _currentCartUserId;
    }
    if (_currentUserProfile != null &&
        _currentUserProfile!.userId.isNotEmpty &&
        _currentUserProfile!.userId != 'GUEST_USER' &&
        _currentUserProfile!.userId != 'guest_user') {
      return _currentUserProfile!.userId;
    }
    try {
      if (Firebase.apps.isNotEmpty) {
        final authUid = FirebaseAuth.instance.currentUser?.uid;
        if (authUid != null && authUid.isNotEmpty) {
          return authUid;
        }
      }
    } catch (_) {}
    return null;
  }

  /// SharedPreferences key for user-isolated cart persistence
  static String cartStorageKey(String userId) => 'cart_$userId';

  void setCurrentUserProfile(UserProfile profile) {
    if (profile.userId.isEmpty ||
        profile.userId == 'GUEST_USER' ||
        profile.name == 'Valued Partner') {
      return;
    }

    // Security check: only accept profile if UID matches active FirebaseAuth user
    try {
      if (Firebase.apps.isNotEmpty) {
        final currentAuthUser = FirebaseAuth.instance.currentUser;
        if (currentAuthUser != null && currentAuthUser.uid != profile.userId) {
          debugPrint('[AppStateService] Rejecting profile: UID does not match active FirebaseAuth user');
          return;
        }
      }
    } catch (_) {}

    _currentUserProfile = profile;
    if (_currentCartUserId != profile.userId) {
      loadUserCart(profile.userId);
    }
    notifyListeners();
  }

  void clearUserProfile() {
    _currentUserProfile = null;
    notifyListeners();
  }

  /// Clears in-memory cart without removing persisted storage (used on logout)
  void clearInMemoryCart() {
    _cartItems.clear();
    _currentCartUserId = null;
    notifyListeners();
  }

  /// Clears in-memory favorites
  void clearFavorites() {
    _favoriteProductsMap.clear();
    notifyListeners();
  }

  /// Clears in-memory cart and favorites; optionally removes persisted cart
  void clearCartAndFavorites({bool clearPersistedCart = false}) {
    if (clearPersistedCart) {
      clearCart();
    } else {
      clearInMemoryCart();
    }
    clearFavorites();
    UserDemandService.instance.reset();
    notifyListeners();
  }

  void updateUserProfileFields({
    String? name,
    String? religion,
    String? dateOfBirth,
    String? email,
    String? phone,
    String? countryCode,
    String? companyName,
    String? userCategory,
    String? city,
    String? state,
    String? region,
    String? fcmToken,
    String? pincode,
    String? gstNumber,
    String? profilePhotoUrl,
    List<String>? showroomImages,
    Map<String, dynamic>? address,
    String? salesPersonId,
    String? assignedSalespersonId,
    String? salespersonName,
    String? salespersonPhone,
    String? salespersonReferralCode,
  }) {
    final current = currentUserProfile;
    _currentUserProfile = current.copyWith(
      name: name ?? current.name,
      religion: religion ?? current.religion,
      dateOfBirth: dateOfBirth ?? current.dateOfBirth,
      email: email ?? current.email,
      phone: phone ?? current.phone,
      countryCode: countryCode ?? current.countryCode,
      companyName: companyName ?? current.companyName,
      userCategory: userCategory ?? current.userCategory,
      city: city ?? current.city,
      state: state ?? current.state,
      region: region ?? current.region,
      fcmToken: fcmToken ?? current.fcmToken,
      pincode: pincode ?? current.pincode,
      gstNumber: gstNumber ?? current.gstNumber,
      profilePhotoUrl: (profilePhotoUrl != null && profilePhotoUrl.isEmpty)
          ? ''
          : (profilePhotoUrl ?? current.profilePhotoUrl),
      avatarUrl: (profilePhotoUrl != null && profilePhotoUrl.isEmpty)
          ? ''
          : (profilePhotoUrl != null && profilePhotoUrl.isNotEmpty ? profilePhotoUrl : current.avatarUrl),
      showroomImages: showroomImages ?? current.showroomImages,
      address: address ?? current.address,
      salesPersonId: salesPersonId ?? current.salesPersonId,
      assignedSalespersonId: assignedSalespersonId ?? current.assignedSalespersonId,
      salespersonName: salespersonName ?? current.salespersonName,
      salespersonPhone: salespersonPhone ?? current.salespersonPhone,
      salespersonReferralCode: salespersonReferralCode ?? current.salespersonReferralCode,
    );
    notifyListeners();
  }

  /// Total number of tracked profile data points (12 fields)
  int get profileTotalFieldsCount => 12;

  /// Number of completed profile data fields
  int get profileFilledFieldsCount {
    final p = currentUserProfile;
    int count = 0;
    if (p.name.trim().isNotEmpty) count++;
    if (p.religion.trim().isNotEmpty) count++;
    if (p.dateOfBirth.trim().isNotEmpty) count++;
    if (p.phone.trim().isNotEmpty) count++;
    if (p.userCategory.trim().isNotEmpty) count++;
    if (p.email.trim().isNotEmpty) count++;
    if (p.companyName.trim().isNotEmpty) count++;
    if (p.gstNumber.trim().isNotEmpty) count++;
    if (p.address.isNotEmpty) count++;
    if (p.city.trim().isNotEmpty) count++;
    if (p.state.trim().isNotEmpty) count++;
    if (p.pincode.trim().isNotEmpty) count++;
    return count;
  }

  /// Calculates Profile Completion Percentage (0% - 100%)
  int get profileCompletionPercentage {
    return ((profileFilledFieldsCount / profileTotalFieldsCount) * 100).round().clamp(0, 100);
  }

  /// Returns list of pending details required to complete 100% profile
  List<Map<String, String>> get pendingProfileFields {
    final p = currentUserProfile;
    final List<Map<String, String>> pending = [];
    if (p.name.trim().isEmpty) {
      pending.add({'title': 'Full Name', 'field': 'name', 'points': '8%'});
    }
    if (p.religion.trim().isEmpty) {
      pending.add({'title': 'Religion', 'field': 'religion', 'points': '8%'});
    }
    if (p.dateOfBirth.trim().isEmpty) {
      pending.add({'title': 'Date of Birth', 'field': 'dateOfBirth', 'points': '8%'});
    }
    if (p.phone.trim().isEmpty) {
      pending.add({'title': 'Phone Number', 'field': 'phone', 'points': '9%'});
    }
    if (p.email.trim().isEmpty) {
      pending.add({'title': 'Email Address', 'field': 'email', 'points': '9%'});
    }
    if (p.companyName.trim().isEmpty) {
      pending.add({'title': 'Company / Firm Name', 'field': 'companyName', 'points': '9%'});
    }
    if (p.address.isEmpty) {
      pending.add({'title': 'Street Address', 'field': 'address', 'points': '9%'});
    }
    if (p.city.trim().isEmpty) {
      pending.add({'title': 'City', 'field': 'city', 'points': '9%'});
    }
    if (p.state.trim().isEmpty) {
      pending.add({'title': 'State', 'field': 'state', 'points': '9%'});
    }
    if (p.pincode.trim().isEmpty) {
      pending.add({'title': 'PIN Code', 'field': 'pincode', 'points': '9%'});
    }
    if (p.gstNumber.trim().isEmpty) {
      pending.add({'title': 'GST Number', 'field': 'gstNumber', 'points': '9%'});
    }
    return pending;
  }

  void toggleFavorite(dynamic target) {
    if (target is TileProduct) {
      if (_favoriteProductsMap.containsKey(target.id)) {
        _favoriteProductsMap.remove(target.id);
        UserDemandService.instance.recordWishlistRemove(
          productId: target.id,
          user: currentUserProfile,
        );
      } else {
        _favoriteProductsMap[target.id] = target;
        UserDemandService.instance.recordWishlistAdd(
          product: target,
          user: currentUserProfile,
        );
      }
    } else if (target is String) {
      if (_favoriteProductsMap.containsKey(target)) {
        _favoriteProductsMap.remove(target);
        UserDemandService.instance.recordWishlistRemove(
          productId: target,
          user: currentUserProfile,
        );
      }
    }
    notifyListeners();
  }

  /// Automatically loads user's saved wishlist from Cloud Firestore upon login or app launch
  Future<void> loadUserWishlist(String userId) async {
    if (userId.isEmpty || userId == 'guest_user') return;
    try {
      final items = await FirestoreService().getWishlistItems(userId);
      for (final item in items) {
        if (!_favoriteProductsMap.containsKey(item.productId)) {
          _favoriteProductsMap[item.productId] = TileProduct(
            id: item.productId,
            name: item.productName.isNotEmpty ? item.productName : 'Saved Tile',
            sku: item.sku.isNotEmpty ? item.sku : 'ITA-PROD-001',
            size: item.size.isNotEmpty ? item.size : '600x1200 mm',
            surface: item.surface.isNotEmpty ? item.surface : 'Glossy',
            color: item.color.isNotEmpty ? item.color : 'White',
            baseColour: item.color.isNotEmpty ? item.color : 'White',
            pattern: item.pattern.isNotEmpty ? item.pattern : 'Marble',
            basePrice: item.basePrice > 0 ? item.basePrice : 120.0,
            moq: 30,
            stockStatus: 'available_now',
            images: item.imageUrl.isNotEmpty ? [item.imageUrl] : [],
            finish: item.finish.isNotEmpty ? item.finish : 'Glossy',
            tileCategory: item.tileCategory.isNotEmpty ? item.tileCategory : 'Floor Tiles',
            productLine: item.productLine,
            collection: item.collection,
            spaces: item.spaces,
          );
        }
      }
      await UserDemandService.instance.initUserDemand(userId);
      notifyListeners();
    } catch (_) {}
  }

  /// Convenience method to log repeat searches into UserDemandService
  void recordSearchQuery(String query) {
    UserDemandService.instance.recordSearchDemand(
      query: query,
      user: currentUserProfile,
    );
  }

  /// Loads and deserializes the user's persisted local cart from SharedPreferences
  Future<void> loadUserCart(String userId) async {
    if (userId.isEmpty || userId == 'GUEST_USER' || userId == 'guest_user') return;
    _currentCartUserId = userId;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = cartStorageKey(userId);
      final rawJson = prefs.getString(key);
      if (rawJson == null || rawJson.trim().isEmpty) {
        _cartItems.clear();
        notifyListeners();
        return;
      }

      final decoded = jsonDecode(rawJson);
      if (decoded is! List) {
        debugPrint('[AppStateService] Corrupted cart data (not a list) for $userId');
        _cartItems.clear();
        notifyListeners();
        return;
      }

      final List<CartItem> restoredItems = [];
      for (final itemRaw in decoded) {
        try {
          if (itemRaw is Map<String, dynamic>) {
            restoredItems.add(CartItem.fromJson(itemRaw));
          } else if (itemRaw is Map) {
            restoredItems.add(CartItem.fromJson(Map<String, dynamic>.from(itemRaw)));
          }
        } catch (itemError) {
          debugPrint('[AppStateService] Skipping corrupt cart item: $itemError');
        }
      }

      _cartItems.clear();
      _cartItems.addAll(restoredItems);
      notifyListeners();
    } catch (e) {
      debugPrint('[AppStateService] Failed to load cart for $userId: $e');
      _cartItems.clear();
      notifyListeners();
    }
  }

  /// Automatically persists the current cart to SharedPreferences under `cart_<uid>`
  Future<void> _persistCart() async {
    final uid = currentCartUserId;
    if (uid == null || uid.isEmpty || uid == 'GUEST_USER' || uid == 'guest_user') {
      return;
    }
    // Synchronously serialize current items so subsequent clears/mutations cannot corrupt this write
    final listJson = _cartItems.map((item) => item.toJson()).toList();
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = cartStorageKey(uid);
      if (listJson.isEmpty) {
        await prefs.remove(key);
      } else {
        await prefs.setString(key, jsonEncode(listJson));
      }
    } catch (e) {
      debugPrint('[AppStateService] Failed to persist cart for $uid: $e');
    }
  }

  Future<void> addToCart(
    TileProduct product, {
    String? size,
    String? finish,
    int quantity = 1,
  }) async {
    final effectiveSize = (size != null && size.isNotEmpty)
        ? size
        : (product.size.isNotEmpty ? product.size : 'Standard');
    final effectiveFinish = (finish != null && finish.isNotEmpty)
        ? finish
        : (product.surface.isNotEmpty
            ? product.surface
            : (product.finish.isNotEmpty ? product.finish : 'Standard'));

    final existingIndex = _cartItems.indexWhere(
      (item) =>
          item.product.id == product.id &&
          item.selectedSize == effectiveSize &&
          item.selectedFinish == effectiveFinish,
    );

    if (existingIndex >= 0) {
      _cartItems[existingIndex].quantity += quantity;
    } else {
      _cartItems.add(
        CartItem(
          product: product,
          selectedSize: effectiveSize,
          selectedFinish: effectiveFinish,
          quantity: quantity,
        ),
      );
    }
    notifyListeners();
    await _persistCart();
  }

  Future<void> updateQuantity(CartItem item, int delta) async {
    item.quantity += delta;
    if (item.quantity <= 0) {
      _cartItems.remove(item);
    }
    notifyListeners();
    await _persistCart();
  }

  Future<void> setQuantity(CartItem item, int newQuantity) async {
    if (newQuantity <= 0) {
      _cartItems.remove(item);
    } else {
      item.quantity = newQuantity;
    }
    notifyListeners();
    await _persistCart();
  }

  Future<void> removeFromCart(CartItem item) async {
    _cartItems.remove(item);
    notifyListeners();
    await _persistCart();
  }

  Future<void> clearCart() async {
    _cartItems.clear();
    final uid = currentCartUserId;
    notifyListeners();
    if (uid != null && uid.isNotEmpty && uid != 'GUEST_USER' && uid != 'guest_user') {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(cartStorageKey(uid));
      } catch (e) {
        debugPrint('[AppStateService] Failed to remove persisted cart for $uid: $e');
      }
    }
  }
}
