import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_order.dart';

void main() {
  group('2-Way PO Quotation & State Machine Tests', () {
    test('Initial PO Order placement sets pending_rate and 0/null unit prices', () {
      final item = OrderItem(
        productId: 'TILE_001',
        productName: 'Armani Grey Carving',
        size: '800x1600',
        surface: 'Carving',
        quantity: 20,
        quantityBoxes: 20,
        quantitySqFt: 310.0,
        moq: 10,
        unitPrice: null,
        lineTotal: null,
      );

      final order = TileOrder(
        id: 'ORDER_TEST_01',
        orderReference: 'ITC-PO-2026-1001',
        userId: 'USER_123',
        userCategory: 'Dealer',
        status: 'pending_rate',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Industrial Ceramic Area, Morbi'},
        transportRequired: true,
        remarks: 'Handle with care',
        subtotal: 0.0,
        discount: 0.0,
        taxAmount: 0.0,
        totalAmount: 0.0,
        totalBoxes: 20,
        totalWeightKg: 560.0,
        totalWeightTons: 0.56,
        items: [item],
      );

      expect(order.status, equals('pending_rate'));
      expect(order.items.first.unitPrice, isNull);
      expect(order.items.first.lineTotal, isNull);
      expect(order.freightAmount, isNull);
      expect(order.totalAmount, equals(0.0));
    });

    test('Salesperson quoted rates calculate GST (18%) and total payable (no freight)', () {
      final quotedItem = OrderItem(
        productId: 'TILE_001',
        productName: 'Armani Grey Carving',
        size: '800x1600',
        surface: 'Carving',
        quantity: 20,
        quantityBoxes: 20,
        quantitySqFt: 310.0,
        moq: 10,
        unitPrice: 85.0, // ₹85/sq.ft
        lineTotal: 26350.0, // 310 * 85
      );

      double subtotal = 26350.0;
      double discount = 1350.0; // Applied discount
      double taxable = subtotal - discount; // 25000.0
      double taxAmount = taxable * 0.18; // 4500.0
      double totalAmount = taxable + taxAmount; // 29500.0

      final quotedOrder = TileOrder(
        id: 'ORDER_TEST_01',
        orderReference: 'ITC-PO-2026-1001',
        userId: 'USER_123',
        userCategory: 'Dealer',
        status: 'rate_quoted',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Industrial Ceramic Area, Morbi'},
        transportRequired: true,
        remarks: 'Handle with care',
        subtotal: subtotal,
        discount: discount,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        totalBoxes: 20,
        totalWeightTons: 0.56,
        items: [quotedItem],
      );

      expect(quotedOrder.status, equals('rate_quoted'));
      expect(quotedOrder.subtotal, equals(26350.0));
      expect(quotedOrder.taxAmount, equals(4500.0));
      expect(quotedOrder.totalAmount, equals(29500.0));
      expect(quotedOrder.freightAmount, isNull);
    });

    test('Customer confirmation transitions state to confirmed', () {
      final order = TileOrder(
        id: 'ORDER_TEST_01',
        orderReference: 'ITC-PO-2026-1001',
        userId: 'USER_123',
        userCategory: 'Dealer',
        status: 'rate_quoted',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Industrial Area'},
        transportRequired: true,
        remarks: '',
        items: [],
      );

      final confirmedOrder = order.copyWith(
        status: 'confirmed',
        confirmedAt: DateTime.now(),
      );

      expect(confirmedOrder.status, equals('confirmed'));
      expect(confirmedOrder.confirmedAt, isNotNull);
    });

    test('Customer tab stage separation: pending_rate belongs ONLY to Pending Quote', () {
      final order = TileOrder(
        id: 'ORDER_1228',
        orderReference: 'ITC-PO-2026-1228',
        userId: 'CUST_UID_001',
        customerName: 'Suresh Patel Tiles',
        userCategory: 'Dealer',
        status: 'pending_rate',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: 'Sample PO',
        items: [],
      );

      // Verify specific test case from requirements:
      // ITC-PO-2026-1228 with status pending_rate
      // History: NOT PRESENT
      // Pending Quote: PRESENT
      // Rates Quoted: NOT PRESENT
      // Confirmed: NOT PRESENT
      expect(order.isPendingQuoteStage, isTrue);
      expect(order.isHistoryStage, isFalse);
      expect(order.isRateQuotedStage, isFalse);
      expect(order.isConfirmedStage, isFalse);
    });

    test('Customer tab stage separation: rate_quoted belongs ONLY to Rates Quoted', () {
      final order = TileOrder(
        id: 'ORDER_QUOTED',
        orderReference: 'ITC-PO-2026-5501',
        userId: 'CUST_UID_001',
        customerName: 'Suresh Patel Tiles',
        userCategory: 'Dealer',
        status: 'rate_quoted',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: '',
        items: [],
      );

      expect(order.isRateQuotedStage, isTrue);
      expect(order.isHistoryStage, isFalse);
      expect(order.isPendingQuoteStage, isFalse);
      expect(order.isConfirmedStage, isFalse);
    });

    test('Customer tab stage separation: confirmed belongs ONLY to Confirmed', () {
      final order = TileOrder(
        id: 'ORDER_CONFIRMED',
        orderReference: 'ITC-PO-2026-7701',
        userId: 'CUST_UID_001',
        customerName: 'Suresh Patel Tiles',
        userCategory: 'Dealer',
        status: 'confirmed',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: '',
        items: [],
      );

      expect(order.isConfirmedStage, isTrue);
      expect(order.isHistoryStage, isFalse);
      expect(order.isPendingQuoteStage, isFalse);
      expect(order.isRateQuotedStage, isFalse);
    });

    test('Customer tab stage separation: delivered/completed belongs ONLY to History', () {
      final deliveredOrder = TileOrder(
        id: 'ORDER_DELIVERED',
        orderReference: 'ITC-PO-2026-9901',
        userId: 'CUST_UID_001',
        customerName: 'Suresh Patel Tiles',
        userCategory: 'Dealer',
        status: 'delivered',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: '',
        items: [],
      );

      expect(deliveredOrder.isHistoryStage, isTrue);
      expect(deliveredOrder.isConfirmedStage, isFalse);
      expect(deliveredOrder.isPendingQuoteStage, isFalse);
      expect(deliveredOrder.isRateQuotedStage, isFalse);

      final completedOrder = TileOrder(
        id: 'ORDER_COMPLETED',
        orderReference: 'ITC-PO-2026-9902',
        userId: 'CUST_UID_001',
        customerName: 'Suresh Patel Tiles',
        userCategory: 'Dealer',
        status: 'completed',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Morbi, Gujarat'},
        transportRequired: true,
        remarks: '',
        items: [],
      );

      expect(completedOrder.isHistoryStage, isTrue);
      expect(completedOrder.isConfirmedStage, isFalse);
      expect(completedOrder.isPendingQuoteStage, isFalse);
      expect(completedOrder.isRateQuotedStage, isFalse);
    });

    test('Customer identity snapshot and legacy order backwards-compatibility', () {
      // 1. Order with complete customer snapshot
      final newOrder = TileOrder(
        id: 'NEW_ORDER_01',
        orderReference: 'ITC-PO-2026-1234',
        userId: 'AUTH_UID_999',
        customerName: 'Apex Ceramics Morbi',
        customerPhone: '+919876543210',
        customerEmail: 'apex@example.com',
        userCategory: 'Wholesaler',
        status: 'pending_rate',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'National Highway 8A, Morbi'},
        transportRequired: true,
        remarks: '',
        items: [],
      );

      final map = newOrder.toMap();
      expect(map['userId'], equals('AUTH_UID_999'));
      expect(map['customerId'], equals('AUTH_UID_999'));
      expect(map['customerName'], equals('Apex Ceramics Morbi'));
      expect(map['customerPhone'], equals('+919876543210'));
      expect(map['customerEmail'], equals('apex@example.com'));

      final reconstructed = TileOrder.fromMap(map, 'NEW_ORDER_01');
      expect(reconstructed.customerName, equals('Apex Ceramics Morbi'));
      expect(reconstructed.customerPhone, equals('+919876543210'));
      expect(reconstructed.customerId, equals('AUTH_UID_999'));

      // 2. Legacy order without customerName / payment fields (safe handling)
      final legacyMap = <String, dynamic>{
        'userId': 'LEGACY_UID_111',
        'status': 'confirmed',
        'orderReference': 'ITC-PO-2025-0001',
        'totalAmount': 50000.0,
      };

      final legacyOrder = TileOrder.fromMap(legacyMap, 'LEGACY_DOC_01');
      expect(legacyOrder.userId, equals('LEGACY_UID_111'));
      expect(legacyOrder.customerName, equals('')); // Gracefully defaults without null crash
      expect(legacyOrder.customerPhone, isNull);
      expect(legacyOrder.paymentStatus, isNull);
      expect(legacyOrder.isPaid, isFalse);
    });

    test('Future payment compatibility fields serialize and deserialize correctly', () {
      final now = DateTime.now();
      final paidOrder = TileOrder(
        id: 'PAID_ORDER_01',
        orderReference: 'ITC-PO-2026-9999',
        userId: 'AUTH_UID_999',
        customerName: 'Apex Ceramics Morbi',
        userCategory: 'Dealer',
        status: 'completed',
        orderType: 'ready_stock',
        deliveryLocation: {'address': 'Morbi'},
        transportRequired: true,
        remarks: '',
        totalAmount: 118000.0,
        paymentStatus: 'paid',
        paidAmount: 118000.0,
        paymentId: 'PAY_GATEWAY_TXN_7890',
        paidAt: now,
        deliveredAt: now,
        items: [],
      );

      final map = paidOrder.toMap();
      expect(map['paymentStatus'], equals('paid'));
      expect(map['paidAmount'], equals(118000.0));
      expect(map['paymentId'], equals('PAY_GATEWAY_TXN_7890'));
      expect(map['paidAt'], isNotNull);
      expect(map['deliveredAt'], isNotNull);

      final parsed = TileOrder.fromMap(map, 'PAID_ORDER_01');
      expect(parsed.paymentStatus, equals('paid'));
      expect(parsed.paidAmount, equals(118000.0));
      expect(parsed.paymentId, equals('PAY_GATEWAY_TXN_7890'));
      expect(parsed.isPaid, isTrue);
      expect(parsed.isHistoryStage, isTrue);
    });
  });
}
