import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/tile_order.dart';
import '../services/firestore_service.dart';
import '../services/app_state_service.dart';
import 'order_details_screen.dart';

class OrdersScreen extends StatefulWidget {
  final VoidCallback? onBackToHome;
  final Stream<List<TileOrder>>? ordersStream;

  const OrdersScreen({
    super.key,
    this.onBackToHome,
    this.ordersStream,
  });

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  bool _isNavigating = false;

  void _navigateToOrderDetails(TileOrder order) {
    if (_isNavigating || !mounted) return;
    _isNavigating = true;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => OrderDetailsScreen(orderId: order.id, initialOrder: order),
      ),
    ).then((_) {
      if (mounted) {
        setState(() => _isNavigating = false);
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  List<TileOrder> _applySearch(List<TileOrder> orders) {
    if (_searchQuery.isEmpty) return orders;
    return orders.where((order) {
      final refMatch = order.orderReference.toLowerCase().contains(_searchQuery);
      final poMatch = order.poNumber.toLowerCase().contains(_searchQuery);
      final customerMatch = order.customerName.toLowerCase().contains(_searchQuery);
      final addressMatch = order.deliveryAddress.toLowerCase().contains(_searchQuery);
      final itemMatch = order.items.any((item) =>
          item.productName.toLowerCase().contains(_searchQuery) ||
          item.sku.toLowerCase().contains(_searchQuery) ||
          item.surface.toLowerCase().contains(_searchQuery));
      return refMatch || poMatch || customerMatch || addressMatch || itemMatch;
    }).toList();
  }

  String _formatDate(DateTime? dt) {
    if (dt == null) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final userId = AppStateService.instance.currentUserProfile.userId;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
          tooltip: 'Back',
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else if (widget.onBackToHome != null) {
              widget.onBackToHome!();
            }
          },
        ),
        title: const Text('My Orders'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelColor: AppTheme.primaryNavy,
          unselectedLabelColor: AppTheme.textSubtle,
          indicatorColor: AppTheme.accentOrange,
          indicatorWeight: 3,
          labelPadding: const EdgeInsets.symmetric(horizontal: 16),
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Pending Quote'),
            Tab(text: 'Rates Quoted'),
            Tab(text: 'Confirmed'),
            Tab(text: 'History'),
          ],
        ),
      ),
      body: StreamBuilder<List<TileOrder>>(
        stream: widget.ordersStream ?? FirestoreService.instance.getUserOrdersStream(userId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: AppTheme.primaryNavy));
          }

          final allOrders = snapshot.data ?? [];

          // Deterministic stage separation: Each active order belongs to EXACTLY one tab
          final historyOrders = allOrders.where((o) => o.isHistoryStage).toList();
          final pendingQuoteOrders = allOrders.where((o) => o.isPendingQuoteStage).toList();
          final ratesQuotedOrders = allOrders.where((o) => o.isRateQuotedStage).toList();
          final confirmedOrders = allOrders.where((o) => o.isConfirmedStage).toList();

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val.trim().toLowerCase();
                    });
                  },
                  decoration: InputDecoration(
                    hintText: 'Search PO reference, product or client...',
                    prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.textSubtle),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, color: AppTheme.textSubtle),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildOrderList(
                      _applySearch(allOrders),
                      tabName: 'All',
                      emptyTitle: 'No Orders Found',
                      emptySubtitle: 'Your placed orders and quotation requests will appear here.',
                      emptyIcon: Icons.assignment_outlined,
                      isHistoryTab: false,
                    ),
                    _buildOrderList(
                      _applySearch(pendingQuoteOrders),
                      tabName: 'Pending Quote',
                      emptyTitle: 'No Pending Quotes',
                      emptySubtitle: 'When you place an order, quotation requests awaiting factory rates appear here.',
                      emptyIcon: Icons.hourglass_empty_rounded,
                      isHistoryTab: false,
                    ),
                    _buildOrderList(
                      _applySearch(ratesQuotedOrders),
                      tabName: 'Rates Quoted',
                      emptyTitle: 'No Rates Quoted',
                      emptySubtitle: 'Orders with rates provided by your salesperson ready for review appear here.',
                      emptyIcon: Icons.request_quote_outlined,
                      isHistoryTab: false,
                    ),
                    _buildOrderList(
                      _applySearch(confirmedOrders),
                      tabName: 'Confirmed',
                      emptyTitle: 'No Confirmed Orders',
                      emptySubtitle: 'Accepted and active confirmed orders appear here.',
                      emptyIcon: Icons.check_circle_outline_rounded,
                      isHistoryTab: false,
                    ),
                    _buildOrderList(
                      _applySearch(historyOrders),
                      tabName: 'History',
                      emptyTitle: 'No completed orders yet',
                      emptySubtitle: 'Orders that have completed delivery and payment will appear here.',
                      emptyIcon: Icons.receipt_long_outlined,
                      isHistoryTab: true,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildOrderList(
    List<TileOrder> orders, {
    required String tabName,
    required String emptyTitle,
    required String emptySubtitle,
    required IconData emptyIcon,
    required bool isHistoryTab,
  }) {
    if (orders.isEmpty) {
      final isSearching = _searchQuery.isNotEmpty;
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isSearching ? Icons.search_off_rounded : emptyIcon,
                size: 64,
                color: AppTheme.textLight.withValues(alpha: 0.5),
              ),
              const SizedBox(height: 12),
              Text(
                isSearching ? 'No Matching Orders' : emptyTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                isSearching ? 'No orders match "$_searchQuery" under $tabName.' : emptySubtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSubtle,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      itemCount: orders.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final order = orders[index];
        final String displayStatus;
        switch (order.status.toLowerCase()) {
          case 'pending_rate':
          case 'pending_quote':
          case 'awaiting_quote':
          case 'pending_admin_approval':
            displayStatus = 'Awaiting Quote';
            break;
          case 'rate_quoted':
            displayStatus = 'Rates Quoted';
            break;
          case 'confirmed':
            displayStatus = 'PO Confirmed';
            break;
          case 'pending_salesperson_review':
          case 'pending_manager_approval':
            displayStatus = 'Under Review';
            break;
          case 'processing':
            displayStatus = 'In Production';
            break;
          case 'dispatched':
            displayStatus = 'Dispatched';
            break;
          case 'delivered':
            displayStatus = 'Delivered';
            break;
          case 'completed':
            displayStatus = 'Completed';
            break;
          case 'rejected':
            displayStatus = 'Declined';
            break;
          case 'cancelled':
            displayStatus = 'Cancelled';
            break;
          default:
            if (order.dispatchStatus.toLowerCase() == 'delivered') {
              displayStatus = 'Delivered';
            } else if (order.dispatchStatus.toLowerCase() == 'dispatched') {
              displayStatus = 'Dispatched';
            } else {
              displayStatus = order.status
                  .replaceAll('_', ' ')
                  .split(' ')
                  .map((s) => s.isNotEmpty
                      ? '${s[0].toUpperCase()}${s.substring(1).toLowerCase()}'
                      : '')
                  .join(' ');
            }
        }

        final Color statusColor;
        final sLower = order.status.toLowerCase();
        if (sLower == 'confirmed' || sLower == 'delivered' || sLower == 'completed' || order.dispatchStatus == 'delivered') {
          statusColor = AppTheme.statusSuccess;
        } else if (sLower == 'rate_quoted') {
          statusColor = AppTheme.accentOrange;
        } else if (sLower == 'pending_manager_approval' || sLower == 'pending_salesperson_review') {
          statusColor = const Color(0xFFD97706); // Amber
        } else if (sLower == 'cancelled' || sLower == 'rejected') {
          statusColor = Colors.red;
        } else if (sLower == 'dispatched') {
          statusColor = Colors.teal;
        } else {
          statusColor = AppTheme.primaryNavy;
        }

        final orderDateStr = _formatDate(order.createdAt);
        final completionDateStr = order.deliveredAt != null
            ? _formatDate(order.deliveredAt)
            : (order.updatedAt != null && isHistoryTab ? _formatDate(order.updatedAt) : '');

        return GestureDetector(
          onTap: () => _navigateToOrderDetails(order),
          child: Container(
            decoration: AppTheme.luxuryCardDecoration,
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            order.orderReference,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primaryNavy,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (order.customerName.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              'Customer: ${order.customerName}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textSubtle,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
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
                          if (orderDateStr.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              completionDateStr.isNotEmpty && isHistoryTab
                                  ? 'Ordered: $orderDateStr • Completed: $completionDateStr'
                                  : 'Order Date: $orderDateStr',
                              style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                // Future payment status badge if present
                if (order.paymentStatus != null && order.paymentStatus!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: (order.isPaid ? AppTheme.statusSuccess : AppTheme.accentOrange).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Payment: ${order.paymentStatus!.toUpperCase()}${order.paidAmount != null ? ' (₹${order.paidAmount!.toStringAsFixed(2)})' : ''}',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: order.isPaid ? AppTheme.statusSuccess : AppTheme.accentOrange,
                      ),
                    ),
                  ),
                ],
                const Divider(height: 20, color: AppTheme.borderSubtle),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        order.isPendingQuoteStage
                            ? 'Total: Rate Quote Pending'
                            : 'Total: ₹${order.totalAmount.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.textDark,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: order.isRateQuotedStage ? AppTheme.accentOrange : AppTheme.primaryNavy,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      onPressed: () => _navigateToOrderDetails(order),
                      child: Text(
                        order.isRateQuotedStage ? 'REVIEW RATES →' : 'VIEW PO DETAILS',
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
