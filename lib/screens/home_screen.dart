import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';
import '../models/product_enums.dart';
import 'categories_screen.dart';
import 'product_listing_screen.dart';
import 'product_detail_screen.dart';
import 'cart_screen.dart';
import '../widgets/app_navigation_drawer.dart';

class HomeScreen extends StatefulWidget {
  final Function(int)? onNavigateTab;

  const HomeScreen({
    super.key,
    this.onNavigateTab,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _searchController = TextEditingController();

  final List<_PopularChip> _popularChips = const [
    _PopularChip(
      label: 'Glossy',
      icon: Icons.auto_awesome_rounded,
      iconColor: AppTheme.accentOrange,
      surface: 'Glossy',
      query: 'Glossy',
    ),
    _PopularChip(
      label: 'Statuario Marble',
      icon: Icons.filter_hdr_rounded,
      iconColor: Colors.teal,
      query: 'Statuario',
    ),
    _PopularChip(
      label: '600x1200 mm',
      icon: Icons.aspect_ratio_rounded,
      iconColor: Colors.blue,
      size: '600x1200 mm',
      query: '600x1200',
    ),
    _PopularChip(
      label: 'Matt - Carving',
      icon: Icons.layers_rounded,
      iconColor: Colors.deepPurple,
      surface: 'Matt - Carving',
      query: 'Carving',
    ),
    _PopularChip(
      label: 'High Gloss',
      icon: Icons.flare_rounded,
      iconColor: Colors.amber,
      surface: 'High Gloss',
      query: 'High Gloss',
    ),
    _PopularChip(
      label: 'Book Match',
      icon: Icons.menu_book_rounded,
      iconColor: Colors.indigo,
      query: 'Book Match',
    ),
    _PopularChip(
      label: 'Rustic Wood',
      icon: Icons.forest_rounded,
      iconColor: Colors.brown,
      surface: 'Rustic Wood',
      query: 'Rustic Wood',
    ),
    _PopularChip(
      label: '600x600 mm',
      icon: Icons.crop_square_rounded,
      iconColor: Colors.cyan,
      size: '600x600 mm',
      query: '600x600',
    ),
    _PopularChip(
      label: 'Endless Tiles',
      icon: Icons.all_inclusive_rounded,
      iconColor: Colors.purple,
      query: 'Endless',
    ),
    _PopularChip(
      label: 'Anti-Skid',
      icon: Icons.shield_outlined,
      iconColor: Colors.green,
      surface: 'Anti - Skid',
      query: 'Anti - Skid',
    ),
    _PopularChip(
      label: 'Satin Matt',
      icon: Icons.texture_rounded,
      iconColor: Colors.orange,
      surface: 'Satin Matt',
      query: 'Satin Matt',
    ),
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _navigateToProductListing({
    String? query,
    String? surface,
    String? size,
    String? title,
  }) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ProductListingScreen(
          subcategoryTitle: title ??
              (query != null && query.isNotEmpty
                  ? 'Results for "$query"'
                  : 'All Products'),
          initialSearchQuery: query,
          initialSurface: surface,
          initialSize: size,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    final List<TileProduct> featuredProducts = [
      TileProduct(
        id: 'PROD_6012_01',
        name: 'Statuario Marble Vitrified',
        size: '600x1200 mm',
        surface: 'Glossy',
        color: 'Bianco - Grey',
        baseColour: 'Bianco - Grey',
        pattern: 'Marble Veining',
        basePrice: 120.0,
        moq: 50,
        stockStatus: 'available_now',
        images: [
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
        ],
        finish: 'Glossy',
        thickness: '9 mm',
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Endless',
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
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Marbles',
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
        productType: 'Vitrified',
        tileCategory: 'Floor Tiles',
        collection: 'Terrazzo',
        shape: 'rectangle',
        aspectRatio: '0.5',
      ),
    ];

    return Scaffold(
      drawer: AppNavigationDrawer(onSelectTab: widget.onNavigateTab),
      appBar: AppBar(
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu_rounded, color: AppTheme.primaryNavy),
            onPressed: () {
              Scaffold.of(context).openDrawer();
            },
          ),
        ),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primaryNavy,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.terrain_rounded,
                  color: AppTheme.accentOrange, size: 20),
            ),
            const SizedBox(width: 8),
            const Text(
              'ITACON GRANITO',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppTheme.primaryNavy,
                letterSpacing: 1.2,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded,
                color: AppTheme.primaryNavy),
            onPressed: () {},
          ),
          ListenableBuilder(
            listenable: appState,
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
                  if (appState.cartCount > 0)
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
                          '${appState.cartCount}',
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
          const SizedBox(width: 4),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dark Navy Hero Banner
            Container(
              width: double.infinity,
              height: 180,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                image: const DecorationImage(
                  image: NetworkImage(
                    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
                  ),
                  fit: BoxFit.cover,
                ),
              ),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: LinearGradient(
                    colors: [
                      AppTheme.primaryNavy.withValues(alpha: 0.95),
                      AppTheme.primaryNavy.withValues(alpha: 0.5),
                    ],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Strength. Elegance. Timeless.',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Premium Vitrified & Ceramic Surfaces Direct from Manufacturer',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accentOrange,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                      ),
                      onPressed: () {
                        if (widget.onNavigateTab != null) {
                          widget.onNavigateTab!(1);
                        } else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const ProductListingScreen()),
                          );
                        }
                      },
                      child: const Text(
                        'Explore Collection →',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Search Bar + Popular Material / Search Chips (Replaces Top Shortcut Row)
            _buildSearchAndPopularChips(context),
            const SizedBox(height: 26),

            // Shop by Category Section (Floor Tiles, Wall Tiles, Slab Tiles, Heavy Duty Parking)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Shop by Category',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    if (widget.onNavigateTab != null) {
                      widget.onNavigateTab!(1);
                    } else {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const CategoriesScreen()),
                      );
                    }
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Text(
                        'View All',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.accentOrange,
                        ),
                      ),
                      SizedBox(width: 2),
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 18,
                        color: AppTheme.accentOrange,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // 4 Category Cards Grid (2x2 styled layout)
            GridView.builder(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: ProductEnums.tileCategories.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.96,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemBuilder: (context, index) {
                final cat = ProductEnums.tileCategories[index];
                return _buildShopByCategoryCard(context, cat);
              },
            ),
            const SizedBox(height: 16),

            // Shop by Space Section (Living Room, Bath Room, Bedroom, Outdoor)
            const Text(
              'Shop by Space',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 14),

            // Horizontal Scrollable Space Cards
            SizedBox(
              height: 110,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: ProductEnums.spaces.length,
                itemBuilder: (context, index) {
                  final spaceName = ProductEnums.spaces[index];
                  return GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ProductListingScreen(
                            subcategoryTitle: '$spaceName Tiles',
                          ),
                        ),
                      );
                    },
                    child: Container(
                      width: 120,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: AppTheme.luxuryCardDecoration,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 10,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 48,
                            height: 48,
                            child: Image.asset(
                              _getSpaceImagePath(spaceName),
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stackTrace) =>
                                  Icon(
                                _getSpaceIcon(spaceName),
                                color: AppTheme.primaryNavy,
                                size: 36,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            spaceName,
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 28),

            // Featured Best Sellers Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Featured Collection',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const ProductListingScreen()),
                    );
                  },
                  child: const Text(
                    'View All →',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.accentOrange,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Featured Products Grid
            GridView.builder(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: featuredProducts.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.72,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemBuilder: (context, index) {
                final product = featuredProducts[index];
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
                    decoration: AppTheme.luxuryCardDecoration,
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Stack(
                            children: [
                              Image.network(
                                product.images.first,
                                width: double.infinity,
                                height: double.infinity,
                                fit: BoxFit.cover,
                              ),
                              Positioned(
                                top: 8,
                                right: 8,
                                child: ListenableBuilder(
                                  listenable: appState,
                                  builder: (context, _) {
                                    final isFav =
                                        appState.isFavorite(product.id);
                                    return CircleAvatar(
                                      radius: 14,
                                      backgroundColor:
                                          Colors.white.withValues(alpha: 0.9),
                                      child: Icon(
                                        isFav
                                            ? Icons.favorite_rounded
                                            : Icons.favorite_outline_rounded,
                                        color: isFav
                                            ? Colors.red
                                            : AppTheme.primaryNavy,
                                        size: 16,
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),
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
                                product.size,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.textSubtle,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '₹${product.basePrice.toStringAsFixed(0)} / sq.ft',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.accentOrange,
                                ),
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
          ],
        ),
      ),
    );
  }

  Widget _buildShopByCategoryCard(BuildContext context, Map<String, dynamic> cat) {
    final label = cat['label'] as String;
    final subtitle = (cat['subtitle'] as String?) ?? '';
    final imageUrl = cat['image'] as String? ?? '';
    final isComingSoon = cat['isComingSoon'] as bool? ?? false;

    return GestureDetector(
      onTap: isComingSoon
          ? null
          : () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ProductListingScreen(
                    subcategoryTitle: label,
                  ),
                ),
              );
            },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Lifestyle Background Image
            Positioned.fill(
              child: imageUrl.startsWith('assets/')
                  ? Image.asset(
                      imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => Container(
                        color: AppTheme.primaryNavy,
                        child: Center(
                          child: Icon(
                            Icons.terrain_rounded,
                            color: Colors.white.withValues(alpha: 0.3),
                            size: 32,
                          ),
                        ),
                      ),
                    )
                  : Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => Container(
                        color: AppTheme.primaryNavy,
                        child: Center(
                          child: Icon(
                            Icons.terrain_rounded,
                            color: Colors.white.withValues(alpha: 0.3),
                            size: 32,
                          ),
                        ),
                      ),
                    ),
            ),

            // Subtle Bottom Navy Gradient Scrim (Lightened so image stays clear)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0.35, 0.65, 1.0],
                    colors: [
                      Colors.transparent,
                      AppTheme.primaryNavy.withValues(alpha: 0.38),
                      AppTheme.primaryNavy.withValues(alpha: 0.82),
                    ],
                  ),
                ),
              ),
            ),

            // Top-Left Circular Dark Icon Badge
            Positioned(
              top: 10,
              left: 10,
              child: _buildCategoryBadge(cat),
            ),

            // Top-Right Coming Soon Tag (if applicable)
            if (isComingSoon)
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: AppTheme.accentOrange,
                    borderRadius: BorderRadius.circular(6),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.accentOrange.withValues(alpha: 0.35),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: const Text(
                    'Soon',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ),

            // Bottom Content: White Title, White Subtitle, and Orange Arrow
            Positioned(
              left: 10,
              right: 10,
              bottom: 10,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.2,
                      shadows: [
                        Shadow(
                          color: Colors.black54,
                          offset: Offset(0, 1),
                          blurRadius: 3,
                        ),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          subtitle,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: Colors.white.withValues(alpha: 0.92),
                            height: 1.2,
                            shadows: const [
                              Shadow(
                                color: Colors.black54,
                                offset: Offset(0, 1),
                                blurRadius: 3,
                              ),
                            ],
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.arrow_forward_rounded,
                        color: AppTheme.accentOrange,
                        size: 16,
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
  }

  Widget _buildCategoryBadge(Map<String, dynamic> cat) {
    final catId = cat['id'] as String;
    Widget child;
    if (catId == 'heavy_duty_parkings') {
      child = const Text(
        'P',
        style: TextStyle(
          color: Colors.white,
          fontSize: 15,
          fontWeight: FontWeight.w800,
        ),
      );
    } else if (catId == 'slab_tiles') {
      child = const Icon(
        Icons.crop_landscape_rounded,
        size: 17,
        color: Colors.white,
      );
    } else if (catId == 'wall_tiles') {
      child = const Icon(
        Icons.dashboard_customize_rounded,
        size: 17,
        color: Colors.white,
      );
    } else {
      child = const Icon(
        Icons.grid_view_rounded,
        size: 17,
        color: Colors.white,
      );
    }

    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: const Color(0xFF0E1A29),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Center(child: child),
    );
  }

  String _getSpaceImagePath(String spaceName) {
    switch (spaceName) {
      case 'Living Room':
        return 'assets/images/Home/Shop_by_space/Living_room.png';
      case 'Bath Room':
        return 'assets/images/Home/Shop_by_space/Bath_area.png';
      case 'Bedroom':
        return 'assets/images/Home/Shop_by_space/Bed.png';
      case 'Outdoor':
        return 'assets/images/Home/Shop_by_space/Outdoor.png';
      default:
        return 'assets/images/Home/Shop_by_space/Living_room.png';
    }
  }

  IconData _getSpaceIcon(String spaceName) {
    switch (spaceName) {
      case 'Living Room':
        return Icons.weekend_outlined;
      case 'Bath Room':
        return Icons.bathtub_outlined;
      case 'Bedroom':
        return Icons.bed_outlined;
      case 'Outdoor':
        return Icons.deck_outlined;
      default:
        return Icons.home_outlined;
    }
  }

  Widget _buildSearchAndPopularChips(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 1. Luxury Live Search Bar Container
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE5E9F0)),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryNavy.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          child: Row(
            children: [
              const SizedBox(width: 8),
              const Icon(
                Icons.search_rounded,
                color: AppTheme.primaryNavy,
                size: 22,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _searchController,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (query) {
                    if (query.trim().isNotEmpty) {
                      _navigateToProductListing(query: query.trim());
                    }
                  },
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: AppTheme.textDark,
                    fontWeight: FontWeight.w500,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Search tiles, marble, size, finishes...',
                    hintStyle: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade400,
                      fontWeight: FontWeight.w400,
                    ),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: _searchController,
                builder: (context, value, _) {
                  if (value.text.isNotEmpty) {
                    return IconButton(
                      icon: const Icon(Icons.close_rounded,
                          size: 18, color: AppTheme.textSubtle),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () {
                        _searchController.clear();
                      },
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () {
                  final text = _searchController.text.trim();
                  _navigateToProductListing(
                    query: text.isNotEmpty ? text : null,
                  );
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryNavy,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primaryNavy.withValues(alpha: 0.2),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Search',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.2,
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(
                        Icons.arrow_forward_rounded,
                        color: AppTheme.accentOrange,
                        size: 14,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // 2. Popular Searches / Trending Materials Section Header
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppTheme.accentOrange.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Icon(
                Icons.local_fire_department_rounded,
                color: AppTheme.accentOrange,
                size: 14,
              ),
            ),
            const SizedBox(width: 6),
            const Text(
              'Popular Searches & Materials',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppTheme.textSubtle,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),

        const SizedBox(height: 8),

        // 3. Horizontal Scrollable Popular Material & Search Chips
        SizedBox(
          height: 34,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _popularChips.length,
            separatorBuilder: (context, index) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final chip = _popularChips[index];
              return InkWell(
                onTap: () {
                  _navigateToProductListing(
                    query: chip.query,
                    surface: chip.surface,
                    size: chip.size,
                    title: chip.label,
                  );
                },
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xFFE2E8F0),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 3,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        chip.icon,
                        size: 13,
                        color: chip.iconColor,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        chip.label,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textDark,
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
    );
  }
}

class _PopularChip {
  final String label;
  final IconData icon;
  final Color iconColor;
  final String? query;
  final String? surface;
  final String? size;

  const _PopularChip({
    required this.label,
    required this.icon,
    required this.iconColor,
    this.query,
    this.surface,
    this.size,
  });
}
