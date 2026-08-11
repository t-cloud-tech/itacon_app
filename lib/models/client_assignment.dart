import 'package:cloud_firestore/cloud_firestore.dart';

/// Client Assignment Audit Ledger model for `client_assignments` collection
class ClientAssignment {
  final String assignmentId;
  final String clientId;
  final String clientName;
  final String clientPhone;
  final String clientCategory;
  final String salespersonId;
  final String assignmentType; // manual_referral | auto_assigned
  final String status; // active | reassigned | archived
  final DateTime? assignedAt;

  const ClientAssignment({
    required this.assignmentId,
    required this.clientId,
    required this.clientName,
    required this.clientPhone,
    required this.clientCategory,
    required this.salespersonId,
    this.assignmentType = 'manual_referral',
    this.status = 'active',
    this.assignedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'assignmentId': assignmentId,
      'id': assignmentId,
      'clientId': clientId,
      'clientName': clientName,
      'clientPhone': clientPhone,
      'clientCategory': clientCategory,
      'salespersonId': salespersonId,
      'assignmentType': assignmentType,
      'status': status,
      'assignedAt': assignedAt != null
          ? Timestamp.fromDate(assignedAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory ClientAssignment.fromMap(Map<String, dynamic> map, [String? docId]) {
    final aId = map['assignmentId'] ?? map['id'] ?? docId ?? '';
    return ClientAssignment(
      assignmentId: aId,
      clientId: map['clientId'] ?? '',
      clientName: map['clientName'] ?? map['name'] ?? '',
      clientPhone: map['clientPhone'] ?? map['phone'] ?? '',
      clientCategory: map['clientCategory'] ?? map['userCategory'] ?? 'dealer',
      salespersonId: map['salespersonId'] ?? map['salesPersonId'] ?? '',
      assignmentType: map['assignmentType'] ?? 'manual_referral',
      status: map['status'] ?? 'active',
      assignedAt: map['assignedAt'] is Timestamp
          ? (map['assignedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
