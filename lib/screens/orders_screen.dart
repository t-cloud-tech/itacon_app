import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Map<String, dynamic>> _allOrders = const [
    {
      'orderId': '#ITC12345',
      'date': '18 Aug 2026',
      'product': 'Black Galaxy Granite (1200 sq.ft)',
      'total': '₹1,44,000',
      'status': 'Delivered',
      'statusColor': AppTheme.statusSuccess,
      'image': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
    },
    {
      'orderId': '#ITC12346',
      'date': '15 Aug 2026',
      'product': 'Statuario White Marble (800 sq.ft)',
      'total': '₹2,20,000',
      'status': 'Shipped',
      'statusColor': AppTheme.accentOrange,
      'image': 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=300&q=80',
    },
    {
      'orderId': '#ITC12347',
      'date': '12 Aug 2026',
      'product': 'Calacatta Quartz Slab (500 sq.ft)',
      'total': '₹95,000',
      'status': 'Processing',
      'statusColor': AppTheme.statusWarning,
      'image': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
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
            Tab(text: 'Processing'),
            Tab(text: 'Shipped'),
            Tab(text: 'Delivered'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search order number or product...',
                prefixIcon: const Icon(Icons.search_rounded,
                    color: AppTheme.textSubtle),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),

          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildOrderList(_allOrders),
                _buildOrderList(_allOrders
                    .where((o) => o['status'] == 'Processing')
                    .toList()),
                _buildOrderList(_allOrders
                    .where((o) => o['status'] == 'Shipped')
                    .toList()),
                _buildOrderList(_allOrders
                    .where((o) => o['status'] == 'Delivered')
                    .toList()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderList(List<Map<String, dynamic>> orders) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_outlined,
                size: 64, color: AppTheme.textLight.withValues(alpha: 0.5)),
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final order = orders[index];
        final Color statusColor = order['statusColor'] as Color;

        return Container(
          decoration: AppTheme.luxuryCardDecoration,
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Order ID & Status Chip
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    order['orderId'] as String,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      order['status'] as String,
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

              // Product Info
              Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      order['image'] as String,
                      width: 60,
                      height: 60,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 60,
                        height: 60,
                        color: AppTheme.primaryNavy.withValues(alpha: 0.1),
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
                        Text(
                          order['product'] as String,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Ordered on ${order['date']}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppTheme.textSubtle,
                          ),
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
                    'Total Amount: ${order['total']}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textDark,
                    ),
                  ),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                    ),
                    onPressed: () {},
                    child: const Text('View Details',
                        style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
