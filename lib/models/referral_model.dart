import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

/// Represents a customer-to-customer referral document in `referrals/{id}`
class ReferralModel {
  final String id;
  final String referrerUid;
  final String referredUid;
  final String referralCode;
  final int signupRewardPoints;
  final double orderRewardAmount; // Monetary ₹5,555 reward
  final String status; // signed_up, order_pending, order_qualified, reward_pending, reward_approved, reward_paid
  final String? qualifyingOrderId;
  final bool signupRewardGranted;
  final bool orderRewardGranted;
  final String? referredCustomerName;
  final String? referredCustomerPhone;
  final DateTime? createdAt;
  final DateTime? qualifiedAt;
  final DateTime? approvedAt;

  const ReferralModel({
    required this.id,
    required this.referrerUid,
    required this.referredUid,
    required this.referralCode,
    this.signupRewardPoints = 500,
    this.orderRewardAmount = 5555.0,
    required this.status,
    this.qualifyingOrderId,
    this.signupRewardGranted = true,
    this.orderRewardGranted = false,
    this.referredCustomerName,
    this.referredCustomerPhone,
    this.createdAt,
    this.qualifiedAt,
    this.approvedAt,
  });

  /// Privacy-masked phone number (e.g. +91 98****1234)
  String get maskedPhone {
    final p = (referredCustomerPhone ?? '').trim();
    if (p.length < 6) return '••••••';
    final start = p.substring(0, p.length - 6);
    final end = p.substring(p.length - 4);
    return '$start•••$end';
  }

  /// Privacy-safe name (e.g. Rajesh S.)
  String get maskedName {
    final n = (referredCustomerName ?? '').trim();
    if (n.isEmpty) return 'Trade Partner';
    final parts = n.split(' ');
    if (parts.length > 1) {
      return '${parts[0]} ${parts[1][0]}.';
    }
    return parts[0];
  }

  /// Human-friendly display label for referral status
  String get statusDisplay {
    switch (status) {
      case 'signed_up':
        return 'Signed Up';
      case 'order_pending':
        return 'Order Pending';
      case 'order_qualified':
        return 'Order Qualified';
      case 'reward_pending':
        return 'Reward Pending';
      case 'reward_approved':
        return 'Reward Approved';
      case 'reward_paid':
        return 'Reward Paid';
      default:
        return 'Signed Up';
    }
  }

  Color get statusColor {
    switch (status) {
      case 'signed_up':
        return const Color(0xFF1E88E5); // Blue
      case 'order_pending':
        return const Color(0xFFFB8C00); // Orange
      case 'order_qualified':
      case 'reward_pending':
        return const Color(0xFF8E24AA); // Purple
      case 'reward_approved':
      case 'reward_paid':
        return const Color(0xFF43A047); // Green
      default:
        return const Color(0xFF757575);
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'referrerUid': referrerUid,
      'referredUid': referredUid,
      'referralCode': referralCode,
      'signupRewardPoints': signupRewardPoints,
      'orderRewardAmount': orderRewardAmount,
      'status': status,
      'qualifyingOrderId': qualifyingOrderId,
      'signupRewardGranted': signupRewardGranted,
      'orderRewardGranted': orderRewardGranted,
      'referredCustomerName': referredCustomerName,
      'referredCustomerPhone': referredCustomerPhone,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      if (qualifiedAt != null) 'qualifiedAt': Timestamp.fromDate(qualifiedAt!),
      if (approvedAt != null) 'approvedAt': Timestamp.fromDate(approvedAt!),
    };
  }

  factory ReferralModel.fromMap(Map<String, dynamic> map, String docId) {
    return ReferralModel(
      id: docId,
      referrerUid: map['referrerUid'] ?? '',
      referredUid: map['referredUid'] ?? '',
      referralCode: map['referralCode'] ?? '',
      signupRewardPoints: (map['signupRewardPoints'] as num?)?.toInt() ?? 500,
      orderRewardAmount: (map['orderRewardAmount'] as num?)?.toDouble() ?? 5555.0,
      status: map['status'] ?? 'signed_up',
      qualifyingOrderId: map['qualifyingOrderId'],
      signupRewardGranted: map['signupRewardGranted'] ?? false,
      orderRewardGranted: map['orderRewardGranted'] ?? false,
      referredCustomerName: map['referredCustomerName'] ?? map['clientName'],
      referredCustomerPhone: map['referredCustomerPhone'] ?? map['clientPhone'],
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      qualifiedAt: map['qualifiedAt'] is Timestamp
          ? (map['qualifiedAt'] as Timestamp).toDate()
          : null,
      approvedAt: map['approvedAt'] is Timestamp
          ? (map['approvedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
