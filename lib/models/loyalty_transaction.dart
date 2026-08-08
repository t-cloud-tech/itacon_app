import 'package:cloud_firestore/cloud_firestore.dart';

/// Loyalty Transaction Document in `loyaltyTransactions` collection per PDF schema
class LoyaltyTransaction {
  final String transactionId;
  final String orderId;
  final String type; // order_reward / redemption / adjustment
  final int points; // Points changed (+50, -20)
  final int balanceAfter; // Balance after transaction
  final String remarks;
  final DateTime? createdAt;

  const LoyaltyTransaction({
    required this.transactionId,
    required this.orderId,
    required this.type,
    required this.points,
    required this.balanceAfter,
    this.remarks = '',
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'transactionId': transactionId,
      'orderId': orderId,
      'type': type,
      'points': points,
      'balanceAfter': balanceAfter,
      'remarks': remarks,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory LoyaltyTransaction.fromMap(Map<String, dynamic> map, String docId) {
    return LoyaltyTransaction(
      transactionId: docId,
      orderId: map['orderId'] ?? '',
      type: map['type'] ?? 'order_reward',
      points: (map['points'] ?? 0).toInt(),
      balanceAfter: (map['balanceAfter'] ?? 0).toInt(),
      remarks: map['remarks'] ?? '',
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }
}
