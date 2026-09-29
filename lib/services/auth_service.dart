import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import 'firestore_service.dart';
import '../models/user_profile.dart';
import 'user_session_service.dart';

class AuthService {
  final FirebaseAuth? _customAuth;
  final FirestoreService _firestoreService;

  AuthService({
    FirebaseAuth? auth,
    FirestoreService? firestoreService,
  })  : _customAuth = auth,
        _firestoreService = firestoreService ?? FirestoreService();

  FirebaseAuth get _auth => _customAuth ?? FirebaseAuth.instance;

  User? get currentUser {
    try {
      return _auth.currentUser;
    } catch (_) {
      return null;
    }
  }

  static String? _lastRegisteredUid;

  /// Resets in-memory authentication state on logout
  static void clearSessionState() {
    _lastRegisteredUid = null;
  }

  String? get currentUid => _auth.currentUser?.uid ?? _lastRegisteredUid;

  // ============================================================
  // REFERRAL CODE
  // ============================================================

  String _generateUserReferralCode() {
    final random = Random();
    final number = random.nextInt(900000) + 100000;
    return 'ITA-$number';
  }

  // ============================================================
  // PASSWORD HELPERS
  // ============================================================

  static String generateSalt([int length = 16]) {
    final random = Random.secure();

    final values = List<int>.generate(
      length,
      (_) => random.nextInt(256),
    );

    return base64Url.encode(values);
  }

  static String hashPassword(String password, String salt) {
    final bytes = utf8.encode('$salt:$password');
    return sha256.convert(bytes).toString();
  }

  static String? validatePassword(String? password) {
    if (password == null || password.trim().isEmpty) {
      return 'Password is required.';
    }

    final trimmed = password.trim();

    if (trimmed.length < 8) {
      return 'Password must be at least 8 characters long.';
    }

    if (!RegExp(r'[A-Z]').hasMatch(trimmed)) {
      return 'Password must contain at least 1 uppercase letter (A-Z).';
    }

    if (!RegExp(r'[a-z]').hasMatch(trimmed)) {
      return 'Password must contain at least 1 lowercase letter (a-z).';
    }

    if (!RegExp(r'[0-9]').hasMatch(trimmed)) {
      return 'Password must contain at least 1 number (0-9).';
    }

    if (!RegExp(r'[!@#$%^&*]').hasMatch(trimmed)) {
      return r'Password must contain at least 1 special character (!@#$%^&*).';
    }

    return null;
  }

  // ============================================================
  // PHONE NUMBER
  // ============================================================

  String _normalizeIndianPhone(String phoneNumber) {
    String digits = phoneNumber.replaceAll(RegExp(r'\D'), '');

    // +91XXXXXXXXXX
    if (digits.startsWith('91') && digits.length == 12) {
      return '+$digits';
    }

    // XXXXXXXXXX
    if (digits.length == 10) {
      return '+91$digits';
    }

    // Fallback
    if (phoneNumber.trim().startsWith('+')) {
      return phoneNumber.trim();
    }

    return '+$digits';
  }

  // ============================================================
  // REAL FIREBASE SMS OTP
  // ============================================================

  Future<void> sendOtp({
    required String phoneNumber,
    required Function(String verificationId, int? resendToken) onCodeSent,
    required Function(String error) onError,
    int? forceResendingToken,
  }) async {
    try {
      String normalizedPhone = phoneNumber.trim();

      if (!normalizedPhone.startsWith('+')) {
        if (normalizedPhone.startsWith('91')) {
          normalizedPhone = '+$normalizedPhone';
        } else {
          normalizedPhone = '+91$normalizedPhone';
        }
      }

      await _auth.verifyPhoneNumber(
        phoneNumber: normalizedPhone,

        // Android can sometimes automatically verify the SMS.
        // We keep this empty so the UI waits for the OTP flow normally.
        verificationCompleted: (PhoneAuthCredential credential) async {
          // Do not automatically sign in here.
          // User will enter the OTP manually.
        },

        verificationFailed: (FirebaseAuthException e) {
          String message;

          switch (e.code) {
            case 'invalid-phone-number':
              message = 'Please enter a valid phone number.';
              break;

            case 'too-many-requests':
              message = 'Too many OTP requests. Please try again later.';
              break;

            case 'quota-exceeded':
              message = 'SMS quota exceeded. Please try again later.';
              break;

            case 'invalid-app-credential':
              message = 'App verification failed. Please try again.';
              break;

            case 'network-request-failed':
              message = 'Network error. Please check your internet connection.';
              break;

            default:
              message = e.message ?? 'Failed to send OTP.';
          }

          onError(message);
        },

        codeSent: (String verificationId, int? resendToken) {
          onCodeSent(verificationId, resendToken);
        },

        codeAutoRetrievalTimeout: (String verificationId) {
          onCodeSent(verificationId, null);
        },

        // This is the important part for RESEND OTP.
        forceResendingToken: forceResendingToken,
      );
    } catch (e) {
      onError(e.toString());
    }
  }

