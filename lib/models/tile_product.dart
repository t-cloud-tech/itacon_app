import 'package:cloud_firestore/cloud_firestore.dart';
import '../utils/tile_dimension_helper.dart';
import '../services/storage_image_service.dart';

/// Represents a Product in the `products` and `tiles` collections per Master Product Schema
class TileProduct {
  final String id; // productId / id
  final String productId; // PDF schema: productId
  final String sku; // Product SKU (e.g. "ITA-STAT-6012")
  final String name; // Product name
  final String categoryId; // Category ID
  final String tileCategory; // Floor Tiles, Wall Tiles, Slab Tiles, Heavy Duty Parkings, Tile Adhesives
  final String productLine; // 'tiles' | 'adhesives'
  final String classification; // Technical classification e.g. TYPE-1 (C1T), TYPE-4 (C2TES1)
  final double bagWeightKg; // Bag weight in Kg for adhesives (default 20.0)
  final String usageTileSizes; // Compatible tile sizes format (e.g. Floor 2x2, 600x1200)
  final String applicationNotes; // Application and substrate guide notes
  final String size; // e.g. '600x1200 mm' or '20 kg Bag'
  final String surface; // Glossy, Satin Matt, Carving, TYPE-1 (C1T), etc.
  final String color; // Product color (Grey, White, etc.)
  final String baseColour; // White, Beige - Brown, Bianco - Grey, Nero, Black
  final String pattern; // Design/pattern
  final double basePrice; // Base price
  final int moq; // Minimum order quantity
  final String unit; // box, bag, sqft, piece
  final String stockStatus; // available / available_now / made_to_order / out_of_stock
  final int availableQuantity; // Current ready stock
  final int currentStock; // Inventory tracking: Total stock
  final int reservedStock; // Inventory tracking: Reserved stock for pending orders
  final int availableStock; // Inventory tracking: Net available stock
  final List<String> images; // Array of product image URLs
  final bool isActive;
  final bool isComingSoon;
  final String collection; // Endless, Marbles, Fixing Solutions
  final List<String> spaces; // Living Room, Bath Room, Bedroom, Outdoor
  final String finish;
  final String productType; // Vitrified | Ceramic | Adhesives
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
  final List<String>? faceImages;
  final List<String>? mockupImages;
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
    this.productLine = 'tiles',
    this.classification = '',
    this.bagWeightKg = 20.0,
    this.usageTileSizes = '',
    this.applicationNotes = '',
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
    this.faceImages,
    this.mockupImages,
    this.packingDetails = const {},
    this.createdAt,
    this.updatedAt,
  })  : productId = productId ?? id,
        baseColour = baseColour ?? color,
        pcsPerBox = pcsPerBox ?? TileDimensionHelper.getPcsPerBox(size),
        currentStock = currentStock ?? availableQuantity,
        availableStock = availableStock ?? ((currentStock ?? availableQuantity) - reservedStock),
        aspectRatioValue = aspectRatioValue ?? TileDimensionHelper.calculateTileAspectRatio(size);

  /// Resolved list of tile face images for multi-face inspection
  List<String> get resolvedFaceImages {
    if (faceImages != null && faceImages!.isNotEmpty) {
      return faceImages!;
    }
    if (images.isNotEmpty) {
      return images;
    }
    return const [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    ];
  }

  /// Resolved list of architectural room mockups (Official Room Mockup from Excel + Floor Installation Mockup)
  List<String> get resolvedMockupImages {
    final list = <String>[];
    if (mockupImages != null && mockupImages!.isNotEmpty) {
      list.addAll(mockupImages!);
    }
    if (lifestyleImages.isNotEmpty) {
      list.addAll(lifestyleImages);
    }
    final tileImg = images.isNotEmpty ? images.first : '';
    if (tileImg.isNotEmpty && !list.contains(tileImg)) {
      list.add(tileImg);
    }
    if (list.isEmpty) {
      list.addAll(const [
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
      ]);
    }
    return list;
  }

  /// The front display image used on product collection cards, lists, and catalog showcases.
  /// Prioritizes the architectural room mockup (`mockupImages.first`),
  /// falling back to lifestyle images, and then flat tile face images.
  String get frontCardImage {
    if (mockupImages != null && mockupImages!.isNotEmpty && mockupImages!.first.isNotEmpty) {
      return mockupImages!.first;
    }
    if (lifestyleImages.isNotEmpty && lifestyleImages.first.isNotEmpty) {
      return lifestyleImages.first;
    }
    if (images.isNotEmpty && images.first.isNotEmpty) {
      return images.first;
    }
    return '';
  }

  /// The optimized WebP thumbnail version of the front display image for Product Collection cards.
  String get frontCardThumbnail =>
      StorageImageService.thumbnailPathFromOriginal(frontCardImage);

  /// Resolved WebP thumbnails for face selectors in Product Detail
  List<String> get resolvedFaceThumbnails =>
      resolvedFaceImages.map(StorageImageService.thumbnailPathFromOriginal).toList();

  bool get isAdhesive =>
      productLine == 'adhesives' || unit == 'bag' || categoryId == 'CAT_ADHESIVES' || sku.startsWith('ITA-LX');

  String get baseColor => baseColour;
  String get categoryName => collection.isNotEmpty ? collection : categoryId;
  String get sizeCm => size;
  double get basePricePerSqFt => basePrice;
  double get basePricePerPiece => basePrice;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'productId': productId,
      'sku': sku,
      'name': name,
      'categoryId': categoryId,
      'tileCategory': tileCategory,
      'productLine': productLine,
      'classification': classification,
      'bagWeightKg': bagWeightKg,
      'usageTileSizes': usageTileSizes,
      'applicationNotes': applicationNotes,
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
      'faceImages': faceImages,
      'mockupImages': mockupImages,
      'lifestyleImages': lifestyleImages,
      'packingDetails': packingDetails,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  /// Converts TileProduct to a standard JSON-encodable map for local persistence
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'productId': productId,
      'sku': sku,
      'name': name,
      'categoryId': categoryId,
      'tileCategory': tileCategory,
      'productLine': productLine,
      'classification': classification,
      'bagWeightKg': bagWeightKg,
      'usageTileSizes': usageTileSizes,
      'applicationNotes': applicationNotes,
      'size': size,
      'surface': surface,
      'color': color,
      'baseColour': baseColour,
      'pattern': pattern,
      'basePrice': basePrice,
      'moq': moq,
      'unit': unit,
      'stockStatus': stockStatus,
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
      if (faceImages != null) 'faceImages': faceImages,
      if (mockupImages != null) 'mockupImages': mockupImages,
      'packingDetails': packingDetails,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
    };
  }

  /// Reconstructs TileProduct from a persisted JSON map
  factory TileProduct.fromJson(Map<String, dynamic> json) {
    final docId = json['id']?.toString() ?? json['productId']?.toString() ?? '';
    return TileProduct.fromMap(json, docId);
  }

  factory TileProduct.fromMap(Map<String, dynamic> map, String docId) {
    final pId = map['productId'] ?? (docId.isNotEmpty ? docId : (map['id'] ?? ''));
    final colorVal = map['baseColour'] ?? map['color'] ?? map['baseColor'] ?? 'Grey';
    final sz = map['size'] ?? '20 kg Bag';
    final stStatus = map['stockStatus'] ?? 'available';
    final cStock = ((map['currentStock'] ?? map['availableQuantity'] ?? 500) as num).toInt();
    final rStock = ((map['reservedStock'] ?? 0) as num).toInt();
    final aStock = ((map['availableStock'] ?? (cStock - rStock)) as num).toInt();
    final aspVal = TileDimensionHelper.calculateTileAspectRatio(sz);

    final prodLine = map['productLine'] ?? (map['unit'] == 'bag' || docId.contains('ADH') || map['categoryId'] == 'CAT_ADHESIVES' ? 'adhesives' : 'tiles');
    final classVal = map['classification'] ?? map['surface'] ?? '';
    final bagWt = ((map['bagWeightKg'] ?? map['boxWeightKg'] ?? 20.0) as num).toDouble();
    final usageVal = map['usageTileSizes'] ?? '';
    final appNotes = map['applicationNotes'] ?? '';

    return TileProduct(
      id: docId.isNotEmpty ? docId : (map['id']?.toString() ?? pId.toString()),
      productId: pId.toString(),
      sku: map['sku'] ?? 'ITA-PROD-$docId',
      name: map['name'] ?? 'Unnamed Product',
      categoryId: map['categoryId'] ?? 'CAT_GLAZED_01',
      tileCategory: map['tileCategory'] ?? (prodLine == 'adhesives' ? 'Tile Adhesives' : 'Floor Tiles'),
      productLine: prodLine,
      classification: classVal,
      bagWeightKg: (map['bagWeightKg'] as num?)?.toDouble() ?? bagWt,
      usageTileSizes: usageVal,
      applicationNotes: appNotes,
      size: sz,
      surface: classVal.isNotEmpty ? classVal : (map['surface'] ?? 'Glossy'),
      color: colorVal,
      baseColour: colorVal,
      pattern: map['pattern'] ?? 'Polymer Modified',
      basePrice: (map['basePrice'] as num?)?.toDouble() ?? 0.0,
      moq: (map['moq'] as num?)?.toInt() ?? 1,
      unit: map['unit'] ?? (prodLine == 'adhesives' ? 'bag' : 'box'),
      stockStatus: stStatus,
      availableQuantity: (map['availableQuantity'] as num?)?.toInt() ?? aStock,
      currentStock: (map['currentStock'] as num?)?.toInt() ?? cStock,
      reservedStock: (map['reservedStock'] as num?)?.toInt() ?? rStock,
      availableStock: (map['availableStock'] as num?)?.toInt() ?? aStock,
      images: map['images'] is List
          ? List<String>.from((map['images'] as List).map((e) => e.toString()))
          : (map['imageUrl'] != null ? [map['imageUrl'].toString()] : <String>[]),
      faceImages: map['faceImages'] is List
          ? List<String>.from((map['faceImages'] as List).map((e) => e.toString()))
          : null,
      mockupImages: map['mockupImages'] is List
          ? List<String>.from((map['mockupImages'] as List).map((e) => e.toString()))
          : null,
      isActive: map['isActive'] ?? true,
      isComingSoon: map['isComingSoon'] ?? false,
      collection: map['collection'] ?? (prodLine == 'adhesives' ? 'Fixing Solutions' : 'Endless'),
      spaces: map['spaces'] is List
          ? List<String>.from((map['spaces'] as List).map((e) => e.toString()))
          : const ['Living Room', 'Bedroom'],
      finish: map['finish'] ?? (prodLine == 'adhesives' ? classVal : 'Polished'),
      productType: map['productType'] ?? (prodLine == 'adhesives' ? 'Adhesives' : 'Vitrified'),
      bodyType: map['bodyType'] ?? (prodLine == 'adhesives' ? 'Polymer Cementitious Matrix' : 'Porcelain'),
      thickness: map['thickness'] ?? '9 mm',
      thicknessMm: (map['thicknessMm'] as num?)?.toDouble() ?? 9.0,
      boxWeightKg: (map['boxWeightKg'] as num?)?.toDouble() ?? bagWt,
      pcsPerBox: (map['pcsPerBox'] as num?)?.toInt() ?? TileDimensionHelper.getPcsPerBox(sz),
      sqFtPerBox: (map['sqFtPerBox'] as num?)?.toDouble() ?? 1.0,
      thicknessCategory: map['thicknessCategory'] ?? 'standard',
      shape: map['shape'] ?? 'rectangle',
      aspectRatio: map['aspectRatio']?.toString() ?? '$aspVal',
      aspectRatioValue: (map['aspectRatioValue'] as num?)?.toDouble() ?? aspVal,
      randomPattern: map['randomPattern'] ?? '4 Faces',
      priceCategory: map['priceCategory'] ?? 'Premium',
      shade: map['shade'] ?? 'Light',
      lifestyleImages: map['lifestyleImages'] is List
          ? List<String>.from((map['lifestyleImages'] as List).map((e) => e.toString()))
          : const [],
      packingDetails: map['packingDetails'] is Map
          ? Map<String, dynamic>.from(map['packingDetails'] as Map)
          : {
              'boxWeight': '$bagWt kg',
              'sqmPerBox': 1.0,
              'boxesPerPallet': 50,
              'piecesPerBox': 1,
            },
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : (map['createdAt'] is String
              ? DateTime.tryParse(map['createdAt'] as String)
              : (map['createdAt'] is DateTime ? map['createdAt'] as DateTime : null)),
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : (map['updatedAt'] is String
              ? DateTime.tryParse(map['updatedAt'] as String)
              : (map['updatedAt'] is DateTime ? map['updatedAt'] as DateTime : null)),
    );
  }
}
