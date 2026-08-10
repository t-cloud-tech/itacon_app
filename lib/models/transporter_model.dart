import 'package:cloud_firestore/cloud_firestore.dart';

/// Model for representing transporter vendors in `transporters` collection.
class TransporterModel {
  final String transporterId;
  final String companyName;
  final String contactPerson;
  final String phone;
  final String email;
  final List<String> vehicleTypes;
  final List<String> coveredRoutes;
  final String gstNumber;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const TransporterModel({
    required this.transporterId,
    required this.companyName,
    required this.contactPerson,
    required this.phone,
    required this.email,
    this.vehicleTypes = const [],
    this.coveredRoutes = const [],
    required this.gstNumber,
    this.status = 'active',
    this.createdAt,
    this.updatedAt,
  });

  String get id => transporterId;

  Map<String, dynamic> toMap() {
    return {
      'transporterId': transporterId,
      'id': transporterId,
      'companyName': companyName,
      'contactPerson': contactPerson,
      'phone': phone,
      'email': email,
      'vehicleTypes': vehicleTypes,
      'coveredRoutes': coveredRoutes,
      'gstNumber': gstNumber,
      'status': status,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory TransporterModel.fromMap(Map<String, dynamic> map, [String? docId]) {
    final tId = map['transporterId'] ?? map['id'] ?? docId ?? '';
    return TransporterModel(
      transporterId: tId,
      companyName: map['companyName'] ?? '',
      contactPerson: map['contactPerson'] ?? '',
      phone: map['phone'] ?? '',
      email: map['email'] ?? '',
      vehicleTypes: List<String>.from(map['vehicleTypes'] ?? []),
      coveredRoutes: List<String>.from(map['coveredRoutes'] ?? []),
      gstNumber: map['gstNumber'] ?? '',
      status: map['status'] ?? 'active',
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : (map['createdAt'] is String ? DateTime.tryParse(map['createdAt']) : null),
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : (map['updatedAt'] is String ? DateTime.tryParse(map['updatedAt']) : null),
    );
  }

  TransporterModel copyWith({
    String? transporterId,
    String? companyName,
    String? contactPerson,
    String? phone,
    String? email,
    List<String>? vehicleTypes,
    List<String>? coveredRoutes,
    String? gstNumber,
    String? status,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TransporterModel(
      transporterId: transporterId ?? this.transporterId,
      companyName: companyName ?? this.companyName,
      contactPerson: contactPerson ?? this.contactPerson,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      vehicleTypes: vehicleTypes ?? this.vehicleTypes,
      coveredRoutes: coveredRoutes ?? this.coveredRoutes,
      gstNumber: gstNumber ?? this.gstNumber,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
