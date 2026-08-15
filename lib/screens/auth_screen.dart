import 'package:flutter/material.dart';
import '../models/user_category.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import 'home_screen.dart';
import 'referral_gate_screen.dart';

enum AuthViewMode { choice, login, signup }

class AuthScreen extends StatefulWidget {
  final AuthViewMode initialMode;

  const AuthScreen({
    super.key,
    this.initialMode = AuthViewMode.choice,
  });

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late AuthViewMode _viewMode;

  final AuthService _authService = AuthService();
  final FirestoreService _firestoreService = FirestoreService();
  final _formKey = GlobalKey<FormState>();

  // Login Controllers
  final _loginUsernameController = TextEditingController();
  final _loginPhoneController = TextEditingController();
  final _loginOtpController = TextEditingController();
  final _loginPasswordController = TextEditingController();
  final _loginReferralCodeController = TextEditingController();

  final _loginFormKey = GlobalKey<FormState>();

  // Login Step & OTP state
  int _loginStep = 1;
  bool _loginOtpSent = false;

  void _requestLoginOtp() async {
    final phone = _loginPhoneController.text.trim();
    if (phone.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please enter a valid 10-digit mobile number.')),
      );
      return;
    }
    setState(() => _isLoading = true);
    await _authService.sendOtp(
      phoneNumber: '+91$phone',
      onCodeSent: (verId) {
        if (!mounted) return;
        setState(() {
          _loginOtpSent = true;
          _isLoading = false;
          if (verId.startsWith('MOCK_')) {
            _loginOtpController.text = '123456';
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(verId.startsWith('MOCK_')
                ? 'OTP sent successfully! (Auto-filled test code: 123456)'
                : 'OTP Code sent successfully!'),
          ),
        );
      },
      onError: (err) {
        if (!mounted) return;
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(err)));
      },
    );
  }

  // Registration Controllers
  final _regFullNameController = TextEditingController();
  final _regCompanyNameController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regOtpController = TextEditingController();
  final _regPasswordController = TextEditingController();
  final _regConfirmPasswordController = TextEditingController();

  String? _selectedCategory;

  // OTP State
  String? _verificationId;
  bool _otpSent = false;
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  int _signupStep = 1;

  @override
  void initState() {
    super.initState();
    _viewMode = widget.initialMode;
  }

  @override
  void dispose() {
    _loginUsernameController.dispose();
    _loginPhoneController.dispose();
    _loginOtpController.dispose();
    _loginPasswordController.dispose();
    _loginReferralCodeController.dispose();
    _regFullNameController.dispose();
    _regCompanyNameController.dispose();
    _regPhoneController.dispose();
    _regOtpController.dispose();
    _regPasswordController.dispose();
    _regConfirmPasswordController.dispose();
    super.dispose();
  }

  void _requestOtp() async {
    final phone = _regPhoneController.text.trim();
    if (phone.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please enter a valid 10-digit mobile number.')),
      );
      return;
    }
    setState(() => _isLoading = true);
    await _authService.sendOtp(
      phoneNumber: '+91$phone',
      onCodeSent: (verId) {
        if (!mounted) return;
        setState(() {
          _verificationId = verId;
          _otpSent = true;
          _isLoading = false;
          if (verId.startsWith('MOCK_')) {
            _regOtpController.text = '123456';
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(verId.startsWith('MOCK_')
                ? 'OTP sent successfully! (Auto-filled test code: 123456)'
                : 'OTP sent successfully! Check SMS.'),
            duration: const Duration(seconds: 4),
          ),
        );
      },
      onError: (err) {
        if (!mounted) return;
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(err)));
      },
    );
  }



  void _handleRegistration() async {
    if (!_formKey.currentState!.validate()) return;

    if (_regPasswordController.text != _regConfirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Passwords do not match.')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await _authService.registerUser(
        fullName: _regFullNameController.text.trim(),
        phoneNumber: '+91${_regPhoneController.text.trim()}',
        categoryId: _selectedCategory ?? UserCategory.allCategories.first.id,
        password: _regPasswordController.text.trim(),
        companyName: _regCompanyNameController.text.trim(),
        verificationId: _verificationId,
        smsCode: _regOtpController.text.trim(),
      );

      final uid = _authService.currentUser?.uid;
      bool hasSalesperson = false;
      if (uid != null && uid.isNotEmpty) {
        final profile = await _firestoreService.getUserProfile(uid);
        if (profile != null &&
            profile.salesPersonId != null &&
            profile.salesPersonId!.isNotEmpty) {
          hasSalesperson = true;
        }
      }

      setState(() => _isLoading = false);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Registration Successful! Executive linked.')),
      );

      if (hasSalesperson) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const HomeScreen()),
        );
      } else {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const ReferralGateScreen()),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Registration error: ${e.toString()}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _viewMode == AuthViewMode.choice,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _viewMode != AuthViewMode.choice) {
          setState(() {
            _viewMode = AuthViewMode.choice;
          });
        }
      },
      child: Scaffold(
        backgroundColor: _viewMode == AuthViewMode.choice
            ? Colors.white
            : const Color(0xFFF8F9FA),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    switch (_viewMode) {
      case AuthViewMode.choice:
        return _buildChoiceView();
      case AuthViewMode.login:
        return _buildLoginView();
      case AuthViewMode.signup:
        return _buildSignupView();
    }
  }

  // ===========================================================================
  // 1. LANDING / CHOICE VIEW (Matches User Image)
  // ===========================================================================
  Widget _buildChoiceView() {
    return Column(
      children: [
        // Upper section with logo and texture background
        Expanded(
          child: Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: Colors.white,
            ),
            child: Stack(
              children: [
                // Texture background image (or white fallback if not present)
                Positioned.fill(
                  child: Image.asset(
                    'assets/images/auth_bg.png',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Image.asset(
                        'assets/images/auth_bg.jpg',
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(color: Colors.white);
                        },
                      );
                    },
                  ),
                ),
                // Centered Logo
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32.0),
                    child: Image.asset(
                      'assets/images/itacon-logo.png',
                      width: 240,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) {
                        return _buildFallbackLogo();
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        // Lower section (Dark Blue Bottom Card)
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(28, 36, 28, 48),
          decoration: const BoxDecoration(
            color: Color(0xFF2C4C94),
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(32),
              topRight: Radius.circular(32),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              // Login Button (Solid Orange)
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF16528),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: () {
                    setState(() {
                      _viewMode = AuthViewMode.login;
                    });
                  },
                  child: const Text(
                    'Login',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Sign Up Button (Orange Outline on Blue)
              SizedBox(
                width: double.infinity,
                height: 54,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    backgroundColor: const Color(0xFF2C4C94),
                    foregroundColor: Colors.white,
                    side: const BorderSide(
                      color: Color(0xFFF16528),
                      width: 2.0,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: () {
                    setState(() {
                      _viewMode = AuthViewMode.signup;
                    });
                  },
                  child: const Text(
                    'Sign Up',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFallbackLogo() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        RichText(
          text: const TextSpan(
            style: TextStyle(
              fontSize: 38,
              fontWeight: FontWeight.w900,
              color: Color(0xFF2C4C94),
              letterSpacing: 1.5,
            ),
            children: [
              TextSpan(
                text: 'İ',
                style: TextStyle(color: Color(0xFFF16528)),
              ),
              TextSpan(text: 'TACON'),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 36, height: 1.5, color: const Color(0xFF2C4C94)),
            const SizedBox(width: 10),
            const Text(
              'GRANITO',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2C4C94),
                letterSpacing: 4.0,
              ),
            ),
            const SizedBox(width: 10),
            Container(width: 36, height: 1.5, color: const Color(0xFF2C4C94)),
          ],
        ),
      ],
    );
  }

  void _handleLogin() async {
    if (!_loginFormKey.currentState!.validate()) return;

    if (_loginStep == 1) {
      if (!_loginOtpSent || _loginOtpController.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please request and enter the OTP code.')),
        );
        return;
      }
      // Proceed to Step 2
      setState(() {
        _loginStep = 2;
      });
      return;
    }

    // Step 2: Final Submission
    final referralInput = _loginReferralCodeController.text.trim();
    if (referralInput.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sales Representative Referral Code is required.')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final identifier = _loginUsernameController.text.trim().isNotEmpty
          ? _loginUsernameController.text.trim()
          : '+91${_loginPhoneController.text.trim()}';

      await _authService.loginUser(
        loginIdentifier: identifier,
        password: _loginPasswordController.text.trim(),
        referralCode: referralInput,
      );

      final uid = _authService.currentUser?.uid;
      if (uid != null && uid.isNotEmpty) {
        final profile = await _firestoreService.getUserProfile(uid);
        if (profile == null ||
            profile.salesPersonId == null ||
            profile.salesPersonId!.isEmpty) {
          await _authService.autoAssignSalesperson(targetUserId: uid);
        }
      }

      setState(() => _isLoading = false);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign In Successful! Welcome to ITACON.')),
      );

      // DIRECT ACCESS TO APP HOME SCREEN FOR ALL SIGN-IN USERS
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const HomeScreen()),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      final errorText = e.toString().replaceAll('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(errorText),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  // ===========================================================================
  // 2. LOGIN VIEW SCREEN
  // ===========================================================================
  Widget _buildLoginView() {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // 1. Top Navigation Bar (Back Button + Centered Brand Logo)
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16.0, vertical: 2.0),
              child: SizedBox(
                height: 54,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: InkWell(
                        onTap: () {
                          if (_loginStep > 1) {
                            setState(() => _loginStep--);
                          } else {
                            setState(() {
                              _viewMode = AuthViewMode.choice;
                            });
                          }
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(
                              horizontal: 4.0, vertical: 2.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.arrow_back_rounded,
                                  color: Color(0xFF1B365D), size: 20),
                              SizedBox(width: 4),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Center(
                      child: Image.asset(
                        'assets/images/itacon-logo.png',
                        height: 48,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) =>
                            _buildHeaderLogoSmall(),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 2. Banner & White Form Container
            Expanded(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // 2.1 Header Banner (Height: 230)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 230,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: Image.asset(
                            'assets/images/auth_bg.png',
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) =>
                                Container(color: Colors.white),
                          ),
                        ),
                        Positioned.fill(
                          child: ClipPath(
                            clipper: CurvedBannerClipper(),
                            child: Image.asset(
                              'assets/images/signup_banner.png',
                              fit: BoxFit.cover,
                              alignment: Alignment.centerLeft,
                              errorBuilder: (context, error, stackTrace) {
                                return Image.asset(
                                  'assets/images/signup_banner.jpeg',
                                  fit: BoxFit.cover,
                                  alignment: Alignment.centerLeft,
                                  errorBuilder: (context, error, stackTrace) {
                                    return Container(
                                      color: const Color(0xFF1B365D),
                                      child: const Center(
                                        child: Icon(
                                          Icons.home_outlined,
                                          color: Colors.white24,
                                          size: 48,
                                        ),
                                      ),
                                    );
                                  },
                                );
                              },
                            ),
                          ),
                        ),
                        Positioned(
                          left: 20,
                          top: 25,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Welcome\nBack!',
                                style: TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1B365D),
                                  height: 1.15,
                                ),
                              ),
                              Container(
                                margin:
                                    const EdgeInsets.symmetric(vertical: 5),
                                width: 36,
                                height: 3.5,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF16528),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              const Text(
                                'Sign in to your account',
                                style: TextStyle(
                                  fontSize: 15,
                                  color: Color(0xFF757575),
                                  fontWeight: FontWeight.w400,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // 2.2 White Form Sheet Container (Overlaps 30px over bottom of banner)
                  Positioned.fill(
                    top: 200,
                    child: Container(
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(28),
                          topRight: Radius.circular(28),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black12,
                            blurRadius: 10,
                            offset: Offset(0, -3),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.fromLTRB(20, 38, 20, 14),
                      child: Form(
                        key: _loginFormKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // 2-Step Timeline Indicator for Login
                            _buildLoginTimelineIndicator(),
                            const SizedBox(height: 12),

                            Expanded(
                              child: SingleChildScrollView(
                                physics: const ClampingScrollPhysics(),
                                child: _buildLoginFormFields(),
                              ),
                            ),
                            const SizedBox(height: 10),

                            // Login Action Button
                            _buildLoginActionButton(),
                            const SizedBox(height: 8),

                            // Footer Sign Up Link
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Text(
                                  "Don't have an account? ",
                                  style: TextStyle(
                                      color: Color(0xFF6B7280), fontSize: 13),
                                ),
                                GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _viewMode = AuthViewMode.signup;
                                    });
                                  },
                                  child: const Text(
                                    'Sign up',
                                    style: TextStyle(
                                      color: Color(0xFF1B365D),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // 2.3 Centered Floating Avatar Badge (Centered at top edge of white sheet)
                  Positioned(
                    top: 179,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: const Color(0xFF1B365D),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.15),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                          border: Border.all(color: Colors.white, width: 2.5),
                        ),
                        child: const Icon(
                          Icons.lock_outline_rounded,
                          color: Colors.white,
                          size: 21,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // LOGIN TIMELINE INDICATOR (2 STEPS)
  // ===========================================================================
  Widget _buildLoginTimelineIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40.0),
      child: Row(
        children: [
          _buildLoginTimelineStep(stepNumber: 1, label: 'Account & OTP'),
          Expanded(child: _buildTimelineDashedLine(isPassed: _loginStep > 1)),
          _buildLoginTimelineStep(stepNumber: 2, label: 'Sales Code'),
        ],
      ),
    );
  }

  Widget _buildLoginTimelineStep({required int stepNumber, required String label}) {
    final isActive = _loginStep == stepNumber;
    final isPassed = _loginStep > stepNumber;

    return GestureDetector(
      onTap: stepNumber < _loginStep
          ? () {
              setState(() {
                _loginStep = stepNumber;
              });
            }
          : null,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isActive || isPassed
                  ? const Color(0xFF1B365D)
                  : Colors.white,
              border: Border.all(
                color: isActive || isPassed
                    ? const Color(0xFF1B365D)
                    : Colors.grey.shade300,
                width: 1.5,
              ),
            ),
            child: Center(
              child: isPassed
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : Text(
                      '$stepNumber',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isActive ? Colors.white : Colors.grey.shade600,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight:
                  isActive || isPassed ? FontWeight.bold : FontWeight.w500,
              color: isActive || isPassed
                  ? const Color(0xFF1B365D)
                  : Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // LOGIN FORM FIELDS AND BUTTON
  // ===========================================================================
  Widget _buildLoginFormFields() {
    if (_loginStep == 1) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 4),
          // Username
          _buildFieldLabel('Username'),
          _buildCustomInputField(
            controller: _loginUsernameController,
            hintText: 'Enter Username',
            prefixIcon: Icons.person_outline_rounded,
          ),
          const SizedBox(height: 12),

          // Mobile Number + OTP Button
          _buildFieldLabel('Mobile Number *'),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _buildCustomInputField(
                  controller: _loginPhoneController,
                  hintText: '9876543210',
                  prefixIcon: Icons.phone_iphone_outlined,
                  prefixText: '+91 ',
                  keyboardType: TextInputType.phone,
                  validator: (v) => v == null || v.trim().length < 10
                      ? 'Enter 10-digit mobile number'
                      : null,
                ),
              ),
              const SizedBox(width: 6),
              SizedBox(
                height: 38,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1B365D),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _isLoading ? null : _requestLoginOtp,
                  child: Text(
                    _loginOtpSent ? 'Resend' : 'Send OTP',
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // OTP Field if sent
          if (_loginOtpSent) ...[
            _buildFieldLabel('Enter 6-Digit OTP *'),
            _buildCustomInputField(
              controller: _loginOtpController,
              hintText: '• • • • • •',
              prefixIcon: Icons.pin_outlined,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              validator: (v) => v == null || v.trim().length < 6
                  ? 'Enter 6-digit OTP'
                  : null,
            ),
            const SizedBox(height: 12),
          ],

          // Password
          _buildFieldLabel('Password *'),
          _buildCustomInputField(
            controller: _loginPasswordController,
            hintText: 'Enter your password',
            prefixIcon: Icons.lock_outline_rounded,
            obscureText: _obscurePassword,
            suffixIcon: IconButton(
              constraints: const BoxConstraints(maxHeight: 38, maxWidth: 38),
              icon: Icon(
                _obscurePassword
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                color: Colors.grey.shade600,
                size: 18,
              ),
              onPressed: () =>
                  setState(() => _obscurePassword = !_obscurePassword),
            ),
            validator: (v) => v == null || v.isEmpty
                ? 'Enter your password'
                : null,
          ),
        ],
      );
    } else {
      // STEP 2: Sales Representative Referral Code
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          _buildFieldLabel('Sales Representative Referral Code *'),
          _buildCustomInputField(
            controller: _loginReferralCodeController,
            hintText: 'e.g., SALES123',
            prefixIcon: Icons.qr_code_outlined,
            textCapitalization: TextCapitalization.characters,
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Sales representative referral code is mandatory'
                : null,
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF1B365D).withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: const Color(0xFF1B365D).withValues(alpha: 0.15)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline_rounded,
                    color: Color(0xFF1B365D), size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Please enter the referral code of your assigned Sales Representative to proceed.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF1B365D),
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }
  }

  Widget _buildLoginActionButton() {
    final isFinalStep = _loginStep == 2;
    return SizedBox(
      height: 44,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF1B365D),
          foregroundColor: Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        onPressed: _isLoading ? null : _handleLogin,
        child: _isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 2))
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    isFinalStep ? 'Sign In' : 'Continue',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_rounded, size: 18),
                ],
              ),
      ),
    );
  }

  // ===========================================================================
  // 3. SIGNUP VIEW SCREEN (Redesigned matching requested mockup)
  // ===========================================================================
  Widget _buildSignupView() {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // 1. Top Navigation Bar (Back Button + Centered Brand Logo)
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16.0, vertical: 2.0),
              child: SizedBox(
                height: 54,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: InkWell(
                        onTap: () {
                          if (_signupStep > 1) {
                            setState(() => _signupStep--);
                          } else {
                            setState(() => _viewMode = AuthViewMode.choice);
                          }
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(
                              horizontal: 4.0, vertical: 2.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.arrow_back_rounded,
                                  color: Color(0xFF1B365D), size: 20),
                              SizedBox(width: 4),
                              // Text(
                              //   'Back',
                              //   style: TextStyle(
                              //     fontSize: 14,
                              //     fontWeight: FontWeight.w600,
                              //     color: Color(0xFF1B365D),
                              //   ),
                              // ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Center(
                      child: Image.asset(
                        'assets/images/itacon-logo.png',
                        height: 48,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) =>
                            _buildHeaderLogoSmall(),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 2. Banner & White Form Container (Overlapping Layout without any Gap)
            Expanded(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // 2.1 Header Banner (Height: 230)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 230,
                    child: Stack(
                      children: [
                        // Texture background image
                        Positioned.fill(
                          child: Image.asset(
                            'assets/images/auth_bg.png',
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) =>
                                Container(color: Colors.white),
                          ),
                        ),
                        // Right side curved image clip spanning full width
                        Positioned.fill(
                          child: ClipPath(
                            clipper: CurvedBannerClipper(),
                            child: Image.asset(
                              'assets/images/signup_banner.png',
                              fit: BoxFit.cover,
                              alignment: Alignment.centerLeft,
                              errorBuilder: (context, error, stackTrace) {
                                return Image.asset(
                                  'assets/images/signup_banner.jpeg',
                                  fit: BoxFit.cover,
                                  alignment: Alignment.centerLeft,
                                  errorBuilder: (context, error, stackTrace) {
                                    return Container(
                                      color: const Color(0xFF1B365D),
                                      child: const Center(
                                        child: Icon(
                                          Icons.home_outlined,
                                          color: Colors.white24,
                                          size: 48,
                                        ),
                                      ),
                                    );
                                  },
                                );
                              },
                            ),
                          ),
                        ),
                        // Left side text block
                        Positioned(
                          left: 20,
                          top: 25,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Create your\naccount',
                                style: TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1B365D),
                                  height: 1.15,
                                ),
                              ),
                              Container(
                                margin:
                                    const EdgeInsets.symmetric(vertical: 5),
                                width: 36,
                                height: 3.5,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF16528),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              const Text(
                                "Let's get you started",
                                style: TextStyle(
                                  fontSize: 15,
                                  color: Color(0xFF757575),
                                  fontWeight: FontWeight.w400,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // 2.2 White Form Sheet Container (Overlaps 30px over bottom of banner!)
                  Positioned.fill(
                    top: 200,
                    child: Container(
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(28),
                          topRight: Radius.circular(28),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black12,
                            blurRadius: 10,
                            offset: Offset(0, -3),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.fromLTRB(20, 38, 20, 14),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // 3.1 TIMELINE STEP INDICATOR (BEFORE ALL FIELDS)
                            _buildTimelineIndicator(),
                            const SizedBox(height: 12),

                            // 3.2 STEP FIELD INPUTS
                            Expanded(
                              child: SingleChildScrollView(
                                physics: const ClampingScrollPhysics(),
                                child: _buildStepFields(),
                              ),
                            ),
                            const SizedBox(height: 10),

                            // 3.3 CONTINUE / ACTION BUTTON
                            _buildSignupActionButton(),
                            const SizedBox(height: 8),

                            // 3.4 FOOTER LOG IN LINK
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Text(
                                  "Already have an account? ",
                                  style: TextStyle(
                                      color: Color(0xFF6B7280), fontSize: 13),
                                ),
                                GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _viewMode = AuthViewMode.login;
                                    });
                                  },
                                  child: const Text(
                                    'Log in',
                                    style: TextStyle(
                                      color: Color(0xFF1B365D),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // 2.3 Centered Floating Avatar Badge (Centered at top edge of white sheet)
                  Positioned(
                    top: 179, // Centered vertically on y = 200 seam
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: const Color(0xFF1B365D),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.15),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                          border: Border.all(color: Colors.white, width: 2.5),
                        ),
                        child: const Icon(
                          Icons.person_outline_rounded,
                          color: Colors.white,
                          size: 21,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderLogoSmall() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        RichText(
          text: const TextSpan(
            style: TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1B365D),
              letterSpacing: 1.5,
            ),
            children: [
              TextSpan(text: 'İ', style: TextStyle(color: Color(0xFFF16528))),
              TextSpan(text: 'TACON'),
            ],
          ),
        ),
        const SizedBox(height: 2),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 24, height: 1.5, color: const Color(0xFF1B365D)),
            const SizedBox(width: 6),
            const Text(
              'GRANITO',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1B365D),
                letterSpacing: 3.0,
              ),
            ),
            const SizedBox(width: 6),
            Container(width: 24, height: 1.5, color: const Color(0xFF1B365D)),
          ],
        ),
      ],
    );
  }

  // ===========================================================================
  // TIMELINE INDICATOR (Positioned BEFORE fields)
  // ===========================================================================
  Widget _buildTimelineIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40.0),
      child: Row(
        children: [
          _buildTimelineStep(stepNumber: 1, label: 'Account'),
          Expanded(child: _buildTimelineDashedLine(isPassed: _signupStep > 1)),
          _buildTimelineStep(stepNumber: 2, label: 'Personal'),
        ],
      ),
    );
  }

  Widget _buildTimelineStep({required int stepNumber, required String label}) {
    final isActive = _signupStep == stepNumber;
    final isPassed = _signupStep > stepNumber;

    return GestureDetector(
      onTap: stepNumber < _signupStep
          ? () {
              setState(() {
                _signupStep = stepNumber;
              });
            }
          : null,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isActive || isPassed
                  ? const Color(0xFF1B365D)
                  : Colors.white,
              border: Border.all(
                color: isActive || isPassed
                    ? const Color(0xFF1B365D)
                    : Colors.grey.shade300,
                width: 1.5,
              ),
            ),
            child: Center(
              child: isPassed
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : Text(
                      '$stepNumber',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isActive ? Colors.white : Colors.grey.shade600,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight:
                  isActive || isPassed ? FontWeight.bold : FontWeight.w500,
              color: isActive || isPassed
                  ? const Color(0xFF1B365D)
                  : Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineDashedLine({required bool isPassed}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14.0, left: 4.0, right: 4.0),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final boxWidth = constraints.maxWidth;
          const dashWidth = 4.0;
          const dashSpace = 3.0;
          final dashCount = (boxWidth / (dashWidth + dashSpace)).floor();
          return Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(dashCount > 0 ? dashCount : 1, (_) {
              return SizedBox(
                width: dashWidth,
                height: 1.5,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: isPassed
                        ? const Color(0xFF1B365D)
                        : Colors.grey.shade300,
                  ),
                ),
              );
            }),
          );
        },
      ),
    );
  }

  // ===========================================================================
  // FORM FIELDS PER STEP
  // ===========================================================================
  Widget _buildStepFields() {
    switch (_signupStep) {
      case 1:
        return _buildAccountStepFields();
      case 2:
        return _buildPersonalStepFields();
      default:
        return _buildAccountStepFields();
    }
  }

  Widget _buildAccountStepFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Full Name
        _buildFieldLabel('Full Name'),
        _buildCustomInputField(
          controller: _regFullNameController,
          hintText: 'Enter your full name',
          prefixIcon: Icons.person_outline_rounded,
          validator: (v) =>
              v == null || v.trim().isEmpty ? 'Enter your full name' : null,
        ),
        const SizedBox(height: 8),

        // Mobile Number + OTP Button
        _buildFieldLabel('Mobile Number *'),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildCustomInputField(
                controller: _regPhoneController,
                hintText: '9876543210',
                prefixIcon: Icons.phone_iphone_outlined,
                prefixText: '+91 ',
                keyboardType: TextInputType.phone,
                validator: (v) => v == null || v.trim().length < 10
                    ? 'Enter 10-digit number'
                    : null,
              ),
            ),
            const SizedBox(width: 6),
            SizedBox(
              height: 38,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B365D),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _isLoading ? null : _requestOtp,
                child: Text(
                  _otpSent ? 'Resend' : 'Send OTP',
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // OTP Field if sent
        if (_otpSent) ...[
          _buildFieldLabel('Enter 6-Digit OTP *'),
          _buildCustomInputField(
            controller: _regOtpController,
            hintText: '• • • • • •',
            prefixIcon: Icons.pin_outlined,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
        ],

        // Password
        _buildFieldLabel('Password'),
        _buildCustomInputField(
          controller: _regPasswordController,
          hintText: 'Create a password',
          prefixIcon: Icons.lock_outline_rounded,
          obscureText: _obscurePassword,
          suffixIcon: IconButton(
            constraints: const BoxConstraints(maxHeight: 38, maxWidth: 38),
            icon: Icon(
              _obscurePassword
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              color: Colors.grey.shade600,
              size: 18,
            ),
            onPressed: () =>
                setState(() => _obscurePassword = !_obscurePassword),
          ),
          validator: (v) => v == null || v.length < 6
              ? 'Password must be at least 6 characters'
              : null,
        ),
        const SizedBox(height: 8),

        // Confirm Password
        _buildFieldLabel('Confirm Password'),
        _buildCustomInputField(
          controller: _regConfirmPasswordController,
          hintText: 'Confirm your password',
          prefixIcon: Icons.lock_outline_rounded,
          obscureText: _obscureConfirmPassword,
          suffixIcon: IconButton(
            constraints: const BoxConstraints(maxHeight: 38, maxWidth: 38),
            icon: Icon(
              _obscureConfirmPassword
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              color: Colors.grey.shade600,
              size: 18,
            ),
            onPressed: () => setState(
                () => _obscureConfirmPassword = !_obscureConfirmPassword),
          ),
          validator: (v) => v != _regPasswordController.text
              ? 'Passwords do not match'
              : null,
        ),
      ],
    );
  }

  Widget _buildPersonalStepFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('User Category *'),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: DropdownButtonFormField<String>(
            value: _selectedCategory,
            hint: Text(
              'Select Category',
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade500,
                fontWeight: FontWeight.w400,
              ),
            ),
            decoration: const InputDecoration(
              isDense: true,
              border: InputBorder.none,
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              prefixIcon: Icon(Icons.storefront_outlined,
                  color: Color(0xFF1B365D), size: 20),
            ),
            items: UserCategory.allCategories.map((cat) {
              return DropdownMenuItem(
                value: cat.id,
                child: Text(cat.label,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w500)),
              );
            }).toList(),
            onChanged: (val) => setState(() => _selectedCategory = val),
          ),
        ),
        const SizedBox(height: 12),
        _buildFieldLabel('Company / Firm Name (Optional)'),
        _buildCustomInputField(
          controller: _regCompanyNameController,
          hintText: 'e.g., Royal Ceramics Pvt Ltd',
          prefixIcon: Icons.business_outlined,
        ),
      ],
    );
  }


  Widget _buildFieldLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 3.0),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFF374151),
        ),
      ),
    );
  }

  Widget _buildCustomInputField({
    required TextEditingController controller,
    required String hintText,
    required IconData prefixIcon,
    String? prefixText,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    TextAlign textAlign = TextAlign.start,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      textAlign: textAlign,
      validator: validator,
      style: const TextStyle(fontSize: 13),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: Colors.white,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF1B365D)),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: Colors.red.shade700),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: Colors.red.shade700, width: 1.5),
        ),
        prefixIcon:
            Icon(prefixIcon, color: const Color(0xFF1B365D), size: 20),
        prefixText: prefixText,
        prefixStyle: const TextStyle(
            color: Color(0xFF1B365D), fontWeight: FontWeight.bold, fontSize: 13),
        hintText: hintText,
        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
        suffixIcon: suffixIcon,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
    );
  }

  Widget _buildSignupActionButton() {
    final isFinalStep = _signupStep == 2;

    return SizedBox(
      height: 44,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF1B365D),
          foregroundColor: Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        onPressed: _isLoading
            ? null
            : () {
                if (_signupStep < 2) {
                  if (_signupStep == 1) {
                    if (!_formKey.currentState!.validate()) return;
                  }
                  setState(() {
                    _signupStep++;
                  });
                } else {
                  _handleRegistration();
                }
              },
        child: _isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 2))
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    isFinalStep ? 'Create Account' : 'Continue',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_rounded, size: 18),
                ],
              ),
      ),
    );
  }
}

// ===========================================================================
// CURVED BANNER CLIPPER (Diagonal sweeping curve matching reference image)
// ===========================================================================
class CurvedBannerClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    // Start near top-right edge (82% of width)
    path.moveTo(size.width * 0.82, 0);
    // Smooth S-curve wave transition from (0.82, 0) to (0.28, 1.0)
    path.cubicTo(
      size.width * 0.82,     // Control Point 1 X (starts vertical)
      size.height * 0.35,    // Control Point 1 Y
      size.width * 0.28,     // Control Point 2 X (ends vertical)
      size.height * 0.65,    // Control Point 2 Y
      size.width * 0.28,     // End Point X
      size.height,           // End Point Y
    );
    // Fill to right edge
    path.lineTo(size.width, size.height);
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}
