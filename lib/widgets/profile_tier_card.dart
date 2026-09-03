import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_theme.dart';
import '../models/user_profile.dart';
import '../services/pricing_service.dart';

/// Single Unified Trade Partner & Assigned Sales Person Card.
/// Combines trade tier status, partner discount privileges, and executive credentials into one card.
class ProfileTierCard extends StatelessWidget {
  final UserProfile user;
  final VoidCallback? onViewContractRates;

  const ProfileTierCard({
    super.key,
    required this.user,
    this.onViewContractRates,
  });

  // Default executive fallback credentials
  static const String _defaultSalespersonName = 'Rajesh Sharma';
  static const String _defaultRole = 'Senior Sales Executive';
  static const String _defaultPhone = '+91 93744 90901';
  static const String _defaultEmpId = 'EMP-ITACON-408';

  Future<void> _makeCall(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('tel:$cleanPhone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _openWhatsApp(String phone, String name) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^\d]'), '');
    final message = Uri.encodeComponent(
      'Hello $name, I am reaching out regarding ITACON Granito orders, pricing & catalog inquiry.',
    );
    final uri = Uri.parse('https://wa.me/$cleanPhone?text=$message');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final category = user.userCategory.isNotEmpty ? user.userCategory : 'Dealer';
    final discountRatio = PricingService.tierDiscountMap[category] ?? 0.0;
    final discountPct = (discountRatio * 100).toStringAsFixed(0);

    const salespersonName = _defaultSalespersonName;
    const salespersonPhone = _defaultPhone;
    const salespersonRole = _defaultRole;
    const salespersonEmpId = _defaultEmpId;

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
          // Background watermark pattern
          Positioned(
            right: -20,
            bottom: -20,
            child: Icon(
              Icons.verified_user_rounded,
              size: 140,
              color: Colors.white.withValues(alpha: 0.04),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Trade Partner Tier Badge Header
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
                              color: AppTheme.accentOrange.withValues(alpha: 0.5),
                            ),
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
                          horizontal: 10,
                          vertical: 4,
                        ),
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

                // 2. Privilege Description & Contact Salesperson Note
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.check_circle_outline_rounded,
                      size: 16,
                      color: AppTheme.accentOrange,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        discountRatio > 0
                            ? 'Privilege: Enjoy $discountPct% partner discount on all standard tile collections. For additional volume discount, contact assigned sales person.'
                            : 'Standard Partner Rates applied. For custom volume discounts & contract pricing, please contact your assigned sales person.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.9),
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // 3. Integrated Assigned Sales Person Box
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
                  ),
                  child: Column(
                    children: [
                      // Sub-header with Employee ID
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'ASSIGNED SALES PERSON',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.white60,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppTheme.accentOrange.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: AppTheme.accentOrange.withValues(alpha: 0.5),
                              ),
                            ),
                            child: const Text(
                              salespersonEmpId,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      Row(
                        children: [
                          // Avatar Circle
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: const Center(
                              child: Text(
                                'R',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),

                          // Sales Executive Info
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  salespersonName,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  salespersonRole,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.white70,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  salespersonPhone,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Action Buttons: One-Tap Call & WhatsApp
                          Column(
                            children: [
                              IconButton(
                                onPressed: () => _makeCall(salespersonPhone),
                                icon: Container(
                                  padding: const EdgeInsets.all(7),
                                  decoration: BoxDecoration(
                                    color: Colors.green.shade600,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.phone, size: 16, color: Colors.white),
                                ),
                                tooltip: 'Call Salesperson',
                              ),
                              IconButton(
                                onPressed: () => _openWhatsApp(salespersonPhone, salespersonName),
                                icon: Container(
                                  padding: const EdgeInsets.all(7),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF25D366),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.chat_bubble, size: 16, color: Colors.white),
                                ),
                                tooltip: 'WhatsApp Salesperson',
                              ),
                            ],
                          ),
                        ],
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
