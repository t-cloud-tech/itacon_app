import 'package:cloud_firestore/cloud_firestore.dart';

/// Model representing an entry in `shipments/{shipmentId}/trackingHistory` sub-collection.
class TrackingHistoryModel {
  final String id;
  final String status;
  final String location;
  final String remarks;
  final String updatedBy;
  final DateTime? timestamp;

  const TrackingHistoryModel({
    this.id = '',
    required this.status,
    required this.location,
    this.remarks = '',
    required this.updatedBy,
    this.timestamp,
  });

  Map<String, dynamic> toMap() {
    return {
      'status': status,
      'location': location,
      'remarks': remarks,
      'updatedBy': updatedBy,
      'timestamp': timestamp != null
          ? Timestamp.fromDate(timestamp!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory TrackingHistoryModel.fromMap(Map<String, dynamic> map, [String? docId]) {
    return TrackingHistoryModel(
      id: docId ?? '',
      status: map['status'] ?? '',
      location: map['location'] ?? '',
      remarks: map['remarks'] ?? '',
      updatedBy: map['updatedBy'] ?? '',
      timestamp: map['timestamp'] is Timestamp
          ? (map['timestamp'] as Timestamp).toDate()
          : (map['timestamp'] is String ? DateTime.tryParse(map['timestamp']) : null),
    );
  }

  TrackingHistoryModel copyWith({
    String? id,
    String? status,
    String? location,
    String? remarks,
    String? updatedBy,
    DateTime? timestamp,
  }) {
    return TrackingHistoryModel(
      id: id ?? this.id,
      status: status ?? this.status,
      location: location ?? this.location,
      remarks: remarks ?? this.remarks,
      updatedBy: updatedBy ?? this.updatedBy,
      timestamp: timestamp ?? this.timestamp,
    );
  }
}
