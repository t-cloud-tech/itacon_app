import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../models/tile_product.dart';
import 'cart_screen.dart';

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    final List<TileProduct> sampleFavorites = [
      TileProduct(
        id: 'PROD_BG_01',
        name: 'Black Galaxy Granite',
        size: '600x1200 mm',
        surface: 'Polished',
        color: 'Black',
        pattern: 'Gold Speckled',
        basePrice: 120.0,
        moq: 50,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Polished',
        thickness: '15 mm',
        shape: 'rectangle',
        aspectRatio: '0.5',
      ),
      TileProduct(
        id: 'PROD_BG_02',
        name: 'Statuario Marble White',
        size: '800x1600 mm',
        surface: 'High Polish',
        color: 'White',
        pattern: 'Grey Vein',
        basePrice: 240.0,
        moq: 30,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Polished',
        thickness: '18 mm',
        shape: 'rectangle',
        aspectRatio: '0.5',
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Favorites'),
      ),
      body: ListenableBuilder(
        listenable: appState,
        builder: (context, _) {
          final favIds = appState.favoriteProductIds;

          final favList = sampleFavorites
              .where((p) => favIds.isEmpty || favIds.contains(p.id))
              .toList();

          if (favList.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.favorite_outline_rounded,
                      size: 80, color: AppTheme.textLight.withValues(alpha: 0.5)),
                  const SizedBox(height: 16),
                  const Text(
                    'No Favorites Saved Yet',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Tap the heart icon on any product to save it here!',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppTheme.textSubtle,
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: favList.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final product = favList[index];
              return Container(
                decoration: AppTheme.luxuryCardDecoration,
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        product.images.isNotEmpty
                            ? product.images.first
                            : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
                        width: 72,
                        height: 72,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 72,
                          height: 72,
                          color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                          child: const Icon(Icons.terrain_rounded,
                              color: AppTheme.primaryNavy),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            product.name,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${product.size} • ${product.finish}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSubtle,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '₹${product.basePrice.toStringAsFixed(0)} / sq.ft',
                            style: const TextStyle(
                              fontSize: 15,
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
                          icon: const Icon(Icons.delete_outline,
                              color: AppTheme.statusError),
                          onPressed: () => appState.toggleFavorite(product.id),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_shopping_cart_rounded,
                              color: AppTheme.primaryNavy),
                          onPressed: () {
                            appState.addToCart(product);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('${product.name} added to cart!'),
                                action: SnackBarAction(
                                  label: 'VIEW CART',
                                  textColor: AppTheme.accentOrange,
                                  onPressed: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                          builder: (_) => const CartScreen()),
                                    );
                                  },
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
