import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/screens/orders_screen.dart';

void main() {
  testWidgets('OrdersScreen displays correct tabs: History, Pending Quote, Rates Quoted, Confirmed',
      (WidgetTester tester) async {
    final streamController = StreamController<List<TileOrder>>.broadcast();

    await tester.pumpWidget(
      MaterialApp(
        home: OrdersScreen(
          ordersStream: streamController.stream,
        ),
      ),
    );

    streamController.add([]);
    await tester.pumpAndSettle();

    // Verify tabs
    expect(find.text('History'), findsOneWidget);
    expect(find.text('Pending Quote'), findsOneWidget);
    expect(find.text('Rates Quoted'), findsOneWidget);
    expect(find.text('Confirmed'), findsOneWidget);
    // Ensure 'All' tab no longer exists
    expect(find.text('All'), findsNothing);

    // Verify empty state for initial tab (History)
    expect(find.text('No completed orders yet'), findsOneWidget);

    await streamController.close();
  });

  testWidgets('ITC-PO-2026-1228 with pending_rate appears in Pending Quote ONLY, not in History',
      (WidgetTester tester) async {
    final streamController = StreamController<List<TileOrder>>.broadcast();

    final testOrder = TileOrder(
      id: 'ORDER_1228',
      orderReference: 'ITC-PO-2026-1228',
      userId: 'USER_CUST_1',
      customerName: 'Patel Marble & Tiles',
      userCategory: 'Dealer',
      status: 'pending_rate',
      orderType: 'ready_stock',
      deliveryLocation: {'address': 'Morbi, Gujarat'},
      transportRequired: true,
      remarks: 'Fast dispatch needed',
      items: [
        const OrderItem(
          productId: 'PROD_1',
          productName: 'Royal Onyx Marble',
          size: '600x1200',
          surface: 'High Gloss',
          quantity: 25,
          moq: 10,
        ),
      ],
      totalBoxes: 25,
      totalWeightTons: 0.7,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: OrdersScreen(
          ordersStream: streamController.stream,
        ),
      ),
    );

    streamController.add([testOrder]);
    await tester.pumpAndSettle();

    // Tab 0 is History: ITC-PO-2026-1228 MUST NOT BE PRESENT
    expect(find.text('ITC-PO-2026-1228'), findsNothing);
    expect(find.text('No completed orders yet'), findsOneWidget);

    // Switch to Tab 1: Pending Quote
    await tester.tap(find.text('Pending Quote'));
    await tester.pumpAndSettle();

    // In Pending Quote: ITC-PO-2026-1228 MUST BE PRESENT
    expect(find.text('ITC-PO-2026-1228'), findsOneWidget);
    expect(find.text('Awaiting Quote'), findsOneWidget);
    expect(find.text('Customer: Patel Marble & Tiles'), findsOneWidget);

    // Switch to Tab 2: Rates Quoted
    await tester.tap(find.text('Rates Quoted'));
    await tester.pumpAndSettle();

    // In Rates Quoted: MUST NOT BE PRESENT
    expect(find.text('ITC-PO-2026-1228'), findsNothing);
    expect(find.text('No Rates Quoted'), findsOneWidget);

    // Switch to Tab 3: Confirmed
    await tester.tap(find.text('Confirmed'));
    await tester.pumpAndSettle();

    // In Confirmed: MUST NOT BE PRESENT
    expect(find.text('ITC-PO-2026-1228'), findsNothing);
    expect(find.text('No Confirmed Orders'), findsOneWidget);

    await streamController.close();
  });

  testWidgets('Delivered/completed orders appear in History ONLY',
      (WidgetTester tester) async {
    final streamController = StreamController<List<TileOrder>>.broadcast();

    final completedOrder = TileOrder(
      id: 'ORDER_HIST_01',
      orderReference: 'ITC-PO-2026-8800',
      userId: 'USER_CUST_1',
      customerName: 'Patel Marble & Tiles',
      userCategory: 'Dealer',
      status: 'delivered',
      orderType: 'ready_stock',
      deliveryLocation: {'address': 'Morbi, Gujarat'},
      transportRequired: true,
      remarks: '',
      items: [
        const OrderItem(
          productId: 'PROD_2',
          productName: 'Glazed Vitrified Tile',
          size: '800x1600',
          surface: 'Glossy',
          quantity: 40,
          moq: 10,
        ),
      ],
      totalAmount: 48000.0,
      totalBoxes: 40,
      totalWeightTons: 1.12,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: OrdersScreen(
          ordersStream: streamController.stream,
        ),
      ),
    );

    streamController.add([completedOrder]);
    await tester.pumpAndSettle();

    // Tab 0 is History: Completed order MUST BE PRESENT
    expect(find.text('ITC-PO-2026-8800'), findsOneWidget);
    expect(find.text('Delivered'), findsOneWidget);

    // Switch to Tab 1: Pending Quote: MUST NOT BE PRESENT
    await tester.tap(find.text('Pending Quote'));
    await tester.pumpAndSettle();
    expect(find.text('ITC-PO-2026-8800'), findsNothing);

    // Switch to Tab 2: Rates Quoted: MUST NOT BE PRESENT
    await tester.tap(find.text('Rates Quoted'));
    await tester.pumpAndSettle();
    expect(find.text('ITC-PO-2026-8800'), findsNothing);

    // Switch to Tab 3: Confirmed: MUST NOT BE PRESENT
    await tester.tap(find.text('Confirmed'));
    await tester.pumpAndSettle();
    expect(find.text('ITC-PO-2026-8800'), findsNothing);

    await streamController.close();
  });

  testWidgets('Search filters within the selected tab independently',
      (WidgetTester tester) async {
    final streamController = StreamController<List<TileOrder>>.broadcast();

    final order1 = TileOrder(
      id: 'ORDER_PQ_1',
      orderReference: 'ITC-PO-2026-1111',
      userId: 'USER_CUST_1',
      customerName: 'Patel Marble',
      userCategory: 'Dealer',
      status: 'pending_rate',
      orderType: 'ready_stock',
      deliveryLocation: {'address': 'Morbi'},
      transportRequired: true,
      remarks: '',
      items: [
        const OrderItem(
          productId: 'P1',
          productName: 'Carving Armani Grey',
          size: '600x1200',
          surface: 'Carving',
          quantity: 10,
          moq: 10,
        ),
      ],
    );

    final order2 = TileOrder(
      id: 'ORDER_PQ_2',
      orderReference: 'ITC-PO-2026-2222',
      userId: 'USER_CUST_1',
      customerName: 'Shreeji Ceramics',
      userCategory: 'Dealer',
      status: 'pending_rate',
      orderType: 'ready_stock',
      deliveryLocation: {'address': 'Rajkot'},
      transportRequired: true,
      remarks: '',
      items: [
        const OrderItem(
          productId: 'P2',
          productName: 'Statuario White Gloss',
          size: '800x1600',
          surface: 'Glossy',
          quantity: 20,
          moq: 10,
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: OrdersScreen(
          ordersStream: streamController.stream,
        ),
      ),
    );

    streamController.add([order1, order2]);
    await tester.pumpAndSettle();

    // Switch to Pending Quote tab
    await tester.tap(find.text('Pending Quote'));
    await tester.pumpAndSettle();

    expect(find.text('ITC-PO-2026-1111'), findsOneWidget);
    expect(find.text('ITC-PO-2026-2222'), findsOneWidget);

    // Enter search query
    await tester.enterText(find.byType(TextField), 'Armani');
    await tester.pumpAndSettle();

    // Only order1 matches Armani
    expect(find.text('ITC-PO-2026-1111'), findsOneWidget);
    expect(find.text('ITC-PO-2026-2222'), findsNothing);

    // Clear search
    await tester.tap(find.byIcon(Icons.clear_rounded));
    await tester.pumpAndSettle();

    expect(find.text('ITC-PO-2026-1111'), findsOneWidget);
    expect(find.text('ITC-PO-2026-2222'), findsOneWidget);

    await streamController.close();
  });
}
