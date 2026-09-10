import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../screens/main_navigation_screen.dart';
import 'interactive_pressable.dart';

class FloatingNavBarItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int badgeCount;

  const FloatingNavBarItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    this.badgeCount = 0,
  });
}

class FloatingBottomBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<FloatingNavBarItem> items;

  const FloatingBottomBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        systemNavigationBarColor: AppTheme.primaryNavy,
        systemNavigationBarDividerColor: AppTheme.primaryNavy,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.primaryNavy,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(22),
          ),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primaryNavy.withValues(alpha: 0.35),
              blurRadius: 18,
              offset: const Offset(0, -4),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.16),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
          border: Border(
            top: BorderSide(
              color: Colors.white.withValues(alpha: 0.12),
              width: 1,
            ),
          ),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final totalWidth = constraints.maxWidth;
                final itemCount = items.length;
                if (itemCount == 0) return const SizedBox.shrink();

                final itemWidth = totalWidth / itemCount;
                final safeCurrentIndex = currentIndex.clamp(0, itemCount - 1);
                const pillWidth = 50.0;
                const pillHeight = 30.0;
                const pillTop = 9.0;
                final pillLeft =
                    safeCurrentIndex * itemWidth + (itemWidth - pillWidth) / 2;

                return Stack(
                  alignment: Alignment.centerLeft,
                  children: [
                    // Moving Orange Highlight Pill Indicator (around icon only)
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 480),
                      curve: Curves.easeInOutCubicEmphasized,
                      left: pillLeft,
                      top: pillTop,
                      width: pillWidth,
                      height: pillHeight,
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppTheme.accentOrange.withValues(alpha: 0.20),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: AppTheme.accentOrange.withValues(alpha: 0.35),
                            width: 1,
                          ),
                        ),
                      ),
                    ),

                    // Row of Nav Bar Items
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: List.generate(itemCount, (index) {
                        final item = items[index];
                        final isSelected = index == safeCurrentIndex;

                        return Expanded(
                          child: _NavBarItemWidget(
                            item: item,
                            isSelected: isSelected,
                            onTap: () {
                              HapticFeedback.selectionClick();
                              onTap(index);
                            },
                          ),
                        );
                      }),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// Standardized App Floating Bottom Navigation Bar
/// Works both standalone on pushed sub-screens and inside the main navigation controller.
class AppFloatingBottomBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int>? onTap;

  const AppFloatingBottomBar({
    super.key,
    this.currentIndex = 1,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        return FloatingBottomBar(
          currentIndex: currentIndex,
          onTap: (index) {
            if (onTap != null) {
              onTap!(index);
            } else {
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(
                  builder: (_) => MainNavigationScreen(initialTab: index),
                ),
                (route) => false,
              );
            }
          },
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
              badgeCount: appState.favoritesCount,
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
    );
  }
}

class _NavBarItemWidget extends StatelessWidget {
  final FloatingNavBarItem item;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavBarItemWidget({
    required this.item,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return AppPressable(
      onTap: onTap,
      scaleDown: 0.94,
      borderRadius: BorderRadius.circular(16),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              alignment: Alignment.center,
              clipBehavior: Clip.none,
              children: [
                SizedBox(
                  width: 50,
                  height: 30,
                  child: Center(
                    child: AnimatedScale(
                      scale: isSelected ? 1.15 : 1.0,
                      duration: const Duration(milliseconds: 400),
                      curve: Curves.easeOutBack,
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 320),
                        transitionBuilder: (child, anim) => ScaleTransition(
                          scale: CurvedAnimation(
                            parent: anim,
                            curve: Curves.easeInOutCubic,
                          ),
                          child: child,
                        ),
                        child: Icon(
                          isSelected ? item.activeIcon : item.icon,
                          key: ValueKey<bool>(isSelected),
                          size: 22,
                          color: isSelected
                              ? AppTheme.accentOrange
                              : Colors.white.withValues(alpha: 0.70),
                        ),
                      ),
                    ),
                  ),
                ),
                if (item.badgeCount > 0)
                  Positioned(
                    top: -3,
                    right: 2,
                    child: AnimatedScale(
                      scale: 1.0,
                      duration: const Duration(milliseconds: 320),
                      curve: Curves.easeOutBack,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 3.5,
                          vertical: 1.5,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.accentOrange,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: AppTheme.primaryNavy,
                            width: 1.2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color:
                                  AppTheme.accentOrange.withValues(alpha: 0.40),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 15,
                          minHeight: 15,
                        ),
                        child: Text(
                          item.badgeCount > 99 ? '99+' : '${item.badgeCount}',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 8.5,
                            fontWeight: FontWeight.w700,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 320),
              curve: Curves.easeInOutCubic,
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected
                    ? AppTheme.accentOrange
                    : Colors.white.withValues(alpha: 0.70),
                letterSpacing: 0.1,
              ),
              child: Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

