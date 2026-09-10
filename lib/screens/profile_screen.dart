import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../theme/app_theme.dart';
import '../widgets/interactive_pressable.dart';
import '../widgets/app_avatar_image.dart';
import '../services/app_state_service.dart';
import '../services/firestore_service.dart';
import '../services/user_session_service.dart';
import '../models/user_profile.dart';
import '../widgets/profile_tier_card.dart';
import 'auth_screen.dart';
import 'orders_screen.dart';
import 'favorites_screen.dart';
import 'notifications_screen.dart';
import 'contract_rates_screen.dart';
import 'profile/edit_profile_screen.dart';

class ProfileScreen extends StatelessWidget {
  final VoidCallback? onBackToHome;

  const ProfileScreen({
    super.key,
    this.onBackToHome,
  });

  Future<bool?> _requestGalleryPermission(BuildContext context) async {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          contentPadding: const EdgeInsets.all(22),
          title: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.perm_media_rounded,
                  size: 34,
                  color: AppTheme.primaryNavy,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Allow "ITACON Granito" to Access Your Photos?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryNavy,
                ),
              ),
            ],
          ),
          content: const Text(
            'ITACON Granito requires photo library access so you can select and set your personal profile picture directly from your device gallery.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: AppTheme.textSubtle,
              height: 1.4,
            ),
          ),
          actionsAlignment: MainAxisAlignment.spaceEvenly,
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text(
                "Don't Allow",
                style: TextStyle(
                  color: AppTheme.textSubtle,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryNavy,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              ),
              child: const Text(
                'Allow Access',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _showProfilePhotoOptions(BuildContext context, UserProfile profile) async {
    final photoUrl = profile.profilePhotoUrl ?? (profile.avatarUrl.isNotEmpty ? profile.avatarUrl : null);
    final bool hasPhoto = photoUrl != null && photoUrl.trim().isNotEmpty;

    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (bsContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    hasPhoto ? 'Edit Profile Photo' : 'Add Profile Photo',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20, color: AppTheme.textSubtle),
                    onPressed: () => Navigator.pop(bsContext),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.photo_library_outlined, color: AppTheme.primaryNavy),
                ),
                title: Text(
                  hasPhoto ? 'Change Photo from Gallery' : 'Choose from Gallery',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                subtitle: const Text('Pick a new image from device storage', style: TextStyle(fontSize: 12)),
                onTap: () {
                  Navigator.pop(bsContext);
                  _pickProfilePhoto(context, ImageSource.gallery);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.camera_alt_outlined, color: AppTheme.primaryNavy),
                ),
                title: Text(
                  hasPhoto ? 'Take New Photo with Camera' : 'Take a Photo',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                subtitle: const Text('Capture a fresh photo using your camera', style: TextStyle(fontSize: 12)),
                onTap: () {
                  Navigator.pop(bsContext);
                  _pickProfilePhoto(context, ImageSource.camera);
                },
              ),
              if (hasPhoto) ...[
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.blue.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.visibility_outlined, color: Colors.blue),
                  ),
                  title: const Text('View Full Photo', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Preview your current profile picture', style: TextStyle(fontSize: 12)),
                  onTap: () {
                    Navigator.pop(bsContext);
                    _previewProfilePhoto(context, profile);
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.delete_outline_rounded, color: Colors.red),
                  ),
                  title: const Text(
                    'Remove Photo',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.red),
                  ),
                  subtitle: const Text('Revert back to your name initials', style: TextStyle(fontSize: 12)),
                  onTap: () {
                    Navigator.pop(bsContext);
                    _removeProfilePhoto(context);
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickProfilePhoto(BuildContext context, ImageSource source) async {
    if (source == ImageSource.gallery) {
      final granted = await _requestGalleryPermission(context);
      if (granted != true) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Gallery permission denied. Access is required to select photos.'),
              backgroundColor: AppTheme.accentOrange,
            ),
          );
        }
        return;
      }
    }

    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(source: source, imageQuality: 85);
      if (image != null) {
        final bytes = await image.readAsBytes();
        final photoData = 'data:image/jpeg;base64,${base64Encode(bytes)}';

        AppStateService.instance.updateUserProfileFields(profilePhotoUrl: photoData);
        final updated = AppStateService.instance.currentUserProfile.copyWith(profilePhotoUrl: photoData);
        UserSessionService.saveUserSession(updated);

        if (updated.userId.isNotEmpty) {
          FirestoreService().updateUserProfileData(
            uid: updated.userId,
            profilePhotoUrl: photoData,
          );
          _tryUploadToFirebaseStorage(bytes, updated.userId);
        }

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profile photo updated successfully!'),
              backgroundColor: AppTheme.primaryNavy,
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (e) {
      const fallbackUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80';
      AppStateService.instance.updateUserProfileFields(profilePhotoUrl: fallbackUrl);
      final updated = AppStateService.instance.currentUserProfile.copyWith(profilePhotoUrl: fallbackUrl);
      UserSessionService.saveUserSession(updated);
    }
  }

  Future<void> _tryUploadToFirebaseStorage(Uint8List bytes, String userId) async {
    if (userId.isEmpty) return;
    try {
      final storageRef = FirebaseStorage.instance
          .ref()
          .child('user_profiles')
          .child('${userId}_photo.jpg');
      final uploadTask = await storageRef.putData(
        bytes,
        SettableMetadata(contentType: 'image/jpeg'),
      );
      final downloadUrl = await uploadTask.ref.getDownloadURL();
      if (downloadUrl.isNotEmpty) {
        AppStateService.instance.updateUserProfileFields(profilePhotoUrl: downloadUrl);
        final withUrl = AppStateService.instance.currentUserProfile.copyWith(profilePhotoUrl: downloadUrl);
        await UserSessionService.saveUserSession(withUrl);
        await FirestoreService().updateUserProfileData(
          uid: userId,
          profilePhotoUrl: downloadUrl,
        );
      }
    } catch (e) {
      debugPrint('Optional Firebase Storage upload note: $e');
    }
  }

  void _removeProfilePhoto(BuildContext context) {
    AppStateService.instance.updateUserProfileFields(profilePhotoUrl: '');
    final updated = AppStateService.instance.currentUserProfile.copyWith(
      profilePhotoUrl: '',
      avatarUrl: '',
    );
    UserSessionService.saveUserSession(updated);

    if (updated.userId.isNotEmpty) {
      FirestoreService().updateUserProfileData(
        uid: updated.userId,
        profilePhotoUrl: '',
      );
    }

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile photo removed. Showing name initials.'),
          backgroundColor: AppTheme.primaryNavy,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _previewProfilePhoto(BuildContext context, UserProfile profile) {
    final photoUrl = profile.profilePhotoUrl ?? (profile.avatarUrl.isNotEmpty ? profile.avatarUrl : null);
    if (photoUrl == null || photoUrl.trim().isEmpty) return;

    showDialog(
      context: context,
      builder: (dialogCtx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                onPressed: () => Navigator.pop(dialogCtx),
              ),
            ),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: _buildAvatarImageWidget(
                photoUrl,
                profile.initials,
                size: 280,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileAvatar(UserProfile profile, {required double radius}) {
    final photoUrl = profile.profilePhotoUrl ?? (profile.avatarUrl.isNotEmpty ? profile.avatarUrl : null);
    return _buildAvatarImageWidget(photoUrl, profile.initials, size: radius * 2);
  }

  Widget _buildAvatarImageWidget(String? photoUrl, String initials, {required double size}) {
    return AppAvatarImage(
      photoUrl: photoUrl,
      initials: initials,
      size: size,
      backgroundColor: AppTheme.accentOrange,
      textColor: Colors.white,
    );
  }

  void _openEditProfileModal(BuildContext context, UserProfile profile) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) => _EditProfileBottomSheet(profile: profile),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService.instance;

    return Scaffold(
      body: ListenableBuilder(
        listenable: appState,
        builder: (context, _) {
          final profile = appState.currentUserProfile;
          final completionPct = appState.profileCompletionPercentage;
          final pendingFields = appState.pendingProfileFields;

          return SingleChildScrollView(
            child: Column(
              children: [
                // Curved Header Card with Live User Info
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(16, 44, 16, 26),
                  decoration: const BoxDecoration(
                    color: AppTheme.primaryNavy,
                    borderRadius: BorderRadius.vertical(
                      bottom: Radius.circular(28),
                    ),
                  ),
                  child: Column(
                    children: [
                      Align(
                        alignment: Alignment.topLeft,
                        child: IconButton(
                          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                          tooltip: 'Back',
                          onPressed: () {
                            if (Navigator.canPop(context)) {
                              Navigator.pop(context);
                            } else if (onBackToHome != null) {
                              onBackToHome!();
                            }
                          },
                        ),
                      ),
                      AppPressable(
                        onTap: () => _showProfilePhotoOptions(context, profile),
                        child: Stack(
                          alignment: Alignment.bottomRight,
                          children: [
                            Container(
                              width: 90,
                              height: 90,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.all(3),
                              child: ClipOval(
                                child: _buildProfileAvatar(profile, radius: 42),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: AppTheme.accentOrange,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.25),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Icon(
                                (profile.profilePhotoUrl != null &&
                                            profile.profilePhotoUrl!.trim().isNotEmpty) ||
                                        profile.avatarUrl.isNotEmpty
                                    ? Icons.edit_rounded
                                    : Icons.camera_alt_rounded,
                                size: 14,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        profile.name,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // User Category Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.accentOrange.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.accentOrange.withValues(alpha: 0.5)),
                        ),
                        child: Text(
                          profile.userCategory.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.accentOrange,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      Text(
                        '${profile.email.isNotEmpty ? profile.email : "No Email"} • ${profile.phone}',
                        style: const TextStyle(
                          fontSize: 13,
                          color: Colors.white70,
                        ),
                      ),
                      if (profile.dateOfBirth.isNotEmpty || profile.religion.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 12,
                          runSpacing: 4,
                          alignment: WrapAlignment.center,
                          children: [
                            if (profile.dateOfBirth.isNotEmpty)
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.cake_outlined, size: 13, color: Colors.white70),
                                  const SizedBox(width: 5),
                                  Text(
                                    'DOB: ${profile.dateOfBirth}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Colors.white70,
                                    ),
                                  ),
                                ],
                              ),
                            if (profile.religion.isNotEmpty)
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.diversity_3_outlined, size: 13, color: Colors.white70),
                                  const SizedBox(width: 5),
                                  Text(
                                    'Religion: ${profile.religion}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Colors.white70,
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ],
                      if (profile.companyName.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          profile.companyName,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Trade Tier Status Card
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: ProfileTierCard(user: profile),
                ),
                const SizedBox(height: 16),

                // Profile Completion Progress Card
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    decoration: AppTheme.luxuryCardDecorationWithBorder(
                      borderColor: completionPct == 100
                          ? AppTheme.statusSuccess
                          : AppTheme.accentOrange.withValues(alpha: 0.4),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  completionPct == 100
                                      ? Icons.check_circle_rounded
                                      : Icons.pie_chart_outline_rounded,
                                  color: completionPct == 100
                                      ? AppTheme.statusSuccess
                                      : AppTheme.accentOrange,
                                  size: 22,
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Profile Completion',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.primaryNavy,
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: (completionPct == 100
                                        ? AppTheme.statusSuccess
                                        : AppTheme.accentOrange)
                                    .withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '$completionPct% Complete',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: completionPct == 100
                                      ? AppTheme.statusSuccess
                                      : AppTheme.accentOrange,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Animated Linear Progress Bar
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: completionPct / 100.0,
                            minHeight: 8,
                            backgroundColor: Colors.grey.shade200,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              completionPct == 100
                                  ? AppTheme.statusSuccess
                                  : AppTheme.accentOrange,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        if (completionPct < 100) ...[
                          const Text(
                            'Pending Details to Complete:',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: pendingFields.map((item) {
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppTheme.backgroundColor,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: AppTheme.borderSubtle),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.add_circle_outline, size: 12, color: AppTheme.accentOrange),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${item['title']} (+${item['points']})',
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textDark),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            height: 42,
                            child: AppPressable(
                              onTap: () => _openEditProfileModal(context, profile),
                              child: Container(
                                decoration: BoxDecoration(
                                  border: Border.all(color: AppTheme.accentOrange),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                alignment: Alignment.center,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.edit_outlined, size: 16, color: AppTheme.accentOrange),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Complete Pending Details',
                                      style: GoogleFonts.inter(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.accentOrange,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ] else ...[
                          const Row(
                            children: [
                              Icon(Icons.verified_user_rounded, color: AppTheme.statusSuccess, size: 16),
                              SizedBox(width: 6),
                              Text(
                                'Great job! Your profile is 100% verified & complete.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.statusSuccess,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Settings Menu List
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    decoration: AppTheme.luxuryCardDecoration,
                    child: Column(
                      children: [
                        _buildTile(Icons.person_outline_rounded, 'My Profile & Details', () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen()));
                        }),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.location_on_outlined, 'Delivery Addresses', () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen()));
                        }),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.sell_outlined, 'My Contract Rates', () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const ContractRatesScreen()));
                        }),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.shopping_bag_outlined, 'My Orders', () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const OrdersScreen()));
                        }),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.favorite_outline_rounded, 'Favorites', () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const FavoritesScreen()));
                        }),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.notifications_none_rounded, 'Notifications', () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()));
                        }),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.headset_mic_outlined, 'Help & Support', () {}),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.info_outline_rounded, 'About Us', () {}),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(
                          Icons.logout_rounded,
                          'Log Out',
                          () => _performDirectLogout(context),
                          isDestructive: true,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildTile(
    IconData icon,
    String title,
    VoidCallback onTap, {
    bool isDestructive = false,
  }) {
    return AppPressable(
      onTap: onTap,
      scaleDown: 0.985,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isDestructive
                    ? Colors.red.withValues(alpha: 0.08)
                    : AppTheme.primaryNavy.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                size: 20,
                color: isDestructive ? Colors.red : AppTheme.primaryNavy,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: isDestructive ? Colors.red : AppTheme.textDark,
                ),
              ),
            ),
            if (!isDestructive)
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppTheme.textSubtle,
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _performDirectLogout(BuildContext context) async {
    await UserSessionService.clearUserSession();
    if (context.mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (_) => const AuthScreen(
            initialMode: AuthViewMode.login,
          ),
        ),
        (route) => false,
      );
    }
  }
}

