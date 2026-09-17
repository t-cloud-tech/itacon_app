import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// An attractive search bar widget featuring a subtle, rotating theme-blue border beam
/// that continuously revolves around the border and automatically fades/hides when
/// the user clicks or focuses on the search bar, with an elevated parallax transition
/// translating somewhat upwards.
class AppRevolvingBorderSearchBar extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final String hintText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onClear;
  final ValueChanged<bool>? onFocusChanged;
  final Color beamColor;
  final Color baseBorderColor;
  final Color fillColor;
  final double borderRadius;
  final double borderWidth;
  final Duration rotationDuration;
  final bool autoFocus;
  final double parallaxLift;

  const AppRevolvingBorderSearchBar({
    super.key,
    required this.controller,
    this.focusNode,
    this.hintText = 'Search tiles by name, size, surface, color...',
    this.onChanged,
    this.onSubmitted,
    this.onClear,
    this.onFocusChanged,
    this.beamColor = const Color(0xFF1E56A0), // Premium Theme Blue Accent
    this.baseBorderColor = const Color(0xFFE2E8F0),
    this.fillColor = const Color(0xFFF4F7FC),
    this.borderRadius = 10.0,
    this.borderWidth = 1.5,
    this.rotationDuration = const Duration(milliseconds: 3500),
    this.autoFocus = false,
    this.parallaxLift = 0.0,
  });

  @override
  State<AppRevolvingBorderSearchBar> createState() =>
      _AppRevolvingBorderSearchBarState();
}

class _AppRevolvingBorderSearchBarState
    extends State<AppRevolvingBorderSearchBar>
    with TickerProviderStateMixin {
  late final AnimationController _animController;
  late final AnimationController _focusAnimController;
  late final Animation<double> _focusAnimation;
  late final FocusNode _focusNode;
  bool _ownsFocusNode = false;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: widget.rotationDuration,
    )..repeat();

    _focusAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );

    _focusAnimation = CurvedAnimation(
      parent: _focusAnimController,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInOutCubic,
    );

    if (widget.focusNode != null) {
      _focusNode = widget.focusNode!;
    } else {
      _focusNode = FocusNode();
      _ownsFocusNode = true;
    }

    _isFocused = _focusNode.hasFocus;
    if (_isFocused) {
      _focusAnimController.value = 1.0;
    }
    _focusNode.addListener(_handleFocusChange);
  }

  void _handleFocusChange() {
    if (_isFocused != _focusNode.hasFocus) {
      setState(() {
        _isFocused = _focusNode.hasFocus;
      });
      if (_isFocused) {
        _focusAnimController.forward();
      } else {
        _focusAnimController.reverse();
      }
      if (widget.onFocusChanged != null) {
        widget.onFocusChanged!(_isFocused);
      }
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_handleFocusChange);
    if (_ownsFocusNode) {
      _focusNode.dispose();
    }
    _focusAnimController.dispose();
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([
        _animController,
        _focusAnimation,
        widget.controller,
      ]),
      builder: (context, _) {
        final hasText = widget.controller.text.isNotEmpty;
        final liftValue = _focusAnimation.value;

        return Transform.translate(
          // Smooth parallax vertical transition shifting somewhat upward on click / focus
          offset: Offset(0, widget.parallaxLift * liftValue),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(widget.borderRadius),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryNavy.withValues(
                    alpha: 0.04 + (0.10 * liftValue),
                  ),
                  blurRadius: 4.0 + (12.0 * liftValue),
                  offset: Offset(0, 2.0 + (4.0 * liftValue)),
                ),
              ],
            ),
            child: RepaintBoundary(
              child: CustomPaint(
                foregroundPainter: _RevolvingBorderPainter(
                  animationValue: _animController.value,
                  focusProgress: liftValue,
                  beamColor: widget.beamColor,
                  baseBorderColor: widget.baseBorderColor,
                  borderWidth: widget.borderWidth,
                  borderRadius: widget.borderRadius,
                ),
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focusNode,
                  autofocus: widget.autoFocus,
                  textInputAction: TextInputAction.search,
                  onChanged: widget.onChanged,
                  onSubmitted: widget.onSubmitted,
                  decoration: InputDecoration(
                    hintText: widget.hintText,
                    hintStyle: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade400,
                      fontWeight: FontWeight.w400,
                    ),
                    prefixIcon: const Icon(
                      Icons.search_rounded,
                      color: AppTheme.primaryNavy,
                      size: 20,
                    ),
                    suffixIcon: hasText
                        ? IconButton(
                            icon: const Icon(
                              Icons.clear_rounded,
                              size: 18,
                              color: Colors.grey,
                            ),
                            onPressed: () {
                              widget.controller.clear();
                              if (widget.onClear != null) {
                                widget.onClear!();
                              }
                              if (widget.onChanged != null) {
                                widget.onChanged!('');
                              }
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(
                      vertical: 8,
                      horizontal: 12,
                    ),
                    filled: true,
                    fillColor: widget.fillColor,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(widget.borderRadius),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(widget.borderRadius),
                      borderSide: const BorderSide(
                        color: AppTheme.primaryNavy,
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _RevolvingBorderPainter extends CustomPainter {
  final double animationValue; // 0.0 to 1.0
  final double focusProgress; // 0.0 (idle) to 1.0 (focused)
  final Color beamColor;
  final Color baseBorderColor;
  final double borderWidth;
  final double borderRadius;

  _RevolvingBorderPainter({
    required this.animationValue,
    required this.focusProgress,
    required this.beamColor,
    required this.baseBorderColor,
    required this.borderWidth,
    required this.borderRadius,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // When fully focused, the revolving beam and base custom border are hidden
    if (focusProgress >= 1.0) return;

    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(
      rect,
      Radius.circular(borderRadius),
    );

    final opacity = (1.0 - focusProgress).clamp(0.0, 1.0);

    // 1. Subtle static background border outline
    final basePaint = Paint()
      ..color = baseBorderColor.withValues(alpha: 0.8 * opacity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth;
    canvas.drawRRect(rrect, basePaint);

    // 2. Smooth, thin revolving theme blue beam using SweepGradient
    final angle = animationValue * 2 * math.pi;
    final sweepGradient = SweepGradient(
      center: Alignment.center,
      startAngle: 0.0,
      endAngle: 2 * math.pi,
      colors: [
        Colors.transparent,
        Colors.transparent,
        beamColor.withValues(alpha: 0.15 * opacity),
        beamColor.withValues(alpha: 0.7 * opacity),
        beamColor.withValues(alpha: 1.0 * opacity),
        beamColor.withValues(alpha: 0.5 * opacity),
        Colors.transparent,
      ],
      stops: const [
        0.0,
        0.65,
        0.78,
        0.88,
        0.94,
        0.98,
        1.0,
      ],
      transform: GradientRotation(angle),
    );

    final beamPaint = Paint()
      ..shader = sweepGradient.createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth + 0.4
      ..strokeCap = StrokeCap.round;

    canvas.drawRRect(rrect, beamPaint);
  }

  @override
  bool shouldRepaint(_RevolvingBorderPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue ||
        oldDelegate.focusProgress != focusProgress ||
        oldDelegate.beamColor != beamColor;
  }
}
