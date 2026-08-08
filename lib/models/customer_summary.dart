import 'package:cloud_firestore/cloud_firestore.dart';

/// Customer Summary Document in `customerSummary` collection per PDF schema
class CustomerSummary {
  final String userId;
  final int totalOrders;
  final double totalPurchaseValue;
  final int loyaltyPoints;
  final String currentTier; // Bronze / Silver / Gold / Platinum
  final DateTime? updatedAt;

  const CustomerSummary({
    required this.userId,
    this.totalOrders = 0,
    this.totalPurchaseValue = 0.0,
    this.loyaltyPoints = 0,
    this.currentTier = 'Bronze',
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'totalOrders': totalOrders,
      'totalPurchaseValue': totalPurchaseValue,
      'loyaltyPoints': loyaltyPoints,
      'currentTier': currentTier,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory CustomerSummary.fromMap(Map<String, dynamic> map, String docId) {
    return CustomerSummary(
      userId: docId,
      totalOrders: (map['totalOrders'] ?? 0).toInt(),
      totalPurchaseValue: (map['totalPurchaseValue'] ?? 0.0).toDouble(),
      loyaltyPoints: (map['loyaltyPoints'] ?? 0).toInt(),
      currentTier: map['currentTier'] ?? 'Bronze',
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
