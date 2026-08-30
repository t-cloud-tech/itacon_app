import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/tile_order.dart';
import '../services/firestore_service.dart';
import '../services/app_state_service.dart';
import 'order_details_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    final userId = AppStateService.instance.currentUserProfile.userId;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Orders'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.primaryNavy,
          unselectedLabelColor: AppTheme.textSubtle,
          indicatorColor: AppTheme.accentOrange,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Pending Quote'),
            Tab(text: 'Rates Quoted'),
            Tab(text: 'Confirmed'),
          ],
        ),
      ),
      body: StreamBuilder<List<TileOrder>>(
        stream: FirestoreService.instance.getUserOrdersStream(userId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: AppTheme.primaryNavy));
          }

          final allOrders = snapshot.data ?? [];

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Search PO reference or product...',
                    prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.textSubtle),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildOrderList(allOrders),
                    _buildOrderList(allOrders.where((o) => o.status == 'pending_rate').toList()),
                    _buildOrderList(allOrders.where((o) => o.status == 'rate_quoted').toList()),
                    _buildOrderList(allOrders.where((o) => o.status == 'confirmed').toList()),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildOrderList(List<TileOrder> orders) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_outlined, size: 64, color: AppTheme.textLight.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            const Text(
              'No Orders Found',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      itemCount: orders.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final order = orders[index];
        final String displayStatus = order.status == 'pending_rate'
            ? 'Awaiting Quote'
            : (order.status == 'rate_quoted'
                ? 'Rates Quoted'
                : (order.status == 'confirmed' ? 'PO Confirmed' : order.status.toUpperCase()));

        final Color statusColor = order.status == 'confirmed'
            ? AppTheme.statusSuccess
            : (order.status == 'rate_quoted'
                ? AppTheme.accentOrange
                : AppTheme.primaryNavy);

        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => OrderDetailsScreen(orderId: order.id, initialOrder: order),
              ),
            );
          },
          child: Container(
            decoration: AppTheme.luxuryCardDecoration,
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      order.orderReference,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        displayStatus,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.inventory_2_rounded, color: AppTheme.primaryNavy),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${order.items.length} Item(s) • ${order.totalBoxes} Boxes (${order.totalWeightTons.toStringAsFixed(2)} Tonnes)',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            order.items.isNotEmpty ? order.items.first.productName : 'Tile Products',
                            style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(height: 20, color: AppTheme.borderSubtle),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      order.status == 'pending_rate'
                          ? 'Total: Rate Quote Pending'
                          : 'Total: ₹${order.totalAmount.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textDark,
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: order.status == 'rate_quoted' ? AppTheme.accentOrange : AppTheme.primaryNavy,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => OrderDetailsScreen(orderId: order.id, initialOrder: order),
                          ),
                        );
                      },
                      child: Text(
                        order.status == 'rate_quoted' ? 'REVIEW RATES →' : 'VIEW PO DETAILS',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}


