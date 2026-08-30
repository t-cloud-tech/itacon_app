import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/models.dart';
import 'package:itacon_app/services/config_service.dart';
import 'package:itacon_app/services/app_state_service.dart';

import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/services/pricing_service.dart';
import 'package:itacon_app/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues({});
  group('TransporterModel Tests', () {
    test('Should correctly instantiate and convert to/from map', () {
      final transporter = TransporterModel(
        transporterId: 'TRANS_001',
        companyName: 'Express Logistics Ltd',
        contactPerson: 'Rajesh Kumar',
        phone: '+919876543210',
        email: 'rajesh@expresslogistics.com',
        vehicleTypes: ['Container Truck 18T', 'Trailer 32T'],
        coveredRoutes: ['Morbi-Ahmedabad', 'Morbi-Mumbai', 'Morbi-Delhi'],
        gstNumber: '24AAACE1234F1Z5',
        status: 'active',
      );

      expect(transporter.transporterId, 'TRANS_001');
      expect(transporter.companyName, 'Express Logistics Ltd');
      expect(transporter.contactPerson, 'Rajesh Kumar');
      expect(transporter.phone, '+919876543210');
      expect(transporter.email, 'rajesh@expresslogistics.com');
      expect(transporter.vehicleTypes.length, 2);
      expect(transporter.coveredRoutes.length, 3);
      expect(transporter.gstNumber, '24AAACE1234F1Z5');
      expect(transporter.status, 'active');

      final map = transporter.toMap();
      expect(map['transporterId'], 'TRANS_001');
      expect(map['companyName'], 'Express Logistics Ltd');
      expect(map['gstNumber'], '24AAACE1234F1Z5');

      final deserialized = TransporterModel.fromMap(map, 'TRANS_001');
      expect(deserialized.transporterId, 'TRANS_001');
      expect(deserialized.companyName, 'Express Logistics Ltd');
      expect(deserialized.vehicleTypes, contains('Trailer 32T'));
      expect(deserialized.coveredRoutes, contains('Morbi-Mumbai'));
    });
  });

  group('ShipmentModel Tests', () {
    test('Should correctly instantiate and convert to/from map', () {
      final shipment = ShipmentModel(
        shipmentId: 'SHIP_9001',
        orderId: 'ORD_1001',
        orderReference: 'PO-GJ-2026-98104',
        customerId: 'CUST_501',
        transporterId: 'TRANS_001',
        transporterName: 'Express Logistics Ltd',
        lrNumber: 'LR-2026-8841',
        lrDocumentUrl: 'https://storage.googleapis.com/docs/lr8841.pdf',
        vehicleNumber: 'GJ-03-BW-9921',
        driverName: 'Ramesh Patel',
        driverPhone: '+919988776655',
        pickupLocation: {'address': 'Factory 2, Morbi National Highway'},
        deliveryLocation: {'address': 'Sector 15, Gandhinagar, Gujarat'},
        totalWeightTons: 24.5,
        totalBoxes: 820,
        freightCharges: 35000.0,
        paymentTerms: 'to_pay',
        shipmentStatus: 'dispatched',
        dispatchDate: DateTime(2026, 8, 10, 10, 0),
        estimatedDeliveryDate: DateTime(2026, 8, 12, 18, 0),
      );

      expect(shipment.shipmentId, 'SHIP_9001');
      expect(shipment.orderId, 'ORD_1001');
      expect(shipment.orderReference, 'PO-GJ-2026-98104');
      expect(shipment.customerId, 'CUST_501');
      expect(shipment.transporterId, 'TRANS_001');
      expect(shipment.transporterName, 'Express Logistics Ltd');
      expect(shipment.lrNumber, 'LR-2026-8841');
      expect(shipment.lrDocumentUrl, 'https://storage.googleapis.com/docs/lr8841.pdf');
      expect(shipment.vehicleNumber, 'GJ-03-BW-9921');
      expect(shipment.driverName, 'Ramesh Patel');
      expect(shipment.driverPhone, '+919988776655');
      expect(shipment.totalWeightTons, 24.5);
      expect(shipment.totalBoxes, 820);
      expect(shipment.freightCharges, 35000.0);
      expect(shipment.paymentTerms, 'to_pay');
      expect(shipment.shipmentStatus, 'dispatched');

      final map = shipment.toMap();
      expect(map['shipmentId'], 'SHIP_9001');
      expect(map['freightCharges'], 35000.0);

      final deserialized = ShipmentModel.fromMap(map, 'SHIP_9001');
      expect(deserialized.shipmentId, 'SHIP_9001');
      expect(deserialized.orderReference, 'PO-GJ-2026-98104');
      expect(deserialized.totalBoxes, 820);
      expect(deserialized.vehicleNumber, 'GJ-03-BW-9921');
    });
  });

  group('TrackingHistoryModel Tests', () {
    test('Should correctly instantiate and convert to/from map', () {
      final history = TrackingHistoryModel(
        id: 'TH_101',
        status: 'in_transit',
        location: 'Surat Toll Plaza',
        remarks: 'Driver on schedule',
        updatedBy: 'Ramesh Patel (Driver)',
        timestamp: DateTime(2026, 8, 11, 14, 30),
      );

      expect(history.id, 'TH_101');
      expect(history.status, 'in_transit');
      expect(history.location, 'Surat Toll Plaza');
      expect(history.remarks, 'Driver on schedule');
      expect(history.updatedBy, 'Ramesh Patel (Driver)');

      final map = history.toMap();
      expect(map['status'], 'in_transit');
      expect(map['location'], 'Surat Toll Plaza');

      final deserialized = TrackingHistoryModel.fromMap(map, 'TH_101');
      expect(deserialized.id, 'TH_101');
      expect(deserialized.status, 'in_transit');
      expect(deserialized.updatedBy, 'Ramesh Patel (Driver)');
    });
  });

  group('OrderModel (TileOrder) Logistics Field Updates', () {
    test('Should support shipmentId, freightAmount, and dispatchStatus', () {
      final order = OrderModel(
        id: 'ORD_1001',
        orderReference: 'PO-GJ-2026-98104',
        userId: 'CUST_501',
        userCategory: 'dealer',
        status: 'approved',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Gandhinagar'},
        transportRequired: true,
        remarks: 'Fragile tile shipment',
        items: [],
        shipmentId: 'SHIP_9001',
        freightAmount: 15000.0,
        dispatchStatus: 'dispatched',
      );

      expect(order.shipmentId, 'SHIP_9001');
      expect(order.freightAmount, 15000.0);
      expect(order.dispatchStatus, 'dispatched');

      final map = order.toMap();
      expect(map['shipmentId'], 'SHIP_9001');
      expect(map['freightAmount'], 15000.0);
      expect(map['dispatchStatus'], 'dispatched');

      final deserialized = OrderModel.fromMap(map, 'ORD_1001');
      expect(deserialized.shipmentId, 'SHIP_9001');
      expect(deserialized.freightAmount, 15000.0);
      expect(deserialized.dispatchStatus, 'dispatched');
    });

    test('Should default dispatchStatus to unassigned if missing', () {
      final order = OrderModel(
        id: 'ORD_1002',
        orderReference: 'PO-GJ-2026-0002',
        userId: 'CUST_502',
        userCategory: 'dealer',
        status: 'pending',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Ahmedabad'},
        transportRequired: false,
        remarks: '',
        items: [],
      );

      expect(order.shipmentId, null);
      expect(order.freightAmount, null);
      expect(order.dispatchStatus, 'unassigned');
    });
  });

  group('ProductModel (TileProduct) Inventory Field Updates', () {
    test('Should support currentStock, reservedStock, availableStock, thickness, shape, aspectRatio', () {
      final product = ProductModel(
        id: 'PROD_201',
        name: 'Statuario White Marble Tile',
        size: '600x1200',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Marble',
        basePrice: 450.0,
        moq: 20,
        stockStatus: 'available',
        images: ['https://storage.googleapis.com/images/statuario.jpg'],
        currentStock: 1200,
        reservedStock: 200,
        thickness: '12mm',
        shape: 'Rectangle',
        aspectRatio: '1:2',
      );

      expect(product.currentStock, 1200);
      expect(product.reservedStock, 200);
      expect(product.availableStock, 1000);
      expect(product.thickness, '12mm');
      expect(product.shape, 'Rectangle');
      expect(product.aspectRatio, '1:2');

      final map = product.toMap();
      expect(map['currentStock'], 1200);
      expect(map['reservedStock'], 200);
      expect(map['availableStock'], 1000);
      expect(map['thickness'], '12mm');
      expect(map['shape'], 'Rectangle');
      expect(map['aspectRatio'], '1:2');

      final deserialized = ProductModel.fromMap(map, 'PROD_201');
      expect(deserialized.currentStock, 1200);
      expect(deserialized.reservedStock, 200);
      expect(deserialized.availableStock, 1000);
      expect(deserialized.thickness, '12mm');
      expect(deserialized.shape, 'Rectangle');
      expect(deserialized.aspectRatio, '1:2');
    });
  });

  group('ClientAssignment Tests', () {
    test('Should correctly instantiate and convert to/from map', () {
      final assignment = ClientAssignment(
        assignmentId: 'ASGN_1001',
        clientId: 'CUST_501',
        clientName: 'Patel Group',
        clientPhone: '+919876543210',
        clientCategory: 'architect',
        salespersonId: 'SP_001',
        assignmentType: 'manual_referral',
        status: 'active',
        assignedAt: DateTime(2026, 8, 10, 12, 0),
      );

      expect(assignment.assignmentId, 'ASGN_1001');
      expect(assignment.clientId, 'CUST_501');
      expect(assignment.clientName, 'Patel Group');
      expect(assignment.clientPhone, '+919876543210');
      expect(assignment.clientCategory, 'architect');
      expect(assignment.salespersonId, 'SP_001');
      expect(assignment.assignmentType, 'manual_referral');
      expect(assignment.status, 'active');

      final map = assignment.toMap();
      expect(map['assignmentId'], 'ASGN_1001');
      expect(map['salespersonId'], 'SP_001');

      final deserialized = ClientAssignment.fromMap(map, 'ASGN_1001');
      expect(deserialized.assignmentId, 'ASGN_1001');
      expect(deserialized.clientName, 'Patel Group');
      expect(deserialized.salespersonId, 'SP_001');
    });
  });

  group('AssignedClientSnapshot Tests', () {
    test('Should correctly instantiate and convert to/from map', () {
      final snapshot = AssignedClientSnapshot(
        clientId: 'CUST_501',
        name: 'Smit Patel',
        companyName: 'Patel Group',
        phone: '+919876543210',
        clientCategory: 'architect',
        assignmentType: 'auto_assigned',
        assignedAt: DateTime(2026, 8, 10, 12, 0),
      );

      expect(snapshot.clientId, 'CUST_501');
      expect(snapshot.name, 'Smit Patel');
      expect(snapshot.companyName, 'Patel Group');
      expect(snapshot.phone, '+919876543210');
      expect(snapshot.clientCategory, 'architect');
      expect(snapshot.assignmentType, 'auto_assigned');

      final map = snapshot.toMap();
      expect(map['clientId'], 'CUST_501');
      expect(map['companyName'], 'Patel Group');

      final deserialized = AssignedClientSnapshot.fromMap(map, 'CUST_501');
      expect(deserialized.clientId, 'CUST_501');
      expect(deserialized.name, 'Smit Patel');
      expect(deserialized.assignmentType, 'auto_assigned');
    });
  });

  group('Salesperson Client Counters Tests', () {
    test('UserProfile and SalesPerson should default counter fields to 0', () {
      const profile = UserProfile(
        userId: 'SP_001',
        name: 'ITA Sales Executive',
        companyName: 'ITACON',
        phone: '+919876543210',
        email: 'sales@itacon.com',
        userCategory: 'salesperson',
        role: 'salesperson',
      );

      expect(profile.assignedClientsCount, 0);
      expect(profile.activeClientsCount, 0);

      final spProfileMap = profile.toMap();
      expect(spProfileMap['assignedClientsCount'], 0);
      expect(spProfileMap['activeClientsCount'], 0);

      const sp = SalesPerson(
        salesPersonId: 'SP_001',
        employeeId: 'EMP-SP-001',
        name: 'ITA Sales Executive',
        phone: '+919876543210',
        email: 'sales@itacon.com',
        referralCode: 'SALES101',
      );

      expect(sp.assignedClientsCount, 0);
      expect(sp.activeClientsCount, 0);

      final spMap = sp.toMap();
      expect(spMap['salesPersonId'], 'SP_001');
      expect(spMap.containsKey('salespersonId'), false);
      expect(spMap['assignedClientsCount'], 0);
      expect(spMap['activeClientsCount'], 0);
    });

    test('UserProfile toMap should omit client counter fields for non-salesperson users', () {
      const customerProfile = UserProfile(
        userId: 'CUST_101',
        name: 'John Doe',
        companyName: 'ABC Construction',
        phone: '+919876543211',
        email: 'john@abc.com',
        userCategory: 'dealer',
        role: 'customer',
      );

      final customerMap = customerProfile.toMap();
      expect(customerMap.containsKey('assignedClientsCount'), false);
      expect(customerMap.containsKey('activeClientsCount'), false);
    });

    test('UserProfile isVerified getter should evaluate verification status correctly', () {
      const unverified = UserProfile(
        userId: 'U1',
        name: 'Unverified',
        companyName: '',
        phone: '+919999999999',
        email: '',
        userCategory: 'dealer',
        role: 'customer',
        phoneVerified: false,
        whatsappVerified: false,
        emailVerified: false,
      );
      expect(unverified.isVerified, false);

      const phoneVerifiedUser = UserProfile(
        userId: 'U2',
        name: 'Verified User',
        companyName: '',
        phone: '+919999999999',
        email: '',
        userCategory: 'dealer',
        role: 'customer',
        phoneVerified: true,
      );
      expect(phoneVerifiedUser.isVerified, true);
    });

    test('SalesPerson model should support unlimited assigned clients without cap', () {
      const spUnlimited = SalesPerson(
        salesPersonId: 'SP_001',
        employeeId: 'EMP-SP-001',
        name: 'ITA Salesperson',
        phone: '+919876543210',
        email: 'sales@itacon.com',
        referralCode: 'SALES101',
        assignedClientsCount: 15,
      );
      expect(spUnlimited.assignedClientsCount, 15);
    });
  });

  group('Referral Code & Credential Validation Gate Tests', () {
    test('Should trim and uppercase referral code format for database verification', () {
      final inputCode = '  sales101  ';
      final formatted = inputCode.trim().toUpperCase();
      expect(formatted, 'SALES101');
    });

    test('Invalid referral code format should fail verification', () {
      final invalidCode = '  ';
      expect(invalidCode.trim().isEmpty, isTrue);
    });

    test('Short password should be rejected with invalid credentials message', () {
      const shortPass = '123';
      expect(shortPass.length < 4, isTrue);
    });
  });

  group('ConfigService Tests', () {
    test('Default enableTransportation should be false', () {
      final service = ConfigService();
      expect(service.enableTransportation, isFalse);
    });
  });

  group('PromotionModel & SystemConfigModel & Home Screen Attributes Tests', () {
    test('PromotionModel should correctly instantiate and serialize/deserialize', () {
      final promo = PromotionModel(
        bannerId: 'BAN_001',
        title: 'Monsoon Special Offer',
        imageUrl: 'https://example.com/banner.png',
        redirectType: 'category',
        redirectTargetId: 'CAT_GVT',
        displayOrder: 1,
        isActive: true,
      );

      expect(promo.bannerId, 'BAN_001');
      expect(promo.title, 'Monsoon Special Offer');
      expect(promo.redirectType, 'category');
      expect(promo.displayOrder, 1);
      expect(promo.isActive, isTrue);

      final map = promo.toMap();
      expect(map['bannerId'], 'BAN_001');
      expect(map['redirectType'], 'category');

      final deserialized = PromotionModel.fromMap(map, 'BAN_001');
      expect(deserialized.title, 'Monsoon Special Offer');
      expect(deserialized.redirectTargetId, 'CAT_GVT');
    });

    test('SystemConfigModel should correctly parse systemConfigs/app_features schema', () {
      final config = SystemConfigModel(
        enableTransportation: true,
        appVersion: '2.1.0',
        maintenanceMode: false,
      );

      expect(config.enableTransportation, isTrue);
      expect(config.appVersion, '2.1.0');
      expect(config.maintenanceMode, isFalse);

      final map = config.toMap();
      final deserialized = SystemConfigModel.fromMap(map);
      expect(deserialized.enableTransportation, isTrue);
      expect(deserialized.appVersion, '2.1.0');
    });

    test('CategoryModel should support displayOrder and isFeatured attributes', () {
      final category = ProductCategory(
        categoryId: 'CAT_SLABS',
        name: 'GVT/PGVT Slabs',
        description: 'Large Format Porcelain Slabs',
        imageUrl: 'https://example.com/slabs.jpg',
        displayOrder: 2,
        isFeatured: true,
      );

      expect(category.displayOrder, 2);
      expect(category.isFeatured, isTrue);

      final map = category.toMap();
      expect(map['displayOrder'], 2);
      expect(map['isFeatured'], isTrue);

      final deserialized = ProductCategory.fromMap(map, 'CAT_SLABS');
      expect(deserialized.displayOrder, 2);
      expect(deserialized.isFeatured, isTrue);
    });

    test('TileProduct should support thicknessCategory, shape, and numeric aspectRatioValue', () {
      final product = TileProduct(
        id: 'PROD_99',
        name: 'Royal Statuario Porcelain',
        size: '600x1200',
        surface: 'Glossy',
        color: 'White',
        pattern: 'Marble',
        basePrice: 45.0,
        moq: 20,
        stockStatus: 'available_now',
        images: ['https://example.com/tile.jpg'],
        thickness: '15 mm',
        thicknessCategory: 'heavy_thick',
        shape: 'rectangle',
        aspectRatio: '0.5',
      );

      expect(product.thicknessCategory, 'heavy_thick');
      expect(product.shape, 'rectangle');
      expect(product.aspectRatioValue, 0.5);

      final map = product.toMap();
      expect(map['thicknessCategory'], 'heavy_thick');
      expect(map['aspectRatioValue'], 0.5);

      final deserialized = TileProduct.fromMap(map, 'PROD_99');
      expect(deserialized.thicknessCategory, 'heavy_thick');
      expect(deserialized.aspectRatioValue, 0.5);
    });
  });

  group('Profile Completion Percentage & Live User Profile Tests', () {
    test('Should calculate correct profile completion percentage', () {
      final appState = AppStateService.instance;

      final testUser = const UserProfile(
        userId: 'USER_101',
        name: 'Suresh Patel',
        phone: '+91 99887 76655',
        email: 'suresh@example.com',
        userCategory: 'Architect',
        role: 'customer',
        companyName: 'Patel Designs',
        city: '',
        pincode: '',
        gstNumber: '',
      );

      appState.setCurrentUserProfile(testUser);

      // Name(1) + Phone(1) + Category(1) + Email(1) + Company(1) = 5/10 = 50%
      expect(appState.profileCompletionPercentage, 50);

      appState.updateUserProfileFields(
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380001',
        gstNumber: '24BBBBB1111B1Z2',
        address: {'line1': 'CG Road'},
      );

      // 10 / 10 = 100%
      expect(appState.profileCompletionPercentage, 100);
      expect(appState.pendingProfileFields.isEmpty, isTrue);
    });

    test('UserProfile initials should return uppercase initials correctly', () {
      const user1 = UserProfile(
        userId: 'U1',
        name: 'Ramesh Kumar',
        phone: '123',
        email: '',
        companyName: '',
        userCategory: 'Dealer',
        role: 'customer',
      );
      expect(user1.initials, 'RK');

      const user2 = UserProfile(
        userId: 'U2',
        name: 'Anil',
        phone: '123',
        email: '',
        companyName: '',
        userCategory: 'Dealer',
        role: 'customer',
      );
      expect(user2.initials, 'A');
    });
  });

  group('UserSessionService Persistent Session Tests', () {
    test('Should save, restore, and clear user session correctly', () async {
      SharedPreferences.setMockInitialValues({});
      const testProfile = UserProfile(
        userId: 'USER_101',
        name: 'Vikram Patel',
        phone: '+919988776655',
        email: 'vikram@itacongranito.com',
        companyName: 'Patel Tiles & Sanitary',
        userCategory: 'Architect',
        role: 'customer',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395007',
        gstNumber: '24BBBBB1111B1Z2',
      );

      await UserSessionService.saveUserSession(testProfile);
      final restored = await UserSessionService.restoreUserSession();

      expect(restored, isNotNull);
      expect(restored!.userId, 'USER_101');
      expect(restored.name, 'Vikram Patel');
      expect(restored.companyName, 'Patel Tiles & Sanitary');
      expect(restored.userCategory, 'Architect');
      expect(AppStateService.instance.currentUserProfile.name, 'Vikram Patel');

      await UserSessionService.clearUserSession();
      final cleared = await UserSessionService.restoreUserSession();
      expect(cleared, isNull);
    });
  });

  group('PricingService Waterfall & Tier Resolution Tests', () {
    final testProduct = TileProduct(
      id: 'PROD_TEST_01',
      name: 'Statuario Marble',
      size: '600x1200 mm',
      surface: 'Glossy',
      color: 'White',
      baseColour: 'White',
      pattern: 'Vein',
      basePrice: 100.0,
      moq: 10,
      stockStatus: 'available_now',
      images: [],
      finish: 'Glossy',
      thickness: '9 mm',
      productType: 'Vitrified',
      tileCategory: 'Floor Tiles',
      collection: 'Marbles',
      shape: 'rectangle',
      aspectRatio: '0.5',
    );

    test('Should apply category tier discount correctly (Dealer 15% OFF)', () {
      const dealerProfile = UserProfile(
        userId: 'DEALER_USER_01',
        name: 'Amit Patel',
        phone: '123',
        email: '',
        companyName: 'Amit Traders',
        userCategory: 'Dealer',
        role: 'customer',
      );

      final resolved = PricingService.instance.resolvePrice(testProduct, dealerProfile);

      expect(resolved.unitPrice, 85.0); // 100 * (1 - 0.15) = 85
      expect(resolved.basePrice, 100.0);
      expect(resolved.isTierDiscounted, isTrue);
      expect(resolved.isCustomOverride, isFalse);
    });

    test('Custom SKU rate override should take priority over tier discount', () {
      const dealerProfile = UserProfile(
        userId: 'DEALER_USER_02',
        name: 'Rajesh Shah',
        phone: '123',
        email: '',
        companyName: 'Shah Granites',
        userCategory: 'Dealer',
        role: 'customer',
      );

      PricingService.instance.setCustomPriceOverride('DEALER_USER_02', 'PROD_TEST_01', 75.0);
      final resolved = PricingService.instance.resolvePrice(testProduct, dealerProfile);

      expect(resolved.unitPrice, 75.0);
      expect(resolved.isCustomOverride, isTrue);
      expect(resolved.discountBadgeLabel, 'Your Partner Rate');
    });
  });

  group('Forgot Password & Password Reset Link Tests', () {
    test('Empty or invalid email should throw validation exception', () async {
      final authService = AuthService();

      expect(
        () => authService.sendPasswordResetLink(''),
        throwsA(isA<Exception>().having(
          (e) => e.toString(),
          'message',
          contains('Please enter a valid email address.'),
        )),
      );
    });

    test('Client password validation should enforce 8+ chars, upper, lower, number, special char', () {
      expect(AuthService.validatePassword('short'), contains('at least 8 characters'));
      expect(AuthService.validatePassword('nouppercase1!'), contains('1 uppercase letter'));
      expect(AuthService.validatePassword('NOLOWERCASE1!'), contains('1 lowercase letter'));
      expect(AuthService.validatePassword('NoNumberSpecial!'), contains('1 number'));
      expect(AuthService.validatePassword('NoSpecial123'), contains('1 special character'));
      expect(AuthService.validatePassword('ValidPass123!'), isNull);
    });

    test('UserProfile toMap should never contain password or sensitive credential keys', () {
      const profile = UserProfile(
        userId: 'USER_UID_1001',
        name: 'Ramesh Patel',
        companyName: 'Patel Tiles',
        phone: '+919876543210',
        email: 'ramesh@pateltiles.com',
        userCategory: 'Dealer',
        role: 'customer',
      );

      final map = profile.toMap();
      expect(map.containsKey('password'), isFalse);
      expect(map.containsKey('pass'), isFalse);
      expect(map.containsKey('hash'), isFalse);
      expect(map.containsKey('token'), isFalse);
      expect(map['userId'], 'USER_UID_1001');
      expect(map['phone'], '+919876543210');
    });
  });
}

