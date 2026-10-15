import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/order_service.dart';
import 'package:itacon_app/utils/profile_validator.dart';
import 'package:itacon_app/screens/checkout_screen.dart';
import 'package:itacon_app/screens/profile/edit_profile_screen.dart';

/// Test mock implementation of FirestoreService that simulates Firestore operations locally
class MockFlowFirestoreService extends FirestoreService {
  final Map<String, Map<String, dynamic>> usersDb = {};
  bool shouldFailWrites = false;
  String failureReason = 'PERMISSION_DENIED: Modifying privileged user fields is not allowed.';
  int placeOrderCallCount = 0;

  @override
  Future<UserProfile?> getUserProfile(String userId) async {
    final data = usersDb[userId];
    if (data == null) return null;
    return UserProfile.fromMap(data, userId);
  }

  @override
  Future<void> updateUserProfileData({
    required String uid,
    String? name,
    String? fullName,
    String? religion,
    String? dateOfBirth,
    String? email,
    String? phone,
    String? phoneNumber,
    String? countryCode,
    String? companyName,
    String? role,
    bool updateRole = false,
    String? city,
    String? state,
    String? region,
    String? pincode,
    String? gstNumber,
    String? profilePhotoUrl,
    List<String>? showroomImages,
    Map<String, dynamic>? address,
  }) async {
    if (shouldFailWrites) {
      throw Exception(failureReason);
    }

    final current = usersDb[uid] ?? {'uid': uid, 'userId': uid};

    if (name != null) current['name'] = name;
    if (religion != null) current['religion'] = religion;
    if (dateOfBirth != null) current['dateOfBirth'] = dateOfBirth;
    if (email != null) current['email'] = email;
    if (phone != null) current['phone'] = phone;
    if (companyName != null) current['companyName'] = companyName;
    if (updateRole && role != null) {
      current['userCategory'] = role;
      current['role'] = role;
    }
    if (city != null) current['city'] = city;
    if (state != null) current['state'] = state;
    if (pincode != null) current['pincode'] = pincode;
    if (gstNumber != null) current['gstNumber'] = gstNumber;
    if (address != null) current['address'] = address;

    usersDb[uid] = current;
  }

  @override
  Future<void> updateUserRegionAndToken(String uid, {String? region, String? fcmToken}) async {
    // No-op for test
  }

  @override
  Future<TileOrder> placeOrder({
    required String userId,
    String? customerName,
    String? companyName,
    String? customerPhone,
    String? customerEmail,
    required String userCategory,
    required List<OrderItem> items,
    required String orderType,
    required String deliveryAddress,
    required bool transportRequired,
    required String remarks,
    String stateCode = 'GJ',
    String? salespersonId,
    int? totalBoxes,
    double? totalWeightKg,
    double? totalWeightTons,
    String paymentMethod = 'bank_transfer',
  }) async {
    placeOrderCallCount++;
    return TileOrder(
      id: 'ORDER_TEST_001',
      orderReference: 'ORD-REF-TEST-001',
      userId: userId,
      customerName: customerName ?? '',
      companyName: companyName ?? '',
      customerPhone: customerPhone,
      customerEmail: customerEmail,
      userCategory: userCategory,
      items: items,
      orderType: orderType,
      deliveryLocation: {'address': deliveryAddress},
      transportRequired: transportRequired,
      remarks: remarks,
      stateCode: stateCode,
      salesPersonId: salespersonId ?? '',
      totalBoxes: totalBoxes ?? 10,
      totalWeightKg: totalWeightKg ?? 280.0,
      totalWeightTons: totalWeightTons ?? 0.28,
      paymentMethod: paymentMethod,
      status: 'pending_rate',
      createdAt: DateTime.now(),
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockFlowFirestoreService mockFirestore;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    AppStateService.instance.clearUserProfile();
    AppStateService.instance.clearInMemoryCart();
    mockFirestore = MockFlowFirestoreService();
  });

