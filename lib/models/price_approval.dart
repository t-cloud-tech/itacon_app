import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a Price List / Custom Discount Approval Request for Sales Manager or Super Admin (Step 7 of Flow)
class PriceApproval {
  final String id;
  final String orderId;
  final String userId;
  final String salespersonId;
  final double originalTotal;
  final double requestedTotal;
  final double discountPercent;
  final String status; // 'pending_manager_approval', 'approved', 'rejected'
  final String salesManagerNotes;
  final String? approvedBy; // Sales Manager ID / Super Admin ID
  final DateTime? createdAt;
  final DateTime? approvedAt;

  const PriceApproval({
    required this.id,
    required this.orderId,
    required this.userId,
    required this.salespersonId,
    required this.originalTotal,
    required this.requestedTotal,
    required this.discountPercent,
    this.status = 'pending_manager_approval',
    this.salesManagerNotes = '',
    this.approvedBy,
    this.createdAt,
    this.approvedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'orderId': orderId,
      'userId': userId,
      'salespersonId': salespersonId,
      'originalTotal': originalTotal,
      'requestedTotal': requestedTotal,
      'discountPercent': discountPercent,
      'status': status,
      'salesManagerNotes': salesManagerNotes,
      'approvedBy': approvedBy,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'approvedAt': approvedAt != null ? Timestamp.fromDate(approvedAt!) : null,
    };
  }

  factory PriceApproval.fromMap(Map<String, dynamic> map, String docId) {
    return PriceApproval(
      id: docId,
      orderId: map['orderId'] ?? '',
      userId: map['userId'] ?? '',
      salespersonId: map['salespersonId'] ?? '',
      originalTotal: (map['originalTotal'] ?? 0.0).toDouble(),
      requestedTotal: (map['requestedTotal'] ?? 0.0).toDouble(),
      discountPercent: (map['discountPercent'] ?? 0.0).toDouble(),
      status: map['status'] ?? 'pending_manager_approval',
      salesManagerNotes: map['salesManagerNotes'] ?? '',
      approvedBy: map['approvedBy'],
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      approvedAt: map['approvedAt'] is Timestamp
          ? (map['approvedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
