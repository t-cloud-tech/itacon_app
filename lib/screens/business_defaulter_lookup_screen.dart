import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../models/business_defaulter_result.dart';
import '../services/business_defaulter_service.dart';
import '../services/app_state_service.dart';

/// Minimal, secure business entity lookup screen for verifying payment risk & defaulter status.
/// Access is restricted to authorized roles: salesperson, manager, admin, super_admin.
/// Adheres strictly to the ITACON luxury design system.
class BusinessDefaulterLookupScreen extends StatefulWidget {
  final BusinessDefaulterService? service;
  final String? initialGst;
  final String? initialPhone;
  final bool? isAuthorizedOverride;

  const BusinessDefaulterLookupScreen({
    super.key,
    this.service,
    this.initialGst,
    this.initialPhone,
    this.isAuthorizedOverride,
  });

  @override
  State<BusinessDefaulterLookupScreen> createState() =>
      _BusinessDefaulterLookupScreenState();
}

class _BusinessDefaulterLookupScreenState
    extends State<BusinessDefaulterLookupScreen> {
  late final BusinessDefaulterService _service;
  late final TextEditingController _gstController;
  late final TextEditingController _phoneController;

  bool _isLoading = false;
  String? _errorMessage;
  BusinessDefaulterResult? _result;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? BusinessDefaulterService();
    _gstController = TextEditingController(text: widget.initialGst ?? '');
    _phoneController = TextEditingController(text: widget.initialPhone ?? '');
  }

  @override
  void dispose() {
    _gstController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleCheckDefaulter() async {
    FocusScope.of(context).unfocus();

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _service.checkDefaulter(
        gst: _gstController.text.trim(),
        phone: _phoneController.text.trim(),
      );

      setState(() {
        _result = res;
        _isLoading = false;
      });
    } on BusinessDefaulterException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'An unexpected error occurred. Please try again.';
        _isLoading = false;
      });
    }
  }

  void _clearSearch() {
    setState(() {
      _gstController.clear();
      _phoneController.clear();
      _result = null;
      _errorMessage = null;
    });
  }

  static const List<String> authorizedRoles = [
    'salesperson',
    'manager',
    'admin',
    'super_admin',
    'staff',
  ];

  bool get _isAuthorized {
    if (widget.isAuthorizedOverride != null) return widget.isAuthorizedOverride!;
    if (!AppStateService.instance.hasSessionProfile) {
      return true;
    }
    final role = AppStateService.instance.currentUserProfile.role.toLowerCase().trim();
    return authorizedRoles.contains(role);
  }

  @override
  Widget build(BuildContext context) {
    final bool authorized = _isAuthorized;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        backgroundColor: AppTheme.primaryNavy,
        elevation: 0,
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          'Business Risk Verification',
          style: GoogleFonts.inter(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.2,
          ),
        ),
        actions: [
          if (authorized && (_result != null || _errorMessage != null))
            IconButton(
              icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
              tooltip: 'Reset Lookup',
              onPressed: _clearSearch,
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: EdgeInsets.symmetric(
            horizontal: MediaQuery.sizeOf(context).width < 360 ? 12 : 20,
            vertical: 16,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!authorized) ...[
                _buildAccessRestrictedCard(),
              ] else ...[
                _buildHeaderCard(),
                const SizedBox(height: 16),
                _buildInputCard(),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 16),
                  _buildErrorCard(_errorMessage!),
                ],
                if (_result != null) ...[
                  const SizedBox(height: 20),
                  _buildResultSection(_result!),
                ],
              ],
              const SizedBox(height: 24),
              _buildMandatoryLegalDisclaimer(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAccessRestrictedCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderSubtle),
        boxShadow: AppTheme.luxuryShadows,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.statusError.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.lock_person_rounded, color: AppTheme.statusError, size: 36),
          ),
          const SizedBox(height: 16),
          Text(
            'Access Restricted',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Business Defaulter & Credit Risk Verification is restricted to authorized Sales Executives, Managers, and Administrators. Customer accounts are not permitted to perform third-party business entity checks.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: AppTheme.textSubtle,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.primaryNavy.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.primaryNavy.withValues(alpha: 0.12)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.primaryNavy,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.security_rounded, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Credit & Defaulter Registry',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Verify customer credit standing, overdue payment allegations, and registered business entities using official GSTIN or 10-digit mobile number.',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppTheme.textSubtle,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: AppTheme.luxuryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Search Parameters',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.textDark,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Enter GSTIN, mobile phone, or both for highest accuracy.',
            style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textSubtle),
          ),
          const SizedBox(height: 16),

          // GSTIN Field
          TextField(
            controller: _gstController,
            textCapitalization: TextCapitalization.characters,
            maxLength: 15,
            decoration: InputDecoration(
              labelText: 'Company GSTIN (Optional)',
              hintText: 'e.g. 24AAACG1234F1Z8',
              prefixIcon: const Icon(Icons.business_rounded, color: AppTheme.primaryNavy, size: 20),
              counterText: '',
              filled: true,
              fillColor: AppTheme.backgroundColor,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.borderSubtle),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.primaryNavy, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Phone Field
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            decoration: InputDecoration(
              labelText: 'Mobile Number (Optional)',
              hintText: 'e.g. 9979312651',
              prefixIcon: const Icon(Icons.phone_rounded, color: AppTheme.primaryNavy, size: 20),
              prefixText: '+91 ',
              counterText: '',
              filled: true,
              fillColor: AppTheme.backgroundColor,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.borderSubtle),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.primaryNavy, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Check Business Button
          ElevatedButton(
            onPressed: _isLoading ? null : _handleCheckDefaulter,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryNavy,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.search_rounded, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'Check Business',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.1,
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard(String error) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.statusError.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.statusError.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded, color: AppTheme.statusError, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              error,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppTheme.statusError,
                fontWeight: FontWeight.w500,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultSection(BusinessDefaulterResult result) {
    final risk = result.riskLevel;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Risk Badge Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: risk.color.withValues(alpha: 0.4), width: 1.5),
            boxShadow: AppTheme.luxuryShadows,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: risk.color.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(risk.icon, color: risk.color, size: 26),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'RISK ASSESSMENT',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textSubtle,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          risk.label,
                          style: GoogleFonts.inter(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: risk.color,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                risk.badgeDescription,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: AppTheme.textDark,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Report Counts Breakdown Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.luxuryCardDecoration,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Dispute Reports Summary',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textDark,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _buildCountItem('Total', result.reportCount.total, AppTheme.textDark),
                  _buildCountItem('Verified', result.reportCount.verified, AppTheme.statusError, isCritical: true),
                  _buildCountItem('Pending', result.reportCount.pending, AppTheme.statusWarning),
                  _buildCountItem('Closed', result.reportCount.closed, AppTheme.statusSuccess),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Matched Business Entities
        if (result.parties.isNotEmpty) ...[
          Text(
            'Matched Business Entities (${result.parties.length})',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.textDark,
            ),
          ),
          const SizedBox(height: 10),
          ...result.parties.map(_buildPartyCard),
        ] else if (!result.exists) ...[
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.borderSubtle),
            ),
            child: Row(
              children: [
                const Icon(Icons.search_off_rounded, color: AppTheme.textSubtle, size: 28),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'No Records Located',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textDark,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        result.message.isNotEmpty
                            ? result.message
                            : 'Neither the GST nor phone number matched any known defaulter or registered party.',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: AppTheme.textSubtle,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildCountItem(String label, int count, Color color, {bool isCritical = false}) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 2),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: isCritical ? 0.1 : 0.05),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: isCritical ? 0.3 : 0.15)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                count.toString(),
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
            ),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                maxLines: 1,
                style: GoogleFonts.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textSubtle,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPartyCard(DefaulterParty party) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.luxuryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.apartment_rounded, color: AppTheme.primaryNavy, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      party.companyName,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textDark,
                      ),
                    ),
                    if (party.locationString.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        party.locationString,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: AppTheme.textSubtle,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 20, color: AppTheme.borderSubtle),
          if (party.gst.isNotEmpty)
            _buildPartyDetailRow(Icons.pin_rounded, 'GSTIN', party.gst),
          if (party.phone.isNotEmpty)
            _buildPartyDetailRow(Icons.phone_outlined, 'Contact', party.phone),
          if (party.address.isNotEmpty)
            _buildPartyDetailRow(Icons.place_outlined, 'Address', party.address),
        ],
      ),
    );
  }

  Widget _buildPartyDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: AppTheme.textLight),
          const SizedBox(width: 6),
          Text(
            '$label: ',
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppTheme.textSubtle,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 12,
                color: AppTheme.textDark,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMandatoryLegalDisclaimer() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.gavel_rounded, size: 16, color: Color(0xFF475569)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Statutory & Advisory Notice',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF334155),
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '• A SAFE / No-Record result signifies only that no matching entries were found in this specific database; it does not constitute certification of financial solvency or creditworthiness.\n'
            '• Pending reports are unverified creditor claims undergoing investigation and must NOT be treated as established fraud.\n'
            '• Credit decisions must combine registry insights with independent commercial verification.',
            style: GoogleFonts.inter(
              fontSize: 11,
              color: const Color(0xFF475569),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}
