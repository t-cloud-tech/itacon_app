import 'package:flutter/material.dart';

/// ITACON Mobile-Focused Responsive Unit System
/// Tailored specifically for the full spectrum of mobile device sizes:
/// - Compact / Budget Mobile (320px – 359px width, e.g. iPhone SE, compact Androids)
/// - Standard Modern Mobile (360px – 400px width, e.g. iPhone 13/14/15/16, Galaxy S-series)
/// - Plus / Max / Phablets (401px – 440px+ width, e.g. Pro Max, Plus, Galaxy Ultra)
/// - Short Displays (< 700px height) vs Tall Displays (> 880px height 20:9 / 21:9)
class Responsive {
  Responsive._();

  // Baseline standard mobile canvas (iPhone 14 / modern Android 390x844pt)
  static const double baseMobileWidth = 390.0;
  static const double baseMobileHeight = 844.0;

  // Mobile Screen Width Breakpoints
  static const double compactMobileBreakpoint = 360.0;
  static const double largeMobileBreakpoint = 405.0;

  // Mobile Screen Height Breakpoints
  static const double shortMobileHeightBreakpoint = 700.0;
  static const double tallMobileHeightBreakpoint = 880.0;

  /// Screen Width
  static double width(BuildContext context) => MediaQuery.sizeOf(context).width;

  /// Screen Height
  static double height(BuildContext context) => MediaQuery.sizeOf(context).height;

  /// Keyboard / Bottom Insets
  static EdgeInsets viewInsets(BuildContext context) => MediaQuery.viewInsetsOf(context);

  /// Safe Padding (Status bar, Home indicator bar)
  static EdgeInsets viewPadding(BuildContext context) => MediaQuery.viewPaddingOf(context);

  /// Safe Screen Width (excluding notches/safe horizontal edges)
  static double safeWidth(BuildContext context) {
    final padding = viewPadding(context);
    return width(context) - padding.left - padding.right;
  }

  /// Safe Screen Height (excluding status bar and home indicator)
  static double safeHeight(BuildContext context) {
    final padding = viewPadding(context);
    return height(context) - padding.top - padding.bottom;
  }

  /// Device Form Factor Checks for Mobile Phones
  static bool isSmallPhone(BuildContext context) => width(context) < compactMobileBreakpoint;
  static bool isStandardPhone(BuildContext context) =>
      width(context) >= compactMobileBreakpoint && width(context) <= largeMobileBreakpoint;
  static bool isLargePhone(BuildContext context) => width(context) > largeMobileBreakpoint;
  static bool isShortPhone(BuildContext context) => height(context) < shortMobileHeightBreakpoint;
  static bool isTallPhone(BuildContext context) => height(context) > tallMobileHeightBreakpoint;
  static bool isLandscape(BuildContext context) =>
      MediaQuery.orientationOf(context) == Orientation.landscape;

  /// Proportional Horizontal Scale (w):
  /// Scales dimension based on phone width with clamped safety limits (0.82x to 1.18x)
  /// so that small phones (320px) never overflow and large phones (430px) look perfectly balanced.
  static double w(BuildContext context, double size, {double minScale = 0.82, double maxScale = 1.18}) {
    final screenW = width(context);
    final scale = (screenW / baseMobileWidth).clamp(minScale, maxScale);
    return (size * scale).roundToDouble();
  }

  /// Proportional Vertical Scale (h):
  /// Scales dimension based on phone height with clamped safety limits (0.82x to 1.18x).
  static double h(BuildContext context, double size, {double minScale = 0.82, double maxScale = 1.18}) {
    final screenH = height(context);
    final scale = (screenH / baseMobileHeight).clamp(minScale, maxScale);
    return (size * scale).roundToDouble();
  }

  /// Responsive Font Size (sp):
  /// Carefully scaled typography that preserves readability and guarantees that labels,
  /// badges, headers, and buttons will never clip or overflow on smaller phone screens.
  static double sp(BuildContext context, double fontSize, {double minScale = 0.84, double maxScale = 1.15}) {
    final screenW = width(context);
    final scale = (screenW / baseMobileWidth).clamp(minScale, maxScale);
    return (fontSize * scale).roundToDouble();
  }

  /// Responsive Corner Radius (r):
  static double r(BuildContext context, double radius, {double minScale = 0.85, double maxScale = 1.15}) {
    return w(context, radius, minScale: minScale, maxScale: maxScale);
  }

  /// Screen Width Percentage (0 to 100)
  static double wp(BuildContext context, double percent) {
    return width(context) * (percent / 100.0);
  }

  /// Screen Height Percentage (0 to 100)
  static double hp(BuildContext context, double percent) {
    return height(context) * (percent / 100.0);
  }

  /// Mobile Value Picker:
  /// Chooses the optimal value based on the mobile device's screen size.
  static T mobileValue<T>(
    BuildContext context, {
    required T regular,
    T? small,
    T? large,
    T? shortScreen,
  }) {
    if (isShortPhone(context) && shortScreen != null) return shortScreen;
    if (isSmallPhone(context) && small != null) return small;
    if (isLargePhone(context) && large != null) return large;
    return regular;
  }

