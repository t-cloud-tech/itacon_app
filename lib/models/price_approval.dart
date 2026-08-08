import 'package:cloud_firestore/cloud_firestore.dart';

/// Price Approval Document in `priceApprovals` collection per PDF schema
class PriceApproval {
  final String approvalId; // Unique Approval ID
  final String priceListId; // Price List ID
  final String requestedBy; // Salesperson ID
  final String requestedTo; // Manager/Admin ID
  final String status; // pending / approved / rejected
  final String reason; // Reason for special pricing
  final String remarks; // Manager remarks
  final String orderId;
  final String userId;
  final double originalTotal;
  final double requestedTotal;
  final double discountPercent;
  final DateTime? createdAt;
  final DateTime? reviewedAt;

  const PriceApproval({
    required this.approvalId,
    required this.priceListId,
    required this.requestedBy,
    required this.requestedTo,
    this.status = 'pending',
    this.reason = 'Volume discount request',
    this.remarks = '',
    this.orderId = '',
    this.userId = '',
    this.originalTotal = 0.0,
    this.requestedTotal = 0.0,
    this.discountPercent = 0.0,
    this.createdAt,
    this.reviewedAt,
  });

  String get id => approvalId;
  String get salespersonId => requestedBy;

  Map<String, dynamic> toMap() {
    return {
      'approvalId': approvalId,
      'id': approvalId,
      'priceListId': priceListId,
      'requestedBy': requestedBy,
      'salespersonId': requestedBy,
      'requestedTo': requestedTo,
      'approvedBy': requestedTo,
      'status': status,
      'reason': reason,
      'remarks': remarks,
      'salesManagerNotes': remarks,
      'orderId': orderId,
      'userId': userId,
      'originalTotal': originalTotal,
      'requestedTotal': requestedTotal,
      'discountPercent': discountPercent,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'reviewedAt': reviewedAt != null ? Timestamp.fromDate(reviewedAt!) : null,
      'approvedAt': reviewedAt != null ? Timestamp.fromDate(reviewedAt!) : null,
    };
  }

  factory PriceApproval.fromMap(Map<String, dynamic> map, String docId) {
    return PriceApproval(
      approvalId: docId,
      priceListId: map['priceListId'] ?? '',
      requestedBy: map['requestedBy'] ?? map['salespersonId'] ?? '',
      requestedTo: map['requestedTo'] ?? map['approvedBy'] ?? '',
      status: map['status'] ?? 'pending',
      reason: map['reason'] ?? '',
      remarks: map['remarks'] ?? map['salesManagerNotes'] ?? '',
      orderId: map['orderId'] ?? '',
      userId: map['userId'] ?? '',
      originalTotal: (map['originalTotal'] ?? 0.0).toDouble(),
      requestedTotal: (map['requestedTotal'] ?? 0.0).toDouble(),
      discountPercent: (map['discountPercent'] ?? 0.0).toDouble(),
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      reviewedAt: map['reviewedAt'] is Timestamp
          ? (map['reviewedAt'] as Timestamp).toDate()
          : (map['approvedAt'] is Timestamp
              ? (map['approvedAt'] as Timestamp).toDate()
              : null),
    );
  }
}
