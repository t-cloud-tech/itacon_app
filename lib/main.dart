import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'services/firestore_service.dart';
import 'models/user_category.dart';
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
      title: 'Itacon Tiles',
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

class _FirebaseTestScreenState extends State<FirebaseTestScreen> {
  final FirestoreService _firestoreService = FirestoreService();
  bool _isLoading = false;
  String? _statusMessage;
  Map<String, List<Map<String, dynamic>>> _groupedUserData = {};
  List<Map<String, dynamic>> _salespersonData = [];

  /// Batch store sample profiles for ALL User Categories category-wise in Firebase
  Future<void> _storeAllCategoriesInFirebase() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      // 1. Seed Dealer
      await _firestoreService.createUserProfile(
        uid: 'TEST_DEALER_01',
        phoneNumber: '+919876543201',
        fullName: 'Apex Ceramics Dealer',
        role: 'dealer',
        companyName: 'Apex Tiles & Sanitary',
        isVerified: true,
      );

      // 2. Seed Architect
      await _firestoreService.createUserProfile(
        uid: 'TEST_ARCHITECT_01',
        phoneNumber: '+919876543202',
        fullName: 'Ar. Priya Sharma',
        role: 'architect',
        companyName: 'Modern Space Designs',
        isVerified: true,
      );

      // 3. Seed Builder
      await _firestoreService.createUserProfile(
        uid: 'TEST_BUILDER_01',
        phoneNumber: '+919876543203',
        fullName: 'BuildCorp Infra',
        role: 'builder',
        companyName: 'BuildCorp Infrastructure Ltd',
        isVerified: true,
      );

      // 4. Seed Wholesaler
      await _firestoreService.createUserProfile(
        uid: 'TEST_WHOLESALER_01',
        phoneNumber: '+919876543204',
        fullName: 'Gujarat Tile Distributors',
        role: 'wholesaler',
        companyName: 'Gujarat Wholesale Hub',
        isVerified: true,
      );

      // 5. Seed Retailer
      await _firestoreService.createUserProfile(
        uid: 'TEST_RETAILER_01',
        phoneNumber: '+919876543205',
        fullName: 'City Tiles Retail',
        role: 'retailer',
        companyName: 'City Hardware & Tiles',
        isVerified: true,
      );

      await _fetchCategoryWiseDataFromFirebase();

