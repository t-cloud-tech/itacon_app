import 'package:cloud_firestore/cloud_firestore.dart';

/// A modular service class for managing Cloud Firestore database operations
/// for users, salespersons, tile catalogues, and orders.
class FirestoreService {
  final FirebaseFirestore _db;

  /// Creates a [FirestoreService] instance.
  /// Accepts an optional custom [FirebaseFirestore] instance for testing.
  FirestoreService({FirebaseFirestore? firestore})
      : _db = firestore ?? FirebaseFirestore.instance;

  // Collection References
  CollectionReference<Map<String, dynamic>> get _usersRef =>
      _db.collection('users');
  CollectionReference<Map<String, dynamic>> get _salespersonsRef =>
      _db.collection('salespersons');
  CollectionReference<Map<String, dynamic>> get _tilesRef =>
      _db.collection('tiles');
  CollectionReference<Map<String, dynamic>> get _ordersRef =>
      _db.collection('orders');

  // ===========================================================================
  // 1. USER PROFILE & REFERRAL CODE VERIFICATION
  // ===========================================================================

  /// Creates or updates a user profile document in the `users` collection.
  Future<void> createUserProfile({
    required String uid,
    required String phoneNumber,
    required String fullName,
    required String role,
    String? assignedSalespersonId,
    bool isVerified = false,
  }) async {
    try {
      await _usersRef.doc(uid).set({
        'uid': uid,
        'phoneNumber': phoneNumber,
        'fullName': fullName,
        'role': role,
        'assignedSalespersonId': assignedSalespersonId,
        'isVerified': isVerified,
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches the user profile document by [userId].
  Future<Map<String, dynamic>?> getUserProfile(String userId) async {
    try {
      final doc = await _usersRef.doc(userId).get();
      if (doc.exists && doc.data() != null) {
        return {'id': doc.id, ...doc.data()!};
      }
      return null;
    } catch (e) {
      rethrow;
    }
  }

  /// Verifies if a given [referralCode] belongs to a valid active salesperson.
  /// Checks both the `salespersons` and `users` collections (where role is salesperson).
  /// Returns the salesperson profile data if valid, or `null` if invalid.
  Future<Map<String, dynamic>?> verifySalespersonReferralCode(
      String referralCode) async {
    try {
      final trimmedCode = referralCode.trim().toUpperCase();
      if (trimmedCode.isEmpty) return null;

      // Check salespersons collection
      final spQuery = await _salespersonsRef
          .where('referralCode', isEqualTo: trimmedCode)
          .where('isActive', isEqualTo: true)
          .limit(1)
          .get();

      if (spQuery.docs.isNotEmpty) {
        final doc = spQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

      // Fallback check in users collection (for users with role 'salesperson')
      final userQuery = await _usersRef
          .where('referralCode', isEqualTo: trimmedCode)
          .where('role', isEqualTo: 'salesperson')
          .limit(1)
          .get();

      if (userQuery.docs.isNotEmpty) {
        final doc = userQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

      return null;
    } catch (e) {
      rethrow;
    }
  }

  // ===========================================================================
  // 2. AUTO-ASSIGN SALESPERSON
  // ===========================================================================

  /// Auto-assigns an active salesperson to a user if no referral code was entered.
  /// Finds an available active salesperson and links their ID to the user document.
  Future<String?> autoAssignSalesperson({required String userId}) async {
    try {
      // Find an active salesperson from salespersons collection
      final spQuery = await _salespersonsRef
          .where('isActive', isEqualTo: true)
          .limit(1)
          .get();

      String? assignedSalespersonId;

      if (spQuery.docs.isNotEmpty) {
        assignedSalespersonId = spQuery.docs.first.id;
      } else {
        // Fallback: search users collection for a salesperson
        final userSpQuery = await _usersRef
            .where('role', isEqualTo: 'salesperson')
            .limit(1)
            .get();
        if (userSpQuery.docs.isNotEmpty) {
          assignedSalespersonId = userSpQuery.docs.first.id;
        }
      }

      if (assignedSalespersonId != null) {
        await _usersRef.doc(userId).set({
          'assignedSalespersonId': assignedSalespersonId,
          'autoAssignedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      }

      return assignedSalespersonId;
    } catch (e) {
      rethrow;
    }
  }

  // ===========================================================================
  // 3. TILES CATALOGUE FETCH WITH FILTERS
  // ===========================================================================

  /// Fetches the tiles catalogue from Firestore with optional filtering:
  /// - [size]: Filter by tile size (e.g. '60x60', '60x120', '30x60').
  /// - [inStockOnly]: If true, returns only tiles with stock status as available (`inStock == true`).
  Future<List<Map<String, dynamic>>> getTilesCatalogue({
    String? size,
    bool? inStockOnly,
  }) async {
    try {
      Query<Map<String, dynamic>> query = _tilesRef;

      if (size != null && size.isNotEmpty) {
        query = query.where('size', isEqualTo: size);
      }

      if (inStockOnly == true) {
        query = query.where('inStock', isEqualTo: true);
      }

      final querySnapshot = await query.get();
      return querySnapshot.docs
          .map((doc) => {'id': doc.id, ...doc.data()})
          .toList();
    } catch (e) {
      rethrow;
    }
  }

  // ===========================================================================
  // 4. CREATE ORDER DOCUMENT
  // ===========================================================================

  /// Creates a new order document with status `'pending_rate'`.
  /// Each item in [rawItems] has its `unitPrice` explicitly initialized to `null`.
  Future<DocumentReference<Map<String, dynamic>>> createOrder({
    required String userId,
    required List<Map<String, dynamic>> rawItems,
    String? salespersonId,
    String? deliveryAddress,
    String? notes,
  }) async {
    try {
      // Process items array: ensure unitPrice is initialized as null
      final List<Map<String, dynamic>> formattedItems = rawItems.map((item) {
        return {
          'tileId': item['tileId'],
          'tileName': item['tileName'],
          'quantity': item['quantity'],
          'size': item['size'],
          'unitPrice': null, // Initialized as null per requirements
        };
      }).toList();

      final orderData = {
        'userId': userId,
        'salespersonId': salespersonId,
        'status': 'pending_rate', // Required initial status
        'items': formattedItems,
        'deliveryAddress': deliveryAddress,
        'notes': notes,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      final docRef = await _ordersRef.add(orderData);
      return docRef;
    } catch (e) {
      rethrow;
    }
  }

  // ===========================================================================
  // 5. LIVE ORDER UPDATES SNAPSHOT STREAMS
  // ===========================================================================

  /// Stream live order updates for a specific user.
  Stream<List<Map<String, dynamic>>> streamUserOrders(String userId) {
    return _ordersRef
        .where('userId', isEqualTo: userId)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => {'id': doc.id, ...doc.data()})
            .toList());
  }

  /// Stream live updates for a single order by [orderId].
  Stream<Map<String, dynamic>?> streamOrderDetails(String orderId) {
    return _ordersRef.doc(orderId).snapshots().map((doc) {
      if (doc.exists && doc.data() != null) {
        return {'id': doc.id, ...doc.data()!};
      }
      return null;
    });
  }
}
