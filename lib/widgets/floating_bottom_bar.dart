import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

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
  final bool isCapsule;

  const FloatingBottomBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
    this.isCapsule = false,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    const animationDuration = Duration(milliseconds: 320);
    const animationCurve = Curves.easeInOutCubic;

    return AnimatedContainer(
      duration: animationDuration,
      curve: animationCurve,
      padding: EdgeInsets.only(
        left: isCapsule ? 22 : 0,
        right: isCapsule ? 22 : 0,
        bottom: isCapsule
            ? (bottomPadding > 0 ? bottomPadding + 6 : 18)
            : 0,
        top: isCapsule ? 6 : 0,
      ),
      color: Colors.transparent,
      child: AnimatedContainer(
        duration: animationDuration,
        curve: animationCurve,
        height: isCapsule ? 64 : (66 + bottomPadding),
        padding: EdgeInsets.only(
          left: isCapsule ? 10 : 8,
          right: isCapsule ? 10 : 8,
          top: isCapsule ? 6 : 8,
          bottom: isCapsule ? 6 : (bottomPadding > 0 ? bottomPadding : 8),
        ),
        decoration: BoxDecoration(
          color: AppTheme.primaryNavy, // Brand Navy Blue
          borderRadius: isCapsule
              ? BorderRadius.circular(40)
              : const BorderRadius.vertical(top: Radius.circular(22)),
          border: Border.all(
            color: Colors.white.withValues(alpha: isCapsule ? 0.14 : 0.08),
            width: 1,
          ),
          boxShadow: isCapsule
              ? [
                  BoxShadow(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.5),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                    spreadRadius: 1,
                  ),
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : [
                  BoxShadow(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, -3),
                  ),
                ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: List.generate(items.length, (index) {
            final item = items[index];
            final isSelected = index == currentIndex;

            return Expanded(
              child: _NavBarItemWidget(
                item: item,
                isSelected: isSelected,
                isCapsule: isCapsule,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onTap(index);
                },
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _NavBarItemWidget extends StatelessWidget {
  final FloatingNavBarItem item;
  final bool isSelected;
  final bool isCapsule;
  final VoidCallback onTap;

  const _NavBarItemWidget({
    required this.item,
    required this.isSelected,
    required this.isCapsule,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Center(
        child: isCapsule
            ? _buildCapsuleModeItem()
            : _buildExpandedModeItem(),
      ),
    );
  }

  Widget _buildCapsuleModeItem() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOutCubic,
      width: isSelected ? 48 : 42,
      height: isSelected ? 48 : 42,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isSelected ? AppTheme.accentOrange : Colors.transparent,
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: AppTheme.accentOrange.withValues(alpha: 0.45),
                  blurRadius: 12,
                  offset: const Offset(0, 3),
                ),
              ]
            : null,
      ),
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          Icon(
            isSelected ? item.activeIcon : item.icon,
            size: isSelected ? 23 : 22,
            color: isSelected
                ? Colors.white
                : Colors.white.withValues(alpha: 0.65),
          ),
          if (item.badgeCount > 0)
            Positioned(
              top: isSelected ? 6 : 4,
              right: isSelected ? 6 : 4,
              child: _buildBadge(
                bgColor: isSelected ? Colors.white : AppTheme.accentOrange,
                textColor: isSelected ? AppTheme.accentOrange : Colors.white,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildExpandedModeItem() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: isSelected
                    ? AppTheme.accentOrange.withValues(alpha: 0.22)
                    : Colors.transparent,
              ),
              child: Icon(
                isSelected ? item.activeIcon : item.icon,
                size: 23,
                color: isSelected
                    ? AppTheme.accentOrange
                    : Colors.white.withValues(alpha: 0.65),
              ),
            ),
            if (item.badgeCount > 0)
              Positioned(
                top: -2,
                right: 4,
                child: _buildBadge(
                  bgColor: AppTheme.accentOrange,
                  textColor: Colors.white,
                ),
              ),
          ],
        ),
        const SizedBox(height: 2),
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 200),
          style: TextStyle(
            fontSize: 10,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected
                ? AppTheme.accentOrange
                : Colors.white.withValues(alpha: 0.65),
            fontFamily: 'Roboto',
          ),
          child: Text(
            item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildBadge({required Color bgColor, required Color textColor}) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
      ),
      constraints: const BoxConstraints(
        minWidth: 14,
        minHeight: 14,
      ),
      child: Text(
        '${item.badgeCount}',
        style: TextStyle(
          color: textColor,
          fontSize: 8,
          fontWeight: FontWeight.bold,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
