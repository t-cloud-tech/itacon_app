import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/user_profile.dart';
import 'app_state_service.dart';

/// Manages persistent user login session across app restarts
class UserSessionService {
  static const String _keyIsLoggedIn = 'is_logged_in';
  static const String _keyUserId = 'user_id';
  static const String _keyUserName = 'user_name';
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

  /// Saves user profile & marks session as logged in
  static Future<void> saveUserSession(UserProfile profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyIsLoggedIn, true);
    await prefs.setString(_keyUserId, profile.userId);
    await prefs.setString(_keyUserName, profile.name);
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

    // Also update live AppStateService
    AppStateService.instance.setCurrentUserProfile(profile);
  }

  /// Restores active user session from SharedPreferences or Firebase Auth
  static Future<UserProfile?> restoreUserSession() async {
    final prefs = await SharedPreferences.getInstance();
    final bool isLoggedIn = prefs.getBool(_keyIsLoggedIn) ?? false;
    User? firebaseUser;
    try {
      firebaseUser = FirebaseAuth.instance.currentUser;
    } catch (_) {}

    if (!isLoggedIn && firebaseUser == null) {
      return null;
    }

    final userId = prefs.getString(_keyUserId) ?? firebaseUser?.uid ?? 'RESTORED_USER';
    final name = prefs.getString(_keyUserName) ?? firebaseUser?.displayName ?? 'Valued Customer';
    final phone = prefs.getString(_keyUserPhone) ?? firebaseUser?.phoneNumber ?? '';
    final email = prefs.getString(_keyUserEmail) ?? firebaseUser?.email ?? '';
    final companyName = prefs.getString(_keyUserCompany) ?? '';
    final userCategory = prefs.getString(_keyUserCategory) ?? 'Dealer';
    final role = prefs.getString(_keyUserRole) ?? 'customer';
    final city = prefs.getString(_keyUserCity) ?? '';
    final state = prefs.getString(_keyUserState) ?? '';
    final pincode = prefs.getString(_keyUserPincode) ?? '';
    final gstNumber = prefs.getString(_keyUserGst) ?? '';

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
      address: address,
      status: 'active',
    );

    // Update live AppStateService
    AppStateService.instance.setCurrentUserProfile(profile);
    return profile;
  }

  /// Clears user session and logs out completely
  static Future<void> clearUserSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyIsLoggedIn, false);
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyUserName);
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

    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {}

    // Reset AppStateService user profile to null
    AppStateService.instance.clearUserProfile();
  }
}