class _EditProfileBottomSheet extends StatefulWidget {
  final UserProfile profile;

  const _EditProfileBottomSheet({required this.profile});

  @override
  State<_EditProfileBottomSheet> createState() => _EditProfileBottomSheetState();
}

class _EditProfileBottomSheetState extends State<_EditProfileBottomSheet> {
  late TextEditingController _nameController;
  late TextEditingController _religionController;
  late TextEditingController _dobController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _companyController;
  late TextEditingController _cityController;
  late TextEditingController _stateController;
  late TextEditingController _pincodeController;
  late TextEditingController _gstController;
  late TextEditingController _addressLineController;

  late String _selectedCategory;
  late String _selectedRegion;

  final List<String> _categories = [
    'Dealer',
    'Architect',
    'Builder',
    'Contractor',
    'Wholesaler',
    'Retailer',
  ];

  @override
  void initState() {
    super.initState();
    final p = widget.profile;
    _nameController = TextEditingController(text: p.name);
    _religionController = TextEditingController(text: p.religion);
    _dobController = TextEditingController(text: p.dateOfBirth);
    _emailController = TextEditingController(text: p.email);
    _phoneController = TextEditingController(text: p.phone);
    _companyController = TextEditingController(text: p.companyName);
    _cityController = TextEditingController(text: p.city);
    _stateController = TextEditingController(text: p.state);
    _pincodeController = TextEditingController(text: p.pincode);
    _gstController = TextEditingController(text: p.gstNumber);
    _addressLineController = TextEditingController(
      text: (p.address['line1'] ?? p.address['addressLine'] ?? '') as String,
    );

    _selectedCategory = p.userCategory.isNotEmpty ? p.userCategory : 'Dealer';
    _selectedRegion = p.region.isNotEmpty ? p.region : 'West India (Gujarat/Maharashtra)';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _religionController.dispose();
    _dobController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _companyController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _pincodeController.dispose();
    _gstController.dispose();
    _addressLineController.dispose();
    super.dispose();
  }

