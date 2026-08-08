import 'package:cloud_firestore/cloud_firestore.dart';

/// Production Handoff Document in `handoffs` collection per PDF schema
class ProductionHandoff {
  final String handoffId;
  final String orderId;
  final String orderReference;
  final String customerId;
  final String salesPersonId;
  final String status; // pending / received
  final String handoffBy; // User who handed off
  final DateTime? handoffDate;
  final String notes;
  final DateTime? createdAt;

  const ProductionHandoff({
    required this.handoffId,
    required this.orderId,
    required this.orderReference,
    required this.customerId,
    required this.salesPersonId,
    this.status = 'pending',
    required this.handoffBy,
    this.handoffDate,
    this.notes = '',
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'handoffId': handoffId,
      'orderId': orderId,
      'orderReference': orderReference,
      'customerId': customerId,
      'salesPersonId': salesPersonId,
      'status': status,
      'handoffBy': handoffBy,
      'handoffDate': handoffDate != null
          ? Timestamp.fromDate(handoffDate!)
          : FieldValue.serverTimestamp(),
      'notes': notes,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory ProductionHandoff.fromMap(Map<String, dynamic> map, String docId) {
    return ProductionHandoff(
      handoffId: docId,
      orderId: map['orderId'] ?? '',
      orderReference: map['orderReference'] ?? '',
      customerId: map['customerId'] ?? '',
      salesPersonId: map['salesPersonId'] ?? '',
      status: map['status'] ?? 'pending',
      handoffBy: map['handoffBy'] ?? '',
      handoffDate: map['handoffDate'] is Timestamp
          ? (map['handoffDate'] as Timestamp).toDate()
          : null,
      notes: map['notes'] ?? '',
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }
}
