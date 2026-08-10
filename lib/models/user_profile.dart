import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a User document in the `users` collection per the official PDF schema
class UserProfile {
  final String userId; // Firebase Auth UID
  final String name; // User name
  final String companyName; // Business/company name
  final String phone; // Mobile number
  final String email; // Email
  final String userCategory; // Dealer / Wholesale / Retail / Contractor / Architect / Builder
  final String role; // customer / salesperson / manager / admin
  final String? salesPersonId; // Assigned salesperson
  final String? referralCode; // Referral code used during registration
  final bool phoneVerified; // Phone verification status
  final bool emailVerified; // Email verification status
  final bool whatsappVerified; // WhatsApp verification status
  final Map<String, dynamic> address; // Default address
  final String city; // City
  final String state; // State
  final String pincode; // PIN code
  final String status; // active / inactive / blocked
  final int assignedClientsCount;
  final int activeClientsCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const UserProfile({
    required this.userId,
    required this.name,
    required this.companyName,
    required this.phone,
    required this.email,
    required this.userCategory,
    required this.role,
    this.salesPersonId,
    this.referralCode,
    this.phoneVerified = false,
    this.emailVerified = false,
    this.whatsappVerified = false,
    this.address = const {},
    this.city = '',
    this.state = '',
    this.pincode = '',
    this.status = 'active',
    this.assignedClientsCount = 0,
    this.activeClientsCount = 0,
    this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'uid': userId,
      'name': name,
      'fullName': name,
      'companyName': companyName,
      'phone': phone,
      'phoneNumber': phone,
      'email': email,
      'userCategory': userCategory,
      'role': role,
      'salesPersonId': salesPersonId,
      'assignedSalespersonId': salesPersonId,
      'referralCode': referralCode,
      'phoneVerified': phoneVerified,
      'emailVerified': emailVerified,
      'whatsappVerified': whatsappVerified,
      'address': address,
      'city': city,
      'state': state,
      'stateCode': state.isNotEmpty && state.length >= 2 ? state.substring(0, 2).toUpperCase() : '',
      'pincode': pincode,
      'status': status,
      'assignedClientsCount': assignedClientsCount,
      'activeClientsCount': activeClientsCount,
      'isVerified': phoneVerified || whatsappVerified,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory UserProfile.fromMap(Map<String, dynamic> map, String docId) {
    return UserProfile(
      userId: docId,
      name: map['name'] ?? map['fullName'] ?? '',
      companyName: map['companyName'] ?? '',
      phone: map['phone'] ?? map['phoneNumber'] ?? '',
      email: map['email'] ?? '',
      userCategory: map['userCategory'] ?? map['role'] ?? 'dealer',
      role: map['role'] ?? 'customer',
      salesPersonId: map['salesPersonId'] ?? map['assignedSalespersonId'],
      referralCode: map['referralCode'],
      phoneVerified: map['phoneVerified'] ?? map['isVerified'] ?? false,
      emailVerified: map['emailVerified'] ?? false,
      whatsappVerified: map['whatsappVerified'] ?? false,
      address: Map<String, dynamic>.from(map['address'] ?? {}),
      city: map['city'] ?? '',
      state: map['state'] ?? map['stateCode'] ?? '',
      pincode: map['pincode'] ?? '',
      status: map['status'] ?? 'active',
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