  Widget _buildDateField(
    BuildContext context,
    String label,
    TextEditingController controller,
    IconData icon,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: AppTheme.textDark,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          readOnly: true,
          onTap: () async {
            DateTime initialDate = DateTime(1995, 1, 1);
            if (controller.text.trim().isNotEmpty) {
              try {
                final parts = controller.text.trim().split(RegExp(r'[-/]'));
                if (parts.length == 3) {
                  if (parts[0].length == 4) {
                    initialDate = DateTime(
                        int.parse(parts[0]), int.parse(parts[1]), int.parse(parts[2]));
                  } else {
                    initialDate = DateTime(
                        int.parse(parts[2]), int.parse(parts[1]), int.parse(parts[0]));
                  }
                }
              } catch (_) {}
            }
            final picked = await showDatePicker(
              context: context,
              initialDate: initialDate,
              firstDate: DateTime(1920),
              lastDate: DateTime.now(),
              builder: (context, child) {
                return Theme(
                  data: Theme.of(context).copyWith(
                    colorScheme: const ColorScheme.light(
                      primary: AppTheme.primaryNavy,
                      onPrimary: Colors.white,
                      onSurface: AppTheme.textDark,
                    ),
                  ),
                  child: child!,
                );
              },
            );
            if (picked != null) {
              final day = picked.day.toString().padLeft(2, '0');
              final month = picked.month.toString().padLeft(2, '0');
              final year = picked.year.toString();
              controller.text = '$day/$month/$year';
            }
          },
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppTheme.primaryNavy, size: 20),
            suffixIcon: const Icon(Icons.calendar_today_rounded,
                color: AppTheme.primaryNavy, size: 18),
            hintText: 'Select $label (DD/MM/YYYY)',
            filled: true,
            fillColor: AppTheme.backgroundColor,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTextField(
    String label,
    TextEditingController controller,
    IconData icon, {
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: AppTheme.textDark,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppTheme.primaryNavy, size: 20),
            hintText: 'Enter $label',
            filled: true,
            fillColor: AppTheme.backgroundColor,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.edit_note_rounded,
                        color: AppTheme.primaryNavy, size: 24),
                    SizedBox(width: 8),
                    Text(
                      'Edit Profile & Details',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: AppTheme.textSubtle),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          // Form Fields
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildTextField('Full Name', _nameController, Icons.person_outlined),
                  const SizedBox(height: 14),
                  _buildDateField(context, 'Date of Birth', _dobController, Icons.cake_outlined),
                  const SizedBox(height: 14),
                  _buildTextField('Religion', _religionController, Icons.diversity_3_outlined),
                  const SizedBox(height: 14),
                  _buildTextField('Mobile Number', _phoneController, Icons.phone_outlined, keyboardType: TextInputType.phone),
                  const SizedBox(height: 14),
                  _buildTextField('Email Address', _emailController, Icons.email_outlined, keyboardType: TextInputType.emailAddress),
                  const SizedBox(height: 14),
                  _buildTextField('Company / Business Name', _companyController, Icons.business_outlined),
                  const SizedBox(height: 14),

