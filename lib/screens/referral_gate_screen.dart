import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../services/auth_service.dart';
import '../services/user_session_service.dart';
import 'main_navigation_screen.dart';

class ReferralGateScreen extends StatefulWidget {
  const ReferralGateScreen({super.key});

  @override
  State<ReferralGateScreen> createState() => _ReferralGateScreenState();
}

class _ReferralGateScreenState extends State<ReferralGateScreen> {
  final _codeController = TextEditingController();
  final AuthService _authService = AuthService();
  bool _isLoading = false;
  bool _isAutoAssigning = false;
  String? _error;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  void _verifyManualCode() async {
    if (_isLoading) return;
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      setState(() => _error = 'Please enter a referral code.');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final stopwatch = Stopwatch()..start();
    try {
      bool success = await _authService.verifyAndLinkReferralCode(code);
      stopwatch.stop();
      debugPrint('[PERF] Manual referral code verification completed in ${stopwatch.elapsedMilliseconds}ms with success=$success');

      if (!mounted) return;
      setState(() => _isLoading = false);

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Referral Code Verified! Access Granted.')),
        );
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const MainNavigationScreen()),
        );
      } else {
        setState(() => _error = 'Invalid or inactive referral code');
      }
    } on FirebaseFunctionsException catch (fe) {
      stopwatch.stop();
      debugPrint('[PERF] Referral verification FirebaseFunctionsException after ${stopwatch.elapsedMilliseconds}ms: code=${fe.code}, message=${fe.message}');
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        if (fe.message == 'invalid-code' || fe.code == 'not-found') {
          _error = 'Referral code not found';
        } else if (fe.message == 'inactive-code' || fe.code == 'failed-precondition') {
          _error = 'This sales representative is inactive';
        } else if (fe.message == 'already-linked' || fe.code == 'already-exists') {
          _error = 'Your account is already linked';
        } else if (fe.code == 'unavailable' || fe.code == 'deadline-exceeded') {
          _error = 'Please check your internet connection';
        } else {
          _error = 'Something went wrong, please try again';
        }
      });
    } catch (e) {
      stopwatch.stop();
      debugPrint('[PERF] Referral verification error after ${stopwatch.elapsedMilliseconds}ms: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          final errorStr = e.toString().toLowerCase();
          if (errorStr.contains('socket') ||
              errorStr.contains('network') ||
              errorStr.contains('connection') ||
              errorStr.contains('offline')) {
            _error = 'Please check your internet connection';
          } else if (errorStr.contains('not found') || errorStr.contains('invalid-code')) {
            _error = 'Referral code not found';
          } else if (errorStr.contains('inactive')) {
            _error = 'This sales representative is inactive';
          } else if (errorStr.contains('already-linked') || errorStr.contains('already linked')) {
            _error = 'Your account is already linked';
          } else {
            _error = 'Something went wrong, please try again';
          }
        });
      }
    }
  }

  void _executeAutoAssign() async {
    if (_isLoading || _isAutoAssigning) return;
    setState(() {
      _isAutoAssigning = true;
      _isLoading = true;
      _error = null;
    });

    final stopwatch = Stopwatch()..start();
    try {
      final details = await _authService.autoAssignSalespersonDetails();
      stopwatch.stop();
      debugPrint('[PERF] Auto-assign details fetched in ${stopwatch.elapsedMilliseconds}ms');

      final spName = details['name'] ?? 'Sales Executive';

      if (mounted) {
        setState(() {
          _isAutoAssigning = false;
          _isLoading = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("You've been assigned to $spName"),
            backgroundColor: const Color(0xFF1B365D),
          ),
        );

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const MainNavigationScreen()),
        );
      }
    } on FirebaseFunctionsException catch (fe) {
      stopwatch.stop();
      debugPrint('[PERF] Auto-assign FirebaseFunctionsException after ${stopwatch.elapsedMilliseconds}ms: code=${fe.code}, message=${fe.message}');
      if (mounted) {
        setState(() {
          _isAutoAssigning = false;
          _isLoading = false;
          if (fe.message == 'already-linked' || fe.code == 'already-exists') {
            _error = 'Your account is already linked';
          } else if (fe.message == 'no-salesperson-available' || fe.code == 'failed-precondition') {
            _error = 'No sales executive available right now. Please enter a referral code or try again later.';
          } else if (fe.code == 'unavailable' || fe.code == 'deadline-exceeded') {
            _error = 'Please check your internet connection';
          } else {
            _error = 'Something went wrong, please try again';
          }
        });
      }
    } catch (e) {
      stopwatch.stop();
      debugPrint('[PERF] Auto-assign failed in ${stopwatch.elapsedMilliseconds}ms: $e');
      if (mounted) {
        setState(() {
          _isAutoAssigning = false;
          _isLoading = false;
          final errorStr = e.toString().toLowerCase();
          if (errorStr.contains('already-linked') || errorStr.contains('already linked')) {
            _error = 'Your account is already linked';
          } else if (errorStr.contains('no-salesperson-available') || errorStr.contains('no sales executive')) {
            _error = 'No sales executive available right now. Please enter a referral code or try again later.';
          } else if (errorStr.contains('socket') ||
              errorStr.contains('network') ||
              errorStr.contains('connection') ||
              errorStr.contains('offline')) {
            _error = 'Please check your internet connection';
          } else {
            _error = 'Something went wrong, please try again';
          }
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8F9FA),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          automaticallyImplyLeading: false,
          actions: [
            TextButton.icon(
              onPressed: _isLoading ? null : () => UserSessionService.logout(context),
              icon: const Icon(Icons.logout_rounded, size: 18, color: Color(0xFF1A237E)),
              label: const Text(
                'Log Out',
                style: TextStyle(
                  color: Color(0xFF1A237E),
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.verified_user_rounded,
                    size: 60, color: Color(0xFF1A237E)),
              ),
              const SizedBox(height: 24),
              const Text(
                'Link Sales Representative',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter your representative\'s code to access custom pricing and stock catalogs.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const SizedBox(height: 32),

              // Referral Input Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 4))
                  ],
                ),
                child: Column(
                  children: [
                    TextField(
                      controller: _codeController,
                      textCapitalization: TextCapitalization.characters,
                      decoration: InputDecoration(
                        labelText: 'Referral Code',
                        hintText: 'e.g., SALES123',
                        prefixIcon: const Icon(Icons.qr_code_rounded,
                            color: Color(0xFF1A237E)),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                        errorText: _error,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1A237E),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _isLoading ? null : _verifyManualCode,
                        child: _isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : const Text('Verify Code & Unlock',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              const Row(
                children: [
                  Expanded(child: Divider()),
                  Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Text('OR',
                          style: TextStyle(
                              color: Colors.grey,
                              fontWeight: FontWeight.bold))),
                  Expanded(child: Divider()),
                ],
              ),
              const SizedBox(height: 24),

              // Auto-Assign Quick Action
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFFFF8F00), width: 1.5),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: (_isLoading || _isAutoAssigning) ? null : _executeAutoAssign,
                child: _isAutoAssigning
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFF8F00)),
                        ),
                      )
                    : const Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.bolt_rounded, color: Color(0xFFFF8F00)),
                          SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              'Auto-Assign a Sales Executive',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  color: Color(0xFFFF8F00),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15),
                            ),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
}
