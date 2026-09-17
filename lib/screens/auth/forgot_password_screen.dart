import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../theme/app_theme.dart';

/// A production-grade Mobile SMS OTP 'Forgot Password' recovery screen and bottom modal sheet,
/// integrated directly with Firebase Phone Authentication and adhering to ITACON's luxury navy theme.
class ForgotPasswordScreen extends StatefulWidget {
  final String? initialPhone;
  final String? initialEmail; // Backward compatibility alias
  final bool isBottomSheet;

  const ForgotPasswordScreen({
    super.key,
    this.initialPhone,
    this.initialEmail,
    this.isBottomSheet = false,
  });

  /// Static helper to launch ForgotPasswordScreen as a luxury responsive bottom sheet
  static Future<String?> showAsBottomSheet(
    BuildContext context, {
    String? initialPhone,
    String? initialEmail,
  }) {
    final effectivePhone = initialPhone ?? initialEmail;
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final mediaQuery = MediaQuery.of(context);
        final keyboardInset = mediaQuery.viewInsets.bottom;
        final screenHeight = mediaQuery.size.height;
        // Keep sheet within responsive bounds above keyboard
        final maxHeight = (screenHeight * 0.92) - (keyboardInset > 0 ? 0 : mediaQuery.padding.top);

        return Padding(
          padding: EdgeInsets.only(bottom: keyboardInset),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: maxHeight,
            ),
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              clipBehavior: Clip.antiAlias,
              child: ForgotPasswordScreen(
                initialPhone: effectivePhone,
                isBottomSheet: true,
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _phoneFormKey = GlobalKey<FormState>();
  final _resetFormKey = GlobalKey<FormState>();

  late final TextEditingController _phoneController;
  final TextEditingController _otpController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  final AuthService _authService = AuthService();
  final FirestoreService _firestoreService = FirestoreService();

  // Step 1: Mobile Input, Step 2: SMS OTP + Set New Password, Step 3: Success Confirmation
  int _step = 1;
  String _verificationId = '';
  String _verifiedPhoneNumber = '';

  bool _isLoading = false;
  String? _errorMessage;

  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;

  // 60-second resend cooldown timer
  Timer? _cooldownTimer;
  int _cooldownSeconds = 0;

  @override
  void initState() {
    super.initState();
    String prefill = widget.initialPhone ?? widget.initialEmail ?? '';
    // Strip non-digits and leading country code if 91
    prefill = prefill.replaceAll(RegExp(r'\D'), '');
    if (prefill.startsWith('91') && prefill.length > 10) {
      prefill = prefill.substring(2);
    }
    _phoneController = TextEditingController(text: prefill);
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldownTimer() {
    _cooldownTimer?.cancel();
    setState(() {
      _cooldownSeconds = 60;
    });
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_cooldownSeconds <= 1) {
        timer.cancel();
        setState(() {
          _cooldownSeconds = 0;
        });
      } else {
        setState(() {
          _cooldownSeconds--;
        });
      }
    });
  }

