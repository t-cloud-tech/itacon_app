import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../services/user_demand_service.dart';
import '../services/product_catalog_service.dart';
import '../utils/app_notification_utils.dart';
import '../widgets/app_product_image.dart';
import '../widgets/interactive_pressable.dart';
import 'product_detail_screen.dart';

class FavoritesScreen extends StatelessWidget {
  final VoidCallback? onBackToHome;

  const FavoritesScreen({
    super.key,
    this.onBackToHome,
  });

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
          tooltip: 'Back',
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else if (onBackToHome != null) {
              onBackToHome!();
            }
          },
        ),
        title: const Text('My Wishlist'),
      ),
      body: ListenableBuilder(
        listenable: appState,
        builder: (context, _) {
          final favList = appState.favoriteProducts;

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (favList.isEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE5E9F0)),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.favorite_outline_rounded,
                          size: 64,
                          color: AppTheme.textLight.withValues(alpha: 0.5),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          'No Wishlist Items Yet',
                          style: GoogleFonts.inter(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Tap the heart icon on any product to save it here and receive tailored recommendations!',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 12.5,
                            color: AppTheme.textSubtle,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                ] else ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Saved Products (${favList.length})',
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textDark,
                        ),
                      ),
                      Text(
                        'Synced with your profile',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: Colors.green.shade700,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: favList.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final product = favList[index];
                      return Container(
                        decoration: AppTheme.luxuryCardDecoration,
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: AppProductImage(
                                imagePath: product.images.isNotEmpty
                                    ? product.images.first
                                    : '',
                                width: 76,
                                height: 76,
                                fit: BoxFit.contain,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: AppTheme.textDark,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${product.size} • ${product.finish}',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      color: AppTheme.textSubtle,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    product.isAdhesive
                                        ? '₹${product.basePrice.toStringAsFixed(0)} / bag'
                                        : '₹${product.basePrice.toStringAsFixed(0)} / sq ft',
                                    style: GoogleFonts.inter(
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w800,
                                      color: AppTheme.accentOrange,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded,
                                      color: AppTheme.statusError),
                                  tooltip: 'Remove from Wishlist',
                                  onPressed: () => appState.toggleFavorite(product),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add_shopping_cart_rounded,
                                      color: AppTheme.primaryNavy),
                                  tooltip: 'Add to Cart',
                                  onPressed: () {
                                    appState.addToCart(product);
                                    AppNotificationUtils.showAddToCartSnackBar(
                                      context,
                                      productName: product.name,
                                    );
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 32),
                ],

                // Recommended Based On Your Wishlist Section
                _buildWishlistRecommendations(context, appState),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildWishlistRecommendations(
      BuildContext context, AppStateService appState) {
    return ListenableBuilder(
      listenable: UserDemandService.instance,
      builder: (context, _) {
        final recommendations =
            UserDemandService.instance.getPersonalizedRecommendations(
          allProducts: ProductCatalogService.allCatalogProducts,
          limit: 6,
        );

        if (recommendations.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: AppTheme.accentOrange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    size: 16,
                    color: AppTheme.accentOrange,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Recommended For You',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textDark,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Products complementing your wishlist and search history',
              style: GoogleFonts.inter(
                fontSize: 12,
                color: AppTheme.textSubtle,
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 250,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                clipBehavior: Clip.none,
                itemCount: recommendations.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  final rec = recommendations[index];
                  final product = rec.product;

                  return RepaintBoundary(
                    child: AppPressable(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ProductDetailScreen(product: product),
                          ),
                        );
                      },
                      scaleDown: 0.96,
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        width: 170,
                        decoration: AppTheme.luxuryCardDecoration,
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Stack(
                                children: [
                                  AppProductImage(
                                    imagePath: product.images.isNotEmpty
                                        ? product.images.first
                                        : '',
                                    width: double.infinity,
                                    height: double.infinity,
                                    fit: BoxFit.cover,
                                  ),
                                  Positioned(
                                    top: 8,
                                    right: 8,
                                    child: CircleAvatar(
                                      radius: 13,
                                      backgroundColor:
                                          Colors.white.withValues(alpha: 0.94),
                                      child: IconButton(
                                        padding: EdgeInsets.zero,
                                        iconSize: 15,
                                        icon: Icon(
                                          appState.isFavorite(product.id)
                                              ? Icons.favorite_rounded
                                              : Icons.favorite_outline_rounded,
                                          color: appState.isFavorite(product.id)
                                              ? Colors.red
                                              : AppTheme.primaryNavy,
                                        ),
                                        onPressed: () =>
                                            appState.toggleFavorite(product),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.textDark,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${product.size} • ${product.surface}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.inter(
                                      fontSize: 10.5,
                                      color: AppTheme.textSubtle,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        product.isAdhesive
                                            ? '₹${product.basePrice.toStringAsFixed(0)} / bag'
                                            : '₹${product.basePrice.toStringAsFixed(0)} / sq ft',
                                        style: GoogleFonts.inter(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w800,
                                          color: AppTheme.accentOrange,
                                        ),
                                      ),
                                      InkWell(
                                        onTap: () {
                                          appState.addToCart(product);
                                          AppNotificationUtils.showAddToCartSnackBar(
                                            context,
                                            productName: product.name,
                                          );
                                        },
                                        borderRadius: BorderRadius.circular(6),
                                        child: Container(
                                          padding: const EdgeInsets.all(4),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primaryNavy
                                                .withValues(alpha: 0.08),
                                            borderRadius:
                                                BorderRadius.circular(6),
                                          ),
                                          child: const Icon(
                                            Icons.add_shopping_cart_rounded,
                                            size: 14,
                                            color: AppTheme.primaryNavy,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
