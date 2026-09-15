import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../widgets/floating_bottom_bar.dart';
import 'product_listing_screen.dart';
import 'fixing_solutions_screen.dart';
import 'cart_screen.dart';

class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});

  final List<Map<String, dynamic>> _categories = const [
    {
      'title': 'Floor Tiles',
      'count': '42 Products',
      'isComingSoon': false,
      'image': 'assets/images/Home/Floor_tile.jpg',
    },
    {
      'title': 'Wall Tiles',
      'count': '38 Products',
      'isComingSoon': false,
      'image': 'assets/images/Home/Wall_tile.jpg',
    },
    {
      'title': 'Slab Tiles',
      'count': 'Coming Soon',
      'isComingSoon': true,
      'image': 'assets/images/Home/Slab_tile.jpg',
    },
    {
      'title': 'Heavy Duty Parkings',
      'count': 'Coming Soon',
      'isComingSoon': true,
      'image': 'assets/images/Home/Parking_tile.jpg',
    },
    {
      'title': 'Fixing Solutions',
      'subtitle': 'Tile & Stone Adhesives',
      'count': '6 Products',
      'isComingSoon': false,
      'image': 'assets/images/adhesives/ITA-LX-01.png',
      'categoryKey': 'CAT_ADHESIVES',
    },
    {
      'title': 'Marble Collection',
      'count': '29 Products',
      'isComingSoon': false,
      'image': 'assets/images/Home/Slab_tile.jpg',
    },
    {
      'title': 'Quartz Surfaces',
      'count': '24 Products',
      'isComingSoon': false,
      'image': 'assets/images/mockups/VIT-60120-8.50-GLO-MAR-WHIT-00-033_mockup.jpeg',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final appState = AppStateService();

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Categories'),
        actions: [
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
                        MaterialPageRoute(
                            builder: (_) => const CartScreen()),
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
          const SizedBox(width: 8),
        ],
      ),
      body: GridView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        itemCount: _categories.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.85,
          crossAxisSpacing: 14,
          mainAxisSpacing: 14,
        ),
        itemBuilder: (context, index) {
          final cat = _categories[index];
          final isComingSoon = cat['isComingSoon'] as bool;
          final title = cat['title'] as String;

          return GestureDetector(
            onTap: isComingSoon
                ? null
                : () {
                    if (cat['categoryKey'] == 'CAT_ADHESIVES' || title == 'Fixing Solutions') {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const FixingSolutionsScreen(),
                        ),
                      );
                    } else {
                      String? query;
                      if (title.contains('Marble')) query = 'Marble';
                      if (title.contains('Quartz')) query = 'Quartz';

                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ProductListingScreen(
                            subcategoryTitle: title,
                            initialSearchQuery: query,
                          ),
                        ),
                      );
                    }
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
                        (cat['image'] as String).startsWith('assets/')
                            ? Image.asset(
                                cat['image'] as String,
                                width: double.infinity,
                                height: double.infinity,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => Container(
                                  color: const Color(0xFF0E274D).withValues(alpha: 0.1),
                                  child: const Icon(Icons.grid_view_rounded,
                                      color: AppTheme.primaryNavy, size: 36),
                                ),
                              )
                            : Image.network(
                                cat['image'] as String,
                                width: double.infinity,
                                height: double.infinity,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => Container(
                                  color: const Color(0xFF0E274D).withValues(alpha: 0.1),
                                  child: const Icon(Icons.grid_view_rounded,
                                      color: AppTheme.primaryNavy, size: 36),
                                ),
                              ),
                        Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                Colors.black.withValues(alpha: 0.35),
                              ],
                            ),
                          ),
                        ),
                        if (isComingSoon)
                          Positioned(
                            top: 8,
                            right: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.accentOrange,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'Coming Soon',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: isComingSoon
                                ? AppTheme.textSubtle
                                : AppTheme.textDark,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              cat['count'] as String,
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppTheme.textSubtle,
                              ),
                            ),
                            if (!isComingSoon)
                              const Text(
                                'Explore →',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.accentOrange,
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
      bottomNavigationBar: const AppFloatingBottomBar(currentIndex: 1),
    );
  }
}