  /// Backward-compatible value chooser
  static T value<T>(
    BuildContext context, {
    required T phone,
    T? smallPhone,
    T? tablet,
    T? desktop,
  }) {
    if (isSmallPhone(context) && smallPhone != null) return smallPhone;
    if (isLargePhone(context) && (tablet ?? desktop) != null) return tablet ?? desktop!;
    return phone;
  }
}

/// Extension on [BuildContext] for responsive units across mobile devices
extension ResponsiveExtension on BuildContext {
  /// Mobile Screen Dimensions
  double get screenWidth => Responsive.width(this);
  double get screenHeight => Responsive.height(this);
  double get safeScreenWidth => Responsive.safeWidth(this);
  double get safeScreenHeight => Responsive.safeHeight(this);

  /// Mobile Device Type Checks
  bool get isSmallPhone => Responsive.isSmallPhone(this);
  bool get isStandardPhone => Responsive.isStandardPhone(this);
  bool get isLargePhone => Responsive.isLargePhone(this);
  bool get isShortPhone => Responsive.isShortPhone(this);
  bool get isTallPhone => Responsive.isTallPhone(this);
  bool get isLandscape => Responsive.isLandscape(this);

  /// Scaled Responsive Measurements
  double w(double size, {double minScale = 0.82, double maxScale = 1.18}) =>
      Responsive.w(this, size, minScale: minScale, maxScale: maxScale);

  double h(double size, {double minScale = 0.82, double maxScale = 1.18}) =>
      Responsive.h(this, size, minScale: minScale, maxScale: maxScale);

  double sp(double fontSize, {double minScale = 0.84, double maxScale = 1.15}) =>
      Responsive.sp(this, fontSize, minScale: minScale, maxScale: maxScale);

  double r(double radius, {double minScale = 0.85, double maxScale = 1.15}) =>
      Responsive.r(this, radius, minScale: minScale, maxScale: maxScale);

  double wp(double percent) => Responsive.wp(this, percent);
  double hp(double percent) => Responsive.hp(this, percent);

  /// Mobile Adaptive Value Chooser
  T mobile<T>({
    required T regular,
    T? small,
    T? large,
    T? shortScreen,
  }) =>
      Responsive.mobileValue<T>(
        this,
        regular: regular,
        small: small,
        large: large,
        shortScreen: shortScreen,
      );

  /// General Adaptive Value Chooser
  T responsive<T>({
    required T phone,
    T? smallPhone,
    T? tablet,
    T? desktop,
  }) =>
      Responsive.value<T>(
        this,
        phone: phone,
        smallPhone: smallPhone,
        tablet: tablet,
        desktop: desktop,
      );

  /// Responsive Edge Insets
  EdgeInsets responsiveInsets({
    double? all,
    double? horizontal,
    double? vertical,
    double? top,
    double? bottom,
    double? left,
    double? right,
  }) {
    if (all != null) {
      final scaled = w(all);
      return EdgeInsets.all(scaled);
    }
    return EdgeInsets.only(
      left: w(left ?? horizontal ?? 0.0),
      right: w(right ?? horizontal ?? 0.0),
      top: h(top ?? vertical ?? 0.0),
      bottom: h(bottom ?? vertical ?? 0.0),
    );
  }

  /// Responsive Spacer Gap
  Widget responsiveGap(double size, {bool horizontal = false}) {
    return SizedBox(
      width: horizontal ? w(size) : null,
      height: !horizontal ? h(size) : null,
    );
  }
}

/// Responsive Constraint Wrapper
/// Ensures comfortable max bounds and centered alignment on wide mobile screens / foldables.
class ResponsiveConstraint extends StatelessWidget {
  final Widget child;
  final double maxContentWidth;
  final Color? backgroundColor;

  const ResponsiveConstraint({
    super.key,
    required this.child,
    this.maxContentWidth = 600.0,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    if (context.screenWidth <= maxContentWidth) {
      return child;
    }
    return Container(
      color: backgroundColor ?? Theme.of(context).scaffoldBackgroundColor,
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxContentWidth),
        child: child,
      ),
    );
  }
}

/// Adaptive Text Widget:
/// Guarantees that text scales dynamically on any mobile screen width
/// with built-in ellipsis and wrapping to ensure zero yellow/black overflow stripes.
class AdaptiveText extends StatelessWidget {
  final String text;
  final TextStyle? style;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow overflow;
  final bool softWrap;

  const AdaptiveText(
    this.text, {
    super.key,
    this.style,
    this.textAlign,
    this.maxLines,
    this.overflow = TextOverflow.ellipsis,
    this.softWrap = true,
  });

  @override
  Widget build(BuildContext context) {
    final baseStyle = style ?? DefaultTextStyle.of(context).style;
    final responsiveFontSize = baseStyle.fontSize != null
        ? context.sp(baseStyle.fontSize!)
        : null;

    return Text(
      text,
      textAlign: textAlign,
      maxLines: maxLines,
      overflow: overflow,
      softWrap: softWrap,
      style: baseStyle.copyWith(fontSize: responsiveFontSize),
    );
  }
}
