import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../services/firestore_service.dart';
import '../services/user_session_service.dart';
import '../services/pricing_service.dart';
import '../models/user_profile.dart';
import '../widgets/profile_tier_card.dart';
import 'auth_screen.dart';
import 'orders_screen.dart';
import 'favorites_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  void _openEditProfileModal(BuildContext context, UserProfile profile) {
    final nameController = TextEditingController(text: profile.name);
    final emailController = TextEditingController(text: profile.email);
    final phoneController = TextEditingController(text: profile.phone);
    final companyController = TextEditingController(text: profile.companyName);
    final cityController = TextEditingController(text: profile.city);
    final stateController = TextEditingController(text: profile.state);
    final pincodeController = TextEditingController(text: profile.pincode);
    final gstController = TextEditingController(text: profile.gstNumber);
    final addressLineController = TextEditingController(
      text: (profile.address['line1'] ?? profile.address['addressLine'] ?? '') as String,
    );

    String selectedCategory = profile.userCategory.isNotEmpty ? profile.userCategory : 'Dealer';
    final categories = ['Dealer', 'Architect', 'Builder', 'Contractor', 'Wholesaler', 'Retailer'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
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
                          onPressed: () => Navigator.pop(modalCtx),
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
                          _buildTextField('Full Name', nameController, Icons.person_outlined),
                          const SizedBox(height: 14),
                          _buildTextField('Mobile Number', phoneController, Icons.phone_outlined, keyboardType: TextInputType.phone),
                          const SizedBox(height: 14),
                          _buildTextField('Email Address', emailController, Icons.email_outlined, keyboardType: TextInputType.emailAddress),
                          const SizedBox(height: 14),
                          _buildTextField('Company / Business Name', companyController, Icons.business_outlined),
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
                                value: categories.contains(selectedCategory) ? selectedCategory : 'Dealer',
                                isExpanded: true,
                                items: categories.map((cat) {
                                  return DropdownMenuItem(
                                    value: cat,
                                    child: Text(cat, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) {
                                    setModalState(() => selectedCategory = val);
                                  }
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),

                          _buildTextField('Delivery Address (Line 1)', addressLineController, Icons.home_outlined),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(child: _buildTextField('City', cityController, Icons.location_city_outlined)),
                              const SizedBox(width: 10),
                              Expanded(child: _buildTextField('State', stateController, Icons.map_outlined)),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(child: _buildTextField('Pincode', pincodeController, Icons.pin_drop_outlined, keyboardType: TextInputType.number)),
                              const SizedBox(width: 10),
                              Expanded(child: _buildTextField('GSTIN Number', gstController, Icons.receipt_long_outlined)),
                            ],
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),

                  // Bottom Save Action
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 10,
                          offset: const Offset(0, -4),
                        ),
                      ],
                    ),
                    child: SafeArea(
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryNavy,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          onPressed: () async {
                            final newName = nameController.text.trim();
                            final newEmail = emailController.text.trim();
                            final newPhone = phoneController.text.trim();
                            final newCompany = companyController.text.trim();
                            final newCity = cityController.text.trim();
                            final newState = stateController.text.trim();
                            final newPincode = pincodeController.text.trim();
                            final newGst = gstController.text.trim();
                            final newAddrLine = addressLineController.text.trim();

                            final updatedAddr = {
                              'line1': newAddrLine,
                              'city': newCity,
                              'state': newState,
                              'pincode': newPincode,
                            };

                            // Update live AppStateService
                            AppStateService.instance.updateUserProfileFields(
                              name: newName.isNotEmpty ? newName : null,
                              email: newEmail,
                              phone: newPhone.isNotEmpty ? newPhone : null,
                              companyName: newCompany,
                              userCategory: selectedCategory,
                              city: newCity,
                              state: newState,
                              pincode: newPincode,
                              gstNumber: newGst,
                              address: updatedAddr,
                            );

                            // Update Firestore in background
                            try {
                              await FirestoreService().createUserProfile(
                                uid: profile.userId,
                                phoneNumber: newPhone.isNotEmpty ? newPhone : profile.phone,
                                fullName: newName.isNotEmpty ? newName : profile.name,
                                role: selectedCategory,
                                email: newEmail,
                                companyName: newCompany,
                                city: newCity,
                                state: newState,
                                pincode: newPincode,
                                address: updatedAddr,
                                isVerified: true,
                              );
                            } catch (_) {}

                            Navigator.pop(modalCtx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Profile details updated successfully!'),
                                backgroundColor: AppTheme.primaryNavy,
                              ),
                            );
                          },
                          child: const Text('Save Profile Changes'),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
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
                  padding: const EdgeInsets.fromLTRB(20, 60, 20, 26),
                  decoration: const BoxDecoration(
                    color: AppTheme.primaryNavy,
                    borderRadius: BorderRadius.vertical(
                      bottom: Radius.circular(28),
                    ),
                  ),
                  child: Column(
                    children: [
                      Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          CircleAvatar(
                            radius: 44,
                            backgroundColor: Colors.white,
                            child: CircleAvatar(
                              radius: 41,
                              backgroundColor: AppTheme.accentOrange,
                              child: Text(
                                profile.initials,
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                          GestureDetector(
                            onTap: () => _openEditProfileModal(context, profile),
                            child: const CircleAvatar(
                              radius: 14,
                              backgroundColor: Colors.white,
                              child: Icon(
                                Icons.edit_rounded,
                                size: 14,
                                color: AppTheme.primaryNavy,
                              ),
                            ),
                          ),
                        ],
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
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.edit_outlined, size: 16),
                              label: const Text('Complete Pending Details'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                side: const BorderSide(color: AppTheme.accentOrange),
                                foregroundColor: AppTheme.accentOrange,
                              ),
                              onPressed: () => _openEditProfileModal(context, profile),
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
                          _openEditProfileModal(context, profile);
                        }),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.location_on_outlined, 'Delivery Addresses', () {
                          _openEditProfileModal(context, profile);
                        }),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.sell_outlined, 'My Contract Rates', () {
                          _openContractRatesBottomSheet(context, profile);
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
                        _buildTile(Icons.notifications_none_rounded, 'Notifications', () {}),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.headset_mic_outlined, 'Help & Support', () {}),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(Icons.info_outline_rounded, 'About Us', () {}),
                        const Divider(height: 1, color: AppTheme.borderSubtle),
                        _buildTile(
                          Icons.logout_rounded,
                          'Log Out',
                          () async {
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
                          },
                          isDestructive: true,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 30),
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
    return ListTile(
      leading: Icon(
        icon,
        color: isDestructive ? Colors.red : AppTheme.primaryNavy,
      ),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: isDestructive ? Colors.red : AppTheme.textDark,
        ),
      ),
      trailing: isDestructive
          ? null
          : const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: AppTheme.textSubtle,
            ),
      onTap: onTap,
    );
  }

  void _openContractRatesBottomSheet(BuildContext context, UserProfile profile) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.70,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.sell_outlined, color: AppTheme.primaryNavy),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'My Contract Rates',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryNavy,
                          ),
                        ),
                        Text(
                          'Approved Partner Rates for ${profile.companyName.isNotEmpty ? profile.companyName : profile.name}',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: AppTheme.borderSubtle),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  children: [
                    _buildContractRateCard(
                      sku: 'ITA-STAT-6012',
                      productName: 'Statuario Marble Vitrified',
                      standardRate: 120.0,
                      approvedRate: 98.0,
                      size: '600x1200 mm',
                      category: 'Floor Tiles',
                    ),
                    const SizedBox(height: 12),
                    _buildContractRateCard(
                      sku: 'ITA-ROYA-6012',
                      productName: 'Royal Beige Carving Tile',
                      standardRate: 135.0,
                      approvedRate: 115.0,
                      size: '600x1200 mm',
                      category: 'Floor Tiles',
                    ),
                    const SizedBox(height: 12),
                    _buildContractRateCard(
                      sku: 'ITA-NERO-6060',
                      productName: 'Nero Marquina Square Tile',
                      standardRate: 95.0,
                      approvedRate: 82.0,
                      size: '600x600 mm',
                      category: 'Floor Tiles',
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildContractRateCard({
    required String sku,
    required String productName,
    required double standardRate,
    required double approvedRate,
    required String size,
    required String category,
  }) {
    final savingsPct = (((standardRate - approvedRate) / standardRate) * 100).toStringAsFixed(0);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderSubtle),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppTheme.primaryNavy.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.grid_on_rounded, color: AppTheme.primaryNavy),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  productName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                Text(
                  'SKU: $sku • $size',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      '₹${standardRate.toStringAsFixed(0)}/sq.ft',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.grey,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '₹${approvedRate.toStringAsFixed(0)}/sq.ft',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.accentOrange,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.statusSuccess.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppTheme.statusSuccess.withValues(alpha: 0.3)),
            ),
            child: Text(
              '$savingsPct% SAVINGS',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: AppTheme.statusSuccess,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
