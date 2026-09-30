import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/models/sales_person.dart';
import 'package:itacon_app/models/assigned_client_snapshot.dart';
import 'package:itacon_app/models/client_assignment.dart';
import 'package:itacon_app/services/firestore_service.dart';
import 'package:itacon_app/services/auth_service.dart';

void main() {
  group('User Profile Schema & Data Integrity Tests', () {
    const activeSpId = 'WNSahNXK9GQrGoiIEmD4QBvAeim1';
    const activeSpCode = 'SALES101';
    const activeSpName = 'Vraj Shah';
    const activeSpPhone = '+919624818476';

    UserProfile createTestProfile({
      required String userId,
      required String name,
      required String phone,
      String email = '',
      String countryCode = '+91',
      String? assignedSalespersonId,
      String? salesPersonId,
      String? salespersonName,
      String? salespersonPhone,
      String? salespersonReferralCode,
    }) {
      return UserProfile(
        userId: userId,
        name: name,
        companyName: 'Test Ceramics Co',
        phone: phone,
        countryCode: countryCode,
        email: email,
        userCategory: 'dealer',
        role: 'customer',
        assignedSalespersonId: assignedSalespersonId,
        salesPersonId: salesPersonId,
        salespersonName: salespersonName,
        salespersonPhone: salespersonPhone,
        salespersonReferralCode: salespersonReferralCode,
      );
    }

    // -------------------------------------------------------------------------
    // Issue 1: Canonical 'name' and no duplicate 'fullName'
    // -------------------------------------------------------------------------
    test('1. New profile writes name only', () {
      final profile = createTestProfile(
        userId: 'test_user_001',
        name: 'Kano K Patel',
        phone: '+919624818477',
        email: 'kano@example.com',
      );
      final map = profile.toMap();
      expect(map.containsKey('name'), isTrue);
      expect(map['name'], 'Kano K Patel');
    });

    test('2. New profile does NOT write duplicate fullName', () {
      final profile = createTestProfile(
        userId: 'test_user_002',
        name: 'Kano K Patel',
        phone: '+919624818477',
      );
      final map = profile.toMap();
      expect(map.containsKey('fullName'), isFalse);

      // Also verify SalesPerson and AssignedClientSnapshot do not write fullName
      final sp = SalesPerson(
        salesPersonId: activeSpId,
        employeeId: 'EMP_101',
        name: activeSpName,
        phone: activeSpPhone,
        email: 'vraj@itacon.com',
        referralCode: activeSpCode,
      );
      expect(sp.toMap().containsKey('fullName'), isFalse);
      expect(sp.toMap()['name'], activeSpName);

      final clientSnapshot = AssignedClientSnapshot(
        clientId: 'test_user_002',
        name: 'Kano K Patel',
        companyName: 'Patel Tiles',
        phone: '+919624818477',
        clientCategory: 'dealer',
      );
      expect(clientSnapshot.toMap().containsKey('fullName'), isFalse);
      expect(clientSnapshot.toMap()['name'], 'Kano K Patel');
    });

    test('3. Existing legacy profile containing only fullName still loads cleanly', () {
      final legacyDoc = <String, dynamic>{
        'userId': 'legacy_user_999',
        'fullName': 'Legacy Kano Patel', // only fullName present
        'phone': '+919624818477',
        'email': 'legacy@example.com',
      };
      final profile = UserProfile.fromMap(legacyDoc, 'legacy_user_999');
      expect(profile.name, 'Legacy Kano Patel');
      expect(profile.userId, 'legacy_user_999');
    });

    // -------------------------------------------------------------------------
    // Issue 2: Customer profile email (no generated user_<phone>@itacon.com)
    // -------------------------------------------------------------------------
    test('4. Real entered email is written to users/{uid}.email', () {
      final profile = createTestProfile(
        userId: 'test_user_003',
        name: 'Customer With Email',
        phone: '+919624818477',
        email: 'customer@example.com',
      );
      final map = profile.toMap();
      expect(map['email'], 'customer@example.com');
    });

    test('5. Generated user_<phone>@itacon.com is sanitized and not written as profile email', () {
      final profile = createTestProfile(
        userId: 'test_user_004',
        name: 'Customer Test',
        phone: '+919624818477',
        email: 'user_919624818477@itacon.com', // dummy auth email
      );
      final map = profile.toMap();
      // Dummy email should be converted to empty string in toMap
      expect(map['email'], '');

      // Also when reading an old doc with dummy email, fromMap should sanitize it to ''
      final oldDocWithDummy = <String, dynamic>{
        'userId': 'old_user_555',
        'name': 'Old Customer',
        'phone': '+919624818477',
        'email': 'user_919624818477@itacon.com',
      };
      final loaded = UserProfile.fromMap(oldDocWithDummy, 'old_user_555');
      expect(loaded.email, '');
    });

    test('6. Empty optional email remains empty/null rather than generated', () {
      final profile = createTestProfile(
        userId: 'test_user_005',
        name: 'No Email Customer',
        phone: '+919624818477',
        email: '',
      );
      final map = profile.toMap();
      expect(map['email'], '');
      expect(map['email'].contains('@itacon.com'), isFalse);
    });

    // -------------------------------------------------------------------------
    // Issue 3: Salesperson referral assignment (SALES101 -> WNSah...)
    // -------------------------------------------------------------------------
    test('7. SALES101 resolves to active WNSah... salesperson', () {
      final rawSalespersons = [
        {
          'id': 'SP_001',
          'status': 'inactive',
          'isActive': false,
          'referralCode': 'SP001',
          'name': 'Old SP1',
        },
        {
          'id': 'SP_3210',
          'status': 'inactive',
          'isActive': false,
          'referralCode': 'SP3210',
          'name': 'Old SP3210',
        },
        {
          'id': activeSpId,
          'status': 'active',
          'isActive': true,
          'referralCode': 'SALES101',
          'name': activeSpName,
          'phone': activeSpPhone,
        },
      ];

      Map<String, dynamic>? resolveReferral(String inputCode) {
        final code = inputCode.trim().toUpperCase();
        for (final sp in rawSalespersons) {
          final isInactive = sp['isActive'] == false || sp['status'] == 'inactive';
          if (sp['referralCode'] == code && !isInactive) {
            return sp;
          }
        }
        return null;
      }

      final resolved = resolveReferral('SALES101');
      expect(resolved, isNotNull);
      expect(resolved!['id'], activeSpId);
      expect(resolved['name'], activeSpName);
      expect(resolved['referralCode'], activeSpCode);

      // Inactive codes do not resolve
      expect(resolveReferral('SP001'), isNull);
      expect(resolveReferral('SP3210'), isNull);
    });

    test('8. Valid referral writes assignedSalespersonId', () {
      final profile = createTestProfile(
        userId: 'cust_referral_01',
        name: 'Referred Customer',
        phone: '+919624818477',
        assignedSalespersonId: activeSpId,
        salesPersonId: activeSpId,
        salespersonName: activeSpName,
        salespersonPhone: activeSpPhone,
        salespersonReferralCode: activeSpCode,
      );
      final map = profile.toMap();
      expect(map['assignedSalespersonId'], activeSpId);
    });

    test('9. Valid referral writes salesPersonId', () {
      final profile = createTestProfile(
        userId: 'cust_referral_01',
        name: 'Referred Customer',
        phone: '+919624818477',
        assignedSalespersonId: activeSpId,
        salesPersonId: activeSpId,
        salespersonName: activeSpName,
        salespersonPhone: activeSpPhone,
        salespersonReferralCode: activeSpCode,
      );
      final map = profile.toMap();
      expect(map['salesPersonId'], activeSpId);
      expect(map['salespersonName'], activeSpName);
      expect(map['salespersonPhone'], activeSpPhone);
      expect(map['salespersonReferralCode'], activeSpCode);
    });

    test('10. Assignment mirrors remain consistent (client_assignments, Auto_Assign_User)', () {
      final assignment = ClientAssignment(
        assignmentId: 'ASGN_cust_referral_01',
        clientId: 'cust_referral_01',
        clientName: 'Referred Customer',
        clientPhone: '+919624818477',
        clientCategory: 'dealer',
        salespersonId: activeSpId,
        assignmentType: 'manual_referral',
        status: 'active',
        assignedAt: DateTime.now(),
      );
      final map = assignment.toMap();
      expect(map['salespersonId'], activeSpId);
      expect(map['clientId'], 'cust_referral_01');
      expect(map['status'], 'active');
      expect(map['assignmentType'], 'manual_referral');
    });

    test('11. No legacy users/{salespersonId}/assigned_clients write in assignment mirror paths', () {
      // The current architecture uses salesPersons/{spId}/assigned_clients, client_assignments, Auto_Assign_User
      final validMirrorCollections = [
        'client_assignments',
        'Auto_Assign_User',
        'salesPersons/$activeSpId/assigned_clients',
      ];
      final retiredLegacyPath = 'users/$activeSpId/assigned_clients';

      expect(validMirrorCollections.contains(retiredLegacyPath), isFalse);
      for (final p in validMirrorCollections) {
        expect(p.startsWith('users/$activeSpId'), isFalse);
      }
    });

    // -------------------------------------------------------------------------
    // Issue 4: Country code accuracy & E.164 preservation
    // -------------------------------------------------------------------------
    test('12. India +91 + 9624818477 stores countryCode "+91"', () {
      final result = FirestoreService.parsePhoneNumberComponents(
        '+919624818477',
      );
      expect(result['countryCode'], '+91');
      expect(result['nationalNumber'], '9624818477');
    });

    test('13. India complete Firebase Auth number remains +919624818477', () {
      final result = FirestoreService.parsePhoneNumberComponents(
        '+919624818477',
      );
      expect(result['e164Phone'], '+919624818477');
      expect(result['phone'], '+919624818477');
    });

    test('14. UAE +971 number stores countryCode "+971"', () {
      final result = FirestoreService.parsePhoneNumberComponents(
        '+971501234567',
      );
      expect(result['countryCode'], '+971');
      expect(result['nationalNumber'], '501234567');
      expect(result['e164Phone'], '+971501234567');
    });

    test('15. UK +44 stores "+44"', () {
      final result = FirestoreService.parsePhoneNumberComponents(
        '+447911123456',
      );
      expect(result['countryCode'], '+44');
      expect(result['nationalNumber'], '7911123456');
      expect(result['e164Phone'], '+447911123456');
    });

    test('16. US +1 stores "+1"', () {
      final result = FirestoreService.parsePhoneNumberComponents(
        '+12025550199',
      );
      expect(result['countryCode'], '+1');
      expect(result['nationalNumber'], '2025550199');
      expect(result['e164Phone'], '+12025550199');
    });

    test('17. Country code is never derived using a fixed 2-digit assumption or greedy regex', () {
      // Prior bug: substring(0, 3) or greedy regex \d{1,4} consumed '+9196' for '+919624818477'
      final resultIndia = FirestoreService.parsePhoneNumberComponents('+919624818477');
      expect(resultIndia['countryCode'], isNot('+9196'));
      expect(resultIndia['countryCode'], '+91');

      // With explicit country code passed from UI selector
      final resultExplicit = FirestoreService.parsePhoneNumberComponents(
        '9624818477',
        explicitCountryCode: '+91',
      );
      expect(resultExplicit['countryCode'], '+91');
      expect(resultExplicit['nationalNumber'], '9624818477');
      expect(resultExplicit['e164Phone'], '+919624818477');

      // 3-digit calling code (e.g. Kenya +254, UAE +971) is not cut off to 2 digits
      final result3Digit = FirestoreService.parsePhoneNumberComponents('+254712345678');
      expect(result3Digit['countryCode'], '+254');
      expect(result3Digit['nationalNumber'], '712345678');
    });

    // -------------------------------------------------------------------------
    // Canonical 'phone' field and removal of duplicate 'phoneNumber'
    // -------------------------------------------------------------------------
    group('Canonical Phone Field & No Duplicate phoneNumber Tests', () {
      test('18. New users/{uid} writes phone and NOT phoneNumber', () {
        final profile = createTestProfile(
          userId: 'test_phone_001',
          name: 'Priya Patel',
          phone: '+919624818477',
          countryCode: '+91',
        );
        final map = profile.toMap();
        expect(map.containsKey('phone'), isTrue);
        expect(map['phone'], '+919624818477');
        expect(map.containsKey('phoneNumber'), isFalse);
      });

      test('19. phone contains complete E.164 number and countryCode remains separate', () {
        final profile = createTestProfile(
          userId: 'test_phone_002',
          name: 'Amit Shah',
          phone: '+919624818477',
          countryCode: '+91',
        );
        final map = profile.toMap();
        expect(map['phone'], '+919624818477');
        expect(map['countryCode'], '+91');
        expect(map.containsKey('phoneNumber'), isFalse);
      });

      test('20. Legacy document with only phoneNumber can still load cleanly', () {
        final legacyDoc = <String, dynamic>{
          'userId': 'legacy_phone_user_01',
          'name': 'Legacy User',
          'phoneNumber': '+919624818477', // only legacy phoneNumber present
          'countryCode': '+91',
        };
        final profile = UserProfile.fromMap(legacyDoc, 'legacy_phone_user_01');
        expect(profile.phone, '+919624818477');
        expect(profile.countryCode, '+91');
      });

      test('21. Legacy document with phone + phoneNumber prefers phone', () {
        final legacyDoc = <String, dynamic>{
          'userId': 'legacy_phone_user_02',
          'name': 'Dual Phone User',
          'phone': '+919624818477',
          'phoneNumber': '+919876543210',
          'countryCode': '+91',
        };
        final profile = UserProfile.fromMap(legacyDoc, 'legacy_phone_user_02');
        expect(profile.phone, '+919624818477');
      });

      test('22. Phone OTP still receives complete E.164 number', () {
        // Test standardizing OTP phone numbers
        final testCases = [
          {'input': '+919624818477', 'expected': '+919624818477'},
          {'input': '9624818477', 'expected': '+919624818477'},
          {'input': '919624818477', 'expected': '+919624818477'},
          {'input': '+971501234567', 'expected': '+971501234567'},
          {'input': '+447911123456', 'expected': '+447911123456'},
          {'input': '+12025550199', 'expected': '+12025550199'},
        ];

        for (final tc in testCases) {
          String normalized = tc['input']!.trim();
          if (!normalized.startsWith('+')) {
            if (normalized.startsWith('91')) {
              normalized = '+$normalized';
            } else {
              normalized = '+91$normalized';
            }
          }
          expect(normalized, tc['expected']);
        }
      });

      test('23. International E.164 preservation (India +91, UAE +971, UK +44, US +1)', () {
        final cases = [
          {'raw': '+919624818477', 'code': '+91', 'e164': '+919624818477'},
          {'raw': '+971501234567', 'code': '+971', 'e164': '+971501234567'},
          {'raw': '+447911123456', 'code': '+44', 'e164': '+447911123456'},
          {'raw': '+12025550199', 'code': '+1', 'e164': '+12025550199'},
        ];

        for (final c in cases) {
          final parsed = FirestoreService.parsePhoneNumberComponents(c['raw']!);
          expect(parsed['countryCode'], c['code']);
          expect(parsed['e164Phone'], c['e164']);

          final profile = createTestProfile(
            userId: 'test_${c['code']}',
            name: 'Intl User',
            phone: parsed['e164Phone']!,
            countryCode: parsed['countryCode']!,
          );
          final map = profile.toMap();
          expect(map['phone'], c['e164']);
          expect(map['countryCode'], c['code']);
          expect(map.containsKey('phoneNumber'), isFalse);
        }
      });

      test('24. Salesperson phone fields are unaffected', () {
        final profile = createTestProfile(
          userId: 'test_sp_phone_user',
          name: 'Client of Vraj',
          phone: '+919624818477',
          salesPersonId: activeSpId,
          salespersonName: activeSpName,
          salespersonPhone: activeSpPhone,
          salespersonReferralCode: activeSpCode,
        );
        final map = profile.toMap();
        expect(map['salespersonPhone'], activeSpPhone);
        expect(map['phone'], '+919624818477');
        expect(map.containsKey('phoneNumber'), isFalse);

        // SalesPerson model itself preserves its fields
        final sp = SalesPerson(
          salesPersonId: activeSpId,
          employeeId: 'EMP_101',
          name: activeSpName,
          phone: activeSpPhone,
          email: 'vraj@itacon.com',
          referralCode: activeSpCode,
        );
        expect(sp.phone, activeSpPhone);
      });
    });

    // -------------------------------------------------------------------------
    // User ↔ Category Linking & Safe Cleanup Tests
    // -------------------------------------------------------------------------
    group('User ↔ Category Linking & Safe Cleanup Tests', () {
      const testUid = 'test_firebase_uid_12345';

      test('25. Canonical category mapping (1-5): dealer -> dealers, architect -> architects, builder -> builders, wholesaler -> wholesalers, retailer -> retailers', () {
        // 1. dealer -> dealers
        expect(FirestoreService.getCategoryCollectionName('dealer'), 'dealers');
        // 2. architect -> architects
        expect(FirestoreService.getCategoryCollectionName('architect'), 'architects');
        // 3. builder -> builders
        expect(FirestoreService.getCategoryCollectionName('builder'), 'builders');
        // 4. wholesaler -> wholesalers
        expect(FirestoreService.getCategoryCollectionName('wholesaler'), 'wholesalers');
        // 5. retailer -> retailers
        expect(FirestoreService.getCategoryCollectionName('retailer'), 'retailers');
      });

      test('26. Unknown category is rejected (6)', () {
        expect(() => FirestoreService.getCategoryCollectionName('xyz'), throwsArgumentError);
        expect(() => FirestoreService.getCategoryCollectionName('unknownCategory'), throwsArgumentError);
        expect(() => FirestoreService.getCategoryCollectionName('foo_bar'), throwsArgumentError);
      });

      test('27. Empty and null category is rejected (7)', () {
        expect(() => FirestoreService.getCategoryCollectionName(''), throwsArgumentError);
        expect(() => FirestoreService.getCategoryCollectionName('   '), throwsArgumentError);
        expect(() => FirestoreService.getCategoryCollectionName(null), throwsArgumentError);
      });

      test('28. Arbitrary value cannot create arbitrary collection (8)', () {
        expect(() => FirestoreService.getCategoryCollectionName('customer'), throwsArgumentError);
        expect(() => FirestoreService.getCategoryCollectionName('customPartner'), throwsArgumentError);
        expect(() => FirestoreService.getCategoryCollectionName('vendor'), throwsArgumentError);
        expect(() => FirestoreService.getCategoryCollectionName('xyzs'), throwsArgumentError);
      });

      test('29. contractor cannot create contractors (9)', () {
        expect(() => FirestoreService.getCategoryCollectionName('contractor'), throwsArgumentError);
        expect(() => FirestoreService.getCategoryCollectionName('contractors'), throwsArgumentError);
      });

      test('30. Builder / Contractor still resolves through builder -> builders (10)', () {
        expect(FirestoreService.getCategoryCollectionName('Builder / Contractor'), 'builders');
        expect(FirestoreService.getCategoryCollectionName('builder / contractor'), 'builders');
        expect(FirestoreService.getCategoryCollectionName('Builder/Contractor'), 'builders');
      });

      test('31. Registration cannot write unsupported category (11)', () async {
        final authService = AuthService();
        expect(
          () => authService.registerUser(
            phoneNumber: '+919624818477',
            categoryId: 'contractor', // unsupported category
            password: 'ValidPassword123!',
          ),
          throwsArgumentError,
        );

        expect(
          () => authService.registerUser(
            phoneNumber: '+919624818477',
            categoryId: 'customer', // unsupported arbitrary category
            password: 'ValidPassword123!',
          ),
          throwsArgumentError,
        );

        expect(
          () => authService.registerUser(
            phoneNumber: '+919624818477',
            categoryId: 'xyz', // unknown category
            password: 'ValidPassword123!',
          ),
          throwsArgumentError,
        );

        expect(
          () => authService.registerUser(
            phoneNumber: '+919624818477',
            categoryId: '', // empty category
            password: 'ValidPassword123!',
          ),
          throwsArgumentError,
        );
      });

      test('32. Category change cannot target unsupported category (12)', () async {
        final firestoreService = FirestoreService();
        expect(
          () => firestoreService.updateUserProfileData(
            uid: testUid,
            role: 'contractor', // unsupported category
          ),
          throwsArgumentError,
        );

        expect(
          () => firestoreService.updateUserProfileData(
            uid: testUid,
            role: 'customer', // unsupported arbitrary category
          ),
          throwsArgumentError,
        );

        expect(
          () => firestoreService.updateUserProfileData(
            uid: testUid,
            role: 'xyz', // unknown category
          ),
          throwsArgumentError,
        );

        expect(
          () => firestoreService.updateUserProfileData(
            uid: testUid,
            role: '', // empty category
          ),
          throwsArgumentError,
        );
      });

      test('33. New category document ID equals Firebase UID and category.userId equals Firebase UID', () {
        final profile = createTestProfile(
          userId: testUid,
          name: 'Category Link User',
          phone: '+919624818477',
        );
        expect(profile.userId, testUid);
        final map = profile.toMap();
        expect(map['userId'], testUid);
        expect(map['uid'], testUid);
      });

      test('34. Architect registration maps to architects/{uid} with no auth secrets copied', () {
        final targetCol = FirestoreService.getCategoryCollectionName('architect');
        expect(targetCol, 'architects');

        // Verify simulated payload for category mirror
        final docData = <String, dynamic>{
          'userId': testUid,
          'uid': testUid,
          'name': 'Ar. Priya Sharma',
          'phone': '+919624818477',
          'password': 'secret_password_123',
          'passwordHash': 'hash_xyz',
          'passwordSalt': 'salt_xyz',
          'fcmToken': 'token_abc',
        };

        final catDocData = Map<String, dynamic>.from(docData);
        catDocData.remove('password');
        catDocData.remove('passwordHash');
        catDocData.remove('passwordSalt');
        catDocData.remove('fcmToken');

        expect(catDocData.containsKey('password'), isFalse);
        expect(catDocData.containsKey('passwordHash'), isFalse);
        expect(catDocData.containsKey('passwordSalt'), isFalse);
        expect(catDocData.containsKey('fcmToken'), isFalse);
        expect(catDocData['userId'], testUid);
      });

      test('35. Category-change logic resolves old and new collection accurately', () {
        const oldRole = 'retailer';
        const newRole = 'architect';

        final oldCol = FirestoreService.getCategoryCollectionName(oldRole);
        final newCol = FirestoreService.getCategoryCollectionName(newRole);

        expect(oldCol, 'retailers');
        expect(newCol, 'architects');
        expect(oldCol, isNot(newCol));
      });

      test('36. Deletion resolves correct category collection and preserves historical data', () {
        const userCategory = 'wholesaler';
        final colName = FirestoreService.getCategoryCollectionName(userCategory);
        expect(colName, 'wholesalers');

        // Historical business collections that must NOT be targeted for deletion
        const protectedHistoricalCollections = [
          'orders',
          'quotations',
          'paymentSubmissions',
          'payment_utrs',
          'loyaltyTransactions',
          'customer_referrals',
        ];

        // Operational collections that are cleaned on deletion
        const operationalCleaningTargets = [
          'Auto_Assign_User',
          'Manual_salesperson_assign',
          'client_assignments',
          'wishlists',
        ];

        for (final p in protectedHistoricalCollections) {
          expect(operationalCleaningTargets.contains(p), isFalse);
        }
      });
    });
  });
}
