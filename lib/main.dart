import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'theme/app_theme.dart';
import 'services/firestore_service.dart';
import 'models/user_category.dart';
import 'models/tile_product.dart';
import 'models/tile_order.dart';
import 'models/estimate.dart';
import 'models/design_request.dart';
import 'firebase_options.dart';
import 'screens/splash_screen.dart';

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
      title: 'ITACON GRANITO',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.luxuryTheme,
      home: const SplashScreen(),
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
        stateCode: 'GJ',
        companyName: 'Apex Tiles & Sanitary',
        isVerified: true,
      );

      await _firestoreService.createUserProfile(
        uid: 'TEST_ARCHITECT_01',
        phoneNumber: '+919876543202',
        fullName: 'Ar. Priya Sharma',
        role: 'architect',
        stateCode: 'MH',
        companyName: 'Modern Space Designs',
        isVerified: true,
      );

      await _firestoreService.createUserProfile(
        uid: 'TEST_BUILDER_01',
        phoneNumber: '+919876543203',
        fullName: 'BuildCorp Infra',
        role: 'builder',
        stateCode: 'DL',
        companyName: 'BuildCorp Infrastructure Ltd',
        isVerified: true,
      );

      await _firestoreService.createUserProfile(
        uid: 'TEST_WHOLESALER_01',
        phoneNumber: '+919876543204',
        fullName: 'Gujarat Tile Distributors',
        role: 'wholesaler',
        stateCode: 'GJ',
        companyName: 'Gujarat Wholesale Hub',
        isVerified: true,
      );

      await _firestoreService.createUserProfile(
        uid: 'TEST_RETAILER_01',
        phoneNumber: '+919876543205',
        fullName: 'City Tiles Retail',
        role: 'retailer',
        stateCode: 'KA',
        companyName: 'City Hardware & Tiles',
        isVerified: true,
      );

      await _refreshAllDatabaseData();
      setState(() {
        _statusMessage =
            '✅ Saved & verified User Profiles in primary `users` collection and category collections (`dealers`, `architects`, `wholesalers`, etc.) matching PDF Schema!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

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
        _statusMessage = '✅ Saved Salesperson profile in `salesPersons` collection!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

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
            '✅ Seeded ITACON Catalogue into `products` and `categories` collections!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _simulateFullPdfDatabaseWorkflow() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      // Phase 1: Place PO Order
      final order = await _firestoreService.placeOrder(
        userId: 'TEST_DEALER_01',
        userCategory: 'dealer',
        stateCode: 'GJ',
        salespersonId: 'SP_EXE_001',
        orderType: 'ready_stock',
        deliveryAddress: 'Plot 42, GIDC Industrial Estate, Morbi, Gujarat',
        transportRequired: true,
        remarks: 'Please send in heavy wooden pallet packing',
        items: [
          const OrderItem(
            productId: 'TILE_STATUARIO_01',
            sku: 'ITA-STAT-6012',
            productName: 'Statuario Marble White',
            size: '600x1200',
            surface: 'High Gloss',
            color: 'White',
            quantity: 50,
            unit: 'box',
            moq: 20,
            basePrice: 65.0,
          ),
          const OrderItem(
            productId: 'TILE_CARVING_GREY_02',
            sku: 'ITA-CARV-8016',
            productName: 'Armani Grey Carving',
            size: '800x1600',
            surface: 'Carving',
            color: 'Grey',
            quantity: 30,
            unit: 'box',
            moq: 15,
            basePrice: 85.0,
          ),
        ],
      );

      // Phase 2: Price Approval Request & Estimate Creation
      await _firestoreService.submitPriceApproval(
        orderId: order.id,
        userId: 'TEST_DEALER_01',
        salespersonId: 'SP_EXE_001',
        originalTotal: 5800.0,
        requestedTotal: 5220.0,
        discountPercent: 10.0,
      );

      final estimate = await _firestoreService.createAndSendEstimate(
        orderId: order.id,
        customerId: 'TEST_DEALER_01',
        salesPersonId: 'SP_EXE_001',
        subtotal: 5800.0,
        discount: 580.0,
        tax: 522.0,
        items: [
          const EstimateItem(
            productId: 'TILE_STATUARIO_01',
            productName: 'Statuario Marble White',
            quantity: 50,
            unitPrice: 60.0,
            discount: 250.0,
          ),
          const EstimateItem(
            productId: 'TILE_CARVING_GREY_02',
            productName: 'Armani Grey Carving',
            quantity: 30,
            unitPrice: 80.0,
            discount: 330.0,
          ),
        ],
      );

      // Customer approves estimate
      await _firestoreService.confirmOrderEstimate(
        orderId: order.id,
        estimateId: estimate.estimateId,
      );

      // Phase 3: Production Handoff & Customer Loyalty Points Update
      await _firestoreService.createProductionHandoff(
        orderId: order.id,
        orderReference: order.orderReference,
        customerId: 'TEST_DEALER_01',
        salesPersonId: 'SP_EXE_001',
        handoffBy: 'SP_EXE_001',
        notes: 'Handed off for immediate dispatch from Morbi plant.',
      );

      await _firestoreService.updateCustomerLoyalty(
        userId: 'TEST_DEALER_01',
        orderId: order.id,
        pointsEarned: 100,
        orderTotal: 5742.0,
      );

      await _refreshAllDatabaseData();
      setState(() {
        _statusMessage =
            '✅ Complete PDF Workflow executed across Phase 1, Phase 2, and Phase 3 collections! `users`, `salesPersons`, `products`, `orders`, `estimates`, `notifications`, `handoffs`, `customerSummary`, `loyaltyTransactions` verified!';
      });
    } catch (e) {
      setState(() => _statusMessage = '❌ Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

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
        _statusMessage = '✅ Saved in `design_requests` collection!';
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
        title: const Text('ITACON Official PDF Schema Dashboard'),
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
            Tab(icon: Icon(Icons.grid_view), text: 'Products & Categories'),
            Tab(icon: Icon(Icons.shopping_bag), text: 'Phase 1, 2, 3 Workflow'),
            Tab(icon: Icon(Icons.design_services), text: 'Design Requests'),
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

  Widget _buildUsersTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _seedAllUserCategories,
            icon: const Icon(Icons.category_rounded),
            label: const Text('Seed Users (`users` & Category collections)'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1A237E),
              foregroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _seedSalespersons,
            icon: const Icon(Icons.badge_rounded),
            label: const Text('Seed Salespersons (`salesPersons` collection)'),
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
                        Expanded(
                          child: Text(
                            '${category.label} (${category.id})',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1A237E)),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
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
                                  title: Text(u['name'] ?? u['fullName'] ?? ''),
                                  subtitle: Text(
                                      'Firm: ${u['companyName']} | State: ${u['state']} | Phone: ${u['phone']}'),
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
                  const Text('salesPersons Collection',
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
                                title: Text(sp['name'] ?? sp['fullName'] ?? ''),
                                subtitle: Text(
                                    'Code: ${sp['referralCode']} | Phone: ${sp['phone']} | Region: ${sp['region']}'),
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

  Widget _buildProductsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _seedTileCatalogue,
            icon: const Icon(Icons.cloud_upload_rounded),
            label: const Text('Seed Products & Categories (`products`, `categories`)'),
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
                            color: tile.stockStatus == 'available' || tile.stockStatus == 'Available Now'
                                ? Colors.green.shade100
                                : Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            tile.stockStatus,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: tile.stockStatus == 'available' || tile.stockStatus == 'Available Now'
                                  ? Colors.green.shade900
                                  : Colors.amber.shade900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'SKU: ${tile.sku} | Size: ${tile.size} | Surface: ${tile.surface} | Color: ${tile.color} | Pattern: ${tile.pattern}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    Text(
                      'MoQ: ${tile.moq} ${tile.unit}s | Base Price: ₹${tile.basePrice} | Available Qty: ${tile.availableQuantity}',
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

  Widget _buildOrdersTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _simulateFullPdfDatabaseWorkflow,
            icon: const Icon(Icons.play_circle_fill_rounded),
            label: const Text('Simulate Full PDF Workflow (Phase 1, Phase 2, Phase 3)'),
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
                        Text(order.orderReference,
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
                      'State: ${order.stateCode} | Order Type: ${order.orderType} | Category: ${order.userCategory}',
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
                            Text('• ${item.productName} (${item.size}) x ${item.quantity} ${item.unit}s'),
                            const Spacer(),
                            Text('₹${item.finalPrice > 0 ? item.finalPrice : item.basePrice} / unit',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

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
