import 'package:cloud_firestore/cloud_firestore.dart';

/// Customer Custom Pricing Document in `customerPricing` collection per PDF schema
class CustomerPricing {
  final String id; // Document ID (e.g. userId_productId)
  final String userId; // Customer ID
  final String productId; // Product ID
  final double basePrice; // Base product price
  final double customerPrice; // Customer-specific price
  final double discount; // Discount amount
  final DateTime? updatedAt;

  const CustomerPricing({
    required this.id,
    required this.userId,
    required this.productId,
    required this.basePrice,
    required this.customerPrice,
    required this.discount,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'productId': productId,
      'basePrice': basePrice,
      'customerPrice': customerPrice,
      'discount': discount,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory CustomerPricing.fromMap(Map<String, dynamic> map, String docId) {
    return CustomerPricing(
      id: docId,
      userId: map['userId'] ?? '',
      productId: map['productId'] ?? '',
      basePrice: (map['basePrice'] ?? 0.0).toDouble(),
      customerPrice: (map['customerPrice'] ?? 0.0).toDouble(),
      discount: (map['discount'] ?? 0.0).toDouble(),
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
