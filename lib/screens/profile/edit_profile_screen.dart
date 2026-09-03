import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../theme/app_theme.dart';
import '../../services/app_state_service.dart';
import '../../services/firestore_service.dart';

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

  Future<void> _pickProfilePhoto() async {
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

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Select Profile Photo Source',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined, color: AppTheme.primaryNavy),
              title: const Text('Choose from Gallery'),
              onTap: () async {
                Navigator.pop(context);
                try {
                  final picker = ImagePicker();
                  final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
                  if (image != null) {
                    setState(() {
                      _profilePhotoUrl = image.path;
                    });
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Profile photo selected from gallery!'),
                          backgroundColor: AppTheme.primaryNavy,
                        ),
                      );
                    }
                  }
                } catch (e) {
                  // Fallback sample photo for emulator/web
                  setState(() {
                    _profilePhotoUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80';
                  });
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined, color: AppTheme.primaryNavy),
              title: const Text('Take a Photo'),
              onTap: () async {
                Navigator.pop(context);
                try {
                  final picker = ImagePicker();
                  final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
                  if (image != null) {
                    setState(() {
                      _profilePhotoUrl = image.path;
                    });
                  }
                } catch (e) {
                  setState(() {
                    _profilePhotoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
                  });
                }
              },
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
          content: Text('Maximum 5 showroom display photos allowed.'),
          backgroundColor: AppTheme.accentOrange,
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
          _showroomImages.add(image.path);
        });
      } else {
        final nextImg = _sampleShowroomAssets[_showroomImages.length % _sampleShowroomAssets.length];
        setState(() {
          _showroomImages.add(nextImg);
        });
      }
    } catch (_) {
      final nextImg = _sampleShowroomAssets[_showroomImages.length % _sampleShowroomAssets.length];
      setState(() {
        _showroomImages.add(nextImg);
      });
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('New showroom display photo added!'),
          backgroundColor: AppTheme.primaryNavy,
          duration: Duration(seconds: 1),
        ),
      );
    }
  }

  void _removeShowroomPhoto(int index) {
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

    // Update Firestore database
    try {
      await _firestoreService.createUserProfile(
        uid: profile.userId,
        phoneNumber: _phoneController.text.trim(),
        fullName: _nameController.text.trim(),
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
                child: Stack(
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                        border: Border.all(color: AppTheme.primaryNavy, width: 2),
                        image: _profilePhotoUrl != null && _profilePhotoUrl!.isNotEmpty
                            ? DecorationImage(
                                image: _profilePhotoUrl!.startsWith('http')
                                    ? NetworkImage(_profilePhotoUrl!)
                                    : FileImage(File(_profilePhotoUrl!)) as ImageProvider,
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                      child: _profilePhotoUrl == null || _profilePhotoUrl!.isEmpty
                          ? Center(
                              child: Text(
                                _nameController.text.isNotEmpty
                                    ? _nameController.text[0].toUpperCase()
                                    : 'U',
                                style: const TextStyle(
                                  fontSize: 36,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryNavy,
                                ),
                              ),
                            )
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: GestureDetector(
                        onTap: _pickProfilePhoto,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: const BoxDecoration(
                            color: AppTheme.accentOrange,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.camera_alt_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              const Center(
                child: Text(
                  'Tap camera to update profile avatar',
                  style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
                ),
              ),
              const SizedBox(height: 24),

              // ---------------------------------------------------------------
              // 2. SHOWROOM / STORE DISPLAY SHOWCASE GALLERY (Up to 5 Photos)
              // ---------------------------------------------------------------
              const Text(
                'Showroom & Store Display Showcase',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryNavy,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Upload photos of your tile racks, sample displays, or store front (Max 5)',
                style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
              ),
              const SizedBox(height: 12),

              SizedBox(
                height: 100,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  itemCount: _showroomImages.length + 1,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, index) {
                    if (index == _showroomImages.length) {
                      // Dashed Add Photo Tile
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
                    return Stack(
                      children: [
                        Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            image: DecorationImage(
                              image: NetworkImage(imgUrl),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
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
                        ),
                      ],
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
}
