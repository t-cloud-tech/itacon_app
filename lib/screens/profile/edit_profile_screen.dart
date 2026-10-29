import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/gst_service.dart';
import '../../widgets/interactive_pressable.dart';
import 'package:image_picker/image_picker.dart';
import '../../theme/app_theme.dart';
import '../../services/app_state_service.dart';
import '../../services/firestore_service.dart';
import '../../services/user_session_service.dart';
import '../../services/profile_photo_service.dart';
import '../../widgets/app_avatar_image.dart';

/// Full-Screen Edit Profile featuring Keyboard Overflow Fix, Avatar Picker,
/// and Showroom/Store Display Showcase Gallery.
class EditProfileScreen extends StatefulWidget {
  final FirestoreService? firestoreService;
  const EditProfileScreen({super.key, this.firestoreService});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final AppStateService _appState = AppStateService.instance;
  late final FirestoreService _firestoreService;

  late TextEditingController _nameController;
  late TextEditingController _dobController;
  late TextEditingController _religionController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _companyController;
  late TextEditingController _cityController;
  late TextEditingController _stateController;
  late TextEditingController _pincodeController;
  late TextEditingController _gstController;
  late TextEditingController _addressLineController;

  String? _selectedCategory;
  late String _selectedRegion;
  String? _profilePhotoUrl;
  List<String> _showroomImages = [];
  bool _isSaving = false;
  late final GstService _gstService;
  bool _isGstLoading = false;
  bool _gstVerified = false;
  DateTime? _gstVerifiedAt;
  String? _gstStatusWarning;
  Timer? _gstDebounceTimer;
  final Set<String> _autoFilledFields = {};

  final List<String> _categories = [
    'Dealer',
    'Architect',
    'Builder / Contractor',
    'Wholesaler',
    'Retailer',
    'Trader',
  ];

