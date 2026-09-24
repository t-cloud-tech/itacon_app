import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

/// Loyalty Transaction Document in `loyaltyTransactions` collection per production rewards schema
class LoyaltyTransaction {
  final String transactionId;
  final String userId;
  final String orderId; // Legacy or related order ID
  final String? relatedOrderId;
  final String? relatedReferralId;
  final String type; // welcome_bonus, purchase_points, referral_signup, redemption, admin_adjustment, order_reward
  final int points; // Points changed (+500, +1000, -50000)
  final int balanceAfter; // Balance after transaction
  final String remarks;
  final String? description;
  final String status; // completed, pending, cancelled
  final DateTime? createdAt;

  const LoyaltyTransaction({
    required this.transactionId,
    this.userId = '',
    this.orderId = '',
    this.relatedOrderId,
    this.relatedReferralId,
    required this.type,
    required this.points,
    this.balanceAfter = 0,
    this.remarks = '',
    this.description,
    this.status = 'completed',
    this.createdAt,
  });

  bool get isPositive => points >= 0;

  String get pointsFormatted => isPositive ? '+$points' : '$points';

  Color get pointsColor => isPositive ? const Color(0xFF2E7D32) : const Color(0xFFC62828);

  String get titleDisplay {
    switch (type) {
      case 'welcome_bonus':
        return 'Welcome Bonus';
      case 'purchase_points':
      case 'order_reward':
        return 'Purchase Points';
      case 'referral_signup':
        return 'Referral Sign-Up Bonus';
      case 'redemption':
        return 'Points Redemption';
      case 'admin_adjustment':
        return 'Admin Adjustment';
      default:
        return 'Loyalty Points';
    }
  }

  IconData get iconDisplay {
    switch (type) {
      case 'welcome_bonus':
        return Icons.celebration_rounded;
      case 'purchase_points':
      case 'order_reward':
        return Icons.shopping_bag_rounded;
      case 'referral_signup':
        return Icons.people_alt_rounded;
      case 'redemption':
        return Icons.redeem_rounded;
      case 'admin_adjustment':
        return Icons.tune_rounded;
      default:
        return Icons.stars_rounded;
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'transactionId': transactionId,
      'userId': userId,
      'orderId': orderId.isNotEmpty ? orderId : (relatedOrderId ?? ''),
      if (relatedOrderId != null && relatedOrderId!.isNotEmpty)
        'relatedOrderId': relatedOrderId,
      if (relatedReferralId != null && relatedReferralId!.isNotEmpty)
        'relatedReferralId': relatedReferralId,
      'type': type,
      'points': points,
      'balanceAfter': balanceAfter,
      'remarks': remarks.isNotEmpty ? remarks : (description ?? ''),
      'description': description ?? remarks,
      'status': status,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory LoyaltyTransaction.fromMap(Map<String, dynamic> map, String docId) {
    final ordId = map['orderId'] ?? map['relatedOrderId'] ?? '';
    final desc = map['description'] ?? map['remarks'] ?? '';
    return LoyaltyTransaction(
      transactionId: docId,
      userId: map['userId'] ?? '',
      orderId: ordId,
      relatedOrderId: map['relatedOrderId'] ?? ordId,
      relatedReferralId: map['relatedReferralId'],
      type: map['type'] ?? 'order_reward',
      points: (map['points'] ?? 0).toInt(),
      balanceAfter: (map['balanceAfter'] ?? 0).toInt(),
      remarks: desc,
      description: desc,
      status: map['status'] ?? 'completed',
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }
}
