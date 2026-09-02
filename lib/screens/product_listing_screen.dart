import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import '../theme/app_theme.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';
import '../services/pricing_service.dart';
import '../utils/tile_dimension_helper.dart';
import '../utils/app_notification_utils.dart';
import '../widgets/product_filter_bottom_sheet.dart';
import '../widgets/floating_bottom_bar.dart';
import 'product_detail_screen.dart';
import 'cart_screen.dart';

class ProductListingScreen extends StatefulWidget {
  final String subcategoryTitle;
  final String? initialSize;
  final String? initialSurface;
  final String? initialSearchQuery;
  final bool showBottomNavBar;

  const ProductListingScreen({
    super.key,
    this.subcategoryTitle = 'Products Collection',
    this.initialSize,
    this.initialSurface,
    this.initialSearchQuery,
    this.showBottomNavBar = true,
  });

  @override
  State<ProductListingScreen> createState() => _ProductListingScreenState();
}

class _ProductListingScreenState extends State<ProductListingScreen> {
  final AppStateService _appState = AppStateService();
  late ProductFilterCriteria _activeFilter;
  late final TextEditingController _searchController;
  late final ScrollController _scrollController;
  
  String _searchQuery = '';
  String _sortOption = 'default'; // 'default', 'price_asc', 'price_desc', 'name_asc'

  late final List<TileProduct> _allProducts;

