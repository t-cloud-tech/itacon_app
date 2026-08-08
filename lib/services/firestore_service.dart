import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_category.dart';

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

  // Helper to map categoryId to plural collection name
  String _getCategoryCollectionName(String categoryId) {
    switch (categoryId.toLowerCase()) {
      case 'dealer':
        return 'dealers';
      case 'architect':
        return 'architects';
      case 'builder':
        return 'builders';
      case 'wholesaler':
        return 'wholesalers';
      case 'retailer':
        return 'retailers';
      default:
        return '${categoryId.toLowerCase()}s';
    }
  }

  // ===========================================================================
  // 1. USER PROFILE & CATEGORY-WISE STORAGE
  // ===========================================================================

  /// Creates or updates a user profile document category-wise in Cloud Firestore.
  /// Stores the user profile data in:
  /// 1. `users/{uid}` (Global users collection)
  /// 2. `{dealers/architects/builders/wholesalers/retailers}/{uid}` (Top-level category collection)
  Future<void> createUserProfile({
    required String uid,
    required String phoneNumber,
    required String fullName,
    required String role, // categoryId (dealer, architect, builder, wholesaler, retailer)
    String? companyName,
    String? assignedSalespersonId,
    String? userReferralCode,
    bool isVerified = false,
  }) async {
    try {
      final categoryLabel = UserCategory.getLabel(role);
      final profileData = {
        'uid': uid,
        'phoneNumber': phoneNumber,
        'fullName': fullName,
        'role': role,
        'userCategory': role,
        'categoryLabel': categoryLabel,
        'companyName': companyName ?? '',
        'assignedSalespersonId': assignedSalespersonId,
        'referralCode': userReferralCode,
        'isVerified': isVerified,
        'createdAt': FieldValue.serverTimestamp(),
      };

      // 1. Store in primary `users` collection
      await _usersRef.doc(uid).set(profileData, SetOptions(merge: true));

      // 2. Store category-wise in top-level category collection (e.g. `dealers/{uid}`, `wholesalers/{uid}`)
      final categoryColName = _getCategoryCollectionName(role);
      await _db
          .collection(categoryColName)
          .doc(uid)
          .set(profileData, SetOptions(merge: true));
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches users from the category-specific top-level collection (e.g. `dealers`, `architects`, `wholesalers`).
  Future<List<Map<String, dynamic>>> getUsersByCategory(String categoryId) async {
    try {
      final colName = _getCategoryCollectionName(categoryId);
      final dedicatedColQuery = await _db.collection(colName).get();
      if (dedicatedColQuery.docs.isNotEmpty) {
        return dedicatedColQuery.docs
            .map((doc) => {'id': doc.id, ...doc.data()})
            .toList();
      }

      // Fallback check in main users collection
      final querySnapshot = await _usersRef
          .where('userCategory', isEqualTo: categoryId)
          .get();
      return querySnapshot.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches all users grouped by user category, pulling directly from category-wise collections.
  Future<Map<String, List<Map<String, dynamic>>>> getUsersGroupedByCategory() async {
    try {
      final Map<String, List<Map<String, dynamic>>> grouped = {
        for (var cat in UserCategory.categoryIds) cat: []
      };

      for (var cat in UserCategory.categoryIds) {
        final catUsers = await getUsersByCategory(cat);
        grouped[cat] = catUsers;
      }
      return grouped;
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

  // ===========================================================================
  // 1.1 SALESPERSON DATA STORAGE (SEPARATE COLLECTION)
  // ===========================================================================

  /// Creates or updates a Salesperson profile in the dedicated `salespersons` collection.
  Future<void> createSalespersonProfile({
    required String salespersonId,
    required String fullName,
    required String phoneNumber,
    required String referralCode,
    String? employeeId,
    bool isActive = true,
  }) async {
    try {
      await _salespersonsRef.doc(salespersonId).set({
        'salespersonId': salespersonId,
        'fullName': fullName,
        'phoneNumber': phoneNumber,
        'referralCode': referralCode.trim().toUpperCase(),
        'employeeId': employeeId ?? 'EMP-$salespersonId',
        'isActive': isActive,
        'createdAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches all salesperson records stored in the `salespersons` collection.
  Future<List<Map<String, dynamic>>> getSalespersons() async {
    try {
      final snapshot = await _salespersonsRef.get();
      return snapshot.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
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
