import 'package:cloud_firestore/cloud_firestore.dart';

/// Salesperson Client Directory model for `users/{salespersonId}/assigned_clients/{clientId}` sub-collection
class AssignedClientSnapshot {
  final String clientId;
  final String name;
  final String companyName;
  final String phone;
  final String clientCategory;
  final String assignmentType; // manual_referral | auto_assigned
  final DateTime? lastOrderDate;
  final DateTime? assignedAt;

  const AssignedClientSnapshot({
    required this.clientId,
    required this.name,
    required this.companyName,
    required this.phone,
    required this.clientCategory,
    this.assignmentType = 'manual_referral',
    this.lastOrderDate,
    this.assignedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'clientId': clientId,
      'id': clientId,
      'name': name,
      'fullName': name,
      'companyName': companyName,
      'phone': phone,
      'phoneNumber': phone,
      'clientCategory': clientCategory,
      'assignmentType': assignmentType,
      'lastOrderDate': lastOrderDate != null
          ? Timestamp.fromDate(lastOrderDate!)
          : null,
      'assignedAt': assignedAt != null
          ? Timestamp.fromDate(assignedAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory AssignedClientSnapshot.fromMap(Map<String, dynamic> map, [String? docId]) {
    final cId = map['clientId'] ?? map['id'] ?? docId ?? '';
    return AssignedClientSnapshot(
      clientId: cId,
      name: map['name'] ?? map['fullName'] ?? '',
      companyName: map['companyName'] ?? '',
      phone: map['phone'] ?? map['phoneNumber'] ?? '',
      clientCategory: map['clientCategory'] ?? map['userCategory'] ?? 'dealer',
      assignmentType: map['assignmentType'] ?? 'manual_referral',
      lastOrderDate: map['lastOrderDate'] is Timestamp
          ? (map['lastOrderDate'] as Timestamp).toDate()
          : null,
      assignedAt: map['assignedAt'] is Timestamp
          ? (map['assignedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
