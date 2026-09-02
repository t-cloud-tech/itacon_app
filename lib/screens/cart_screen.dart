import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../services/pricing_service.dart';
import '../widgets/order_summary_card.dart';
import 'checkout_screen.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  void _showManualQuantityDialog(
    BuildContext context,
    AppStateService appState,
    CartItem item,
  ) {
    final controller = TextEditingController(text: '${item.quantity}');

    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.edit_note_rounded, color: AppTheme.primaryNavy, size: 20),
              ),
              const SizedBox(width: 10),
              const Text(
                'Enter Quantity',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.product.name,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                '${item.selectedSize} • ${item.selectedFinish}',
                style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: 'Box Quantity (Boxes)',
                  hintText: 'Enter number of boxes',
                  suffixText: 'Boxes',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppTheme.primaryNavy, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Quick Add Presets:',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textSubtle),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                children: [10, 50, 100, 500].map((preset) {
                  return ActionChip(
                    label: Text('+$preset'),
                    labelStyle: const TextStyle(fontSize: 11, color: AppTheme.primaryNavy, fontWeight: FontWeight.bold),
                    backgroundColor: AppTheme.primaryNavy.withValues(alpha: 0.06),
                    onPressed: () {
                      final current = int.tryParse(controller.text) ?? 0;
                      controller.text = '${current + preset}';
                    },
                  );
                }).toList(),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('CANCEL', style: TextStyle(color: AppTheme.textSubtle)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryNavy,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                final parsed = int.tryParse(controller.text.trim());
                if (parsed != null && parsed >= 0) {
                  appState.setQuantity(item, parsed);
                  Navigator.pop(dialogContext);
                }
              },
              child: const Text('UPDATE'),
            ),
          ],
        );
      },
    );
  }

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
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  itemCount: appState.cartItems.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
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
                              errorBuilder: (_, _, _) => Container(
                                width: 80,
                                height: 80,
                                color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                                child: const Icon(Icons.terrain_rounded, color: AppTheme.primaryNavy),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                                      onPressed: () => appState.removeFromCart(item),
                                    ),
                                  ],
                                ),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        '${item.itemWeightKg.toStringAsFixed(0)} kg',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: AppTheme.primaryNavy,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Builder(
                                      builder: (context) {
                                        final resolved = PricingService.instance.resolvePrice(item.product);
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

                                    // Interactive Quantity Stepper with Manual Input Target
                                    Container(
                                      height: 34,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: AppTheme.borderSubtle),
                                      ),
                                      child: Row(
                                        children: [
                                          IconButton(
                                            icon: const Icon(Icons.remove, size: 14),
                                            padding: EdgeInsets.zero,
                                            constraints: const BoxConstraints(minWidth: 28),
                                            onPressed: () => appState.updateQuantity(item, -1),
                                          ),
                                          Tooltip(
                                            message: 'Tap to edit quantity manually',
                                            child: InkWell(
                                              onTap: () => _showManualQuantityDialog(context, appState, item),
                                              borderRadius: BorderRadius.circular(4),
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                decoration: BoxDecoration(
                                                  color: AppTheme.primaryNavy.withValues(alpha: 0.06),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Text(
                                                      '${item.quantity}',
                                                      style: const TextStyle(
                                                        fontSize: 13,
                                                        fontWeight: FontWeight.bold,
                                                        color: AppTheme.primaryNavy,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 4),
                                                    const Icon(
                                                      Icons.edit_outlined,
                                                      size: 12,
                                                      color: AppTheme.accentOrange,
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.add, size: 14),
                                            padding: EdgeInsets.zero,
                                            constraints: const BoxConstraints(minWidth: 28),
                                            onPressed: () => appState.updateQuantity(item, 1),
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

              // Bottom Summary Card with Tonnage & Box Details
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 16,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: OrderSummaryCard(
                    subtotal: appState.subtotal,
                    freightFee: appState.freightFee,
                    grandTotal: appState.totalAmount,
                    totalBoxes: appState.totalBoxes,
                    totalWeightTons: appState.totalWeightTons,
                    totalWeightKg: appState.totalWeightKg,
                    title: 'Cart & Logistics Summary',
                    showActionButton: true,
                    actionButtonText: 'PROCEED TO CHECKOUT →',
                    onActionButtonPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const CheckoutScreen(),
                        ),
                      );
                    },
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