  @override
  void initState() {
    super.initState();
    _searchQuery = widget.initialSearchQuery ?? '';
    _searchController = TextEditingController(text: _searchQuery);
    _scrollController = ScrollController();

    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text;
      });
    });

    final initialSurfaces = <String>{};
    if (widget.initialSurface != null &&
        widget.initialSurface!.isNotEmpty &&
        widget.initialSurface != 'All Surfaces') {
      initialSurfaces.add(widget.initialSurface!);
    }

    final initialSizes = <String>{};
    if (widget.initialSize != null && widget.initialSize!.isNotEmpty) {
      initialSizes.add(widget.initialSize!);
    }

    _activeFilter = ProductFilterCriteria(
      selectedSurfaces: initialSurfaces,
      selectedSizes: initialSizes,
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
        name: 'Statuario Inky Colors Grand Slab',
        size: '1200x1800 mm',
        surface: 'Inky Colors',
        color: 'White',
        baseColour: 'White',
        pattern: 'Gold Vein',
        basePrice: 240.0,
        moq: 15,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Inky Colors',
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
      TileProduct(
        id: 'PROD_1218_03',
        name: 'Onyx Pastel Rose Grand Slab',
        size: '1200x1800 mm',
        surface: 'Pastel Colors',
        color: 'White',
        baseColour: 'White',
        pattern: 'Onyx Soft',
        basePrice: 250.0,
        moq: 15,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Pastel Colors',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 42.0,
        productType: 'Vitrified',
        tileCategory: 'Slab Tiles',
        collection: 'Golden',
        spaces: ['Living Room', 'Bedroom'],
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
      TileProduct(
        id: 'PROD_8016_03',
        name: 'Carrara Sugar Lapato Luxury',
        size: '800x1600 mm',
        surface: 'Sugar Lapato',
        color: 'White',
        baseColour: 'White',
        pattern: 'Sugar Sparkle',
        basePrice: 185.0,
        moq: 20,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Sugar Lapato',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 34.0,
        productType: 'Vitrified',
        tileCategory: 'Slab Tiles',
        collection: 'Marbles',
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
        pattern: 'Marble',
        basePrice: 145.0,
        moq: 30,
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
        collection: 'Marbles',
        spaces: ['Living Room', 'Bath Room'],
        shape: 'rectangle',
        aspectRatio: '0.5',
        aspectRatioValue: 0.5,
      ),
      TileProduct(
        id: 'PROD_6012_02',
        name: 'Onyx Crystal Carving',
        size: '600x1200 mm',
        surface: 'Matt - Carving',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Carving Vein',
        basePrice: 155.0,
        moq: 30,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Matt - Carving',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Golden',
        spaces: ['Living Room'],
        shape: 'rectangle',
        aspectRatio: '0.5',
        aspectRatioValue: 0.5,
      ),
      TileProduct(
        id: 'PROD_6012_03',
        name: 'Royal Botticino High Gloss',
        size: '600x1200 mm',
        surface: 'High Gloss',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Classic Italian',
        basePrice: 150.0,
        moq: 30,
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
        collection: 'Endless',
        spaces: ['Living Room', 'Bedroom'],
        shape: 'rectangle',
        aspectRatio: '0.5',
        aspectRatioValue: 0.5,
      ),
      TileProduct(
        id: 'PROD_6012_04',
        name: 'Nordic Wood Rustic Planks',
        size: '600x1200 mm',
        surface: 'Rustic Wood',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Timber Grain',
        basePrice: 140.0,
        moq: 40,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Rustic Wood',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: '3D',
        spaces: ['Outdoor', 'Bedroom'],
        shape: 'rectangle',
        aspectRatio: '0.5',
        aspectRatioValue: 0.5,
      ),
      TileProduct(
        id: 'PROD_6012_05',
        name: 'Concrete Texture Matt Punch',
        size: '600x1200 mm',
        surface: 'Matt Punch',
        color: 'Bianco - Grey',
        baseColour: 'Bianco - Grey',
        pattern: 'Industrial Concrete',
        basePrice: 148.0,
        moq: 35,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Matt Punch',
        thickness: '9 mm',
        thicknessMm: 9.0,
        boxWeightKg: 28.0,
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: '3D',
        spaces: ['Living Room', 'Outdoor'],
        shape: 'rectangle',
        aspectRatio: '0.5',
        aspectRatioValue: 0.5,
      ),

      // 600x600 mm Square Formats (Ratio 1.0 / 1:1)
      TileProduct(
        id: 'PROD_6060_01',
        name: 'Breccia Beige Vitrified',
        size: '600x600 mm',
        surface: 'Glossy',
        color: 'Beige - Brown',
        baseColour: 'Beige - Brown',
        pattern: 'Breccia',
        basePrice: 95.0,
        moq: 50,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Glossy',
        thickness: '8.5 mm',
        thicknessMm: 8.5,
        boxWeightKg: 26.0,
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Marbles',
        spaces: ['Living Room', 'Bath Room'],
        shape: 'square',
        aspectRatio: '1.0',
        aspectRatioValue: 1.0,
      ),
      TileProduct(
        id: 'PROD_6060_02',
        name: 'Granite Grey Anti-Skid',
        size: '600x600 mm',
        surface: 'Anti - Skid',
        color: 'Bianco - Grey',
        baseColour: 'Bianco - Grey',
        pattern: 'Grip Texture',
        basePrice: 88.0,
        moq: 50,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Anti - Skid',
        thickness: '8.5 mm',
        thicknessMm: 8.5,
        boxWeightKg: 26.0,
        productType: 'Ceramic',
        tileCategory: 'Floor Tiles',
        collection: '3D',
        spaces: ['Bath Room', 'Outdoor'],
        shape: 'square',
        aspectRatio: '1.0',
        aspectRatioValue: 1.0,
      ),
      TileProduct(
        id: 'PROD_6060_03',
        name: 'Pearl Grey Sugar Lapato',
        size: '600x600 mm',
        surface: 'Sugar Lapato',
        color: 'Bianco - Grey',
        baseColour: 'Bianco - Grey',
        pattern: 'Sugar Sparkle',
        basePrice: 110.0,
        moq: 40,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Sugar Lapato',
        thickness: '8.5 mm',
        thicknessMm: 8.5,
        boxWeightKg: 26.0,
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Endless',
        spaces: ['Living Room', 'Bedroom'],
        shape: 'square',
        aspectRatio: '1.0',
        aspectRatioValue: 1.0,
      ),

      // 600x800 mm Medium Vertical Format (Ratio 0.75 / 3:4)
      TileProduct(
        id: 'PROD_6080_01',
        name: 'Venato White Matt Punch',
        size: '600x800 mm',
        surface: 'Matt Punch',
        color: 'White',
        baseColour: 'White',
        pattern: 'Venato Vein',
        basePrice: 125.0,
        moq: 40,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Matt Punch',
        thickness: '8.8 mm',
        thicknessMm: 8.8,
        boxWeightKg: 27.0,
        productType: 'Vitrified',
        tileCategory: 'Wall Tiles',
        collection: 'Wall Decore',
        spaces: ['Bath Room'],
        shape: 'rectangle',
        aspectRatio: '0.75',
        aspectRatioValue: 0.75,
      ),
    ];
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  List<TileProduct> get _filteredProducts {
    var filtered = _allProducts.where((p) {
      // 1. Live Search
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
      // 2. Spaces Multi-Select
      if (_activeFilter.selectedSpaces.isNotEmpty &&
          !p.spaces.any((sp) => _activeFilter.selectedSpaces.contains(sp))) {
        return false;
      }
      // 3. Surfaces Multi-Select
      if (_activeFilter.selectedSurfaces.isNotEmpty &&
          !_activeFilter.selectedSurfaces.contains(p.surface) &&
          !_activeFilter.selectedSurfaces.contains(p.finish)) {
        return false;
      }
      // 4. Base Colours Multi-Select
      if (_activeFilter.selectedBaseColours.isNotEmpty &&
          !_activeFilter.selectedBaseColours.contains(p.baseColour) &&
          !_activeFilter.selectedBaseColours.contains(p.color)) {
        return false;
      }
      // 5. Collections Multi-Select
      if (_activeFilter.selectedCollections.isNotEmpty &&
          !_activeFilter.selectedCollections.contains(p.collection)) {
        return false;
      }
      // 6. Product Type Segment
      if (_activeFilter.selectedProductType != 'All' &&
          _activeFilter.selectedProductType.isNotEmpty &&
          p.productType != _activeFilter.selectedProductType) {
        return false;
      }
      // 7. Sizes Multi-Select
      if (_activeFilter.selectedSizes.isNotEmpty &&
          !_activeFilter.selectedSizes.contains(p.size)) {
        return false;
      }
      return true;
    }).toList();

    // Apply Sorting
    if (_sortOption == 'price_asc') {
      filtered.sort((a, b) => a.basePrice.compareTo(b.basePrice));
    } else if (_sortOption == 'price_desc') {
      filtered.sort((a, b) => b.basePrice.compareTo(a.basePrice));
    } else if (_sortOption == 'name_asc') {
      filtered.sort((a, b) => a.name.compareTo(b.name));
    }

    return filtered;
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

  void _showSortMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16.0),
                child: Text(
                  'Sort Products',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
              ),
              const Divider(height: 1),
              _buildSortOptionTile('Default (Recommended)', 'default'),
              _buildSortOptionTile('Price: Low to High', 'price_asc'),
              _buildSortOptionTile('Price: High to Low', 'price_desc'),
              _buildSortOptionTile('Product Name: A to Z', 'name_asc'),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSortOptionTile(String label, String value) {
    final isSelected = _sortOption == value;
    return ListTile(
      title: Text(
        label,
        style: TextStyle(
          fontSize: 14,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? AppTheme.accentOrange : AppTheme.textDark,
        ),
      ),
      trailing: isSelected
          ? const Icon(Icons.check_circle_rounded, color: AppTheme.accentOrange, size: 20)
          : null,
      onTap: () {
        setState(() => _sortOption = value);
        Navigator.pop(context);
      },
    );
  }

  void _clearAllFilters() {
    setState(() {
      _activeFilter = ProductFilterCriteria();
      _searchController.clear();
      _sortOption = 'default';
    });
  }

  void _toggleSizeFilter(String sz) {
    setState(() {
      final updatedSizes = Set<String>.from(_activeFilter.selectedSizes);
      if (updatedSizes.contains(sz)) {
        updatedSizes.remove(sz);
      } else {
        updatedSizes.add(sz);
      }
      _activeFilter = _activeFilter.copyWith(selectedSizes: updatedSizes);
    });
  }

  void _toggleSurfaceFilter(String surf) {
    setState(() {
      final updatedSurfaces = Set<String>.from(_activeFilter.selectedSurfaces);
      if (surf == 'All Surfaces') {
        updatedSurfaces.clear();
      } else {
        if (updatedSurfaces.contains(surf)) {
          updatedSurfaces.remove(surf);
        } else {
          updatedSurfaces.add(surf);
        }
      }
      _activeFilter = _activeFilter.copyWith(selectedSurfaces: updatedSurfaces);
    });
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredProducts;
    final hasActiveFilters = !_activeFilter.isEmpty || _searchQuery.isNotEmpty;
    final activeCount = _activeFilter.activeFilterCount;

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
                    icon: const Icon(Icons.shopping_bag_outlined, color: AppTheme.primaryNavy),
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
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
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

          const Divider(height: 1, color: AppTheme.borderSubtle),

          // 3. Pinned Lightweight Control Line (44px)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.white,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Left: Count + Active Filter summary pills
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        Text(
                          '${filtered.length} Tiles Found',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryNavy,
                          ),
                        ),
                        if (_activeFilter.selectedSurfaces.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          ..._activeFilter.selectedSurfaces.map(
                            (surf) => Padding(
                              padding: const EdgeInsets.only(right: 4),
                              child: Chip(
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                padding: EdgeInsets.zero,
                                labelPadding: const EdgeInsets.only(left: 8, right: 2),
                                label: Text(surf, style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
                                backgroundColor: AppTheme.primaryNavy,
                                deleteIcon: const Icon(Icons.cancel_rounded, size: 14, color: Colors.white),
                                onDeleted: () => _toggleSurfaceFilter(surf),
                              ),
                            ),
                          ),
                        ],
                        if (_activeFilter.selectedSizes.isNotEmpty) ...[
                          const SizedBox(width: 4),
                          ..._activeFilter.selectedSizes.map(
                            (sz) => Padding(
                              padding: const EdgeInsets.only(right: 4),
                              child: Chip(
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                padding: EdgeInsets.zero,
                                labelPadding: const EdgeInsets.only(left: 8, right: 2),
                                label: Text(sz, style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
                                backgroundColor: AppTheme.accentOrange,
                                deleteIcon: const Icon(Icons.cancel_rounded, size: 14, color: Colors.white),
                                onDeleted: () => _toggleSizeFilter(sz),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),

                // Right: Clear All (if active) + Sort + Filter Trigger
                Row(
                  children: [
                    if (hasActiveFilters)
                      InkWell(
                        onTap: _clearAllFilters,
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                          child: Text(
                            'Clear All',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.accentOrange,
                            ),
                          ),
                        ),
                      ),
                    IconButton(
                      icon: const Icon(Icons.swap_vert_rounded, color: AppTheme.primaryNavy, size: 20),
                      tooltip: 'Sort Products',
                      onPressed: _showSortMenu,
                    ),
                    InkWell(
                      onTap: _openFilterBottomSheet,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: activeCount > 0
                              ? AppTheme.primaryNavy.withValues(alpha: 0.1)
                              : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: activeCount > 0 ? AppTheme.primaryNavy : AppTheme.borderSubtle,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.tune_rounded,
                              size: 16,
                              color: activeCount > 0 ? AppTheme.primaryNavy : AppTheme.textSubtle,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              activeCount > 0 ? 'Filter ($activeCount)' : 'Filter',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: activeCount > 0 ? AppTheme.primaryNavy : AppTheme.textDark,
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

          // 4. Staggered Masonry Grid View matching physical tile proportions
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.style_outlined,
                              size: 64, color: Colors.grey.shade300),
                          const SizedBox(height: 16),
                          Text(
                            'No tiles matching selected criteria',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey.shade700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Try resetting your multi-select surface or size filters.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: AppTheme.textSubtle),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryNavy,
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                            ),
                            onPressed: _clearAllFilters,
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: const Text('Reset All Filters'),
                          ),
                        ],
                      ),
                    ),
                  )
                : MasonryGridView.count(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                    crossAxisCount: 2,
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 16,
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final product = filtered[index];
                      final calculatedAspectRatio = TileDimensionHelper.calculateTileAspectRatio(product.size);

                      return _buildLuxuryTileCard(context, product, calculatedAspectRatio);
                    },
                  ),
          ),
        ],
      ),
      bottomNavigationBar: widget.showBottomNavBar
          ? const AppFloatingBottomBar(currentIndex: 1)
          : null,
    );
  }

  Widget _buildLuxuryTileCard(BuildContext context, TileProduct product, double aspectRatio) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ProductDetailScreen(product: product),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderSubtle.withValues(alpha: 0.8)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dynamic Aspect-Ratio Responsive Tile Showcase Image
            AspectRatio(
              aspectRatio: aspectRatio,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Image.network(
                      product.images.isNotEmpty ? product.images.first : '',
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        color: Colors.grey.shade100,
                        child: const Icon(Icons.dashboard, color: Colors.grey, size: 36),
                      ),
                    ),
                  ),

                  // Surface Finish Badge
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryNavy.withValues(alpha: 0.88),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        product.surface,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),

                  // Quick Favorite Button
                  Positioned(
                    top: 6,
                    right: 6,
                    child: ListenableBuilder(
                      listenable: _appState,
                      builder: (context, _) {
                        final isFav = _appState.isFavorite(product.id);
                        return InkWell(
                          onTap: () => _appState.toggleFavorite(product),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.9),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                              color: isFav ? Colors.red : AppTheme.textSubtle,
                              size: 16,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),

            // Product Details Block
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.straighten_rounded, size: 12, color: AppTheme.textSubtle),
                      const SizedBox(width: 4),
                      Text(
                        product.size,
                        style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Pricing & Add Button
                  ListenableBuilder(
                    listenable: _appState,
                    builder: (context, _) {
                      final effectivePrice = PricingService.getEffectivePrice(
                        basePrice: product.basePrice,
                        size: product.size,
                        surface: product.surface,
                        userProfile: _appState.currentUserProfile,
                      );
                      final hasDiscount = effectivePrice < product.basePrice;

                      return Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '₹${effectivePrice.toStringAsFixed(0)}/sq.ft',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.accentOrange,
                                ),
                              ),
                              if (hasDiscount)
                                Text(
                                  'MRP ₹${product.basePrice.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey,
                                    decoration: TextDecoration.lineThrough,
                                  ),
                                ),
                            ],
                          ),
                          InkWell(
                            onTap: () {
                              _appState.addToCart(
                                product,
                                size: product.size,
                                finish: product.surface,
                                quantity: 10,
                              );
                              AppNotificationUtils.showAddToCartSnackBar(
                                context,
                                productName: product.name,
                              );
                            },
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryNavy,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(
                                Icons.add_shopping_cart_rounded,
                                color: Colors.white,
                                size: 16,
                              ),
                            ),
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
  }
}
