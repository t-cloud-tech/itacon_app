import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/app_state_service.dart';
import '../widgets/adhesive_section_widget.dart';
import 'cart_screen.dart';

/// Full screen catalog for Fixing Solutions (Tile & Stone Adhesives)
class FixingSolutionsScreen extends StatefulWidget {
  const FixingSolutionsScreen({super.key});

  @override
  State<FixingSolutionsScreen> createState() => _FixingSolutionsScreenState();
}

class _FixingSolutionsScreenState extends State<FixingSolutionsScreen> {
  final AppStateService _appState = AppStateService.instance;
  final TextEditingController _searchController = TextEditingController();
  final Map<String, String> _selectedWeights = {};

  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    for (final p in AdhesiveData.products) {
      _selectedWeights[p.id] = p.availableWeights.first;
    }
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<AdhesiveProduct> get _filteredProducts {
    return AdhesiveData.products.where((p) {
      // Search Query Filter
      if (_searchQuery.isNotEmpty) {
        final matchName = p.name.toLowerCase().contains(_searchQuery);
        final matchGrade = p.grade.toLowerCase().contains(_searchQuery);
        final matchDesc = p.shortDesc.toLowerCase().contains(_searchQuery);
        final matchIdeal = p.idealFor.toLowerCase().contains(_searchQuery);
        final matchSku = p.sku.toLowerCase().contains(_searchQuery);
        if (!matchName && !matchGrade && !matchDesc && !matchIdeal && !matchSku) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  void _showProductDetailsModal(BuildContext context, AdhesiveProduct product) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AdhesiveDetailsBottomSheet(
        product: product,
        initialWeight: _selectedWeights[product.id] ?? product.availableWeights.first,
        onWeightSelected: (w) {
          setState(() {
            _selectedWeights[product.id] = w;
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final double screenWidth = MediaQuery.of(context).size.width;
    final double cardAspectRatio = screenWidth < 360 ? 0.65 : (screenWidth < 400 ? 0.68 : 0.72);
    final filtered = _filteredProducts;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
          tooltip: 'Back',
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Fixing Solutions',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppTheme.primaryNavy,
          ),
        ),
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
          // Search & Header Banner Section
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Search Input Field
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.borderSubtle),
                  ),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search adhesives, grades, applications...',
                      hintStyle: GoogleFonts.inter(
                        fontSize: 13,
                        color: AppTheme.textSubtle,
                      ),
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        color: AppTheme.textSubtle,
                        size: 20,
                      ),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18, color: AppTheme.textSubtle),
                              onPressed: () => _searchController.clear(),
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Product Grid
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.search_off_rounded,
                          size: 64,
                          color: Colors.grey.shade400,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'No adhesives match your search',
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textDark,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Try searching for another product name or code',
                          style: GoogleFonts.inter(
                            fontSize: 12.5,
                            color: AppTheme.textSubtle,
                          ),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: () {
                            _searchController.clear();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryNavy,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: const Text(
                            'Clear Search',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  )
                : GridView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                    physics: const BouncingScrollPhysics(),
                    itemCount: filtered.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: cardAspectRatio,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemBuilder: (context, index) {
                      final adhesive = filtered[index];
                      final selectedWeight = _selectedWeights[adhesive.id] ?? adhesive.availableWeights.first;
                      final tileProduct = adhesive.toTileProduct(selectedWeight: selectedWeight);
                      final currentPrice = adhesive.weightPrices[selectedWeight] ?? 420.0;

                      return RepaintBoundary(
                        child: GestureDetector(
                          onTap: () => _showProductDetailsModal(context, adhesive),
                          child: Container(
                            decoration: AppTheme.luxuryCardDecoration,
                            clipBehavior: Clip.antiAlias,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Product Image & Top Badges Stack
                                Expanded(
                                  child: Stack(
                                    children: [
                                      AdhesiveSectionWidget.buildAdhesiveImage(
                                        adhesive.imageUrl,
                                        adhesive.packagingColor,
                                      ),
                                      // Badge in top left
                                      Positioned(
                                        top: 8,
                                        left: 8,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 3,
                                          ),
                                          decoration: BoxDecoration(
                                            color: adhesive.badgeColor,
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            adhesive.badgeText,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 8.5,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 0.3,
                                            ),
                                          ),
                                        ),
                                      ),
                                      // Favorite Icon Button in top right
                                      Positioned(
                                        top: 8,
                                        right: 8,
                                        child: ListenableBuilder(
                                          listenable: _appState,
                                          builder: (context, _) {
                                            final isFav = _appState.isFavorite(tileProduct.id);
                                            return GestureDetector(
                                              onTap: () => _appState.toggleFavorite(tileProduct),
                                              child: CircleAvatar(
                                                radius: 14,
                                                backgroundColor: Colors.white.withValues(alpha: 0.9),
                                                child: Icon(
                                                  isFav
                                                      ? Icons.favorite_rounded
                                                      : Icons.favorite_outline_rounded,
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
                                ),
                                // Product Meta Text
                                Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        adhesive.name,
                                        style: GoogleFonts.inter(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: AppTheme.textDark,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${adhesive.grade.split('•').first.trim()} • $selectedWeight',
                                        style: GoogleFonts.inter(
                                          fontSize: 11,
                                          color: AppTheme.textSubtle,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '₹${currentPrice.toStringAsFixed(0)} / bag',
                                        style: GoogleFonts.inter(
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
