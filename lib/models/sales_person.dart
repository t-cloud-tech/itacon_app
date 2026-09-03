import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a Salesperson document in `salesPersons` collection per PDF schema
class SalesPerson {
  final String salesPersonId; // Unique salesperson ID
  final String employeeId; // Company employee ID
  final String name; // Salesperson name
  final String phone; // Phone number
  final String email; // Email
  final String referralCode; // Unique referral code
  final String region; // Assigned region
  final List<String> states; // States handled
  final String status; // active / inactive
  final int assignedClientsCount;
  final int activeClientsCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const SalesPerson({
    required this.salesPersonId,
    required this.employeeId,
    required this.name,
    required this.phone,
    required this.email,
    required this.referralCode,
    this.region = 'Western Region',
    this.states = const ['GJ', 'MH'],
    this.status = 'active',
    this.assignedClientsCount = 0,
    this.activeClientsCount = 0,
    this.createdAt,
    this.updatedAt,
  });

  String get role => 'Senior Sales Executive';

  Map<String, dynamic> toMap() {
    return {
      'salesPersonId': salesPersonId,
      'employeeId': employeeId,
      'name': name,
      'fullName': name,
      'phone': phone,
      'phoneNumber': phone,
      'email': email,
      'referralCode': referralCode.trim().toUpperCase(),
      'region': region,
      'states': states,
      'status': status,
      'isActive': status == 'active',
      'assignedClientsCount': assignedClientsCount,
      'activeClientsCount': activeClientsCount,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory SalesPerson.fromMap(Map<String, dynamic> map, String docId) {
    return SalesPerson(
      salesPersonId: map['salesPersonId'] ?? map['salespersonId'] ?? docId,
      employeeId: map['employeeId'] ?? 'EMP-$docId',
      name: map['name'] ?? map['fullName'] ?? '',
      phone: map['phone'] ?? map['phoneNumber'] ?? '',
      email: map['email'] ?? '',
      referralCode: map['referralCode'] ?? '',
      region: map['region'] ?? 'Western Region',
      states: List<String>.from(map['states'] ?? ['GJ']),
      status: map['status'] ?? (map['isActive'] == true ? 'active' : 'inactive'),
      assignedClientsCount: (map['assignedClientsCount'] as num?)?.toInt() ?? 0,
      activeClientsCount: (map['activeClientsCount'] as num?)?.toInt() ?? 0,
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
