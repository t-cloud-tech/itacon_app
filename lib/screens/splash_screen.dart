import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import 'auth_screen.dart';
import 'referral_gate_screen.dart';
import 'product_catalogue_screen.dart';

/// Lightweight, fast 2-second splash loading screen displaying ITACON TILES branding,
/// tagline, and performing auto-routing based on authentication and verification state.
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
    // 1. Run 3-second timer minimum delay
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
          // If profile does not exist yet in Firestore
          targetScreen = const AuthScreen();
        }
      } else {
        // Not logged in
        targetScreen = const AuthScreen();
      }
    } catch (e) {
      // On network/auth check error, default to AuthScreen
      targetScreen = const AuthScreen();
    }

    // Ensure at least 3 seconds elapsed for full 3-second splash experience
    final elapsedMs = DateTime.now().difference(startTime).inMilliseconds;
    final remainingMs = 3000 - elapsedMs;
    if (remainingMs > 0) {
      await Future.delayed(Duration(milliseconds: remainingMs));
    }

    if (!mounted) return;

    // 2. Perform smooth fade-in transition using Navigator.pushReplacement
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
    return Scaffold(
      backgroundColor: const Color(0xFF1A237E), // Brand color #1A237E
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),

            // Center Branding Container
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo Container with Amber/Gold Accent
                  Container(
                    width: 100,
                    height: 100,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF8F00), // Amber Gold Brand Accent
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                        BoxShadow(
                          color: const Color(0xFFFF8F00).withValues(alpha: 0.4),
                          blurRadius: 30,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.grid_view_rounded,
                      size: 60,
                      color: Color(0xFF1A237E),
                    ),
                  ),

                  const SizedBox(height: 28),

                  // Brand Title
                  const Text(
                    'ITACON TILES',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2.5,
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Brand Tagline
                  const Text(
                    'Premium Tiles & Architectural Solutions',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                      fontWeight: FontWeight.w400,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),

            const Spacer(),

            // Bottom Loading Indicator
            const Padding(
              padding: EdgeInsets.only(bottom: 40.0),
              child: Column(
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: Color(0xFFFF8F00),
                      strokeWidth: 2.5,
                    ),
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Loading ITACON Connect...',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 12,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
