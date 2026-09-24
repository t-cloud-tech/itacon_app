import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import '../models/loyalty_config.dart';
import '../models/loyalty_transaction.dart';
import '../models/referral_model.dart';
import '../models/loyalty_redemption.dart';

/// Read and request service for ITACON GRANITO Customer Rewards & Loyalty System.
///
/// Security & Architecture Principle:
/// Flutter is strictly a display & request interface. All reward crediting,
/// balance increments, purchase bonuses, and point deductions are executed
/// exclusively by trusted backend Cloud Functions and atomic transactions.
class LoyaltyService {
  static final LoyaltyService instance = LoyaltyService._internal();
  LoyaltyService._internal()
      : _customDb = null,
        _customFunctions = null;
  factory LoyaltyService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  }) {
    if (firestore != null || functions != null) {
      return LoyaltyService._withDependencies(firestore, functions);
    }
    return instance;
  }

  LoyaltyService._withDependencies(this._customDb, this._customFunctions);
  final FirebaseFirestore? _customDb;
  final FirebaseFunctions? _customFunctions;

  FirebaseFirestore get _db => _customDb ?? FirebaseFirestore.instance;
  FirebaseFunctions get _functions => _customFunctions ?? FirebaseFunctions.instance;

  DocumentReference<Map<String, dynamic>> get _configRef =>
      _db.collection('loyaltyConfig').doc('current');

  CollectionReference<Map<String, dynamic>> get _transactionsRef =>
      _db.collection('loyaltyTransactions');

  CollectionReference<Map<String, dynamic>> get _referralsRef =>
      _db.collection('referrals');

  CollectionReference<Map<String, dynamic>> get _redemptionsRef =>
      _db.collection('loyaltyRedemptions');

  // ===========================================================================
  // REMOTE REWARD CONFIGURATION
  // ===========================================================================

  /// Streams active remote reward configuration with safe offline defaults
  Stream<LoyaltyConfig> streamLoyaltyConfig() {
    return _configRef.snapshots().map((snapshot) {
      if (snapshot.exists && snapshot.data() != null) {
        return LoyaltyConfig.fromMap(snapshot.data());
      }
      return LoyaltyConfig.defaults;
    }).handleError((err) {
      debugPrint('[LoyaltyService] streamLoyaltyConfig error: $err, using defaults');
      return LoyaltyConfig.defaults;
    });
  }

  /// Fetches remote configuration once with fallback
  Future<LoyaltyConfig> fetchLoyaltyConfig() async {
    try {
      final snap = await _configRef.get();
      if (snap.exists && snap.data() != null) {
        return LoyaltyConfig.fromMap(snap.data());
      }
    } catch (err) {
      debugPrint('[LoyaltyService] fetchLoyaltyConfig error: $err');
    }
    return LoyaltyConfig.defaults;
  }

  // ===========================================================================
  // REAL-TIME USER REWARD STREAMS
  // ===========================================================================

  /// Streams real-time loyalty points balance for the user
  Stream<int> streamUserLoyaltyPoints(String userId) {
    if (userId.isEmpty) return Stream.value(0);
    return _db.collection('users').doc(userId).snapshots().map((snap) {
      if (!snap.exists || snap.data() == null) return 0;
      final data = snap.data()!;
      return (data['loyaltyPoints'] as num?)?.toInt() ?? 0;
    }).handleError((_) => 0);
  }

  /// Streams the user's loyalty transaction history ordered by latest first
  Stream<List<LoyaltyTransaction>> streamUserTransactions(String userId) {
    if (userId.isEmpty) return Stream.value([]);
    return _transactionsRef
        .where('userId', isEqualTo: userId)
        .snapshots()
        .map((snap) {
      final list = snap.docs.map((doc) => LoyaltyTransaction.fromMap(doc.data(), doc.id)).toList();
      // Sort client-side by createdAt descending to avoid composite index requirements
      list.sort((a, b) {
        final aTime = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bTime = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return bTime.compareTo(aTime);
      });
      return list;
    }).handleError((err) {
      debugPrint('[LoyaltyService] streamUserTransactions error: $err');
      return <LoyaltyTransaction>[];
    });
  }

  /// Streams the list of referrals made by this customer
  Stream<List<ReferralModel>> streamUserReferrals(String userId) {
    if (userId.isEmpty) return Stream.value([]);
    return _referralsRef
        .where('referrerUid', isEqualTo: userId)
        .snapshots()
        .map((snap) {
      final list = snap.docs.map((doc) => ReferralModel.fromMap(doc.data(), doc.id)).toList();
      list.sort((a, b) {
        final aTime = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bTime = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return bTime.compareTo(aTime);
      });
      return list;
    }).handleError((err) {
      debugPrint('[LoyaltyService] streamUserReferrals error: $err');
      return <ReferralModel>[];
    });
  }

  /// Streams user redemption requests
  Stream<List<LoyaltyRedemption>> streamUserRedemptions(String userId) {
    if (userId.isEmpty) return Stream.value([]);
    return _redemptionsRef
        .where('userId', isEqualTo: userId)
        .snapshots()
        .map((snap) {
      final list = snap.docs.map((doc) => LoyaltyRedemption.fromMap(doc.data(), doc.id)).toList();
      list.sort((a, b) {
        final aTime = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bTime = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return bTime.compareTo(aTime);
      });
      return list;
    }).handleError((err) {
      debugPrint('[LoyaltyService] streamUserRedemptions error: $err');
      return <LoyaltyRedemption>[];
    });
  }

  // ===========================================================================
  // CUSTOMER REQUEST SUBMISSIONS (NON-AUTHORITATIVE)
  // ===========================================================================

  /// Submits an authoritative redemption request via Cloud Functions.
  /// The backend verifies balance, minimum threshold, calculates rupee value,
  /// creates the redemption record, and atomically reserves/deducts points.
  Future<String> submitRedemptionRequest({
    required String userId,
    required int requestedPoints,
    required double rupeesAmount,
    String? bankDetails,
    String? upiId,
  }) async {
    final config = await fetchLoyaltyConfig();

    if (requestedPoints < config.minimumRedemptionPoints) {
      throw Exception(
        'Minimum ${config.minimumRedemptionPoints.toLocaleString()} points required to submit a redemption request.',
      );
    }

    try {
      final callable = _functions.httpsCallable('submitLoyaltyRedemptionCallable');
      final result = await callable.call({
        'requestedPoints': requestedPoints,
        'bankDetails': bankDetails ?? '',
        'upiId': upiId ?? '',
      });
      final data = Map<String, dynamic>.from(result.data as Map);
      return data['redemptionId'] as String? ?? 'submitted';
    } catch (e) {
      debugPrint('[LoyaltyService] submitRedemptionRequest error: $e');
      rethrow;
    }
  }
}

extension NumberFormatting on num {
  String toLocaleString() {
    return toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]},',
    );
  }
}
