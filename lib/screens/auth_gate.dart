import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/user_profile.dart';
import '../services/app_state_service.dart';
import '../services/firestore_service.dart';
import '../services/user_session_service.dart';
import '../theme/app_theme.dart';
import 'auth_screen.dart';
import 'main_navigation_screen.dart';
import 'splash_screen.dart';

/// The authoritative, reactive Firebase Authentication Gate for ITACON GRANITO.
///
/// Subscribes directly to [FirebaseAuth.instance.authStateChanges()].
/// States:
/// - ConnectionState.waiting: Splash / loading.
/// - user != null: Authenticated App Root via [AuthenticatedSessionLoader].
/// - user == null: Root Login screen via [AuthScreen].
class AuthGate extends StatelessWidget {
  final Stream<User?>? authStateStream;

  const AuthGate({
    super.key,
    this.authStateStream,
  });

  @override
  Widget build(BuildContext context) {
    // If no override stream is provided AND Firebase has not yet initialized,
    // show a brief loading splash instead of immediately routing to AuthScreen.
    // This prevents a false "unauthenticated" state during cold start on slow devices.
    if (Firebase.apps.isEmpty && authStateStream == null) {
      if (kDebugMode) {
        debugPrint('[AUTH] Firebase apps not yet initialized — showing loading splash');
      }
      // Return a minimal splash; Firebase init is async in main() — this state is transient.
      // In normal flow, Firebase.initializeApp() completes before runApp(), so this branch
      // should be unreachable in production. Guard here for safety only.
      return const SplashScreen(isStaticSplash: true);
    }

    final stream = authStateStream ?? FirebaseAuth.instance.authStateChanges();

    return StreamBuilder<User?>(
      stream: stream,
      builder: (context, snapshot) {
        // 1. Initial restoration from device storage / keystore
        if (snapshot.connectionState == ConnectionState.waiting) {
          if (kDebugMode) {
            debugPrint('[AUTH] Firebase initialized');
            debugPrint('[AUTH] Auth state resolving from device storage...');
          }
          return const SplashScreen(isStaticSplash: true);
        }

        final user = snapshot.data;

        // 2. Confirmed authenticated Firebase user
        if (user != null && user.uid.isNotEmpty) {
          if (kDebugMode) {
            debugPrint('[AUTH] Auth state resolved: authenticated=true');
            debugPrint('[AUTH] UID present=true');
          }
          return AuthenticatedSessionLoader(user: user);
        }

        // 3. Confirmed unauthenticated Firebase state
        if (kDebugMode) {
          debugPrint('[AUTH] Auth state resolved: authenticated=false');
          debugPrint('[AUTH] UID present=false');
        }
        return const AuthScreen(initialMode: AuthViewMode.login);
      },
    );
  }
}

/// Manages profile loading and session hydration for an authenticated Firebase user.
///
/// CRITICAL ARCHITECTURAL RULE:
/// Slow profile load, network error, or missing profile document
/// MUST NEVER trigger [FirebaseAuth.instance.signOut] or route to Login.
class AuthenticatedSessionLoader extends StatefulWidget {
  final User user;
  final Future<UserProfile?> Function(String uid)? profileLoader;

  const AuthenticatedSessionLoader({
    super.key,
    required this.user,
    this.profileLoader,
  });

  @override
  State<AuthenticatedSessionLoader> createState() => _AuthenticatedSessionLoaderState();
}

class _AuthenticatedSessionLoaderState extends State<AuthenticatedSessionLoader> {
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void didUpdateWidget(covariant AuthenticatedSessionLoader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.uid != widget.user.uid) {
      _loadProfile();
    }
  }

  Future<void> _loadProfile() async {
    final uid = widget.user.uid;
    if (kDebugMode) debugPrint('[AUTH] Profile load started');

    final appState = AppStateService.instance;

    // 1. In-memory check
    if (appState.hasSessionProfile && appState.currentUserProfile.userId == uid) {
      if (kDebugMode) debugPrint('[AUTH] Profile load success');
      if (mounted) setState(() => _isLoading = false);
      _syncProfileInBackground(uid);
      return;
    }

    // 2. Local SharedPreferences cache check
    try {
      final cached = await UserSessionService.restoreUserSession();
      if (cached != null && cached.userId == uid && cached.name != 'Valued Partner') {
        appState.setCurrentUserProfile(cached);
        if (kDebugMode) debugPrint('[AUTH] Profile load success');
        if (mounted) setState(() => _isLoading = false);
        _syncProfileInBackground(uid);
        return;
      }
    } catch (_) {}

    // 3. Fetch from Firestore
    try {
      final fetcher = widget.profileLoader ??
          (Firebase.apps.isNotEmpty ? FirestoreService.instance.getUserProfile : (_) async => null);

      final remoteProfile = await fetcher(uid);
      if (remoteProfile != null && remoteProfile.name != 'Valued Partner') {
        await UserSessionService.saveUserSession(remoteProfile);
        if (kDebugMode) debugPrint('[AUTH] Profile load success');
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = null;
          });
        }
        return;
      }

      // If no remote profile document exists yet (e.g. phone user pending profile completion),
      // hydrate with basic Firebase Auth phone identity so session remains 100% active.
      final fallbackPhoneUser = UserProfile(
        userId: uid,
        name: widget.user.displayName ?? (widget.user.phoneNumber ?? 'Customer'),
        companyName: '',
        phone: widget.user.phoneNumber ?? '',
        email: widget.user.email ?? '',
        userCategory: 'Dealer',
        role: 'customer',
      );
      await UserSessionService.saveUserSession(fallbackPhoneUser);
      if (kDebugMode) debugPrint('[AUTH] Profile load success');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = null;
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[AUTH] Profile load failed - auth preserved');
      // CRITICAL: NEVER call signOut() on profile load failure!
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Network connection delay. Your authenticated session is preserved.';
        });
      }
    }
  }

  void _syncProfileInBackground(String uid) {
    if (Firebase.apps.isEmpty) return;
    FirestoreService.instance.getUserProfile(uid).then((fresh) {
      if (fresh != null && fresh.name != 'Valued Partner') {
        UserSessionService.saveUserSession(fresh);
      }
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppTheme.backgroundColor,
        body: Center(
          child: CircularProgressIndicator(color: AppTheme.primaryNavy),
        ),
      );
    }

    if (_errorMessage != null && !AppStateService.instance.hasSessionProfile) {
      return Scaffold(
        backgroundColor: AppTheme.backgroundColor,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.wifi_off_rounded, size: 54, color: AppTheme.accentOrange),
                const SizedBox(height: 16),
                const Text(
                  'Connection Delay',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
                ),
                const SizedBox(height: 8),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: AppTheme.textSubtle),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () {
                    setState(() {
                      _isLoading = true;
                      _errorMessage = null;
                    });
                    _loadProfile();
                  },
                  child: const Text('RETRY SYNC', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return const MainNavigationScreen();
  }
}
