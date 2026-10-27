import '../models/tile_order.dart';

/// Calculation result encapsulating the authoritative Purchase Order financial breakdown
class PoCalculationResult {
  final double basicAmount;
  final double insuranceAmount;
  final double basicPlusInsurance;
  final double taxAmount;
  final double totalAmount;
  final double packagingCharges;

  const PoCalculationResult({
    required this.basicAmount,
    required this.insuranceAmount,
    required this.basicPlusInsurance,
    required this.taxAmount,
    required this.totalAmount,
    required this.packagingCharges,
  });
}

/// Shared authoritative Purchase Order calculation engine for Itacon.
///
/// Formula:
/// Basic amount → +0.35% transit insurance → Basic + 0.35% → +18% GST → Estimated total
/// (*Premium packaging charges note)
class PoCalculation {
  /// Calculate financial breakdown from an existing order
  static PoCalculationResult calculate(TileOrder order) {
    double rawBasic = 0.0;
    if (order.basicAmount > 0) {
      rawBasic = order.basicAmount;
    } else if (order.subtotal > 0) {
      rawBasic = order.subtotal;
    } else if (order.items.isNotEmpty) {
      rawBasic = order.items.fold(0.0, (double sum, i) {
        final double itemTotal = (i.lineTotal != null && i.lineTotal! > 0)
            ? i.lineTotal!
            : ((i.unitPrice ?? 0.0) * i.quantitySqFt);
        return sum + itemTotal;
      });
    }

    double packaging = 0.0;
    if (order.packagingCharges > 0) {
      packaging = order.packagingCharges;
    }

    return calculateFromBasic(rawBasic, packaging: packaging, originalSubtotal: order.subtotal);
  }

  /// Authoritative calculation from a basic amount
  static PoCalculationResult calculateFromBasic(
    double rawBasic, {
    double packaging = 0.0,
    double originalSubtotal = 0.0,
  }) {
    final double basic = (rawBasic * 100).round() / 100.0;
    if (basic <= 0) {
      return const PoCalculationResult(
        basicAmount: 0.0,
        insuranceAmount: 0.0,
        basicPlusInsurance: 0.0,
        taxAmount: 0.0,
        totalAmount: 0.0,
        packagingCharges: 0.0,
      );
    }

    // 0.35% Transit Insurance
    final double insurance = ((basic * 0.0035) * 100).round() / 100.0;

    // Basic + 0.35%
    final double basicPlusIns = ((basic + insurance) * 100).round() / 100.0;

    // 18% GST on (Basic + 0.35%)
    final double gst = ((basicPlusIns * 0.18) * 100).round() / 100.0;

    // Estimated total
    final double estimatedTotal = ((basicPlusIns + gst) * 100).round() / 100.0;

    // Packaging charges
    double finalPackaging = packaging;
    if (finalPackaging <= 0 && originalSubtotal > estimatedTotal) {
      finalPackaging = (((originalSubtotal - estimatedTotal) / 100.0) * 100).round() / 100.0;
    }

    return PoCalculationResult(
      basicAmount: basic,
      insuranceAmount: insurance,
      basicPlusInsurance: basicPlusIns,
      taxAmount: gst,
      totalAmount: estimatedTotal,
      packagingCharges: finalPackaging,
    );
  }
}
