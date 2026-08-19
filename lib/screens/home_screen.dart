import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';
import '../models/product_enums.dart';
import 'categories_screen.dart';
import 'product_listing_screen.dart';
import 'product_detail_screen.dart';
import 'favorites_screen.dart';
import 'orders_screen.dart';
import 'cart_screen.dart';

class HomeScreen extends StatelessWidget {
  final Function(int)? onNavigateTab;

  const HomeScreen({
    super.key,
    this.onNavigateTab,
  });

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    final List<TileProduct> featuredProducts = [
      TileProduct(
        id: 'PROD_6012_01',
        name: 'Statuario Marble Vitrified',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'White',
        baseColour: 'White',
        pattern: 'Grey Vein',
        basePrice: 120.0,
        moq: 50,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Glossy',
        thickness: '9 mm',
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Endless',
        shape: 'rectangle',
        aspectRatio: '0.5',
      ),
      TileProduct(
        id: 'PROD_6060_01',
        name: 'Nero Marquina Square Tile',
        size: '600x600 mm',
        surface: 'High Gloss',
        color: 'Black',
        baseColour: 'Black',
        pattern: 'White Vein',
        basePrice: 95.0,
        moq: 40,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'High Gloss',
        thickness: '9 mm',
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Marbles',
        shape: 'square',
        aspectRatio: '1.0',
      ),
      TileProduct(
        id: 'PROD_6012_02',
        name: 'Royal Beige Carving Tile',
        size: '600x1200 mm',
        surface: 'Matt - Carving',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Carved Texture',
        basePrice: 135.0,
        moq: 30,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Matt - Carving',
        thickness: '9 mm',
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Terrazzo',
        shape: 'rectangle',
        aspectRatio: '0.5',
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded, color: AppTheme.primaryNavy),
          onPressed: () {},
        ),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primaryNavy,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.terrain_rounded,
                  color: AppTheme.accentOrange, size: 20),
            ),
            const SizedBox(width: 8),
            const Text(
              'ITACON GRANITO',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppTheme.primaryNavy,
                letterSpacing: 1.2,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded,
                color: AppTheme.primaryNavy),
            onPressed: () {},
          ),
          ListenableBuilder(
            listenable: appState,
            builder: (context, _) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.shopping_bag_outlined,
                        color: AppTheme.primaryNavy),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const CartScreen()),
                      );
                    },
                  ),
                  if (appState.cartCount > 0)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: AppTheme.accentOrange,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          '${appState.cartCount}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dark Navy Hero Banner
            Container(
              width: double.infinity,
              height: 180,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                image: const DecorationImage(
                  image: NetworkImage(
                    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
                  ),
                  fit: BoxFit.cover,
                ),
              ),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: LinearGradient(
                    colors: [
                      AppTheme.primaryNavy.withValues(alpha: 0.95),
                      AppTheme.primaryNavy.withValues(alpha: 0.5),
                    ],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Strength. Elegance. Timeless.',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Premium Vitrified & Ceramic Surfaces Direct from Manufacturer',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accentOrange,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                      ),
                      onPressed: () {
                        if (onNavigateTab != null) {
                          onNavigateTab!(1);
                        } else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const ProductListingScreen()),
                          );
                        }
                      },
                      child: const Text(
                        'Explore Collection →',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Quick Action Row (4 circular cards)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildQuickAction(
                  icon: Icons.grid_view_rounded,
                  label: 'All Products',
                  bgColor: Colors.blue.shade50,
                  iconColor: Colors.blue.shade700,
                  onTap: () {
                    if (onNavigateTab != null) {
                      onNavigateTab!(1);
                    } else {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const ProductListingScreen()),
                      );
                    }
                  },
                ),
                _buildQuickAction(
                  icon: Icons.category_outlined,
                  label: 'Categories',
                  bgColor: Colors.orange.shade50,
                  iconColor: AppTheme.accentOrange,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const CategoriesScreen()),
                    );
                  },
                ),
                _buildQuickAction(
                  icon: Icons.favorite_outline_rounded,
                  label: 'Favorites',
                  bgColor: Colors.purple.shade50,
                  iconColor: Colors.purple.shade700,
                  onTap: () {
                    if (onNavigateTab != null) {
                      onNavigateTab!(2);
                    } else {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const FavoritesScreen()),
                      );
                    }
                  },
                ),
                _buildQuickAction(
                  icon: Icons.receipt_long_outlined,
                  label: 'Orders',
                  bgColor: Colors.indigo.shade50,
                  iconColor: AppTheme.primaryNavy,
                  onTap: () {
                    if (onNavigateTab != null) {
                      onNavigateTab!(3);
                    } else {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const OrdersScreen()),
                      );
                    }
                  },
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Shop by Category Section (Floor Tiles, Wall Tiles, Slab Tiles, Heavy Duty Parkings)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Shop by Category',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    if (onNavigateTab != null) {
                      onNavigateTab!(1);
                    } else {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const CategoriesScreen()),
                      );
                    }
                  },
                  child: const Text(
                    'View All →',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.accentOrange,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // 4 Category Cards Grid
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: ProductEnums.tileCategories.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.4,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemBuilder: (context, index) {
                final cat = ProductEnums.tileCategories[index];
                final isComingSoon = cat['isComingSoon'] as bool;
                final label = cat['label'] as String;

                return GestureDetector(
                  onTap: isComingSoon
                      ? null
                      : () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ProductListingScreen(
                                subcategoryTitle: label,
                              ),
                            ),
                          );
                        },
                  child: Container(
                    decoration: AppTheme.luxuryCardDecorationWithBorder(
                      borderColor: isComingSoon
                          ? Colors.grey.shade300
                          : AppTheme.primaryNavy.withValues(alpha: 0.1),
                    ),
                    padding: const EdgeInsets.all(12),
                    child: Stack(
                      children: [
                        Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: isComingSoon
                                  ? Colors.grey.shade200
                                  : AppTheme.primaryNavy.withValues(alpha: 0.1),
                              child: Icon(
                                _getCategoryIcon(cat['id'] as String),
                                size: 18,
                                color: isComingSoon
                                    ? Colors.grey
                                    : AppTheme.primaryNavy,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              label,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: isComingSoon
                                    ? AppTheme.textSubtle
                                    : AppTheme.textDark,
                              ),
                            ),
                          ],
                        ),
                        if (isComingSoon)
                          Positioned(
                            top: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppTheme.accentOrange,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'Coming Soon',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 28),

            // Shop by Space Section (Living Room, Bath Room, Bedroom, Outdoor)
            const Text(
              'Shop by Space',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 14),

            // Horizontal Scrollable Space Cards
            SizedBox(
              height: 100,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: ProductEnums.spaces.length,
                itemBuilder: (context, index) {
                  final spaceName = ProductEnums.spaces[index];
                  return GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ProductListingScreen(
                            subcategoryTitle: '$spaceName Tiles',
                          ),
                        ),
                      );
                    },
                    child: Container(
                      width: 120,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: AppTheme.luxuryCardDecoration,
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor:
                                AppTheme.accentOrange.withValues(alpha: 0.1),
                            child: Icon(
                              _getSpaceIcon(spaceName),
                              color: AppTheme.accentOrange,
                              size: 20,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            spaceName,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 28),

            // Featured Best Sellers Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Featured Collection',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const ProductListingScreen()),
                    );
                  },
                  child: const Text(
                    'View All →',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.accentOrange,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Featured Products Grid
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: featuredProducts.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.72,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemBuilder: (context, index) {
                final product = featuredProducts[index];
                return GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ProductDetailScreen(product: product),
                      ),
                    );
                  },
                  child: Container(
                    decoration: AppTheme.luxuryCardDecoration,
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Stack(
                            children: [
                              Image.network(
                                product.images.first,
                                width: double.infinity,
                                height: double.infinity,
                                fit: BoxFit.cover,
                              ),
                              Positioned(
                                top: 8,
                                right: 8,
                                child: ListenableBuilder(
                                  listenable: appState,
                                  builder: (context, _) {
                                    final isFav =
                                        appState.isFavorite(product.id);
                                    return CircleAvatar(
                                      radius: 14,
                                      backgroundColor:
                                          Colors.white.withValues(alpha: 0.9),
                                      child: Icon(
                                        isFav
                                            ? Icons.favorite_rounded
                                            : Icons.favorite_outline_rounded,
                                        color: isFav
                                            ? Colors.red
                                            : AppTheme.primaryNavy,
                                        size: 16,
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                product.name,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textDark,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                product.size,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.textSubtle,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '₹${product.basePrice.toStringAsFixed(0)} / sq.ft',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.accentOrange,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  IconData _getCategoryIcon(String catId) {
    switch (catId) {
      case 'floor_tiles':
        return Icons.grid_view_rounded;
      case 'wall_tiles':
        return Icons.wallpaper_rounded;
      case 'slab_tiles':
        return Icons.crop_landscape_rounded;
      case 'heavy_duty_parkings':
        return Icons.local_parking_rounded;
      default:
        return Icons.layers_rounded;
    }
  }

  IconData _getSpaceIcon(String spaceName) {
    switch (spaceName) {
      case 'Living Room':
        return Icons.weekend_outlined;
      case 'Bath Room':
        return Icons.bathtub_outlined;
      case 'Bedroom':
        return Icons.bed_outlined;
      case 'Outdoor':
        return Icons.deck_outlined;
      default:
        return Icons.home_outlined;
    }
  }

  Widget _buildQuickAction({
    required IconData icon,
    required String label,
    required Color bgColor,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: bgColor,
              shape: BoxShape.circle,
              border: Border.all(color: iconColor.withValues(alpha: 0.2)),
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppTheme.textDark,
            ),
          ),
        ],
      ),
    );
  }
}
