import 'package:cloud_firestore/cloud_firestore.dart';
import '../utils/tile_dimension_helper.dart';

/// Represents a Product in the `products` and `tiles` collections per Master Product Schema
class TileProduct {
  final String id; // productId / id
  final String productId; // PDF schema: productId
  final String sku; // Product SKU (e.g. "ITA-STAT-6012")
  final String name; // Product name
  final String categoryId; // Category ID
  final String tileCategory; // Floor Tiles, Wall Tiles, Slab Tiles, Heavy Duty Parkings
  final String size; // e.g. '600x1200 mm'
  final String surface; // Glossy, Satin Matt, Matt - Carving, Rustic Wood, Inky Colors, High Gloss, Anti - Skid, Matt Punch, Sugar Lapato, Pastel Colors
  final String color; // Product color
  final String baseColour; // White, Beige - Brown, Bianco - Grey, Nero, Black
  final String pattern; // Design/pattern
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
  final bool isComingSoon;
  final String collection; // Endless, Marbles, Golden, Terrazzo, 3D, Book Match, Wall Decore, Moracan
  final List<String> spaces; // Living Room, Bath Room, Bedroom, Outdoor
  final String finish;
  final String productType; // Vitrified | Ceramic
  final String bodyType;
  final String thickness;
  final double thicknessMm; // e.g. 9.0
  final double boxWeightKg; // e.g. 28.0
  final int pcsPerBox; // e.g. 2 or 4
  final double sqFtPerBox; // e.g. 15.5
  final String thicknessCategory; // thin_slim / standard / heavy_thick
  final String shape; // rectangle / square / plank / hexagonal
  final String aspectRatio; // String format (e.g. '0.5' or '1.0')
  final double aspectRatioValue; // Double format
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
    this.tileCategory = 'Floor Tiles',
    required this.size,
    required this.surface,
    required this.color,
    String? baseColour,
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
    this.isComingSoon = false,
    this.collection = 'Endless',
    this.spaces = const ['Living Room', 'Bedroom'],
    this.finish = 'Polished',
    this.productType = 'Vitrified',
    this.bodyType = 'Porcelain',
    this.thickness = '9 mm',
    this.thicknessMm = 9.0,
    this.boxWeightKg = 28.0,
    int? pcsPerBox,
    this.sqFtPerBox = 15.5,
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
        baseColour = baseColour ?? color,
        pcsPerBox = pcsPerBox ?? TileDimensionHelper.getPcsPerBox(size),
        currentStock = currentStock ?? availableQuantity,
        availableStock = availableStock ?? ((currentStock ?? availableQuantity) - reservedStock),
        aspectRatioValue = aspectRatioValue ?? TileDimensionHelper.calculateTileAspectRatio(size);

  String get baseColor => baseColour;
  String get categoryName => collection.isNotEmpty ? collection : categoryId;
  String get sizeCm => size;
  double get basePricePerSqFt => basePrice;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'productId': productId,
      'sku': sku,
      'name': name,
      'categoryId': categoryId,
      'tileCategory': tileCategory,
      'size': size,
      'surface': surface,
      'color': color,
      'baseColour': baseColour,
      'pattern': pattern,
      'basePrice': basePrice,
      'moq': moq,
      'unit': unit,
      'stockStatus': stockStatus,
      'inStock': stockStatus == 'available' || stockStatus == 'available_now' || stockStatus == 'Available Now',
      'availableQuantity': availableQuantity,
      'currentStock': currentStock,
      'reservedStock': reservedStock,
      'availableStock': availableStock,
      'images': images,
      'isActive': isActive,
      'isComingSoon': isComingSoon,
      'collection': collection,
      'spaces': spaces,
      'finish': finish,
      'productType': productType,
      'bodyType': bodyType,
      'thickness': thickness,
      'thicknessMm': thicknessMm,
      'boxWeightKg': boxWeightKg,
      'pcsPerBox': pcsPerBox,
      'sqFtPerBox': sqFtPerBox,
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
    final colorVal = map['baseColour'] ?? map['color'] ?? map['baseColor'] ?? 'White';
    final sz = map['size'] ?? '600x1200 mm';
    final stStatus = map['stockStatus'] ?? 'available';
    final cStock = (map['currentStock'] ?? map['availableQuantity'] ?? 500).toInt();
    final rStock = (map['reservedStock'] ?? 0).toInt();
    final aStock = (map['availableStock'] ?? (cStock - rStock)).toInt();
    final aspVal = TileDimensionHelper.calculateTileAspectRatio(sz);

    return TileProduct(
      id: docId,
      productId: pId,
      sku: map['sku'] ?? 'ITA-PROD-$docId',
      name: map['name'] ?? 'Unnamed Product',
      categoryId: map['categoryId'] ?? 'CAT_GLAZED_01',
      tileCategory: map['tileCategory'] ?? 'Floor Tiles',
      size: sz,
      surface: map['surface'] ?? 'Glossy',
      color: colorVal,
      baseColour: colorVal,
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
      isComingSoon: map['isComingSoon'] ?? false,
      collection: map['collection'] ?? 'Endless',
      spaces: List<String>.from(map['spaces'] ?? ['Living Room', 'Bedroom']),
      finish: map['finish'] ?? 'Polished',
      productType: map['productType'] ?? 'Vitrified',
      bodyType: map['bodyType'] ?? 'Porcelain',
      thickness: map['thickness'] ?? '9 mm',
      thicknessMm: (map['thicknessMm'] ?? 9.0).toDouble(),
      boxWeightKg: (map['boxWeightKg'] ?? 28.0).toDouble(),
      pcsPerBox: (map['pcsPerBox'] ?? TileDimensionHelper.getPcsPerBox(sz)).toInt(),
      sqFtPerBox: (map['sqFtPerBox'] ?? 15.5).toDouble(),
      thicknessCategory: map['thicknessCategory'] ?? 'standard',
      shape: map['shape'] ?? 'rectangle',
      aspectRatio: map['aspectRatio']?.toString() ?? '$aspVal',
      aspectRatioValue: aspVal,
      randomPattern: map['randomPattern'] ?? '4 Faces',
      priceCategory: map['priceCategory'] ?? 'Premium',
      shade: map['shade'] ?? 'Light',
      lifestyleImages: List<String>.from(map['lifestyleImages'] ?? []),
      packingDetails: Map<String, dynamic>.from(map['packingDetails'] ?? {
        'boxWeight': '28 kg',
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
