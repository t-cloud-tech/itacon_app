import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../models/user_profile.dart';
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
      child: NotificationListener<ScrollNotification>(
        onNotification: (notification) => true,
        child: ListenableBuilder(
          listenable: appState,
          builder: (context, _) {
            final user = appState.currentUserProfile;
            final completionPct = appState.profileCompletionPercentage;
            final filledCount = appState.profileFilledFieldsCount;
            final totalCount = appState.profileTotalFieldsCount;

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
                                color: Colors.black.withValues(alpha: 0.2),
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
                                    color: Colors.white.withValues(alpha: 0.8),
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
                    // Profile Completion Tracker
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Rounded Orange Progress Bar
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: LinearProgressIndicator(
                              value: completionPct / 100.0,
                              minHeight: 6,
                              backgroundColor:
                                  Colors.white.withValues(alpha: 0.22),
                              valueColor: const AlwaysStoppedAnimation<Color>(
                                AppTheme.accentOrange,
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          // Stats row: 60% and 6 / 10 data profile is filled in
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '$completionPct%',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                '$filledCount / $totalCount data profile is filled in',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white.withValues(alpha: 0.85),
                                ),
                              ),
                            ],
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
                        _safeCloseDrawerAndNavigate(context, () {
                          if (onSelectTab != null) onSelectTab!(0);
                        });
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.grid_view_rounded,
                      title: 'Products Catalogue',
                      onTap: () {
                        _safeCloseDrawerAndNavigate(context, () {
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
                        });
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.category_rounded,
                      title: 'Categories',
                      onTap: () {
                        _safeCloseDrawerAndNavigate(context, () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const CategoriesScreen(),
                            ),
                          );
                        });
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Master Collections',
                      subtitle: 'Marbles, Endless, 3D, Terrazzo',
                      onTap: () {
                        _safeCloseDrawerAndNavigate(context, () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ProductListingScreen(),
                            ),
                          );
                        });
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
                        _safeCloseDrawerAndNavigate(context, () {
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
                        });
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.favorite_outline_rounded,
                      title: 'Favorites',
                      badgeCount: appState.favoritesCount,
                      onTap: () {
                        _safeCloseDrawerAndNavigate(context, () {
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
                        });
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.shopping_cart_outlined,
                      title: 'My Cart',
                      badgeCount: appState.cartCount,
                      onTap: () {
                        _safeCloseDrawerAndNavigate(context, () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const CartScreen(),
                            ),
                          );
                        });
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
                        _safeCloseDrawerAndNavigate(context, () {
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
                        });
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.card_giftcard_rounded,
                      title: 'Refer & Earn',
                      subtitle: 'Invite partners & earn 500 pts',
                      onTap: () {
                        _safeCloseDrawerAndNavigate(context, () {
                          _showReferAndEarnModal(context, user);
                        });
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.stars_rounded,
                      title: 'Loyalty Benefits',
                      subtitle: 'Tier privileges & points',
                      onTap: () {
                        _safeCloseDrawerAndNavigate(context, () {
                          _showLoyaltyBenefitsModal(context, user);
                        });
                      },
                    ),
                    _buildDrawerItem(
                      icon: Icons.headset_mic_outlined,
                      title: 'Contact Support',
                      onTap: () {
                        _safeCloseDrawerAndNavigate(context, () {
                          _showSupportDialog(context);
                        });
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
                      backgroundColor: Colors.red.withValues(alpha: 0.06),
                    ),
                    icon: const Icon(Icons.logout_rounded, size: 20),
                    label: const Text(
                      'Log Out',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    onPressed: () => _performDirectLogout(context),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    ),
  );
}

  void _safeCloseDrawerAndNavigate(BuildContext context, VoidCallback action) {
    try {
      Scaffold.of(context).closeDrawer();
    } catch (_) {}
    if (Navigator.of(context, rootNavigator: false).canPop()) {
      Navigator.of(context, rootNavigator: false).pop();
    }
    action();
  }

  Widget _buildDrawerItem({
    required IconData icon,
    required String title,
    String? subtitle,
    int? badgeCount,
    Color? iconColor,
    Color? textColor,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: iconColor ?? AppTheme.primaryNavy, size: 22),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: textColor ?? AppTheme.textDark,
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

  Future<void> _performDirectLogout(BuildContext context) async {
    try {
      Scaffold.of(context).closeDrawer();
    } catch (_) {}
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

  void _showReferAndEarnModal(BuildContext context, UserProfile user) {
    final code = user.referralCode?.isNotEmpty == true
        ? user.referralCode!
        : 'ITA-${user.userId.isNotEmpty ? (user.userId.length > 6 ? user.userId.substring(0, 6).toUpperCase() : user.userId.toUpperCase()) : "PARTNER"}';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) => Container(
        height: MediaQuery.of(modalCtx).size.height * 0.78,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Handle Bar
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 16, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.card_giftcard_rounded,
                          color: AppTheme.accentOrange, size: 24),
                      SizedBox(width: 8),
                      Text(
                        'Refer & Earn',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryNavy,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded,
                        color: AppTheme.textSubtle),
                    onPressed: () => Navigator.pop(modalCtx),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppTheme.borderSubtle),

            // Scrollable Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Banner Hero Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppTheme.primaryNavy, Color(0xFF1E3A8A)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryNavy.withValues(alpha: 0.2),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.accentOrange,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'TRADE NETWORK REWARD',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Earn 500 Loyalty Points for Every Referral!',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              height: 1.25,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Invite fellow dealers, architects, contractors & builders to experience ITACON Granito.',
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Referral Code Box
                    const Text(
                      'Your Unique Referral Code',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppTheme.backgroundColor,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: AppTheme.accentOrange.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            code,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 2,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryNavy,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 8),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            icon: const Icon(Icons.copy_rounded, size: 14),
                            label: const Text(
                              'Copy',
                              style: TextStyle(fontSize: 12),
                            ),
                            onPressed: () {
                              Clipboard.setData(ClipboardData(text: code));
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                      'Referral Code copied to clipboard!'),
                                  backgroundColor: AppTheme.primaryNavy,
                                  duration: Duration(seconds: 2),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // 3 Steps
                    const Text(
                      'How It Works',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildStepRow(
                      number: '1',
                      title: 'Share your code',
                      description:
                          'Send your code to partners, contractors, or clients.',
                    ),
                    const SizedBox(height: 10),
                    _buildStepRow(
                      number: '2',
                      title: 'Partner registers',
                      description:
                          'They enter your code during onboarding or profile registration.',
                    ),
                    const SizedBox(height: 10),
                    _buildStepRow(
                      number: '3',
                      title: 'Both receive rewards',
                      description:
                          'Get 500 loyalty points credited automatically to your account.',
                    ),
                  ],
                ),
              ),
            ),

            // Bottom Action
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(
                  top: BorderSide(color: AppTheme.borderSubtle),
                ),
              ),
              child: SafeArea(
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.chat_bubble_rounded, size: 18),
                    label: const Text(
                      'Share Code via WhatsApp',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    onPressed: () {
                      Clipboard.setData(
                        ClipboardData(
                          text:
                              'Join ITACON Granito with my referral code $code to unlock exclusive trade partner prices and points!',
                        ),
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                              'Referral message copied! Open WhatsApp to share.'),
                          backgroundColor: Color(0xFF25D366),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showLoyaltyBenefitsModal(BuildContext context, UserProfile user) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) => Container(
        height: MediaQuery.of(modalCtx).size.height * 0.78,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Handle Bar
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 16, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.stars_rounded,
                          color: AppTheme.accentOrange, size: 24),
                      SizedBox(width: 8),
                      Text(
                        'Loyalty Benefits',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryNavy,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded,
                        color: AppTheme.textSubtle),
                    onPressed: () => Navigator.pop(modalCtx),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppTheme.borderSubtle),

            // Scrollable Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Member Tier Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppTheme.primaryNavy, Color(0xFF1E3A8A)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppTheme.accentOrange.withValues(alpha: 0.2),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppTheme.accentOrange
                                    .withValues(alpha: 0.5),
                              ),
                            ),
                            child: const Icon(Icons.stars_rounded,
                                color: AppTheme.accentOrange, size: 28),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'TRADE PARTNER LEVEL',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white60,
                                    letterSpacing: 1.1,
                                  ),
                                ),
                                Text(
                                  '${user.userCategory.toUpperCase()} TIER',
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Active Trade Status • Verified Member',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.white.withValues(alpha: 0.75),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    const Text(
                      'Your Exclusive Member Privileges',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                    const SizedBox(height: 12),

                    _buildBenefitTile(
                      icon: Icons.percent_rounded,
                      title: 'Direct Contract Pricing',
                      subtitle:
                          'Special discounted rates on all vitrified slab & tile collections.',
                    ),
                    const SizedBox(height: 10),
                    _buildBenefitTile(
                      icon: Icons.local_shipping_outlined,
                      title: 'Priority Dispatch Queue',
                      subtitle:
                          'Fast-track truck loading from Morbi factory warehouse.',
                    ),
                    const SizedBox(height: 10),
                    _buildBenefitTile(
                      icon: Icons.view_in_ar_rounded,
                      title: 'Complimentary 3D Renderings',
                      subtitle:
                          'Free realistic architectural tile simulations for your projects.',
                    ),
                    const SizedBox(height: 10),
                    _buildBenefitTile(
                      icon: Icons.support_agent_rounded,
                      title: 'Dedicated Account Manager',
                      subtitle:
                          'Direct hotline & WhatsApp desk for instant quotes and samples.',
                    ),
                    const SizedBox(height: 10),
                    _buildBenefitTile(
                      icon: Icons.redeem_rounded,
                      title: 'Points Redemption on Invoices',
                      subtitle:
                          'Use your accumulated loyalty points as instant checkout discounts.',
                    ),
                  ],
                ),
              ),
            ),

            // Bottom Action
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(
                  top: BorderSide(color: AppTheme.borderSubtle),
                ),
              ),
              child: SafeArea(
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryNavy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: () {
                      Navigator.pop(modalCtx);
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
                    child: const Text(
                      'View Profile & Tier Status',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepRow({
    required String number,
    required String title,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 12,
          backgroundColor: AppTheme.primaryNavy.withValues(alpha: 0.1),
          child: Text(
            number,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: AppTheme.primaryNavy,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppTheme.textSubtle,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildBenefitTile({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primaryNavy.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: AppTheme.primaryNavy, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textSubtle,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
