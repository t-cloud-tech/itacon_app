/// Helper utility for extracting physical tile dimensions and calculating exact aspect ratios
class TileDimensionHelper {
  /// Calculates exact tile aspect ratio (Width / Height) from a size string.
  /// Examples:
  /// '600X1200MM' -> 600 / 1200 = 0.5
  /// '600X600MM'  -> 600 / 600  = 1.0
  /// '1200X1800MM' -> 1200 / 1800 = 0.667
  /// Default fallback: 0.5
  static double calculateTileAspectRatio(String sizeString) {
    if (sizeString.isEmpty) return 0.5;

    try {
      final clean = sizeString.toUpperCase().replaceAll('MM', '').replaceAll(' ', '').trim();
      final parts = clean.split(RegExp(r'[X\*x×]'));
      if (parts.length >= 2) {
        final w = double.parse(parts[0]);
        final h = double.parse(parts[1]);
        if (h > 0 && w > 0) {
          return w / h;
        }
      }
    } catch (_) {
      // Return default fallback ratio on parse error
    }
    return 0.5;
  }

  /// Returns standard pieces per box for given size
  static int getPcsPerBox(String sizeString) {
    final clean = sizeString.toUpperCase().replaceAll(' ', '');
    if (clean.contains('600X600') || clean.contains('600*600')) {
      return 4;
    }
    return 2; // Default for 600x1200, 800x1600, 1200x1800
  }

  /// Returns standard coverage area in sq.ft per box
  static double getSqFtPerBox(String sizeString) {
    return 15.5; // Standard client specification
  }

  /// Formats size string cleanly, e.g. "1200 x 1800 mm • Slab"
  static String getFormattedWatermark(String sizeString, {String? category}) {
    final clean = sizeString.trim();
    if (category != null && category.isNotEmpty) {
      return '$clean • $category';
    }
    final ratio = calculateTileAspectRatio(sizeString);
    final isSlab = ratio < 0.8 || clean.contains('1200') || clean.contains('1800');
    return '$clean • ${isSlab ? "Slab" : "Tile"}';
  }
}
