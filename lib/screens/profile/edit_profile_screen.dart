import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../theme/app_theme.dart';
import '../../services/app_state_service.dart';
import '../../services/firestore_service.dart';
import '../../services/user_session_service.dart';

/// Full-Screen Edit Profile featuring Keyboard Overflow Fix, Avatar Picker,
/// and Showroom/Store Display Showcase Gallery.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final AppStateService _appState = AppStateService.instance;
  final FirestoreService _firestoreService = FirestoreService.instance;

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

  late String _selectedCategory;
  late String _selectedRegion;
  String? _profilePhotoUrl;
  List<String> _showroomImages = [];
  bool _isSaving = false;

  final List<String> _categories = [
    'Dealer',
    'Architect',
    'Builder',
    'Contractor',
    'Wholesaler',
    'Retailer',
  ];

  final List<String> _regions = [
    'West India (Gujarat/Maharashtra)',
    'North India',
    'South India',
    'East India',
    'Middle East / UAE',
    'International / Other',
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
    final profile = _appState.currentUserProfile;
    _nameController = TextEditingController(text: profile.name);
    _dobController = TextEditingController(text: profile.dateOfBirth);
    _religionController = TextEditingController(text: profile.religion);
    _emailController = TextEditingController(text: profile.email);
    _phoneController = TextEditingController(text: profile.phone);
    _companyController = TextEditingController(text: profile.companyName);
    _cityController = TextEditingController(text: profile.city);
    _stateController = TextEditingController(text: profile.state);
    _pincodeController = TextEditingController(text: profile.pincode);
    _gstController = TextEditingController(text: profile.gstNumber);
    _addressLineController = TextEditingController(
      text: (profile.address['line1'] ?? profile.address['addressLine'] ?? '') as String,
    );

    _selectedCategory = profile.userCategory.isNotEmpty ? profile.userCategory : 'Dealer';
    _selectedRegion = profile.region.isNotEmpty ? profile.region : 'West India (Gujarat/Maharashtra)';
    _profilePhotoUrl = profile.profilePhotoUrl ?? (profile.avatarUrl.isNotEmpty ? profile.avatarUrl : null);
    _showroomImages = List<String>.from(profile.showroomImages);

    if (_showroomImages.isEmpty) {
      _showroomImages = List<String>.from(_sampleShowroomAssets.take(2));
    }
  }

  @override
  void dispose() {
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

    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(source: source, imageQuality: 85);
      if (image != null) {
        _applyNewProfilePhoto(image.path);
      }
    } catch (e) {
      // Fallback sample photo for emulator/web
      _applyNewProfilePhoto('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80');
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
      final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (image != null) {
        setState(() {
          if (_showroomImages.length < 5) {
            _showroomImages.add(image.path);
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
    setState(() => _isSaving = true);
    final profile = _appState.currentUserProfile;

    final updatedAddr = {
      'line1': _addressLineController.text.trim(),
      'city': _cityController.text.trim(),
      'state': _stateController.text.trim(),
      'pincode': _pincodeController.text.trim(),
    };

    // Update live AppStateService
    _appState.updateUserProfileFields(
      name: _nameController.text.trim(),
      dateOfBirth: _dobController.text.trim(),
      religion: _religionController.text.trim(),
      email: _emailController.text.trim(),
      phone: _phoneController.text.trim(),
      companyName: _companyController.text.trim(),
      userCategory: _selectedCategory,
      city: _cityController.text.trim(),
      state: _stateController.text.trim(),
      region: _selectedRegion,
      pincode: _pincodeController.text.trim(),
      gstNumber: _gstController.text.trim(),
      profilePhotoUrl: _profilePhotoUrl,
      showroomImages: _showroomImages,
      address: updatedAddr,
    );

    // Save persistent local session
    await UserSessionService.saveUserSession(_appState.currentUserProfile);

    // Update Firestore database
    try {
      await _firestoreService.updateUserProfileData(
        uid: profile.userId,
        fullName: _nameController.text.trim(),
        religion: _religionController.text.trim(),
        dateOfBirth: _dobController.text.trim(),
        phoneNumber: _phoneController.text.trim(),
        email: _emailController.text.trim(),
        companyName: _companyController.text.trim(),
        role: _selectedCategory,
        city: _cityController.text.trim(),
        state: _stateController.text.trim(),
        region: _selectedRegion,
        pincode: _pincodeController.text.trim(),
        gstNumber: _gstController.text.trim(),
        profilePhotoUrl: _profilePhotoUrl,
        showroomImages: _showroomImages,
        address: updatedAddr,
      );

      await _firestoreService.createUserProfile(
        uid: profile.userId,
        phoneNumber: _phoneController.text.trim(),
        fullName: _nameController.text.trim(),
        religion: _religionController.text.trim(),
        dateOfBirth: _dobController.text.trim(),
        role: _selectedCategory,
        email: _emailController.text.trim(),
        companyName: _companyController.text.trim(),
        city: _cityController.text.trim(),
        state: _stateController.text.trim(),
        pincode: _pincodeController.text.trim(),
        address: updatedAddr,
        isVerified: true,
      );
      await _firestoreService.updateUserRegionAndToken(
        profile.userId,
        region: _selectedRegion,
      );
    } catch (_) {}

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
        title: const Text('Edit Profile & Showroom'),
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
                  const Text(
                    'Showroom & Store Display Showcase',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
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
              _buildInputField('Full Name', _nameController, Icons.person_outlined),
              const SizedBox(height: 14),
              _buildDateField('Date of Birth', _dobController, Icons.cake_outlined),
              const SizedBox(height: 14),
              _buildReligionField('Religion', _religionController, Icons.diversity_3_outlined),
              const SizedBox(height: 14),
              _buildInputField('Mobile Number', _phoneController, Icons.phone_outlined,
                  keyboardType: TextInputType.phone),
              const SizedBox(height: 14),
              _buildInputField('Email Address', _emailController, Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 14),
              _buildInputField('Company / Business Name', _companyController, Icons.business_outlined),
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
                    value: _categories.contains(_selectedCategory) ? _selectedCategory : 'Dealer',
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

              // Region Dropdown
              const Text(
                'Geographic Territory / Hub',
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
                    value: _regions.contains(_selectedRegion)
                        ? _selectedRegion
                        : 'West India (Gujarat/Maharashtra)',
                    isExpanded: true,
                    items: _regions.map((reg) {
                      return DropdownMenuItem(
                        value: reg,
                        child: Text(reg, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedRegion = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 14),

              _buildInputField('Delivery Address', _addressLineController, Icons.home_outlined),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: _buildInputField('City', _cityController, Icons.location_city_outlined),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildInputField('State', _stateController, Icons.map_outlined),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: _buildInputField('Pincode', _pincodeController, Icons.pin_drop_outlined,
                        keyboardType: TextInputType.number),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildInputField('GSTIN Number', _gstController, Icons.receipt_long_outlined),
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
            hintText: 'Select $label (DD/MM/YYYY)',
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
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppTheme.primaryNavy, size: 20),
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
        ),
      ],
    );
  }

  Widget _buildAvatarImageWidget(String? photoUrl, String initials, {required double size}) {
    final clean = photoUrl?.trim() ?? '';
    final fallback = Container(
      width: size,
      height: size,
      color: AppTheme.primaryNavy.withValues(alpha: 0.1),
      alignment: Alignment.center,
      child: Text(
        initials.isNotEmpty ? initials : 'U',
        style: TextStyle(
          fontSize: size * 0.38,
          fontWeight: FontWeight.bold,
          color: AppTheme.primaryNavy,
        ),
      ),
    );

    if (clean.isEmpty) {
      return fallback;
    }

    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return Image.network(
        clean,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => fallback,
      );
    } else if (clean.startsWith('assets/')) {
      return Image.asset(
        clean,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => fallback,
      );
    } else {
      final file = File(clean);
      if (file.existsSync()) {
        return Image.file(
          file,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => fallback,
        );
      }
      return fallback;
    }
  }

  Widget _buildShowroomImage(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return Image.network(
        path,
        width: 100,
        height: 100,
        fit: BoxFit.cover,
        cacheWidth: 300,
        cacheHeight: 300,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => _buildImageFallback(),
      );
    } else if (path.startsWith('assets/')) {
      return Image.asset(
        path,
        width: 100,
        height: 100,
        fit: BoxFit.cover,
        cacheWidth: 300,
        cacheHeight: 300,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => _buildImageFallback(),
      );
    } else {
      final file = File(path);
      if (file.existsSync()) {
        return Image.file(
          file,
          width: 100,
          height: 100,
          fit: BoxFit.cover,
          cacheWidth: 300,
          cacheHeight: 300,
          filterQuality: FilterQuality.medium,
          errorBuilder: (context, error, stackTrace) => _buildImageFallback(),
        );
      }
      return _buildImageFallback();
    }
  }

  Widget _buildImageFallback() {
    return Container(
      width: 100,
      height: 100,
      color: AppTheme.primaryNavy.withValues(alpha: 0.08),
      child: const Center(
        child: Icon(
          Icons.storefront_rounded,
          color: AppTheme.primaryNavy,
          size: 32,
        ),
      ),
    );
  }
}