  // ============================================================
  // VERIFY PHONE OTP
  // ============================================================

  Future<UserCredential> verifyPhoneOtp({
    required String verificationId,
    required String smsCode,
  }) async {
    if (verificationId.trim().isEmpty) {
      throw Exception(
        'OTP verification session is missing. Please request a new OTP.',
      );
    }

    if (smsCode.trim().length != 6) {
      throw Exception(
        'Please enter the complete 6-digit OTP code.',
      );
    }

    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId.trim(),
        smsCode: smsCode.trim(),
      );

      return await _auth.signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'invalid-verification-code':
          throw Exception(
            'The OTP code entered is invalid. Please check your SMS and try again.',
          );

        case 'session-expired':
          throw Exception(
            'The OTP code has expired. Please request a new OTP.',
          );

        case 'credential-already-in-use':
          throw Exception(
            'This phone number is already linked to another account.',
          );

        case 'too-many-requests':
          throw Exception(
            'Too many verification attempts. Please wait and try again later.',
          );

        case 'network-request-failed':
          throw Exception(
            'Network error. Please check your internet connection.',
          );

        default:
          throw Exception(
            e.message ?? 'OTP verification failed. Please try again.',
          );
      }
    }
  }

  // ============================================================
  // LOGIN WITH PHONE OTP
  // ============================================================

  Future<void> loginWithPhoneOtp({
    required String phoneNumber,
    required String verificationId,
    required String smsCode,
  }) async {
    // REAL Firebase OTP verification
    final userCredential = await verifyPhoneOtp(
      verificationId: verificationId,
      smsCode: smsCode,
    );

    final firebaseUser = userCredential.user;

    if (firebaseUser == null) {
      throw Exception(
        'Firebase could not create a user session.',
      );
    }

    _lastRegisteredUid = firebaseUser.uid;

    // Load application profile directly by authenticated UID from Firestore.
    // Never perform collection queries.
    final userMap = await _firestoreService.getUserDocument(firebaseUser.uid);

    if (userMap != null) {
      final docId = firebaseUser.uid;
      final profile = UserProfile.fromMap(userMap, docId);
      await UserSessionService.saveUserSession(profile);
    } else {
      // Reject missing profile and NEVER invent an unknown/fallback customer
      throw Exception(
        'No registered ITACON customer profile was found for this mobile number. Please register your account.',
      );
    }
  }

  // ============================================================
  // REGISTER USER
  // ============================================================

  Future<void> registerUser({
    required String fullName,
    required String phoneNumber,
    required String categoryId,
    required String password,
    String? religion,
    String? dateOfBirth,
    String? email,
    String? companyName,
    String? referralCode,
    String? verificationId,
    String? smsCode,
  }) async {
    // ----------------------------------------------------------
    // 1. Validate password
    // ----------------------------------------------------------

    final passwordError =
        validatePassword(password);

    if (passwordError != null) {
      throw Exception(passwordError);
    }

    // ----------------------------------------------------------
    // 2. OTP is REQUIRED for registration
    // ----------------------------------------------------------

    if (verificationId == null ||
        verificationId.trim().isEmpty) {
      throw Exception(
        'Please request an OTP before creating your account.',
      );
    }

    if (smsCode == null ||
        smsCode.trim().length != 6) {
      throw Exception(
        'Please enter the complete 6-digit OTP code.',
      );
    }

    final formattedPhone =
        _normalizeIndianPhone(phoneNumber);

    // ----------------------------------------------------------
    // 3. Verify real Firebase SMS OTP
    // ----------------------------------------------------------

    final userCredential = await verifyPhoneOtp(
      verificationId: verificationId,
      smsCode: smsCode,
    );

    final firebaseUser = userCredential.user;

    if (firebaseUser == null) {
      throw Exception(
        'Phone verification failed. Please try again.',
      );
    }

    final uid = firebaseUser.uid;

    _lastRegisteredUid = uid;

    // ----------------------------------------------------------
    // 4. Check referral code
    // ----------------------------------------------------------

    String? assignedSpId;

    if (referralCode != null &&
        referralCode.trim().isNotEmpty) {
      final spProfile =
          await _firestoreService
              .verifySalespersonReferralCode(
        referralCode.trim(),
      );

      if (spProfile != null) {
        assignedSpId =
            (spProfile['id'] ??
                    spProfile['salesPersonId'] ??
                    spProfile['salespersonId'])
                ?.toString();
      }
    }

    // ----------------------------------------------------------
    // 5. Optional email
    // ----------------------------------------------------------

    final cleanPhone =
        formattedPhone.replaceAll(
      RegExp(r'\D'),
      '',
    );

    final registrationEmail =
        (email != null &&
                email.trim().isNotEmpty &&
                email.contains('@'))
            ? email.trim()
            : 'user_$cleanPhone@itacon.com';

    // ----------------------------------------------------------
    // 6. IMPORTANT:
    //
    // DO NOT create a second Firebase Email/Password account.
    //
    // The Firebase Phone Auth user above IS the Firebase user.
    // ----------------------------------------------------------

    // If the phone user does not already have an email,
    // we can optionally link an email/password credential.
    //
    // However, this is only attempted when the generated/real
    // email is suitable. If it is already linked, we simply
    // continue with the phone-auth account.

    try {
      final existingProviders =
          firebaseUser.providerData
              .map((provider) => provider.providerId)
              .toList();

      final hasPasswordProvider =
          existingProviders.contains(
        'password',
      );

      if (!hasPasswordProvider &&
          email != null &&
          email.trim().isNotEmpty &&
          email.contains('@')) {
        try {
          final emailCredential =
              EmailAuthProvider.credential(
            email: registrationEmail,
            password: password,
          );

          await firebaseUser.linkWithCredential(
            emailCredential,
          );
        } on FirebaseAuthException catch (e) {
          // Do not fail phone registration if the optional
          // email linking cannot be completed.
          if (e.code != 'provider-already-linked' &&
              e.code != 'email-already-in-use') {
            // Continue with phone authentication.
          }
        }
      }
    } catch (_) {
      // Phone account remains the primary authentication.
    }

    // ----------------------------------------------------------
    // 7. Generate application referral code
    // ----------------------------------------------------------

    final userReferralCode =
        _generateUserReferralCode();

    // ----------------------------------------------------------
    // 8. Password hash for existing application's
    //    Firestore password-based features
    // ----------------------------------------------------------

    final userSalt = generateSalt();

    final passHash = hashPassword(
      password,
      userSalt,
    );

    // ----------------------------------------------------------
    // 9. Create Firestore user profile
    // ----------------------------------------------------------

    await _firestoreService.createUserProfile(
      uid: uid,
      phoneNumber: formattedPhone,
      fullName: fullName,
      role: categoryId,
      religion: religion,
      dateOfBirth: dateOfBirth,
      email: registrationEmail,
      companyName: companyName,
      assignedSalespersonId: assignedSpId,
      userReferralCode: userReferralCode,
      referredByCode: referralCode,
      isVerified: true,
      passwordHash: passHash,
      passwordSalt: userSalt,
    );

    // ----------------------------------------------------------
    // 10. Create local session
    // ----------------------------------------------------------

    final registeredProfile =
        UserProfile(
      userId: uid,
      name: fullName,
      religion: religion ?? '',
      dateOfBirth: dateOfBirth ?? '',
      companyName: companyName ?? '',
      phone: formattedPhone,
      email: registrationEmail,
      userCategory: categoryId,
      role: categoryId,
      salesPersonId: assignedSpId,
      referralCode: userReferralCode,
      phoneVerified: true,
      whatsappVerified: true,
      status: 'active',
      createdAt: DateTime.now(),
    );

    await UserSessionService.saveUserSession(
      registeredProfile,
    );

    // ----------------------------------------------------------
    // 11. Save customer referral
    // ----------------------------------------------------------

    if (referralCode != null &&
        referralCode.trim().isNotEmpty) {
      await _firestoreService.saveCustomerReferralCode(
        userId: uid,
        referralCode: referralCode.trim(),
        userName: fullName,
        userPhone: formattedPhone,
        userCategory: categoryId,
      );
    }

    // ----------------------------------------------------------
    // 12. Assign salesperson
    // ----------------------------------------------------------

    if (assignedSpId != null &&
        assignedSpId.isNotEmpty) {
      await _firestoreService
          .executeAtomicClientAssignment(
        clientId: uid,
        salespersonId: assignedSpId,
        assignmentType: 'manual_referral',
        clientName: fullName,
        clientPhone: formattedPhone,
        companyName: companyName,
        clientCategory: categoryId,
      );
    }
  }

  // ============================================================
  // LOGIN WITH PHONE OTP + CREDENTIALS (OTP FIRST + UID PROFILE)
  // ============================================================

  Future<void> loginWithPhoneOtpAndCredentials({
    required String phoneNumber,
    required String verificationId,
    required String smsCode,
    required String password,
    String? username,
    String? referralCode,
  }) async {
    if (password.trim().isEmpty) {
      throw Exception(
        'Invalid username or password. Please check your credentials and try again.',
      );
    }

    debugPrint('AUTH_DEBUG: OTP verification started');

    final UserCredential userCredential;
    try {
      userCredential = await verifyPhoneOtp(
        verificationId: verificationId,
        smsCode: smsCode,
      );
      debugPrint('AUTH_DEBUG: OTP authentication success');
    } on FirebaseAuthException catch (e) {
      debugPrint('AUTH_DEBUG: OTP authentication failure');
      debugPrint('AUTH_DEBUG: FirebaseAuth exception code: ${e.code}');
      rethrow;
    } catch (e) {
      debugPrint('AUTH_DEBUG: OTP authentication failure');
      rethrow;
    }

    final firebaseUser = userCredential.user ?? currentUser;
    final isPresent = firebaseUser != null;
    debugPrint('AUTH_DEBUG: currentUser present = $isPresent');

    if (firebaseUser == null) {
      throw Exception('Firebase could not create a user session.');
    }

    final uid = firebaseUser.uid;
    _lastRegisteredUid = uid;

    debugPrint('AUTH_DEBUG: UID profile lookup started');
    Map<String, dynamic>? userMap;
    try {
      userMap = await _firestoreService.getUserDocument(uid);
    } on FirebaseException catch (e) {
      debugPrint('AUTH_DEBUG: UID profile lookup failure');
      debugPrint('AUTH_DEBUG: Firestore exception code: ${e.code}');
      // Technical / database / network / permission error:
      // DO NOT automatically sign out firebaseUser.
      // Surface technical error clearly without mislabeling as invalid credentials.
      if (e.code == 'permission-denied') {
        throw Exception(
          'Access denied while reading user profile. Please check account permissions.',
        );
      } else if (e.code == 'unavailable' || e.code == 'deadline-exceeded') {
        throw Exception(
          'Network unavailable. Please check your internet connection.',
        );
      }
      throw Exception(
        'Failed to load user profile: ${e.message ?? e.code}',
      );
    } catch (e) {
      debugPrint('AUTH_DEBUG: UID profile lookup failure');
      throw Exception('Failed to load user profile. Please try again.');
    }

    if (userMap == null) {
      debugPrint('AUTH_DEBUG: UID profile lookup failure');
      // OTP passed, but this user has no profile document in users/{uid}
      await signOutFirebaseUser();
      throw Exception(
        'No registered ITACON customer profile was found for this mobile number. Please register your account.',
      );
    }

    debugPrint('AUTH_DEBUG: UID profile lookup success');

    // ----------------------------------------------------------
    // USERNAME VALIDATION (if entered)
    // ----------------------------------------------------------
    if (username != null && username.trim().isNotEmpty) {
      final storedUsername = (userMap['username'] ??
              userMap['userName'] ??
              userMap['name'] ??
              userMap['fullName'] ??
              '')
          .toString()
          .trim();

      if (storedUsername.isEmpty ||
          storedUsername.toLowerCase() != username.trim().toLowerCase()) {
        debugPrint('AUTH_DEBUG: username validation failure');
        await signOutFirebaseUser();
        throw Exception(
          'Invalid username or password. Please check your credentials and try again.',
        );
      }
      debugPrint('AUTH_DEBUG: username validation success');
    }

    // ----------------------------------------------------------
    // PASSWORD VALIDATION
    // ----------------------------------------------------------
    final storedHash = userMap['passwordHash'] as String?;
    final storedSalt = userMap['passwordSalt'] as String?;

    if (storedHash != null && storedSalt != null) {
      final computedHash = hashPassword(password.trim(), storedSalt);
      if (computedHash != storedHash) {
        debugPrint('AUTH_DEBUG: password validation failure');
        await signOutFirebaseUser();
        throw Exception(
          'Invalid username or password. Please check your credentials and try again.',
        );
      }
      debugPrint('AUTH_DEBUG: password validation success');
    } else {
      // Missing password credentials in profile
      debugPrint('AUTH_DEBUG: password validation failure');
      await signOutFirebaseUser();
      throw Exception(
        'Invalid username or password. Please check your credentials and try again.',
      );
    }

    // ----------------------------------------------------------
    // SAVE SESSION
    // ----------------------------------------------------------
    final profile = UserProfile.fromMap(userMap, uid);
    await UserSessionService.saveUserSession(profile);
    debugPrint('AUTH_DEBUG: session saved');

    // ----------------------------------------------------------
    // REFERRAL (OPTIONAL)
    // ----------------------------------------------------------
    if (referralCode != null && referralCode.trim().isNotEmpty) {
      await verifyAndLinkReferralCode(
        referralCode.trim(),
        clientName: profile.name,
        clientPhone: profile.phone,
      );
    }
  }

  // ============================================================
  // EXISTING PASSWORD LOGIN
  // ============================================================

  Future<void> loginUser({
    required String password,
    String? loginIdentifier,
    String? phoneNumber,
    String? username,
    String? referralCode,
    String? verificationId,
    String? smsCode,
  }) async {
    if (password.trim().isEmpty) {
      throw Exception(
        'Invalid username or password. Please check your credentials and try again.',
      );
    }

    // If OTP parameters are provided, perform OTP login FIRST
    if (verificationId != null &&
        verificationId.trim().isNotEmpty &&
        smsCode != null &&
        smsCode.trim().isNotEmpty) {
      final phone = (phoneNumber != null && phoneNumber.trim().isNotEmpty)
          ? phoneNumber.trim()
          : (loginIdentifier != null ? loginIdentifier.trim() : '');

      final user = (username != null && username.trim().isNotEmpty)
          ? username.trim()
          : ((loginIdentifier != null &&
                  !loginIdentifier.startsWith('+') &&
                  !loginIdentifier.contains('@') &&
                  loginIdentifier.replaceAll(RegExp(r'\D'), '').length < 10)
              ? loginIdentifier.trim()
              : null);

      await loginWithPhoneOtpAndCredentials(
        phoneNumber: phone,
        verificationId: verificationId,
        smsCode: smsCode,
        password: password,
        username: user,
        referralCode: referralCode,
      );
      return;
    }

    // ----------------------------------------------------------
    // EMAIL / PASSWORD LOGIN (LEGACY / EXPLICIT EMAIL ONLY)
    // ----------------------------------------------------------
    final identifier = (loginIdentifier ?? '').trim();
    if (!identifier.contains('@')) {
      throw Exception(
        'Invalid username or password. Please check your credentials and try again.',
      );
    }

    final authEmail = identifier;

    final userMap =
        await _firestoreService.findUserByIdentifier(
      identifier,
    );

    final storedHash =
        userMap?['passwordHash'] as String?;

    final storedSalt =
        userMap?['passwordSalt'] as String?;

    if (storedHash != null &&
        storedSalt != null) {
      final computedHash =
          hashPassword(
        password,
        storedSalt,
      );

      if (computedHash != storedHash) {
        throw Exception(
          'Invalid username or password. Please check your credentials and try again.',
        );
      }

      // Try Firebase Email/Password session.
      try {
        final userCred =
            await _auth.signInWithEmailAndPassword(
          email: authEmail,
          password: password,
        );

        _lastRegisteredUid =
            userCred.user?.uid;
      } catch (_) {
        // Phone-auth accounts may not have email/password.
        // Firestore authentication above remains valid.
      }
    } else {
      try {
        final userCred =
            await _auth.signInWithEmailAndPassword(
          email: authEmail,
          password: password,
        );

        _lastRegisteredUid =
            userCred.user?.uid;
      } on FirebaseAuthException catch (e) {
        switch (e.code) {
          case 'wrong-password':
          case 'invalid-credential':
            throw Exception(
              'Invalid username or password. Please check your credentials and try again.',
            );

          case 'user-disabled':
            throw Exception(
              'This account has been disabled. Please contact ITACON support.',
            );

          case 'too-many-requests':
            throw Exception(
              'Too many failed login attempts. Please wait a few minutes before trying again.',
            );

          default:
            throw Exception(
              e.message ??
                  'Invalid username or password.',
            );
        }
      }
    }

    // ----------------------------------------------------------
    // Save profile session
    // ----------------------------------------------------------

    if (userMap != null) {
      _lastRegisteredUid =
          (userMap['id'] ??
                  userMap['userId'] ??
                  userMap['uid'])
              ?.toString();

      final docId =
          _lastRegisteredUid ?? 'USER_LOGIN';

      final profile =
          UserProfile.fromMap(
        userMap,
        docId,
      );

      await UserSessionService.saveUserSession(
        profile,
      );
    } else {
      throw Exception(
        'No registered account was found. Please check your credentials.',
      );
    }

    // ----------------------------------------------------------
    // Referral
    // ----------------------------------------------------------

    if (referralCode != null &&
        referralCode.trim().isNotEmpty) {
      final uid = currentUid;

      if (uid != null && uid.isNotEmpty) {
        await _firestoreService
            .saveCustomerReferralCode(
          userId: uid,
          referralCode: referralCode.trim(),
        );
      }

      await verifyAndLinkReferralCode(
        referralCode.trim(),
      );
    }
  }

  // ============================================================
  // REFERRAL LINKING
  // ============================================================

  Future<bool> verifyAndLinkReferralCode(
    String referralCode, {
    String? clientName,
    String? clientPhone,
    String? companyName,
    String? clientCategory,
  }) async {
    final uid = currentUid;

    final code = referralCode.trim();

    if (code.isEmpty) {
      return true;
    }

    if (uid != null && uid.isNotEmpty) {
      await _firestoreService.saveCustomerReferralCode(
        userId: uid,
        referralCode: code,
        userName: clientName,
        userPhone: clientPhone,
        userCategory: clientCategory,
      );

      final existingUser =
          await _firestoreService.getUserProfile(
        uid,
      );

      final existingSpId =
          existingUser?.salesPersonId;

      if (existingSpId != null &&
          existingSpId.isNotEmpty) {
        return true;
      }
    }

    final spProfile =
        await _firestoreService
            .verifySalespersonReferralCode(
      code,
    );

    if (spProfile != null) {
      final spId =
          (spProfile['id'] ??
                  spProfile['salesPersonId'] ??
                  spProfile['salespersonId'])
              .toString();

      if (uid != null && uid.isNotEmpty) {
        await _firestoreService
            .executeAtomicClientAssignment(
          clientId: uid,
          salespersonId: spId,
          assignmentType: 'manual_referral',
          clientName: clientName,
          clientPhone: clientPhone,
          companyName: companyName,
          clientCategory: clientCategory,
        );
      }
    }

    return true;
  }

  // ============================================================
  // AUTO ASSIGN SALESPERSON
  // ============================================================

  Future<Map<String, String>>
      autoAssignSalespersonDetails({
    String? targetUserId,
  }) async {
    final uid =
        targetUserId ?? currentUid;

    String? name;
    String? phone;
    String? company;
    String? category;

    if (uid != null && uid.isNotEmpty) {
      final profile =
          await _firestoreService.getUserProfile(
        uid,
      );

      if (profile != null) {
        name = profile.name;
        phone = profile.phone;
        company = profile.companyName;
        category = profile.userCategory;
      }
    }

    return await _firestoreService
        .autoAssignSalespersonDetails(
      userId: uid,
      clientName: name,
      clientPhone: phone,
      companyName: company,
      clientCategory: category,
    );
  }

  Future<String?> autoAssignSalesperson({
    String? targetUserId,
  }) async {
    final details =
        await autoAssignSalespersonDetails(
      targetUserId: targetUserId,
    );

    return details['salespersonId'];
  }

  // ============================================================
  // SALESPERSON REGISTRATION
  // ============================================================

  Future<void> registerSalesperson({
    required String fullName,
    required String phoneNumber,
    required String referralCode,
    String? salespersonId,
    String? employeeId,
  }) async {
    final spId =
        salespersonId ??
            'SP_${DateTime.now().millisecondsSinceEpoch}';

    await _firestoreService
        .createSalespersonProfile(
      salespersonId: spId,
      fullName: fullName,
      phoneNumber: phoneNumber,
      referralCode: referralCode,
      employeeId: employeeId,
      isActive: true,
    );
  }

  // ============================================================
  // RESET PASSWORD USING SMS OTP
  // ============================================================

  Future<void> resetPasswordWithPhoneOtp({
    required String phoneNumber,
    required String verificationId,
    required String smsCode,
    required String newPassword,
  }) async {
    final passwordError =
        validatePassword(newPassword);

    if (passwordError != null) {
      throw Exception(passwordError);
    }

    if (verificationId.trim().isEmpty ||
        smsCode.trim().isEmpty) {
      throw Exception(
        'Please enter the 6-digit SMS verification code.',
      );
    }

    final formattedPhone =
        _normalizeIndianPhone(phoneNumber);

    // Find user first.
    final userMap =
        await _firestoreService.findUserByIdentifier(
      formattedPhone,
    );

    if (userMap == null) {
      throw Exception(
        'No registered account found for mobile number $formattedPhone.',
      );
    }

    final uid =
        (userMap['userId'] ??
                userMap['uid'] ??
                userMap['id'])
            ?.toString();

    if (uid == null || uid.isEmpty) {
      throw Exception(
        'User account ID not found for this mobile number.',
      );
    }

    final role =
        userMap['role'] as String? ??
            userMap['userCategory'] as String?;

    // Verify real SMS OTP.
    await verifyPhoneOtp(
      verificationId: verificationId,
      smsCode: smsCode,
    );

    // Update Firebase password if email/password
    // provider is linked.
    try {
      final user = _auth.currentUser;

      if (user != null) {
        await user.updatePassword(
          newPassword,
        );
      }
    } catch (_) {
      // Continue with application password update.
    }

    // Update application's password hash.
    final salt = generateSalt();

    final passHash =
        hashPassword(
      newPassword,
      salt,
    );

    await _firestoreService.updateUserPassword(
      uid: uid,
      passwordHash: passHash,
      passwordSalt: salt,
      role: role,
    );
  }

  // ============================================================
  // PASSWORD RESET EMAIL
  // ============================================================

  Future<String> sendPasswordResetLink(
    String emailOrPhone,
  ) async {
    final trimmedInput =
        emailOrPhone.trim();

    if (trimmedInput.isEmpty) {
      throw Exception(
        'Please enter a valid email address.',
      );
    }

    String targetEmail = trimmedInput;

    final cleanDigits =
        trimmedInput.replaceAll(
      RegExp(r'\D'),
      '',
    );

    final isPhone =
        !trimmedInput.contains('@') &&
            cleanDigits.length >= 10;

    if (isPhone) {
      final userMap =
          await _firestoreService
              .findUserByIdentifier(
        trimmedInput,
      );

      if (userMap != null) {
        final profileEmail =
            (userMap['email'] as String?)
                ?.trim();

        if (profileEmail != null &&
            profileEmail.isNotEmpty &&
            profileEmail.contains('@') &&
            !profileEmail.endsWith(
              '@itacon.com',
            )) {
          targetEmail = profileEmail;
        } else {
          throw Exception(
            'No recovery email is linked with mobile $trimmedInput. Please use Mobile SMS OTP to reset your password.',
          );
        }
      } else {
        throw Exception(
          'No account found for mobile number $trimmedInput. Please check your number.',
        );
      }
    }

    final emailRegex =
        RegExp(r'^[\w\-.]+@([\w-]+\.)+[\w-]{2,4}$');

    if (!emailRegex.hasMatch(targetEmail)) {
      throw Exception(
        'Please enter a valid email address.',
      );
    }

    try {
      await _auth.sendPasswordResetEmail(
        email: targetEmail,
      );

      return targetEmail;
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'user-not-found':
          throw Exception(
            'No account registered with this email address. Please check and try again.',
          );

        case 'invalid-email':
          throw Exception(
            'Please enter a valid email address.',
          );

        case 'too-many-requests':
          throw Exception(
            'Too many reset requests. Please wait a few minutes before trying again.',
          );

        case 'network-request-failed':
          throw Exception(
            'Network error. Please check your internet connection.',
          );

        default:
          throw Exception(
            e.message ??
                'Failed to send password reset email. Please try again.',
          );
      }
    }
  }

  // ============================================================
  // SIGN OUT
  // ============================================================

  Future<void> signOut() async {
    await UserSessionService.logout();
  }

  @visibleForTesting
  Future<void> signOutFirebaseUser() async {
    try {
      await _auth.signOut();
    } catch (_) {}
  }
}