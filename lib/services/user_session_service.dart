import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/user_profile.dart';
import 'app_state_service.dart';
import 'notification_service.dart';

/// Manages persistent user login session across app restarts
class UserSessionService {
  static const String _keyIsLoggedIn = 'is_logged_in';
  static const String _keyUserId = 'user_id';
  static const String _keyUserName = 'user_name';
  static const String _keyUserReligion = 'user_religion';
  static const String _keyUserDob = 'user_dob';
  static const String _keyUserPhone = 'user_phone';
  static const String _keyUserEmail = 'user_email';
  static const String _keyUserCompany = 'user_company';
  static const String _keyUserCategory = 'user_category';
  static const String _keyUserRole = 'user_role';
  static const String _keyUserCity = 'user_city';
  static const String _keyUserState = 'user_state';
  static const String _keyUserPincode = 'user_pincode';
  static const String _keyUserGst = 'user_gst';
  static const String _keyUserAddressJson = 'user_address_json';
  static const String _keyProfilePhotoUrl = 'user_profile_photo_url';
  static const String _keyAvatarUrl = 'user_avatar_url';
  static const String _keyShowroomImagesJson = 'user_showroom_images_json';

  /// Saves user profile & marks session as logged in
  static Future<void> saveUserSession(UserProfile profile) async {
    // Never persist a fake fallback user profile
    if (profile.userId.isEmpty ||
        profile.userId == 'GUEST_USER' ||
        profile.name == 'Valued Partner') {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyIsLoggedIn, true);
    await prefs.setString(_keyUserId, profile.userId);
    await prefs.setString(_keyUserName, profile.name);
    await prefs.setString(_keyUserReligion, profile.religion);
    await prefs.setString(_keyUserDob, profile.dateOfBirth);
    await prefs.setString(_keyUserPhone, profile.phone);
    await prefs.setString(_keyUserEmail, profile.email);
    await prefs.setString(_keyUserCompany, profile.companyName);
    await prefs.setString(_keyUserCategory, profile.userCategory);
    await prefs.setString(_keyUserRole, profile.role);
    await prefs.setString(_keyUserCity, profile.city);
    await prefs.setString(_keyUserState, profile.state);
    await prefs.setString(_keyUserPincode, profile.pincode);
    await prefs.setString(_keyUserGst, profile.gstNumber);
    await prefs.setString(_keyUserAddressJson, jsonEncode(profile.address));
    if (profile.profilePhotoUrl != null && profile.profilePhotoUrl!.isNotEmpty) {
      await prefs.setString(_keyProfilePhotoUrl, profile.profilePhotoUrl!);
    } else {
      await prefs.remove(_keyProfilePhotoUrl);
    }
    await prefs.setString(_keyAvatarUrl, profile.avatarUrl);
    await prefs.setString(_keyShowroomImagesJson, jsonEncode(profile.showroomImages));

    // Also update live AppStateService
    AppStateService.instance.setCurrentUserProfile(profile);
    AppStateService.instance.loadUserWishlist(profile.userId);
    NotificationService.saveCurrentUserToken();
  }

  /// Safely sanitizes any obsolete fallback/guest profile data from SharedPreferences
  static Future<void> purgeLegacyFallbackData() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedUserId = prefs.getString(_keyUserId);
    final cachedUserName = prefs.getString(_keyUserName);

