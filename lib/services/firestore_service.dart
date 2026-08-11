import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_category.dart';
import '../models/user_profile.dart';
import '../models/sales_person.dart';
import '../models/product_category.dart';
import '../models/tile_product.dart';
import '../models/tile_order.dart';
import '../models/user_bucket.dart';
import '../models/wishlist.dart';
import '../models/customer_pricing.dart';
import '../models/price_approval.dart';
import '../models/estimate.dart';
import '../models/notification_queue.dart';
import '../models/production_handoff.dart';
import '../models/customer_summary.dart';
import '../models/loyalty_transaction.dart';
import '../models/design_request.dart';
import '../models/transporter_model.dart';
import '../models/shipment_model.dart';
import '../models/tracking_history_model.dart';
import '../models/client_assignment.dart';
import '../models/assigned_client_snapshot.dart';

/// Comprehensive Production Service for Cloud Firestore aligned 100% with official PDF Schema.
/// Supports Phase 1, Phase 2, and Phase 3 collections for Flutter Customers, Web Portal Salesperson, and Admin Managers.
class FirestoreService {
  final FirebaseFirestore _db;

  FirestoreService({FirebaseFirestore? firestore})
      : _db = firestore ?? FirebaseFirestore.instance;

  // ===========================================================================
  // COLLECTION REFERENCES (Matching Official PDF Schema)
  // ===========================================================================
  CollectionReference<Map<String, dynamic>> get _usersRef => _db.collection('users');
  CollectionReference<Map<String, dynamic>> get _salesPersonsRef => _db.collection('salesPersons');
  CollectionReference<Map<String, dynamic>> get _productsRef => _db.collection('products');
  CollectionReference<Map<String, dynamic>> get _tilesRef => _db.collection('tiles');
  CollectionReference<Map<String, dynamic>> get _categoriesRef => _db.collection('categories');
  CollectionReference<Map<String, dynamic>> get _cartsRef => _db.collection('carts');
  CollectionReference<Map<String, dynamic>> get _wishlistsRef => _db.collection('wishlists');
  CollectionReference<Map<String, dynamic>> get _ordersRef => _db.collection('orders');
  CollectionReference<Map<String, dynamic>> get _customerPricingRef => _db.collection('customerPricing');
  CollectionReference<Map<String, dynamic>> get _priceApprovalsRef => _db.collection('priceApprovals');
  CollectionReference<Map<String, dynamic>> get _estimatesRef => _db.collection('estimates');
  CollectionReference<Map<String, dynamic>> get _notificationsRef => _db.collection('notifications');
  CollectionReference<Map<String, dynamic>> get _handoffsRef => _db.collection('handoffs');
  CollectionReference<Map<String, dynamic>> get _customerSummaryRef => _db.collection('customerSummary');
  CollectionReference<Map<String, dynamic>> get _loyaltyTransactionsRef => _db.collection('loyaltyTransactions');
  CollectionReference<Map<String, dynamic>> get _designRequestsRef => _db.collection('design_requests');
  CollectionReference<Map<String, dynamic>> get _transportersRef => _db.collection('transporters');
  CollectionReference<Map<String, dynamic>> get _shipmentsRef => _db.collection('shipments');
  CollectionReference<Map<String, dynamic>> get _systemConfigsRef => _db.collection('systemConfigs');

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
  // PHASE 1: USERS & SALESPERSONS
  // ===========================================================================

  /// Saves a UserProfile document in `users` and category-specific collection (`dealers`, `wholesalers`, etc.)
  Future<void> createUserProfile({
    required String uid,
    required String phoneNumber,
    required String fullName,
    required String role,
    String? email,
    String? password,
    String? city,
    String? state,
    String? stateCode,
    String? pincode,
    Map<String, dynamic>? address,
    String? companyName,
    String? assignedSalespersonId,
    String? userReferralCode,
    bool isVerified = false,
  }) async {
    try {
      final categoryLabel = UserCategory.getLabel(role);
      final profile = UserProfile(
        userId: uid,
        name: fullName,
        companyName: companyName ?? '',
        phone: phoneNumber,
        email: email ?? '',
        userCategory: role,
        role: role,
        salesPersonId: assignedSalespersonId,
        referralCode: userReferralCode,
        phoneVerified: isVerified,
        whatsappVerified: isVerified,
        address: address ?? const {},
        city: city ?? '',
        state: state ?? stateCode ?? '',
        pincode: pincode ?? '',
        status: 'active',
        createdAt: DateTime.now(),
      );

      final docData = {
        ...profile.toMap(),
        if (password != null && password.isNotEmpty) 'password': password,
      };

      // 1. Store in primary `users` collection
      await _usersRef.doc(uid).set(docData, SetOptions(merge: true));

      // 2. Store in category-wise collection (dealers/{uid}, architects/{uid}, etc.)
      final catColName = _getCategoryCollectionName(role);
      await _db.collection(catColName).doc(uid).set({
        ...docData,
        'categoryLabel': categoryLabel,
      }, SetOptions(merge: true));
    } catch (e) {
      rethrow;
    }
  }

