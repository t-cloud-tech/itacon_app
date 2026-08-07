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

  /// Verifies the OTP code and creates/updates the user profile in Firestore.
  Future<UserCredential> confirmOtpAndCreateUser({
    required String verificationId,
    required String smsCode,
    required String categoryId,
  }) async {
    final PhoneAuthCredential credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode,
    );

    final UserCredential userCredential =
        await _auth.signInWithCredential(credential);

    if (userCredential.user != null) {
      final user = userCredential.user!;
      await _firestoreService.createUserProfile(
        uid: user.uid,
        phoneNumber: user.phoneNumber ?? '',
        fullName: 'Partner (${categoryId.toUpperCase()})',
        role: categoryId,
        isVerified: false,
      );
    }

    return userCredential;
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
}
