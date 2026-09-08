import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/tile_product.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../screens/product_detail_screen.dart';
import 'interactive_pressable.dart';

/// Custom Adhesive Product Card for Fixing Solutions Line
/// Displays vertical packaging image with drop shadow, technical classification badge,
/// color dot indicator (Grey/White), and price formatted as '₹[basePrice] / Bag + Tax'.
class AdhesiveCard extends StatelessWidget {
  final TileProduct product;
  final VoidCallback? onTap;

  const AdhesiveCard({
    super.key,
    required this.product,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isWhiteAdhesive = product.color.toLowerCase().contains('white') ||
        product.classification.toLowerCase().contains('white');
    final classificationText = product.classification.isNotEmpty
        ? product.classification
        : (product.surface.isNotEmpty ? product.surface : 'C1T');

    final imagePath = product.images.isNotEmpty
        ? product.images.first
        : 'assets/images/adhesives/ITA-LX-01.png';

    return AppPressable(
      onTap: onTap ??
          () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ProductDetailScreen(product: product),
              ),
            );
          },
      scaleDown: 0.97,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderSubtle, width: 1),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0E274D).withValues(alpha: 0.06),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Vertical Packaging Image & Badges Banner
            Expanded(
              flex: 13,
              child: Stack(
                children: [
                  // Vertical Packaging Container with subtle ambient gradient
                  Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          const Color(0xFFF1F5F9),
                          Colors.white,
                        ],
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Container(
                        decoration: BoxDecoration(
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.12),
                              blurRadius: 18,
                              spreadRadius: 2,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Center(
                          child: _buildAdhesiveImage(imagePath),
                        ),
                      ),
                    ),
                  ),

                  // Technical Classification Badge (Top Left)
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryNavy,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.15),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: Text(
                        classificationText,
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ),

                  // Color Dot Badge (Top Right)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isWhiteAdhesive ? Colors.white : const Color(0xFF475569),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isWhiteAdhesive
                              ? AppTheme.borderSubtle
                              : Colors.transparent,
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isWhiteAdhesive ? Colors.grey.shade300 : Colors.grey.shade400,
                              border: Border.all(
                                color: isWhiteAdhesive ? Colors.grey.shade600 : Colors.white,
                                width: 1.5,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isWhiteAdhesive ? 'White' : 'Grey',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: isWhiteAdhesive ? AppTheme.textDark : Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Adhesive Details & Bag Pricing
            Expanded(
              flex: 11,
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryNavy,
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${product.sku} • ${product.bagWeightKg.toInt()} kg Bag',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.textSubtle,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Spacer(),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  '₹${product.basePrice.toInt()}',
                                  style: GoogleFonts.inter(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: AppTheme.primaryNavy,
                                  ),
                                ),
                              ),
                              Text(
                                '/ Bag + Tax',
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.accentOrange,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Quick Add to Cart Button
                        AppPressable(
                          onTap: () {
                            AppStateService.instance.addToCart(
                              product,
                              size: '${product.bagWeightKg.toInt()} kg Bag',
                              finish: classificationText,
                              quantity: 1,
                            );
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('${product.name} added to cart!'),
                                duration: const Duration(seconds: 2),
                                backgroundColor: AppTheme.primaryNavy,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          scaleDown: 0.85,
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryNavy,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.add_shopping_cart_rounded,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAdhesiveImage(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return Image.network(
        path,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) => _buildFallbackImage(),
      );
    }

    String cleanPath = path;
    if (!cleanPath.startsWith('assets/images/adhesives/') && cleanPath.contains('adhesives/')) {
      final fileName = cleanPath.split('adhesives/').last;
      cleanPath = 'assets/images/adhesives/$fileName';
    }

    return Image.asset(
      cleanPath,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) {
        final String alternatePath = cleanPath.contains('assets/images/adhesives')
            ? cleanPath.replaceFirst('assets/images/adhesives', 'assets/adhesives')
            : cleanPath;
        return Image.asset(
          alternatePath,
          fit: BoxFit.contain,
          errorBuilder: (context, error2, stackTrace2) => _buildFallbackImage(),
        );
      },
    );
  }

  Widget _buildFallbackImage() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.shield_outlined, size: 36, color: AppTheme.primaryNavy),
        const SizedBox(height: 4),
        Text(
          'ITACON LX',
          style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: AppTheme.primaryNavy,
          ),
        ),
      ],
    );
  }
}