      setState(() {
        _statusMessage =
            '✅ Successfully stored & verified all 5 User Categories (Dealer, Architect, Builder, Wholesaler, Retailer) in Firebase Database!';
      });
    } catch (e) {
      setState(() {
        _statusMessage = '❌ Error storing categories in Firebase: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// Store sample Salesperson data in the separate `salespersons` collection
  Future<void> _storeSalespersonDataInFirebase() async {
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

      await _firestoreService.createSalespersonProfile(
        salespersonId: 'SP_EXE_002',
        fullName: 'Ananya Mehta (Senior Executive)',
        phoneNumber: '+919900112244',
        referralCode: 'SALES102',
        employeeId: 'EMP-102',
        isActive: true,
      );

      await _fetchCategoryWiseDataFromFirebase();

      setState(() {
        _statusMessage =
            '✅ Successfully stored & verified Salesperson data in salespersons collection!';
      });
    } catch (e) {
      setState(() {
        _statusMessage = '❌ Error storing Salesperson data in Firebase: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// Fetch and group category-wise user profiles & salesperson data from Firebase
  Future<void> _fetchCategoryWiseDataFromFirebase() async {
    final grouped = await _firestoreService.getUsersGroupedByCategory();
    final salespersons = await _firestoreService.getSalespersons();

    setState(() {
      _groupedUserData = grouped;
      _salespersonData = salespersons;
    });
  }

  @override
  void initState() {
    super.initState();
    _fetchCategoryWiseDataFromFirebase();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Category-Wise Database Test'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(
              Icons.dashboard_customize_rounded,
              size: 56,
              color: Color(0xFF1A237E),
            ),
            const SizedBox(height: 12),
            const Text(
              'Category-Wise Firebase Data Storage',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'User Categories: Dealer, Architect, Builder, Wholesaler, Retailer\nSalesperson data stored in separate salespersons collection.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 20),

            // Action Buttons
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 10,
              children: [
                ElevatedButton.icon(
                  onPressed: _isLoading ? null : _storeAllCategoriesInFirebase,
                  icon: const Icon(Icons.category_rounded),
                  label: const Text('Store All User Categories'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1A237E),
                    foregroundColor: Colors.white,
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: _isLoading ? null : _storeSalespersonDataInFirebase,
                  icon: const Icon(Icons.badge_rounded),
                  label: const Text('Store Salesperson Data'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF388E3C),
                    foregroundColor: Colors.white,
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _isLoading ? null : _fetchCategoryWiseDataFromFirebase,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Refresh DB Data'),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (_statusMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _statusMessage!.contains('❌')
                      ? Colors.red.shade50
                      : Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: _statusMessage!.contains('❌')
                        ? Colors.red
                        : Colors.green,
                  ),
                ),
                child: Text(
                  _statusMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _statusMessage!.contains('❌')
                        ? Colors.red.shade900
                        : Colors.green.shade900,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // User Categories Data Visualizer
            const Text(
              '📦 Registered User Categories in Database:',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),

            for (var category in UserCategory.allCategories) ...[
              Card(
                elevation: 2,
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.folder_open_rounded,
                              color: Color(0xFF1A237E), size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${category.label} (${category.id})',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: Color(0xFF1A237E),
                                  ),
                                ),
                                Text(
                                  'Firestore Collection: ${category.id == 'architect' ? 'architects' : '${category.id}s'}',
                                  style: const TextStyle(
                                      fontSize: 10, color: Colors.grey),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.indigo.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '${(_groupedUserData[category.id] ?? []).length} Records',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.indigo.shade900,
                              ),
                            ),
                          ),
                        ],
                      ),

                      const Divider(),
                      if ((_groupedUserData[category.id] ?? []).isEmpty)
                        const Text(
                          'No documents stored for this category yet.',
                          style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                              fontStyle: FontStyle.italic),
                        )
                      else
                        Column(
                          children: (_groupedUserData[category.id] ?? [])
                              .map(
                                (user) => Container(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade100,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.person_outline,
                                          size: 18, color: Colors.black87),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '${user['fullName']} (${user['companyName'] ?? ''})',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 12),
                                            ),
                                            Text(
                                              'UID: ${user['uid']} | Phone: ${user['phoneNumber']}',
                                              style: const TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.grey),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 16),
            // Salespersons Visualizer (Separated)
            Card(
              elevation: 2,
              color: Colors.lightGreen.shade50,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.green.shade300),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.badge_rounded,
                            color: Color(0xFF2E7D32), size: 22),
                        const SizedBox(width: 8),
                        const Text(
                          'Salesperson Collection (Separate from User Categories)',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: Color(0xFF1B5E20),
                          ),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.green.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '${_salespersonData.length} Salespersons',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1B5E20),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(),
                    if (_salespersonData.isEmpty)
                      const Text(
                        'No Salesperson records stored yet. Click "Store Salesperson Data" to seed.',
                        style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                            fontStyle: FontStyle.italic),
                      )
                    else
                      Column(
                        children: _salespersonData
                            .map(
                              (sp) => Container(
                                margin: const EdgeInsets.only(bottom: 6),
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(8),
                                  border:
                                      Border.all(color: Colors.green.shade200),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.account_box_rounded,
                                        size: 20, color: Color(0xFF2E7D32)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${sp['fullName']} [${sp['employeeId'] ?? ''}]',
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12),
                                          ),
                                          Text(
                                            'Referral Code: ${sp['referralCode']} | Phone: ${sp['phoneNumber']}',
                                            style: const TextStyle(
                                                fontSize: 11,
                                                color: Colors.black87),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                            .toList(),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

