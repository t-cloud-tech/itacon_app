import 'package:cloud_firestore/cloud_firestore.dart';

/// Single item within an Estimate document per PDF schema
class EstimateItem {
  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final double discount;
  final double lineTotal;

  const EstimateItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    this.discount = 0.0,
    double? lineTotal,
  }) : lineTotal = lineTotal ?? ((quantity * unitPrice) - discount);

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'productName': productName,
      'quantity': quantity,
      'unitPrice': unitPrice,
      'discount': discount,
      'lineTotal': lineTotal,
    };
  }

  factory EstimateItem.fromMap(Map<String, dynamic> map) {
    final qty = (map['quantity'] ?? 1).toInt();
    final uPrice = (map['unitPrice'] ?? 0.0).toDouble();
    final disc = (map['discount'] ?? 0.0).toDouble();
    final lTotal = (map['lineTotal'] ?? ((qty * uPrice) - disc)).toDouble();

    return EstimateItem(
      productId: map['productId'] ?? '',
      productName: map['productName'] ?? 'Tile Product',
      quantity: qty,
      unitPrice: uPrice,
      discount: disc,
      lineTotal: lTotal,
    );
  }
}

/// Represents an Estimate document in `estimates` collection per PDF schema
class Estimate {
  final String estimateId;
  final String estimateNumber; // e.g. "EST-2026-98104"
  final String orderId;
  final String customerId;
  final String salesPersonId;
  final String priceListId;
  final String status; // draft / sent / approved / rejected / expired
  final double subtotal;
  final double discount;
  final double tax;
  final double total;
  final int totalBoxes;
  final double totalWeightKg;
  final double totalWeightTons;
  final DateTime? validUntil;
  final String customerResponse; // approved / rejected
  final DateTime? respondedAt;
  final String remarks;
  final List<EstimateItem> items;
  final DateTime? createdAt;
  final DateTime? sentAt;
  final DateTime? updatedAt;

  const Estimate({
    required this.estimateId,
    required this.estimateNumber,
    required this.orderId,
    required this.customerId,
    required this.salesPersonId,
    this.priceListId = '',
    this.status = 'sent',
    required this.subtotal,
    this.discount = 0.0,
    required this.tax,
    required this.total,
    this.totalBoxes = 0,
    this.totalWeightKg = 0.0,
    this.totalWeightTons = 0.0,
    this.validUntil,
    this.customerResponse = '',
    this.respondedAt,
    this.remarks = '',
    this.items = const [],
    this.createdAt,
    this.sentAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'estimateId': estimateId,
      'estimateNumber': estimateNumber,
      'orderId': orderId,
      'customerId': customerId,
      'salesPersonId': salesPersonId,
      'priceListId': priceListId,
      'status': status,
      'subtotal': subtotal,
      'discount': discount,
      'tax': tax,
      'total': total,
      'totalBoxes': totalBoxes,
      'totalWeightKg': totalWeightKg,
      'totalWeightTons': totalWeightTons,
      'validUntil': validUntil != null ? Timestamp.fromDate(validUntil!) : null,
      'customerResponse': customerResponse,
      'respondedAt': respondedAt != null ? Timestamp.fromDate(respondedAt!) : null,
      'remarks': remarks,
      'items': items.map((item) => item.toMap()).toList(),
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'sentAt': sentAt != null ? Timestamp.fromDate(sentAt!) : null,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory Estimate.fromMap(Map<String, dynamic> map, String docId) {
    final tKg = (map['totalWeightKg'] ?? 0.0).toDouble();

    return Estimate(
      estimateId: docId,
      estimateNumber: map['estimateNumber'] ?? 'EST-2026-${docId.substring(0, 5).toUpperCase()}',
      orderId: map['orderId'] ?? '',
      customerId: map['customerId'] ?? '',
      salesPersonId: map['salesPersonId'] ?? '',
      priceListId: map['priceListId'] ?? '',
      status: map['status'] ?? 'sent',
      subtotal: (map['subtotal'] ?? 0.0).toDouble(),
      discount: (map['discount'] ?? 0.0).toDouble(),
      tax: (map['tax'] ?? 0.0).toDouble(),
      total: (map['total'] ?? 0.0).toDouble(),
      totalBoxes: (map['totalBoxes'] ?? 0).toInt(),
      totalWeightKg: tKg,
      totalWeightTons: (map['totalWeightTons'] ?? (tKg / 1000.0)).toDouble(),
      validUntil: map['validUntil'] is Timestamp
          ? (map['validUntil'] as Timestamp).toDate()
          : null,
      customerResponse: map['customerResponse'] ?? '',
      respondedAt: map['respondedAt'] is Timestamp
          ? (map['respondedAt'] as Timestamp).toDate()
          : null,
      remarks: map['remarks'] ?? '',
      items: (map['items'] as List<dynamic>?)
              ?.map((item) => EstimateItem.fromMap(Map<String, dynamic>.from(item)))
              .toList() ??
          [],
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      sentAt: map['sentAt'] is Timestamp
          ? (map['sentAt'] as Timestamp).toDate()
          : null,
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
