import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/user_profile.dart';
import '../services/app_state_service.dart';
import '../services/pricing_service.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  int _currentStep = 0; // 0: PO Estimate, 1: Address, 2: Payment, 3: Review
  bool _isEstimateApproved = true;

  // Shipping Address Form State
  final _addressLineController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _pincodeController = TextEditingController();
  final _gstController = TextEditingController();
  final _deliveryNotesController = TextEditingController();

  String _selectedPaymentMethod = 'B2B Bank Transfer / RTGS';

  final List<Map<String, String>> _paymentOptions = const [
    {
      'title': 'B2B Bank Transfer / RTGS',
      'subtitle': 'Direct bank wire transfer to ITACON Granito corporate account',
      'icon': 'account_balance_rounded',
    },
    {
      'title': 'Trade Credit Terms (30-Day)',
      'subtitle': 'Bill to account for verified trade partners & dealers',
      'icon': 'credit_score_rounded',
    },
    {
      'title': 'UPI / QR Code Instant Pay',
      'subtitle': 'Fast payment via Google Pay, PhonePe, Paytm or BHIM',
      'icon': 'qr_code_scanner_rounded',
    },
    {
      'title': 'Credit / Debit Card',
      'subtitle': 'Visa, MasterCard, RuPay, Amex accepted',
      'icon': 'credit_card_rounded',
    },
    {
      'title': 'Cash on Delivery (Advance Freight)',
      'subtitle': 'Pay balance upon delivery at project site',
      'icon': 'local_shipping_rounded',
    },
  ];

  @override
  void initState() {
    super.initState();
    final profile = AppStateService.instance.currentUserProfile;
    _addressLineController.text = (profile.address['line1'] as String?) ?? 'Plot No. 42, Industrial Ceramic Zone';
    _cityController.text = profile.city.isNotEmpty ? profile.city : 'Morbi';
    _stateController.text = profile.state.isNotEmpty ? profile.state : 'Gujarat';
    _pincodeController.text = profile.pincode.isNotEmpty ? profile.pincode : '363642';
    _gstController.text = profile.gstNumber.isNotEmpty ? profile.gstNumber : '24AAAAA0000A1Z5';
  }

  @override
  void dispose() {
    _addressLineController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _pincodeController.dispose();
    _gstController.dispose();
    _deliveryNotesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService.instance;
    final user = appState.currentUserProfile;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Text(
          _currentStep == 0
              ? 'Purchase Order Estimate'
              : (_currentStep == 1
                  ? 'Delivery Address'
                  : (_currentStep == 2 ? 'Payment Terms' : 'Order Review & Confirmation')),
        ),
        elevation: 0,
      ),
      body: Column(
        children: [
          // 4-Step Luxury Progress Bar Header
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            color: Colors.white,
            child: Row(
              children: [
                _buildStepItem(0, '1. Estimate'),
                _buildStepConnector(0),
                _buildStepItem(1, '2. Address'),
                _buildStepConnector(1),
                _buildStepItem(2, '3. Payment'),
                _buildStepConnector(2),
                _buildStepItem(3, '4. Review'),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: IndexedStack(
                index: _currentStep,
                children: [
                  _buildEstimateStep(appState, user),
                  _buildAddressStep(user),
                  _buildPaymentStep(),
                  _buildReviewStep(appState, user),
                ],
              ),
            ),
          ),
        ],
      ),

      // Bottom Navigation Bar Action
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
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
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () {
                if (_currentStep == 0) {
                  if (!_isEstimateApproved) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Please approve the Purchase Order Estimate to proceed.'),
                        backgroundColor: AppTheme.statusWarning,
                      ),
                    );
                    return;
                  }
                  setState(() => _currentStep = 1);
                } else if (_currentStep == 1) {
                  if (_addressLineController.text.trim().isEmpty || _cityController.text.trim().isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Please enter valid delivery address details.'),
                        backgroundColor: AppTheme.statusWarning,
                      ),
                    );
                    return;
                  }
                  setState(() => _currentStep = 2);
                } else if (_currentStep == 2) {
                  setState(() => _currentStep = 3);
                } else {
                  _handlePlaceOrder(appState, user);
                }
              },
              child: Text(
                _currentStep == 0
                    ? 'APPROVE ESTIMATE & CONTINUE →'
                    : (_currentStep == 1
                        ? 'CONFIRM ADDRESS & PROCEED →'
                        : (_currentStep == 2 ? 'CONTINUE TO FINAL REVIEW →' : 'PLACE PURCHASE ORDER')),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // Progress Bar Helper Item
  Widget _buildStepItem(int stepIndex, String title) {
    final isActive = _currentStep >= stepIndex;
    final isCurrent = _currentStep == stepIndex;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 12,
          backgroundColor: isActive ? AppTheme.primaryNavy : Colors.grey.shade300,
          child: isCurrent
              ? const Icon(Icons.circle, size: 8, color: AppTheme.accentOrange)
              : Text(
                  '${stepIndex + 1}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isActive ? Colors.white : AppTheme.textSubtle,
                  ),
                ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            color: isActive ? AppTheme.primaryNavy : AppTheme.textSubtle,
          ),
        ),
      ],
    );
  }

  Widget _buildStepConnector(int stepIndex) {
    final isActive = _currentStep > stepIndex;
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
        color: isActive ? AppTheme.primaryNavy : Colors.grey.shade300,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 0: Purchase Order Estimate (User-wise Price Breakdown & Approval)
  // ---------------------------------------------------------------------------
  Widget _buildEstimateStep(AppStateService appState, UserProfile user) {
    final category = user.userCategory;
    final discountRatio = PricingService.tierDiscountMap[category] ?? 0.0;
    final discountPct = (discountRatio * 100).toStringAsFixed(0);

    // Calculate gross subtotal before tier discount
    double grossBaseSubtotal = 0.0;
    for (final item in appState.cartItems) {
      final baseBoxCost = item.product.basePrice * item.sqFtPerBox;
      grossBaseSubtotal += baseBoxCost * item.quantity;
    }

    final netSubtotal = appState.subtotal;
    final discountSavings = grossBaseSubtotal > netSubtotal ? grossBaseSubtotal - netSubtotal : 0.0;
    final gstAmount = netSubtotal * 0.18;
    final grandTotalEstimate = netSubtotal + gstAmount + appState.freightFee;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Official PO Estimate Header Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppTheme.primaryNavy, Color(0xFF1B3D70)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.request_quote_rounded, color: AppTheme.accentOrange, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PURCHASE ORDER ESTIMATE',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Ref #: PO-EST-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}',
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.accentOrange,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$category TIER',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Customer & Trade Partner Info Card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: AppTheme.luxuryCardDecoration,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Trade Account Details',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryNavy.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Tier: $category',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.primaryNavy),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Customer: ${user.name} (${user.companyName.isNotEmpty ? user.companyName : "Individual Trade Client"})',
                style: const TextStyle(fontSize: 13, color: AppTheme.textDark, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 4),
              Text(
                'Phone: ${user.phone}  •  GSTIN: ${_gstController.text}',
                style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Finalized Itemized Estimate Table
        const Text(
          'Finalized Order Items & Unit Rates',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textDark),
        ),
        const SizedBox(height: 8),
        Column(
          children: appState.cartItems.map((item) {
            final resolved = PricingService.instance.resolvePrice(item.product);
            final totalCoverageSqFt = item.quantity * item.sqFtPerBox;

            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: AppTheme.luxuryCardDecoration,
              child: Row(
                children: [
                  // Product Thumbnail Picture
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      item.product.images.isNotEmpty
                          ? item.product.images.first
                          : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
                      width: 55,
                      height: 55,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 55,
                        height: 55,
                        color: AppTheme.primaryNavy.withOpacity(0.1),
                        child: const Icon(Icons.terrain_rounded, color: AppTheme.primaryNavy, size: 24),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Item Details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.product.name,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${item.selectedSize} • ${item.selectedFinish}',
                          style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${item.quantity} Boxes (${totalCoverageSqFt.toStringAsFixed(1)} sq.ft)',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.primaryNavy),
                        ),
                      ],
                    ),
                  ),

                  // Rate & Line Total
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '₹${item.itemTotal.toStringAsFixed(0)}',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.accentOrange),
                      ),
                      Text(
                        '₹${resolved.unitPrice.toStringAsFixed(0)} / sq.ft',
                        style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                      ),
                      if (resolved.hasDiscount)
                        Text(
                          resolved.discountBadgeLabel,
                          style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.green),
                        ),
                    ],
                  ),
                ],
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 14),

        // User-wise Estimate Cost Summary Breakdown
        Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.luxuryCardDecorationWithBorder(borderColor: AppTheme.primaryNavy.withOpacity(0.2)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Standard Base Subtotal', style: TextStyle(fontSize: 13, color: AppTheme.textSubtle)),
                  Text('₹${grossBaseSubtotal.toStringAsFixed(0)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ],
              ),
              if (discountSavings > 0) ...[
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Trade Partner Discount ($discountPct% OFF)', style: const TextStyle(fontSize: 13, color: Colors.green, fontWeight: FontWeight.w600)),
                    Text('- ₹${discountSavings.toStringAsFixed(0)}', style: const TextStyle(fontSize: 13, color: Colors.green, fontWeight: FontWeight.bold)),
                  ],
                ),
              ],
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Net Material Cost', style: TextStyle(fontSize: 13, color: AppTheme.textSubtle)),
                  Text('₹${netSubtotal.toStringAsFixed(0)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Estimated GST (18%)', style: TextStyle(fontSize: 13, color: AppTheme.textSubtle)),
                  Text('₹${gstAmount.toStringAsFixed(0)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Estimated Logistics & Freight', style: TextStyle(fontSize: 13, color: AppTheme.textSubtle)),
                  Text(
                    appState.freightFee == 0 ? 'FREE' : '₹${appState.freightFee.toStringAsFixed(0)}',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const Divider(height: 20, color: AppTheme.borderSubtle),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ESTIMATED TOTAL VALUE', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                  Text(
                    '₹${grandTotalEstimate.toStringAsFixed(0)}',
                    style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: AppTheme.primaryNavy),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Estimate Approval Checkbox
        CheckboxListTile(
          value: _isEstimateApproved,
          onChanged: (val) => setState(() => _isEstimateApproved = val ?? true),
          activeColor: AppTheme.primaryNavy,
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text(
            'I approve this Purchase Order Estimate with partner rates as specified above.',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textDark),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Delivery Address & Shipping Details
  // ---------------------------------------------------------------------------
  Widget _buildAddressStep(UserProfile user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Shipping & Project Site Delivery Address',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textDark),
        ),
        const SizedBox(height: 4),
        const Text(
          'Enter site delivery location for dispatch logistics planning.',
          style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
        ),
        const SizedBox(height: 16),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.luxuryCardDecoration,
          child: Column(
            children: [
              TextFormField(
                controller: _addressLineController,
                decoration: const InputDecoration(
                  labelText: 'Site Address / Street Line *',
                  prefixIcon: Icon(Icons.location_on_outlined),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _cityController,
                      decoration: const InputDecoration(
                        labelText: 'City *',
                        prefixIcon: Icon(Icons.location_city_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _stateController,
                      decoration: const InputDecoration(
                        labelText: 'State *',
                        prefixIcon: Icon(Icons.map_outlined),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _pincodeController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Pincode *',
                        prefixIcon: Icon(Icons.pin_drop_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _gstController,
                      decoration: const InputDecoration(
                        labelText: 'GSTIN (For Tax Invoice)',
                        prefixIcon: Icon(Icons.receipt_long_outlined),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _deliveryNotesController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Delivery / Unloading Instructions (Optional)',
                  prefixIcon: Icon(Icons.note_alt_outlined),
                  hintText: 'e.g. Crane required for unloading, site contact phone...',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Payment Method Selection
  // ---------------------------------------------------------------------------
  Widget _buildPaymentStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select Payment Terms / Mode',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textDark),
        ),
        const SizedBox(height: 4),
        const Text(
          'Select your preferred B2B payment terms or instant payment gateway.',
          style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
        ),
        const SizedBox(height: 16),

        Column(
          children: _paymentOptions.map((option) {
            final title = option['title']!;
            final subtitle = option['subtitle']!;
            final isSelected = _selectedPaymentMethod == title;

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: AppTheme.luxuryCardDecorationWithBorder(
                borderColor: isSelected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
              ),
              child: RadioListTile<String>(
                value: title,
                groupValue: _selectedPaymentMethod,
                onChanged: (val) {
                  if (val != null) setState(() => _selectedPaymentMethod = val);
                },
                activeColor: AppTheme.primaryNavy,
                title: Text(
                  title,
                  style: TextStyle(
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                    color: AppTheme.textDark,
                    fontSize: 14,
                  ),
                ),
                subtitle: Text(
                  subtitle,
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Comprehensive Final Order Review (With Product Images!)
  // ---------------------------------------------------------------------------
  Widget _buildReviewStep(AppStateService appState, UserProfile user) {
    final netSubtotal = appState.subtotal;
    final gstAmount = netSubtotal * 0.18;
    final grandTotal = netSubtotal + gstAmount + appState.freightFee;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Review Your Purchase Order',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textDark),
        ),
        const SizedBox(height: 4),
        const Text(
          'Please verify all items, pictures, address, and payment terms before placing the order.',
          style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
        ),
        const SizedBox(height: 16),

        // 1. Visual Product Items Gallery Card (WITH PICTURES)
        Container(
          padding: const EdgeInsets.all(14),
          decoration: AppTheme.luxuryCardDecoration,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Order Items (${appState.cartItems.length})',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                  ),
                  TextButton.icon(
                    onPressed: () => setState(() => _currentStep = 0),
                    icon: const Icon(Icons.edit_outlined, size: 14),
                    label: const Text('Edit Items', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ),
              const Divider(height: 12, color: AppTheme.borderSubtle),

              Column(
                children: appState.cartItems.map((item) {
                  final resolved = PricingService.instance.resolvePrice(item.product);
                  final totalAreaSqFt = item.quantity * item.sqFtPerBox;

                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        // Item Picture Thumbnail
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            item.product.images.isNotEmpty
                                ? item.product.images.first
                                : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
                            width: 60,
                            height: 60,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 60,
                              height: 60,
                              color: AppTheme.primaryNavy.withOpacity(0.1),
                              child: const Icon(Icons.terrain_rounded, color: AppTheme.primaryNavy, size: 28),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Specs & Quantity
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.product.name,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${item.selectedSize} • ${item.selectedFinish}',
                                style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.primaryNavy.withOpacity(0.08),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      '${item.quantity} Boxes (${totalAreaSqFt.toStringAsFixed(1)} sq.ft)',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // Resolved Price
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${item.itemTotal.toStringAsFixed(0)}',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.accentOrange),
                            ),
                            Text(
                              '₹${resolved.unitPrice.toStringAsFixed(0)}/sq.ft',
                              style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // 2. Shipping Address & Delivery Summary Card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: AppTheme.luxuryCardDecoration,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.location_on_outlined, size: 18, color: AppTheme.primaryNavy),
                      SizedBox(width: 6),
                      Text('Shipping Address', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                    ],
                  ),
                  TextButton(
                    onPressed: () => setState(() => _currentStep = 1),
                    child: const Text('Change', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ),
              Text(
                '${user.name} (${user.companyName.isNotEmpty ? user.companyName : "B2B Client"})',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textDark),
              ),
              const SizedBox(height: 2),
              Text(
                '${_addressLineController.text.trim()}, ${_cityController.text.trim()} - ${_pincodeController.text.trim()}, ${_stateController.text.trim()}',
                style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle),
              ),
              if (_gstController.text.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('GSTIN: ${_gstController.text.trim()}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // 3. Payment Method Card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: AppTheme.luxuryCardDecoration,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.payment_rounded, size: 18, color: AppTheme.primaryNavy),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Payment Method', style: TextStyle(fontSize: 10, color: AppTheme.textSubtle)),
                      Text(_selectedPaymentMethod, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                    ],
                  ),
                ],
              ),
              TextButton(
                onPressed: () => setState(() => _currentStep = 2),
                child: const Text('Change', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // 4. Final Total Summary Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.luxuryCardDecorationWithBorder(borderColor: AppTheme.primaryNavy),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Material Net Total', style: TextStyle(color: AppTheme.textSubtle)),
                  Text('₹${netSubtotal.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('GST Amount (18%)', style: TextStyle(color: AppTheme.textSubtle)),
                  Text('₹${gstAmount.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Freight & Shipping Fee', style: TextStyle(color: AppTheme.textSubtle)),
                  Text(
                    appState.freightFee == 0 ? 'FREE' : '₹${appState.freightFee.toStringAsFixed(0)}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const Divider(height: 20, color: AppTheme.borderSubtle),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('GRAND TOTAL PAYABLE', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                  Text(
                    '₹${grandTotal.toStringAsFixed(0)}',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.primaryNavy),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // Handle Order Placement
  void _handlePlaceOrder(AppStateService appState, UserProfile user) {
    final orderNum = 'ITC${DateTime.now().millisecondsSinceEpoch.toString().substring(6)}';

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
            Icon(Icons.check_circle_rounded, color: AppTheme.statusSuccess, size: 64),
            SizedBox(height: 12),
            Text('Purchase Order Placed!', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Thank you, ${user.name}! Your official Purchase Order #$orderNum has been created and sent to dispatch.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppTheme.textSubtle),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.primaryNavy.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.picture_as_pdf_rounded, color: AppTheme.primaryNavy, size: 20),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text('PO Estimate & Invoice PDF generated', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                  ),
                  TextButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Downloading PO Estimate PDF...')),
                      );
                    },
                    child: const Text('Download', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Center(
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryNavy,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
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
}
