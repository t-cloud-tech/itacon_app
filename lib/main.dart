import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'services/firestore_service.dart';
import 'models/user_category.dart';
import 'models/tile_product.dart';
import 'models/tile_order.dart';
import 'models/design_request.dart';
import 'firebase_options.dart';
import 'screens/auth_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    debugPrint('Firebase initialization note: $e');
  }
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ITACON CONNECT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1A237E),
          primary: const Color(0xFF1A237E),
        ),
        useMaterial3: true,
      ),
      home: const AuthScreen(),
    );
  }
}

class FirebaseTestScreen extends StatefulWidget {
  const FirebaseTestScreen({super.key});

  @override
  State<FirebaseTestScreen> createState() => _FirebaseTestScreenState();
}

class _FirebaseTestScreenState extends State<FirebaseTestScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final FirestoreService _firestoreService = FirestoreService();

  bool _isLoading = false;
  String? _statusMessage;

  // Data states
  Map<String, List<Map<String, dynamic>>> _groupedUserData = {};
  List<Map<String, dynamic>> _salespersonData = [];
  List<TileProduct> _tileCatalogue = [];
  List<TileOrder> _ordersList = [];
  List<DesignRequest> _designRequests = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _refreshAllDatabaseData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// Refresh all data from Cloud Firestore
  Future<void> _refreshAllDatabaseData() async {
    setState(() => _isLoading = true);
    try {
      final grouped = await _firestoreService.getUsersGroupedByCategory();
      final salespersons = await _firestoreService.getSalespersons();
      final tiles = await _firestoreService.getTilesCatalogueAdvanced();
      final userOrders =
          await _firestoreService.streamUserOrders('TEST_DEALER_01').first;
      final requests =
          await _firestoreService.getUserDesignRequests('TEST_DEALER_01');

      setState(() {
        _groupedUserData = grouped;
        _salespersonData = salespersons;
        _tileCatalogue = tiles;
        _ordersList = userOrders;
        _designRequests = requests;
      });
    } catch (e) {
      debugPrint('Error loading data: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Seed Users for All 5 Categories
  Future<void> _seedAllUserCategories() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      await _firestoreService.createUserProfile(
        uid: 'TEST_DEALER_01',
        phoneNumber: '+919876543201',
        fullName: 'Apex Ceramics Dealer',
        role: 'dealer',
        companyName: 'Apex Tiles & Sanitary',
        isVerified: true,
      );

      await _firestoreService.createUserProfile(
        uid: 'TEST_ARCHITECT_01',
        phoneNumber: '+919876543202',
        fullName: 'Ar. Priya Sharma',
        role: 'architect',
        companyName: 'Modern Space Designs',
        isVerified: true,
      );

      await _firestoreService.createUserProfile(
        uid: 'TEST_BUILDER_01',
        phoneNumber: '+919876543203',
        fullName: 'BuildCorp Infra',
        role: 'builder',
        companyName: 'BuildCorp Infrastructure Ltd',
        isVerified: true,
      );

      await _firestoreService.createUserProfile(
        uid: 'TEST_WHOLESALER_01',
        phoneNumber: '+919876543204',
        fullName: 'Gujarat Tile Distributors',
        role: 'wholesaler',
        companyName: 'Gujarat Wholesale Hub',
        isVerified: true,
      );

      await _firestoreService.createUserProfile(
        uid: 'TEST_RETAILER_01',
        phoneNumber: '+919876543205',
        fullName: 'City Tiles Retail',
        role: 'retailer',
        companyName: 'City Hardware & Tiles',
        isVerified: true,
      );

      await _refreshAllDatabaseData();
      setState(() {
        _statusMessage =
            '✅ Saved & verified all 5 User Categories in top-level Firestore collections (dealers, architects, builders, wholesalers, retailers)!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Seed Salesperson Data
  Future<void> _seedSalespersons() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      await _firestoreService.createSalespersonProfile(
        salespersonId: 'SP_EXE_001',
        fullName: 'Vikram Singh (Sales Executive)',
        phoneNumber: '+919900112233',
        referralCode: 'SALES101',
        employeeId: 'EMP-101',
        isActive: true,
      );

      await _refreshAllDatabaseData();
      setState(() {
        _statusMessage =
            '✅ Saved Salesperson in salespersons collection!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Seed Sample Tile Products Catalogue
  Future<void> _seedTileCatalogue() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      await _firestoreService.seedSampleTileProducts();
      await _refreshAllDatabaseData();
      setState(() {
        _statusMessage =
            '✅ Seeded ITACON Product Catalogue tiles (600x1200 Glossy, 800x1600 High Gloss, 1200x1800 Bookmatch, Oak Wood Planks)!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Simulate Complete Order Placement Lifecycle (Steps 5 -> 6 -> 7 -> 8 of PDF)
  Future<void> _simulateCompleteOrderFlow() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      // 1. Step 5: User places Purchase Order
      final order = await _firestoreService.placeOrder(
        userId: 'TEST_DEALER_01',
        userCategory: 'dealer',
        salespersonId: 'SP_EXE_001',
        orderType: 'ready_stock',
        deliveryAddress: 'Plot 42, GIDC Industrial Estate, Morbi, Gujarat',
        transportRequired: true,
        remarks: 'Please send in heavy wooden pallet packing',
        items: [
          const OrderItem(
            tileId: 'TILE_STATUARIO_01',
            tileName: 'Statuario Marble White',
            size: '600x1200',
            surface: 'High Gloss',
            quantity: 50,
            moq: 20,
          ),
          const OrderItem(
            tileId: 'TILE_CARVING_GREY_02',
            tileName: 'Armani Grey Carving',
            size: '800x1600',
            surface: 'Carving',
            quantity: 30,
            moq: 15,
          ),
        ],
      );

      // 2. Step 6: Salesperson reviews & submits unit prices & estimate
      final updatedItems = [
        const OrderItem(
          tileId: 'TILE_STATUARIO_01',
          tileName: 'Statuario Marble White',
          size: '600x1200',
          surface: 'High Gloss',
          quantity: 50,
          moq: 20,
          unitPrice: 62.0,
          totalPrice: 3100.0,
        ),
        const OrderItem(
          tileId: 'TILE_CARVING_GREY_02',
          tileName: 'Armani Grey Carving',
          size: '800x1600',
          surface: 'Carving',
          quantity: 30,
          moq: 15,
          unitPrice: 82.0,
          totalPrice: 2460.0,
        ),
      ];

      await _firestoreService.reviewOrderAndSubmitEstimate(
        orderId: order.id,
        updatedItems: updatedItems,
        discountPercent: 5.0,
        taxAmount: 500.0,
        salespersonNotes: 'Special dealer discount 5% applied by Sales Executive Vikram.',
      );

      // 3. Step 6/7: User confirms Estimate & Purchase Order
      await _firestoreService.confirmOrderWithEstimate(orderId: order.id);

      // 4. Step 7/8: Release Order to Production Planner
      await _firestoreService.releaseToProductionPlanner(orderId: order.id);

      await _refreshAllDatabaseData();
      setState(() {
        _statusMessage =
            '✅ Order Placement Workflow Executed! Reference: ${order.orderReferenceNumber} -> Estimate Attached -> User Confirmed -> Released to Production Planner!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Simulate Custom Design Request Submission (Module 7)
  Future<void> _simulateDesignRequest() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      final request = DesignRequest(
        id: '',
        userId: 'TEST_DEALER_01',
        size: '1200x2400',
        color: 'Emerald Green Onyx',
        surface: 'High Gloss Polish',
        quantityRequirement: 100,
        remarks: 'Custom luxury hotel lobby design requirement.',
      );

      await _firestoreService.submitDesignRequest(request);
      await _refreshAllDatabaseData();

      setState(() {
        _statusMessage =
            '✅ Submitted Custom Design Request to Design Team collection!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ITACON Database Dashboard'),
        backgroundColor: const Color(0xFF1A237E),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refreshAllDatabaseData,
          )
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: const Color(0xFFFF8F00),
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.people), text: 'Users & Sales'),
            Tab(icon: Icon(Icons.grid_view), text: 'Products (Catalogue)'),
            Tab(icon: Icon(Icons.shopping_bag), text: 'Order Placement Workflow'),
            Tab(icon: Icon(Icons.design_services), text: 'Custom Design Requests'),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_statusMessage != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                color: _statusMessage!.contains('❌')
                    ? Colors.red.shade100
                    : Colors.green.shade100,
                child: Text(
                  _statusMessage!,
                  style: TextStyle(
                    color: _statusMessage!.contains('❌')
                        ? Colors.red.shade900
                        : Colors.green.shade900,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildUsersTab(),
                  _buildProductsTab(),
                  _buildOrdersTab(),
                  _buildDesignRequestsTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // TAB 1: USERS & SALESPERSONS
  // ===========================================================================
  Widget _buildUsersTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _seedAllUserCategories,
            icon: const Icon(Icons.category_rounded),
            label: const Text('Seed All 5 User Categories'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1A237E),
              foregroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _seedSalespersons,
            icon: const Icon(Icons.badge_rounded),
            label: const Text('Seed Salesperson Data'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF388E3C),
              foregroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          for (var category in UserCategory.allCategories) ...[
            Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '${category.label} (${category.id})',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A237E)),
                        ),
                        const Spacer(),
                        Text(
                          'Collection: ${category.id == 'architect' ? 'architects' : '${category.id}s'}',
                          style: const TextStyle(
                              fontSize: 11, color: Colors.grey),
                        ),
                      ],
                    ),
                    const Divider(),
                    if ((_groupedUserData[category.id] ?? []).isEmpty)
                      const Text('No records stored yet',
                          style: TextStyle(fontSize: 11, color: Colors.grey))
                    else
                      Column(
                        children: (_groupedUserData[category.id] ?? [])
                            .map((u) => ListTile(
                                  dense: true,
                                  title: Text(u['fullName'] ?? ''),
                                  subtitle: Text(
                                      'Firm: ${u['companyName']} | Phone: ${u['phoneNumber']}'),
                                ))
                            .toList(),
                      ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Card(
            color: Colors.green.shade50,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Salespersons Collection (salespersons)',
                      style: TextStyle(
                          fontWeight: FontWeight.bold, color: Colors.green)),
                  const Divider(),
                  if (_salespersonData.isEmpty)
                    const Text('No Salesperson records stored yet',
                        style: TextStyle(fontSize: 11, color: Colors.grey))
                  else
                    Column(
                      children: _salespersonData
                          .map((sp) => ListTile(
                                dense: true,
                                title: Text(sp['fullName'] ?? ''),
                                subtitle: Text(
                                    'Code: ${sp['referralCode']} | Phone: ${sp['phoneNumber']}'),
                              ))
                          .toList(),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 2: PRODUCTS CATALOGUE
  // ===========================================================================
  Widget _buildProductsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _seedTileCatalogue,
            icon: const Icon(Icons.cloud_upload_rounded),
            label: const Text('Seed Sample Tile Products Catalogue'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1A237E),
              foregroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          Text('📦 Total Tiles in Catalogue: ${_tileCatalogue.length}',
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 10),
          for (var tile in _tileCatalogue)
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(tile.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 15)),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: tile.stockStatus == 'Available Now'
                                ? Colors.green.shade100
                                : Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            tile.stockStatus,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: tile.stockStatus == 'Available Now'
                                  ? Colors.green.shade900
                                  : Colors.amber.shade900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Size: ${tile.size} | Surface: ${tile.surface} | Base Color: ${tile.baseColor} | Pattern: ${tile.pattern}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    Text(
                      'MoQ: ${tile.moq} Boxes | Base Price: ₹${tile.basePrice} | Random Faces: ${tile.randomPattern}',
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 3: ORDER PLACEMENT WORKFLOW
  // ===========================================================================
  Widget _buildOrdersTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _simulateCompleteOrderFlow,
            icon: const Icon(Icons.play_circle_fill_rounded),
            label: const Text('Simulate Full Order Placement Lifecycle'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFF8F00),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 16),
          Text('📋 Orders Recorded: ${_ordersList.length}',
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 10),
          for (var order in _ordersList)
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.indigo.shade200)),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(order.orderReferenceNumber,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: Color(0xFF1A237E))),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.indigo.shade50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            order.status,
                            style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1A237E)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Order Type: ${order.orderType == 'ready_stock' ? 'Ready Stock' : 'Made Against Order'} | User Category: ${order.userCategory}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    Text(
                      'Delivery Address: ${order.deliveryAddress}',
                      style: const TextStyle(fontSize: 12),
                    ),
                    const Divider(),
                    const Text('Items:',
                        style: TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 12)),
                    for (var item in order.items)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2.0),
                        child: Row(
                          children: [
                            Text(
                                '• ${item.tileName} (${item.size}, ${item.surface}) x ${item.quantity} Qty'),
                            const Spacer(),
                            if (item.unitPrice != null)
                              Text('₹${item.unitPrice} / unit = ₹${item.totalPrice}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12))
                            else
                              const Text('Pending Estimate',
                                  style: TextStyle(
                                      color: Colors.orange, fontSize: 11)),
                          ],
                        ),
                      ),
                    if (order.estimateDetails['grandTotal'] != null &&
                        (order.estimateDetails['grandTotal'] as num) > 0) ...[
                      const Divider(),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Grand Total (Estimated):',
                              style: TextStyle(fontWeight: FontWeight.bold)),
                          Text(
                            '₹${order.estimateDetails['grandTotal']}',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: Colors.green),
                          ),
                        ],
                      ),
                    ]
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 4: CUSTOM DESIGN REQUESTS
  // ===========================================================================
  Widget _buildDesignRequestsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _simulateDesignRequest,
            icon: const Icon(Icons.add_photo_alternate_rounded),
            label: const Text('Submit Custom Design Request (Module 7)'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1A237E),
              foregroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          Text('🎨 Custom Design Requests: ${_designRequests.length}',
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 10),
          for (var req in _designRequests)
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                title: Text('${req.size} - ${req.color} (${req.surface})'),
                subtitle: Text(
                    'Qty: ${req.quantityRequirement} Boxes | Remarks: ${req.remarks}'),
                trailing: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(req.status,
                      style: const TextStyle(
                          fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
