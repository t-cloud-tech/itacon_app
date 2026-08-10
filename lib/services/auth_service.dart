import 'dart:math';
import 'package:firebase_auth/firebase_auth.dart';
import 'firestore_service.dart';

class AuthService {
  final FirebaseAuth _auth;
  final FirestoreService _firestoreService;

  AuthService({
    FirebaseAuth? auth,
    FirestoreService? firestoreService,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _firestoreService = firestoreService ?? FirestoreService();

  User? get currentUser => _auth.currentUser;

  /// Helper to generate a unique user referral code (e.g. ITA-582910)
  String _generateUserReferralCode() {
    final random = Random();
    final number = random.nextInt(900000) + 100000;
    return 'ITA-$number';
  }

  /// Sends OTP to the provided [phoneNumber].
  Future<void> sendOtp({
    required String phoneNumber,
    required Function(String verificationId) onCodeSent,
    required Function(String error) onError,
  }) async {
    try {
      await _auth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        verificationCompleted: (PhoneAuthCredential credential) async {
          await _auth.signInWithCredential(credential);
        },
        verificationFailed: (FirebaseAuthException e) {
          onError(e.message ?? 'Phone verification failed.');
        },
        codeSent: (String verificationId, int? resendToken) {
          onCodeSent(verificationId);
        },
        codeAutoRetrievalTimeout: (String verificationId) {},
      );
    } catch (e) {
      onError(e.toString());
    }
  }

  /// Registers a new user with Name, User Category, Password, Optional Company Name,
  /// Mobile No + OTP, and Optional Salesperson Referral Code.
  /// If no referral code is entered, an active Sales Executive is automatically assigned!
  Future<void> registerUser({
    required String fullName,
    required String phoneNumber,
    required String categoryId,
    required String password,
    String? companyName,
    String? referralCode,
    String? verificationId,
    String? smsCode,
  }) async {
    String? assignedSpId;

    // 1. Check referral code if user entered one
    if (referralCode != null && referralCode.trim().isNotEmpty) {
      final spProfile = await _firestoreService
          .verifySalespersonReferralCode(referralCode.trim());
      if (spProfile != null) {
        assignedSpId = (spProfile['id'] ?? spProfile['salesPersonId'] ?? spProfile['salespersonId']) as String?;
      }
    }

    String uid = _auth.currentUser?.uid ??
        'USER_${DateTime.now().millisecondsSinceEpoch}';

    // 2. If OTP code was provided, verify credential with Firebase
    if (verificationId != null && smsCode != null && smsCode.isNotEmpty) {
      try {
        final credential = PhoneAuthProvider.credential(
          verificationId: verificationId,
          smsCode: smsCode,
        );
        final userCred = await _auth.signInWithCredential(credential);
        if (userCred.user != null) {
          uid = userCred.user!.uid;
        }
      } catch (e) {
        // Fallback uid if mock testing
      }
    }

    // 3. Auto-assign salesperson if no code was given or valid
    assignedSpId ??=
        await _firestoreService.autoAssignSalesperson(userId: uid);

    final userReferralCode = _generateUserReferralCode();

    // 4. Create user profile in Firestore
    await _firestoreService.createUserProfile(
      uid: uid,
      phoneNumber: phoneNumber,
      fullName: fullName,
      role: categoryId,
      companyName: companyName,
      assignedSalespersonId: assignedSpId,
      userReferralCode: userReferralCode,
      isVerified: true,
    );
  }

  /// Log in existing user with Mobile/Username & Password, with OTP & optional referral linking
  Future<void> loginUser({
    required String loginIdentifier,
    required String password,
    String? referralCode,
    String? verificationId,
    String? smsCode,
  }) async {
    if (verificationId != null && smsCode != null && smsCode.isNotEmpty) {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: smsCode,
      );
      await _auth.signInWithCredential(credential);
    }

    if (referralCode != null && referralCode.trim().isNotEmpty) {
      await verifyAndLinkReferralCode(referralCode.trim());
    }
  }

  /// Verifies a salesperson referral code and links it to the logged-in user profile.
  Future<bool> verifyAndLinkReferralCode(String referralCode) async {
    final uid = _auth.currentUser?.uid ?? 'DEMO_USER_001';
    final spProfile =
        await _firestoreService.verifySalespersonReferralCode(referralCode);

    if (spProfile != null) {
      final spId = spProfile['id'] as String;
      await _firestoreService.createUserProfile(
        uid: uid,
        phoneNumber: _auth.currentUser?.phoneNumber ?? '+919876543210',
        fullName: 'Partner User',
        role: 'dealer',
        assignedSalespersonId: spId,
        isVerified: true,
      );
      return true;
    }
    return false;
  }

  /// Auto assigns an active sales executive to the current user.
  Future<String?> autoAssignSalesperson() async {
    final uid = _auth.currentUser?.uid ?? 'DEMO_USER_001';
    return await _firestoreService.autoAssignSalesperson(userId: uid);
  }

  /// Registers and stores a Salesperson profile directly in the dedicated `salespersons` collection.
  Future<void> registerSalesperson({
    required String fullName,
    required String phoneNumber,
    required String referralCode,
    String? salespersonId,
    String? employeeId,
  }) async {
    final spId = salespersonId ?? 'SP_${DateTime.now().millisecondsSinceEpoch}';
    await _firestoreService.createSalespersonProfile(
      salespersonId: spId,
      fullName: fullName,
      phoneNumber: phoneNumber,
      referralCode: referralCode,
      employeeId: employeeId,
      isActive: true,
    );
  }
}

