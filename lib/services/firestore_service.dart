import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_category.dart';
import '../models/tile_product.dart';
import '../models/tile_order.dart';
import '../models/user_bucket.dart';
import '../models/design_request.dart';

/// A modular production service class for managing Cloud Firestore database operations
/// for users, salespersons, tile catalogues, orders, buckets, and design requests.
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
  CollectionReference<Map<String, dynamic>> get _designRequestsRef =>
      _db.collection('design_requests');

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
  // 2. SALESPERSON DATA STORAGE & ASSIGNMENT
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
  Future<Map<String, dynamic>?> verifySalespersonReferralCode(
      String referralCode) async {
    try {
      final trimmedCode = referralCode.trim().toUpperCase();
      if (trimmedCode.isEmpty) return null;

      final spQuery = await _salespersonsRef
          .where('referralCode', isEqualTo: trimmedCode)
          .where('isActive', isEqualTo: true)
          .limit(1)
          .get();

      if (spQuery.docs.isNotEmpty) {
        final doc = spQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

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

  /// Auto-assigns an active salesperson to a user if no referral code was entered.
  Future<String?> autoAssignSalesperson({required String userId}) async {
    try {
      final spQuery = await _salespersonsRef
          .where('isActive', isEqualTo: true)
          .limit(1)
          .get();

      String? assignedSalespersonId;

      if (spQuery.docs.isNotEmpty) {
        assignedSalespersonId = spQuery.docs.first.id;
      } else {
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
  // 3. TILES PRODUCT CATALOGUE & ADVANCED FILTERS
  // ===========================================================================

  /// Adds or updates a TileProduct in the `tiles` collection.
  Future<void> saveTileProduct(TileProduct product) async {
    try {
      await _tilesRef.doc(product.id).set(product.toMap(), SetOptions(merge: true));
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches a single TileProduct by ID.
  Future<TileProduct?> getTileById(String tileId) async {
    try {
      final doc = await _tilesRef.doc(tileId).get();
      if (doc.exists && doc.data() != null) {
        return TileProduct.fromMap(doc.data()!, doc.id);
      }
      return null;
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches tiles catalogue from Cloud Firestore with multi-attribute filtering per PDF:
  /// Size, Surface, Base Color, Pattern, Collection, Finish, Body Type, Stock Status.
  Future<List<TileProduct>> getTilesCatalogueAdvanced({
    String? size,
    String? surface,
    String? baseColor,
    String? pattern,
    String? collection,
    String? stockStatus,
    double? maxPrice,
  }) async {
    try {
      Query<Map<String, dynamic>> query = _tilesRef.where('isActive', isEqualTo: true);

      if (size != null && size.isNotEmpty) {
        query = query.where('size', isEqualTo: size);
      }
      if (surface != null && surface.isNotEmpty) {
        query = query.where('surface', isEqualTo: surface);
      }
      if (baseColor != null && baseColor.isNotEmpty) {
        query = query.where('baseColor', isEqualTo: baseColor);
      }
      if (pattern != null && pattern.isNotEmpty) {
        query = query.where('pattern', isEqualTo: pattern);
      }
      if (collection != null && collection.isNotEmpty) {
        query = query.where('collection', isEqualTo: collection);
      }
      if (stockStatus != null && stockStatus.isNotEmpty) {
        query = query.where('stockStatus', isEqualTo: stockStatus);
      }

      final querySnapshot = await query.get();
      var list = querySnapshot.docs
          .map((doc) => TileProduct.fromMap(doc.data(), doc.id))
          .toList();

      if (maxPrice != null) {
        list = list.where((p) => p.basePrice <= maxPrice).toList();
      }

      return list;
    } catch (e) {
      rethrow;
    }
  }

  /// Updates stock status of a specific tile (e.g. 'Available Now', 'Out of Stock', 'Made-to-Order').
  Future<void> updateTileStockStatus(String tileId, String stockStatus) async {
    try {
      await _tilesRef.doc(tileId).update({
        'stockStatus': stockStatus,
        'inStock': stockStatus == 'Available Now' || stockStatus == 'Limited',
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      rethrow;
    }
  }

  /// Seeds initial realistic sample ITACON tile products into Firestore.
  Future<void> seedSampleTileProducts() async {
    final sampleTiles = [
      TileProduct(
        id: 'TILE_STATUARIO_01',
        name: 'Statuario Marble White',
        size: '600x1200',
        surface: 'High Gloss',
        baseColor: 'White',
        pattern: 'Marble',
        collection: 'Royal Statuario 2026',
        finish: 'Polished',
        bodyType: 'Porcelain',
        thickness: '9mm',
        randomPattern: '6 Faces',
        priceCategory: 'Premium',
        shade: 'Light',
        basePrice: 65.0,
        moq: 20,
        stockStatus: 'Available Now',
        images: ['https://example.com/tiles/statuario_hd.jpg'],
        lifestyleImages: ['https://example.com/tiles/statuario_room.jpg'],
        packingDetails: {
          'boxWeight': '30 kg',
          'sqmPerBox': 1.44,
          'boxesPerPallet': 40,
          'piecesPerBox': 2,
        },
      ),
      TileProduct(
        id: 'TILE_CARVING_GREY_02',
        name: 'Armani Grey Carving',
        size: '800x1600',
        surface: 'Carving',
        baseColor: 'Grey',
        pattern: 'Stone',
        collection: 'Grand Slab Series',
        finish: 'Matt Carving',
        bodyType: 'Vitrified',
        thickness: '12mm',
        randomPattern: '4 Faces',
        priceCategory: 'Premium',
        shade: 'Medium',
        basePrice: 85.0,
        moq: 15,
        stockStatus: 'Available Now',
        images: ['https://example.com/tiles/armani_grey_hd.jpg'],
        lifestyleImages: ['https://example.com/tiles/armani_grey_room.jpg'],
        packingDetails: {
          'boxWeight': '42 kg',
          'sqmPerBox': 2.56,
          'boxesPerPallet': 28,
          'piecesPerBox': 2,
        },
      ),
      TileProduct(
        id: 'TILE_WOOD_BEIGE_03',
        name: 'Oak Wood Plank',
        size: '200x1200',
        surface: 'Matt',
        baseColor: 'Brown',
        pattern: 'Wood',
        collection: 'Natural Timber Planks',
        finish: 'Rustic',
        bodyType: 'Porcelain',
        thickness: '9mm',
        randomPattern: '8 Faces',
        priceCategory: 'Standard',
        shade: 'Medium',
        basePrice: 55.0,
        moq: 30,
        stockStatus: 'Made-to-Order',
        images: ['https://example.com/tiles/oak_wood_hd.jpg'],
        lifestyleImages: ['https://example.com/tiles/oak_wood_room.jpg'],
        packingDetails: {
          'boxWeight': '24 kg',
          'sqmPerBox': 1.20,
          'boxesPerPallet': 50,
          'piecesPerBox': 5,
        },
      ),
      TileProduct(
        id: 'TILE_BOOKMATCH_BLUE_04',
        name: 'Onyx Blue Bookmatch',
        size: '1200x1800',
        surface: 'Bookmatch',
        baseColor: 'Blue',
        pattern: 'Marble',
        collection: 'Exotic Bookmatch Collection',
        finish: 'High Gloss Polished',
        bodyType: 'Full Body Porcelain',
        thickness: '12mm',
        randomPattern: 'Bookmatch A+B',
        priceCategory: 'Premium',
        shade: 'Dark',
        basePrice: 120.0,
        moq: 10,
        stockStatus: 'Limited',
        images: ['https://example.com/tiles/onyx_blue_hd.jpg'],
        lifestyleImages: ['https://example.com/tiles/onyx_blue_room.jpg'],
        packingDetails: {
          'boxWeight': '55 kg',
          'sqmPerBox': 4.32,
          'boxesPerPallet': 20,
          'piecesPerBox': 2,
        },
      ),
    ];

    for (var tile in sampleTiles) {
      await saveTileProduct(tile);
    }
  }

  // ===========================================================================
  // 4. ORDER PLACEMENT FLOW & LIFECYCLE WORKFLOW
  // ===========================================================================

  /// Helper to generate a unique PO Reference Number (e.g. PO-2026-89104)
  String _generateOrderReferenceNumber() {
    final random = Random();
    final number = random.nextInt(900000) + 100000;
    return 'PO-${DateTime.now().year}-$number';
  }

  /// Step 5 of PDF: User places order (Order Type: Ready stock Or Made Against Order)
  /// Saves order document with status `'pending_salesperson_review'`.
  Future<TileOrder> placeOrder({
    required String userId,
    required String userCategory,
    required List<OrderItem> items,
    required String orderType, // 'ready_stock' or 'made_against_order'
    required String deliveryAddress,
    required bool transportRequired,
    required String remarks,
    String? salespersonId,
  }) async {
    try {
      final docRef = _ordersRef.doc();
      final poNumber = _generateOrderReferenceNumber();

      final order = TileOrder(
        id: docRef.id,
        orderReferenceNumber: poNumber,
        userId: userId,
        userCategory: userCategory,
        salespersonId: salespersonId,
        orderType: orderType,
        status: 'pending_salesperson_review',
        items: items,
        deliveryAddress: deliveryAddress,
        transportRequired: transportRequired,
        remarks: remarks,
        estimateDetails: {
          'discountPercent': 0.0,
          'taxAmount': 0.0,
          'subtotal': 0.0,
          'grandTotal': 0.0,
          'salespersonNotes': '',
        },
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await docRef.set(order.toMap());
      return order;
    } catch (e) {
      rethrow;
    }
  }

  /// Step 6 of PDF: Salesperson reviews order with quantity, attaches user-wise unit prices & estimate details.
  /// Sets status to `'estimate_provided'`.
  Future<void> reviewOrderAndSubmitEstimate({
    required String orderId,
    required List<OrderItem> updatedItems,
    required double discountPercent,
    required double taxAmount,
    required String salespersonNotes,
  }) async {
    try {
      double subtotal = 0.0;
      for (var item in updatedItems) {
        final uPrice = item.unitPrice ?? 0.0;
        subtotal += (uPrice * item.quantity);
      }

      final discountAmount = subtotal * (discountPercent / 100.0);
      final grandTotal = (subtotal - discountAmount) + taxAmount;

      final estimateDetails = {
        'discountPercent': discountPercent,
        'discountAmount': discountAmount,
        'taxAmount': taxAmount,
        'subtotal': subtotal,
        'grandTotal': grandTotal,
        'salespersonNotes': salespersonNotes,
        'estimatedAt': FieldValue.serverTimestamp(),
      };

      await _ordersRef.doc(orderId).update({
        'items': updatedItems.map((i) => i.toMap()).toList(),
        'estimateDetails': estimateDetails,
        'status': 'estimate_provided',
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      rethrow;
    }
  }

  /// Step 6/7 of PDF: Customer reviews estimate & confirms Purchase Order with Estimate.
  /// Sets status to `'user_confirmed'`.
  Future<void> confirmOrderWithEstimate({required String orderId}) async {
    try {
      await _ordersRef.doc(orderId).update({
        'status': 'user_confirmed',
        'userConfirmedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      rethrow;
    }
  }

  /// Step 7/8 of PDF: Order released to Production Planning by Salesperson/Planner.
  /// Sets status to `'sent_to_production'`.
  Future<void> releaseToProductionPlanner({required String orderId}) async {
    try {
      await _ordersRef.doc(orderId).update({
        'status': 'sent_to_production',
        'productionReleasedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      rethrow;
    }
  }

  /// Stream live orders for a specific user
  Stream<List<TileOrder>> streamUserOrders(String userId) {
    return _ordersRef
        .where('userId', isEqualTo: userId)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => TileOrder.fromMap(doc.data(), doc.id))
            .toList());
  }

  /// Stream live orders assigned to a specific Salesperson
  Stream<List<TileOrder>> streamSalespersonOrders(String salespersonId) {
    return _ordersRef
        .where('salespersonId', isEqualTo: salespersonId)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => TileOrder.fromMap(doc.data(), doc.id))
            .toList());
  }

  // ===========================================================================
  // 5. BUCKET (CART) & WISHLIST OPERATIONS
  // ===========================================================================

  /// Collection reference for User Buckets
  CollectionReference<Map<String, dynamic>> _userBucketRef(String userId) =>
      _usersRef.doc(userId).collection('bucket');

  /// Collection reference for User Wishlist
  CollectionReference<Map<String, dynamic>> _userWishlistRef(String userId) =>
      _usersRef.doc(userId).collection('wishlist');

  /// Adds or updates an item in the User's Bucket (Cart)
  Future<void> addToBucket(String userId, BucketItem item) async {
    try {
      await _userBucketRef(userId).doc(item.tileId).set(item.toMap(), SetOptions(merge: true));
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches all items in the User's Bucket
  Future<List<BucketItem>> getBucketItems(String userId) async {
    try {
      final snapshot = await _userBucketRef(userId).get();
      return snapshot.docs
          .map((doc) => BucketItem.fromMap(doc.data()))
          .toList();
    } catch (e) {
      rethrow;
    }
  }

  /// Removes an item from the User's Bucket
  Future<void> removeFromBucket(String userId, String tileId) async {
    try {
      await _userBucketRef(userId).doc(tileId).delete();
    } catch (e) {
      rethrow;
    }
  }

  /// Clears the entire Bucket for a User
  Future<void> clearBucket(String userId) async {
    try {
      final snapshot = await _userBucketRef(userId).get();
      for (var doc in snapshot.docs) {
        await doc.reference.delete();
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Toggles a tile in the User's Wishlist / Favourites
  Future<bool> toggleWishlist(String userId, String tileId) async {
    try {
      final docRef = _userWishlistRef(userId).doc(tileId);
      final doc = await docRef.get();
      if (doc.exists) {
        await docRef.delete();
        return false; // Removed from wishlist
      } else {
        await docRef.set({
          'tileId': tileId,
          'addedAt': FieldValue.serverTimestamp(),
        });
        return true; // Added to wishlist
      }
    } catch (e) {
      rethrow;
    }
  }

  // ===========================================================================
  // 6. CUSTOM DESIGN REQUESTS (MODULE 7 OF PDF)
  // ===========================================================================

  /// Submits a Custom Design Request for a tile design not in catalogue
  Future<DesignRequest> submitDesignRequest(DesignRequest request) async {
    try {
      final docRef = _designRequestsRef.doc();
      final newRequest = DesignRequest(
        id: docRef.id,
        userId: request.userId,
        size: request.size,
        color: request.color,
        surface: request.surface,
        referenceImageUrl: request.referenceImageUrl,
        quantityRequirement: request.quantityRequirement,
        remarks: request.remarks,
        status: 'submitted',
        createdAt: DateTime.now(),
      );

      await docRef.set(newRequest.toMap());
      return newRequest;
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches all Custom Design Requests for a User
  Future<List<DesignRequest>> getUserDesignRequests(String userId) async {
    try {
      final snapshot = await _designRequestsRef
          .where('userId', isEqualTo: userId)
          .get();
      return snapshot.docs
          .map((doc) => DesignRequest.fromMap(doc.data(), doc.id))
          .toList();
    } catch (e) {
      rethrow;
    }
  }
}