  // Default sample showroom assets for demonstration
  final List<String> _sampleShowroomAssets = [
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=600&q=80',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ProfilePhotoService.retrieveAndHandleLostData(context);
      }
    });
    _firestoreService = widget.firestoreService ?? FirestoreService.instance;
    final profile = _appState.currentUserProfile;
    _nameController = TextEditingController(text: profile.name);
    _dobController = TextEditingController(text: profile.dateOfBirth);
    _religionController = TextEditingController(text: profile.religion);
    final initialEmail = (profile.email.toLowerCase().startsWith('user_') &&
            profile.email.toLowerCase().endsWith('@itacon.com'))
        ? ''
        : profile.email;
    _emailController = TextEditingController(text: initialEmail);
    _phoneController = TextEditingController(text: profile.phone);
    _companyController = TextEditingController(text: profile.companyName);
    _cityController = TextEditingController(text: profile.city);
    _stateController = TextEditingController(text: profile.state);
    _pincodeController = TextEditingController(text: profile.pincode);
    _gstController = TextEditingController(text: profile.gstNumber);
    _addressLineController = TextEditingController(
      text: (profile.address['line1'] ?? profile.address['addressLine'] ?? '') as String,
    );

    final initialCat = profile.userCategory.trim();
    if (initialCat.isEmpty) {
      _selectedCategory = null;
    } else if (initialCat.toLowerCase() == 'builder' ||
        initialCat.toLowerCase() == 'builder / contractor' ||
        initialCat.toLowerCase() == 'contractor') {
      _selectedCategory = 'Builder / Contractor';
    } else {
      final matched = _categories.where(
        (c) => c.toLowerCase() == initialCat.toLowerCase(),
      );
      _selectedCategory = matched.isNotEmpty ? matched.first : null;
    }
    _gstService = GstService();
    _gstVerified = profile.gstVerified;
    _gstVerifiedAt = profile.gstVerifiedAt;
    _selectedRegion = profile.region.isNotEmpty ? profile.region : 'West India (Gujarat/Maharashtra)';
    _profilePhotoUrl = profile.profilePhotoUrl ?? (profile.avatarUrl.isNotEmpty ? profile.avatarUrl : null);
    _showroomImages = List<String>.from(profile.showroomImages);

    if (_showroomImages.isEmpty) {
      _showroomImages = List<String>.from(_sampleShowroomAssets.take(2));
    }
  }

  @override
  void dispose() {
    _gstDebounceTimer?.cancel();
    _nameController.dispose();
    _dobController.dispose();
    _religionController.dispose();
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
            'ITACON Granito requires photo library access so you can select and set your personal profile picture and upload showroom display pictures directly from your device gallery.',
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

  Future<void> _showProfilePhotoActionSheet() async {
    final bool hasPhoto = _profilePhotoUrl != null && _profilePhotoUrl!.trim().isNotEmpty;

    if (!mounted) return;
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
                subtitle: const Text('Pick an image from your device storage', style: TextStyle(fontSize: 12)),
                onTap: () {
                  Navigator.pop(bsContext);
                  _pickProfilePhotoFromSource(ImageSource.gallery);
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
                  _pickProfilePhotoFromSource(ImageSource.camera);
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
                    _previewCurrentPhoto();
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
                    _removeProfilePhoto();
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickProfilePhotoFromSource(ImageSource source) async {
    if (source == ImageSource.gallery) {
      final granted = await _requestGalleryPermission(context);
      if (granted != true) {
        if (mounted) {
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

    if (!mounted) return;
    final downloadUrl = await ProfilePhotoService.pickAndUploadProfilePhoto(
      context: context,
      source: source,
    );

    if (downloadUrl != null && mounted) {
      _applyNewProfilePhoto(downloadUrl);
    }
  }

  void _applyNewProfilePhoto(String newPhotoPath) {
    setState(() {
      _profilePhotoUrl = newPhotoPath;
    });

    // Immediately sync to AppStateService and UserSessionService
    // so it shows on the Profile page even before hitting Save Changes!
    _appState.updateUserProfileFields(profilePhotoUrl: newPhotoPath);
    UserSessionService.saveUserSession(
      _appState.currentUserProfile.copyWith(profilePhotoUrl: newPhotoPath),
    );

    final uid = _appState.currentUserProfile.userId;
    if (uid.isNotEmpty) {
      _firestoreService.updateUserProfileData(
        uid: uid,
        profilePhotoUrl: newPhotoPath,
      );
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile photo updated successfully!'),
          backgroundColor: AppTheme.primaryNavy,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _removeProfilePhoto() {
    setState(() {
      _profilePhotoUrl = '';
    });

    _appState.updateUserProfileFields(profilePhotoUrl: '');
    UserSessionService.saveUserSession(
      _appState.currentUserProfile.copyWith(
        profilePhotoUrl: '',
        avatarUrl: '',
      ),
    );

    final uid = _appState.currentUserProfile.userId;
    if (uid.isNotEmpty) {
      _firestoreService.updateUserProfileData(
        uid: uid,
        profilePhotoUrl: '',
      );
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile photo removed. Showing name initials.'),
          backgroundColor: AppTheme.primaryNavy,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _previewCurrentPhoto() {
    if (_profilePhotoUrl == null || _profilePhotoUrl!.trim().isEmpty) return;
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
                _profilePhotoUrl,
                _nameController.text.isNotEmpty ? _nameController.text[0].toUpperCase() : 'U',
                size: 280,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _addShowroomPhoto() async {
    if (_showroomImages.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Maximum 5 showroom display photos reached. Photos are now locked permanently.'),
          backgroundColor: AppTheme.primaryNavy,
        ),
      );
      return;
    }

    final granted = await _requestGalleryPermission(context);
    if (granted != true) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Gallery access permission denied.'),
            backgroundColor: AppTheme.accentOrange,
          ),
        );
      }
      return;
    }

    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 80,
      );
      if (image != null) {
        final bytes = await image.readAsBytes();
        final photoData = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        setState(() {
          if (_showroomImages.length < 5) {
            _showroomImages.add(photoData);
          }
        });
      } else {
        final nextImg = _sampleShowroomAssets[_showroomImages.length % _sampleShowroomAssets.length];
        setState(() {
          if (_showroomImages.length < 5) {
            _showroomImages.add(nextImg);
          }
        });
      }
    } catch (_) {
      final nextImg = _sampleShowroomAssets[_showroomImages.length % _sampleShowroomAssets.length];
      setState(() {
        if (_showroomImages.length < 5) {
          _showroomImages.add(nextImg);
        }
      });
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _showroomImages.length >= 5
                ? '5/5 showroom photos uploaded! Showcase is now locked permanently.'
                : 'New showroom display photo added (${_showroomImages.length}/5)!',
          ),
          backgroundColor: AppTheme.primaryNavy,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _removeShowroomPhoto(int index) {
    if (_showroomImages.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Showroom showcase is complete (5/5 photos). Photos cannot be deleted.'),
          backgroundColor: AppTheme.accentOrange,
        ),
      );
      return;
    }
    setState(() {
      _showroomImages.removeAt(index);
    });
  }

  Future<void> _saveProfile() async {
    if (_isSaving) return;
    final rawEmail = _emailController.text.trim();
    if (rawEmail.isNotEmpty) {
      final emailRegex =
          RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
      if (!emailRegex.hasMatch(rawEmail)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Please enter a valid email address or leave it empty.'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
    }
    final normalizedEmail = rawEmail.toLowerCase();

    setState(() => _isSaving = true);
    final profile = _appState.currentUserProfile;

    final updatedAddr = {
      'line1': _addressLineController.text.trim(),
      'city': _cityController.text.trim(),
      'state': _stateController.text.trim(),
      'pincode': _pincodeController.text.trim(),
    };

    // Update Firestore database first.
    // AppStateService and UserSessionService are ONLY synchronized AFTER
    // Firestore confirms persistence to prevent false 100% completion indications.
    try {
      await _firestoreService.updateUserProfileData(
        uid: profile.userId,
        name: _nameController.text.trim(),
        religion: _religionController.text.trim(),
        dateOfBirth: _dobController.text.trim(),
        phone: _phoneController.text.trim(),
        email: normalizedEmail,
        companyName: _companyController.text.trim(),
        role: profile.userCategory.isNotEmpty ? profile.userCategory : _selectedCategory,
        updateRole: false,
        city: _cityController.text.trim(),
        state: _stateController.text.trim(),
        region: _selectedRegion,
        pincode: _pincodeController.text.trim(),
        gstNumber: _gstController.text.trim(),
        gstVerified: _gstVerified,
        gstVerifiedAt: _gstVerifiedAt,
        profilePhotoUrl: _profilePhotoUrl,
        showroomImages: _showroomImages,
        address: updatedAddr,
      );

      await _firestoreService.updateUserRegionAndToken(
        profile.userId,
        region: _selectedRegion,
      );

      // Fetch the updated authoritative document from Firestore
      final freshProfile = await _firestoreService.getUserProfile(profile.userId);
      if (freshProfile == null) {
        throw Exception('Failed to reload profile after saving.');
      }

      // Synchronize in-memory and local session ONLY after confirmed persistence
      _appState.setCurrentUserProfile(freshProfile);
      await UserSessionService.saveUserSession(freshProfile);
    } catch (e) {
      debugPrint('[EditProfileScreen] Error saving profile to Firestore: $e');
      if (mounted) {
        // Form field controllers are preserved so customer data is not lost
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save profile: $e'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
      return;
    }

    setState(() => _isSaving = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile & Showroom details saved successfully!'),
          backgroundColor: AppTheme.primaryNavy,
        ),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
          tooltip: 'Back',
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text('Edit Profile & Details'),
        backgroundColor: Colors.white,
        elevation: 0,
      ),

      // CRITICAL FIX: Wrap entire content in SingleChildScrollView + SafeArea + viewInsets padding
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 40,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ---------------------------------------------------------------
              // 1. AVATAR PROFILE PHOTO PICKER
              // ---------------------------------------------------------------
              Center(
                child: Column(
                  children: [
                    Stack(
                      children: [
                        GestureDetector(
                          onTap: _showProfilePhotoActionSheet,
                          child: Container(
                            width: 104,
                            height: 104,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                              border: Border.all(color: AppTheme.primaryNavy, width: 2.5),
                              boxShadow: [
                                BoxShadow(
                                  color: AppTheme.primaryNavy.withValues(alpha: 0.15),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: _buildAvatarImageWidget(
                                _profilePhotoUrl,
                                _nameController.text.isNotEmpty ? _nameController.text[0].toUpperCase() : 'U',
                                size: 104,
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: GestureDetector(
                            onTap: _showProfilePhotoActionSheet,
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppTheme.accentOrange,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Icon(
                                (_profilePhotoUrl != null && _profilePhotoUrl!.trim().isNotEmpty)
                                    ? Icons.edit_rounded
                                    : Icons.camera_alt_rounded,
                                color: Colors.white,
                                size: 18,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (_profilePhotoUrl != null && _profilePhotoUrl!.trim().isNotEmpty)
                      GestureDetector(
                        onTap: _showProfilePhotoActionSheet,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: AppTheme.primaryNavy.withValues(alpha: 0.25),
                              width: 1,
                            ),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.edit_rounded, size: 13, color: AppTheme.primaryNavy),
                              SizedBox(width: 5),
                              Text(
                                'Edit Photo',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryNavy,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      const Text(
                        'Tap camera to add profile photo',
                        style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ---------------------------------------------------------------
              // 2. SHOWROOM / STORE DISPLAY SHOWCASE GALLERY (Up to 5 Photos)
              // ---------------------------------------------------------------
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(
                    child: Text(
                      'Showroom & Store Display Showcase',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _showroomImages.length >= 5
                          ? Colors.green.shade50
                          : AppTheme.primaryNavy.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _showroomImages.length >= 5
                            ? Colors.green.shade400
                            : AppTheme.primaryNavy.withValues(alpha: 0.2),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _showroomImages.length >= 5
                              ? Icons.lock_rounded
                              : Icons.photo_library_outlined,
                          size: 13,
                          color: _showroomImages.length >= 5
                              ? Colors.green.shade800
                              : AppTheme.primaryNavy,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${_showroomImages.length}/5',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: _showroomImages.length >= 5
                                ? Colors.green.shade800
                                : AppTheme.primaryNavy,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                _showroomImages.length >= 5
                    ? 'Showroom showcase is complete (5/5 photos). Photos are permanent & locked.'
                    : 'Upload photos of your tile racks, sample displays, or store front (Max 5)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: _showroomImages.length >= 5 ? FontWeight.w600 : FontWeight.normal,
                  color: _showroomImages.length >= 5 ? Colors.green.shade700 : AppTheme.textSubtle,
                ),
              ),
              const SizedBox(height: 12),

              SizedBox(
                height: 100,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  itemCount: _showroomImages.length < 5
                      ? _showroomImages.length + 1
                      : _showroomImages.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (context, index) {
                    if (index == _showroomImages.length) {
                      // Dashed Add Photo Tile - Only visible if less than 5 photos
                      return GestureDetector(
                        onTap: _addShowroomPhoto,
                        child: Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            color: AppTheme.primaryNavy.withValues(alpha: 0.04),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: AppTheme.primaryNavy.withValues(alpha: 0.4),
                              width: 1.5,
                              style: BorderStyle.solid,
                            ),
                          ),
                          child: const Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.add_photo_alternate_outlined,
                                  color: AppTheme.primaryNavy, size: 28),
                              SizedBox(height: 4),
                              Text(
                                'Add Photo',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryNavy,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }

                    final imgUrl = _showroomImages[index];
                    final bool isLocked = _showroomImages.length >= 5;

                    return RepaintBoundary(
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: _buildShowroomImage(imgUrl),
                          ),
                          // Only show delete button if less than 5 photos are added.
                          // When user adds 5 photos, they cannot access delete button!
                          if (!isLocked)
                            Positioned(
                              top: 4,
                              right: 4,
                              child: GestureDetector(
                                onTap: () => _removeShowroomPhoto(index),
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: const BoxDecoration(
                                    color: Color(0xB3000000),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.close_rounded,
                                    color: Colors.white,
                                    size: 14,
                                  ),
                                ),
                              ),
                            )
                          else
                            // Lock badge showing photos are locked permanently
                            Positioned(
                              top: 6,
                              right: 6,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryNavy.withValues(alpha: 0.85),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.lock_rounded,
                                  color: Colors.white,
                                  size: 12,
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 28),

              // ---------------------------------------------------------------
              // 3. INPUT FORM FIELDS
              // ---------------------------------------------------------------
              _buildInputField(
                'Full Name',
                _nameController,
                Icons.person_outlined,
                hintText: 'Enter full name',
              ),
              const SizedBox(height: 14),
              _buildDateField('Date of Birth', _dobController, Icons.cake_outlined),
              const SizedBox(height: 14),
              _buildReligionField('Religion', _religionController, Icons.diversity_3_outlined),
              const SizedBox(height: 14),
              _buildInputField(
                'Mobile Number',
                _phoneController,
                Icons.phone_outlined,
                keyboardType: TextInputType.phone,
                hintText: 'Enter mobile number',
                readOnly: true,
                helperText: 'Registered mobile number cannot be changed (used for login)',
              ),
              const SizedBox(height: 14),
              _buildInputField(
                'Email Address',
                _emailController,
                Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
                hintText: 'Enter your email address',
              ),
              const SizedBox(height: 14),
              _buildInputField(
                'Company / Business Name',
                _companyController,
                Icons.business_outlined,
                hintText: 'Enter company or business name',
                isVerifiedFromGst: _autoFilledFields.contains('companyName'),
                onChanged: (_) {
                  if (_autoFilledFields.contains('companyName')) {
                    setState(() => _autoFilledFields.remove('companyName'));
                  }
                },
              ),
              const SizedBox(height: 14),

              // User Category Dropdown
              const Text(
                'Business / User Category',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textDark),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: (_selectedCategory != null && _categories.contains(_selectedCategory))
                        ? _selectedCategory
                        : null,
                    hint: const Text(
                      'Select business category',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppTheme.textSubtle,
                        fontWeight: FontWeight.normal,
                      ),
                    ),
                    isExpanded: true,
                    items: _categories.map((cat) {
                      return DropdownMenuItem(
                        value: cat,
                        child: Text(cat, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedCategory = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 14),

              _buildInputField(
                'Delivery Address',
                _addressLineController,
                Icons.home_outlined,
                hintText: 'Enter your complete delivery address',
                isVerifiedFromGst: _autoFilledFields.contains('address'),
                onChanged: (_) {
                  if (_autoFilledFields.contains('address')) {
                    setState(() => _autoFilledFields.remove('address'));
                  }
                },
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: _buildInputField(
                      'City',
                      _cityController,
                      Icons.location_city_outlined,
                      hintText: 'Enter city',
                      isVerifiedFromGst: _autoFilledFields.contains('city'),
                      onChanged: (_) {
                        if (_autoFilledFields.contains('city')) {
                          setState(() => _autoFilledFields.remove('city'));
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildInputField(
                      'State',
                      _stateController,
                      Icons.map_outlined,
                      hintText: 'Select state',
                      isVerifiedFromGst: _autoFilledFields.contains('state'),
                      onChanged: (_) {
                        if (_autoFilledFields.contains('state')) {
                          setState(() => _autoFilledFields.remove('state'));
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: _buildInputField(
                      'Pincode',
                      _pincodeController,
                      Icons.pin_drop_outlined,
                      keyboardType: TextInputType.number,
                      hintText: 'Enter 6-digit pincode',
                      isVerifiedFromGst: _autoFilledFields.contains('pincode'),
                      onChanged: (_) {
                        if (_autoFilledFields.contains('pincode')) {
                          setState(() => _autoFilledFields.remove('pincode'));
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildGstField(),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              // ---------------------------------------------------------------
              // 4. SAVE BUTTON ACTION
              // ---------------------------------------------------------------
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _isSaving ? null : _saveProfile,
                  child: _isSaving
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'Save Profile & Showroom Details',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDateField(
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
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppTheme.primaryNavy, size: 20),
            suffixIcon: const Icon(Icons.calendar_today_rounded,
                color: AppTheme.primaryNavy, size: 18),
            hintText: 'Select date of birth (DD/MM/YYYY)',
            hintStyle: const TextStyle(
              fontSize: 13,
              color: AppTheme.textSubtle,
              fontWeight: FontWeight.normal,
            ),
            filled: true,
            fillColor: Colors.white,
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
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: AppTheme.primaryNavy, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildReligionField(
    String label,
    TextEditingController controller,
    IconData icon,
  ) {
    const commonReligions = [
      'Hindu',
      'Muslim',
      'Jain',
      'Christian',
      'Sikh',
      'Buddhist',
      'Other',
    ];

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
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppTheme.primaryNavy, size: 20),
            hintText: 'Enter or select religion',
            hintStyle: const TextStyle(
              fontSize: 13,
              color: AppTheme.textSubtle,
              fontWeight: FontWeight.normal,
            ),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.primaryNavy, width: 1.5),
            ),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 4,
          children: commonReligions.map((rel) {
            final isSelected = controller.text.trim().toLowerCase() == rel.toLowerCase();
            return ActionChip(
              label: Text(rel),
              labelStyle: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : AppTheme.primaryNavy,
              ),
              backgroundColor: isSelected ? AppTheme.primaryNavy : AppTheme.primaryNavy.withValues(alpha: 0.07),
              side: BorderSide(
                color: isSelected ? AppTheme.primaryNavy : AppTheme.primaryNavy.withValues(alpha: 0.2),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
              onPressed: () {
                setState(() {
                  controller.text = rel;
                });
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildInputField(
    String label,
    TextEditingController controller,
    IconData icon, {
    TextInputType keyboardType = TextInputType.text,
    String? hintText,
    bool readOnly = false,
    String? helperText,
    bool isVerifiedFromGst = false,
    ValueChanged<String>? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isVerifiedFromGst) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(5),
                  border: Border.all(color: const Color(0xFF10B981), width: 0.8),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle_rounded, size: 10, color: Color(0xFF059669)),
                    SizedBox(width: 2),
                    Text(
                      'Verified from GST records',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF059669),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          readOnly: readOnly,
          keyboardType: keyboardType,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: readOnly ? Colors.grey.shade700 : AppTheme.textDark,
          ),
          onChanged: (val) {
            onChanged?.call(val);
          },
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppTheme.primaryNavy, size: 20),
            suffixIcon: readOnly ? const Icon(Icons.lock_outline_rounded, size: 16, color: AppTheme.textSubtle) : null,
            hintText: hintText ?? 'Enter $label',
            hintStyle: const TextStyle(
              fontSize: 13,
              color: AppTheme.textSubtle,
              fontWeight: FontWeight.normal,
            ),
            filled: true,
            fillColor: readOnly ? Colors.grey.shade100 : Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.primaryNavy, width: 1.5),
            ),
          ),
        ),
        if (helperText != null) ...[
          const SizedBox(height: 4),
          Text(
            helperText,
            style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
          ),
        ],
      ],
    );
  }

  void _onGstInputChanged(String gstin) {
    _gstDebounceTimer?.cancel();
    if (GstService.isValidGstFormat(gstin)) {
      _gstDebounceTimer = Timer(const Duration(milliseconds: 800), () {
        if (mounted && GstService.isValidGstFormat(_gstController.text)) {
          _performGstAutoFill(_gstController.text.trim(), isAutoTrigger: true);
        }
      });
    }
  }

  Future<void> _performGstAutoFill(String gstin, {bool isAutoTrigger = false}) async {
    if (_isGstLoading) return;
    setState(() {
      _isGstLoading = true;
      _gstStatusWarning = null;
    });

    try {
      final result = await _gstService.lookupGst(gstin);

      if (!mounted) return;

      if (!result.success) {
        setState(() => _isGstLoading = false);
        if (result.error == 'not-found') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('GST number not found in official records. Please enter details manually.'),
              backgroundColor: Color(0xFF1B365D),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Couldn't fetch GST details. Please enter details manually."),
              backgroundColor: AppTheme.statusError,
            ),
          );
        }
        return;
      }

      // Check inactive / cancelled
      if (result.isCancelledOrInactive) {
        setState(() {
          _gstStatusWarning = 'This GST number is not active (${result.gstStatus})';
        });
      }

      // Prepare fields to auto-fill
      final incomingCompany = (result.companyName ?? '').trim();
      final incomingAddress = (result.address ?? '').trim();
      final incomingCity = (result.city ?? '').trim();
      String incomingState = (result.state ?? '').trim();
      if (incomingState.isEmpty && result.stateCode != null) {
        incomingState = GstService.getStateNameFromCode(result.stateCode) ?? '';
      }
      final incomingPincode = (result.pincode ?? '').trim();

      // Check for conflicts with existing non-empty values
      final conflicts = <String, Map<String, String>>{};
      if (incomingCompany.isNotEmpty &&
          _companyController.text.trim().isNotEmpty &&
          _companyController.text.trim().toLowerCase() != incomingCompany.toLowerCase()) {
        conflicts['Company / Firm Name'] = {
          'current': _companyController.text.trim(),
          'gst': incomingCompany,
        };
      }
      if (incomingAddress.isNotEmpty &&
          _addressLineController.text.trim().isNotEmpty &&
          _addressLineController.text.trim().toLowerCase() != incomingAddress.toLowerCase()) {
        conflicts['Delivery Address'] = {
          'current': _addressLineController.text.trim(),
          'gst': incomingAddress,
        };
      }
      if (incomingCity.isNotEmpty &&
          _cityController.text.trim().isNotEmpty &&
          _cityController.text.trim().toLowerCase() != incomingCity.toLowerCase()) {
        conflicts['City'] = {
          'current': _cityController.text.trim(),
          'gst': incomingCity,
        };
      }
      if (incomingState.isNotEmpty &&
          _stateController.text.trim().isNotEmpty &&
          _stateController.text.trim().toLowerCase() != incomingState.toLowerCase()) {
        conflicts['State'] = {
          'current': _stateController.text.trim(),
          'gst': incomingState,
        };
      }
      if (incomingPincode.isNotEmpty &&
          _pincodeController.text.trim().isNotEmpty &&
          _pincodeController.text.trim() != incomingPincode) {
        conflicts['PIN Code'] = {
          'current': _pincodeController.text.trim(),
          'gst': incomingPincode,
        };
      }

      bool shouldReplaceConflicts = true;
      if (conflicts.isNotEmpty) {
        final bool? confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Row(
              children: [
                Icon(Icons.sync_problem_rounded, color: AppTheme.primaryNavy),
                SizedBox(width: 8),
                Text('Replace with GST details?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'The official GST records differ from details currently in your profile:',
                    style: TextStyle(fontSize: 13, color: AppTheme.textDark),
                  ),
                  const SizedBox(height: 12),
                  ...conflicts.entries.map((entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 8.0),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(entry.key, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                              const SizedBox(height: 2),
                              Text('Current: ${entry.value['current']}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                              Text('GST record: ${entry.value['gst']}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF059669))),
                            ],
                          ),
                        ),
                      )),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('No, Keep Current', style: TextStyle(color: AppTheme.textSubtle, fontWeight: FontWeight.bold)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryNavy,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Yes, Replace', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );

        shouldReplaceConflicts = confirmed == true;
      }

      if (!mounted) return;

      setState(() {
        _isGstLoading = false;
        _gstVerified = true;
        _gstVerifiedAt = DateTime.now();

        // 1. Company Name
        if (incomingCompany.isNotEmpty) {
          if (_companyController.text.trim().isEmpty || (conflicts.containsKey('Company / Firm Name') && shouldReplaceConflicts)) {
            _companyController.text = incomingCompany;
            _autoFilledFields.add('companyName');
          }
        }

        // 2. Address
        if (incomingAddress.isNotEmpty) {
          if (_addressLineController.text.trim().isEmpty || (conflicts.containsKey('Delivery Address') && shouldReplaceConflicts)) {
            _addressLineController.text = incomingAddress;
            _autoFilledFields.add('address');
          }
        }

        // 3. City
        if (incomingCity.isNotEmpty) {
          if (_cityController.text.trim().isEmpty || (conflicts.containsKey('City') && shouldReplaceConflicts)) {
            _cityController.text = incomingCity;
            _autoFilledFields.add('city');
          }
        }

        // 4. State
        if (incomingState.isNotEmpty) {
          if (_stateController.text.trim().isEmpty || (conflicts.containsKey('State') && shouldReplaceConflicts)) {
            _stateController.text = incomingState;
            _autoFilledFields.add('state');
          }
        }

        // 5. Pincode
        if (incomingPincode.isNotEmpty) {
          if (_pincodeController.text.trim().isEmpty || (conflicts.containsKey('PIN Code') && shouldReplaceConflicts)) {
            _pincodeController.text = incomingPincode;
            _autoFilledFields.add('pincode');
          }
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('GST details verified and loaded successfully!'),
          backgroundColor: Color(0xFF059669),
          duration: Duration(seconds: 3),
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isGstLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Couldn't fetch GST details. Please enter details manually."),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
    }
  }

  Widget _buildGstField() {
    final bool canTrigger = GstService.isValidGstFormat(_gstController.text);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Flexible(
              child: Text(
                'GSTIN Number',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            AppPressable(
              onTap: (_isGstLoading || !canTrigger)
                  ? null
                  : () => _performGstAutoFill(_gstController.text.trim()),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                decoration: BoxDecoration(
                  color: canTrigger && !_isGstLoading
                      ? AppTheme.primaryNavy
                      : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: _isGstLoading
                    ? const SizedBox(
                        width: 11,
                        height: 11,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5),
                      )
                    : const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.auto_fix_high_rounded, size: 11, color: Colors.white),
                          SizedBox(width: 3),
                          Text(
                            'Auto-fill',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _gstController,
          textCapitalization: TextCapitalization.characters,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
            LengthLimitingTextInputFormatter(15),
            UpperCaseTextFormatter(),
          ],
          onChanged: (val) {
            final uppercase = val.toUpperCase();
            if (val != uppercase) {
              _gstController.value = _gstController.value.copyWith(
                text: uppercase,
                selection: TextSelection.collapsed(offset: uppercase.length),
              );
            }
            if (_gstStatusWarning != null) {
              setState(() => _gstStatusWarning = null);
            }
            if (_gstVerified) {
              setState(() {
                _gstVerified = false;
                _gstVerifiedAt = null;
              });
            }
            setState(() {});
            _onGstInputChanged(uppercase);
          },
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.5),
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.receipt_long_outlined, color: AppTheme.primaryNavy, size: 20),
            suffixIcon: _gstVerified
                ? const Icon(Icons.verified_rounded, size: 16, color: Color(0xFF059669))
                : null,
            hintText: '15-digit GSTIN',
            hintStyle: const TextStyle(fontSize: 12, color: AppTheme.textSubtle, fontWeight: FontWeight.normal, letterSpacing: 0),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.borderSubtle),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.primaryNavy, width: 1.5),
            ),
          ),
        ),
        if (_gstStatusWarning != null) ...[
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.amber.shade400),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded, size: 13, color: Colors.amber.shade900),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    _gstStatusWarning!,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber.shade900,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }


  Widget _buildAvatarImageWidget(String? photoUrl, String initials, {required double size}) {
    return AppAvatarImage(
      photoUrl: photoUrl,
      initials: initials,
      size: size,
      backgroundColor: AppTheme.primaryNavy.withValues(alpha: 0.1),
      textColor: AppTheme.primaryNavy,
    );
  }

  Widget _buildShowroomImage(String path) {
    return AppShowroomImage(
      imagePath: path,
      width: 100,
      height: 100,
      fit: BoxFit.cover,
    );
  }
}


class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return TextEditingValue(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}
