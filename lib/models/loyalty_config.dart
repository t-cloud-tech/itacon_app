import 'package:cloud_firestore/cloud_firestore.dart';

/// Remote configuration model for ITACON GRANITO Customer Rewards System.
/// Stored in `loyaltyConfig/current`.
class LoyaltyConfig {
  final int signupBonusPoints;
  final int referralSignupPoints;
  final double successfulOrderReward;
  final int pointsPerBox;
  final int minimumRedemptionPoints;
  final double rupeesPerPoint;
  final DateTime? updatedAt;

  const LoyaltyConfig({
    this.signupBonusPoints = 500,
    this.referralSignupPoints = 500,
    this.successfulOrderReward = 5555.0,
    this.pointsPerBox = 10,
    this.minimumRedemptionPoints = 50000,
    this.rupeesPerPoint = 0.50,
    this.updatedAt,
  });

  /// Default production config fallback when remote config cannot temporarily be loaded
  static const LoyaltyConfig defaults = LoyaltyConfig();

  /// Calculate rupee value for a given number of points (points * rupeesPerPoint)
  double calculateRupeeValue(int points) => points * rupeesPerPoint;

  /// Calculate purchase loyalty points for a given number of boxes
  int calculatePurchasePoints(int boxes) => boxes * pointsPerBox;

  Map<String, dynamic> toMap() {
    return {
      'signupBonusPoints': signupBonusPoints,
      'referralSignupPoints': referralSignupPoints,
      'successfulOrderReward': successfulOrderReward,
      'pointsPerBox': pointsPerBox,
      'minimumRedemptionPoints': minimumRedemptionPoints,
      'rupeesPerPoint': rupeesPerPoint,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory LoyaltyConfig.fromMap(Map<String, dynamic>? map) {
    if (map == null) return defaults;
    return LoyaltyConfig(
      signupBonusPoints: (map['signupBonusPoints'] as num?)?.toInt() ?? 500,
      referralSignupPoints: (map['referralSignupPoints'] as num?)?.toInt() ?? 500,
      successfulOrderReward: (map['successfulOrderReward'] as num?)?.toDouble() ?? 5555.0,
      pointsPerBox: (map['pointsPerBox'] as num?)?.toInt() ?? 10,
      minimumRedemptionPoints: (map['minimumRedemptionPoints'] as num?)?.toInt() ?? 50000,
      rupeesPerPoint: (map['rupeesPerPoint'] as num?)?.toDouble() ?? 0.50,
      updatedAt: map['updatedAt'] is Timestamp
          ? (map['updatedAt'] as Timestamp).toDate()
          : null,
    );
  }
}
