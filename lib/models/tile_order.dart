import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';

/// Single item snapshot within `orders/{orderId}/orderItems/{productId}` per PDF schema
class OrderItem {
  final String productId;
  final String sku;
  final String productName;
  final String size;
  final String surface;
  final String color;
  final int quantity;
  final String unit;
  final int moq;
  final double basePrice;
  final double finalPrice;
  final double lineTotal;
  final String orderType; // ready_stock / made_to_order

  const OrderItem({
    required this.productId,
    this.sku = 'ITA-PROD-001',
    required this.productName,
    required this.size,
    required this.surface,
    this.color = 'White',
    required this.quantity,
    this.unit = 'box',
    required this.moq,
    this.basePrice = 0.0,
    this.finalPrice = 0.0,
    double? lineTotal,
    this.orderType = 'ready_stock',
  }) : lineTotal = lineTotal ?? (quantity * finalPrice);

  String get tileId => productId;
  String get tileName => productName;
  double? get unitPrice => finalPrice > 0 ? finalPrice : null;
  double? get totalPrice => lineTotal > 0 ? lineTotal : null;

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'tileId': productId,
      'sku': sku,
      'productName': productName,
      'tileName': productName,
      'size': size,
      'surface': surface,
      'color': color,
      'quantity': quantity,
      'unit': unit,
      'moq': moq,
      'basePrice': basePrice,
      'finalPrice': finalPrice,
      'unitPrice': finalPrice,
      'lineTotal': lineTotal,
      'totalPrice': lineTotal,
      'orderType': orderType,
    };
  }

  factory OrderItem.fromMap(Map<String, dynamic> map) {
    final pId = map['productId'] ?? map['tileId'] ?? '';
    final qty = (map['quantity'] ?? 1).toInt();
    final bPrice = (map['basePrice'] ?? map['unitPrice'] ?? 0.0).toDouble();
    final fPrice = (map['finalPrice'] ?? map['unitPrice'] ?? bPrice).toDouble();
    final lTotal = (map['lineTotal'] ?? map['totalPrice'] ?? (qty * fPrice)).toDouble();

    return OrderItem(
      productId: pId,
      sku: map['sku'] ?? 'ITA-PROD-$pId',
      productName: map['productName'] ?? map['tileName'] ?? 'Tile Product',
      size: map['size'] ?? '600x1200',
      surface: map['surface'] ?? 'Glossy',
      color: map['color'] ?? map['baseColor'] ?? 'White',
      quantity: qty,
      unit: map['unit'] ?? 'box',
      moq: (map['moq'] ?? 10).toInt(),
      basePrice: bPrice,
      finalPrice: fPrice,
      lineTotal: lTotal,
      orderType: map['orderType'] ?? 'ready_stock',
    );
  }
}

/// Order Status Change Entry in `orders/{orderId}/orderStatusHistory/{historyId}` per PDF schema
class OrderStatusHistory {
  final String fromStatus;
  final String toStatus;
  final String changedBy;
  final String changedByRole;
  final String remarks;
  final DateTime? timestamp;

  const OrderStatusHistory({
    required this.fromStatus,
    required this.toStatus,
    required this.changedBy,
    required this.changedByRole,
    this.remarks = '',
    this.timestamp,
  });

