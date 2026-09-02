import 'package:cloud_firestore/cloud_firestore.dart';

/// Customer Custom Pricing Document in `customerPricing` collection per PDF schema
class CustomerPricing {
  final String id; // Document ID (e.g. userId_productId)
  final String userId; // Customer ID
  final String productId; // Product ID
  final double basePrice; // Base product price
  final double customerPrice; // Customer-specific price
  final double discount; // Discount amount
  final DateTime? updatedAt;

  const CustomerPricing({
    required this.id,
    required this.userId,
    required this.productId,
    required this.basePrice,
    required this.customerPrice,
    required this.discount,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'productId': productId,
      'basePrice': basePrice,
      'customerPrice': customerPrice,
      'discount': discount,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory CustomerPricing.fromMap(Map<String, dynamic> map, String docId) {
    return CustomerPricing(
      id: docId,
      userId: map['userId'] ?? '',
      productId: map['productId'] ?? '',
      basePrice: (map['basePrice'] ?? 0.0).toDouble(),
      customerPrice: (map['customerPrice'] ?? 0.0).toDouble(),
      discount: (map['discount'] ?? 0.0).toDouble(),
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}

/// Represents a surface-wise and size-wise contract rate item
class SurfaceContractRate {
  final String size; // e.g. '600x1200 mm'
  final String surface; // e.g. 'Glossy', 'Satin Matt', 'Matt - Carving', 'Rustic Wood', 'High Gloss', 'Anti - Skid'
  final double contractRate; // Approved custom rate per sq.ft (₹)
  final double mrp; // Standard MRP per sq.ft (₹)

  const SurfaceContractRate({
    required this.size,
    required this.surface,
    required this.contractRate,
    required this.mrp,
  });

  double get discountPercent {
    if (mrp <= 0) return 0.0;
    final diff = mrp - contractRate;
    return (diff / mrp * 100).clamp(0.0, 100.0);
  }

  Map<String, dynamic> toMap() {
    return {
      'size': size,
      'surface': surface,
      'contractRate': contractRate,
      'mrp': mrp,
    };
  }

  factory SurfaceContractRate.fromMap(Map<String, dynamic> map) {
    return SurfaceContractRate(
      size: map['size'] ?? '',
      surface: map['surface'] ?? '',
      contractRate: (map['contractRate'] as num?)?.toDouble() ?? 0.0,
      mrp: (map['mrp'] as num?)?.toDouble() ?? 0.0,
    );
  }

  /// Default surface rate matrix generator for dealer tier contract rates
  static List<SurfaceContractRate> getDefaultContractMatrix() {
    return const [
      // 600x1200 mm
      SurfaceContractRate(size: '600x1200 mm', surface: 'Glossy', contractRate: 120.0, mrp: 160.0),
      SurfaceContractRate(size: '600x1200 mm', surface: 'High Gloss', contractRate: 135.0, mrp: 180.0),
      SurfaceContractRate(size: '600x1200 mm', surface: 'Matt - Carving', contractRate: 140.0, mrp: 190.0),
      SurfaceContractRate(size: '600x1200 mm', surface: 'Satin Matt', contractRate: 125.0, mrp: 165.0),
      SurfaceContractRate(size: '600x1200 mm', surface: 'Rustic Wood', contractRate: 130.0, mrp: 175.0),
      SurfaceContractRate(size: '600x1200 mm', surface: 'Anti - Skid', contractRate: 115.0, mrp: 155.0),

      // 600x600 mm
      SurfaceContractRate(size: '600x600 mm', surface: 'Glossy', contractRate: 72.0, mrp: 95.0),
      SurfaceContractRate(size: '600x600 mm', surface: 'High Gloss', contractRate: 85.0, mrp: 110.0),
      SurfaceContractRate(size: '600x600 mm', surface: 'Satin Matt', contractRate: 75.0, mrp: 98.0),
      SurfaceContractRate(size: '600x600 mm', surface: 'Anti - Skid', contractRate: 70.0, mrp: 90.0),

      // 1200x1800 mm
      SurfaceContractRate(size: '1200x1800 mm', surface: 'High Gloss', contractRate: 210.0, mrp: 280.0),
      SurfaceContractRate(size: '1200x1800 mm', surface: 'Matt - Carving', contractRate: 225.0, mrp: 300.0),
      SurfaceContractRate(size: '1200x1800 mm', surface: 'Glossy', contractRate: 195.0, mrp: 260.0),

      // 800x1600 mm
      SurfaceContractRate(size: '800x1600 mm', surface: 'High Gloss', contractRate: 165.0, mrp: 220.0),
      SurfaceContractRate(size: '800x1600 mm', surface: 'Matt - Carving', contractRate: 175.0, mrp: 235.0),
      SurfaceContractRate(size: '800x1600 mm', surface: 'Satin Matt', contractRate: 155.0, mrp: 205.0),
      SurfaceContractRate(size: '800x1600 mm', surface: 'Rustic Wood', contractRate: 160.0, mrp: 215.0),
    ];
  }
}
