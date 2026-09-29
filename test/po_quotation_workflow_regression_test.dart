import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_order.dart';

void main() {
  group('PO & Quotation Workflow Regression Tests', () {
    test('1. TileOrder parses legacy production order with quotedItems and no payment fields', () {
      final legacyMap = {
        'id': 'PROD_PO_9912',
        'orderReference': 'ITC-PO-2026-9912',
        'userId': 'cust_abc_123',
        'customerId': 'cust_abc_123',
        'customerName': 'Saurashtra Ceramic Hub',
        'userCategory': 'Wholesaler',
        'status': 'rate_quoted',
        'orderType': 'ready_stock',
        'deliveryLocation': {'address': 'Morbi, Gujarat'},
        'transportRequired': true,
        'remarks': 'Standard dispatch',
        'quotedItems': [
          {
            'productId': 'VIT-60120-001',
            'productName': 'Calacatta White Glossy',
            'size': '600x1200',
            'surface': 'Glossy',
            'quantity': 100,
            'quantityBoxes': 100,
            'moq': 50,
            'quotedUnitPrice': 450.0,
            'lineTotal': 45000.0,
          }
        ],
        'subtotal': 45000.0,
        'discount': 1000.0,
        'taxAmount': 7920.0,
        'totalAmount': 51920.0,
        'totalBoxes': 100,
        'salesPersonId': 'sp_rajesh_456',
        'salesPersonName': 'Rajesh Sharma',
        'quotationNumber': 'Q-2026-0042',
      };

      final order = TileOrder.fromMap(legacyMap, 'PROD_PO_9912');

      expect(order.id, 'PROD_PO_9912');
      expect(order.orderReference, 'ITC-PO-2026-9912');
      expect(order.items.length, 1);
      expect(order.items.first.productName, 'Calacatta White Glossy');
      expect(order.items.first.unitPrice, 450.0);
      expect(order.items.first.lineTotal, 45000.0);
      expect(order.subtotal, 45000.0);
      expect(order.discount, 1000.0);
      expect(order.taxAmount, 7920.0);
      expect(order.totalAmount, 51920.0);
      expect(order.isRateQuotedStage, isTrue);
      expect(order.paymentStatus, isNull);
      expect(order.paymentMethod, 'bank_transfer');
    });

    test('2. Stage mappings correctly handle all production quotation statuses', () {
      final statuses = [
        'pending_rate',
        'pending_salesperson_review',
        'pending_manager_approval',
        'awaiting_quote',
      ];

      for (final s in statuses) {
        final order = TileOrder(
          id: 'test_1',
          orderReference: 'REF_1',
          userId: 'user_1',
          userCategory: 'Dealer',
          deliveryLocation: const {'address': 'Morbi, Gujarat'},
          transportRequired: true,
          remarks: 'Urgent',
          status: s,
          orderType: 'ready_stock',
          items: const [],
          totalBoxes: 10,
        );
        expect(order.isPendingQuoteStage, isTrue, reason: 'Failed for status $s');
        expect(order.isRateQuotedStage, isFalse);
        expect(order.isConfirmedStage, isFalse);
      }

      final quotedStatuses = ['rate_quoted', 'quoted', 'rates_quoted'];
      for (final s in quotedStatuses) {
        final order = TileOrder(
          id: 'test_2',
          orderReference: 'REF_2',
          userId: 'user_1',
          userCategory: 'Dealer',
          deliveryLocation: const {'address': 'Morbi, Gujarat'},
          transportRequired: true,
          remarks: 'Urgent',
          status: s,
          orderType: 'ready_stock',
          items: const [],
          totalBoxes: 10,
        );
        expect(order.isRateQuotedStage, isTrue, reason: 'Failed for status $s');
      }

      final confirmedStatuses = ['confirmed', 'order_confirmed', 'payment_pending', 'advance_paid'];
      for (final s in confirmedStatuses) {
        final order = TileOrder(
          id: 'test_3',
          orderReference: 'REF_3',
          userId: 'user_1',
          userCategory: 'Dealer',
          deliveryLocation: const {'address': 'Morbi, Gujarat'},
          transportRequired: true,
          remarks: 'Urgent',
          status: s,
          orderType: 'ready_stock',
          items: const [],
          totalBoxes: 10,
        );
        expect(order.isConfirmedStage, isTrue, reason: 'Failed for status $s');
      }
    });

    test('3. Confirmed order with payment fields preserves all quotation & financial details', () {
      final fullOrder = TileOrder(
        id: 'ORDER_CONFIRMED_01',
        orderReference: 'ITC-PO-2026-5501',
        userId: 'USER_CUST_1',
        userCategory: 'Dealer',
        customerName: 'Gujarat Tile Mart',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Confirmed order',
        status: 'confirmed',
        orderType: 'ready_stock',
        subtotal: 100000.0,
        discount: 5000.0,
        taxAmount: 17100.0,
        totalAmount: 112100.0,
        totalBoxes: 200,
        paymentStatus: 'payment_due',
        paymentMethod: 'bank_transfer',
        items: [
          const OrderItem(
            productId: 'P1',
            productName: 'Morbi Marble 60x120',
            size: '600x1200',
            surface: 'High Gloss',
            quantity: 200,
            quantityBoxes: 200,
            moq: 10,
            unitPrice: 500.0,
            lineTotal: 100000.0,
          ),
        ],
      );

      final map = fullOrder.toMap();
      expect(map['totalAmount'], 112100.0);
      expect(map['subtotal'], 100000.0);
      expect(map['discount'], 5000.0);
      expect(map['taxAmount'], 17100.0);
      expect(map['paymentStatus'], 'payment_due');
      expect(map['status'], 'confirmed');
      expect(fullOrder.isConfirmedStage, isTrue);

      final deserialized = TileOrder.fromMap(map, 'ORDER_CONFIRMED_01');
      expect(deserialized.totalAmount, 112100.0);
      expect(deserialized.items.first.unitPrice, 500.0);
      expect(deserialized.paymentStatus, 'payment_due');
    });

    test('4. Price approval stage properties and transition indicators', () {
      final managerApprovalOrder = TileOrder(
        id: 'ORDER_DISCOUNT_REQ',
        orderReference: 'ITC-PO-2026-DISC',
        userId: 'CUST_DISC',
        userCategory: 'Architect',
        deliveryLocation: const {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Special project pricing',
        status: 'pending_manager_approval',
        orderType: 'ready_stock',
        items: const [],
        totalBoxes: 500,
      );

      expect(managerApprovalOrder.isPendingQuoteStage, isTrue);
      expect(managerApprovalOrder.status, 'pending_manager_approval');
    });
  });
}
