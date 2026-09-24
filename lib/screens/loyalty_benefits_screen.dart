import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/loyalty_config.dart';
import '../models/loyalty_transaction.dart';
import '../models/user_profile.dart';
import '../services/app_state_service.dart';
import '../services/loyalty_service.dart';
import '../theme/app_theme.dart';

class LoyaltyBenefitsScreen extends StatefulWidget {
  final UserProfile? user;

  const LoyaltyBenefitsScreen({super.key, this.user});

  @override
  State<LoyaltyBenefitsScreen> createState() => _LoyaltyBenefitsScreenState();
}

class _LoyaltyBenefitsScreenState extends State<LoyaltyBenefitsScreen> {
  final LoyaltyService _loyaltyService = LoyaltyService.instance;
  bool _isSubmittingRedemption = false;

  UserProfile get _currentUser =>
      widget.user ?? AppStateService.instance.currentUserProfile;

  void _showRedemptionDialog(int availablePoints, LoyaltyConfig config) {
    if (availablePoints < config.minimumRedemptionPoints) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Minimum ${config.minimumRedemptionPoints.toLocaleString()} points required to submit a redemption request.',
          ),
          backgroundColor: AppTheme.accentOrange,
        ),
      );
      return;
    }

    final upiController = TextEditingController();
    final bankController = TextEditingController();
    int redeemAmountPoints = config.minimumRedemptionPoints;
    double rupeeVal = redeemAmountPoints * config.rupeesPerPoint;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bottomCtx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
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
              Text(
                'Request Points Redemption',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryNavy,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Convert your eligible loyalty points directly into bank payout or trade invoice credit.',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppTheme.textSubtle,
                ),
              ),
              const SizedBox(height: 16),

              // Summary Box
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundColor,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Redemption Points',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.textSubtle,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '${redeemAmountPoints.toLocaleString()} Pts',
                          style: GoogleFonts.outfit(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryNavy,
                          ),
                        ),
                      ],
                    ),
                    const Icon(Icons.arrow_forward_rounded,
                        color: AppTheme.accentOrange, size: 20),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text(
                          'Cash Payout Value',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.textSubtle,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '₹${rupeeVal.toStringAsFixed(0)}',
                          style: GoogleFonts.outfit(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF2E7D32),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              TextField(
                controller: upiController,
                decoration: const InputDecoration(
                  labelText: 'UPI ID (e.g. mobile@upi)',
                  hintText: 'Enter UPI ID for instant transfer',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.payment_rounded),
                ),
              ),
              const SizedBox(height: 12),

              TextField(
                controller: bankController,
                decoration: const InputDecoration(
                  labelText: 'Bank Account & IFSC (Optional)',
                  hintText: 'A/c No, IFSC, Beneficiary Name',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.account_balance_rounded),
                ),
              ),
              const SizedBox(height: 20),

              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: _isSubmittingRedemption
                      ? null
                      : () async {
                          final upi = upiController.text.trim();
                          final bank = bankController.text.trim();
                          if (upi.isEmpty && bank.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Please enter either a UPI ID or Bank Account Details.'),
                                backgroundColor: AppTheme.accentOrange,
                              ),
                            );
                            return;
                          }

                          Navigator.pop(bottomCtx);
                          setState(() => _isSubmittingRedemption = true);

                          try {
                            await _loyaltyService.submitRedemptionRequest(
                              userId: _currentUser.userId,
                              requestedPoints: redeemAmountPoints,
                              rupeesAmount: rupeeVal,
                              upiId: upi.isNotEmpty ? upi : null,
                              bankDetails: bank.isNotEmpty ? bank : null,
                            );

                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Redemption request submitted successfully! Pending verification.',
                                  ),
                                  backgroundColor: Color(0xFF2E7D32),
                                ),
                              );
                            }
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Submission failed: $e'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          } finally {
                            if (mounted) {
                              setState(() => _isSubmittingRedemption = false);
                            }
                          }
                        },
                  child: _isSubmittingRedemption
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          'CONFIRM REDEMPTION REQUEST',
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
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

  @override
  Widget build(BuildContext context) {
    final user = _currentUser;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Text(
          'Loyalty Benefits',
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
      body: StreamBuilder<LoyaltyConfig>(
        stream: _loyaltyService.streamLoyaltyConfig(),
        initialData: LoyaltyConfig.defaults,
        builder: (context, configSnap) {
          final config = configSnap.data ?? LoyaltyConfig.defaults;

          return StreamBuilder<int>(
            stream: _loyaltyService.streamUserLoyaltyPoints(user.userId),
            initialData: user.loyaltyPoints,
            builder: (context, pointsSnap) {
              final points = pointsSnap.data ?? user.loyaltyPoints;
              final approxRupeeValue = config.calculateRupeeValue(points);
              final progressPct = (points / config.minimumRedemptionPoints).clamp(0.0, 1.0);
              final canRedeem = points >= config.minimumRedemptionPoints;

              return SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Points Balance Hero Card
                    _buildBalanceHero(points, approxRupeeValue, progressPct, config),

                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Redemption Request CTA Button
                          _buildRedeemCTA(canRedeem, points, config),

                          const SizedBox(height: 20),

                          // Program Highlights (10 pts/box, 500 welcome, 50k min)
                          _buildProgramRulesGrid(config),

                          const SizedBox(height: 24),

                          // Transaction History Ledger
                          _buildTransactionLedgerHeader(),

                          const SizedBox(height: 12),

                          _buildTransactionsStream(user.userId),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildBalanceHero(
    int points,
    double approxRupeeValue,
    double progressPct,
    LoyaltyConfig config,
  ) {
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.accentOrange,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'ACTIVE TRADE WALLET',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 1.1,
                  ),
                ),
              ),
              Text(
                '1 Pt = ₹${config.rupeesPerPoint.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 11,
                  color: Colors.white70,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          Text(
            'Available Points',
            style: GoogleFonts.inter(
              fontSize: 13,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                points.toLocaleString(),
                style: GoogleFonts.outfit(
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'POINTS',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.accentOrange,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Approx. Value: ₹${approxRupeeValue.toStringAsFixed(2)}',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF81C784),
            ),
          ),

          const SizedBox(height: 20),

          // Progress Bar toward 50,000 pts
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Progress toward Min. Redemption',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: Colors.white70,
                ),
              ),
              Text(
                '${points.toLocaleString()} / ${config.minimumRedemptionPoints.toLocaleString()} pts',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: progressPct,
              minHeight: 8,
              backgroundColor: Colors.white24,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.accentOrange),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRedeemCTA(bool canRedeem, int points, LoyaltyConfig config) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: canRedeem ? AppTheme.accentOrange : Colors.grey.shade300,
          foregroundColor: canRedeem ? Colors.white : Colors.grey.shade600,
          elevation: canRedeem ? 2 : 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        icon: const Icon(Icons.redeem_rounded, size: 20),
        label: Text(
          canRedeem
              ? 'REQUEST REDEMPTION (₹${(points * config.rupeesPerPoint).toStringAsFixed(0)})'
              : 'REDEEM AT ${config.minimumRedemptionPoints.toLocaleString()} PTS (₹${(config.minimumRedemptionPoints * config.rupeesPerPoint).toStringAsFixed(0)})',
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
        onPressed: canRedeem
            ? () => _showRedemptionDialog(points, config)
            : null,
      ),
    );
  }

  Widget _buildProgramRulesGrid(LoyaltyConfig config) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'ITACON Loyalty Privileges',
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.primaryNavy,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildRuleTile(
                icon: Icons.inventory_2_rounded,
                title: '${config.pointsPerBox} POINTS',
                subtitle: 'PER BOX',
                note: 'On eligible confirmed dispatches',
                color: const Color(0xFF1E88E5),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRuleTile(
                icon: Icons.card_giftcard_rounded,
                title: '+${config.signupBonusPoints} PTS',
                subtitle: 'WELCOME BONUS',
                note: 'Credited once on verification',
                color: const Color(0xFF8E24AA),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _buildRuleTile(
          icon: Icons.payments_rounded,
          title: '${config.minimumRedemptionPoints.toLocaleString()} POINTS',
          subtitle: 'MINIMUM REDEMPTION THRESHOLD',
          note: '= ₹${(config.minimumRedemptionPoints * config.rupeesPerPoint).toStringAsFixed(0)} value directly on invoice or bank transfer',
          color: const Color(0xFF2E7D32),
          isFullWidth: true,
        ),
      ],
    );
  }

  Widget _buildRuleTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required String note,
    required Color color,
    bool isFullWidth = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: AppTheme.luxuryCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: color,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            note,
            style: GoogleFonts.inter(
              fontSize: 11,
              color: AppTheme.textSubtle,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionLedgerHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            const Icon(Icons.history_rounded,
                color: AppTheme.primaryNavy, size: 20),
            const SizedBox(width: 8),
            Text(
              'Points Transaction History',
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

  Widget _buildTransactionsStream(String userId) {
    return StreamBuilder<List<LoyaltyTransaction>>(
      stream: _loyaltyService.streamUserTransactions(userId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: CircularProgressIndicator(),
            ),
          );
        }

        final txs = snapshot.data ?? [];

        if (txs.isEmpty) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
            decoration: AppTheme.luxuryCardDecoration,
            child: Column(
              children: [
                Icon(
                  Icons.receipt_long_rounded,
                  size: 48,
                  color: Colors.grey.shade400,
                ),
                const SizedBox(height: 12),
                Text(
                  'No Transactions Yet',
                  style: GoogleFonts.outfit(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Points will be credited automatically when you complete orders or invite trade partners.',
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
          itemCount: txs.length,
          separatorBuilder: (context, index) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final tx = txs[index];
            return _buildTransactionItem(tx);
          },
        );
      },
    );
  }

  Widget _buildTransactionItem(LoyaltyTransaction tx) {
    final dateStr = tx.createdAt != null
        ? '${tx.createdAt!.day}/${tx.createdAt!.month}/${tx.createdAt!.year}'
        : 'Recent';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: AppTheme.luxuryCardDecoration,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: tx.pointsColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(tx.iconDisplay, color: tx.pointsColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.titleDisplay,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  tx.remarks.isNotEmpty ? tx.remarks : 'System Transaction',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textSubtle,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  dateStr,
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
          Text(
            tx.pointsFormatted,
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: tx.pointsColor,
            ),
          ),
        ],
      ),
    );
  }
}