  /// Searches for a user document by phone number, email, UID, or username
  Future<Map<String, dynamic>?> findUserByIdentifier(String identifier) async {
    final clean = identifier.trim();
    if (clean.isEmpty) return null;

    try {
      // 1. Direct doc lookup by UID
      final directDoc = await _usersRef.doc(clean).get();
      if (directDoc.exists && directDoc.data() != null) {
        return {'id': directDoc.id, ...directDoc.data()!};
      }

      // 2. Query by phone / phoneNumber
      final formattedPhone = clean.startsWith('+91') ? clean : '+91$clean';
      var phoneQuery = await _usersRef.where('phone', isEqualTo: formattedPhone).limit(1).get();
      if (phoneQuery.docs.isNotEmpty) {
        final doc = phoneQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

      var rawPhoneQuery = await _usersRef.where('phone', isEqualTo: clean).limit(1).get();
      if (rawPhoneQuery.docs.isNotEmpty) {
        final doc = rawPhoneQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

      var phoneNumberQuery = await _usersRef.where('phoneNumber', isEqualTo: clean).limit(1).get();
      if (phoneNumberQuery.docs.isNotEmpty) {
        final doc = phoneNumberQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

      // 3. Query by email
      var emailQuery = await _usersRef.where('email', isEqualTo: clean.toLowerCase()).limit(1).get();
      if (emailQuery.docs.isNotEmpty) {
        final doc = emailQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

      // 4. Query by name / fullName
      var nameQuery = await _usersRef.where('name', isEqualTo: clean).limit(1).get();
      if (nameQuery.docs.isNotEmpty) {
        final doc = nameQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

      var fullNameQuery = await _usersRef.where('fullName', isEqualTo: clean).limit(1).get();
      if (fullNameQuery.docs.isNotEmpty) {
        final doc = fullNameQuery.docs.first;
        return {'id': doc.id, ...doc.data()};
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /// Updates user profile details when completing profile inside the app
  Future<void> updateUserProfileDetails({
    required String uid,
    required String userCategory,
    required Map<String, dynamic> data,
  }) async {
    final updateData = {
      ...data,
      'updatedAt': FieldValue.serverTimestamp(),
    };

    // 1. Update in primary `users` collection
    await _usersRef.doc(uid).set(updateData, SetOptions(merge: true));

    // 2. Update in category-wise collection (dealers/{uid}, architects/{uid}, etc.)
    final catColName = _getCategoryCollectionName(userCategory);
    await _db.collection(catColName).doc(uid).set(updateData, SetOptions(merge: true));
  }

  /// Retrieves user profile document by UID
  Future<UserProfile?> getUserProfile(String uid) async {
    final doc = await _usersRef.doc(uid).get();
    if (doc.exists && doc.data() != null) {
      return UserProfile.fromMap(doc.data()!, doc.id);
    }
    return null;
  }

  Future<List<Map<String, dynamic>>> getUsersByCategory(String categoryId) async {
    try {
      final colName = _getCategoryCollectionName(categoryId);
      final querySnapshot = await _db.collection(colName).get();
      if (querySnapshot.docs.isNotEmpty) {
        return querySnapshot.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
      }

      final fallbackSnapshot = await _usersRef.where('userCategory', isEqualTo: categoryId).get();
      return fallbackSnapshot.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, List<Map<String, dynamic>>>> getUsersGroupedByCategory() async {
    final Map<String, List<Map<String, dynamic>>> grouped = {
      for (var cat in UserCategory.categoryIds) cat: []
    };
    for (var cat in UserCategory.categoryIds) {
      grouped[cat] = await getUsersByCategory(cat);
    }
    return grouped;
  }

  /// Saves a SalesPerson document in `salesPersons` collection
  Future<void> createSalespersonProfile({
    required String salespersonId,
    required String fullName,
    required String phoneNumber,
    required String referralCode,
    String? employeeId,
    bool isActive = true,
  }) async {
    try {
      final sp = SalesPerson(
        salesPersonId: salespersonId,
        employeeId: employeeId ?? 'EMP-$salespersonId',
        name: fullName,
        phone: phoneNumber,
        email: 'sales.$salespersonId@itacon.com',
        referralCode: referralCode.trim().toUpperCase(),
        region: 'Western Region',
        states: const ['GJ', 'MH', 'DL', 'KA'],
        status: isActive ? 'active' : 'inactive',
        createdAt: DateTime.now(),
      );

      await _salesPersonsRef.doc(salespersonId).set(sp.toMap(), SetOptions(merge: true));
    } catch (e) {
      rethrow;
    }
  }

  static const int maxClientsPerSalesperson = 5;

  Future<List<Map<String, dynamic>>> getSalespersons() async {
    final snapshot = await _salesPersonsRef.get();
    return snapshot.docs.map((d) => {'id': d.id, ...d.data()}).toList();
  }

  /// Retrieves active salespersons filtered by capacity limit (< 5 assigned clients)
  /// sorted in ascending order of assignedClientsCount (least assigned workload first).
  Future<List<Map<String, dynamic>>> getAvailableSalespersons() async {
    final List<Map<String, dynamic>> available = [];

    try {
      // 1. Fetch active salespersons from salesPersons collection
      final spSnap = await _salesPersonsRef.get();

      for (var doc in spSnap.docs) {
        final data = doc.data();
        final status = data['status'] ?? (data['isActive'] == true ? 'active' : 'active');
        if (status == 'active') {
          final count = (data['assignedClientsCount'] as num?)?.toInt() ?? 0;
          if (count < maxClientsPerSalesperson) {
            available.add({'id': doc.id, ...data, 'assignedClientsCount': count});
          }
        }
      }

      // 2. Fetch active salespersons from users collection (if role == 'salesperson')
      final userSpSnap = await _usersRef
          .where('role', isEqualTo: 'salesperson')
          .get();

      for (var doc in userSpSnap.docs) {
        final data = doc.data();
        final status = data['status'] ?? 'active';
        if (status == 'active') {
          final count = (data['assignedClientsCount'] as num?)?.toInt() ?? 0;
          if (count < maxClientsPerSalesperson) {
            if (!available.any((item) => item['id'] == doc.id)) {
              available.add({'id': doc.id, ...data, 'assignedClientsCount': count});
            }
          }
        }
      }

      // Sort by assignedClientsCount ASC (least-assigned salesperson first)
      available.sort((a, b) {
        final cA = (a['assignedClientsCount'] as int);
        final cB = (b['assignedClientsCount'] as int);
        if (cA != cB) return cA.compareTo(cB);
        final activeA = (a['activeClientsCount'] as num?)?.toInt() ?? 0;
        final activeB = (b['activeClientsCount'] as num?)?.toInt() ?? 0;
        return activeA.compareTo(activeB);
      });
    } catch (e) {
      // Return whatever available list collected
    }

    return available;
  }

  Future<Map<String, dynamic>?> verifySalespersonReferralCode(String referralCode) async {
    try {
      final trimmedCode = referralCode.trim().toUpperCase();
      if (trimmedCode.isEmpty) return null;

      final spQuery = await _salesPersonsRef
          .where('referralCode', isEqualTo: trimmedCode)
          .limit(1)
          .get();

      if (spQuery.docs.isNotEmpty) {
        final doc = spQuery.docs.first;
        final data = doc.data();
        final count = (data['assignedClientsCount'] as num?)?.toInt() ?? 0;
        if (count >= maxClientsPerSalesperson) {
          throw Exception(
            'Salesperson ${data['name'] ?? trimmedCode} has reached maximum client capacity ($maxClientsPerSalesperson/$maxClientsPerSalesperson clients). Auto-assigning available salesperson with lower workload.',
          );
        }
        return {'id': doc.id, ...data};
      }

      final userQuery = await _usersRef
          .where('referralCode', isEqualTo: trimmedCode)
          .where('role', isEqualTo: 'salesperson')
          .limit(1)
          .get();

      if (userQuery.docs.isNotEmpty) {
        final doc = userQuery.docs.first;
        final data = doc.data();
        final count = (data['assignedClientsCount'] as num?)?.toInt() ?? 0;
        if (count >= maxClientsPerSalesperson) {
          throw Exception(
            'Salesperson ${data['name'] ?? trimmedCode} has reached maximum client capacity ($maxClientsPerSalesperson/$maxClientsPerSalesperson clients). Auto-assigning available salesperson with lower workload.',
          );
        }
        return {'id': doc.id, ...data};
      }

      return null;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, String>> autoAssignSalespersonDetails({String? userId}) async {
    try {
      final availableSpList = await getAvailableSalespersons();

      String assignedSalespersonId;
      String spReferralCode;
      String spName;
      String spPhone;

      if (availableSpList.isNotEmpty) {
        // Pick salesperson with the lowest assignedClientsCount (< 5)
        final chosenSp = availableSpList.first;
        assignedSalespersonId = (chosenSp['id'] ?? chosenSp['salesPersonId'] ?? chosenSp['salespersonId']) as String;
        spReferralCode = chosenSp['referralCode'] ?? 'SALES101';
        spName = chosenSp['name'] ?? chosenSp['fullName'] ?? 'ITA Sales Executive';
        spPhone = chosenSp['phone'] ?? chosenSp['phoneNumber'] ?? '+919876543210';
      } else {
        // All existing salespersons have reached max capacity of 5 clients!
        // Dynamically create a new salesperson instance with 0 clients to maintain max 5 limit
        final allSp = await getSalespersons();
        final nextNum = allSp.length + 1;
        assignedSalespersonId = 'SP_00$nextNum';
        spReferralCode = 'SALES10$nextNum';
        spName = 'ITA Sales Executive $nextNum';
        spPhone = '+9198765432${10 + nextNum}';

        await createSalespersonProfile(
          salespersonId: assignedSalespersonId,
          fullName: spName,
          phoneNumber: spPhone,
          referralCode: spReferralCode,
          employeeId: 'EMP-SP-00$nextNum',
          isActive: true,
        );
      }

      if (userId != null && userId.isNotEmpty) {
        await executeAtomicClientAssignment(
          clientId: userId,
          salespersonId: assignedSalespersonId,
          assignmentType: 'auto_assigned',
        );
      }

      return {
        'salespersonId': assignedSalespersonId,
        'referralCode': spReferralCode,
        'name': spName,
        'phone': spPhone,
      };
    } catch (e) {
      return {
        'salespersonId': 'SP_001',
        'referralCode': 'SALES101',
        'name': 'ITA Sales Executive',
        'phone': '+919876543210',
      };
    }
  }

  Future<String?> autoAssignSalesperson({String? userId}) async {
    final details = await autoAssignSalespersonDetails(userId: userId);
    return details['salespersonId'];
  }

  /// Atomically completes client referral assignment across:
  /// a. Set assignedSalespersonId and isVerified: true on users/{clientId} & category collection
  /// b. Insert record into client_assignments
  /// c. Add client snapshot under users/{salespersonId}/assigned_clients/{clientId} & salesPersons/{salespersonId}/assigned_clients/{clientId}
  /// d. Increment assignedClientsCount by +1 on users/{salespersonId} & salesPersons/{salespersonId}
  Future<void> executeAtomicClientAssignment({
    required String clientId,
    required String salespersonId,
    String assignmentType = 'manual_referral',
  }) async {
    try {
      // Enforce 5-user capacity limit per salesperson
      final targetDoc = await _salesPersonsRef.doc(salespersonId).get();
      final targetData = targetDoc.data();
      final targetCount = (targetData?['assignedClientsCount'] as num?)?.toInt() ?? 0;

      if (targetCount >= maxClientsPerSalesperson) {
        // Re-route assignment to an available salesperson with lowest assignedClientsCount (< 5)
        final available = await getAvailableSalespersons();
        if (available.isNotEmpty) {
          salespersonId = (available.first['id'] ?? available.first['salesPersonId'] ?? available.first['salespersonId']) as String;
        } else {
          // If all salespersons are at 5 capacity, create a new active salesperson
          final allSp = await getSalespersons();
          final nextNum = allSp.length + 1;
          final newSpId = 'SP_00$nextNum';
          await createSalespersonProfile(
            salespersonId: newSpId,
            fullName: 'ITA Sales Executive $nextNum',
            phoneNumber: '+9198765432${10 + nextNum}',
            referralCode: 'SALES10$nextNum',
            employeeId: 'EMP-SP-00$nextNum',
            isActive: true,
          );
          salespersonId = newSpId;
        }
      }

      final batch = _db.batch();

      final clientDoc = await getUserProfile(clientId);
      final clientName = clientDoc?.name ?? 'Client';
      final clientPhone = clientDoc?.phone ?? '';
      final clientCategory = clientDoc?.userCategory ?? 'dealer';
      final companyName = clientDoc?.companyName ?? '';

      final spDoc = await _salesPersonsRef.doc(salespersonId).get();
      final spData = spDoc.data();
      final spReferralCode = spData?['referralCode'] ?? 'SALES101';

      // a. Set assignedSalespersonId and isVerified: true on users/{clientId}
      final userUpdateData = {
        'assignedSalespersonId': salespersonId,
        'salesPersonId': salespersonId,
        'salespersonReferralCode': spReferralCode,
        'isVerified': true,
        'updatedAt': FieldValue.serverTimestamp(),
      };
      batch.set(_usersRef.doc(clientId), userUpdateData, SetOptions(merge: true));

      final catColName = _getCategoryCollectionName(clientCategory);
      batch.set(_db.collection(catColName).doc(clientId), userUpdateData, SetOptions(merge: true));

      // b. Insert record into client_assignments
      final assignmentId = 'ASGN_${DateTime.now().millisecondsSinceEpoch}_$clientId';
      final clientAssignment = ClientAssignment(
        assignmentId: assignmentId,
        clientId: clientId,
        clientName: clientName,
        clientPhone: clientPhone,
        clientCategory: clientCategory,
        salespersonId: salespersonId,
        assignmentType: assignmentType,
        status: 'active',
        assignedAt: DateTime.now(),
      );
      batch.set(_db.collection('client_assignments').doc(assignmentId), clientAssignment.toMap());

      // c. Add client snapshot under users/{salespersonId}/assigned_clients/{clientId} & salesPersons/{salespersonId}/assigned_clients/{clientId}
      final clientSnapshot = AssignedClientSnapshot(
        clientId: clientId,
        name: clientName,
        companyName: companyName,
        phone: clientPhone,
        clientCategory: clientCategory,
        assignmentType: assignmentType,
        assignedAt: DateTime.now(),
      );
      batch.set(
        _usersRef.doc(salespersonId).collection('assigned_clients').doc(clientId),
        clientSnapshot.toMap(),
      );
      batch.set(
        _salesPersonsRef.doc(salespersonId).collection('assigned_clients').doc(clientId),
        clientSnapshot.toMap(),
      );

      // d. Increment assignedClientsCount by +1 on users/{salespersonId} & salesPersons/{salespersonId}
      final counterUpdate = {
        'assignedClientsCount': FieldValue.increment(1),
        'activeClientsCount': FieldValue.increment(1),
        'updatedAt': FieldValue.serverTimestamp(),
      };
      batch.set(_usersRef.doc(salespersonId), counterUpdate, SetOptions(merge: true));
      batch.set(_salesPersonsRef.doc(salespersonId), counterUpdate, SetOptions(merge: true));

      await batch.commit();
    } catch (e) {
      rethrow;
    }
  }

  // ===========================================================================
  // PHASE 1: PRODUCTS & CATEGORIES
  // ===========================================================================

  Future<void> saveTileProduct(TileProduct product) async {
    await _productsRef.doc(product.id).set(product.toMap(), SetOptions(merge: true));
    await _tilesRef.doc(product.id).set(product.toMap(), SetOptions(merge: true));
  }

  Future<void> saveProductCategory(ProductCategory category) async {
    await _categoriesRef.doc(category.categoryId).set(category.toMap(), SetOptions(merge: true));
  }

  Future<List<TileProduct>> getTilesCatalogueAdvanced({
    String? size,
    String? surface,
    String? baseColor,
    String? pattern,
    String? collection,
    String? stockStatus,
    double? maxPrice,
  }) async {
    Query<Map<String, dynamic>> query = _productsRef.where('isActive', isEqualTo: true);

    if (size != null && size.isNotEmpty) query = query.where('size', isEqualTo: size);
    if (surface != null && surface.isNotEmpty) query = query.where('surface', isEqualTo: surface);
    if (baseColor != null && baseColor.isNotEmpty) query = query.where('color', isEqualTo: baseColor);
    if (pattern != null && pattern.isNotEmpty) query = query.where('pattern', isEqualTo: pattern);
    if (stockStatus != null && stockStatus.isNotEmpty) query = query.where('stockStatus', isEqualTo: stockStatus);

    var snapshot = await query.get();
    if (snapshot.docs.isEmpty) {
      snapshot = await _tilesRef.where('isActive', isEqualTo: true).get();
    }

    var list = snapshot.docs.map((doc) => TileProduct.fromMap(doc.data(), doc.id)).toList();
    if (maxPrice != null) {
      list = list.where((p) => p.basePrice <= maxPrice).toList();
    }
    return list;
  }

  Future<void> seedSampleTileProducts() async {
    final cat = ProductCategory(
      categoryId: 'CAT_SLABS_01',
      name: 'GVT/PGVT Slabs',
      description: 'Grand Porcelain Slabs',
      imageUrl: 'https://example.com/slabs.jpg',
    );
    await saveProductCategory(cat);

    final sampleTiles = [
      TileProduct(
        id: 'TILE_STATUARIO_01',
        name: 'Statuario Marble White',
        size: '600x1200',
        surface: 'High Gloss',
        color: 'White',
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
        stockStatus: 'available',
        availableQuantity: 1200,
        images: ['https://example.com/tiles/statuario_hd.jpg'],
      ),
      TileProduct(
        id: 'TILE_CARVING_GREY_02',
        name: 'Armani Grey Carving',
        size: '800x1600',
        surface: 'Carving',
        color: 'Grey',
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
        stockStatus: 'available',
        availableQuantity: 800,
        images: ['https://example.com/tiles/armani_grey_hd.jpg'],
      ),
      TileProduct(
        id: 'TILE_WOOD_BEIGE_03',
        name: 'Oak Wood Plank',
        size: '200x1200',
        surface: 'Matt',
        color: 'Brown',
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
        stockStatus: 'made_to_order',
        availableQuantity: 0,
        images: ['https://example.com/tiles/oak_wood_hd.jpg'],
      ),
    ];

    for (var t in sampleTiles) {
      await saveTileProduct(t);
    }
  }

  // ===========================================================================
  // PHASE 1: CARTS & WISHLISTS
  // ===========================================================================

  Future<void> addToCart(String userId, CartItem item) async {
    await _cartsRef.doc(userId).set({'userId': userId, 'updatedAt': FieldValue.serverTimestamp()}, SetOptions(merge: true));
    await _cartsRef.doc(userId).collection('cartItems').doc(item.productId).set(item.toMap(), SetOptions(merge: true));
  }

  Future<List<CartItem>> getCartItems(String userId) async {
    final snapshot = await _cartsRef.doc(userId).collection('cartItems').get();
    return snapshot.docs.map((doc) => CartItem.fromMap(doc.data(), doc.id)).toList();
  }

  Future<void> addToWishlist(String userId, WishlistItem item) async {
    await _wishlistsRef.doc(userId).set({'userId': userId, 'updatedAt': FieldValue.serverTimestamp()}, SetOptions(merge: true));
    await _wishlistsRef.doc(userId).collection('wishlistItems').doc(item.productId).set(item.toMap(), SetOptions(merge: true));
  }

  // ===========================================================================
  // PHASE 1 & 2: ORDERS, ESTIMATES, CUSTOMER PRICING & NOTIFICATIONS
  // ===========================================================================

  String generateStateWiseOrderReferenceNumber(String stateCode) {
    final random = Random();
    final number = random.nextInt(900000) + 100000;
    final cleanState = stateCode.trim().toUpperCase();
    return 'PO-$cleanState-${DateTime.now().year}-$number';
  }

  Future<TileOrder> placeOrder({
    required String userId,
    required String userCategory,
    required List<OrderItem> items,
    required String orderType,
    required String deliveryAddress,
    required bool transportRequired,
    required String remarks,
    String stateCode = 'GJ',
    String? salespersonId,
  }) async {
    final docRef = _ordersRef.doc();
    final poRef = generateStateWiseOrderReferenceNumber(stateCode);

    double subtotal = 0.0;
    for (var i in items) {
      subtotal += (i.basePrice * i.quantity);
    }

    final order = TileOrder(
      id: docRef.id,
      orderReference: poRef,
      userId: userId,
      salesPersonId: salespersonId ?? '',
      userCategory: userCategory,
      status: 'pending_salesperson_review',
      orderType: orderType,
      poNumber: poRef,
      deliveryLocation: {'address': deliveryAddress},
      transportRequired: transportRequired,
      remarks: remarks,
      subtotal: subtotal,
      total: subtotal,
      items: items,
      stateCode: stateCode.toUpperCase(),
      createdAt: DateTime.now(),
    );

    await docRef.set(order.toMap());

    // Save order items in subcollection orders/{orderId}/orderItems/{productId}
    for (var item in items) {
      await _ordersRef.doc(order.id).collection('orderItems').doc(item.productId).set(item.toMap());
    }

    // Save history entry in orders/{orderId}/orderStatusHistory/{historyId}
    final history = OrderStatusHistory(
      fromStatus: 'new',
      toStatus: 'pending_salesperson_review',
      changedBy: userId,
      changedByRole: 'customer',
      remarks: 'Order PO submitted by customer',
      timestamp: DateTime.now(),
    );
    await _ordersRef.doc(order.id).collection('orderStatusHistory').add(history.toMap());

    // Send notification
    await sendNotification(
      recipientId: salespersonId ?? 'company_admin',
      type: 'order',
      event: 'order_placed',
      title: 'New PO Order Placed: $poRef',
      message: 'New order $poRef received from $userCategory.',
      relatedOrderId: order.id,
    );

    return order;
  }

  Future<void> saveCustomerPricing(CustomerPricing pricing) async {
    await _customerPricingRef.doc(pricing.id).set(pricing.toMap(), SetOptions(merge: true));
  }

  Future<PriceApproval> submitPriceApproval({
    required String orderId,
    required String userId,
    required String salespersonId,
    required double originalTotal,
    required double requestedTotal,
    required double discountPercent,
  }) async {
    final docRef = _priceApprovalsRef.doc();
    final approval = PriceApproval(
      approvalId: docRef.id,
      priceListId: 'PL_CUSTOM_$orderId',
      requestedBy: salespersonId,
      requestedTo: 'MGR_SALES_01',
      status: 'pending',
      reason: 'Volume discount request ($discountPercent%)',
      remarks: 'Awaiting Manager review',
      orderId: orderId,
      userId: userId,
      originalTotal: originalTotal,
      requestedTotal: requestedTotal,
      discountPercent: discountPercent,
      createdAt: DateTime.now(),
    );

    await docRef.set(approval.toMap());
    await _ordersRef.doc(orderId).update({
      'status': 'pending_manager_approval',
      'priceApprovalStatus': 'pending_manager_approval',
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return approval;
  }

  Future<Estimate> createAndSendEstimate({
    required String orderId,
    required String customerId,
    required String salesPersonId,
    required List<EstimateItem> items,
    required double subtotal,
    required double discount,
    required double tax,
  }) async {
    final docRef = _estimatesRef.doc();
    final total = (subtotal - discount) + tax;
    final estimate = Estimate(
      estimateId: docRef.id,
      estimateNumber: 'EST-2026-${docRef.id.substring(0, 5).toUpperCase()}',
      orderId: orderId,
      customerId: customerId,
      salesPersonId: salesPersonId,
      status: 'sent',
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      total: total,
      validUntil: DateTime.now().add(const Duration(days: 7)),
      items: items,
      createdAt: DateTime.now(),
      sentAt: DateTime.now(),
    );

    await docRef.set(estimate.toMap());
    for (var i in items) {
      await _estimatesRef.doc(estimate.estimateId).collection('estimateItems').doc(i.productId).set(i.toMap());
    }

    await _ordersRef.doc(orderId).update({
      'status': 'estimate_provided',
      'subtotal': subtotal,
      'discount': discount,
      'tax': tax,
      'total': total,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    await sendNotification(
      recipientId: customerId,
      type: 'estimate',
      event: 'estimate_ready',
      title: 'Estimate Ready for Order',
      message: 'Your estimate ${estimate.estimateNumber} is ready for review.',
      relatedOrderId: orderId,
      relatedEstimateId: estimate.estimateId,
    );

    return estimate;
  }

  Future<void> confirmOrderEstimate({required String orderId, required String estimateId}) async {
    await _estimatesRef.doc(estimateId).update({
      'status': 'approved',
      'customerResponse': 'approved',
      'respondedAt': FieldValue.serverTimestamp(),
    });

    await _ordersRef.doc(orderId).update({
      'status': 'user_confirmed',
      'updatedAt': FieldValue.serverTimestamp(),
    });

    await sendNotification(
      recipientId: 'salesperson',
      type: 'order',
      event: 'estimate_approved',
      title: 'Customer Approved Estimate',
      message: 'Estimate approved by customer. Ready for Production Planner.',
      relatedOrderId: orderId,
      relatedEstimateId: estimateId,
    );
  }

  Future<void> sendNotification({
    required String recipientId,
    required String type,
    required String event,
    required String title,
    required String message,
    required String relatedOrderId,
    String relatedEstimateId = '',
  }) async {
    final docRef = _notificationsRef.doc();
    final item = NotificationQueueItem(
      notificationId: docRef.id,
      recipientId: recipientId,
      type: type,
      event: event,
      title: title,
      message: message,
      relatedOrderId: relatedOrderId,
      relatedEstimateId: relatedEstimateId,
      status: 'pending',
      createdAt: DateTime.now(),
    );

    await docRef.set(item.toMap());
  }

  // ===========================================================================
  // PHASE 3: PRODUCTION HANDOFFS & LOYALTY ACCOUNTS
  // ===========================================================================

  Future<ProductionHandoff> createProductionHandoff({
    required String orderId,
    required String orderReference,
    required String customerId,
    required String salesPersonId,
    required String handoffBy,
    String notes = '',
  }) async {
    final docRef = _handoffsRef.doc();
    final handoff = ProductionHandoff(
      handoffId: docRef.id,
      orderId: orderId,
      orderReference: orderReference,
      customerId: customerId,
      salesPersonId: salesPersonId,
      status: 'pending',
      handoffBy: handoffBy,
      handoffDate: DateTime.now(),
      notes: notes,
      createdAt: DateTime.now(),
    );

    await docRef.set(handoff.toMap());
    await _ordersRef.doc(orderId).update({
      'status': 'sent_to_production',
      'updatedAt': FieldValue.serverTimestamp(),
    });

    return handoff;
  }

  Future<void> updateCustomerLoyalty({
    required String userId,
    required String orderId,
    required int pointsEarned,
    required double orderTotal,
  }) async {
    final docRef = _customerSummaryRef.doc(userId);
    final summaryDoc = await docRef.get();

    int existingOrders = 0;
    double existingTotal = 0.0;
    int existingPoints = 0;

    if (summaryDoc.exists && summaryDoc.data() != null) {
      final data = summaryDoc.data()!;
      existingOrders = (data['totalOrders'] ?? 0).toInt();
      existingTotal = (data['totalPurchaseValue'] ?? 0.0).toDouble();
      existingPoints = (data['loyaltyPoints'] ?? 0).toInt();
    }

    final newOrders = existingOrders + 1;
    final newTotal = existingTotal + orderTotal;
    final newPoints = existingPoints + pointsEarned;
    final tier = newTotal >= 500000 ? 'Gold' : (newTotal >= 200000 ? 'Silver' : 'Bronze');

    final summary = CustomerSummary(
      userId: userId,
      totalOrders: newOrders,
      totalPurchaseValue: newTotal,
      loyaltyPoints: newPoints,
      currentTier: tier,
      updatedAt: DateTime.now(),
    );

    await docRef.set(summary.toMap(), SetOptions(merge: true));

    final txRef = _loyaltyTransactionsRef.doc();
    final tx = LoyaltyTransaction(
      transactionId: txRef.id,
      orderId: orderId,
      type: 'order_reward',
      points: pointsEarned,
      balanceAfter: newPoints,
      remarks: 'Reward points earned for Order $orderId',
      createdAt: DateTime.now(),
    );
    await txRef.set(tx.toMap());
  }

  // ===========================================================================
  // STREAMS & CUSTOM DESIGN REQUESTS
  // ===========================================================================

  Stream<List<TileOrder>> streamUserOrders(String userId) {
    return _ordersRef.where('userId', isEqualTo: userId).snapshots().map(
        (snap) => snap.docs.map((doc) => TileOrder.fromMap(doc.data(), doc.id)).toList());
  }

  Future<DesignRequest> submitDesignRequest(DesignRequest request) async {
    final docRef = _designRequestsRef.doc();
    final newReq = DesignRequest(
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
    await docRef.set(newReq.toMap());
    return newReq;
  }

  Future<List<DesignRequest>> getUserDesignRequests(String userId) async {
    final snapshot = await _designRequestsRef.where('userId', isEqualTo: userId).get();
    return snapshot.docs.map((doc) => DesignRequest.fromMap(doc.data(), doc.id)).toList();
  }

  // ===========================================================================
  // LOGISTICS, TRANSPORTERS, SHIPMENTS & TRACKING HISTORY
  // ===========================================================================

  /// Transporters Management
  Future<void> saveTransporter(TransporterModel transporter) async {
    await _transportersRef.doc(transporter.transporterId).set(transporter.toMap(), SetOptions(merge: true));
  }

  Future<List<TransporterModel>> getTransporters() async {
    final snapshot = await _transportersRef.get();
    return snapshot.docs.map((doc) => TransporterModel.fromMap(doc.data(), doc.id)).toList();
  }

  Stream<List<TransporterModel>> streamTransporters() {
    return _transportersRef.snapshots().map(
        (snap) => snap.docs.map((doc) => TransporterModel.fromMap(doc.data(), doc.id)).toList());
  }

  /// Shipments Management
  Future<void> saveShipment(ShipmentModel shipment) async {
    await _shipmentsRef.doc(shipment.shipmentId).set(shipment.toMap(), SetOptions(merge: true));
    if (shipment.orderId.isNotEmpty) {
      await _ordersRef.doc(shipment.orderId).set({
        'shipmentId': shipment.shipmentId,
        'dispatchStatus': shipment.shipmentStatus,
        'freightAmount': shipment.freightCharges,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    }
  }

  Future<ShipmentModel?> getShipmentById(String shipmentId) async {
    final doc = await _shipmentsRef.doc(shipmentId).get();
    if (doc.exists && doc.data() != null) {
      return ShipmentModel.fromMap(doc.data()!, doc.id);
    }
    return null;
  }

  Future<ShipmentModel?> getShipmentByOrderId(String orderId) async {
    final snap = await _shipmentsRef.where('orderId', isEqualTo: orderId).limit(1).get();
    if (snap.docs.isNotEmpty) {
      return ShipmentModel.fromMap(snap.docs.first.data(), snap.docs.first.id);
    }
    return null;
  }

  Stream<List<ShipmentModel>> streamShipments() {
    return _shipmentsRef.snapshots().map(
        (snap) => snap.docs.map((doc) => ShipmentModel.fromMap(doc.data(), doc.id)).toList());
  }

  /// Tracking History Management for sub-collection `shipments/{shipmentId}/trackingHistory`
  Future<void> addTrackingHistory(String shipmentId, TrackingHistoryModel history) async {
    final docRef = _shipmentsRef.doc(shipmentId).collection('trackingHistory').doc();
    final entry = history.copyWith(id: docRef.id);
    await docRef.set(entry.toMap());

    await _shipmentsRef.doc(shipmentId).set({
      'shipmentStatus': history.status,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Stream<List<TrackingHistoryModel>> streamTrackingHistory(String shipmentId) {
    return _shipmentsRef
        .doc(shipmentId)
        .collection('trackingHistory')
        .orderBy('timestamp', descending: true)
        .snapshots()
        .map((snap) =>
            snap.docs.map((doc) => TrackingHistoryModel.fromMap(doc.data(), doc.id)).toList());
  }

  /// System Configuration Management (`systemConfigs` collection)
  Future<Map<String, dynamic>?> getSystemConfig(String docId) async {
    final doc = await _systemConfigsRef.doc(docId).get();
    return doc.data();
  }

  Stream<Map<String, dynamic>?> streamSystemConfig(String docId) {
    return _systemConfigsRef.doc(docId).snapshots().map((doc) => doc.data());
  }

  Future<void> setSystemConfig(String docId, Map<String, dynamic> config) async {
    await _systemConfigsRef.doc(docId).set(config, SetOptions(merge: true));
  }
}


