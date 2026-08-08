import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a Product in the `products` and `tiles` collections per PDF schema
class TileProduct {
  final String id; // productId / id
  final String productId; // PDF schema: productId
  final String sku; // Product SKU (e.g. "ITA-STAT-6012")
  final String name; // Product name
  final String categoryId; // Category ID
  final String size; // e.g. '600x1200'
  final String surface; // Glossy, High Gloss, Matt, Carving, Sugar, Punch, Bookmatch
  final String color; // Product color (White, Black, Beige, Grey, etc.)
  final String pattern; // Design/pattern (Marble, Stone, Wood, etc.)
  final double basePrice; // Base price
  final int moq; // Minimum order quantity
  final String unit; // box, sqft, piece
  final String stockStatus; // available / made_to_order / out_of_stock
  final int availableQuantity; // Current ready stock
  final List<String> images; // Array of product image URLs
  final bool isActive;
  final String collection;
  final String finish;
  final String bodyType;
  final String thickness;
  final String randomPattern;
  final String priceCategory;
  final String shade;
  final List<String> lifestyleImages;
  final Map<String, dynamic> packingDetails;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const TileProduct({
    required this.id,
    String? productId,
    this.sku = 'ITA-PROD-001',
    required this.name,
    this.categoryId = 'CAT_GLAZED_01',
    required this.size,
    required this.surface,
    required this.color,
    required this.pattern,
    required this.basePrice,
    required this.moq,
    this.unit = 'box',
    required this.stockStatus,
    this.availableQuantity = 500,
    required this.images,
    this.isActive = true,
    this.collection = 'General Collection',
    this.finish = 'Polished',
    this.bodyType = 'Porcelain',
    this.thickness = '9mm',
    this.randomPattern = '4 Faces',
    this.priceCategory = 'Premium',
    this.shade = 'Light',
    this.lifestyleImages = const [],
    this.packingDetails = const {},
    this.createdAt,
    this.updatedAt,
  }) : productId = productId ?? id;

  String get baseColor => color;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'productId': productId,
      'sku': sku,
      'name': name,
      'categoryId': categoryId,
      'size': size,
      'surface': surface,
      'color': color,
      'baseColor': color,
      'pattern': pattern,
      'basePrice': basePrice,
      'moq': moq,
      'unit': unit,
      'stockStatus': stockStatus,
      'inStock': stockStatus == 'available' || stockStatus == 'Available Now' || stockStatus == 'Limited',
      'availableQuantity': availableQuantity,
      'images': images,
      'isActive': isActive,
      'collection': collection,
      'finish': finish,
      'bodyType': bodyType,
      'thickness': thickness,
      'randomPattern': randomPattern,
      'priceCategory': priceCategory,
      'shade': shade,
      'lifestyleImages': lifestyleImages,
      'packingDetails': packingDetails,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory TileProduct.fromMap(Map<String, dynamic> map, String docId) {
    final pId = map['productId'] ?? docId;
    final colorVal = map['color'] ?? map['baseColor'] ?? 'White';
    final stStatus = map['stockStatus'] ?? 'available';

    return TileProduct(
      id: docId,
      productId: pId,
      sku: map['sku'] ?? 'ITA-PROD-$docId',
      name: map['name'] ?? 'Unnamed Product',
      categoryId: map['categoryId'] ?? 'CAT_GLAZED_01',
      size: map['size'] ?? '600x1200',
      surface: map['surface'] ?? 'Glossy',
      color: colorVal,
      pattern: map['pattern'] ?? 'Marble',
      basePrice: (map['basePrice'] ?? 0.0).toDouble(),
      moq: (map['moq'] ?? 10).toInt(),
      unit: map['unit'] ?? 'box',
      stockStatus: stStatus,
      availableQuantity: (map['availableQuantity'] ?? 500).toInt(),
      images: List<String>.from(map['images'] ?? []),
      isActive: map['isActive'] ?? true,
      collection: map['collection'] ?? 'General Collection',
      finish: map['finish'] ?? 'Polished',
      bodyType: map['bodyType'] ?? 'Porcelain',
      thickness: map['thickness'] ?? '9mm',
      randomPattern: map['randomPattern'] ?? '4 Faces',
      priceCategory: map['priceCategory'] ?? 'Premium',
      shade: map['shade'] ?? 'Light',
      lifestyleImages: List<String>.from(map['lifestyleImages'] ?? []),
      packingDetails: Map<String, dynamic>.from(map['packingDetails'] ?? {
        'boxWeight': '30 kg',
        'sqmPerBox': 1.44,
        'boxesPerPallet': 40,
        'piecesPerBox': 2,
      }),
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
