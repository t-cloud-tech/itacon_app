import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Reusable Order & Estimate Summary Card with automatic weight (tonnage) & box details
class OrderSummaryCard extends StatelessWidget {
  final double subtotal;
  final double freightFee;
  final double taxAmount;
  final double discountAmount;
  final double grandTotal;
  final int totalBoxes;
  final double totalWeightTons;
  final double totalWeightKg;
  final String title;
  final String? discountLabel;
  final VoidCallback? onActionButtonPressed;
  final String? actionButtonText;
  final bool showActionButton;

  const OrderSummaryCard({
    super.key,
    required this.subtotal,
    this.freightFee = 0.0,
    this.taxAmount = 0.0,
    this.discountAmount = 0.0,
    required this.grandTotal,
    required this.totalBoxes,
    required this.totalWeightTons,
    required this.totalWeightKg,
    this.title = 'Order & Price Breakdown',
    this.discountLabel,
    this.onActionButtonPressed,
    this.actionButtonText,
    this.showActionButton = false,
  });

  String _formatNumber(num number) {
    final str = number.toInt().toString();
    final RegExp reg = RegExp(r'(\d+?)(?=(\d{3})+(?!\d))');
    return str.replaceAllMapped(reg, (Match m) => '${m[1]},');
  }

  @override
  Widget build(BuildContext context) {
    final formattedTons = totalWeightTons.toStringAsFixed(2);
    final formattedKg = _formatNumber(totalWeightKg);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.luxuryCardDecorationWithBorder(
        borderColor: AppTheme.primaryNavy.withValues(alpha: 0.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
              ),
              // Subtle Tonnage Badge in Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.15),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.scale_rounded,
                      size: 13,
                      color: AppTheme.primaryNavy,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '$formattedTons Tonnes',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Subtotal Row with subtle weight badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text(
                    'Material Subtotal',
                    style: TextStyle(fontSize: 13, color: AppTheme.textSubtle),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: Colors.amber.shade300, width: 0.8),
                    ),
                    child: Text(
                      '📦 $totalBoxes Boxes',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: Colors.amber.shade900,
                      ),
                    ),
                  ),
                ],
              ),
              Text(
                '₹${subtotal.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Logistics Detail Row (Explicit requirement: Total Weight: 7.05 Tonnes (~7,050 kg))
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF4F7FC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppTheme.primaryNavy.withValues(alpha: 0.1)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.local_shipping_outlined,
                    size: 16,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Total Weight: $formattedTons Tonnes (~$formattedKg kg)',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryNavy,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Logistics: $totalBoxes boxes ready for dispatch & unloading',
                        style: const TextStyle(
                          fontSize: 10,
                          color: AppTheme.textSubtle,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Discount Row (if applicable)
          if (discountAmount > 0) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  discountLabel ?? 'Trade Partner Savings',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.green,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '- ₹${discountAmount.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.green,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
          ],

          // GST / Tax Row (if applicable)
          if (taxAmount > 0) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Estimated GST (18%)',
                  style: TextStyle(fontSize: 13, color: AppTheme.textSubtle),
                ),
                Text(
                  '₹${taxAmount.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
          ],

          // Freight & Shipping Fee Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Logistics & Freight Fee',
                style: TextStyle(fontSize: 13, color: AppTheme.textSubtle),
              ),
              Text(
                freightFee == 0 ? 'FREE' : '₹${freightFee.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: freightFee == 0 ? Colors.green : AppTheme.textDark,
                ),
              ),
            ],
          ),

          const Divider(height: 20, color: AppTheme.borderSubtle),

          // Grand Total Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ESTIMATED TOTAL VALUE',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                  letterSpacing: 0.5,
                ),
              ),
              Text(
                '₹${grandTotal.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.primaryNavy,
                ),
              ),
            ],
          ),

          if (showActionButton && onActionButtonPressed != null) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryNavy,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: onActionButtonPressed,
                child: Text(
                  actionButtonText ?? 'PROCEED TO CHECKOUT →',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
