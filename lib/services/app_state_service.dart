import 'package:flutter/material.dart';
import '../models/tile_product.dart';
import '../models/user_profile.dart';

import 'pricing_service.dart';

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

  double get effectiveUnitPrice => PricingService.instance.resolvePrice(product).unitPrice;
  double get sqFtPerBox => product.sqFtPerBox > 0 ? product.sqFtPerBox : 15.5;
  double get boxPrice => effectiveUnitPrice * sqFtPerBox;
  double get itemTotal => boxPrice * quantity;

  int get quantityInBoxes => quantity;
  double get itemWeightKg => quantityInBoxes * (product.boxWeightKg > 0 ? product.boxWeightKg : 28.0);
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

  int get cartCount => _cartItems.fold(0, (sum, item) => sum + item.quantity);
  int get favoritesCount => _favoriteProductsMap.length;
  int get ordersCount => 0;

  int get totalBoxes => _cartItems.fold(0, (sum, item) => sum + item.quantityInBoxes);
  double get totalWeightKg => _cartItems.fold(0.0, (sum, item) => sum + item.itemWeightKg);
  double get totalWeightTons => totalWeightKg / 1000.0;

  double get subtotal =>
      _cartItems.fold(0.0, (sum, item) => sum + item.itemTotal);
  double get freightFee => subtotal > 0 ? (subtotal > 10000 ? 0.0 : 450.0) : 0.0;
  double get totalAmount => subtotal + freightFee;

  bool isFavorite(String productId) => _favoriteProductsMap.containsKey(productId);

  // User Profile Getters & State Management
  UserProfile get currentUserProfile {
    return _currentUserProfile ??
        const UserProfile(
          userId: '',
          name: '',
          religion: '',
          companyName: '',
          phone: '',
          email: '',
          userCategory: 'Dealer',
          role: 'customer',
        );
  }

  bool get hasSessionProfile => _currentUserProfile != null;

  void setCurrentUserProfile(UserProfile profile) {
    _currentUserProfile = profile;
    notifyListeners();
  }

  void clearUserProfile() {
    _currentUserProfile = null;
    notifyListeners();
  }

  void clearCartAndFavorites() {
    _cartItems.clear();
    _favoriteProductsMap.clear();
    notifyListeners();
  }

  void updateUserProfileFields({
    String? name,
    String? religion,
    String? email,
    String? phone,
    String? companyName,
    String? userCategory,
    String? city,
    String? state,
    String? pincode,
    String? gstNumber,
    Map<String, dynamic>? address,
  }) {
    final current = currentUserProfile;
    _currentUserProfile = current.copyWith(
      name: name ?? current.name,
      religion: religion ?? current.religion,
      email: email ?? current.email,
      phone: phone ?? current.phone,
      companyName: companyName ?? current.companyName,
      userCategory: userCategory ?? current.userCategory,
      city: city ?? current.city,
      state: state ?? current.state,
      pincode: pincode ?? current.pincode,
      gstNumber: gstNumber ?? current.gstNumber,
      address: address ?? current.address,
    );
    notifyListeners();
  }

  /// Total number of tracked profile data points (11 fields)
  int get profileTotalFieldsCount => 11;

  /// Number of completed profile data fields
  int get profileFilledFieldsCount {
    final p = currentUserProfile;
    int count = 0;
    if (p.name.trim().isNotEmpty) count++;
    if (p.religion.trim().isNotEmpty) count++;
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
      pending.add({'title': 'Full Name', 'field': 'name', 'points': '9%'});
    }
    if (p.religion.trim().isEmpty) {
      pending.add({'title': 'Religion', 'field': 'religion', 'points': '9%'});
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
      } else {
        _favoriteProductsMap[target.id] = target;
      }
    } else if (target is String) {
      if (_favoriteProductsMap.containsKey(target)) {
        _favoriteProductsMap.remove(target);
      }
    }
    notifyListeners();
  }

  void addToCart(
    TileProduct product, {
    String size = '2 - 4 sq.ft',
    String finish = 'Polished',
    int quantity = 1,
  }) {
    final existingIndex = _cartItems.indexWhere(
      (item) =>
          item.product.id == product.id &&
          item.selectedSize == size &&
          item.selectedFinish == finish,
    );

    if (existingIndex >= 0) {
      _cartItems[existingIndex].quantity += quantity;
    } else {
      _cartItems.add(
        CartItem(
          product: product,
          selectedSize: size,
          selectedFinish: finish,
          quantity: quantity,
        ),
      );
    }
    notifyListeners();
  }

  void updateQuantity(CartItem item, int delta) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      _cartItems.remove(item);
    }
    notifyListeners();
  }

  void removeFromCart(CartItem item) {
    _cartItems.remove(item);
    notifyListeners();
  }

  void clearCart() {
    _cartItems.clear();
    notifyListeners();
  }
}
