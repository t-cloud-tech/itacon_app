import '../models/tile_order.dart';
import '../models/estimate.dart';
import '../services/firestore_service.dart';
import '../services/app_state_service.dart';
import '../utils/profile_validator.dart';

/// Service handling Order and Estimate submission with automatic logistics metrics
class OrderService {
  static final OrderService instance = OrderService._internal();
  final FirestoreService _firestore;

  OrderService._internal([FirestoreService? firestore])
      : _firestore = firestore ?? FirestoreService.instance;

  factory OrderService({FirestoreService? firestore}) {
    if (firestore != null) {
      return OrderService._internal(firestore);
    }
    return instance;
  }

  /// Submits a Purchase Order to Firestore with automatic tonnage & box count tracking
  Future<TileOrder> submitOrder({
    required String userId,
    String? customerName,
    String? companyName,
    String? customerPhone,
    String? customerEmail,
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
    String paymentMethod = 'bank_transfer',
  }) async {
    // -------------------------------------------------------------------------
    // SERVICE-LEVEL PROFILE VALIDATION:
    // Fetch authoritative latest profile record from Firestore before placing PO.
    // Prevents client-side bypass or manipulated local state.
    // -------------------------------------------------------------------------
    final latestProfile = await _firestore.getUserProfile(userId);
    final targetProfile = latestProfile ?? AppStateService.instance.currentUserProfile;
    final eligibility = ProfileOrderingValidator.validate(targetProfile);

    if (!eligibility.isEligible) {
      throw Exception(
        'Order submission blocked: Mandatory customer profile details are missing or invalid (${eligibility.allIssues.join(", ")}). Please complete your profile.',
      );
    }

    // Calculate total boxes and weight from items if not directly provided
    int boxes = totalBoxes ?? items.fold(0, (sum, i) => sum + i.quantity);
    double weightKg = totalWeightKg ?? (boxes * 28.0);
    double weightTons = totalWeightTons ?? (weightKg / 1000.0);

    final effectiveSpId = (salespersonId != null && salespersonId.isNotEmpty)
        ? salespersonId
        : AppStateService.instance.currentUserProfile.salesPersonId;

    return await _firestore.placeOrder(
      userId: userId,
      customerName: customerName ?? AppStateService.instance.currentUserProfile.name,
      companyName: companyName ?? AppStateService.instance.currentUserProfile.companyName,
      customerPhone: customerPhone ?? AppStateService.instance.currentUserProfile.phone,
      customerEmail: customerEmail ?? AppStateService.instance.currentUserProfile.email,
      userCategory: userCategory,
      items: items,
      orderType: orderType,
      deliveryAddress: deliveryAddress,
      transportRequired: transportRequired,
      remarks: remarks,
      stateCode: stateCode,
      salespersonId: effectiveSpId,
      totalBoxes: boxes,
      totalWeightKg: weightKg,
      totalWeightTons: weightTons,
      paymentMethod: paymentMethod,
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
      final isAdh = product.isAdhesive;
      return OrderItem(
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        size: isAdh ? '${product.bagWeightKg.toInt()} kg Bag' : cartItem.selectedSize,
        surface: isAdh ? (product.classification.isNotEmpty ? product.classification : product.surface) : cartItem.selectedFinish,
        color: product.color,
        quantity: cartItem.quantity,
        quantityBoxes: cartItem.quantity,
        quantitySqFt: isAdh ? 0.0 : cartItem.quantity * cartItem.sqFtPerBox,
        unit: isAdh ? 'bag' : product.unit,
        moq: product.moq,
        basePrice: product.basePrice,
        finalPrice: 0.0,
        unitPrice: null, // Null on PO creation, to be quoted by salesperson
        lineTotal: null,
      );
    }).toList();
  }
}

