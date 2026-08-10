import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../main.dart';

class ReferralGateScreen extends StatefulWidget {
  const ReferralGateScreen({super.key});

  @override
  State<ReferralGateScreen> createState() => _ReferralGateScreenState();
}

class _ReferralGateScreenState extends State<ReferralGateScreen> {
  final _codeController = TextEditingController();
  final AuthService _authService = AuthService();
  bool _isLoading = false;
  String? _error;

  void _verifyManualCode() async {
    if (_codeController.text.trim().isEmpty) {
      setState(() => _error = 'Please enter a referral code.');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    bool success =
        await _authService.verifyAndLinkReferralCode(_codeController.text.trim());
    setState(() => _isLoading = false);

    if (success) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Account Verified! Access Granted.')));
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const FirebaseTestScreen()),
        );
      }
    } else {
      setState(() => _error = 'Invalid code. Check with your salesperson.');
    }
  }

  void _executeAutoAssign() async {
    setState(() => _isLoading = true);
    await _authService.autoAssignSalesperson();
    setState(() => _isLoading = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Sales Executive Linked Automatically! Access Granted.')));
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const FirebaseTestScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
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
                        child: const Text('Verify Code & Unlock',
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
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFFFF8F00), width: 1.5),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.bolt_rounded, color: Color(0xFFFF8F00)),
                label: const Text(
                  'Auto-Assign a Sales Executive',
                  style: TextStyle(
                      color: Color(0xFFFF8F00),
                      fontWeight: FontWeight.bold,
                      fontSize: 15),
                ),
                onPressed: _isLoading ? null : _executeAutoAssign,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
