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

  void _showSmsConfirmationDialog({
    required String spName,
    required String spPhone,
    required String referralCode,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.sms_rounded, color: Color(0xFF1A237E), size: 28),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'SMS Notification Sent!',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.indigo.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.indigo.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.mark_chat_read_rounded, size: 16, color: Color(0xFF1A237E)),
                      SizedBox(width: 6),
                      Text(
                        '📲 Phone SMS Message',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1A237E)),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Text(
                    'Welcome to ITACON! Your account is linked to Salesperson:\n• Name: $spName\n• Phone: $spPhone',
                    style: const TextStyle(fontSize: 13, color: Colors.black87, height: 1.4),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Your Assigned Salesperson Referral Code:',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.black54),
                  ),
                  const SizedBox(height: 6),
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A237E),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        referralCode,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Your referral code is verified and linked to your account.',
              style: TextStyle(fontSize: 12, color: Colors.grey, height: 1.3),
            ),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1A237E),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                Navigator.of(dialogContext).pop();
              },
              child: const Text(
                'OK',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _verifyManualCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      setState(() => _error = 'Please enter a referral code.');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    bool success = await _authService.verifyAndLinkReferralCode(code);
    setState(() => _isLoading = false);

    if (success) {
      if (mounted) {
        _showSmsConfirmationDialog(
          spName: 'Assigned Sales Representative',
          spPhone: '+919876543210',
          referralCode: code.toUpperCase(),
        );
      }
    } else {
      setState(() => _error = 'Invalid code. Check with your salesperson.');
    }
  }

  void _executeAutoAssign() async {
    setState(() => _isLoading = true);
    final details = await _authService.autoAssignSalespersonDetails();
    setState(() => _isLoading = false);

    if (!mounted) return;

    if (details != null) {
      _showSmsConfirmationDialog(
        spName: details['name'] ?? 'ITA Sales Executive',
        spPhone: details['phone'] ?? '+919876543210',
        referralCode: details['referralCode'] ?? 'SALES101',
      );
    } else {
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
