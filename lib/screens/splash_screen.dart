import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/user_session_service.dart';
import 'auth_screen.dart';
import 'main_navigation_screen.dart';

/// Luxury Splash Screen displaying ITACON GRANITO luxury branding,
/// smooth curved wave division, pre-cached high-resolution visual assets,
/// hardware-accelerated entrance animation, and seamless authentication routing.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  final AuthService _authService = AuthService();
  final FirestoreService _firestoreService = FirestoreService();

  late final AnimationController _animController;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;
  bool _assetsPrecached = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    final curvedAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(curvedAnimation);
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(curvedAnimation);

    _animController.forward();
    _startSplashTimerAndRoute();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_assetsPrecached) {
      _assetsPrecached = true;
      try {
        precacheImage(const AssetImage('assets/images/splash_img.jpg'), context);
        precacheImage(const AssetImage('assets/images/splash_kitchen.jpg'), context);
        precacheImage(const AssetImage('assets/images/itacon-logo-white.png'), context);
        precacheImage(const AssetImage('assets/images/itacon-logo.png'), context);
      } catch (_) {
        // Fallback gracefully if precache fails
      }
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _startSplashTimerAndRoute() async {
    final startTime = DateTime.now();
    Widget targetScreen = const AuthScreen();

    try {
      final restoredProfile = await UserSessionService.restoreUserSession();
      if (restoredProfile != null) {
        targetScreen = const MainNavigationScreen();
      } else {
        final currentUser = FirebaseAuth.instance.currentUser;
        final uid = _authService.currentUid ?? currentUser?.uid;

        if (uid != null && uid.isNotEmpty) {
          final profile = await _firestoreService.getUserProfile(uid);
          if (profile != null) {
            await UserSessionService.saveUserSession(profile);
            targetScreen = const MainNavigationScreen();
          } else {
            targetScreen = const AuthScreen();
          }
        } else {
          targetScreen = const AuthScreen();
        }
      }
    } catch (_) {
      targetScreen = const AuthScreen();
    }

    final elapsedMs = DateTime.now().difference(startTime).inMilliseconds;
    final remainingMs = 1800 - elapsedMs;
    if (remainingMs > 0) {
      await Future.delayed(Duration(milliseconds: remainingMs));
    }

    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => targetScreen,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeInOutCubic,
          );
          return FadeTransition(
            opacity: curved,
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 650),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: const Color(0xFF091528),
      body: Stack(
        children: [
          // 1. Bottom Section: Background Photo with Top Portion Visible
          Positioned.fill(
            top: screenSize.height * 0.22,
            child: Image.asset(
              'assets/images/splash_img.jpg',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
              filterQuality: FilterQuality.high,
              errorBuilder: (context, error, stackTrace) {
                return Image.asset(
                  'assets/images/splash_kitchen.jpg',
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                  filterQuality: FilterQuality.high,
                  errorBuilder: (context, error, stackTrace) =>
                      Container(color: const Color(0xFF152642)),
                );
              },
            ),
          ),

          // 2. Top Section: Dark Navy Blue Container with Curved Wave Clipper
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: screenSize.height * 0.67,
            child: ClipPath(
              clipper: CurvedWaveClipper(),
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0xFF091528),
                      Color(0xFF0D203D),
                      Color(0xFF0F2646),
                    ],
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: (screenSize.width * 0.06).clamp(16.0, 48.0),
                    ),
                    child: FadeTransition(
                      opacity: _fadeAnimation,
                      child: SlideTransition(
                        position: _slideAnimation,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Spacer(flex: 2),

                            // ITACON GRANITO Branding Logo (Relative units & locked aspect-ratio)
                            _buildBrandingLogo(screenSize),

                            SizedBox(
                              height: (screenSize.height * 0.038).clamp(14.0, 36.0),
                            ),

                            // Tagline 1
                            Text(
                              'Right Choice. Right Time. Right Value.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize:
                                    (screenSize.width * 0.046).clamp(16.0, 24.0),
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.6,
                                height: 1.2,
                              ),
                            ),

                            SizedBox(
                              height: (screenSize.height * 0.012).clamp(6.0, 14.0),
                            ),

                            // Tagline 2
                            Text(
                              'Premium Surfaces for Every Space.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.85),
                                fontSize:
                                    (screenSize.width * 0.036).clamp(13.0, 18.0),
                                fontWeight: FontWeight.w400,
                                letterSpacing: 0.4,
                              ),
                            ),

                            const Spacer(flex: 3),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBrandingLogo(Size screenSize) {
    // Relative width & height based on screen viewport dimensions
    final double relativeMaxWidth = (screenSize.width * 0.68).clamp(180.0, 500.0);
    final double relativeMaxHeight = (screenSize.height * 0.15).clamp(65.0, 180.0);

    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: relativeMaxWidth,
          maxHeight: relativeMaxHeight,
        ),
        child: AspectRatio(
          // Preserves natural brand logo proportions (1900x724 => ~2.624:1) with circular 'O'
          aspectRatio: 1900 / 724,
          child: Image.asset(
            'assets/images/itacon-logo-white.png',
            fit: BoxFit.contain,
            alignment: Alignment.center,
            filterQuality: FilterQuality.high,
            errorBuilder: (context, error, stackTrace) {
              return Image.asset(
                'assets/images/itacon-logo.png',
                fit: BoxFit.contain,
                alignment: Alignment.center,
                filterQuality: FilterQuality.high,
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Custom Clipper for a smooth elegant curved wave on the navy splash container
class CurvedWaveClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height * 0.72);

    // Smooth wave curve from left to right using cubic bezier
    final firstControlPoint = Offset(size.width * 0.35, size.height * 0.58);
    final secondControlPoint = Offset(size.width * 0.70, size.height * 0.96);
    final endPoint = Offset(size.width, size.height * 0.82);

    path.cubicTo(
      firstControlPoint.dx,
      firstControlPoint.dy,
      secondControlPoint.dx,
      secondControlPoint.dy,
      endPoint.dx,
      endPoint.dy,
    );

    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}
