import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../services/pricing_service.dart';
import 'checkout_screen.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Cart'),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert_rounded, color: AppTheme.primaryNavy),
            onPressed: () {},
          ),
        ],
      ),
      body: ListenableBuilder(
        listenable: appState,
        builder: (context, _) {
          if (appState.cartItems.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.shopping_bag_outlined,
                    size: 80,
                    color: AppTheme.textLight.withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Your Cart is Empty',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Explore our luxury collections and add products!',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppTheme.textSubtle,
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('EXPLORE CATALOGUE'),
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: appState.cartItems.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final item = appState.cartItems[index];
                    return Container(
                      decoration: AppTheme.luxuryCardDecoration,
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              item.product.images.isNotEmpty
                                  ? item.product.images.first
                                  : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
                              width: 80,
                              height: 80,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 80,
                                height: 80,
                                color: AppTheme.primaryNavy
                                    .withValues(alpha: 0.1),
                                child: const Icon(Icons.terrain_rounded,
                                    color: AppTheme.primaryNavy),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        item.product.name,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: AppTheme.textDark,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline,
                                          color: AppTheme.statusError, size: 20),
                                      onPressed: () =>
                                          appState.removeFromCart(item),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade100,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    '${item.selectedSize} • ${item.selectedFinish}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppTheme.textSubtle,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                 Row(
                                   mainAxisAlignment:
                                       MainAxisAlignment.spaceBetween,
                                   children: [
                                     Builder(
                                       builder: (context) {
                                         final resolved = PricingService.instance.resolvePrice(item.product, null, item.quantity);
                                         return Row(
                                           children: [
                                             if (resolved.hasDiscount) ...[
                                               Text(
                                                 '₹${resolved.basePrice.toStringAsFixed(0)}',
                                                 style: const TextStyle(
                                                   fontSize: 11,
                                                   color: Colors.grey,
                                                   decoration: TextDecoration.lineThrough,
                                                 ),
                                               ),
                                               const SizedBox(width: 4),
                                             ],
                                             Text(
                                               '₹${item.effectiveUnitPrice.toStringAsFixed(0)}/sq.ft',
                                               style: const TextStyle(
                                                 fontSize: 15,
                                                 fontWeight: FontWeight.w800,
                                                 color: AppTheme.accentOrange,
                                               ),
                                             ),
                                           ],
                                         );
                                       },
                                     ),
                                    Container(
                                      height: 32,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                            color: AppTheme.borderSubtle),
                                      ),
                                      child: Row(
                                        children: [
                                          IconButton(
                                            icon: const Icon(Icons.remove,
                                                size: 14),
                                            padding: EdgeInsets.zero,
                                            constraints: const BoxConstraints(
                                                minWidth: 28),
                                            onPressed: () => appState
                                                .updateQuantity(item, -1),
                                          ),
                                          Text(
                                            '${item.quantity}',
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.add,
                                                size: 14),
                                            padding: EdgeInsets.zero,
                                            constraints: const BoxConstraints(
                                                minWidth: 28),
                                            onPressed: () => appState
                                                .updateQuantity(item, 1),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              // Bottom Summary Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(24),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 16,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Subtotal',
                              style: TextStyle(color: AppTheme.textSubtle)),
                          Text(
                            '₹${appState.subtotal.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Delivery & Freight',
                              style: TextStyle(color: AppTheme.textSubtle)),
                          Text(
                            appState.freightFee == 0
                                ? 'FREE'
                                : '₹${appState.freightFee.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: appState.freightFee == 0
                                  ? AppTheme.statusSuccess
                                  : AppTheme.textDark,
                            ),
                          ),
                        ],
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Divider(color: AppTheme.borderSubtle),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Total Amount',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                          Text(
                            '₹${appState.totalAmount.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.accentOrange,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const CheckoutScreen(),
                              ),
                            );
                          },
                          child: const Text(
                            'PROCEED TO CHECKOUT →',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