    if (cachedUserId == 'GUEST_USER' ||
        cachedUserName == 'Valued Partner' ||
        cachedUserId == 'RESTORED_USER') {
      await clearUserSession();
    }
  }

  /// Restores active user session from SharedPreferences for the authenticated Firebase user
  static Future<UserProfile?> restoreUserSession() async {
    final prefs = await SharedPreferences.getInstance();
    final bool isLoggedIn = prefs.getBool(_keyIsLoggedIn) ?? false;
    final cachedUserId = prefs.getString(_keyUserId);
    final cachedUserName = prefs.getString(_keyUserName);

    // Sanitize any legacy fallback / guest user cache immediately
    if (cachedUserId == 'GUEST_USER' ||
        cachedUserName == 'Valued Partner' ||
        cachedUserId == 'RESTORED_USER') {
      await clearUserSession();
      return null;
    }

    User? firebaseUser;
    bool isFirebaseActive = false;
    try {
      if (Firebase.apps.isNotEmpty) {
        isFirebaseActive = true;
        firebaseUser = FirebaseAuth.instance.currentUser;
      }
    } catch (_) {}

    // In a live Firebase runtime, an active authenticated user is strictly required.
    // If Firebase is active and there is no authenticated user, session is null.
    if (isFirebaseActive && firebaseUser == null) {
      if (isLoggedIn || cachedUserId != null) {
        await clearUserSession();
      }
      return null;
    }

    if (!isLoggedIn && firebaseUser == null) {
      return null;
    }

    // Ensure cached UID strictly matches the active authenticated Firebase UID
    if (firebaseUser != null && cachedUserId != null && cachedUserId != firebaseUser.uid) {
      await clearUserSession();
      return null;
    }

    final userId = firebaseUser?.uid ?? cachedUserId;
    if (userId == null || userId.isEmpty || userId == 'GUEST_USER' || userId == 'RESTORED_USER') {
      return null;
    }

    final name = prefs.getString(_keyUserName) ?? firebaseUser?.displayName ?? '';
    if (name.isEmpty || name == 'Valued Partner') {
      return null;
    }

    final religion = prefs.getString(_keyUserReligion) ?? '';
    final dateOfBirth = prefs.getString(_keyUserDob) ?? '';
    final phone = prefs.getString(_keyUserPhone) ?? firebaseUser?.phoneNumber ?? '';
    final email = prefs.getString(_keyUserEmail) ?? firebaseUser?.email ?? '';
    final companyName = prefs.getString(_keyUserCompany) ?? '';
    final userCategory = prefs.getString(_keyUserCategory) ?? 'Dealer';
    final role = prefs.getString(_keyUserRole) ?? 'customer';
    final city = prefs.getString(_keyUserCity) ?? '';
    final state = prefs.getString(_keyUserState) ?? '';
    final pincode = prefs.getString(_keyUserPincode) ?? '';
    final gstNumber = prefs.getString(_keyUserGst) ?? '';
    final profilePhotoUrl = prefs.getString(_keyProfilePhotoUrl);
    final avatarUrl = prefs.getString(_keyAvatarUrl) ?? '';
    List<String> showroomImages = [];
    final rawShowroom = prefs.getString(_keyShowroomImagesJson);
    if (rawShowroom != null && rawShowroom.isNotEmpty) {
      try {
        showroomImages = List<String>.from(jsonDecode(rawShowroom));
      } catch (_) {}
    }

    Map<String, dynamic> address = {};
    final rawAddressJson = prefs.getString(_keyUserAddressJson);
    if (rawAddressJson != null && rawAddressJson.isNotEmpty) {
      try {
        address = Map<String, dynamic>.from(jsonDecode(rawAddressJson));
      } catch (_) {}
    }

    final profile = UserProfile(
      userId: userId,
      name: name,
      religion: religion,
      dateOfBirth: dateOfBirth,
      companyName: companyName,
      phone: phone,
      email: email,
      userCategory: userCategory,
      role: role,
      phoneVerified: true,
      whatsappVerified: true,
      city: city,
      state: state,
      pincode: pincode,
      gstNumber: gstNumber,
      avatarUrl: avatarUrl,
      profilePhotoUrl: profilePhotoUrl,
      showroomImages: showroomImages,
      address: address,
      status: 'active',
    );

    // Update live AppStateService
    AppStateService.instance.setCurrentUserProfile(profile);
    AppStateService.instance.loadUserWishlist(profile.userId);
    NotificationService.saveCurrentUserToken();
    return profile;
  }

  /// Clears user session and logs out completely
  static Future<void> clearUserSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyIsLoggedIn);
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyUserName);
    await prefs.remove(_keyUserReligion);
    await prefs.remove(_keyUserDob);
    await prefs.remove(_keyUserPhone);
    await prefs.remove(_keyUserEmail);
    await prefs.remove(_keyUserCompany);
    await prefs.remove(_keyUserCategory);
    await prefs.remove(_keyUserRole);
    await prefs.remove(_keyUserCity);
    await prefs.remove(_keyUserState);
    await prefs.remove(_keyUserPincode);
    await prefs.remove(_keyUserGst);
    await prefs.remove(_keyUserAddressJson);
    await prefs.remove(_keyProfilePhotoUrl);
    await prefs.remove(_keyAvatarUrl);
    await prefs.remove(_keyShowroomImagesJson);

    try {
      if (Firebase.apps.isNotEmpty) {
        await FirebaseAuth.instance.signOut();
      }
    } catch (_) {}

    // Reset AppStateService user profile, cart, and favorites
    AppStateService.instance.clearUserProfile();
    AppStateService.instance.clearCartAndFavorites();
  }
}
