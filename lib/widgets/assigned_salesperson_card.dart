import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../models/sales_person.dart';
import 'interactive_pressable.dart';

/// Dedicated 'Assigned Sales Person' Card displaying executive credentials
/// with direct one-tap Call and WhatsApp actions, with realistic mock fallback data.
class AssignedSalespersonCard extends StatelessWidget {
  final SalesPerson? salesPerson;

  const AssignedSalespersonCard({
    super.key,
    this.salesPerson,
  });

  // Realistic mock fallback executive data per project specification
  static const String _defaultName = 'Rajesh Sharma';
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
      'Hello $name, I am reaching out regarding ITACON Granito orders & catalog inquiry.',
    );
    final uri = Uri.parse('https://wa.me/$cleanPhone?text=$message');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = (salesPerson != null && salesPerson!.name.isNotEmpty)
        ? salesPerson!.name
        : _defaultName;
    final phone = (salesPerson != null && salesPerson!.phone.isNotEmpty)
        ? salesPerson!.phone
        : _defaultPhone;
    final empId = (salesPerson != null && salesPerson!.salesPersonId.isNotEmpty)
        ? salesPerson!.salesPersonId
        : _defaultEmpId;
    final roleStr = (salesPerson != null && salesPerson!.role.isNotEmpty)
        ? salesPerson!.role
        : _defaultRole;

    return Container(
      decoration: AppTheme.luxuryCardDecoration,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Title & Typography Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.badge_outlined,
                      color: AppTheme.primaryNavy, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Assigned Sales Person',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryNavy,
                      letterSpacing: -0.1,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.accentOrange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  empId,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.accentOrange,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppTheme.borderSubtle),
          const SizedBox(height: 12),

          // Layout Body
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Avatar Circle
              CircleAvatar(
                radius: 26,
                backgroundColor: AppTheme.primaryNavy.withValues(alpha: 0.08),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : 'R',
                  style: GoogleFonts.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryNavy,
                  ),
                ),
              ),
              const SizedBox(width: 14),

              // Details Column
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryNavy,
                        letterSpacing: -0.1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      roleStr,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppTheme.textSubtle,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      phone,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textDark,
                      ),
                    ),
                  ],
                ),
              ),

              // Action Buttons Column: Direct One-Tap Call & WhatsApp with Tactile Press
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AppPressable(
                    onTap: () => _makeCall(phone),
                    scaleDown: 0.90,
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.green.withValues(alpha: 0.2),
                          width: 1,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.phone_in_talk_rounded,
                        color: Colors.green,
                        size: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  AppPressable(
                    onTap: () => _openWhatsApp(phone, name),
                    scaleDown: 0.90,
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: const Color(0xFF25D366).withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color:
                              const Color(0xFF25D366).withValues(alpha: 0.3),
                          width: 1,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.chat_bubble_outline_rounded,
                        color: Color(0xFF25D366),
                        size: 18,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

