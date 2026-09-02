import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../screens/cart_screen.dart';

/// Centralized Production Notification Utility with Silky-Smooth Auto-Dismissal Animations
class AppNotificationUtils {
  static OverlayEntry? _currentOverlay;
  static GlobalKey<_SmoothFloatingToastState>? _toastKey;

  /// Displays a floating, luxury "Added to Cart" notification banner.
  /// Smoothly slides UP from below on entry, holds for 2.0s, and smoothly slides DOWNWARD out of view.
  static void showAddToCartSnackBar(
    BuildContext context, {
    required String productName,
    VoidCallback? onViewCartPressed,
  }) {
    dismissAll(context);

    OverlayState? overlay;
    try {
      overlay = Overlay.of(context, rootOverlay: true);
    } catch (_) {
      try {
        overlay = Overlay.of(context);
      } catch (_) {}
    }

    if (overlay == null) return;

    _toastKey = GlobalKey<_SmoothFloatingToastState>();

    _currentOverlay = OverlayEntry(
      builder: (overlayContext) {
        final bottomOffset = MediaQuery.of(overlayContext).viewInsets.bottom + 82.0;

        return _SmoothFloatingToast(
          key: _toastKey,
          bottomOffset: bottomOffset,
          displayDuration: const Duration(seconds: 2),
          onDismissed: () {
            _removeCurrentOverlayOnly();
          },
          child: Material(
            color: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.primaryNavy,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.accentOrange, width: 1),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppTheme.accentOrange,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 14,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '$productName added to cart!',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      _toastKey?.currentState?.dismissSmoothly();
                      if (onViewCartPressed != null) {
                        onViewCartPressed();
                      } else {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const CartScreen()),
                        );
                      }
                    },
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      child: Text(
                        'VIEW CART',
                        style: TextStyle(
                          color: AppTheme.accentOrange,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    overlay.insert(_currentOverlay!);
  }

  /// Displays a floating notification banner with smooth downward dismissal
  static void showNotification(
    BuildContext context, {
    required String message,
    bool isError = false,
    Duration duration = const Duration(seconds: 2),
  }) {
    dismissAll(context);

    OverlayState? overlay;
    try {
      overlay = Overlay.of(context, rootOverlay: true);
    } catch (_) {
      try {
        overlay = Overlay.of(context);
      } catch (_) {}
    }

    if (overlay == null) return;

    _toastKey = GlobalKey<_SmoothFloatingToastState>();

    _currentOverlay = OverlayEntry(
      builder: (overlayContext) {
        final bottomOffset = MediaQuery.of(overlayContext).viewInsets.bottom + 82.0;

        return _SmoothFloatingToast(
          key: _toastKey,
          bottomOffset: bottomOffset,
          displayDuration: duration,
          onDismissed: () {
            _removeCurrentOverlayOnly();
          },
          child: Material(
            color: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: isError ? AppTheme.statusError : AppTheme.primaryNavy,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Text(
                message,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        );
      },
    );

    overlay.insert(_currentOverlay!);
  }

  static void _removeCurrentOverlayOnly() {
    if (_currentOverlay != null) {
      try {
        _currentOverlay!.remove();
      } catch (_) {}
      _currentOverlay = null;
    }
    _toastKey = null;
  }

  /// Instantly clears active notifications when changing screens or tabs
  static void dismissAll(BuildContext context) {
    if (_toastKey?.currentState != null) {
      _toastKey!.currentState!.dismissSmoothly();
    } else {
      _removeCurrentOverlayOnly();
    }
    try {
      ScaffoldMessenger.of(context).clearSnackBars();
    } catch (_) {}
  }
}

class _SmoothFloatingToast extends StatefulWidget {
  final Widget child;
  final double bottomOffset;
  final Duration displayDuration;
  final VoidCallback onDismissed;

  const _SmoothFloatingToast({
    super.key,
    required this.child,
    required this.bottomOffset,
    required this.displayDuration,
    required this.onDismissed,
  });

  @override
  State<_SmoothFloatingToast> createState() => _SmoothFloatingToastState();
}

class _SmoothFloatingToastState extends State<_SmoothFloatingToast> {
  bool _isVisible = false;
  Timer? _holdTimer;
  Timer? _dismissTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          _isVisible = true;
        });
      }
    });

    _holdTimer = Timer(widget.displayDuration, () {
      dismissSmoothly();
    });
  }

  void dismissSmoothly() {
    _holdTimer?.cancel();
    if (!mounted) {
      widget.onDismissed();
      return;
    }

    setState(() {
      _isVisible = false;
    });

    _dismissTimer?.cancel();
    _dismissTimer = Timer(const Duration(milliseconds: 300), () {
      if (mounted) {
        widget.onDismissed();
      }
    });
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    _dismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: widget.bottomOffset,
      left: 16,
      right: 16,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 280),
        curve: _isVisible ? Curves.easeOut : Curves.easeIn,
        opacity: _isVisible ? 1.0 : 0.0,
        child: AnimatedSlide(
          duration: const Duration(milliseconds: 280),
          curve: _isVisible ? Curves.easeOutCubic : Curves.easeInCubic,
          offset: _isVisible ? Offset.zero : const Offset(0.0, 0.7),
          child: widget.child,
        ),
      ),
    );
  }
}
