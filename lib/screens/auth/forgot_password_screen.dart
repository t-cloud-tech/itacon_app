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

  /// Static helper to launch ForgotPasswordScreen as a luxury bottom sheet
  static Future<String?> showAsBottomSheet(
    BuildContext context, {
    String? initialPhone,
    String? initialEmail,
  }) {
    final effectivePhone = initialPhone ?? initialEmail;
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          clipBehavior: Clip.antiAlias,
          child: ForgotPasswordScreen(
            initialPhone: effectivePhone,
            isBottomSheet: true,
          ),
        ),
      ),
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
      onCodeSent: (verificationId) {
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
      onCodeSent: (verificationId) {
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
    Widget content;
    switch (_step) {
      case 2:
        content = _buildOtpAndNewPasswordView();
        break;
      case 3:
        content = _buildSuccessConfirmationView();
        break;
      case 1:
      default:
        content = _buildPhoneInputView();
        break;
    }

    final scrollableContent = SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
      child: content,
    );

    if (widget.isBottomSheet) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle pill for bottom sheet
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          scrollableContent,
        ],
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
          style: const TextStyle(
            color: AppTheme.primaryNavy,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(child: scrollableContent),
    );
  }

  /// Step 1: Input Mobile Number
  Widget _buildPhoneInputView() {
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
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.lock_reset_rounded,
                    color: AppTheme.primaryNavy,
                    size: 24,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.grey),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],

          // Title & Subtitle
          const Text(
            'Forgot Password?',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppTheme.primaryNavy,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Enter your registered 10-digit mobile number. We will send a secure 6-digit verification code directly to your phone via SMS.',
            style: TextStyle(
              fontSize: 13.5,
              color: Color(0xFF6B7280),
              height: 1.4,
              fontWeight: FontWeight.w400,
            ),
          ),
          const SizedBox(height: 24),

          // Error Banner if present
          if (_errorMessage != null) ...[
            _buildErrorBanner(_errorMessage!),
            const SizedBox(height: 16),
          ],

          // Mobile Number Input Field
          const Text(
            'Registered Mobile Number *',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            style: const TextStyle(
              fontSize: 15,
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
                fontSize: 14,
                color: Colors.grey.shade400,
                letterSpacing: 0,
              ),
              prefixIcon: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                margin: const EdgeInsets.only(right: 8),
                decoration: const BoxDecoration(
                  border: Border(
                    right: BorderSide(color: Color(0xFFE5E7EB), width: 1.5),
                  ),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('🇮🇳', style: TextStyle(fontSize: 16)),
                    SizedBox(width: 6),
                    Text(
                      '+91',
                      style: TextStyle(
                        fontSize: 14,
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
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
          const SizedBox(height: 28),

          // Send SMS OTP Button
          SizedBox(
            width: double.infinity,
            height: 50,
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
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.sms_rounded, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Send OTP via SMS',
                          style: TextStyle(
                            fontSize: 15,
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
  Widget _buildOtpAndNewPasswordView() {
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
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.grey),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],

          // Title & Phone badge
          const Text(
            'Verify SMS & Set Password',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppTheme.primaryNavy,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Enter the 6-digit OTP sent to +91 $_verifiedPhoneNumber and choose a new password.',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF6B7280),
                    height: 1.4,
                  ),
                ),
              ),
              TextButton(
                onPressed: () {
                  setState(() {
                    _step = 1;
                    _errorMessage = null;
                  });
                },
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Change',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFF16528),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Error Banner if present
          if (_errorMessage != null) ...[
            _buildErrorBanner(_errorMessage!),
            const SizedBox(height: 16),
          ],

          // 6-digit SMS OTP Field
          const Text(
            'Enter 6-digit SMS OTP *',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _otpController,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              letterSpacing: 10,
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
                fontSize: 20,
                letterSpacing: 8,
                color: Colors.grey.shade400,
              ),
              prefixIcon: const Icon(
                Icons.mark_chat_read_rounded,
                color: AppTheme.primaryNavy,
                size: 20,
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
              if (val == null || val.trim().length != 6) {
                return 'Please enter the 6-digit OTP code.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),

          // New Password Field
          const Text(
            'New Password *',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _newPasswordController,
            obscureText: _obscureNewPassword,
            style: const TextStyle(
              fontSize: 14,
              color: AppTheme.textDark,
              fontWeight: FontWeight.w500,
            ),
            decoration: InputDecoration(
              hintText: 'Enter new password',
              hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
              prefixIcon: const Icon(
                Icons.lock_outline_rounded,
                color: AppTheme.primaryNavy,
                size: 20,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureNewPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: Colors.grey.shade600,
                  size: 20,
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
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
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
          const SizedBox(height: 16),

          // Confirm Password Field
          const Text(
            'Confirm New Password *',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryNavy,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            style: const TextStyle(
              fontSize: 14,
              color: AppTheme.textDark,
              fontWeight: FontWeight.w500,
            ),
            decoration: InputDecoration(
              hintText: 'Re-enter new password',
              hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
              prefixIcon: const Icon(
                Icons.lock_reset_rounded,
                color: AppTheme.primaryNavy,
                size: 20,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirmPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: Colors.grey.shade600,
                  size: 20,
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
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
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
          const SizedBox(height: 12),

          // Security password requirements note
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F4F8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.shield_outlined, size: 16, color: AppTheme.primaryNavy),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Must be 8+ chars with uppercase (A-Z), lowercase (a-z), digit (0-9), & special symbol (!@#\$%^&*).',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: AppTheme.primaryNavy,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Reset Password Button
          SizedBox(
            width: double.infinity,
            height: 50,
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
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : const Text(
                      'Reset Password',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.3,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 14),

          // Resend OTP via SMS with Cooldown
          Center(
            child: TextButton(
              onPressed: _cooldownSeconds > 0 || _isLoading ? null : _handleResendOtp,
              child: _isLoading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Color(0xFFF16528),
                      ),
                    )
                  : Text(
                      _cooldownSeconds > 0
                          ? 'Resend SMS code in ${_cooldownSeconds}s'
                          : 'Resend OTP via SMS',
                      style: TextStyle(
                        fontSize: 13,
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
  Widget _buildSuccessConfirmationView() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 16),
        Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFFA7F3D0), width: 2),
          ),
          child: const Icon(
            Icons.check_circle_rounded,
            color: Color(0xFF059669),
            size: 42,
          ),
        ),
        const SizedBox(height: 20),

        const Text(
          'Password Reset Successfully!',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0E274D),
            letterSpacing: -0.4,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 10),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: const TextStyle(
              fontSize: 13.5,
              color: Color(0xFF4B5563),
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
        const SizedBox(height: 32),

        // Primary Button: Back to Login
        SizedBox(
          width: double.infinity,
          height: 50,
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
            child: const Text(
              'Back to Login',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  /// Reusable Error Banner
  Widget _buildErrorBanner(String message) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 12.5,
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
