import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

/// Represents a customer redemption request in `loyaltyRedemptions/{id}`
class LoyaltyRedemption {
  final String id;
  final String userId;
  final int requestedPoints;
  final double rupeesAmount;
  final String status; // pending, approved, rejected, paid
  final String? bankDetails;
  final String? upiId;
  final String? adminRemarks;
  final DateTime? createdAt;
  final DateTime? processedAt;

  const LoyaltyRedemption({
    required this.id,
    required this.userId,
    required this.requestedPoints,
    required this.rupeesAmount,
    this.status = 'pending',
    this.bankDetails,
    this.upiId,
    this.adminRemarks,
    this.createdAt,
    this.processedAt,
  });

  String get statusDisplay {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Declined';
      case 'paid':
        return 'Transferred';
      default:
        return 'Pending';
    }
  }

  Color get statusColor {
    switch (status) {
      case 'pending':
        return const Color(0xFFFB8C00); // Orange
      case 'approved':
        return const Color(0xFF1E88E5); // Blue
      case 'paid':
        return const Color(0xFF43A047); // Green
      case 'rejected':
        return const Color(0xFFE53935); // Red
      default:
        return Colors.grey;
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'requestedPoints': requestedPoints,
      'rupeesAmount': rupeesAmount,
      'status': status,
      if (bankDetails != null) 'bankDetails': bankDetails,
      if (upiId != null) 'upiId': upiId,
      if (adminRemarks != null) 'adminRemarks': adminRemarks,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      if (processedAt != null) 'processedAt': Timestamp.fromDate(processedAt!),
    };
  }

  factory LoyaltyRedemption.fromMap(Map<String, dynamic> map, String docId) {
    return LoyaltyRedemption(
      id: docId,
      userId: map['userId'] ?? '',
      requestedPoints: (map['requestedPoints'] as num?)?.toInt() ?? 0,
      rupeesAmount: (map['rupeesAmount'] as num?)?.toDouble() ?? 0.0,
      status: map['status'] ?? 'pending',
      bankDetails: map['bankDetails'],
      upiId: map['upiId'],
      adminRemarks: map['adminRemarks'],
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      processedAt: map['processedAt'] is Timestamp
          ? (map['processedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
