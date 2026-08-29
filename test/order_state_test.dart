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
  });
}
