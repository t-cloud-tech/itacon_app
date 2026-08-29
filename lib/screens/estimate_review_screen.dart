import 'package:flutter/material.dart';
import '../models/tile_order.dart';
import 'order_details_screen.dart';

/// Legacy screen wrapper redirecting directly to unified OrderDetailsScreen
class EstimateReviewScreen extends StatelessWidget {
  final TileOrder order;

  const EstimateReviewScreen({
    super.key,
    required this.order,
  });

  @override
  Widget build(BuildContext context) {
    return OrderDetailsScreen(
      orderId: order.id,
      initialOrder: order,
    );
  }
}
