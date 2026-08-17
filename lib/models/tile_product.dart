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
  final int currentStock; // Inventory tracking: Total stock
  final int reservedStock; // Inventory tracking: Reserved stock for pending orders
  final int availableStock; // Inventory tracking: Net available stock
  final List<String> images; // Array of product image URLs
  final bool isActive;
  final String collection;
  final String finish;
  final String bodyType;
  final String thickness;
  final String thicknessCategory; // thin_slim / standard / heavy_thick
  final String shape; // rectangle / square / plank / hexagonal
  final String aspectRatio; // String format (e.g. '1:2' or '0.5')
  final double aspectRatioValue; // Double format (e.g. 0.5 for 600x1200, 1.0 for 800x800)
  final String randomPattern;
  final String priceCategory;
  final String shade;
  final List<String> lifestyleImages;
  final Map<String, dynamic> packingDetails;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  TileProduct({
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
    int? currentStock,
    this.reservedStock = 0,
    int? availableStock,
    required this.images,
    this.isActive = true,
    this.collection = 'General Collection',
    this.finish = 'Polished',
    this.bodyType = 'Porcelain',
    this.thickness = '9 mm',
    this.thicknessCategory = 'standard',
    this.shape = 'rectangle',
    this.aspectRatio = '0.5',
    double? aspectRatioValue,
    this.randomPattern = '4 Faces',
    this.priceCategory = 'Premium',
    this.shade = 'Light',
    this.lifestyleImages = const [],
    this.packingDetails = const {},
    this.createdAt,
    this.updatedAt,
  })  : productId = productId ?? id,
        currentStock = currentStock ?? availableQuantity,
        availableStock = availableStock ?? ((currentStock ?? availableQuantity) - reservedStock),
        aspectRatioValue = aspectRatioValue ?? _parseAspectRatio(aspectRatio);

  static double _parseAspectRatio(dynamic val) {
    if (val is num) return val.toDouble();
    if (val is String) {
      final parsed = double.tryParse(val);
      if (parsed != null) return parsed;
      if (val.contains(':')) {
        final parts = val.split(':');
        if (parts.length == 2) {
          final w = double.tryParse(parts[0]);
          final h = double.tryParse(parts[1]);
          if (w != null && h != null && h != 0) return w / h;
        }
      }
    }
    return 0.5;
  }

  String get baseColor => color;
  String get categoryName => collection.isNotEmpty ? collection : categoryId;
  String get sizeCm => size;
  String get thicknessMm => thickness.endsWith('mm') ? thickness.replaceAll('mm', '').trim() : thickness;
  double get basePricePerSqFt => basePrice;

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
      'inStock': stockStatus == 'available' || stockStatus == 'available_now' || stockStatus == 'Available Now' || stockStatus == 'Limited',
      'availableQuantity': availableQuantity,
      'currentStock': currentStock,
      'reservedStock': reservedStock,
      'availableStock': availableStock,
      'images': images,
      'isActive': isActive,
      'collection': collection,
      'finish': finish,
      'bodyType': bodyType,
      'thickness': thickness,
      'thicknessCategory': thicknessCategory,
      'shape': shape,
      'aspectRatio': aspectRatio,
      'aspectRatioValue': aspectRatioValue,
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
    final cStock = (map['currentStock'] ?? map['availableQuantity'] ?? 500).toInt();
    final rStock = (map['reservedStock'] ?? 0).toInt();
    final aStock = (map['availableStock'] ?? (cStock - rStock)).toInt();
    final aspVal = _parseAspectRatio(map['aspectRatio']);

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
      availableQuantity: aStock,
      currentStock: cStock,
      reservedStock: rStock,
      availableStock: aStock,
      images: List<String>.from(map['images'] ?? []),
      isActive: map['isActive'] ?? true,
      collection: map['collection'] ?? 'General Collection',
      finish: map['finish'] ?? 'Polished',
      bodyType: map['bodyType'] ?? 'Porcelain',
      thickness: map['thickness'] ?? '9 mm',
      thicknessCategory: map['thicknessCategory'] ?? 'standard',
      shape: map['shape'] ?? 'rectangle',
      aspectRatio: map['aspectRatio']?.toString() ?? '0.5',
      aspectRatioValue: aspVal,
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

  TileProduct copyWith({
    String? id,
    String? productId,
    String? sku,
    String? name,
    String? categoryId,
    String? size,
    String? surface,
    String? color,
    String? pattern,
    double? basePrice,
    int? moq,
    String? unit,
    String? stockStatus,
    int? availableQuantity,
    int? currentStock,
    int? reservedStock,
    int? availableStock,
    List<String>? images,
    bool? isActive,
    String? collection,
    String? finish,
    String? bodyType,
    String? thickness,
    String? thicknessCategory,
    String? shape,
    String? aspectRatio,
    double? aspectRatioValue,
    String? randomPattern,
    String? priceCategory,
    String? shade,
    List<String>? lifestyleImages,
    Map<String, dynamic>? packingDetails,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TileProduct(
      id: id ?? this.id,
      productId: productId ?? this.productId,
      sku: sku ?? this.sku,
      name: name ?? this.name,
      categoryId: categoryId ?? this.categoryId,
      size: size ?? this.size,
      surface: surface ?? this.surface,
      color: color ?? this.color,
      pattern: pattern ?? this.pattern,
      basePrice: basePrice ?? this.basePrice,
      moq: moq ?? this.moq,
      unit: unit ?? this.unit,
      stockStatus: stockStatus ?? this.stockStatus,
      availableQuantity: availableQuantity ?? this.availableQuantity,
      currentStock: currentStock ?? this.currentStock,
      reservedStock: reservedStock ?? this.reservedStock,
      availableStock: availableStock ?? this.availableStock,
      images: images ?? this.images,
      isActive: isActive ?? this.isActive,
      collection: collection ?? this.collection,
      finish: finish ?? this.finish,
      bodyType: bodyType ?? this.bodyType,
      thickness: thickness ?? this.thickness,
      thicknessCategory: thicknessCategory ?? this.thicknessCategory,
      shape: shape ?? this.shape,
      aspectRatio: aspectRatio ?? this.aspectRatio,
      aspectRatioValue: aspectRatioValue ?? this.aspectRatioValue,
      randomPattern: randomPattern ?? this.randomPattern,
      priceCategory: priceCategory ?? this.priceCategory,
      shade: shade ?? this.shade,
      lifestyleImages: lifestyleImages ?? this.lifestyleImages,
      packingDetails: packingDetails ?? this.packingDetails,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}




