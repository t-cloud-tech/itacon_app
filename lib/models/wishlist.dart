import 'package:cloud_firestore/cloud_firestore.dart';

/// Wishlist Item in `wishlists/{userId}/wishlistItems/{productId}` subcollection per PDF schema
class WishlistItem {
  final String productId;
  final DateTime? addedAt;

  const WishlistItem({
    required this.productId,
    this.addedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'addedAt': addedAt != null
          ? Timestamp.fromDate(addedAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory WishlistItem.fromMap(Map<String, dynamic> map, [String? docId]) {
    return WishlistItem(
      productId: map['productId'] ?? docId ?? '',
      addedAt: map['addedAt'] is Timestamp
          ? (map['addedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
