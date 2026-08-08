import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a Custom Design Request (Module 7 of PDF)
/// Submitted by customers for new tile designs not currently in the catalogue.
class DesignRequest {
  final String id;
  final String userId;
  final String size; // e.g. '800x1600'
  final String color; // e.g. 'Calacatta Blue'
  final String surface; // e.g. 'Carving Finish'
  final String? referenceImageUrl;
  final int quantityRequirement; // Required boxes / sqm
  final String remarks;
  final String status; // 'submitted', 'reviewing', 'approved', 'rejected'
  final DateTime? createdAt;

  const DesignRequest({
    required this.id,
    required this.userId,
    required this.size,
    required this.color,
    required this.surface,
    this.referenceImageUrl,
    required this.quantityRequirement,
    required this.remarks,
    this.status = 'submitted',
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'size': size,
      'color': color,
      'surface': surface,
      'referenceImageUrl': referenceImageUrl ?? '',
      'quantityRequirement': quantityRequirement,
      'remarks': remarks,
      'status': status,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory DesignRequest.fromMap(Map<String, dynamic> map, String docId) {
    return DesignRequest(
      id: docId,
      userId: map['userId'] ?? '',
      size: map['size'] ?? '',
      color: map['color'] ?? '',
      surface: map['surface'] ?? '',
      referenceImageUrl: map['referenceImageUrl'],
      quantityRequirement: (map['quantityRequirement'] ?? 10).toInt(),
      remarks: map['remarks'] ?? '',
      status: map['status'] ?? 'submitted',
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }
}
