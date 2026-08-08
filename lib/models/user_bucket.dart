import 'package:cloud_firestore/cloud_firestore.dart';

/// Item stored in a User's Bucket (Shopping Cart)
class BucketItem {
  final String tileId;
  final String tileName;
  final String size;
  final String surface;
  final int quantity;
  final String orderType; // 'ready_stock' or 'made_against_order'
  final DateTime? addedAt;

  const BucketItem({
    required this.tileId,
    required this.tileName,
    required this.size,
    required this.surface,
    required this.quantity,
    this.orderType = 'ready_stock',
    this.addedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'tileId': tileId,
      'tileName': tileName,
      'size': size,
      'surface': surface,
      'quantity': quantity,
      'orderType': orderType,
      'addedAt': addedAt != null
          ? Timestamp.fromDate(addedAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory BucketItem.fromMap(Map<String, dynamic> map) {
    return BucketItem(
      tileId: map['tileId'] ?? '',
      tileName: map['tileName'] ?? '',
      size: map['size'] ?? '',
      surface: map['surface'] ?? '',
      quantity: (map['quantity'] ?? 1).toInt(),
      orderType: map['orderType'] ?? 'ready_stock',
      addedAt: map['addedAt'] is Timestamp
          ? (map['addedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