  Map<String, dynamic> toMap() {
    return {
      'fromStatus': fromStatus,
      'toStatus': toStatus,
      'changedBy': changedBy,
      'changedByRole': changedByRole,
      'remarks': remarks,
      'timestamp': timestamp != null
          ? Timestamp.fromDate(timestamp!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory OrderStatusHistory.fromMap(Map<String, dynamic> map) {
    return OrderStatusHistory(
      fromStatus: map['fromStatus'] ?? '',
      toStatus: map['toStatus'] ?? '',
      changedBy: map['changedBy'] ?? '',
      changedByRole: map['changedByRole'] ?? '',
      remarks: map['remarks'] ?? '',
      timestamp: map['timestamp'] is Timestamp
          ? (map['timestamp'] as Timestamp).toDate()
          : null,
    );
  }
}

/// Represents an Order document in `orders` collection per PDF schema
class TileOrder {
  final String id; // orderId / id
  final String orderId; // PDF schema: orderId
  final String orderReference; // Business order number (e.g. PO-GJ-2026-98104)
  final String userId; // Customer ID
  final String salesPersonId; // Assigned salesperson ID
  final String userCategory; // Customer category (Dealer / Wholesale / Retail / Contractor)
  final String status; // Current order status
  final String orderType; // ready_stock / made_to_order
  final String poNumber; // Customer PO number
  final String poDocumentUrl; // Uploaded PO document URL
  final Map<String, dynamic> deliveryLocation; // Delivery address Map
  final bool transportRequired; // Transport required
  final String remarks; // Customer remarks
  final double subtotal; // Order subtotal
  final double discount; // Discount amount
  final double tax; // Tax amount
  final double total; // Final total
  final List<OrderItem> items;
  final String stateCode;
  final String priceApprovalStatus;
  final Map<String, dynamic> estimateDetails;
  final String? shipmentId;
  final double? freightAmount;
  final String dispatchStatus; // unassigned, assigned, dispatched, delivered
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const TileOrder({
    required this.id,
    String? orderId,
    required this.orderReference,
    required this.userId,
    this.salesPersonId = '',
    required this.userCategory,
    required this.status,
    required this.orderType,
    this.poNumber = '',
    this.poDocumentUrl = '',
    required this.deliveryLocation,
    required this.transportRequired,
    required this.remarks,
    this.subtotal = 0.0,
    this.discount = 0.0,
    this.tax = 0.0,
    this.total = 0.0,
    required this.items,
    this.stateCode = 'GJ',
    this.priceApprovalStatus = 'none',
    this.estimateDetails = const {},
    this.shipmentId,
    this.freightAmount,
    this.dispatchStatus = 'unassigned',
    this.createdAt,
    this.updatedAt,
  }) : orderId = orderId ?? id;

  String get orderReferenceNumber => orderReference;
  String? get salespersonId => salesPersonId.isNotEmpty ? salesPersonId : null;
  String get deliveryAddress => deliveryLocation['address'] ?? deliveryLocation['deliveryAddress'] ?? '';

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'orderId': orderId,
      'orderReference': orderReference,
      'orderReferenceNumber': orderReference,
      'userId': userId,
      'salesPersonId': salesPersonId,
      'salespersonId': salesPersonId,
      'userCategory': userCategory,
      'status': status,
      'orderType': orderType,
      'poNumber': poNumber,
      'poDocumentUrl': poDocumentUrl,
      'deliveryLocation': deliveryLocation,
      'deliveryAddress': deliveryAddress,
      'transportRequired': transportRequired,
      'remarks': remarks,
      'subtotal': subtotal,
      'discount': discount,
      'tax': tax,
      'total': total,
      'items': items.map((item) => item.toMap()).toList(),
      'stateCode': stateCode,
      'priceApprovalStatus': priceApprovalStatus,
      'estimateDetails': estimateDetails.isNotEmpty
          ? estimateDetails
          : {
              'discountPercent': discount > 0 && subtotal > 0 ? (discount / subtotal) * 100 : 0.0,
              'discountAmount': discount,
              'taxAmount': tax,
              'subtotal': subtotal,
              'grandTotal': total,
            },
      'shipmentId': shipmentId,
      'freightAmount': freightAmount,
      'dispatchStatus': dispatchStatus,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory TileOrder.fromMap(Map<String, dynamic> map, String docId) {
    final oId = map['orderId'] ?? docId;
    final ref = map['orderReference'] ?? map['orderReferenceNumber'] ?? 'PO-GJ-2026-${docId.substring(0, min(5, docId.length)).toUpperCase()}';
    final sub = (map['subtotal'] ?? 0.0).toDouble();
    final disc = (map['discount'] ?? 0.0).toDouble();
    final tx = (map['tax'] ?? 0.0).toDouble();
    final tot = (map['total'] ?? (sub - disc + tx)).toDouble();

    final delLoc = map['deliveryLocation'] is Map
        ? Map<String, dynamic>.from(map['deliveryLocation'])
        : {'address': map['deliveryAddress'] ?? ''};

    return TileOrder(
      id: docId,
      orderId: oId,
      orderReference: ref,
      userId: map['userId'] ?? '',
      salesPersonId: map['salesPersonId'] ?? map['salespersonId'] ?? '',
      userCategory: map['userCategory'] ?? map['role'] ?? 'dealer',
      status: map['status'] ?? 'pending_salesperson_review',
      orderType: map['orderType'] ?? 'ready_stock',
      poNumber: map['poNumber'] ?? '',
      poDocumentUrl: map['poDocumentUrl'] ?? '',
      deliveryLocation: delLoc,
      transportRequired: map['transportRequired'] ?? false,
      remarks: map['remarks'] ?? map['notes'] ?? '',
      subtotal: sub,
      discount: disc,
      tax: tx,
      total: tot,
      items: (map['items'] as List<dynamic>?)
              ?.map((item) => OrderItem.fromMap(Map<String, dynamic>.from(item)))
              .toList() ??
          [],
      stateCode: map['stateCode'] ?? 'GJ',
      priceApprovalStatus: map['priceApprovalStatus'] ?? 'none',
      estimateDetails: Map<String, dynamic>.from(map['estimateDetails'] ?? {}),
      shipmentId: map['shipmentId'] as String?,
      freightAmount: (map['freightAmount'] as num?)?.toDouble(),
      dispatchStatus: map['dispatchStatus'] as String? ?? 'unassigned',
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }

  TileOrder copyWith({
    String? id,
    String? orderId,
    String? orderReference,
    String? userId,
    String? salesPersonId,
    String? userCategory,
    String? status,
    String? orderType,
    String? poNumber,
    String? poDocumentUrl,
    Map<String, dynamic>? deliveryLocation,
    bool? transportRequired,
    String? remarks,
    double? subtotal,
    double? discount,
    double? tax,
    double? total,
    List<OrderItem>? items,
    String? stateCode,
    String? priceApprovalStatus,
    Map<String, dynamic>? estimateDetails,
    String? shipmentId,
    double? freightAmount,
    String? dispatchStatus,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TileOrder(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      orderReference: orderReference ?? this.orderReference,
      userId: userId ?? this.userId,
      salesPersonId: salesPersonId ?? this.salesPersonId,
      userCategory: userCategory ?? this.userCategory,
      status: status ?? this.status,
      orderType: orderType ?? this.orderType,
      poNumber: poNumber ?? this.poNumber,
      poDocumentUrl: poDocumentUrl ?? this.poDocumentUrl,
      deliveryLocation: deliveryLocation ?? this.deliveryLocation,
      transportRequired: transportRequired ?? this.transportRequired,
      remarks: remarks ?? this.remarks,
      subtotal: subtotal ?? this.subtotal,
      discount: discount ?? this.discount,
      tax: tax ?? this.tax,
      total: total ?? this.total,
      items: items ?? this.items,
      stateCode: stateCode ?? this.stateCode,
      priceApprovalStatus: priceApprovalStatus ?? this.priceApprovalStatus,
      estimateDetails: estimateDetails ?? this.estimateDetails,
      shipmentId: shipmentId ?? this.shipmentId,
      freightAmount: freightAmount ?? this.freightAmount,
      dispatchStatus: dispatchStatus ?? this.dispatchStatus,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

/// Type alias for OrderModel per schema naming
typedef OrderModel = TileOrder;

