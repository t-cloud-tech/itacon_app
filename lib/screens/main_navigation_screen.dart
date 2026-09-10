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
      ProductListingScreen(
        subcategoryTitle: 'Products Collection',
        showBottomNavBar: false,
        onBackToHome: () => _onTabSelected(0),
      ),
      FavoritesScreen(
        onBackToHome: () => _onTabSelected(0),
      ),
      OrdersScreen(
        onBackToHome: () => _onTabSelected(0),
      ),
      ProfileScreen(
        onBackToHome: () => _onTabSelected(0),
      ),
    ];

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: _SmoothFadeIndexedStack(
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

/// SmoothFadeIndexedStack preserves page state while animating transitions smoothly.
class _SmoothFadeIndexedStack extends StatelessWidget {
  final int index;
  final List<Widget> children;

  const _SmoothFadeIndexedStack({
    required this.index,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: List.generate(children.length, (i) {
        final isActive = i == index;
        return IgnorePointer(
          ignoring: !isActive,
          child: AnimatedOpacity(
            opacity: isActive ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeInOutCubic,
            child: children[i],
          ),
        );
      }),
    );
  }
}

