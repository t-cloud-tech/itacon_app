import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import '../theme/app_theme.dart';
import '../constants/tile_categories.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';
import '../services/pricing_service.dart';
import '../utils/tile_dimension_helper.dart';
import '../widgets/product_filter_bottom_sheet.dart';
import 'product_detail_screen.dart';
import 'cart_screen.dart';

class ProductListingScreen extends StatefulWidget {
  final String subcategoryTitle;
  final String? initialSize;
  final String? initialSurface;

  const ProductListingScreen({
    super.key,
    this.subcategoryTitle = 'Products Collection',
    this.initialSize,
    this.initialSurface,
  });

  @override
  State<ProductListingScreen> createState() => _ProductListingScreenState();
}

class _ProductListingScreenState extends State<ProductListingScreen> {
  final AppStateService _appState = AppStateService();
  late ProductFilterCriteria _activeFilter;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  late final List<TileProduct> _allProducts;

  final List<String> _quickSizes = const [
    'All Sizes',
    '1200x1800 mm',
    '800x1600 mm',
    '600x1200 mm',
    '600x800 mm',
  ];

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text;
      });
    });

    _activeFilter = ProductFilterCriteria(
      selectedSize: widget.initialSize,
      selectedSurface: (widget.initialSurface != null && widget.initialSurface != 'All Surfaces')
          ? widget.initialSurface
          : null,
    );

    _allProducts = [
      // 1200x1800 mm Jumbo Grand Slabs (Ratio 0.667 / 2:3)
      TileProduct(
        id: 'PROD_1218_01',
        name: 'Golden Book Match Jumbo Slab',
        size: '1200x1800 mm',
        surface: 'Glossy',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Book Match',
        basePrice: 220.0,
        moq: 20,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Glossy',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 42.0,
        productType: 'Vitrified',
        tileCategory: 'Slab Tiles',
        collection: 'Book Match',
        spaces: ['Living Room'],
        shape: 'rectangle',
        aspectRatio: '0.667',
        aspectRatioValue: 0.667,
      ),
      TileProduct(
        id: 'PROD_1218_02',
        name: 'Statuario Grand Onyx Slab',
        size: '1200x1800 mm',
        surface: 'Semi High Gloss',
        color: 'White',
        baseColour: 'White',
        pattern: 'Gold Vein',
        basePrice: 240.0,
        moq: 15,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Semi High Gloss',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 42.0,
        productType: 'Vitrified',
        tileCategory: 'Slab Tiles',
        collection: 'Endless',
        spaces: ['Living Room'],
        shape: 'rectangle',
        aspectRatio: '0.667',
        aspectRatioValue: 0.667,
      ),

      // 800x1600 mm Large Luxury Slabs (Ratio 0.50 / 1:2)
      TileProduct(
        id: 'PROD_8016_01',
        name: 'Armani Bronze Luxury Slab',
        size: '800x1600 mm',
        surface: 'Glossy',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Bronze Marble',
        basePrice: 175.0,
        moq: 25,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Glossy',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 34.0,
        productType: 'Vitrified',
        tileCategory: 'Slab Tiles',
        collection: 'Marbles',
        spaces: ['Living Room', 'Bedroom'],
        shape: 'rectangle',
        aspectRatio: '0.5',
        aspectRatioValue: 0.5,
      ),
      TileProduct(
        id: 'PROD_8016_02',
        name: 'Pietra Grey Satin Slab',
        size: '800x1600 mm',
        surface: 'Satin Matt',
        color: 'Bianco - Grey',
        baseColour: 'Bianco - Grey',
        pattern: 'Pietra Vein',
        basePrice: 165.0,
        moq: 30,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Satin Matt',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 34.0,
        productType: 'Vitrified',
        tileCategory: 'Slab Tiles',
        collection: 'Endless',
        spaces: ['Living Room'],
        shape: 'rectangle',
        aspectRatio: '0.5',
        aspectRatioValue: 0.5,
      ),

      // 600x1200 mm Standard Vertical Slabs (Ratio 0.50 / 1:2)
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
        aspectRatioValue: 0.5,
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
        aspectRatioValue: 0.5,
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
        aspectRatioValue: 0.5,
      ),

      // 600x800 mm Medium Vertical Format (Ratio 0.75 / 3:4)
      TileProduct(
        id: 'PROD_6080_01',
        name: 'Carrara White Bath Vertical',
        size: '600x800 mm',
        surface: 'Glossy',
        color: 'White',
        baseColour: 'White',
        pattern: 'Fine Vein',
        basePrice: 88.0,
        moq: 40,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Glossy',
        thickness: '8.5 mm',
        thicknessMm: 8.5,
        boxWeightKg: 22.0,
        productType: 'Ceramic',
        tileCategory: 'Wall Tiles',
        collection: 'Moracan',
        spaces: ['Bath Room'],
        shape: 'rectangle',
        aspectRatio: '0.75',
        aspectRatioValue: 0.75,
      ),
      TileProduct(
        id: 'PROD_6080_02',
        name: 'Granito Grey Anti-Skid Floor',
        size: '600x800 mm',
        surface: 'Anti - Skid',
        color: 'Bianco - Grey',
        baseColour: 'Bianco - Grey',
        pattern: 'Textured Surface',
        basePrice: 92.0,
        moq: 50,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Anti - Skid',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 22.0,
        productType: 'Ceramic',
        tileCategory: 'Floor Tiles',
        collection: '3D',
        spaces: ['Outdoor', 'Bath Room'],
        shape: 'rectangle',
        aspectRatio: '0.75',
        aspectRatioValue: 0.75,
      ),
    ];
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<TileProduct> get _filteredProducts {
    return _allProducts.where((p) {
      if (_searchQuery.trim().isNotEmpty) {
        final query = _searchQuery.toLowerCase().trim();
        final matchName = p.name.toLowerCase().contains(query);
        final matchSize = p.size.toLowerCase().contains(query);
        final matchSurface = p.surface.toLowerCase().contains(query);
        final matchFinish = p.finish.toLowerCase().contains(query);
        final matchColor = p.color.toLowerCase().contains(query);
        final matchCollection = p.collection.toLowerCase().contains(query);
        final matchType = p.productType.toLowerCase().contains(query);
        if (!matchName &&
            !matchSize &&
            !matchSurface &&
            !matchFinish &&
            !matchColor &&
            !matchCollection &&
            !matchType) {
          return false;
        }
      }
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
    final currentSurfaceLabel = _activeFilter.selectedSurface ?? 'All Surfaces';
    final currentSizeLabel = _activeFilter.selectedSize ?? 'All Sizes';

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.subcategoryTitle),
        actions: [
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
          // 1. Live Search Bar Header Widget
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search tiles by name, size, surface, color...',
                hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.primaryNavy, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18, color: Colors.grey),
                        onPressed: () {
                          _searchController.clear();
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                filled: true,
                fillColor: const Color(0xFFF4F7FC),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppTheme.primaryNavy, width: 1.5),
                ),
              ),
            ),
          ),

          // 2. Surface Finish Filter Pill Tabs (Level 1 Hierarchical Drilling)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.only(bottom: 6),
            child: SizedBox(
              height: 34,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: TileCategoriesMatrix.surfaceFinishes.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final surface = TileCategoriesMatrix.surfaceFinishes[index];
                  final isSelected = (surface == 'All Surfaces' && _activeFilter.selectedSurface == null) ||
                      (_activeFilter.selectedSurface == surface);

                  return ChoiceChip(
                    label: Text(surface),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                        _activeFilter = _activeFilter.copyWith(
                          selectedSurface: surface == 'All Surfaces' ? null : surface,
                        );
                      });
                    },
                    selectedColor: AppTheme.primaryNavy,
                    backgroundColor: Colors.grey.shade100,
                    labelStyle: TextStyle(
                      fontSize: 11,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isSelected ? Colors.white : AppTheme.textDark,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(
                        color: isSelected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          // 3. Size Category Standard Matrix Chips (Level 2 Format Drilling)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.only(bottom: 10),
            child: SizedBox(
              height: 34,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: _quickSizes.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final sz = _quickSizes[index];
                  final isSelected = (sz == 'All Sizes' && _activeFilter.selectedSize == null) ||
                      (_activeFilter.selectedSize == sz);

                  return ChoiceChip(
                    label: Text(sz),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                        _activeFilter = _activeFilter.copyWith(
                          selectedSize: sz == 'All Sizes' ? null : sz,
                        );
                      });
                    },
                    selectedColor: AppTheme.accentOrange,
                    backgroundColor: Colors.grey.shade100,
                    labelStyle: TextStyle(
                      fontSize: 11,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isSelected ? Colors.white : AppTheme.textDark,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(
                        color: isSelected ? AppTheme.accentOrange : AppTheme.borderSubtle,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          // 4. Filter Summary & Count Header Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '$currentSurfaceLabel • $currentSizeLabel • ${filtered.length} Products',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryNavy,
                    ),
                    overflow: TextOverflow.ellipsis,
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
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          // 5. Staggered Masonry Grid View matching physical tile proportions!
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
                          'No Products Match Selection',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: () {
                            _searchController.clear();
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
                      final resolvedPrice =
                          PricingService.instance.resolvePrice(product);

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

                                  // Surface Finish Badge
                                  Positioned(
                                    top: 6,
                                    left: 6,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppTheme.primaryNavy
                                            .withValues(alpha: 0.85),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        product.surface,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                        ),
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
                                            .withValues(alpha: 0.7),
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

                              // Details Padding
                              Padding(
                                padding: const EdgeInsets.all(10),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      product.name,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textDark,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${product.productType} • ${product.finish}',
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: AppTheme.textSubtle,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          '₹${resolvedPrice.unitPrice.toStringAsFixed(0)} / sq.ft',
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: AppTheme.accentOrange,
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.accentOrange
                                                .withValues(alpha: 0.12),
                                            borderRadius:
                                                BorderRadius.circular(4),
                                          ),
                                          child: const Text(
                                            'MOQ 20+',
                                            style: TextStyle(
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                              color: AppTheme.accentOrange,
                                            ),
                                          ),
                                        ),
                                      ],
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
