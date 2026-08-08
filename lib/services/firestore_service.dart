import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_category.dart';
import '../models/tile_product.dart';
import '../models/tile_order.dart';
import '../models/user_bucket.dart';
import '../models/design_request.dart';
import '../models/price_list.dart';
import '../models/price_approval.dart';
import '../models/notification_queue.dart';

/// A modular production service class for managing Cloud Firestore database operations
/// for users, salespersons, tile catalogues, orders, price lists, approvals, notifications, buckets, and design requests.
/// Serves both Flutter Mobile App (Customer) and Web Application (Salesperson, Sales Manager, Production Planner).
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
  CollectionReference<Map<String, dynamic>> get _priceListsRef =>
      _db.collection('price_lists');
  CollectionReference<Map<String, dynamic>> get _priceApprovalsRef =>
      _db.collection('price_list_approvals');
  CollectionReference<Map<String, dynamic>> get _notificationQueueRef =>
      _db.collection('notification_queue');
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
  // 1. USER PROFILE & CATEGORY-WISE STORAGE (WITH STATE CODE)
  // ===========================================================================

  /// Creates or updates a user profile document category-wise in Cloud Firestore.
  /// Includes stateCode (e.g. GJ, MH, DL, KA) for state-wise PO formatting and analytics.
  Future<void> createUserProfile({
    required String uid,
    required String phoneNumber,
    required String fullName,
    required String role, // categoryId (dealer, architect, builder, wholesaler, retailer)
    String stateCode = 'GJ',
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
        'stateCode': stateCode.toUpperCase(),
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

      final querySnapshot = await _usersRef
          .where('userCategory', isEqualTo: categoryId)
          .get();
      return querySnapshot.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches all users grouped by user category.
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

  /// Creates or updates a Salesperson profile in the `salespersons` collection.
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

  /// Seeds initial sample ITACON tile products into Firestore.
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
    ];

    for (var tile in sampleTiles) {
      await saveTileProduct(tile);
    }
  }

  // ===========================================================================
  // 4. PRICE LIST ENGINE & SALES MANAGER APPROVALS (STEP 7)
  // ===========================================================================

  /// Saves a custom PriceList for user or category.
  Future<void> savePriceList(PriceList priceList) async {
    try {
      await _priceListsRef
          .doc(priceList.id)
          .set(priceList.toMap(), SetOptions(merge: true));
    } catch (e) {
      rethrow;
    }
  }

  /// Submits a custom Price List / Discount change for Sales Manager / Admin approval (Step 7).
  Future<PriceApproval> submitPriceListForManagerApproval({
    required String orderId,
    required String userId,
    required String salespersonId,
    required double originalTotal,
    required double requestedTotal,
    required double discountPercent,
  }) async {
    try {
      final docRef = _priceApprovalsRef.doc();
      final approval = PriceApproval(
        id: docRef.id,
        orderId: orderId,
        userId: userId,
        salespersonId: salespersonId,
        originalTotal: originalTotal,
        requestedTotal: requestedTotal,
        discountPercent: discountPercent,
        status: 'pending_manager_approval',
        createdAt: DateTime.now(),
      );

      await docRef.set(approval.toMap());

      // Update Order status to pending_manager_approval
      await _ordersRef.doc(orderId).update({
        'status': 'pending_manager_approval',
        'priceApprovalStatus': 'pending_manager_approval',
        'updatedAt': FieldValue.serverTimestamp(),
      });

      return approval;
    } catch (e) {
      rethrow;
    }
  }

  /// Sales Manager / Super Admin approves or rejects custom price list / discount.
  Future<void> approvePriceListByManager({
    required String approvalId,
    required String orderId,
    required String managerId,
    required bool isApproved,
    String notes = '',
  }) async {
    try {
      final status = isApproved ? 'approved' : 'rejected';
      await _priceApprovalsRef.doc(approvalId).update({
        'status': status,
        'approvedBy': managerId,
        'salesManagerNotes': notes,
        'approvedAt': FieldValue.serverTimestamp(),
      });

      // If approved, order progresses to estimate_provided
      await _ordersRef.doc(orderId).update({
        'status': isApproved ? 'estimate_provided' : 'pending_salesperson_review',
        'priceApprovalStatus': status,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      rethrow;
    }
  }

  // ===========================================================================
  // 5. 10-STEP ORDER PLACEMENT WORKFLOW & NOTIFICATION QUEUEING
  // ===========================================================================

  /// Generates a state-wise unique PO Reference Number (Step 6)
  /// Format: PO-{STATE}-{YEAR}-{RANDOM} (e.g. PO-GJ-2026-98104)
  String generateStateWiseOrderReferenceNumber(String stateCode) {
    final random = Random();
    final number = random.nextInt(900000) + 100000;
    final cleanState = stateCode.trim().toUpperCase();
    return 'PO-$cleanState-${DateTime.now().year}-$number';
  }

  /// Queues outgoing notification events to Company Email, WhatsApp, Salesperson, and Customer (Steps 6 & 9)
  Future<void> queueNotificationEvent({
    required String orderId,
    required String orderReferenceNumber,
    required String eventType, // 'order_placed_step6', 'estimate_approved_step9'
    required List<String> recipients,
    required Map<String, dynamic> payload,
  }) async {
    try {
      final docRef = _notificationQueueRef.doc();
      final item = NotificationQueueItem(
        id: docRef.id,
        orderId: orderId,
        orderReferenceNumber: orderReferenceNumber,
        eventType: eventType,
        recipients: recipients,
        payload: payload,
        status: 'queued',
        createdAt: DateTime.now(),
      );
      await docRef.set(item.toMap());
    } catch (e) {
      rethrow;
    }
  }

  /// Step 5 & 6 of Flow: User places order in PO format.
  /// Generates state-formatted reference PO-GJ-2026-XXXXX and queues Step 6 Notifications.
  Future<TileOrder> placeOrder({
    required String userId,
    required String userCategory,
    required List<OrderItem> items,
    required String orderType, // 'ready_stock' or 'made_against_order'
    required String deliveryAddress,
    required bool transportRequired,
    required String remarks,
    String stateCode = 'GJ',
    String? salespersonId,
  }) async {
    try {
      final docRef = _ordersRef.doc();
      final poNumber = generateStateWiseOrderReferenceNumber(stateCode);

      final order = TileOrder(
        id: docRef.id,
        orderReferenceNumber: poNumber,
        stateCode: stateCode.toUpperCase(),
        userId: userId,
        userCategory: userCategory,
        salespersonId: salespersonId,
        orderType: orderType,
        status: 'pending_salesperson_review',
        priceApprovalStatus: 'none',
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

      // Step 6 Notification Trigger: Notify Company Email + WhatsApp + Salesperson + Customer
      await queueNotificationEvent(
        orderId: order.id,
        orderReferenceNumber: poNumber,
        eventType: 'order_placed_step6',
        recipients: ['company_email', 'company_whatsapp', 'salesperson', 'customer'],
        payload: {
          'message': 'New Purchase Order $poNumber submitted by $userCategory.',
          'userId': userId,
          'salespersonId': salespersonId,
          'deliveryAddress': deliveryAddress,
        },
      );

      return order;
    } catch (e) {
      rethrow;
    }
  }

  /// Step 7 of Flow: Salesperson reviews order, applies unit prices/estimate.
  Future<void> reviewOrderAndSubmitEstimate({
    required String orderId,
    required List<OrderItem> updatedItems,
    required double discountPercent,
    required double taxAmount,
    required String salespersonNotes,
    bool requiresManagerApproval = false,
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

      final newStatus = requiresManagerApproval ? 'pending_manager_approval' : 'estimate_provided';

      await _ordersRef.doc(orderId).update({
        'items': updatedItems.map((i) => i.toMap()).toList(),
        'estimateDetails': estimateDetails,
        'status': newStatus,
        'priceApprovalStatus': requiresManagerApproval ? 'pending_manager_approval' : 'none',
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      rethrow;
    }
  }

  /// Step 8 & 9 of Flow: User approves estimate. Queues Step 9 Notification to Salesperson / Planning team.
  Future<void> confirmOrderWithEstimate({required String orderId}) async {
    try {
      final orderDoc = await _ordersRef.doc(orderId).get();
      final poRef = orderDoc.data()?['orderReferenceNumber'] ?? 'PO-2026';
      final spId = orderDoc.data()?['salespersonId'];

      await _ordersRef.doc(orderId).update({
        'status': 'user_confirmed',
        'userConfirmedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // Step 9 Notification Trigger: Fire notification to Salesperson & Planning team via WhatsApp/Email
      await queueNotificationEvent(
        orderId: orderId,
        orderReferenceNumber: poRef,
        eventType: 'estimate_approved_step9',
        recipients: ['salesperson', 'production_planning_team', 'company_email'],
        payload: {
          'message': 'Customer confirmed estimate for $poRef. Order ready for Production Planner.',
          'salespersonId': spId,
        },
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Step 10 of Flow: Handed to Production Planner (Exit point of Order Placement flow).
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
  // 6. BUCKET (CART) & WISHLIST OPERATIONS
  // ===========================================================================

  CollectionReference<Map<String, dynamic>> _userBucketRef(String userId) =>
      _usersRef.doc(userId).collection('bucket');

  Future<void> addToBucket(String userId, BucketItem item) async {
    try {
      await _userBucketRef(userId).doc(item.tileId).set(item.toMap(), SetOptions(merge: true));
    } catch (e) {
      rethrow;
    }
  }

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

  // ===========================================================================
  // 7. CUSTOM DESIGN REQUESTS (MODULE 7)
  // ===========================================================================

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