  /// Step 1: Send SMS OTP to entered registered mobile number
  Future<void> _handleSendSmsOtp() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _errorMessage = null;
    });

    if (!_phoneFormKey.currentState!.validate()) {
      return;
    }

    final rawDigits = _phoneController.text.replaceAll(RegExp(r'\D'), '').trim();
    if (rawDigits.length != 10) {
      setState(() {
        _errorMessage = 'Please enter a valid 10-digit mobile number.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
    });

    // 1. Check if the user is registered in Firestore
    try {
      final userMap = await _firestoreService.findUserByIdentifier(rawDigits);
      if (userMap == null) {
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _errorMessage =
              'No account found with mobile number +91 $rawDigits. Please verify your number or register.';
        });
        return;
      }
    } catch (_) {
      // Allow proceeding if offline/test mock
    }

    // 2. Dispatch real Firebase SMS OTP
    final fullPhone = '+91$rawDigits';
    await _authService.sendOtp(
      phoneNumber: fullPhone,
      onCodeSent: (verificationId, resendToken) {
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _verificationId = verificationId;
          _verifiedPhoneNumber = rawDigits;
          _step = 2;
          _errorMessage = null;
        });
        _startCooldownTimer();
      },
      onError: (error) {
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _errorMessage = error;
        });
      },
    );
  }

  /// Step 2: Resend SMS OTP
  Future<void> _handleResendOtp() async {
    if (_cooldownSeconds > 0 || _isLoading) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final fullPhone = '+91$_verifiedPhoneNumber';
    await _authService.sendOtp(
      phoneNumber: fullPhone,
      onCodeSent: (verificationId, resendToken) {
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _verificationId = verificationId;
        });
        _startCooldownTimer();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.mark_chat_read_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Verification code resent via SMS to +91 $_verifiedPhoneNumber',
                    style: const TextStyle(fontSize: 13, color: Colors.white),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            margin: const EdgeInsets.all(16),
          ),
        );
      },
      onError: (error) {
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _errorMessage = error;
        });
      },
    );
  }

  /// Step 2: Verify OTP and Reset Password
  Future<void> _handleResetPassword() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _errorMessage = null;
    });

    if (!_resetFormKey.currentState!.validate()) {
      return;
    }

    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      setState(() {
        _errorMessage = 'Please enter the complete 6-digit OTP received via SMS.';
      });
      return;
    }

    final newPass = _newPasswordController.text;
    final confirmPass = _confirmPasswordController.text;

    if (newPass != confirmPass) {
      setState(() {
        _errorMessage = 'New password and confirm password do not match.';
      });
      return;
    }

    final passValidation = AuthService.validatePassword(newPass);
    if (passValidation != null) {
      setState(() {
        _errorMessage = passValidation;
      });
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      await _authService.resetPasswordWithPhoneOtp(
        phoneNumber: '+91$_verifiedPhoneNumber',
        verificationId: _verificationId,
        smsCode: otp,
        newPassword: newPass,
      );

      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _step = 3; // Transition to success screen
      });
    } catch (e) {
      if (!mounted) return;
      final cleanMsg = e.toString().replaceAll('Exception: ', '');
      setState(() {
        _isLoading = false;
        _errorMessage = cleanMsg;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final screenWidth = mediaQuery.size.width;
    final screenHeight = mediaQuery.size.height;

    // Responsive padding based on viewport dimensions
    final responsiveHorizontalPadding = (screenWidth * 0.055).clamp(16.0, 24.0);
    final responsiveVerticalPadding = (screenHeight * 0.02).clamp(12.0, 20.0);

    Widget content;
    switch (_step) {
      case 2:
        content = _buildOtpAndNewPasswordView(context);
        break;
      case 3:
        content = _buildSuccessConfirmationView(context);
        break;
      case 1:
      default:
        content = _buildPhoneInputView(context);
        break;
    }

    if (widget.isBottomSheet) {
      return SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Responsive Drag handle pill for bottom sheet
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Center(
                child: Container(
                  width: (screenWidth * 0.1).clamp(36.0, 48.0),
                  height: 4.5,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2.5),
                  ),
                ),
              ),
            ),
            // Flexible SingleChildScrollView dynamically shrinks/grows with zero overflow
            Flexible(
              fit: FlexFit.loose,
              child: SingleChildScrollView(
                physics: const ClampingScrollPhysics(),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: EdgeInsets.fromLTRB(
                  responsiveHorizontalPadding,
                  4,
                  responsiveHorizontalPadding,
                  responsiveVerticalPadding + (mediaQuery.padding.bottom > 0 ? mediaQuery.padding.bottom : 12.0),
                ),
                child: content,
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
          onPressed: () {
            if (_step == 2) {
              setState(() {
                _step = 1;
                _errorMessage = null;
              });
            } else {
              Navigator.pop(context);
            }
          },
        ),
        title: Text(
          _step == 2 ? 'Verify & Reset Password' : 'Reset Password',
          style: TextStyle(
            color: AppTheme.primaryNavy,
            fontSize: (screenWidth * 0.045).clamp(16.0, 19.0),
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.symmetric(
            horizontal: responsiveHorizontalPadding,
            vertical: responsiveVerticalPadding,
          ),
          child: content,
        ),
      ),
    );
  }

  /// Step 1: Input Mobile Number
  Widget _buildPhoneInputView(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final screenWidth = mediaQuery.size.width;
    final screenHeight = mediaQuery.size.height;

    final titleSize = (screenWidth * 0.058).clamp(20.0, 24.0);
    final subtitleSize = (screenWidth * 0.033).clamp(12.0, 13.5);
    final labelSize = (screenWidth * 0.033).clamp(12.0, 13.0);
    final buttonHeight = (screenHeight * 0.058).clamp(46.0, 52.0);
    final sectionGap = (screenHeight * 0.02).clamp(14.0, 22.0);

    return Form(
      key: _phoneFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.isBottomSheet) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: (screenWidth * 0.1).clamp(38.0, 44.0),
                  height: (screenWidth * 0.1).clamp(38.0, 44.0),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.lock_reset_rounded,
                    color: AppTheme.primaryNavy,
                    size: (screenWidth * 0.055).clamp(20.0, 24.0),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.grey),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            SizedBox(height: (screenHeight * 0.012).clamp(8.0, 12.0)),
          ],

          // Title & Subtitle
          Text(
            'Forgot Password?',
            style: TextStyle(
              fontSize: titleSize,
              fontWeight: FontWeight.w800,
              color: AppTheme.primaryNavy,
              letterSpacing: -0.5,
            ),
          ),
          SizedBox(height: (screenHeight * 0.008).clamp(6.0, 8.0)),
          Text(
            'Enter your registered 10-digit mobile number. We will send a secure 6-digit verification code directly to your phone via SMS.',
            style: TextStyle(
              fontSize: subtitleSize,
              color: const Color(0xFF6B7280),
              height: 1.4,
              fontWeight: FontWeight.w400,
            ),
          ),
          SizedBox(height: sectionGap),

          // Error Banner if present
          if (_errorMessage != null) ...[
            _buildErrorBanner(_errorMessage!),
            SizedBox(height: (screenHeight * 0.014).clamp(10.0, 16.0)),
          ],

          // Mobile Number Input Field
          Text(
            'Registered Mobile Number *',
            style: TextStyle(
              fontSize: labelSize,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            style: TextStyle(
              fontSize: (screenWidth * 0.04).clamp(14.0, 16.0),
              color: AppTheme.textDark,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.2,
            ),
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(10),
            ],
            decoration: InputDecoration(
              counterText: '',
              hintText: '98765 43210',
              hintStyle: TextStyle(
                fontSize: (screenWidth * 0.035).clamp(13.0, 14.0),
                color: Colors.grey.shade400,
                letterSpacing: 0,
              ),
              prefixIcon: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                margin: const EdgeInsets.only(right: 8),
                decoration: const BoxDecoration(
                  border: Border(
                    right: BorderSide(color: Color(0xFFE5E7EB), width: 1.5),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('🇮🇳', style: TextStyle(fontSize: 16)),
                    const SizedBox(width: 6),
                    Text(
                      '+91',
                      style: TextStyle(
                        fontSize: (screenWidth * 0.035).clamp(13.0, 14.0),
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                  ],
                ),
              ),
              fillColor: const Color(0xFFF6F8FB),
              filled: true,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: Color(0xFF0E274D),
                  width: 2,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626)),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626), width: 2),
              ),
            ),
            validator: (value) {
              final trimmed = value?.replaceAll(RegExp(r'\D'), '') ?? '';
              if (trimmed.isEmpty) {
                return 'Please enter your registered 10-digit mobile number.';
              }
              if (trimmed.length != 10) {
                return 'Mobile number must be exactly 10 digits.';
              }
              return null;
            },
          ),
          SizedBox(height: sectionGap),

          // Send SMS OTP Button
          SizedBox(
            width: double.infinity,
            height: buttonHeight,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0E274D),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: _isLoading ? null : _handleSendSmsOtp,
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.2,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.sms_rounded, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Send OTP via SMS',
                          style: TextStyle(
                            fontSize: (screenWidth * 0.038).clamp(14.0, 15.5),
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// Step 2: Enter 6-digit OTP & Set New Password
  Widget _buildOtpAndNewPasswordView(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final screenWidth = mediaQuery.size.width;
    final screenHeight = mediaQuery.size.height;

    final titleSize = (screenWidth * 0.052).clamp(18.0, 22.0);
    final subtitleSize = (screenWidth * 0.032).clamp(11.5, 13.0);
    final labelSize = (screenWidth * 0.032).clamp(11.5, 13.0);
    final fieldGap = (screenHeight * 0.015).clamp(10.0, 14.0);
    final buttonHeight = (screenHeight * 0.056).clamp(46.0, 52.0);

    return Form(
      key: _resetFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.isBottomSheet) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
                  onPressed: () {
                    setState(() {
                      _step = 1;
                      _errorMessage = null;
                    });
                  },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.grey),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            SizedBox(height: (screenHeight * 0.008).clamp(4.0, 8.0)),
          ],

          // Title & Phone badge
          Text(
            'Verify SMS & Set Password',
            style: TextStyle(
              fontSize: titleSize,
              fontWeight: FontWeight.w800,
              color: AppTheme.primaryNavy,
              letterSpacing: -0.4,
            ),
          ),
          SizedBox(height: (screenHeight * 0.006).clamp(4.0, 8.0)),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  'Enter the 6-digit OTP sent to +91 $_verifiedPhoneNumber and choose a new password.',
                  style: TextStyle(
                    fontSize: subtitleSize,
                    color: const Color(0xFF6B7280),
                    height: 1.35,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              TextButton(
                onPressed: () {
                  setState(() {
                    _step = 1;
                    _errorMessage = null;
                  });
                },
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'Change',
                  style: TextStyle(
                    fontSize: subtitleSize,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFFF16528),
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: fieldGap),

          // Error Banner if present
          if (_errorMessage != null) ...[
            _buildErrorBanner(_errorMessage!),
            SizedBox(height: fieldGap),
          ],

          // 6-digit SMS OTP Field
          Text(
            'Enter 6-digit SMS OTP *',
            style: TextStyle(
              fontSize: labelSize,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 5),
          TextFormField(
            controller: _otpController,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: (screenWidth * 0.052).clamp(18.0, 22.0),
              fontWeight: FontWeight.bold,
              letterSpacing: (screenWidth * 0.02).clamp(5.0, 8.0),
              color: AppTheme.primaryNavy,
            ),
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            decoration: InputDecoration(
              counterText: '',
              hintText: '••••••',
              hintStyle: TextStyle(
                fontSize: (screenWidth * 0.048).clamp(16.0, 20.0),
                letterSpacing: (screenWidth * 0.018).clamp(4.0, 8.0),
                color: Colors.grey.shade400,
              ),
              prefixIcon: const Icon(
                Icons.mark_chat_read_rounded,
                color: AppTheme.primaryNavy,
                size: 19,
              ),
              fillColor: const Color(0xFFF6F8FB),
              filled: true,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF0E274D), width: 2),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626)),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626), width: 2),
              ),
            ),
            validator: (val) {
              if (val == null || val.trim().length != 6) {
                return 'Please enter the 6-digit OTP code.';
              }
              return null;
            },
          ),
          SizedBox(height: fieldGap),

          // New Password Field
          Text(
            'New Password *',
            style: TextStyle(
              fontSize: labelSize,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 5),
          TextFormField(
            controller: _newPasswordController,
            obscureText: _obscureNewPassword,
            style: TextStyle(
              fontSize: (screenWidth * 0.036).clamp(13.0, 14.5),
              color: AppTheme.textDark,
              fontWeight: FontWeight.w500,
            ),
            decoration: InputDecoration(
              hintText: 'Enter new password',
              hintStyle: TextStyle(
                fontSize: (screenWidth * 0.033).clamp(12.0, 13.0),
                color: Colors.grey.shade400,
              ),
              prefixIcon: const Icon(
                Icons.lock_outline_rounded,
                color: AppTheme.primaryNavy,
                size: 19,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureNewPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: Colors.grey.shade600,
                  size: 19,
                ),
                onPressed: () {
                  setState(() {
                    _obscureNewPassword = !_obscureNewPassword;
                  });
                },
              ),
              fillColor: const Color(0xFFF6F8FB),
              filled: true,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF0E274D), width: 2),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626)),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626), width: 2),
              ),
            ),
            validator: (val) => AuthService.validatePassword(val),
          ),
          SizedBox(height: fieldGap),

          // Confirm Password Field
          Text(
            'Confirm New Password *',
            style: TextStyle(
              fontSize: labelSize,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 5),
          TextFormField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            style: TextStyle(
              fontSize: (screenWidth * 0.036).clamp(13.0, 14.5),
              color: AppTheme.textDark,
              fontWeight: FontWeight.w500,
            ),
            decoration: InputDecoration(
              hintText: 'Re-enter new password',
              hintStyle: TextStyle(
                fontSize: (screenWidth * 0.033).clamp(12.0, 13.0),
                color: Colors.grey.shade400,
              ),
              prefixIcon: const Icon(
                Icons.lock_reset_rounded,
                color: AppTheme.primaryNavy,
                size: 19,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirmPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: Colors.grey.shade600,
                  size: 19,
                ),
                onPressed: () {
                  setState(() {
                    _obscureConfirmPassword = !_obscureConfirmPassword;
                  });
                },
              ),
              fillColor: const Color(0xFFF6F8FB),
              filled: true,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF0E274D), width: 2),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626)),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626), width: 2),
              ),
            ),
            validator: (val) {
              if (val == null || val.isEmpty) {
                return 'Please confirm your new password.';
              }
              if (val != _newPasswordController.text) {
                return 'Passwords do not match.';
              }
              return null;
            },
          ),
          SizedBox(height: (screenHeight * 0.012).clamp(8.0, 12.0)),

          // Security password requirements note
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F4F8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined, size: 15, color: AppTheme.primaryNavy),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    'Must be 8+ chars with uppercase (A-Z), lowercase (a-z), digit (0-9), & special symbol (!@#\$%^&*).',
                    style: TextStyle(
                      fontSize: (screenWidth * 0.029).clamp(10.5, 11.5),
                      color: AppTheme.primaryNavy,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: fieldGap * 1.2),

          // Reset Password Button
          SizedBox(
            width: double.infinity,
            height: buttonHeight,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0E274D),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: _isLoading ? null : _handleResetPassword,
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.2,
                      ),
                    )
                  : Text(
                      'Reset Password',
                      style: TextStyle(
                        fontSize: (screenWidth * 0.038).clamp(14.0, 15.5),
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.3,
                      ),
                    ),
            ),
          ),
          SizedBox(height: (screenHeight * 0.01).clamp(6.0, 10.0)),

          // Resend OTP via SMS with Cooldown
          Center(
            child: TextButton(
              onPressed: _cooldownSeconds > 0 || _isLoading ? null : _handleResendOtp,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 15,
                      height: 15,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.8,
                        color: Color(0xFFF16528),
                      ),
                    )
                  : Text(
                      _cooldownSeconds > 0
                          ? 'Resend SMS code in ${_cooldownSeconds}s'
                          : 'Resend OTP via SMS',
                      style: TextStyle(
                        fontSize: (screenWidth * 0.032).clamp(11.5, 13.0),
                        fontWeight: FontWeight.w600,
                        color: _cooldownSeconds > 0
                            ? Colors.grey.shade400
                            : const Color(0xFFF16528),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// Step 3: Success Confirmation View
  Widget _buildSuccessConfirmationView(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final screenWidth = mediaQuery.size.width;
    final screenHeight = mediaQuery.size.height;

    final iconSize = (screenWidth * 0.16).clamp(56.0, 72.0);
    final titleSize = (screenWidth * 0.052).clamp(18.0, 22.0);
    final textSize = (screenWidth * 0.033).clamp(12.0, 13.5);
    final buttonHeight = (screenHeight * 0.056).clamp(46.0, 52.0);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(height: (screenHeight * 0.015).clamp(10.0, 16.0)),
        Container(
          width: iconSize,
          height: iconSize,
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFFA7F3D0), width: 2),
          ),
          child: Icon(
            Icons.check_circle_rounded,
            color: const Color(0xFF059669),
            size: iconSize * 0.55,
          ),
        ),
        SizedBox(height: (screenHeight * 0.02).clamp(14.0, 20.0)),

        Text(
          'Password Reset Successfully!',
          style: TextStyle(
            fontSize: titleSize,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF0E274D),
            letterSpacing: -0.4,
          ),
          textAlign: TextAlign.center,
        ),
        SizedBox(height: (screenHeight * 0.01).clamp(6.0, 10.0)),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: TextStyle(
              fontSize: textSize,
              color: const Color(0xFF4B5563),
              height: 1.5,
            ),
            children: [
              const TextSpan(text: 'Your password for mobile number '),
              TextSpan(
                text: '+91 $_verifiedPhoneNumber',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0E274D),
                ),
              ),
              const TextSpan(
                text:
                    ' has been updated. You can now log in securely using your mobile number and new password.',
              ),
            ],
          ),
        ),
        SizedBox(height: (screenHeight * 0.03).clamp(20.0, 32.0)),

        // Primary Button: Back to Login
        SizedBox(
          width: double.infinity,
          height: buttonHeight,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0E274D),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () {
              Navigator.pop(context, _verifiedPhoneNumber);
            },
            child: Text(
              'Back to Login',
              style: TextStyle(
                fontSize: (screenWidth * 0.038).clamp(14.0, 15.5),
                fontWeight: FontWeight.bold,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ),
        SizedBox(height: (screenHeight * 0.01).clamp(8.0, 12.0)),
      ],
    );
  }

  /// Reusable Error Banner
  Widget _buildErrorBanner(String message) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF991B1B),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

