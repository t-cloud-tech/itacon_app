import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../constants/tile_categories.dart';
import '../services/app_state_service.dart';
import 'product_listing_screen.dart';
import 'cart_screen.dart';

/// Dedicated Size & Surface Hub Screen for Hierarchical 2-Level Product Browsing
class SizeCatalogueScreen extends StatefulWidget {
  const SizeCatalogueScreen({super.key});

  @override
  State<SizeCatalogueScreen> createState() => _SizeCatalogueScreenState();
}

class _SizeCatalogueScreenState extends State<SizeCatalogueScreen> {
  final AppStateService _appState = AppStateService();
  String _selectedSurface = 'All Surfaces';

  // Sample catalog counts per size & surface for counter badges
  int _getModelCountForSizeAndSurface(String sizeMm, String surface) {
    if (sizeMm.contains('1200x1800')) {
      return surface == 'All Surfaces' ? 28 : (surface.contains('Gloss') ? 14 : 8);
    } else if (sizeMm.contains('800x1600')) {
      return surface == 'All Surfaces' ? 36 : (surface.contains('Matt') ? 16 : 12);
    } else if (sizeMm.contains('600x1200')) {
      return surface == 'All Surfaces' ? 52 : (surface.contains('Gloss') ? 24 : 18);
    } else {
      return surface == 'All Surfaces' ? 22 : 10;
    }
  }

  int get _totalAvailableModels {
    return TileCategoriesMatrix.sizeCategories.fold(
      0,
      (sum, cat) => sum + _getModelCountForSizeAndSurface(cat.sizeMm, _selectedSurface),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Size & Surface Hub'),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppTheme.primaryNavy, Color(0xFF1B3D70)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '2-LEVEL HIERARCHICAL BROWSING',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.accentOrange,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Explore Slabs & Tiles by Dimension',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Select surface finishes to filter matching formats instantly.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),

          // Horizontal Surface Finish Pill Tabs
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Text(
                    'Select Surface Finish:',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textSubtle,
                    ),
                  ),
                ),
                SizedBox(
                  height: 38,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: TileCategoriesMatrix.surfaceFinishes.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final surface = TileCategoriesMatrix.surfaceFinishes[index];
                      final isSelected = _selectedSurface == surface;

                      return ChoiceChip(
                        label: Text(surface),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() => _selectedSurface = surface);
                          }
                        },
                        selectedColor: AppTheme.primaryNavy,
                        backgroundColor: Colors.grey.shade100,
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected ? Colors.white : AppTheme.textDark,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(
                            color: isSelected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),

          // Counter Badge Header Row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: const Color(0xFFF4F7FC),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppTheme.accentOrange.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    size: 14,
                    color: AppTheme.accentOrange,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '$_selectedSurface • $_totalAvailableModels Tile Models Available',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          // 4 Visual Size Category Cards Grid / List
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: TileCategoriesMatrix.sizeCategories.length,
              itemBuilder: (context, index) {
                final cat = TileCategoriesMatrix.sizeCategories[index];
                final count = _getModelCountForSizeAndSurface(cat.sizeMm, _selectedSurface);

                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: AppTheme.luxuryCardDecoration,
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Visual Thumbnail Banner with Physical Aspect Ratio Badge
                      Stack(
                        children: [
                          AspectRatio(
                            aspectRatio: 2.2,
                            child: Image.network(
                              cat.imageUrl,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                                child: const Icon(Icons.terrain_rounded, size: 48, color: AppTheme.primaryNavy),
                              ),
                            ),
                          ),
                          Container(
                            height: 120,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.black.withValues(alpha: 0.6),
                                  Colors.transparent,
                                ],
                                begin: Alignment.bottomCenter,
                                end: Alignment.topCenter,
                              ),
                            ),
                          ),
                          Positioned(
                            top: 12,
                            left: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.accentOrange,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                '${cat.sizeMm} (${cat.sizeCm})',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            top: 12,
                            right: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.7),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: Colors.white24),
                              ),
                              child: Text(
                                'Ratio ${cat.aspectRatioLabel}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 12,
                            left: 12,
                            child: Text(
                              cat.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),

                      // Details & Model Counter Badge
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              cat.description,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppTheme.textSubtle,
                                height: 1.3,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                      color: AppTheme.primaryNavy.withValues(alpha: 0.15),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.grid_view_rounded,
                                        size: 14,
                                        color: AppTheme.primaryNavy,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        '$_selectedSurface • $count Tiles',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: AppTheme.primaryNavy,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppTheme.primaryNavy,
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                  ),
                                  onPressed: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => ProductListingScreen(
                                          subcategoryTitle: '${cat.name} (${cat.sizeMm})',
                                          initialSize: cat.sizeMm,
                                          initialSurface: _selectedSurface,
                                        ),
                                      ),
                                    );
                                  },
                                  child: const Text(
                                    'EXPLORE FORMAT →',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
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
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
