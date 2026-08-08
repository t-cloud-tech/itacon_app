import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a Category document in the `categories` collection per PDF schema
class ProductCategory {
  final String categoryId;
  final String name; // Category name (e.g. "GVT/PGVT Slabs", "Parking Tiles")
  final String description;
  final String imageUrl;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const ProductCategory({
    required this.categoryId,
    required this.name,
    required this.description,
    required this.imageUrl,
    this.isActive = true,
    this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'categoryId': categoryId,
      'name': name,
      'description': description,
      'imageUrl': imageUrl,
      'isActive': isActive,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory ProductCategory.fromMap(Map<String, dynamic> map, String docId) {
    return ProductCategory(
      categoryId: docId,
      name: map['name'] ?? '',
      description: map['description'] ?? '',
      imageUrl: map['imageUrl'] ?? '',
      isActive: map['isActive'] ?? true,
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
