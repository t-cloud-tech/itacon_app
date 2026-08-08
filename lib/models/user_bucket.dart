import 'package:cloud_firestore/cloud_firestore.dart';

/// Item in `carts/{userId}/cartItems/{productId}` subcollection per PDF schema
class CartItem {
  final String productId;
  final int quantity;
  final String orderType; // ready_stock / made_to_order
  final DateTime? addedAt;
  final DateTime? updatedAt;

  const CartItem({
    required this.productId,
    required this.quantity,
    this.orderType = 'ready_stock',
    this.addedAt,
    this.updatedAt,
  });

  String get tileId => productId;

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'tileId': productId,
      'quantity': quantity,
      'orderType': orderType,
      'addedAt': addedAt != null
          ? Timestamp.fromDate(addedAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory CartItem.fromMap(Map<String, dynamic> map, [String? docId]) {
    return CartItem(
      productId: map['productId'] ?? map['tileId'] ?? docId ?? '',
      quantity: (map['quantity'] ?? 1).toInt(),
      orderType: map['orderType'] ?? 'ready_stock',
      addedAt: map['addedAt'] is Timestamp
          ? (map['addedAt'] as Timestamp).toDate()
          : null,
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}

typedef BucketItem = CartItem;