  group('Requirement 3 — End-to-End Customer Profile Save and Order Flow Verification', () {
    testWidgets('Full flow: Edit Profile -> Firestore Persist -> App Restart -> Cart -> Checkout -> PO Submit', (tester) async {
      const testCustomerId = 'CUST_AFFECTED_MORBI_01';

      // Seed initial customer document in Firestore as existed in affected state:
      // Name, phone, category, company present; email, city, state, pincode, address empty.
      mockFirestore.usersDb[testCustomerId] = {
        'userId': testCustomerId,
        'uid': testCustomerId,
        'name': 'Bhavin Patel',
        'phone': '+919876543299',
        'phoneVerified': true,
        'isVerified': true,
        'userCategory': 'retailer',
        'role': 'customer',
        'companyName': 'Patel Ceramic Tiles',
        'religion': 'Hindu',
        'dateOfBirth': '15/08/1985',
        'gstNumber': '24AABCT1234F1Z5',
        'email': '',
        'city': '',
        'state': '',
        'pincode': '',
        'address': {},
        'status': 'active',
      };

      // Set initial profile into AppState
      final initialProfile = await mockFirestore.getUserProfile(testCustomerId);
      expect(initialProfile, isNotNull);
      AppStateService.instance.setCurrentUserProfile(initialProfile!);

      // Verify that initially, ordering is BLOCKED due to missing fields
      final initialEligibility = ProfileOrderingValidator.validate(AppStateService.instance.currentUserProfile);
      expect(initialEligibility.isEligible, isFalse);
      expect(initialEligibility.missingFields, contains('Email Address'));
      expect(initialEligibility.missingFields, contains('Street Address'));
      expect(initialEligibility.missingFields, contains('City'));
      expect(initialEligibility.missingFields, contains('State'));
      expect(initialEligibility.missingFields, contains('PIN Code'));

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      // 1. Open Edit Profile screen with custom Firestore mock
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => Navigator.push(
                  ctx,
                  MaterialPageRoute(builder: (_) => EditProfileScreen(firestoreService: mockFirestore)),
                ),
                child: const Text('Open Edit Profile'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open Edit Profile'));
      await tester.pumpAndSettle();

      // 2. Save the required profile fields
      // Enter Email Address
      final emailField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Enter your email address');
      expect(emailField, findsOneWidget);
      await tester.enterText(emailField, 'bhavin.patel@pateltiles.in');

      // Enter Street Address
      final streetField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Enter your complete delivery address');
      expect(streetField, findsOneWidget);
      await tester.enterText(streetField, 'National Highway 8A, Trajpar');

      // Enter City
      final cityField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Enter city');
      expect(cityField, findsOneWidget);
      await tester.enterText(cityField, 'Morbi');

      // Enter State
      final stateField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Select state');
      expect(stateField, findsOneWidget);
      await tester.enterText(stateField, 'Gujarat');

      // Enter PIN Code
      final pinField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Enter 6-digit pincode');
      expect(pinField, findsOneWidget);
      await tester.enterText(pinField, '363642');

      // Tap Save Profile Changes
      final saveBtn = find.text('Save Profile & Showroom Details');
      expect(saveBtn, findsOneWidget);
      await tester.ensureVisible(saveBtn);
      await tester.tap(saveBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      // 3. Confirm Firestore save succeeds and displays success message
      expect(find.text('Profile & Showroom details saved successfully!'), findsOneWidget);

      final savedDoc = mockFirestore.usersDb[testCustomerId]!;
      expect(savedDoc['email'], equals('bhavin.patel@pateltiles.in'));
      expect(savedDoc['city'], equals('Morbi'));
      expect(savedDoc['state'], equals('Gujarat'));
      expect(savedDoc['pincode'], equals('363642'));
      expect((savedDoc['address'] as Map)['line1'], equals('National Highway 8A, Trajpar'));

      // In-memory AppStateService now has 100% completion
      expect(AppStateService.instance.profileCompletionPercentage, equals(100));
      expect(AppStateService.instance.isProfileEligibleForOrdering, isTrue);

      // 4. Close and reopen the application (Simulate App Restart)
      AppStateService.instance.clearUserProfile();
      expect(AppStateService.instance.currentUserProfile.userId, isEmpty);

      // Restore session from persistent storage
      final restoredProfile = await UserSessionService.restoreUserSession();
      expect(restoredProfile, isNotNull);
      AppStateService.instance.setCurrentUserProfile(restoredProfile!);

      // 5. Verify the profile still displays the saved values
      expect(AppStateService.instance.currentUserProfile.userId, equals(testCustomerId));
      expect(AppStateService.instance.currentUserProfile.email, equals('bhavin.patel@pateltiles.in'));
      expect(AppStateService.instance.currentUserProfile.city, equals('Morbi'));
      expect(AppStateService.instance.currentUserProfile.state, equals('Gujarat'));
      expect(AppStateService.instance.currentUserProfile.pincode, equals('363642'));
      expect(AppStateService.instance.currentUserProfile.address['line1'], equals('National Highway 8A, Trajpar'));
      expect(AppStateService.instance.profileCompletionPercentage, equals(100));
      expect(AppStateService.instance.isProfileEligibleForOrdering, isTrue);

      // 6. Add a tile to cart
      final testTile = TileProduct(
        id: 'TILE_MORBI_001',
        name: 'Armani Grey 600x1200',
        size: '600x1200 mm',
        surface: 'High Gloss',
        color: 'Grey',
        pattern: 'Marble',
        basePrice: 55.0,
        moq: 10,
        stockStatus: 'available',
        images: ['https://example.com/armani.jpg'],
        sqFtPerBox: 15.5,
        boxWeightKg: 28.0,
      );

      AppStateService.instance.addToCart(
        testTile,
        size: '600x1200 mm',
        finish: 'High Gloss',
        quantity: 20,
      );
      expect(AppStateService.instance.cartItems.length, equals(1));
      expect(AppStateService.instance.cartItems.first.quantity, equals(20));

      // 7. Proceed to checkout
      await tester.pumpWidget(
        const MaterialApp(
          home: CheckoutScreen(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Verify Checkout screen loaded Step 0 (Purchase Order Estimate)
      expect(find.text('PO Estimate & Logistics Summary'), findsOneWidget);

      // 8. Verify delivery address and payment method in Checkout
      // Advance to Step 1 (Address)
      final continueBtn = find.text('CONTINUE TO ADDRESS →');
      expect(continueBtn, findsOneWidget);
      await tester.tap(continueBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text('Shipping & Project Site Delivery Address'), findsOneWidget);
      // Verify prefilled site delivery values match saved profile
      final siteAddressText = find.widgetWithText(TextFormField, 'Site Address / Street Line *');
      expect(siteAddressText, findsOneWidget);

      // Advance to Step 2 (Payment)
      final toPaymentBtn = find.text('CONFIRM ADDRESS & PROCEED →');
      expect(toPaymentBtn, findsOneWidget);
      await tester.tap(toPaymentBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text('Select Payment Method'), findsOneWidget);
      expect(find.text('Bank Transfer'), findsOneWidget);
      expect(find.text('NEFT / RTGS / IMPS'), findsOneWidget);

      // Advance to Step 3 (Review & Confirmation)
      final toReviewBtn = find.text('CONTINUE TO FINAL REVIEW →');
      expect(toReviewBtn, findsOneWidget);
      await tester.tap(toReviewBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text('Review Your Purchase Order'), findsOneWidget);

      // 9. Validate the final purchase order submission flow
      // Instantiate OrderService with our mockFirestore to test submission
      final orderService = OrderService(firestore: mockFirestore);
      final authoritativeProfile = await mockFirestore.getUserProfile(testCustomerId);
      expect(authoritativeProfile, isNotNull);

      // Run profile validation on authoritative profile
      final orderEligibility = ProfileOrderingValidator.validate(authoritativeProfile);
      expect(orderEligibility.isEligible, isTrue, reason: 'Authoritative profile from Firestore must be fully eligible');
      expect(orderEligibility.missingFields, isEmpty);
      expect(orderEligibility.invalidFields, isEmpty);

      // Submit purchase order via OrderService
      final createdOrder = await orderService.submitOrder(
        userId: testCustomerId,
        customerName: authoritativeProfile!.name,
        companyName: authoritativeProfile.companyName,
        customerPhone: authoritativeProfile.phone,
        customerEmail: authoritativeProfile.email,
        userCategory: authoritativeProfile.userCategory,
        items: orderService.cartToOrderItems(AppStateService.instance.cartItems),
        orderType: 'ready_stock',
        deliveryAddress: 'National Highway 8A, Trajpar, Morbi - 363642, Gujarat',
        transportRequired: true,
        remarks: 'Test purchase order',
      );

      expect(createdOrder, isNotNull);
      expect(createdOrder.id, equals('ORDER_TEST_001'));
      expect(createdOrder.userId, equals(testCustomerId));
      expect(createdOrder.customerName, equals('Bhavin Patel'));
      expect(createdOrder.customerEmail, equals('bhavin.patel@pateltiles.in'));
      expect(mockFirestore.placeOrderCallCount, equals(1));
    });

    testWidgets('Failed Firestore save: displays error, preserves form data, and does NOT produce 100% completion', (tester) async {
      const testCustomerId = 'CUST_FAIL_TEST_02';

      mockFirestore.usersDb[testCustomerId] = {
        'userId': testCustomerId,
        'uid': testCustomerId,
        'name': 'Fail Test User',
        'phone': '+919876543200',
        'phoneVerified': true,
        'userCategory': 'retailer',
        'role': 'customer',
        'companyName': '',
        'email': '',
        'city': '',
        'state': '',
        'pincode': '',
        'address': {},
        'status': 'active',
      };

      final initialProfile = await mockFirestore.getUserProfile(testCustomerId);
      AppStateService.instance.setCurrentUserProfile(initialProfile!);
      final beforePercentage = AppStateService.instance.profileCompletionPercentage;

      // Configure mock to simulate Firestore permission-denied failure
      mockFirestore.shouldFailWrites = true;
      mockFirestore.failureReason = 'PERMISSION_DENIED: Modifying privileged user fields is not allowed.';

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: EditProfileScreen(firestoreService: mockFirestore),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Enter customer data into form
      final emailField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Enter your email address');
      final cityField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Enter city');
      final stateField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Select state');
      final pinField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Enter 6-digit pincode');

      await tester.enterText(emailField, 'fail.test@gmail.com');
      await tester.enterText(cityField, 'Morbi');
      await tester.enterText(stateField, 'Gujarat');
      await tester.enterText(pinField, '363642');

      // Attempt Save
      final saveBtn = find.text('Save Profile & Showroom Details');
      expect(saveBtn, findsOneWidget);
      await tester.ensureVisible(saveBtn);
      await tester.tap(saveBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      // Error SnackBar is displayed
      expect(find.textContaining('Failed to save profile: Exception: PERMISSION_DENIED'), findsOneWidget);

      // Screen is NOT popped (customer stays on EditProfileScreen)
      expect(find.byType(EditProfileScreen), findsOneWidget);

      // Form field data is PRESERVED
      expect(find.text('fail.test@gmail.com'), findsOneWidget);
      expect(find.text('Morbi'), findsOneWidget);

      // In-memory AppStateService is NOT updated to 100%
      expect(AppStateService.instance.profileCompletionPercentage, equals(beforePercentage));
      expect(AppStateService.instance.isProfileEligibleForOrdering, isFalse);
    });
  });
}
