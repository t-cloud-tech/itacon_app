import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../theme/app_theme.dart';
import 'app_state_service.dart';
import 'firestore_service.dart';
import 'user_session_service.dart';

/// Centralized, production-grade service for selecting, compressing,
/// and uploading customer profile photos with Android activity lifecycle
/// recovery (retrieveLostData) and memory-safe dimensions.
class ProfilePhotoService {
  static final ImagePicker _picker = ImagePicker();

  /// Picks an image from [source] (Camera or Gallery) with downscaled dimensions
  /// (800x800, quality 80) to prevent OOM/memory pressure on Android & iOS.
  /// Gracefully handles cancellation, permission denials, and uploads directly
  /// to Firebase Storage, persisting ONLY the valid HTTPS download URL.
  static Future<String?> pickAndUploadProfilePhoto({
    required BuildContext context,
    required ImageSource source,
  }) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 80,
      );

      if (image == null) {
        // User canceled selection; return gracefully without side-effects
        return null;
      }

      if (!context.mounted) return null;
      return await uploadProfilePhotoFile(context: context, file: image);
    } on PlatformException catch (e) {
      debugPrint('[ProfilePhotoService] PlatformException: ${e.code} - ${e.message}');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e.code == 'camera_access_denied'
                  ? 'Camera permission denied. Please enable camera access in settings.'
                  : 'Photo access denied. Please grant permission in device settings.',
            ),
            backgroundColor: AppTheme.accentOrange,
            duration: const Duration(seconds: 3),
          ),
        );
      }
      return null;
    } catch (e) {
      debugPrint('[ProfilePhotoService] Error picking photo: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Unable to capture or select photo. Please try again.'),
            backgroundColor: AppTheme.accentOrange,
            duration: Duration(seconds: 3),
          ),
        );
      }
      return null;
    }
  }

  /// Uploads an [XFile] to Firebase Storage under `user_profiles/${userId}_photo.jpg`.
  /// On success: updates AppStateService, UserSessionService (SharedPreferences),
  /// and Firestore document with the HTTPS download URL.
  /// On failure: leaves existing profile completely intact without corrupting state.
  static Future<String?> uploadProfilePhotoFile({
    required BuildContext context,
    required XFile file,
  }) async {
    final userId = AppStateService.instance.currentUserProfile.userId;
    if (userId.isEmpty) return null;

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              ),
              SizedBox(width: 12),
              Text('Uploading profile photo...'),
            ],
          ),
          duration: Duration(seconds: 5),
        ),
      );
    }

    try {
      final bytes = await file.readAsBytes();
      if (bytes.isEmpty) return null;

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
        final updated = AppStateService.instance.currentUserProfile.copyWith(profilePhotoUrl: downloadUrl);
        await UserSessionService.saveUserSession(updated);
        await FirestoreService().updateUserProfileData(
          uid: userId,
          profilePhotoUrl: downloadUrl,
        );

        if (context.mounted) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profile photo updated successfully!'),
              backgroundColor: AppTheme.primaryNavy,
              duration: Duration(seconds: 2),
            ),
          );
        }
        return downloadUrl;
      }
    } catch (e) {
      debugPrint('[ProfilePhotoService] Firebase Storage upload error: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Unable to upload profile photo. Please check your network connection.'),
            backgroundColor: AppTheme.statusError,
            duration: Duration(seconds: 3),
          ),
        );
      }
    }
    return null;
  }

  /// Recovers lost photo data when Android destroys the host Activity
  /// during camera image capture.
  static Future<void> retrieveAndHandleLostData(BuildContext context) async {
    try {
      final LostDataResponse response = await _picker.retrieveLostData();
      if (response.isEmpty || response.file == null) return;
      if (context.mounted) {
        await uploadProfilePhotoFile(context: context, file: response.file!);
      }
    } catch (e) {
      debugPrint('[ProfilePhotoService] retrieveLostData note: $e');
    }
  }
}
