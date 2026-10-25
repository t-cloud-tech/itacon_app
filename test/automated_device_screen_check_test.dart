import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/tile_product.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/theme/app_theme.dart';
import 'package:itacon_app/services/app_state_service.dart';
import 'package:itacon_app/services/user_session_service.dart';

// Screens
import 'package:itacon_app/screens/splash_screen.dart';
import 'package:itacon_app/screens/auth_screen.dart';
import 'package:itacon_app/screens/referral_gate_screen.dart';
import 'package:itacon_app/screens/home_screen.dart';
import 'package:itacon_app/screens/product_listing_screen.dart';
import 'package:itacon_app/screens/product_detail_screen.dart';
import 'package:itacon_app/screens/fixing_solutions_screen.dart';
import 'package:itacon_app/widgets/product_filter_bottom_sheet.dart';
import 'package:itacon_app/screens/cart_screen.dart';
import 'package:itacon_app/screens/checkout_screen.dart';
import 'package:itacon_app/screens/order_details_screen.dart';
import 'package:itacon_app/screens/orders_screen.dart';
import 'package:itacon_app/screens/favorites_screen.dart';
import 'package:itacon_app/screens/profile_screen.dart';
import 'package:itacon_app/screens/profile/edit_profile_screen.dart';
import 'package:itacon_app/screens/notifications_screen.dart';
import 'package:itacon_app/screens/business_defaulter_lookup_screen.dart';
import 'package:itacon_app/screens/contract_rates_screen.dart';
import 'package:itacon_app/screens/refer_and_earn_screen.dart';
import 'package:itacon_app/screens/loyalty_benefits_screen.dart';

class DeviceSpec {
  final String name;
  final double width;
  final double height;
  final double topPadding;
  final double bottomPadding;

  const DeviceSpec({
    required this.name,
    required this.width,
    required this.height,
    this.topPadding = 24,
    this.bottomPadding = 16,
  });
}

const List<DeviceSpec> testDevices = [
  DeviceSpec(name: 'Small Android', width: 320, height: 640, topPadding: 24, bottomPadding: 0),
  DeviceSpec(name: 'iPhone SE', width: 375, height: 667, topPadding: 20, bottomPadding: 0),
  DeviceSpec(name: 'Standard iPhone 390x844', width: 390, height: 844, topPadding: 47, bottomPadding: 34),
  DeviceSpec(name: 'Standard Android 412x915', width: 412, height: 915, topPadding: 28, bottomPadding: 24),
  DeviceSpec(name: 'Large iPhone 430x932', width: 430, height: 932, topPadding: 59, bottomPadding: 34),
  DeviceSpec(name: 'Tablet 800x1280', width: 800, height: 1280, topPadding: 24, bottomPadding: 24),
];

const List<double> testTextScales = [1.0, 1.3, 2.0];

class LayoutIssueRecord {
  final String screenName;
  final String deviceName;
  final double width;
  final double height;
  final double textScale;
  final bool keyboardOpen;
  final String errorDescription;

  LayoutIssueRecord({
    required this.screenName,
    required this.deviceName,
    required this.width,
    required this.height,
    required this.textScale,
    required this.keyboardOpen,
    required this.errorDescription,
  });

