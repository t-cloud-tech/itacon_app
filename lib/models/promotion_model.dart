import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a promotion banner document in the `promotions` collection
class PromotionModel {
  final String bannerId;
  final String title;
  final String imageUrl;
  final String redirectType; // 'category' | 'product' | 'external_link' | 'none'
  final String? redirectTargetId;
  final int displayOrder;
  final bool isActive;
  final DateTime? validUntil;

  const PromotionModel({
    required this.bannerId,
    required this.title,
    required this.imageUrl,
    this.redirectType = 'none',
    this.redirectTargetId,
    this.displayOrder = 0,
    this.isActive = true,
    this.validUntil,
  });

  Map<String, dynamic> toMap() {
    return {
      'bannerId': bannerId,
      'title': title,
      'imageUrl': imageUrl,
      'redirectType': redirectType,
      'redirectTargetId': redirectTargetId,
      'displayOrder': displayOrder,
      'isActive': isActive,
      'validUntil': validUntil != null ? Timestamp.fromDate(validUntil!) : null,
    };
  }

  factory PromotionModel.fromMap(Map<String, dynamic> map, [String? docId]) {
    DateTime? validUntilDate;
    final validUntilVal = map['validUntil'];
    if (validUntilVal is Timestamp) {
      validUntilDate = validUntilVal.toDate();
    } else if (validUntilVal is String) {
      validUntilDate = DateTime.tryParse(validUntilVal);
    }

    return PromotionModel(
      bannerId: docId ?? map['bannerId'] ?? map['id'] ?? '',
      title: map['title'] ?? '',
      imageUrl: map['imageUrl'] ?? map['bannerUrl'] ?? '',
      redirectType: map['redirectType'] ?? 'none',
      redirectTargetId: map['redirectTargetId'] ?? map['targetId'],
      displayOrder: (map['displayOrder'] as num?)?.toInt() ?? 0,
      isActive: map['isActive'] as bool? ?? true,
      validUntil: validUntilDate,
    );
  }

  factory PromotionModel.fromSnapshot(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return PromotionModel.fromMap(data, doc.id);
  }
}
