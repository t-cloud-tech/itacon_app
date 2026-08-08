import 'package:cloud_firestore/cloud_firestore.dart';

/// Single item within a Tile Order
class OrderItem {
  final String tileId;
  final String tileName;
  final String size;
  final String surface;
  final int quantity;
  final int moq;
  final double? unitPrice; // Null initially until Salesperson provides estimate
  final double? totalPrice; // Computed once unitPrice is set

  const OrderItem({
    required this.tileId,
    required this.tileName,
    required this.size,
    required this.surface,
    required this.quantity,
    required this.moq,
    this.unitPrice,
    this.totalPrice,
  });

  Map<String, dynamic> toMap() {
    return {
      'tileId': tileId,
      'tileName': tileName,
      'size': size,
      'surface': surface,
      'quantity': quantity,
      'moq': moq,
      'unitPrice': unitPrice,
      'totalPrice': totalPrice ?? (unitPrice != null ? unitPrice! * quantity : null),
    };
  }

  factory OrderItem.fromMap(Map<String, dynamic> map) {
    final qty = (map['quantity'] ?? 1).toInt();
    final uPrice = map['unitPrice'] != null ? (map['unitPrice'] as num).toDouble() : null;
    final tPrice = map['totalPrice'] != null
        ? (map['totalPrice'] as num).toDouble()
        : (uPrice != null ? uPrice * qty : null);

    return OrderItem(
      tileId: map['tileId'] ?? '',
      tileName: map['tileName'] ?? 'Tile Item',
      size: map['size'] ?? '600x1200',
      surface: map['surface'] ?? 'Glossy',
      quantity: qty,
      moq: (map['moq'] ?? 10).toInt(),
      unitPrice: uPrice,
      totalPrice: tPrice,
    );
  }
}

/// Represents an Order document in Cloud Firestore (Supports the 10-Step Flow)
class TileOrder {
  final String id;
  final String orderReferenceNumber; // Formatted reference: PO-{STATE}-{YEAR}-{RANDOM} (e.g. PO-GJ-2026-98104)
  final String stateCode; // State shortcode: GJ, MH, DL, KA, etc.
  final String userId;
  final String userCategory; // dealer, wholesaler, retailer, contractor, architect, builder
  final String? salespersonId;
  final String orderType; // 'ready_stock' (Ready Stock) or 'made_against_order' (Made Against Order)
  final String status;
  // Statuses:
  // - 'pending_salesperson_review'
  // - 'pending_manager_approval'
  // - 'estimate_provided'
  // - 'user_confirmed'
  // - 'sent_to_production'
  // - 'completed'
  // - 'cancelled'

  final String priceApprovalStatus; // 'none', 'pending_manager_approval', 'approved', 'rejected'
  final List<OrderItem> items;
  final String deliveryAddress;
  final bool transportRequired;
  final String remarks;
  final Map<String, dynamic> estimateDetails; // discountPercent, taxAmount, subtotal, grandTotal, salespersonNotes
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const TileOrder({
    required this.id,
    required this.orderReferenceNumber,
    this.stateCode = 'GJ',
    required this.userId,
    required this.userCategory,
    this.salespersonId,
    required this.orderType,
    required this.status,
    this.priceApprovalStatus = 'none',
    required this.items,
    required this.deliveryAddress,
    required this.transportRequired,
    required this.remarks,
    required this.estimateDetails,
    this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'orderReferenceNumber': orderReferenceNumber,
      'stateCode': stateCode,
      'userId': userId,
      'userCategory': userCategory,
      'salespersonId': salespersonId,
      'orderType': orderType,
      'status': status,
      'priceApprovalStatus': priceApprovalStatus,
      'items': items.map((item) => item.toMap()).toList(),
      'deliveryAddress': deliveryAddress,
      'transportRequired': transportRequired,
      'remarks': remarks,
      'estimateDetails': estimateDetails,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory TileOrder.fromMap(Map<String, dynamic> map, String docId) {
    return TileOrder(
      id: docId,
      orderReferenceNumber: map['orderReferenceNumber'] ?? 'PO-${map['stateCode'] ?? 'GJ'}-2026-${docId.substring(0, 5).toUpperCase()}',
      stateCode: map['stateCode'] ?? 'GJ',
      userId: map['userId'] ?? '',
      userCategory: map['userCategory'] ?? map['role'] ?? 'dealer',
      salespersonId: map['salespersonId'],
      orderType: map['orderType'] ?? 'ready_stock',
      status: map['status'] ?? 'pending_salesperson_review',
      priceApprovalStatus: map['priceApprovalStatus'] ?? 'none',
      items: (map['items'] as List<dynamic>?)
              ?.map((item) => OrderItem.fromMap(Map<String, dynamic>.from(item)))
              .toList() ??
          [],
      deliveryAddress: map['deliveryAddress'] ?? '',
      transportRequired: map['transportRequired'] ?? false,
      remarks: map['remarks'] ?? map['notes'] ?? '',
      estimateDetails: Map<String, dynamic>.from(map['estimateDetails'] ?? {
        'discountPercent': 0.0,
        'taxAmount': 0.0,
        'subtotal': 0.0,
        'grandTotal': 0.0,
        'salespersonNotes': '',
      }),
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
