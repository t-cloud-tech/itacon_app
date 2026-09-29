import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';

double _asDouble(dynamic val, [double defaultVal = 0.0]) {
  if (val == null) return defaultVal;
  if (val is num) return val.toDouble();
  if (val is String) return double.tryParse(val) ?? defaultVal;
  return defaultVal;
}

int _asInt(dynamic val, [int defaultVal = 0]) {
  if (val == null) return defaultVal;
  if (val is num) return val.toInt();
  if (val is String) return int.tryParse(val) ?? (double.tryParse(val)?.toInt() ?? defaultVal);
  return defaultVal;
}

/// Single item snapshot within `orders/{orderId}/orderItems/{productId}` per PO quotation schema
class OrderItem {
  final String productId;
  final String sku;
  final String productName;
  final String size;
  final String surface;
  final String color;
  final int quantity; // Total box count (quantityBoxes)
  final int quantityBoxes;
  final double quantitySqFt;
  final String unit;
  final int moq;
  final double basePrice;
  final double finalPrice;
  final double? unitPrice; // Quoted unit rate (₹/Sq Ft or ₹/Bag), nullable when pending_rate
  final double? lineTotal; // Line total amount, nullable when pending_rate
  final String orderType; // ready_stock / made_to_order

  const OrderItem({
    required this.productId,
    this.sku = 'ITA-PROD-001',
    required this.productName,
    required this.size,
    required this.surface,
    this.color = 'White',
    required this.quantity,
    int? quantityBoxes,
    double? quantitySqFt,
    this.unit = 'box',
    required this.moq,
    this.basePrice = 0.0,
    this.finalPrice = 0.0,
    this.unitPrice,
    this.lineTotal,
    this.orderType = 'ready_stock',
  })  : quantityBoxes = quantityBoxes ?? quantity,
        quantitySqFt = quantitySqFt ?? (quantity * 15.5); // Default coverage approx 15.5 sq.ft/box

