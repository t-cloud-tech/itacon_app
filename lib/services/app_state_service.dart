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
  final Set<String> _favoriteProductIds = {};

  UserProfile? _currentUserProfile;

  List<CartItem> get cartItems => List.unmodifiable(_cartItems);
  Set<String> get favoriteProductIds => Set.unmodifiable(_favoriteProductIds);

  int get cartCount => _cartItems.fold(0, (sum, item) => sum + item.quantity);
  int get favoritesCount => _favoriteProductIds.length;
  int get ordersCount => 0;

  int get totalBoxes => _cartItems.fold(0, (sum, item) => sum + item.quantityInBoxes);
  double get totalWeightKg => _cartItems.fold(0.0, (sum, item) => sum + item.itemWeightKg);
  double get totalWeightTons => totalWeightKg / 1000.0;

  double get subtotal =>
      _cartItems.fold(0.0, (sum, item) => sum + item.itemTotal);
  double get freightFee => subtotal > 0 ? (subtotal > 10000 ? 0.0 : 450.0) : 0.0;
  double get totalAmount => subtotal + freightFee;

  bool isFavorite(String productId) => _favoriteProductIds.contains(productId);

  // User Profile Getters & State Management
  UserProfile get currentUserProfile {
    return _currentUserProfile ??
        const UserProfile(
          userId: 'GUEST_USER',
          name: 'Anil Kumar',
          companyName: 'Anil Granites & Tiles',
          phone: '+91 98765 43210',
          email: 'anil.kumar@itacongranito.com',
          userCategory: 'Dealer',
          role: 'customer',
          city: 'Morbi',
          state: 'Gujarat',
          pincode: '363642',
          gstNumber: '24AAAAA0000A1Z5',
          address: {
            'line1': 'Plot 42, Ceramic Industrial Zone',
            'city': 'Morbi',
            'state': 'Gujarat',
            'pincode': '363642',
          },
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

  void updateUserProfileFields({
    String? name,
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

  /// Calculates Profile Completion Percentage (0% - 100%)
  int get profileCompletionPercentage {
    final p = currentUserProfile;
    int percentage = 0;
    if (p.name.trim().isNotEmpty) percentage += 20; // Full Name
    if (p.phone.trim().isNotEmpty) percentage += 20; // Phone Number
    if (p.userCategory.trim().isNotEmpty) percentage += 15; // Category
    if (p.email.trim().isNotEmpty) percentage += 15; // Email Address
    if (p.companyName.trim().isNotEmpty) percentage += 10; // Company Name
    if (p.city.trim().isNotEmpty || p.pincode.trim().isNotEmpty || p.address.isNotEmpty) percentage += 10; // Delivery Address
    if (p.gstNumber.trim().isNotEmpty) percentage += 10; // GST Number
    return percentage.clamp(0, 100);
  }

  /// Returns list of pending details required to complete 100% profile
  List<Map<String, String>> get pendingProfileFields {
    final p = currentUserProfile;
    final List<Map<String, String>> pending = [];
    if (p.email.trim().isEmpty) {
      pending.add({'title': 'Email Address', 'field': 'email', 'points': '15%'});
    }
    if (p.companyName.trim().isEmpty) {
      pending.add({'title': 'Company / Firm Name', 'field': 'companyName', 'points': '10%'});
    }
    if (p.city.trim().isEmpty && p.pincode.trim().isEmpty && p.address.isEmpty) {
      pending.add({'title': 'Delivery Address & City', 'field': 'address', 'points': '10%'});
    }
    if (p.gstNumber.trim().isEmpty) {
      pending.add({'title': 'GST Number', 'field': 'gstNumber', 'points': '10%'});
    }
    return pending;
  }

  void toggleFavorite(String productId) {
    if (_favoriteProductIds.contains(productId)) {
      _favoriteProductIds.remove(productId);
    } else {
      _favoriteProductIds.add(productId);
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
