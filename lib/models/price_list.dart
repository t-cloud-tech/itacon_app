import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a Custom Price List for Users / Categories in ITACON CONNECT
class PriceList {
  final String id;
  final String name; // e.g. "Gold Dealer Custom Rate Card", "Wholesale Bulk Rate"
  final String? userCategory; // dealer, wholesaler, retailer, contractor, architect, builder
  final String? userId; // Specific customer UID if user-wise custom pricing
  final Map<String, double> prices; // tileId -> custom unit price
  final bool isActive;
  final DateTime? createdAt;

  const PriceList({
    required this.id,
    required this.name,
    this.userCategory,
    this.userId,
    required this.prices,
    this.isActive = true,
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'userCategory': userCategory,
      'userId': userId,
      'prices': prices,
      'isActive': isActive,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory PriceList.fromMap(Map<String, dynamic> map, String docId) {
    final rawPrices = Map<String, dynamic>.from(map['prices'] ?? {});
    final Map<String, double> parsedPrices = {};
    rawPrices.forEach((key, value) {
      parsedPrices[key] = (value as num).toDouble();
    });

    return PriceList(
      id: docId,
      name: map['name'] ?? 'Custom Price List',
      userCategory: map['userCategory'],
      userId: map['userId'],
      prices: parsedPrices,
      isActive: map['isActive'] ?? true,
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }
}
