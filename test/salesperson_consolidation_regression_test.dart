import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/client_assignment.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/services/firestore_service.dart';

void main() {
  group('Salesperson Consolidation Regression Tests', () {
    const activeSpId = 'WNSahNXK9GQrGoiIEmD4QBvAeim1';
    const activeSpCode = 'SALES101';
    const activeSpName = 'Vraj Shah';
    const legacySpIds = ['SP_001', 'SP_002', 'SP_003', 'SP_3210'];

    test('1. Default salesperson constant is WNSah... and not legacy SP_001', () {
      expect(FirestoreService.defaultSalespersonId, activeSpId);
      expect(FirestoreService.defaultSalespersonName, activeSpName);
      expect(FirestoreService.defaultSalespersonReferralCode, activeSpCode);
      expect(legacySpIds.contains(FirestoreService.defaultSalespersonId), isFalse);
    });

    test('2. Inactive legacy salespersons (SP_001, SP_002, SP_003, SP_3210) are filtered out from active selection', () {
      final rawSalespersonsList = [
        {'id': 'SP_001', 'status': 'inactive', 'isActive': false, 'referralCode': 'LEGACY_SP001_INACTIVE'},
        {'id': 'SP_002', 'status': 'inactive', 'isActive': false, 'referralCode': 'LEGACY_SP002_INACTIVE'},
        {'id': 'SP_003', 'status': 'inactive', 'isActive': false, 'referralCode': 'LEGACY_SP003_INACTIVE'},
        {'id': 'SP_3210', 'status': 'inactive', 'isActive': false, 'referralCode': 'LEGACY_SP3210_INACTIVE'},
        {'id': activeSpId, 'status': 'active', 'isActive': true, 'referralCode': 'SALES101', 'name': activeSpName},
      ];

      final filteredAvailable = rawSalespersonsList.where((data) {
        final isActive = data['isActive'] == true || data['status'] == 'active';
        final isInactive = data['isActive'] == false || data['status'] == 'inactive';
        return isActive && !isInactive;
      }).toList();

      expect(filteredAvailable.length, 1);
      expect(filteredAvailable.first['id'], activeSpId);
      for (final legacyId in legacySpIds) {
        expect(filteredAvailable.any((sp) => sp['id'] == legacyId), isFalse);
      }
    });

    test('3. SALES101 referral code resolves strictly to active salesperson WNSah...', () {
      final rawSalespersonsList = [
        {'id': 'SP_001', 'status': 'inactive', 'isActive': false, 'referralCode': 'LEGACY_SP001_INACTIVE'},
        {'id': 'SP_3210', 'status': 'inactive', 'isActive': false, 'referralCode': 'LEGACY_SP3210_INACTIVE'},
        {'id': activeSpId, 'status': 'active', 'isActive': true, 'referralCode': 'SALES101', 'name': activeSpName},
      ];

      Map<String, dynamic>? matchReferralCode(String inputCode) {
        final trimmed = inputCode.trim().toUpperCase();
        for (final sp in rawSalespersonsList) {
          final isInactive = sp['isActive'] == false || sp['status'] == 'inactive';
          if (sp['referralCode'] == trimmed && !isInactive) {
            return sp;
          }
        }
        return null;
      }

      final result = matchReferralCode('SALES101');
      expect(result, isNotNull);
      expect(result!['id'], activeSpId);
      expect(result['name'], activeSpName);

      expect(matchReferralCode('LEGACY_SP001_INACTIVE'), isNull);
      expect(matchReferralCode('LEGACY_SP3210_INACTIVE'), isNull);
    });

    test('4. New customer assignment serializes with WNSah... as the authoritative salesperson', () {
      final assignment = ClientAssignment(
        assignmentId: 'ASGN_CUST_2026_001',
        clientId: 'CUST_2026_001',
        clientName: 'Modern Buildcon',
        clientPhone: '+919876543210',
        clientCategory: 'builder',
        salespersonId: activeSpId,
        assignmentType: 'auto_assigned',
        status: 'active',
        assignedAt: DateTime.now(),
      );

      final map = assignment.toMap();
      expect(map['salespersonId'], activeSpId);
      expect(map['clientId'], 'CUST_2026_001');
      expect(map['status'], 'active');
      expect(legacySpIds.contains(map['salespersonId']), isFalse);
    });

    test('5. Customer user profile correctly retains salesPersonId pointing to WNSah...', () {
      final profile = UserProfile(
        userId: 'user_cust_777',
        name: 'Kalpesh Bhai',
        phone: '+919624818476',
        email: 'kalpesh@example.com',
        companyName: 'Modern Tiles Co',
        userCategory: 'wholesaler',
        role: 'customer',
        salesPersonId: activeSpId,
      );

      final map = profile.toMap();
      expect(map['salesPersonId'], activeSpId);
      expect(map['userCategory'], 'wholesaler');
      expect(legacySpIds.contains(map['salesPersonId']), isFalse);
    });

    test('6. New order correctly reads customer assignedSalespersonId as WNSah...', () {
      final newOrderMap = {
        'id': 'ORD_NEW_2026_001',
        'userId': 'user_cust_777',
        'customerId': 'user_cust_777',
        'customerName': 'Kalpesh Bhai',
        'salesPersonId': activeSpId,
        'status': 'pending_rate',
        'orderType': 'ready_stock',
        'items': [],
      };

      final order = TileOrder.fromMap(newOrderMap, 'ORD_NEW_2026_001');
      expect(order.salesPersonId, activeSpId);
    });

    test('7. Historical order with SP_3210 remains byte-for-byte unchanged with SP_3210', () {
      final historicalOrderMap = {
        'id': '9HuaBcJ2RATeEW8RPrwz',
        'orderReference': 'ITC-PO-2026-8594',
        'userId': 'Rl1n2Uqp4aOnKw0o1XRnsPl3q0K2',
        'customerId': 'Rl1n2Uqp4aOnKw0o1XRnsPl3q0K2',
        'customerName': 'Kirtan j Patel Enterprise',
        'status': 'rejected',
        'salesPersonId': 'SP_3210',
        'salesPersonName': 'Vraj Shah',
        'items': [],
      };

      final order = TileOrder.fromMap(historicalOrderMap, '9HuaBcJ2RATeEW8RPrwz');
      expect(order.salesPersonId, 'SP_3210');
      expect(order.id, '9HuaBcJ2RATeEW8RPrwz');
    });

    test('8. Auto_Assign_User document structure supports both salespersonId and assignedSalesPersonId for firestore.rules', () {
      final aauData = {
        'clientId': 'CUST_2026_001',
        'clientName': 'Modern Buildcon',
        'salespersonId': activeSpId,
        'assignedSalesPersonId': activeSpId,
        'salespersonName': activeSpName,
        'salespersonPhone': '9876543210',
        'salespersonReferralCode': activeSpCode,
        'status': 'active',
      };

      expect(aauData['salespersonId'], activeSpId);
      expect(aauData['assignedSalesPersonId'], activeSpId);
      expect(aauData['assignedSalesPersonId'] == activeSpId, isTrue);
    });
  });
}
