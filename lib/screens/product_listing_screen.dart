import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import '../theme/app_theme.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';
import '../services/pricing_service.dart';
import '../utils/tile_dimension_helper.dart';
import '../widgets/product_filter_bottom_sheet.dart';
import 'product_detail_screen.dart';
import 'cart_screen.dart';

class ProductListingScreen extends StatefulWidget {
  final String subcategoryTitle;

  const ProductListingScreen({
    super.key,
    this.subcategoryTitle = 'Floor Tiles',
  });

  @override
  State<ProductListingScreen> createState() => _ProductListingScreenState();
}

class _ProductListingScreenState extends State<ProductListingScreen> {
  final AppStateService _appState = AppStateService();
  ProductFilterCriteria _activeFilter = ProductFilterCriteria();

  late final List<TileProduct> _allProducts;

  @override
  void initState() {
    super.initState();
    _allProducts = [
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
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Endless',
        spaces: ['Living Room', 'Bedroom'],
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
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Marbles',
        spaces: ['Living Room', 'Bath Room'],
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
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Terrazzo',
        spaces: ['Living Room', 'Outdoor'],
        shape: 'rectangle',
        aspectRatio: '0.5',
      ),
      TileProduct(
        id: 'PROD_6060_02',
        name: 'Moracan Blue Wall Decor',
        size: '600x600 mm',
        surface: 'Satin Matt',
        color: 'Bianco - Grey',
        baseColour: 'Bianco - Grey',
        pattern: 'Moracan Art',
        basePrice: 110.0,
        moq: 50,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Satin Matt',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Ceramic',
        tileCategory: 'Wall Tiles',
        collection: 'Moracan',
        spaces: ['Bath Room', 'Bedroom'],
        shape: 'square',
        aspectRatio: '1.0',
      ),
      TileProduct(
        id: 'PROD_1218_01',
        name: 'Golden Book Match Slab',
        size: '1200x1800 mm',
        surface: 'Semi High Gloss',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Book Match',
        basePrice: 220.0,
        moq: 20,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Semi High Gloss',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Vitrified',
        tileCategory: 'Slab Tiles',
        collection: 'Book Match',
        spaces: ['Living Room'],
        shape: 'rectangle',
        aspectRatio: '0.667',
      ),
      TileProduct(
        id: 'PROD_6012_03',
        name: 'Rustic Wood Plank Tile',
        size: '600x1200 mm',
        surface: 'Rustic Wood',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Wood Texture',
        basePrice: 105.0,
        moq: 40,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Rustic Wood',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Ceramic',
        tileCategory: 'Floor Tiles',
        collection: '3D',
        spaces: ['Outdoor', 'Bedroom'],
        shape: 'rectangle',
        aspectRatio: '0.5',
      ),
    ];
  }

  List<TileProduct> get _filteredProducts {
    return _allProducts.where((p) {
      if (_activeFilter.selectedSpace != null &&
          !p.spaces.contains(_activeFilter.selectedSpace)) {
        return false;
      }
      if (_activeFilter.selectedSurface != null &&
          p.surface != _activeFilter.selectedSurface) {
        return false;
      }
      if (_activeFilter.selectedBaseColour != null &&
          p.baseColour != _activeFilter.selectedBaseColour) {
        return false;
      }
      if (_activeFilter.selectedCollection != null &&
          p.collection != _activeFilter.selectedCollection) {
        return false;
      }
      if (_activeFilter.selectedProductType != null &&
          _activeFilter.selectedProductType != 'All' &&
          p.productType != _activeFilter.selectedProductType) {
        return false;
      }
      if (_activeFilter.selectedSize != null &&
          p.size != _activeFilter.selectedSize) {
        return false;
      }
      return true;
    }).toList();
  }

  void _openFilterBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProductFilterBottomSheet(
        initialFilter: _activeFilter,
        onApplyFilter: (newFilter) {
          setState(() {
            _activeFilter = newFilter;
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredProducts;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.subcategoryTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.search_rounded, color: AppTheme.primaryNavy),
            onPressed: () {},
          ),
          ListenableBuilder(
            listenable: _appState,
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
                  if (_appState.cartCount > 0)
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
                          '${_appState.cartCount}',
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
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Filter & Sort Header Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${filtered.length} Products Found',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textSubtle,
                  ),
                ),
                Row(
                  children: [
                    InkWell(
                      onTap: _openFilterBottomSheet,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: !_activeFilter.isEmpty
                              ? AppTheme.primaryNavy.withValues(alpha: 0.1)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.filter_list_rounded,
                              size: 18,
                              color: !_activeFilter.isEmpty
                                  ? AppTheme.accentOrange
                                  : AppTheme.primaryNavy,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              !_activeFilter.isEmpty ? 'Filter (Active)' : 'Filter',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: !_activeFilter.isEmpty
                                    ? AppTheme.accentOrange
                                    : AppTheme.primaryNavy,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    InkWell(
                      onTap: () {},
                      child: const Row(
                        children: [
                          Icon(Icons.swap_vert_rounded,
                              size: 18, color: AppTheme.primaryNavy),
                          SizedBox(width: 4),
                          Text(
                            'Sort',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          // Staggered Masonry Grid View matching physical tile proportions!
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.grid_off_rounded,
                            size: 64,
                            color: AppTheme.textLight.withValues(alpha: 0.5)),
                        const SizedBox(height: 12),
                        const Text(
                          'No Products Match Filters',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: () {
                            setState(() {
                              _activeFilter = ProductFilterCriteria();
                            });
                          },
                          child: const Text('Reset All Filters'),
                        ),
                      ],
                    ),
                  )
                : MasonryGridView.count(
                    padding: const EdgeInsets.all(14),
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final product = filtered[index];
                      final calculatedRatio =
                          TileDimensionHelper.calculateTileAspectRatio(
                              product.size);

                      return GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  ProductDetailScreen(product: product),
                            ),
                          );
                        },
                        child: Container(
                          decoration: AppTheme.luxuryCardDecoration,
                          clipBehavior: Clip.antiAlias,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Tile Image Thumbnail wrapped in AspectRatio matching physical proportions
                              Stack(
                                children: [
                                  AspectRatio(
                                    aspectRatio: calculatedRatio,
                                    child: Image.network(
                                      product.images.isNotEmpty
                                          ? product.images.first
                                          : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
                                      width: double.infinity,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(
                                        color: AppTheme.primaryNavy
                                            .withValues(alpha: 0.1),
                                        child: const Icon(
                                            Icons.terrain_rounded,
                                            color: AppTheme.primaryNavy,
                                            size: 36),
                                      ),
                                    ),
                                  ),

                                  // Watermark Size Badge over thumbnail corner
                                  Positioned(
                                    bottom: 6,
                                    left: 6,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.black
                                            .withValues(alpha: 0.65),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        product.size,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),

                                  // Favorite Heart Button
                                  Positioned(
                                    top: 6,
                                    right: 6,
                                    child: ListenableBuilder(
                                      listenable: _appState,
                                      builder: (context, _) {
                                        final isFav =
                                            _appState.isFavorite(product.id);
                                        return GestureDetector(
                                          onTap: () => _appState
                                              .toggleFavorite(product.id),
                                          child: CircleAvatar(
                                            radius: 14,
                                            backgroundColor: Colors.white
                                                .withValues(alpha: 0.9),
                                            child: Icon(
                                              isFav
                                                  ? Icons.favorite_rounded
                                                  : Icons
                                                      .favorite_outline_rounded,
                                              color: isFav
                                                  ? Colors.red
                                                  : AppTheme.primaryNavy,
                                              size: 16,
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ],
                              ),

                              // Details Section
                              Padding(
                                padding: const EdgeInsets.all(10),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      product.name,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textDark,
                                        height: 1.2,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${product.surface} • ${product.productType}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppTheme.textSubtle,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    ListenableBuilder(
                                      listenable: PricingService.instance,
                                      builder: (context, _) {
                                        final resolved = PricingService.instance.resolvePrice(product);

                                        return Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            if (resolved.hasDiscount) ...[
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: AppTheme.accentOrange,
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  resolved.discountBadgeLabel,
                                                  style: const TextStyle(
                                                    fontSize: 8,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.white,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                            ],
                                            Row(
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
                                                  '₹${resolved.unitPrice.toStringAsFixed(0)}',
                                                  style: const TextStyle(
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.w800,
                                                    color: AppTheme.accentOrange,
                                                  ),
                                                ),
                                                const Text(
                                                  ' / sq.ft',
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    color: AppTheme.textSubtle,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        );
                                      },
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
          ),
        ],
      ),
    );
  }
}