                  // User Category Dropdown
                  const Text(
                    'User / Business Category',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: AppTheme.backgroundColor,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.borderSubtle),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _categories.contains(_selectedCategory) ? _selectedCategory : 'Dealer',
                        isExpanded: true,
                        items: _categories.map((cat) {
                          return DropdownMenuItem(
                            value: cat,
                            child: Text(cat, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _selectedCategory = val);
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),



                  _buildTextField('Street / Office Address', _addressLineController, Icons.location_on_outlined),
                  const SizedBox(height: 14),
                  _buildTextField('City', _cityController, Icons.location_city_outlined),
                  const SizedBox(height: 14),
                  _buildTextField('State', _stateController, Icons.map_outlined),
                  const SizedBox(height: 14),
                  _buildTextField('PIN Code', _pincodeController, Icons.pin_drop_outlined, keyboardType: TextInputType.number),
                  const SizedBox(height: 14),
                  _buildTextField('GSTIN Number', _gstController, Icons.receipt_long_outlined),
                  const SizedBox(height: 24),

                  // Save Action Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryNavy,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () async {
                        final newName = _nameController.text.trim();
                        final newReligion = _religionController.text.trim();
                        final newDob = _dobController.text.trim();
                        final newEmail = _emailController.text.trim();
                        final newPhone = _phoneController.text.trim();
                        final newCompany = _companyController.text.trim();
                        final newCity = _cityController.text.trim();
                        final newState = _stateController.text.trim();
                        final newPincode = _pincodeController.text.trim();
                        final newGst = _gstController.text.trim();
                        final newAddrLine = _addressLineController.text.trim();

                        final updatedAddr = {
                          'line1': newAddrLine,
                          'city': newCity,
                          'state': newState,
                          'pincode': newPincode,
                        };

                        // Update live AppStateService
                        AppStateService.instance.updateUserProfileFields(
                          name: newName.isNotEmpty ? newName : null,
                          religion: newReligion,
                          dateOfBirth: newDob,
                          email: newEmail,
                          phone: newPhone.isNotEmpty ? newPhone : null,
                          companyName: newCompany,
                          userCategory: _selectedCategory,
                          city: newCity,
                          state: newState,
                          region: _selectedRegion,
                          pincode: newPincode,
                          gstNumber: newGst,
                          address: updatedAddr,
                        );

                        // Save to persistent SharedPreferences session
                        await UserSessionService.saveUserSession(
                          AppStateService.instance.currentUserProfile,
                        );

                        // Update Firestore in background
                        try {
                          await FirestoreService.instance.updateUserProfileData(
                            uid: widget.profile.userId,
                            fullName: newName.isNotEmpty ? newName : widget.profile.name,
                            religion: newReligion,
                            dateOfBirth: newDob,
                            phoneNumber: newPhone.isNotEmpty ? newPhone : widget.profile.phone,
                            role: _selectedCategory,
                            email: newEmail,
                            companyName: newCompany,
                            city: newCity,
                            state: newState,
                            region: _selectedRegion,
                            pincode: newPincode,
                            address: updatedAddr,
                          );
                          await FirestoreService().createUserProfile(
                            uid: widget.profile.userId,
                            phoneNumber: newPhone.isNotEmpty ? newPhone : widget.profile.phone,
                            fullName: newName.isNotEmpty ? newName : widget.profile.name,
                            religion: newReligion,
                            dateOfBirth: newDob,
                            role: _selectedCategory,
                            email: newEmail,
                            companyName: newCompany,
                            city: newCity,
                            state: newState,
                            pincode: newPincode,
                            address: updatedAddr,
                            isVerified: true,
                          );
                          await FirestoreService.instance.updateUserRegionAndToken(
                            widget.profile.userId,
                            region: _selectedRegion,
                          );
                        } catch (_) {}

                        if (context.mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Profile details updated successfully!'),
                              backgroundColor: AppTheme.primaryNavy,
                            ),
                          );
                        }
                      },
                      child: const Text('Save Profile Changes'),
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
}
