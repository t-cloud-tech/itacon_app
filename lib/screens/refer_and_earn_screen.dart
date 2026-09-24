import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/referral_model.dart';
import '../models/user_profile.dart';
import '../services/app_state_service.dart';
import '../services/loyalty_service.dart';
import '../theme/app_theme.dart';

class ReferAndEarnScreen extends StatefulWidget {
  final UserProfile? user;

  const ReferAndEarnScreen({super.key, this.user});

  @override
  State<ReferAndEarnScreen> createState() => _ReferAndEarnScreenState();
}

class _ReferAndEarnScreenState extends State<ReferAndEarnScreen> {
  final LoyaltyService _loyaltyService = LoyaltyService.instance;

  UserProfile get _currentUser =>
      widget.user ?? AppStateService.instance.currentUserProfile;

  String get _referralCode {
    final code = _currentUser.referralCode;
    if (code != null && code.trim().isNotEmpty) {
      return code.trim();
    }
    return 'ITA-782910';
  }

  void _copyReferralCode() {
    Clipboard.setData(ClipboardData(text: _referralCode));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text('Referral Code $_referralCode copied to clipboard!'),
          ],
        ),
        backgroundColor: AppTheme.primaryNavy,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _shareViaWhatsApp() {
    final message =
        'Join ITACON Granito with my exclusive trade referral code: $_referralCode '
        'to unlock direct factory rates, contract pricing, and 500 bonus loyalty points!';
    Clipboard.setData(ClipboardData(text: message));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Row(
          children: [
            Icon(Icons.share_rounded, color: Colors.white, size: 18),
            SizedBox(width: 8),
            Text('Invite message copied! Paste and share with your partners.'),
          ],
        ),
        backgroundColor: const Color(0xFF25D366),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _currentUser;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Text(
          'Refer & Earn',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: AppTheme.primaryNavy,
            fontSize: 19,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
          onPressed: () => Navigator.pop(context),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppTheme.borderSubtle, height: 1),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Hero Banner Card
            _buildHeroBanner(),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Referral Code Showcase Card
                  _buildReferralCodeCard(),

                  const SizedBox(height: 20),

                  // 2-Step Program Explanation
                  _buildTwoStepWorkflow(),

                  const SizedBox(height: 24),

                  // My Referrals Section
                  _buildMyReferralsHeader(),

                  const SizedBox(height: 12),

                  _buildMyReferralsStream(user.userId),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomShareBar(),
    );
  }

  Widget _buildHeroBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.primaryNavy, Color(0xFF1E3A8A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.accentOrange,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'ITACON TRADE NETWORK',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                letterSpacing: 1.1,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'REFER. GROW. EARN.',
            style: GoogleFonts.outfit(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Invite architects, builders, contractors & fellow dealers. Earn 500 bonus points on registration and ₹5,555 reward on their first qualifying order.',
            style: GoogleFonts.inter(
              fontSize: 13,
              color: Colors.white.withValues(alpha: 0.85),
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReferralCodeCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: AppTheme.luxuryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.qr_code_rounded, color: AppTheme.accentOrange, size: 20),
              SizedBox(width: 8),
              Text(
                'YOUR UNIQUE REFERRAL CODE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.0,
                  color: AppTheme.textSubtle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppTheme.backgroundColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.accentOrange.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                SelectableText(
                  _referralCode,
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.copy_rounded, size: 14),
                  label: const Text(
                    'COPY CODE',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  onPressed: _copyReferralCode,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTwoStepWorkflow() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'How ITACON Rewards Work',
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.primaryNavy,
          ),
        ),
        const SizedBox(height: 12),

        // STEP 1
        _buildRewardStepCard(
          stepNumber: '1',
          stepTag: 'STEP 1',
          title: 'REFER & SIGN UP',
          description:
              'Share your ITACON referral code with a new trade customer.',
          rewardText: '+500 Points',
          rewardSubtext: 'Credited to both accounts',
          icon: Icons.person_add_alt_1_rounded,
          accentColor: const Color(0xFF1E88E5),
        ),

        const SizedBox(height: 12),

        // STEP 2
        _buildRewardStepCard(
          stepNumber: '2',
          stepTag: 'STEP 2',
          title: 'SUCCESSFUL ORDER',
          description:
              'When your referred partner completes their first qualifying confirmed order:',
          rewardText: '₹5,555 Reward',
          rewardSubtext: 'Direct monetary referral reward',
          icon: Icons.verified_rounded,
          accentColor: AppTheme.accentOrange,
        ),
      ],
    );
  }

  Widget _buildRewardStepCard({
    required String stepNumber,
    required String stepTag,
    required String title,
    required String description,
    required String rewardText,
    required String rewardSubtext,
    required IconData icon,
    required Color accentColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.luxuryCardDecoration,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: accentColor, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        stepTag,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: accentColor,
                        ),
                      ),
                    ),
                    Text(
                      rewardText,
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: accentColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppTheme.textSubtle,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '• $rewardSubtext',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: accentColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMyReferralsHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            const Icon(Icons.people_alt_rounded,
                color: AppTheme.primaryNavy, size: 20),
            const SizedBox(width: 8),
            Text(
              'My Referrals',
              style: GoogleFonts.outfit(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppTheme.primaryNavy,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMyReferralsStream(String userId) {
    return StreamBuilder<List<ReferralModel>>(
      stream: _loyaltyService.streamUserReferrals(userId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: CircularProgressIndicator(),
            ),
          );
        }

        final referrals = snapshot.data ?? [];

        if (referrals.isEmpty) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
            decoration: AppTheme.luxuryCardDecoration,
            child: Column(
              children: [
                Icon(
                  Icons.person_outline_rounded,
                  size: 48,
                  color: Colors.grey.shade400,
                ),
                const SizedBox(height: 12),
                Text(
                  'No Referrals Yet',
                  style: GoogleFonts.outfit(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Share your referral code with your trade partners to start earning loyalty points and cash rewards.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppTheme.textSubtle,
                  ),
                ),
              ],
            ),
          );
        }

        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: referrals.length,
          separatorBuilder: (context, index) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final ref = referrals[index];
            return _buildReferralItemTile(ref);
          },
        );
      },
    );
  }

  Widget _buildReferralItemTile(ReferralModel ref) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: AppTheme.luxuryCardDecoration,
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: ref.statusColor.withValues(alpha: 0.15),
            child: Text(
              ref.maskedName.isNotEmpty ? ref.maskedName[0].toUpperCase() : 'P',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: ref.statusColor,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ref.maskedName,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  ref.maskedPhone,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textSubtle,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: ref.statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: ref.statusColor.withValues(alpha: 0.3)),
            ),
            child: Text(
              ref.statusDisplay,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: ref.statusColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomShareBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: AppTheme.borderSubtle),
        ),
      ),
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF25D366),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            icon: const Icon(Icons.share_rounded, size: 18),
            label: Text(
              'SHARE REFERRAL CODE',
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
            onPressed: _shareViaWhatsApp,
          ),
        ),
      ),
    );
  }
}
