import 'package:flutter/material.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';

/// CartProvider providing cart management with automatic weight (tonnage) calculations
class CartProvider extends ChangeNotifier {
  static final CartProvider instance = CartProvider._internal();
  CartProvider._internal() {
    AppStateService.instance.addListener(notifyListeners);
  }

  factory CartProvider() => instance;

  final AppStateService _appState = AppStateService.instance;

  List<CartItem> get items => _appState.cartItems;
  List<CartItem> get cartItems => _appState.cartItems;
  int get itemCount => _appState.cartCount;

  /// Helper getter: Sum of all item box quantities
  int get totalBoxes => _appState.totalBoxes;

  /// Helper getter: Sum of (item.quantityInBoxes * product.boxWeightKg)
  double get totalWeightKg => _appState.totalWeightKg;

  /// Helper getter: (totalWeightKg / 1000.0)
  double get totalWeightTons => _appState.totalWeightTons;

  double get subtotal => _appState.subtotal;
  double get freightFee => _appState.freightFee;
  double get totalAmount => _appState.totalAmount;

  void addToCart(
    TileProduct product, {
    String size = '2 - 4 sq.ft',
    String finish = 'Polished',
    int quantity = 1,
  }) {
    _appState.addToCart(product, size: size, finish: finish, quantity: quantity);
  }

  void updateQuantity(CartItem item, int delta) {
    _appState.updateQuantity(item, delta);
  }

  void removeFromCart(CartItem item) {
    _appState.removeFromCart(item);
  }

  void clearCart() {
    _appState.clearCart();
  }
}
