import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a Tile Product in the ITACON CONNECT Catalogue
class TileProduct {
  final String id;
  final String name;
  final String size; // e.g. '600x1200', '800x1600', '1200x1800', '300x600'
  final String surface; // Glossy, High Gloss, Matt, Carving, Sugar, Punch, Bookmatch
  final String baseColor; // White, Black, Beige, Grey, Brown, Blue, Green
  final String pattern; // Marble, Stone, Concrete, Wood, Terrazzo, Plain
  final String collection; // e.g. 'Luxury Marble 2026', 'Royal Carving Series'
  final String finish; // Glossy, Satin, Rustic, Polished
  final String bodyType; // Vitrified, Ceramic, Porcelain, Full Body
  final String thickness; // e.g. '9mm', '12mm'
  final String randomPattern; // e.g. '4 Faces', '6 Faces'
  final String priceCategory; // Premium, Standard, Economy
  final String shade; // Light, Medium, Dark
  final double basePrice; // Base price per Box or Sqm
  final int moq; // Minimum Order Quantity in Boxes/Sqm
  final String stockStatus; // 'Available Now', 'Made-to-Order', 'Limited', 'Running Production', 'Out of Stock'
  final List<String> images; // List of HD Image URLs
  final List<String> lifestyleImages; // List of Lifestyle / Room Preview Image URLs
  final Map<String, dynamic> packingDetails; // boxWeight, sqmPerBox, boxesPerPallet, piecesPerBox
  final bool isActive;
  final DateTime? createdAt;

  const TileProduct({
    required this.id,
    required this.name,
    required this.size,
    required this.surface,
    required this.baseColor,
    required this.pattern,
    required this.collection,
    required this.finish,
    required this.bodyType,
    required this.thickness,
    required this.randomPattern,
    required this.priceCategory,
    required this.shade,
    required this.basePrice,
    required this.moq,
    required this.stockStatus,
    required this.images,
    required this.lifestyleImages,
    required this.packingDetails,
    this.isActive = true,
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'size': size,
      'surface': surface,
      'baseColor': baseColor,
      'pattern': pattern,
      'collection': collection,
      'finish': finish,
      'bodyType': bodyType,
      'thickness': thickness,
      'randomPattern': randomPattern,
      'priceCategory': priceCategory,
      'shade': shade,
      'basePrice': basePrice,
      'moq': moq,
      'stockStatus': stockStatus,
      'inStock': stockStatus == 'Available Now' || stockStatus == 'Limited',
      'images': images,
      'lifestyleImages': lifestyleImages,
      'packingDetails': packingDetails,
      'isActive': isActive,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory TileProduct.fromMap(Map<String, dynamic> map, String docId) {
    return TileProduct(
      id: docId,
      name: map['name'] ?? 'Unnamed Tile',
      size: map['size'] ?? '600x1200',
      surface: map['surface'] ?? 'Glossy',
      baseColor: map['baseColor'] ?? 'White',
      pattern: map['pattern'] ?? 'Marble',
      collection: map['collection'] ?? 'General Collection',
      finish: map['finish'] ?? 'Polished',
      bodyType: map['bodyType'] ?? 'Porcelain',
      thickness: map['thickness'] ?? '9mm',
      randomPattern: map['randomPattern'] ?? '4 Faces',
      priceCategory: map['priceCategory'] ?? 'Premium',
      shade: map['shade'] ?? 'Light',
      basePrice: (map['basePrice'] ?? 0.0).toDouble(),
      moq: (map['moq'] ?? 10).toInt(),
      stockStatus: map['stockStatus'] ?? 'Available Now',
      images: List<String>.from(map['images'] ?? []),
      lifestyleImages: List<String>.from(map['lifestyleImages'] ?? []),
      packingDetails: Map<String, dynamic>.from(map['packingDetails'] ?? {
        'boxWeight': '30 kg',
        'sqmPerBox': 1.44,
        'boxesPerPallet': 40,
        'piecesPerBox': 2,
      }),
      isActive: map['isActive'] ?? true,
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }
}
