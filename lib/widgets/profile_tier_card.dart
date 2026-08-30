import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/user_profile.dart';
import '../services/pricing_service.dart';

/// Trade Tier Status Card for Profile Screen showing user's active trade tier,
/// privileges, and assigned salesperson contact with 1-tap Call and WhatsApp actions.
class ProfileTierCard extends StatelessWidget {
  final UserProfile user;
  final VoidCallback? onViewContractRates;

  const ProfileTierCard({
    super.key,
    required this.user,
    this.onViewContractRates,
  });

  @override
  Widget build(BuildContext context) {
    final category = user.userCategory;
    final discountRatio = PricingService.tierDiscountMap[category] ?? 0.0;
    final discountPct = (discountRatio * 100).toStringAsFixed(0);

    // Salesperson info lookup or default fallback
    final salespersonName = user.salesPersonId != null && user.salesPersonId!.isNotEmpty
        ? 'Rajesh Varma'
        : 'Ramesh Patel (Salesperson)';
    final salespersonPhone = '+919825012345';
    final salespersonWhatsapp = '919825012345';

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primaryNavy, Color(0xFF163462)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primaryNavy.withValues(alpha: 0.25),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Background subtle watermark pattern
          Positioned(
            right: -20,
            bottom: -20,
            child: Icon(
              Icons.verified_user_rounded,
              size: 130,
              color: Colors.white.withValues(alpha: 0.04),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Tier Badge Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppTheme.accentOrange.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: AppTheme.accentOrange.withValues(alpha: 0.5)),
                          ),
                          child: const Icon(
                            Icons.stars_rounded,
                            color: AppTheme.accentOrange,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'TRADE PARTNER TIER',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Colors.white60,
                                letterSpacing: 1.1,
                              ),
                            ),
                            Text(
                              category.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // Discount Pill
                    if (discountRatio > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.accentOrange,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.accentOrange.withValues(alpha: 0.4),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Text(
                          '$discountPct% OFF RATE',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 14),
                const Divider(color: Colors.white12, height: 1),
                const SizedBox(height: 14),

                // 2. Privilege Description
                Row(
                  children: [
                    const Icon(Icons.check_circle_outline_rounded,
                        size: 16, color: AppTheme.accentOrange),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        discountRatio > 0
                            ? 'Privilege: Enjoy $discountPct% partner discount on all standard tile collections.'
                            : 'Standard Partner Rates applied. Contact salesperson for volume discount.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.87),
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // 3. Assigned Salesperson Contact Card
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.person_rounded,
                            color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Assigned Salesperson',
                              style: TextStyle(
                                fontSize: 10,
                                color: Colors.white60,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Text(
                              salespersonName,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // One-Tap Call Button
                      IconButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Calling Salesperson: $salespersonPhone'),
                              backgroundColor: AppTheme.primaryNavy,
                            ),
                          );
                        },
                        icon: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.green.shade600,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.phone,
                              size: 16, color: Colors.white),
                        ),
                        tooltip: 'Call Salesperson',
                      ),

                      // One-Tap WhatsApp Button
                      IconButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Opening WhatsApp with $salespersonName ($salespersonWhatsapp)'),
                              backgroundColor: const Color(0xFF25D366),
                            ),
                          );
                        },
                        icon: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: Color(0xFF25D366),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.chat_bubble,
                              size: 16, color: Colors.white),
                        ),
                        tooltip: 'WhatsApp Salesperson',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
