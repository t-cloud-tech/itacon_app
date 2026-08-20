import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../services/user_session_service.dart';
import '../screens/product_listing_screen.dart';
import '../screens/categories_screen.dart';
import '../screens/cart_screen.dart';
import '../screens/favorites_screen.dart';
import '../screens/orders_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/auth_screen.dart';

/// Luxury Side Navigation Drawer for ITACON GRANITO
class AppNavigationDrawer extends StatelessWidget {
  final Function(int)? onSelectTab;

  const AppNavigationDrawer({
    super.key,
    this.onSelectTab,
  });

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService.instance;

    return Drawer(
      backgroundColor: AppTheme.backgroundColor,
      elevation: 16,
      child: ListenableBuilder(
        listenable: appState,
        builder: (context, _) {
          final user = appState.currentUserProfile;
          final completionPct = appState.profileCompletionPercentage;

          return Column(
            children: [
              // 1. Luxury Profile Header Card
              Container(
                width: double.infinity,
                padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top + 20,
                  bottom: 20,
                  left: 20,
                  right: 20,
                ),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppTheme.primaryNavy, Color(0xFF1A3B6E)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        // Avatar Circle
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppTheme.accentOrange,
                            border: Border.all(color: Colors.white, width: 2),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.2),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            user.initials,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              if (user.companyName.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  user.companyName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.white.withOpacity(0.8),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 6),
                              // Category Badge Pill
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppTheme.accentOrange,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  user.userCategory.toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Profile Completion Bar
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white.withOpacity(0.15)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Profile Completion',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.white70,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              Text(
                                '$completionPct%',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.accentOrange,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: completionPct / 100.0,
                              minHeight: 4,
                              backgroundColor: Colors.white24,
                              valueColor: const AlwaysStoppedAnimation<Color>(
                                  AppTheme.accentOrange),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // 2. Navigation Menu List
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  children: [
                    _buildDrawerItem(
                      icon: Icons.home_rounded,
                      title: 'Home',
                      onTap: () {
                        Navigator.pop(context);
                        if (onSelectTab != null) onSelectTab!(0);
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.grid_view_rounded,
                      title: 'Products Catalogue',
                      onTap: () {
                        Navigator.pop(context);
                        if (onSelectTab != null) {
                          onSelectTab!(1);
                        } else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ProductListingScreen(),
                            ),
                          );
                        }
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.category_rounded,
                      title: 'Categories',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const CategoriesScreen(),
                          ),
                        );
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Master Collections',
                      subtitle: 'Marbles, Endless, 3D, Terrazzo',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ProductListingScreen(),
                          ),
                        );
                      },
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: Divider(color: AppTheme.borderSubtle),
                    ),
                    _buildDrawerItem(
                      icon: Icons.shopping_bag_outlined,
                      title: 'My Orders',
                      badgeCount: appState.ordersCount,
                      onTap: () {
                        Navigator.pop(context);
                        if (onSelectTab != null) {
                          onSelectTab!(3);
                        } else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const OrdersScreen(),
                            ),
                          );
                        }
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.favorite_outline_rounded,
                      title: 'Favorites',
                      badgeCount: appState.favoritesCount,
                      onTap: () {
                        Navigator.pop(context);
                        if (onSelectTab != null) {
                          onSelectTab!(2);
                        } else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const FavoritesScreen(),
                            ),
                          );
                        }
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.shopping_cart_outlined,
                      title: 'My Cart',
                      badgeCount: appState.cartCount,
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const CartScreen(),
                          ),
                        );
                      },
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: Divider(color: AppTheme.borderSubtle),
                    ),
                    _buildDrawerItem(
                      icon: Icons.person_outline_rounded,
                      title: 'My Profile & Settings',
                      onTap: () {
                        Navigator.pop(context);
                        if (onSelectTab != null) {
                          onSelectTab!(4);
                        } else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ProfileScreen(),
                            ),
                          );
                        }
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.headset_mic_outlined,
                      title: 'Contact Support',
                      onTap: () {
                        Navigator.pop(context);
                        _showSupportDialog(context);
                      },
                    ),
                  ],
                ),
              ),

              // 3. Bottom Log Out Section
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: AppTheme.borderSubtle),
                  ),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: TextButton.icon(
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.red,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      backgroundColor: Colors.red.withOpacity(0.06),
                    ),
                    icon: const Icon(Icons.logout_rounded, size: 20),
                    label: const Text(
                      'Log Out',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    onPressed: () async {
                      Navigator.pop(context);
                      await UserSessionService.clearUserSession();
                      if (context.mounted) {
                        Navigator.pushAndRemoveUntil(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const AuthScreen(
                              initialMode: AuthViewMode.login,
                            ),
                          ),
                          (route) => false,
                        );
                      }
                    },
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDrawerItem({
    required IconData icon,
    required String title,
    String? subtitle,
    int? badgeCount,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.primaryNavy, size: 22),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppTheme.textDark,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle,
              style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
            )
          : null,
      trailing: badgeCount != null && badgeCount > 0
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppTheme.accentOrange,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$badgeCount',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            )
          : const Icon(Icons.chevron_right_rounded,
              size: 18, color: AppTheme.textSubtle),
      onTap: onTap,
    );
  }

  void _showSupportDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.headset_mic_rounded, color: AppTheme.primaryNavy),
            SizedBox(width: 8),
            Text('ITACON Support', style: TextStyle(color: AppTheme.primaryNavy)),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Need assistance with your orders or tile inquiries?',
              style: TextStyle(fontSize: 14, color: AppTheme.textDark),
            ),
            SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.phone_rounded, size: 18, color: AppTheme.accentOrange),
                SizedBox(width: 8),
                Text('+91 98765 43210', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.email_rounded, size: 18, color: AppTheme.accentOrange),
                SizedBox(width: 8),
                Text('support@itacongranito.com', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close', style: TextStyle(color: AppTheme.primaryNavy)),
          ),
        ],
      ),
    );
  }
}
