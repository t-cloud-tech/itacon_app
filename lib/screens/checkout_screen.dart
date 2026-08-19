import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  int _currentStep = 0; // 0: Address, 1: Payment, 2: Review
  String _selectedPaymentMethod = 'UPI / QR Code';

  final List<String> _paymentMethods = const [
    'UPI / QR Code',
    'Credit / Debit Card',
    'Net Banking',
    'Cash on Delivery',
  ];

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Checkout'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 3-Step Progress Indicator Bar
            Container(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: AppTheme.luxuryCardDecoration,
              child: Row(
                children: [
                  _buildStepCircle(0, '1 Address'),
                  _buildStepLine(0),
                  _buildStepCircle(1, '2 Payment'),
                  _buildStepLine(1),
                  _buildStepCircle(2, '3 Review'),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Step Content
            if (_currentStep == 0) _buildAddressStep(),
            if (_currentStep == 1) _buildPaymentStep(),
            if (_currentStep == 2) _buildReviewStep(appState),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryNavy,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: () {
                if (_currentStep < 2) {
                  setState(() => _currentStep++);
                } else {
                  // Place Order action
                  appState.clearCart();
                  showDialog(
                    context: context,
                    barrierDismissible: false,
                    builder: (dialogCtx) => AlertDialog(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      title: const Column(
                        children: [
                          Icon(Icons.check_circle_rounded,
                              color: AppTheme.statusSuccess, size: 64),
                          SizedBox(height: 12),
                          Text('Order Placed Successfully!'),
                        ],
                      ),
                      content: const Text(
                        'Thank you for ordering with ITACON Granito! Order #ITC98421 has been placed.',
                        textAlign: TextAlign.center,
                      ),
                      actions: [
                        Center(
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.pop(dialogCtx);
                              Navigator.pop(context);
                              Navigator.pop(context);
                            },
                            child: const Text('BACK TO HOME'),
                          ),
                        ),
                      ],
                    ),
                  );
                }
              },
              child: Text(
                _currentStep == 0
                    ? 'CONTINUE TO PAYMENT →'
                    : (_currentStep == 1 ? 'CONTINUE TO REVIEW →' : 'PLACE ORDER'),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepCircle(int stepIndex, String title) {
    final isActive = _currentStep >= stepIndex;
    return Column(
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor:
              isActive ? AppTheme.primaryNavy : Colors.grey.shade300,
          child: Text(
            '${stepIndex + 1}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isActive ? Colors.white : AppTheme.textSubtle,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            color: isActive ? AppTheme.primaryNavy : AppTheme.textSubtle,
          ),
        ),
      ],
    );
  }

  Widget _buildStepLine(int stepIndex) {
    final isActive = _currentStep > stepIndex;
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.symmetric(horizontal: 8),
        color: isActive ? AppTheme.primaryNavy : Colors.grey.shade300,
      ),
    );
  }

  Widget _buildAddressStep() {
    final profile = AppStateService.instance.currentUserProfile;
    final addressText = profile.address['line1'] != null && (profile.address['line1'] as String).isNotEmpty
        ? '${profile.address['line1']},\n${profile.city.isNotEmpty ? profile.city : "Morbi"} - ${profile.pincode.isNotEmpty ? profile.pincode : "363642"}, ${profile.state.isNotEmpty ? profile.state : "Gujarat"}'
        : 'Plot No. 42, Industrial Ceramic Zone,\nMorbi - 363642, Gujarat, India';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Delivery Address',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textDark,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.luxuryCardDecorationWithBorder(
            borderColor: AppTheme.primaryNavy,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    profile.name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textDark,
                    ),
                  ),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                    ),
                    onPressed: () {},
                    child: const Text('Change', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                addressText,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSubtle,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.phone, size: 14, color: AppTheme.textSubtle),
                  const SizedBox(width: 6),
                  Text(
                    profile.phone,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textDark,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select Payment Method',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textDark,
          ),
        ),
        const SizedBox(height: 12),
        Column(
          children: _paymentMethods.map((method) {
            final isSelected = _selectedPaymentMethod == method;
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: AppTheme.luxuryCardDecorationWithBorder(
                borderColor: isSelected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
              ),
              child: RadioListTile<String>(
                title: Text(
                  method,
                  style: TextStyle(
                    fontWeight:
                        isSelected ? FontWeight.bold : FontWeight.w500,
                    color: AppTheme.textDark,
                  ),
                ),
                activeColor: AppTheme.primaryNavy,
                value: method,
                groupValue: _selectedPaymentMethod,
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedPaymentMethod = val);
                  }
                },
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildReviewStep(AppStateService appState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Order Summary & Review',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textDark,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.luxuryCardDecoration,
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Items Total',
                      style: TextStyle(color: AppTheme.textSubtle)),
                  Text('₹${appState.subtotal.toStringAsFixed(0)}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Freight & Logistics',
                      style: TextStyle(color: AppTheme.textSubtle)),
                  Text(
                    appState.freightFee == 0
                        ? 'FREE'
                        : '₹${appState.freightFee.toStringAsFixed(0)}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const Divider(height: 20, color: AppTheme.borderSubtle),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Grand Total',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    '₹${appState.totalAmount.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
