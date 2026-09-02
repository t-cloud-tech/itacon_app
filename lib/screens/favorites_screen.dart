import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../utils/app_notification_utils.dart';

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Favorites'),
      ),
      body: ListenableBuilder(
        listenable: appState,
        builder: (context, _) {
          final favList = appState.favoriteProducts;

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
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
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
                      child: Image.network(
                        product.images.isNotEmpty
                            ? product.images.first
                            : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
                        width: 72,
                        height: 72,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Container(
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
          );
        },
      ),
    );
  }
}
