import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/floating_bottom_bar.dart';
import '../utils/app_notification_utils.dart';
import 'home_screen.dart';
import 'product_listing_screen.dart';
import 'favorites_screen.dart';
import 'orders_screen.dart';
import 'profile_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  final int initialTab;

  const MainNavigationScreen({
    super.key,
    this.initialTab = 0,
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  late int _currentIndex;
  final GlobalKey<ScaffoldState> _homeScaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialTab;
  }

  void _onTabSelected(int index) {
    if (_homeScaffoldKey.currentState?.isDrawerOpen == true) {
      _homeScaffoldKey.currentState?.closeDrawer();
    }
    AppNotificationUtils.dismissAll(context);
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      HomeScreen(
        onNavigateTab: _onTabSelected,
        scaffoldKey: _homeScaffoldKey,
      ),
      const ProductListingScreen(
        subcategoryTitle: 'Products Collection',
        showBottomNavBar: false,
      ),
      const FavoritesScreen(),
      const OrdersScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: AppFloatingBottomBar(
        currentIndex: _currentIndex,
        onTap: _onTabSelected,
      ),
    );
  }
}
