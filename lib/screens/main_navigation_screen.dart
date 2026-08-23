import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../widgets/floating_bottom_bar.dart';
import 'home_screen.dart';
import 'categories_screen.dart';
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
  final AppStateService _appState = AppStateService();
  bool _isCapsule = false;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialTab;
  }

  void _onTabSelected(int index) {
    setState(() => _currentIndex = index);
  }

  bool _onScrollNotification(ScrollNotification notification) {
    if (notification.metrics.pixels <= 15) {
      if (_isCapsule) {
        setState(() => _isCapsule = false);
      }
    } else if (notification is ScrollUpdateNotification) {
      final delta = notification.scrollDelta;
      if (delta != null) {
        if (delta > 3 && !_isCapsule) {
          setState(() => _isCapsule = true);
        } else if (delta < -3 && _isCapsule) {
          setState(() => _isCapsule = false);
        }
      }
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      HomeScreen(onNavigateTab: _onTabSelected),
      const CategoriesScreen(),
      const FavoritesScreen(),
      const OrdersScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.backgroundColor,
      body: NotificationListener<ScrollNotification>(
        onNotification: _onScrollNotification,
        child: IndexedStack(
          index: _currentIndex,
          children: pages,
        ),
      ),
      bottomNavigationBar: ListenableBuilder(
        listenable: _appState,
        builder: (context, _) {
          return FloatingBottomBar(
            currentIndex: _currentIndex,
            isCapsule: _isCapsule,
            onTap: _onTabSelected,
            items: [
              const FloatingNavBarItem(
                icon: Icons.home_outlined,
                activeIcon: Icons.home_rounded,
                label: 'Home',
              ),
              const FloatingNavBarItem(
                icon: Icons.local_offer_outlined,
                activeIcon: Icons.local_offer_rounded,
                label: 'Products',
              ),
              FloatingNavBarItem(
                icon: Icons.favorite_outline_rounded,
                activeIcon: Icons.favorite_rounded,
                label: 'Favorites',
                badgeCount: _appState.favoritesCount,
              ),
              const FloatingNavBarItem(
                icon: Icons.inventory_2_outlined,
                activeIcon: Icons.inventory_2_rounded,
                label: 'Orders',
              ),
              const FloatingNavBarItem(
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
                label: 'Profile',
              ),
            ],
          );
        },
      ),
    );
  }
}

