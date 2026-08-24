import '../models/tile_order.dart';
import '../models/estimate.dart';
import '../services/firestore_service.dart';
import '../services/app_state_service.dart';

/// Service handling Order and Estimate submission with automatic logistics metrics
class OrderService {
  static final OrderService instance = OrderService._internal();
  OrderService._internal();

  factory OrderService() => instance;

  final FirestoreService _firestore = FirestoreService.instance;

  /// Submits a Purchase Order to Firestore with automatic tonnage & box count tracking
  Future<TileOrder> submitOrder({
    required String userId,
    required String userCategory,
    required List<OrderItem> items,
    required String orderType,
    required String deliveryAddress,
    required bool transportRequired,
    required String remarks,
    int? totalBoxes,
    double? totalWeightKg,
    double? totalWeightTons,
    String stateCode = 'GJ',
    String? salespersonId,
  }) async {
    // Calculate total boxes and weight from items if not directly provided
    int boxes = totalBoxes ?? items.fold(0, (sum, i) => sum + i.quantity);
    double weightKg = totalWeightKg ?? (boxes * 28.0);
    double weightTons = totalWeightTons ?? (weightKg / 1000.0);

    return await _firestore.placeOrder(
      userId: userId,
      userCategory: userCategory,
      items: items,
      orderType: orderType,
      deliveryAddress: deliveryAddress,
      transportRequired: transportRequired,
      remarks: remarks,
      stateCode: stateCode,
      salespersonId: salespersonId,
      totalBoxes: boxes,
      totalWeightKg: weightKg,
      totalWeightTons: weightTons,
    );
  }

  /// Creates and sends an Estimate with totalWeightTons and totalBoxes included
  Future<Estimate> createEstimate({
    required String orderId,
    required String customerId,
    required String salesPersonId,
    required List<EstimateItem> items,
    required double subtotal,
    required double discount,
    required double tax,
    int? totalBoxes,
    double? totalWeightKg,
    double? totalWeightTons,
  }) async {
    int boxes = totalBoxes ?? items.fold(0, (sum, i) => sum + i.quantity);
    double weightKg = totalWeightKg ?? (boxes * 28.0);
    double weightTons = totalWeightTons ?? (weightKg / 1000.0);

    return await _firestore.createAndSendEstimate(
      orderId: orderId,
      customerId: customerId,
      salesPersonId: salesPersonId,
      items: items,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      totalBoxes: boxes,
      totalWeightKg: weightKg,
      totalWeightTons: weightTons,
    );
  }

  /// Converts AppStateService cart items to OrderItems with exact unit rates & weights
  List<OrderItem> cartToOrderItems(List<CartItem> cartItems) {
    return cartItems.map((cartItem) {
      final product = cartItem.product;
      final effectiveRate = cartItem.effectiveUnitPrice;
      return OrderItem(
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        size: cartItem.selectedSize,
        surface: cartItem.selectedFinish,
        color: product.color,
        quantity: cartItem.quantity,
        unit: product.unit,
        moq: product.moq,
        basePrice: product.basePrice,
        finalPrice: effectiveRate,
        lineTotal: cartItem.itemTotal,
      );
    }).toList();
  }
}