  String get tileId => productId;
  String get tileName => productName;
  double? get totalPrice => lineTotal;

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
      'quantity': quantityBoxes,
      'quantityBoxes': quantityBoxes,
      'quantitySqFt': quantitySqFt,
      'unit': unit,
      'moq': moq,
      'basePrice': basePrice,
      'finalPrice': finalPrice,
      'unitPrice': unitPrice,
      'lineTotal': lineTotal,
      'totalPrice': lineTotal,
      'orderType': orderType,
    };
  }

  factory OrderItem.fromMap(Map<String, dynamic> map) {
    final pId = (map['productId'] ?? map['tileId'] ?? '').toString();
    final qBoxes = _asInt(map['quantityBoxes'] ?? map['quantity'] ?? map['boxes'] ?? map['qty'], 1);
    final qSqFt = _asDouble(map['quantitySqFt'] ?? map['sqft'], qBoxes * 15.5);
    final bPrice = _asDouble(map['basePrice'] ?? map['price']);
    final fPrice = _asDouble(map['finalPrice'] ?? map['rate'] ?? bPrice);

    double? uPrice;
    if (map['unitPrice'] != null) {
      uPrice = _asDouble(map['unitPrice']);
    } else if (map['quotedUnitPrice'] != null) {
      uPrice = _asDouble(map['quotedUnitPrice']);
    } else if (map['pricePerSqft'] != null) {
      uPrice = _asDouble(map['pricePerSqft']);
    } else if (map['quotedRate'] != null) {
      uPrice = _asDouble(map['quotedRate']);
    } else if (map['rate'] != null) {
      uPrice = _asDouble(map['rate']);
    }
    double? lTotal;
    if (map['lineTotal'] != null) {
      lTotal = _asDouble(map['lineTotal']);
    } else if (map['totalPrice'] != null) {
      lTotal = _asDouble(map['totalPrice']);
    } else if (uPrice != null && uPrice > 0) {
      lTotal = qSqFt * uPrice;
    }

    return OrderItem(
      productId: pId,
      sku: map['sku'] ?? 'ITA-PROD-$pId',
      productName: map['productName'] ?? map['tileName'] ?? 'Tile Product',
      size: map['size'] ?? '600x1200',
      surface: map['surface'] ?? 'Glossy',
      color: map['color'] ?? map['baseColor'] ?? 'White',
      quantity: qBoxes,
      quantityBoxes: qBoxes,
      quantitySqFt: qSqFt,
      unit: map['unit'] ?? 'box',
      moq: _asInt(map['moq'], 10),
      basePrice: bPrice,
      finalPrice: fPrice,
      unitPrice: uPrice,
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

/// Represents an Order document in `orders` collection per 2-way PO workflow schema
class TileOrder {
  final String id; // orderId / id
  final String orderId; // PDF schema: orderId
  final String orderReference; // Business order number (e.g. ITC-PO-2026-98104)
  final String userId; // Customer ID
  final String salesPersonId; // Assigned salesperson ID
  final String userCategory; // Customer category (Dealer / Wholesale / Retail / Contractor)
  final String status; // pending_rate, rate_quoted, confirmed, rejected
  final String orderType; // ready_stock / made_to_order
  final String poNumber; // Customer PO number
  final String poDocumentUrl; // Generated PO PDF document URL
  final Map<String, dynamic> deliveryLocation; // Delivery address Map
  final bool transportRequired; // Transport required
  final String remarks; // Customer remarks
  final double subtotal; // Order subtotal
  final double discount; // Discount amount (default 0)
  final double taxAmount; // 18% GST Amount
  final double totalAmount; // Final Total = subtotal - discount + taxAmount
  final int totalBoxes; // Logistics: Total box count
  final double totalWeightKg; // Logistics: Total weight in kg
  final double totalWeightTons; // Logistics: Total weight in metric tonnes
  final List<OrderItem> items;
  final String stateCode;
  final String priceApprovalStatus;
  final Map<String, dynamic> estimateDetails;
  final String? shipmentId;
  final double? freightAmount;
  final String dispatchStatus; // unassigned, assigned, dispatched, delivered
  final String customerName; // Customer display name snapshot at order creation
  final String? customerPhone; // Customer contact phone
  final String? customerEmail; // Customer email
  final String paymentMethod; // bank_transfer
  final String? paymentStatus; // not_required, payment_due, pending_verification, paid, rejected
  final String? paymentSubmissionId; // Active submission reference
  final String? proofStoragePath; // Storage path to payment receipt
  final double? paidAmount; // Amount successfully paid
  final String? paymentId; // Gateway payment transaction ID / Verified UTR
  final String? rejectionReason; // Explanation if payment verification or quote is rejected
  final DateTime? paidAt; // Payment timestamp
  final DateTime? deliveredAt; // Delivery/completion timestamp
  final DateTime? rateQuotedAt;
  final DateTime? confirmedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const TileOrder({
    required this.id,
    String? orderId,
    required this.orderReference,
    required this.userId,
    this.customerName = '',
    this.customerPhone,
    this.customerEmail,
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
    double? taxAmount,
    double? totalAmount,
    this.totalBoxes = 0,
    this.totalWeightKg = 0.0,
    this.totalWeightTons = 0.0,
    required this.items,
    this.stateCode = 'GJ',
    this.priceApprovalStatus = 'none',
    this.estimateDetails = const {},
    this.shipmentId,
    this.freightAmount,
    this.dispatchStatus = 'unassigned',
    this.paymentMethod = 'bank_transfer',
    this.paymentStatus,
    this.paymentSubmissionId,
    this.proofStoragePath,
    this.paidAmount,
    this.paymentId,
    this.rejectionReason,
    this.paidAt,
    this.deliveredAt,
    this.rateQuotedAt,
    this.confirmedAt,
    this.createdAt,
    this.updatedAt,
  })  : taxAmount = taxAmount ?? ((subtotal - discount > 0 ? subtotal - discount : 0.0) * 0.18),
        totalAmount = totalAmount ?? (subtotal - discount + (taxAmount ?? ((subtotal - discount > 0 ? subtotal - discount : 0.0) * 0.18))),
        orderId = orderId ?? id;

  String get customerId => userId;
  bool get isPaid => paymentStatus?.toLowerCase() == 'paid';
  bool get isPaymentDue => isConfirmedStage && (paymentStatus == 'payment_due' || (status == 'confirmed' && (paymentStatus == null || paymentStatus == 'payment_due')));
  bool get isPaymentPendingVerification => paymentStatus == 'pending_verification';
  bool get isPaymentRejected => paymentStatus == 'rejected';

  /// Whether this order has completed its delivery/payment business lifecycle (History tab)
  bool get isHistoryStage {
    final s = status.toLowerCase();
    final ds = dispatchStatus.toLowerCase();
    return s == 'completed' ||
           s == 'delivered' ||
           ds == 'delivered' ||
           s == 'cancelled' ||
           s == 'rejected' ||
           (paymentStatus?.toLowerCase() == 'paid' && (s == 'completed' || s == 'delivered' || ds == 'delivered'));
  }

  /// Whether this order is in the initial pending quote phase (Pending Quote tab)
  bool get isPendingQuoteStage {
    if (isHistoryStage) return false;
    final s = status.toLowerCase();
    return s == 'pending_rate' ||
           s == 'pending_salesperson_review' ||
           s == 'pending_manager_approval' ||
           s == 'awaiting_quote';
  }

  /// Whether rates have been quoted by salesperson and awaiting customer review (Rates Quoted tab)
  bool get isRateQuotedStage {
    if (isHistoryStage) return false;
    final s = status.toLowerCase();
    return s == 'rate_quoted' || s == 'quoted' || s == 'rates_quoted';
  }

  /// Whether this order is confirmed and moving through active fulfillment (Confirmed tab)
  bool get isConfirmedStage {
    if (isHistoryStage) return false;
    final s = status.toLowerCase();
    return s == 'confirmed' ||
           s == 'order_confirmed' ||
           s == 'processing' ||
           s == 'dispatched' ||
           s == 'payment_pending' ||
           s == 'advance_paid' ||
           dispatchStatus.toLowerCase() == 'dispatched' ||
           dispatchStatus.toLowerCase() == 'assigned';
  }

  String get orderReferenceNumber => orderReference;
  String? get salespersonId => salesPersonId.isNotEmpty ? salesPersonId : null;
  String get deliveryAddress => deliveryLocation['address'] ?? deliveryLocation['deliveryAddress'] ?? '';
  double get tax => taxAmount;
  double get total => totalAmount;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'orderId': orderId,
      'orderReference': orderReference,
      'orderReferenceNumber': orderReference,
      'userId': userId,
      'customerId': userId,
      'customerName': customerName,
      if (customerPhone != null && customerPhone!.isNotEmpty) 'customerPhone': customerPhone,
      if (customerEmail != null && customerEmail!.isNotEmpty) 'customerEmail': customerEmail,
      'salesPersonId': salesPersonId,
      'userCategory': userCategory,
      'customerCategory': userCategory,
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
      'taxAmount': taxAmount,
      'tax': taxAmount,
      'totalAmount': totalAmount,
      'total': totalAmount,
      'totalBoxes': totalBoxes,
      'totalWeightKg': totalWeightKg,
      'totalWeightTons': totalWeightTons,
      'orderItems': items.map((item) => item.toMap()).toList(),
      'items': items.map((item) => item.toMap()).toList(),
      'stateCode': stateCode,
      'priceApprovalStatus': priceApprovalStatus,
      'estimateDetails': estimateDetails.isNotEmpty
          ? (Map<String, dynamic>.from(estimateDetails)
            ..addAll({
              'totalBoxes': totalBoxes,
              'totalWeightTons': totalWeightTons,
              'totalWeightKg': totalWeightKg,
            }))
          : {
              'discountPercent': discount > 0 && subtotal > 0 ? (discount / subtotal) * 100 : 0.0,
              'discountAmount': discount,
              'taxAmount': taxAmount,
              'subtotal': subtotal,
              'grandTotal': totalAmount,
              'totalBoxes': totalBoxes,
              'totalWeightTons': totalWeightTons,
              'totalWeightKg': totalWeightKg,
            },
      'shipmentId': shipmentId,
      'freightAmount': freightAmount,
      'dispatchStatus': dispatchStatus,
      'paymentMethod': paymentMethod,
      if (paymentStatus != null) 'paymentStatus': paymentStatus,
      if (paymentSubmissionId != null) 'paymentSubmissionId': paymentSubmissionId,
      if (proofStoragePath != null) 'proofStoragePath': proofStoragePath,
      if (paidAmount != null) 'paidAmount': paidAmount,
      if (paymentId != null) 'paymentId': paymentId,
      if (rejectionReason != null) 'rejectionReason': rejectionReason,
      if (paidAt != null) 'paidAt': Timestamp.fromDate(paidAt!),
      if (deliveredAt != null) 'deliveredAt': Timestamp.fromDate(deliveredAt!),
      'rateQuotedAt': rateQuotedAt != null ? Timestamp.fromDate(rateQuotedAt!) : null,
      'confirmedAt': confirmedAt != null ? Timestamp.fromDate(confirmedAt!) : null,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory TileOrder.fromMap(Map<String, dynamic> map, String docId) {
    final oId = (map['orderId'] ?? docId).toString();
    final ref = (map['orderReference'] ?? map['orderReferenceNumber'] ?? 'ITC-PO-2026-${docId.substring(0, min(5, docId.length)).toUpperCase()}').toString();
    final sub = _asDouble(map['subtotal'] ?? map['subTotal']);
    final disc = _asDouble(map['discount'] ?? map['discountAmount']);
    final tx = _asDouble(map['taxAmount'] ?? map['tax'] ?? map['gstAmount'] ?? ((sub - disc > 0 ? sub - disc : 0.0) * 0.18));
    final tot = _asDouble(map['totalAmount'] ?? map['total'] ?? map['grandTotal'] ?? (sub - disc + tx));
    final tBoxes = _asInt(map['totalBoxes'] ?? map['boxes']);
    final tKg = _asDouble(map['totalWeightKg'] ?? map['weightKg']);
    final tTons = _asDouble(map['totalWeightTons'] ?? map['weightTons'] ?? (tKg / 1000.0));

    final delLoc = map['deliveryLocation'] is Map
        ? Map<String, dynamic>.from(map['deliveryLocation'])
        : {'address': (map['deliveryAddress'] ?? '').toString()};

    final rawItems = map['orderItems'] ?? map['items'] ?? map['quotedItems'];

    final cName = (map['customerName'] ?? map['clientName'] ?? map['userName'] ?? '').toString();
    final cPhone = map['customerPhone']?.toString() ?? map['phone']?.toString();
    final cEmail = map['customerEmail']?.toString() ?? map['email']?.toString();
    final pStatus = map['paymentStatus']?.toString();
    final pAmount = map['paidAmount'] != null ? _asDouble(map['paidAmount']) : null;
    final pIdVal = map['paymentId']?.toString();
    final pRejReason = map['rejectionReason']?.toString();
    final pAt = map['paidAt'] is Timestamp ? (map['paidAt'] as Timestamp).toDate() : null;
    final dAt = map['deliveredAt'] is Timestamp ? (map['deliveredAt'] as Timestamp).toDate() : null;

    final parsedItems = <OrderItem>[];
    if (rawItems is List) {
      for (final item in rawItems) {
        if (item is Map) {
          parsedItems.add(OrderItem.fromMap(Map<String, dynamic>.from(item)));
        }
      }
    }

    return TileOrder(
      id: docId,
      orderId: oId,
      orderReference: ref,
      userId: (map['userId'] ?? map['customerId'] ?? '').toString(),
      customerName: cName,
      customerPhone: cPhone,
      customerEmail: cEmail,
      salesPersonId: (map['salesPersonId'] ?? map['salespersonId'] ?? '').toString(),
      userCategory: (map['userCategory'] ?? map['customerCategory'] ?? map['role'] ?? 'dealer').toString(),
      status: (map['status'] ?? 'pending_rate').toString(),
      orderType: (map['orderType'] ?? 'ready_stock').toString(),
      poNumber: (map['poNumber'] ?? '').toString(),
      poDocumentUrl: (map['poDocumentUrl'] ?? '').toString(),
      deliveryLocation: delLoc,
      transportRequired: map['transportRequired'] ?? false,
      remarks: (map['remarks'] ?? map['notes'] ?? '').toString(),
      subtotal: sub,
      discount: disc,
      taxAmount: tx,
      totalAmount: tot,
      totalBoxes: tBoxes,
      totalWeightKg: tKg,
      totalWeightTons: tTons,
      items: parsedItems,
      stateCode: (map['stateCode'] ?? 'GJ').toString(),
      priceApprovalStatus: (map['priceApprovalStatus'] ?? 'none').toString(),
      estimateDetails: Map<String, dynamic>.from(map['estimateDetails'] ?? {}),
      shipmentId: map['shipmentId'] as String?,
      freightAmount: map['freightAmount'] != null ? _asDouble(map['freightAmount']) : null,
      dispatchStatus: map['dispatchStatus'] as String? ?? 'unassigned',
      paymentMethod: (map['paymentMethod'] ?? 'bank_transfer').toString(),
      paymentStatus: pStatus,
      paymentSubmissionId: map['paymentSubmissionId'] as String?,
      proofStoragePath: map['proofStoragePath'] as String?,
      paidAmount: pAmount,
      paymentId: pIdVal,
      rejectionReason: pRejReason,
      paidAt: pAt,
      deliveredAt: dAt,
      rateQuotedAt: map['rateQuotedAt'] is Timestamp
          ? (map['rateQuotedAt'] as Timestamp).toDate()
          : null,
      confirmedAt: map['confirmedAt'] is Timestamp
          ? (map['confirmedAt'] as Timestamp).toDate()
          : null,
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
    String? customerName,
    String? customerPhone,
    String? customerEmail,
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
    double? taxAmount,
    double? totalAmount,
    int? totalBoxes,
    double? totalWeightKg,
    double? totalWeightTons,
    List<OrderItem>? items,
    String? stateCode,
    String? priceApprovalStatus,
    Map<String, dynamic>? estimateDetails,
    String? shipmentId,
    double? freightAmount,
    String? dispatchStatus,
    String? paymentMethod,
    String? paymentStatus,
    String? paymentSubmissionId,
    String? proofStoragePath,
    double? paidAmount,
    String? paymentId,
    String? rejectionReason,
    DateTime? paidAt,
    DateTime? deliveredAt,
    DateTime? rateQuotedAt,
    DateTime? confirmedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TileOrder(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      orderReference: orderReference ?? this.orderReference,
      userId: userId ?? this.userId,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      customerEmail: customerEmail ?? this.customerEmail,
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
      taxAmount: taxAmount ?? this.taxAmount,
      totalAmount: totalAmount ?? this.totalAmount,
      totalBoxes: totalBoxes ?? this.totalBoxes,
      totalWeightKg: totalWeightKg ?? this.totalWeightKg,
      totalWeightTons: totalWeightTons ?? this.totalWeightTons,
      items: items ?? this.items,
      stateCode: stateCode ?? this.stateCode,
      priceApprovalStatus: priceApprovalStatus ?? this.priceApprovalStatus,
      estimateDetails: estimateDetails ?? this.estimateDetails,
      shipmentId: shipmentId ?? this.shipmentId,
      freightAmount: freightAmount ?? this.freightAmount,
      dispatchStatus: dispatchStatus ?? this.dispatchStatus,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      paymentSubmissionId: paymentSubmissionId ?? this.paymentSubmissionId,
      proofStoragePath: proofStoragePath ?? this.proofStoragePath,
      paidAmount: paidAmount ?? this.paidAmount,
      paymentId: paymentId ?? this.paymentId,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      paidAt: paidAt ?? this.paidAt,
      deliveredAt: deliveredAt ?? this.deliveredAt,
      rateQuotedAt: rateQuotedAt ?? this.rateQuotedAt,
      confirmedAt: confirmedAt ?? this.confirmedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

/// Type alias for OrderModel per schema naming
typedef OrderModel = TileOrder;

