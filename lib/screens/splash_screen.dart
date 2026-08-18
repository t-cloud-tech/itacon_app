import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import 'auth_screen.dart';
import 'referral_gate_screen.dart';
import 'product_catalogue_screen.dart';

/// Splash loading screen displaying ITACON GRANITO luxury branding,
/// taglines, diagonal angled division, marble kitchen background,
/// and performing auto-routing based on authentication and verification state.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final AuthService _authService = AuthService();
  final FirestoreService _firestoreService = FirestoreService();

  @override
  void initState() {
    super.initState();
    _startSplashTimerAndRoute();
  }

  Future<void> _startSplashTimerAndRoute() async {
    final startTime = DateTime.now();
    Widget targetScreen = const AuthScreen();

    try {
      final currentUser = FirebaseAuth.instance.currentUser;
      final uid = _authService.currentUid ?? currentUser?.uid;

      if (uid != null && uid.isNotEmpty) {
        final profile = await _firestoreService.getUserProfile(uid);
        if (profile != null && profile.isVerified) {
          targetScreen = const ProductCatalogueScreen();
        } else if (profile != null && !profile.isVerified) {
          targetScreen = const ReferralGateScreen();
        } else {
          targetScreen = const AuthScreen();
        }
      } else {
        targetScreen = const AuthScreen();
      }
    } catch (e) {
      targetScreen = const AuthScreen();
    }

    final elapsedMs = DateTime.now().difference(startTime).inMilliseconds;
    final remainingMs = 3000 - elapsedMs;
    if (remainingMs > 0) {
      await Future.delayed(Duration(milliseconds: remainingMs));
    }

    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => targetScreen,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: animation,
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 600),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: const Color(0xFF0B1B36),
      body: Stack(
        children: [
          // 1. Bottom Section: High Quality Marble Kitchen Interior Photo
          Positioned.fill(
            child: Image.asset(
              'assets/images/splash_kitchen.jpg',
              fit: BoxFit.cover,
              alignment: Alignment.bottomCenter,
              errorBuilder: (context, error, stackTrace) {
                return Image.asset(
                  'assets/images/auth_bg.png',
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      Container(color: const Color(0xFF152642)),
                );
              },
            ),
          ),

          // 2. Top Section: Dark Navy Blue Angled Container
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: screenSize.height * 0.67,
            child: ClipPath(
              clipper: DiagonalPathClipper(),
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
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Spacer(flex: 2),

                        // ITACON GRANITO Branding Logo
                        _buildBrandingLogo(),

                        const SizedBox(height: 44),

                        // Tagline 1
                        const Text(
                          'Strength. Elegance. Timeless.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.6,
                            height: 1.2,
                          ),
                        ),

                        const SizedBox(height: 10),

                        // Tagline 2
                        Text(
                          'Premium Surfaces for Every Space.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 15,
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
        ],
      ),
    );
  }

  Widget _buildBrandingLogo() {
    return Image.asset(
      'assets/images/itacon-logo.png',
      width: 250,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) {
        return Image.asset(
          'assets/images/itacon_logo.png',
          width: 250,
          fit: BoxFit.contain,
        );
      },
    );
  }
}

/// Custom Clipper for the diagonal downward slope of the navy splash container
class DiagonalPathClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height * 0.84);
    path.lineTo(size.width, size.height);
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}