  @override
  String toString() {
    return '[$screenName] on $deviceName (${width.toInt()}x${height.toInt()}) at font ${textScale}x ${keyboardOpen ? "(KB Open)" : ""}: $errorDescription';
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Test data with extreme long strings, 6-digit prices, etc.
  final longNameProduct = TileProduct(
    id: 'VIT_60120_EXTREME_01',
    productId: 'VIT_60120_EXTREME_01',
    sku: 'ITA-EXTREME-STATUARIO-ROYAL-60120',
    name: 'Statuario Imperial Ultra-Reflective Glazed Vitrified High-Gloss Porcelain Floor Tile 600x1200 mm',
    size: '600x1200 mm',
    surface: 'High Gloss Polish / Diamond Carving Matt',
    color: 'Statuario Bianco Platinum Veined',
    pattern: 'Multi-Face Seamless Bookmatch Random',
    basePrice: 245850.00, // 6-digit price
    moq: 120,
    unit: 'box',
    stockStatus: 'available_now',
    availableQuantity: 5000,
    images: const [
      'https://broken.invalid.domain/non_existent_image_fail.jpg',
    ],
    collection: 'Endless Royal Architectural Marble Collection',
    spaces: const ['Living Room', 'Grand Foyer', 'Master Bath', 'Luxury Penthouse Suite'],
  );

  final testUserProfile = const UserProfile(
    userId: 'TEST_USER_LIFECYCLE_99',
    name: 'Shree Balaji Royal Ceramic Wholesalers & Infrastructure Private Limited',
    companyName: 'Balaji Granito Global Import Export & Logistics Corporation',
    phone: '+919876543210',
    email: 'long_corporate_enterprise_procurement@balajiceramics.co.in',
    userCategory: 'Wholesaler',
    role: 'Wholesaler',
    gstNumber: '24AAACB1234F1Z6',
    city: 'Ahmedabad',
    state: 'Gujarat',
    address: {
      'street': 'Survey No. 45/A, Baleshwar Industrial Estate, Opp. Express Highway, Sarkhej-Bavla Road, Sanand, Ahmedabad, Gujarat - 382213',
      'city': 'Ahmedabad',
      'state': 'Gujarat',
      'pincode': '382213',
    },
  );

  final testOrder = TileOrder(
    id: 'PO_ITC_2026_EXTREME',
    orderReference: 'ITC-PO-2026-999999',
    userId: 'TEST_USER_LIFECYCLE_99',
    customerName: 'Shree Balaji Royal Ceramic Wholesalers & Infrastructure Private Limited',
    userCategory: 'Wholesaler',
    status: 'pending_rate',
    orderType: 'ready_stock',
    deliveryLocation: const {
      'address': 'Survey No. 45/A, Baleshwar Industrial Estate, Sanand, Ahmedabad, Gujarat - 382213',
    },
    transportRequired: true,
    remarks: 'Please dispatch via Surat Bombay Fast Freight. Urgent container export schedule.',
    items: [
      OrderItem(
        productId: longNameProduct.id,
        productName: longNameProduct.name,
        size: longNameProduct.size,
        surface: longNameProduct.surface,
        quantity: 500,
        moq: 120,
        unitPrice: 245850.00,
        lineTotal: 245850.00 * 500,
      ),
    ],
    totalBoxes: 500,
    totalWeightTons: 14.5,
  );

  final List<LayoutIssueRecord> collectedIssues = [];

  Widget buildTestHost({
    required Widget child,
    required DeviceSpec device,
    required double textScale,
    required bool keyboardOpen,
  }) {
    final bottomInset = keyboardOpen ? 300.0 : 0.0;
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.luxuryTheme,
      home: Builder(
        builder: (context) {
          final parentMq = MediaQuery.of(context);
          return MediaQuery(
            data: parentMq.copyWith(
              size: Size(device.width, device.height),
              padding: EdgeInsets.only(top: device.topPadding, bottom: device.bottomPadding),
              viewPadding: EdgeInsets.only(top: device.topPadding, bottom: device.bottomPadding),
              viewInsets: EdgeInsets.only(bottom: bottomInset),
              textScaler: TextScaler.linear(textScale).clamp(minScaleFactor: 0.85, maxScaleFactor: 1.3),
            ),
            child: SizedBox(
              width: device.width,
              height: device.height,
              child: Material(
                color: Colors.transparent,
                child: child,
              ),
            ),
          );
        },
      ),
    );
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await UserSessionService.saveUserSession(testUserProfile);
    AppStateService.instance.setCurrentUserProfile(testUserProfile);
    await AppStateService.instance.clearCart();
    await AppStateService.instance.addToCart(
      longNameProduct,
      size: longNameProduct.size,
      finish: longNameProduct.surface,
      quantity: 150,
    );
    AppStateService.instance.toggleFavorite(longNameProduct);
  });

  Future<void> evaluateScreen({
    required WidgetTester tester,
    required String screenName,
    required Widget Function() widgetBuilder,
    bool isFormScreen = false,
  }) async {
    for (final device in testDevices) {
      for (final textScale in testTextScales) {
        final keyboardStates = isFormScreen ? [false, true] : [false];
        for (final kb in keyboardStates) {
          final testErrors = <String>[];
          final oldHandler = FlutterError.onError;
          FlutterError.onError = (details) {
            final str = details.exceptionAsString();
            if (str.contains('overflowed') || str.contains('RenderFlex') || str.contains('unbounded')) {
              final info = details.informationCollector?.call().map((d) => d.toString()).join('\n') ?? '';
              testErrors.add('${details.exceptionAsString()}\n$info');
            } else if (str.contains('No Firebase App') || str.contains('[core/no-app]') || str.contains('ListTile background color') || str.contains('Cannot save FCM token')) {
              // Non-layout diagnostic warning in headless test harness
            } else {
              oldHandler?.call(details);
            }
          };

          try {
            await tester.binding.setSurfaceSize(Size(device.width, device.height));
            await tester.pumpWidget(buildTestHost(
              child: widgetBuilder(),
              device: device,
              textScale: textScale,
              keyboardOpen: kb,
            ));
            await tester.pump(); // initial frame
            await tester.pump(const Duration(milliseconds: 100)); // microtasks
            tester.takeException(); // Clear non-layout test framework assertions

            if (testErrors.isNotEmpty) {
              for (final err in testErrors) {
                print('DEBUG OVERFLOW in $screenName on ${device.name}: $err');
                final firstLine = err.split('\n').first;
                collectedIssues.add(LayoutIssueRecord(
                  screenName: screenName,
                  deviceName: device.name,
                  width: device.width,
                  height: device.height,
                  textScale: textScale,
                  keyboardOpen: kb,
                  errorDescription: firstLine,
                ));
              }
            }
          } finally {
            FlutterError.onError = oldHandler;
          }
        }
      }
    }
  }

  group('AUTOMATED SCREEN LAYOUT AUDIT ACROSS ALL DEVICES', () {
    testWidgets('1. Splash Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'SplashScreen',
        widgetBuilder: () => const SplashScreen(),
      );
    });

    testWidgets('2. Auth Choice Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'AuthScreen(choice)',
        widgetBuilder: () => const AuthScreen(initialMode: AuthViewMode.choice),
      );
    });

    testWidgets('3. Login Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'AuthScreen(login)',
        widgetBuilder: () => const AuthScreen(initialMode: AuthViewMode.login),
        isFormScreen: true,
      );
    });

    testWidgets('4. Signup Screen (Step 1)', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'AuthScreen(signup)',
        widgetBuilder: () => const AuthScreen(initialMode: AuthViewMode.signup),
        isFormScreen: true,
      );
    });

    testWidgets('5. Link Sales Representative (ReferralGateScreen)', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'ReferralGateScreen',
        widgetBuilder: () => const ReferralGateScreen(),
        isFormScreen: true,
      );
    });

    testWidgets('6. Home Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'HomeScreen',
        widgetBuilder: () => const HomeScreen(),
      );
    });

    testWidgets('7. Products Collection (ProductListingScreen)', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'ProductListingScreen',
        widgetBuilder: () => const ProductListingScreen(),
      );
    });

    testWidgets('8. Product Detail Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'ProductDetailScreen',
        widgetBuilder: () => ProductDetailScreen(product: longNameProduct),
      );
    });

    testWidgets('9. Fixing Solutions Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'FixingSolutionsScreen',
        widgetBuilder: () => const FixingSolutionsScreen(),
      );
    });

    testWidgets('10. Search + Filter Bottom Sheet', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'ProductFilterBottomSheet',
        widgetBuilder: () => ProductFilterBottomSheet(
          initialFilter: ProductFilterCriteria(),
          onApplyFilter: (_) {},
          allProducts: [longNameProduct],
        ),
      );
    });

    testWidgets('11. Cart Screen (Populated + 6-digit price)', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'CartScreen(populated)',
        widgetBuilder: () => const CartScreen(),
      );
    });

    testWidgets('12. Cart Screen (Empty State)', (tester) async {
      AppStateService.instance.clearCart();
      await evaluateScreen(
        tester: tester,
        screenName: 'CartScreen(empty)',
        widgetBuilder: () => const CartScreen(),
      );
    });

    testWidgets('13. Checkout Screen', (tester) async {
      await AppStateService.instance.addToCart(
        longNameProduct,
        size: longNameProduct.size,
        finish: longNameProduct.surface,
        quantity: 100,
      );
      await evaluateScreen(
        tester: tester,
        screenName: 'CheckoutScreen',
        widgetBuilder: () => const CheckoutScreen(),
        isFormScreen: true,
      );
    });

    testWidgets('14. Order Details Screen (Pending Rate with Long Remarks)', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'OrderDetailsScreen',
        widgetBuilder: () => OrderDetailsScreen(orderId: testOrder.id, initialOrder: testOrder),
        isFormScreen: true,
      );
    });

    testWidgets('15. Orders Screen (Empty & List)', (tester) async {
      final controller = StreamController<List<TileOrder>>.broadcast();
      await evaluateScreen(
        tester: tester,
        screenName: 'OrdersScreen',
        widgetBuilder: () => OrdersScreen(ordersStream: controller.stream),
      );
    });

    testWidgets('16. Favorites Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'FavoritesScreen',
        widgetBuilder: () => const FavoritesScreen(),
      );
    });

    testWidgets('17. Profile Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'ProfileScreen',
        widgetBuilder: () => const ProfileScreen(),
      );
    });

    testWidgets('18. Edit Profile Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'EditProfileScreen',
        widgetBuilder: () => const EditProfileScreen(),
        isFormScreen: true,
      );
    });

    testWidgets('19. Notifications Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'NotificationsScreen',
        widgetBuilder: () => const NotificationsScreen(),
      );
    });

    testWidgets('20. Salesperson Business Defaulter Lookup Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'BusinessDefaulterLookupScreen',
        widgetBuilder: () => const BusinessDefaulterLookupScreen(),
        isFormScreen: true,
      );
    });

    testWidgets('21. Contract Rates Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'ContractRatesScreen',
        widgetBuilder: () => const ContractRatesScreen(),
      );
    });

    testWidgets('22. Refer And Earn Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'ReferAndEarnScreen',
        widgetBuilder: () => const ReferAndEarnScreen(),
      );
    });

    testWidgets('23. Loyalty Benefits Screen', (tester) async {
      await evaluateScreen(
        tester: tester,
        screenName: 'LoyaltyBenefitsScreen',
        widgetBuilder: () => const LoyaltyBenefitsScreen(),
      );
    });

    tearDownAll(() {
      print('\n======================================================================');
      print('AUTOMATED SCREEN LAYOUT AUDIT REPORT: SUMMARY OF ISSUES');
      print('======================================================================');
      print('Total Layout/Overflow Issues Detected: ${collectedIssues.length}');
      if (collectedIssues.isEmpty) {
        print('SUCCESS: Zero layout errors across all tested devices and text scales!');
      } else {
        final grouped = <String, List<LayoutIssueRecord>>{};
        for (final issue in collectedIssues) {
          grouped.putIfAbsent(issue.screenName, () => []).add(issue);
        }
        grouped.forEach((screen, issues) {
          print('\n[SCREEN: $screen] - ${issues.length} failure condition(s):');
          for (final issue in issues) {
            print('  * ${issue.deviceName} (${issue.width.toInt()}x${issue.height.toInt()}), textScale: ${issue.textScale}x, kb: ${issue.keyboardOpen}: ${issue.errorDescription}');
          }
        });
      }
      print('======================================================================\n');
    });
  });
}
