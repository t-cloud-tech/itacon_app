import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';
import '../services/pricing_service.dart';
import '../utils/tile_dimension_helper.dart';
import 'cart_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final TileProduct? product;

  const ProductDetailScreen({
    super.key,
    this.product,
  });

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final AppStateService _appState = AppStateService();
  final PageController _pageController = PageController();

  late final TileProduct _product;
  int _currentImageIndex = 0;
  String _selectedSize = '600x1200 mm';
  String _selectedFinish = 'Glossy';
  int _quantity = 1;

  final List<String> _sizes = const ['600x1200 mm', '600x600 mm'];
  final List<String> _finishes = const [
    'Glossy',
    'Satin Matt',
    'Matt - Carving',
    'Rustic Wood',
    'Semi High Gloss',
    'High Gloss',
    'Anti - Skid'
  ];

  @override
  void initState() {
    super.initState();
    _product = widget.product ??
        TileProduct(
          id: 'PROD_DETAIL_01',
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
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
          ],
          finish: 'Glossy',
          thickness: '9 mm',
          thicknessMm: 9.0,
          boxWeightKg: 28.0,
          productType: 'Vitrified',
          tileCategory: 'Floor Tiles',
          collection: 'Endless',
          spaces: ['Living Room', 'Bedroom'],
          shape: 'rectangle',
          aspectRatio: '0.5',
        );

    _selectedSize = _product.size;
    _selectedFinish = _product.surface;
  }

  Color _getColorForBaseName(String colorName) {
    switch (colorName) {
      case 'White':
        return Colors.white;
      case 'Beige - Brown':
        return const Color(0xFFD7CCC8);
      case 'Bianco - Grey':
        return const Color(0xFFCFD8DC);
      case 'Nero':
      case 'Black':
        return Colors.black;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Dynamic physical dimension scaling based on tile ratio
    final ratio = TileDimensionHelper.calculateTileAspectRatio(_selectedSize);
    final screenWidth = MediaQuery.of(context).size.width;
    // Scaled frame height matching physical proportions
    final calculatedFrameHeight = (screenWidth / ratio).clamp(240.0, 420.0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Product Details'),
        actions: [
          ListenableBuilder(
            listenable: _appState,
            builder: (context, _) {
              final isFav = _appState.isFavorite(_product.id);
              return IconButton(
                icon: Icon(
                  isFav ? Icons.favorite_rounded : Icons.favorite_outline_rounded,
                  color: isFav ? Colors.red : AppTheme.primaryNavy,
                ),
                onPressed: () => _appState.toggleFavorite(_product.id),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined, color: AppTheme.primaryNavy),
            onPressed: () {},
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dynamic Proportional Frame Container
            Stack(
              alignment: Alignment.bottomCenter,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  height: calculatedFrameHeight,
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: _product.images.isNotEmpty
                        ? _product.images.length
                        : 1,
                    onPageChanged: (idx) {
                      setState(() => _currentImageIndex = idx);
                    },
                    itemBuilder: (context, index) {
                      final img = _product.images.isNotEmpty
                          ? _product.images[index]
                          : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';
                      return Image.network(
                        img,
                        width: double.infinity,
                        height: calculatedFrameHeight,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                          child: const Icon(Icons.terrain_rounded,
                              size: 64, color: AppTheme.primaryNavy),
                        ),
                      );
                    },
                  ),
                ),

                // Size Watermark Badge over image corner
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryNavy.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.2),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.aspect_ratio_rounded,
                            color: AppTheme.accentOrange, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          TileDimensionHelper.getFormattedWatermark(
                              _selectedSize,
                              category: _product.tileCategory),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Pagination Dots Indicator
                Positioned(
                  bottom: 12,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _product.images.isNotEmpty ? _product.images.length : 1,
                      (index) => Container(
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: _currentImageIndex == index ? 18 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: _currentImageIndex == index
                              ? AppTheme.accentOrange
                              : Colors.white.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Resolved Price & Partner Badge Tag
                  ListenableBuilder(
                    listenable: PricingService.instance,
                    builder: (context, _) {
                      final resolved = PricingService.instance.resolvePrice(_product);
                      final sqFtPerBox = _product.sqFtPerBox > 0 ? _product.sqFtPerBox : 15.5;
                      final boxCost = resolved.unitPrice * sqFtPerBox;
                      final totalArea = _quantity * sqFtPerBox;
                      final totalCost = _quantity * boxCost;

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _product.name,
                                      style: const TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textDark,
                                      ),
                                    ),
                                    if (resolved.hasDiscount) ...[
                                      const SizedBox(height: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppTheme.accentOrange,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          resolved.discountBadgeLabel.toUpperCase(),
                                          style: const TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800,
                                            color: Colors.white,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  if (resolved.hasDiscount)
                                    Text(
                                      '₹${resolved.basePrice.toStringAsFixed(0)} / sq.ft',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Colors.grey,
                                        decoration: TextDecoration.lineThrough,
                                      ),
                                    ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: AppTheme.accentOrange.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '₹${resolved.unitPrice.toStringAsFixed(0)} / sq.ft',
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w800,
                                        color: AppTheme.accentOrange,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          // Dynamic Box Cost & Area Coverage Card
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppTheme.backgroundColor,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppTheme.borderSubtle),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Cost Per Box',
                                      style: TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                                    ),
                                    Text(
                                      '₹${boxCost.toStringAsFixed(0)} / Box',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.primaryNavy,
                                      ),
                                    ),
                                    Text(
                                      '(${sqFtPerBox} sq.ft / Box)',
                                      style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                                    ),
                                  ],
                                ),
                                Container(width: 1, height: 32, color: AppTheme.borderSubtle),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      'Est. Coverage (${_quantity} Boxes)',
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                                    ),
                                    Text(
                                      '${totalArea.toStringAsFixed(1)} sq.ft',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.accentOrange,
                                      ),
                                    ),
                                    Text(
                                      'Total: ₹${totalCost.toStringAsFixed(0)}',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.textDark),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 16),

                  // Master Specification Table
                  const Text(
                    'Technical Specifications',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    decoration: AppTheme.luxuryCardDecorationWithBorder(),
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        _buildSpecRow(
                            'Type', _product.productType, Icons.layers_outlined),
                        const Divider(height: 16, color: AppTheme.borderSubtle),
                        _buildSpecRow('Thickness', '${_product.thicknessMm} mm (Approx)',
                            Icons.straighten_outlined),
                        const Divider(height: 16, color: AppTheme.borderSubtle),
                        _buildSpecRow('Box Weight', '~${_product.boxWeightKg} kg / Box',
                            Icons.scale_outlined),
                        const Divider(height: 16, color: AppTheme.borderSubtle),
                        _buildColorSpecRow('Base Colour', _product.baseColour),
                        const Divider(height: 16, color: AppTheme.borderSubtle),
                        _buildSpecRow(
                            'Collection', _product.collection, Icons.collections_bookmark_outlined),
                        const Divider(height: 16, color: AppTheme.borderSubtle),
                        _buildSpecRow('Packaging',
                            '${_product.pcsPerBox} Pcs / Box (${_product.sqFtPerBox} sq.ft)',
                            Icons.all_inbox_outlined),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Select Size Chips
                  const Text(
                    'Select Size',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: _sizes.map((sz) {
                      final selected = _selectedSize == sz;
                      return ChoiceChip(
                        label: Text(sz),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight:
                              selected ? FontWeight.bold : FontWeight.w500,
                        ),
                        onSelected: (val) {
                          if (val) setState(() => _selectedSize = sz);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Select Surface Finish Chips
                  const Text(
                    'Select Surface Finish',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _finishes.map((finish) {
                      final selected = _selectedFinish == finish;
                      return ChoiceChip(
                        label: Text(finish),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight:
                              selected ? FontWeight.bold : FontWeight.w500,
                        ),
                        onSelected: (val) {
                          if (val) setState(() => _selectedFinish = finish);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),

                  // Trust Badges Row
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: AppTheme.luxuryCardDecorationWithBorder(),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildTrustBadge(
                            Icons.verified_rounded, '100% Original'),
                        _buildTrustBadge(
                            Icons.high_quality_rounded, 'Quality Assured'),
                        _buildTrustBadge(
                            Icons.local_shipping_rounded, 'Secure Package'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            ),
          ],
        ),
      ),

      // Bottom Action Bar
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Row(
            children: [
              // Quantity Controller
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove, size: 18),
                      onPressed: _quantity > 1
                          ? () => setState(() => _quantity--)
                          : null,
                    ),
                    Text(
                      '$_quantity',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add, size: 18),
                      onPressed: () => setState(() => _quantity++),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),

              // Add to Cart Button
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.shopping_bag_outlined,
                      color: Colors.white),
                  label: const Text('Add to Cart'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () {
                    _appState.addToCart(
                      _product,
                      size: _selectedSize,
                      finish: _selectedFinish,
                      quantity: _quantity,
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${_product.name} added to cart!'),
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
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSpecRow(String label, String value, IconData icon) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: AppTheme.primaryNavy),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(color: AppTheme.textSubtle, fontSize: 13)),
          ],
        ),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: AppTheme.textDark,
            fontSize: 13,
          ),
        ),
      ],
    );
  }

  Widget _buildColorSpecRow(String label, String colorName) {
    final dotColor = _getColorForBaseName(colorName);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Row(
          children: [
            Icon(Icons.palette_outlined, size: 18, color: AppTheme.primaryNavy),
            SizedBox(width: 8),
            Text('Base Colour', style: TextStyle(color: AppTheme.textSubtle, fontSize: 13)),
          ],
        ),
        Row(
          children: [
            Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.grey.shade400, width: 1),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              colorName,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTrustBadge(IconData icon, String text) {
    return Column(
      children: [
        Icon(icon, color: AppTheme.accentOrange, size: 24),
        const SizedBox(height: 4),
        Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppTheme.textDark,
          ),
        ),
      ],
    );
  }
}
