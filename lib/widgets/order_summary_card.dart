import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'interactive_pressable.dart';

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
      padding: EdgeInsets.all(context.w(14)),
      decoration: AppTheme.luxuryCardDecorationWithBorder(
        borderColor: AppTheme.primaryNavy.withValues(alpha: 0.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Header with Flexible Title and Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.sp(14.5),
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Subtle Tonnage Badge in Header
              Container(
                padding: EdgeInsets.symmetric(horizontal: context.w(7), vertical: context.h(3.5)),
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
                    Icon(
                      Icons.scale_rounded,
                      size: context.sp(12),
                      color: AppTheme.primaryNavy,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '$formattedTons Tonnes',
                      style: TextStyle(
                        fontSize: context.sp(10.5),
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: context.h(10)),

          // Subtotal Row with subtle weight badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    Text(
                      'Material Subtotal',
                      style: TextStyle(fontSize: context.sp(12.5), color: AppTheme.textSubtle),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.amber.shade300, width: 0.8),
                      ),
                      child: Text(
                        '📦 $totalBoxes Boxes',
                        style: TextStyle(
                          fontSize: context.sp(9.5),
                          fontWeight: FontWeight.w600,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '₹${subtotal.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: context.sp(13),
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textDark,
                ),
              ),
            ],
          ),
          SizedBox(height: context.h(8)),

          // Logistics Detail Row
          Container(
            width: double.infinity,
            padding: EdgeInsets.all(context.w(10)),
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
                  child: Icon(
                    Icons.local_shipping_outlined,
                    size: context.sp(15),
                    color: AppTheme.primaryNavy,
                  ),
                ),
                SizedBox(width: context.w(8)),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Total Weight: $formattedTons Tonnes (~$formattedKg kg)',
                        style: TextStyle(
                          fontSize: context.sp(11.5),
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryNavy,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Logistics: $totalBoxes boxes ready for dispatch & unloading',
                        style: TextStyle(
                          fontSize: context.sp(10),
                          color: AppTheme.textSubtle,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: context.h(8)),

          // Discount Row (if applicable)
          if (discountAmount > 0) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    discountLabel ?? 'Trade Partner Savings',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: context.sp(12.5),
                      color: Colors.green,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  '- ₹${discountAmount.toStringAsFixed(0)}',
                  style: TextStyle(
                    fontSize: context.sp(12.5),
                    color: Colors.green,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            SizedBox(height: context.h(6)),
          ],

          // GST / Tax Row (if applicable)
          if (taxAmount > 0) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Estimated GST (18%)',
                    style: TextStyle(fontSize: context.sp(12.5), color: AppTheme.textSubtle),
                  ),
                ),
                Text(
                  '₹${taxAmount.toStringAsFixed(0)}',
                  style: TextStyle(
                    fontSize: context.sp(12.5),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            SizedBox(height: context.h(6)),
          ],

          // Freight & Shipping Fee Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Logistics & Freight Fee',
                  style: TextStyle(fontSize: context.sp(12.5), color: AppTheme.textSubtle),
                ),
              ),
              Text(
                freightFee == 0 ? 'FREE' : '₹${freightFee.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: context.sp(12.5),
                  fontWeight: FontWeight.bold,
                  color: freightFee == 0 ? Colors.green : AppTheme.textDark,
                ),
              ),
            ],
          ),

          Divider(height: context.h(18), color: AppTheme.borderSubtle),

          // Grand Total Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'ESTIMATED TOTAL VALUE',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.sp(12),
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '₹${grandTotal.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: context.sp(17),
                  fontWeight: FontWeight.w800,
                  color: AppTheme.primaryNavy,
                ),
              ),
            ],
          ),

          if (showActionButton && onActionButtonPressed != null) ...[
            SizedBox(height: context.h(14)),
            AppButton(
              text: actionButtonText ?? 'PROCEED TO CHECKOUT →',
              onPressed: onActionButtonPressed,
              height: 48,
              width: double.infinity,
              variant: AppButtonVariant.primary,
              fontSize: 13.5,
            ),
          ],
        ],
      ),
    );
  }
}
