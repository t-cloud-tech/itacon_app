import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/firestore_service.dart';
import '../services/user_session_service.dart';
import '../services/notification_service.dart';
import '../models/user_profile.dart';
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
  final FirestoreService _firestoreService = FirestoreService();

  late final AnimationController _animController;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;
  bool _assetsPrecached = false;
  bool _hasError = false;
  String? _errorMessage;
  bool _isRetrying = false;

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

    // 1. Purge any legacy fallback/guest session data immediately
    await UserSessionService.purgeLegacyFallbackData();

    // 2. Check Firebase Authentication state
    User? currentUser;
    try {
      if (Firebase.apps.isNotEmpty) {
        currentUser = FirebaseAuth.instance.currentUser;
        if (currentUser == null) {
          // Allow up to 800ms for Firebase Auth to restore its persisted token on cold boot
          try {
            currentUser = await FirebaseAuth.instance
                .authStateChanges()
                .first
                .timeout(const Duration(milliseconds: 800), onTimeout: () => null);
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 3. Restore active session from SharedPreferences
    final restoredProfile = await UserSessionService.restoreUserSession();

    final activeUid = currentUser?.uid ?? restoredProfile?.userId;

    // -------------------------------------------------------------------------
    // CASE B: No authenticated or logged-in user
    // -------------------------------------------------------------------------
    if (activeUid == null ||
        activeUid.isEmpty ||
        activeUid == 'GUEST_USER' ||
        activeUid == 'RESTORED_USER') {
      final elapsedMs = DateTime.now().difference(startTime).inMilliseconds;
      final remainingMs = 1800 - elapsedMs;
      if (remainingMs > 0) {
        await Future.delayed(Duration(milliseconds: remainingMs));
      }

      if (!mounted) return;
      _navigateToScreen(const AuthScreen(initialMode: AuthViewMode.login));
      return;
    }

    // -------------------------------------------------------------------------
    // CASE A: Authenticated / Logged-in customer exists
    // -------------------------------------------------------------------------
    final uid = activeUid;
    UserProfile? realProfile;
    bool isNetworkError = false;

    try {
      realProfile = await _firestoreService.getUserProfile(uid).timeout(
        const Duration(seconds: 8),
      );
    } catch (e) {
      isNetworkError = true;
      debugPrint('[SplashScreen] Profile fetch error/timeout for $uid: $e');
    }

    // Sub-case A.1: Real profile loaded successfully from Firestore
    if (realProfile != null) {
      if (realProfile.userId != 'GUEST_USER' && realProfile.name != 'Valued Partner') {
        await UserSessionService.saveUserSession(realProfile);
        await NotificationService.saveCurrentUserToken();

        final elapsedMs = DateTime.now().difference(startTime).inMilliseconds;
        final remainingMs = 1800 - elapsedMs;
        if (remainingMs > 0) {
          await Future.delayed(Duration(milliseconds: remainingMs));
        }

        if (!mounted) return;
        _navigateToScreen(const MainNavigationScreen());
        NotificationService.onAppReady();
        return;
      }
    }

    // Sub-case A.2: Valid local cached profile exists -> Continue seamlessly to main app!
    if (restoredProfile != null &&
        restoredProfile.userId == uid &&
        restoredProfile.userId != 'GUEST_USER' &&
        restoredProfile.name != 'Valued Partner' &&
        restoredProfile.name.isNotEmpty) {
      debugPrint('[SplashScreen] Using valid local session for customer $uid.');
      await NotificationService.saveCurrentUserToken();

      final elapsedMs = DateTime.now().difference(startTime).inMilliseconds;
      final remainingMs = 1800 - elapsedMs;
      if (remainingMs > 0) {
        await Future.delayed(Duration(milliseconds: remainingMs));
      }

      if (!mounted) return;
      _navigateToScreen(const MainNavigationScreen());
      NotificationService.onAppReady();
      return;
    }

    // Sub-case A.3: Query completed without network error, but profile document genuinely missing
    if (!isNetworkError && realProfile == null && restoredProfile == null) {
      debugPrint('[SplashScreen] User $uid has no Firestore profile. Redirecting to signup.');
      await UserSessionService.clearUserSession();

      final elapsedMs = DateTime.now().difference(startTime).inMilliseconds;
      final remainingMs = 1800 - elapsedMs;
      if (remainingMs > 0) {
        await Future.delayed(Duration(milliseconds: remainingMs));
      }

      if (!mounted) return;
      _navigateToScreen(const AuthScreen(initialMode: AuthViewMode.signup));
      return;
    }

    // If no valid cache exists for this UID and network failed:
    // Show error/retry state. DO NOT substitute "Valued Partner" and DO NOT enter main app.
    final elapsedMs = DateTime.now().difference(startTime).inMilliseconds;
    final remainingMs = 1200 - elapsedMs;
    if (remainingMs > 0) {
      await Future.delayed(Duration(milliseconds: remainingMs));
    }

    if (!mounted) return;
    setState(() {
      _hasError = true;
      _isRetrying = false;
      _errorMessage = 'Unable to connect to ITACON network.\nPlease check your connection and retry.';
    });
  }

  void _navigateToScreen(Widget targetScreen) {
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
            height: screenSize.height * (_hasError ? 0.82 : 0.67),
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
                              height: (screenSize.height * 0.032).clamp(12.0, 30.0),
                            ),

                            if (!_hasError) ...[
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
                            ] else ...[
                              _buildErrorRetryCard(screenSize),
                            ],

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

  Widget _buildErrorRetryCard(Size screenSize) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF152642).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE5A93C).withValues(alpha: 0.45),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.wifi_off_rounded,
            color: Color(0xFFE5A93C),
            size: 34,
          ),
          const SizedBox(height: 10),
          const Text(
            'Connection Delayed',
            style: TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _errorMessage ?? 'Unable to connect to ITACON network.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.82),
              fontSize: 12.5,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 42,
            child: ElevatedButton(
              onPressed: _isRetrying
                  ? null
                  : () {
                      setState(() {
                        _hasError = false;
                        _isRetrying = true;
                      });
                      _startSplashTimerAndRoute();
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE5A93C),
                foregroundColor: const Color(0xFF091528),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                elevation: 0,
              ),
              child: _isRetrying
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF091528)),
                      ),
                    )
                  : const Text(
                      'RETRY CONNECTION',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                        fontSize: 13,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () async {
              await UserSessionService.clearUserSession();
              if (!mounted) return;
              _navigateToScreen(const AuthScreen(initialMode: AuthViewMode.login));
            },
            child: Text(
              'Sign In with Another Account',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.75),
                fontSize: 12,
                decoration: TextDecoration.underline,
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
