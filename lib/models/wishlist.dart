import 'package:cloud_firestore/cloud_firestore.dart';

/// Wishlist Item in `wishlists/{userId}/wishlistItems/{productId}` subcollection
/// Stores comprehensive product specifications along with user metadata for demand analytics.
class WishlistItem {
  final String productId;
  final DateTime? addedAt;

  // User Metadata (Who demanded/wishlisted this product)
  final String userId;
  final String userName;
  final String userPhone;
  final String userEmail;
  final String userCategory; // Dealer, Architect, Contractor, Customer, etc.
  final String companyName;
  final String city;
  final String state;

  // Product Demand Details
  final String productName;
  final String sku;
  final String tileCategory; // Floor Tiles, Wall Tiles, Slab Tiles, Adhesives, etc.
  final String productLine; // tiles | adhesives
  final String surface; // Glossy, Satin Matt, Carving, etc.
  final String finish;
  final String size;
  final String color;
  final String pattern;
  final double basePrice;
  final String imageUrl;
  final String collection;
  final List<String> spaces;
  final List<String> demandTags;

  const WishlistItem({
    required this.productId,
    this.addedAt,
    this.userId = '',
    this.userName = '',
    this.userPhone = '',
    this.userEmail = '',
    this.userCategory = 'Dealer',
    this.companyName = '',
    this.city = '',
    this.state = '',
    this.productName = '',
    this.sku = '',
    this.tileCategory = '',
    this.productLine = 'tiles',
    this.surface = '',
    this.finish = '',
    this.size = '',
    this.color = '',
    this.pattern = '',
    this.basePrice = 0.0,
    this.imageUrl = '',
    this.collection = '',
    this.spaces = const [],
    this.demandTags = const [],
  });

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'addedAt': addedAt != null
          ? Timestamp.fromDate(addedAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'userId': userId,
      'userName': userName,
      'userPhone': userPhone,
      'userEmail': userEmail,
      'userCategory': userCategory,
      'companyName': companyName,
      'city': city,
      'state': state,
      'productName': productName,
      'sku': sku,
      'tileCategory': tileCategory,
      'productLine': productLine,
      'surface': surface,
      'finish': finish,
      'size': size,
      'color': color,
      'pattern': pattern,
      'basePrice': basePrice,
      'imageUrl': imageUrl,
      'collection': collection,
      'spaces': spaces,
      'demandTags': demandTags,
      'demandSource': 'wishlist',
    };
  }

  factory WishlistItem.fromMap(Map<String, dynamic> map, [String? docId]) {
    return WishlistItem(
      productId: map['productId'] ?? docId ?? '',
      addedAt: map['addedAt'] is Timestamp
          ? (map['addedAt'] as Timestamp).toDate()
          : null,
      userId: map['userId'] ?? '',
      userName: map['userName'] ?? '',
      userPhone: map['userPhone'] ?? '',
      userEmail: map['userEmail'] ?? '',
      userCategory: map['userCategory'] ?? 'Dealer',
      companyName: map['companyName'] ?? '',
      city: map['city'] ?? '',
      state: map['state'] ?? '',
      productName: map['productName'] ?? '',
      sku: map['sku'] ?? '',
      tileCategory: map['tileCategory'] ?? '',
      productLine: map['productLine'] ?? 'tiles',
      surface: map['surface'] ?? '',
      finish: map['finish'] ?? '',
      size: map['size'] ?? '',
      color: map['color'] ?? '',
      pattern: map['pattern'] ?? '',
      basePrice: (map['basePrice'] is num)
          ? (map['basePrice'] as num).toDouble()
          : 0.0,
      imageUrl: map['imageUrl'] ?? '',
      collection: map['collection'] ?? '',
      spaces: (map['spaces'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      demandTags: (map['demandTags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}
