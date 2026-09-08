import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';

/// Data model representing an ITACON High-Bond Tile Adhesive Bag Product
class AdhesiveProduct {
  final String id;
  final String sku;
  final String name;
  final String grade; // e.g. "IS 15477:2019 Type 2"
  final String badgeText;
  final Color badgeColor;
  final String shortDesc;
  final String idealFor;
  final String coverageText;
  final double coverageSqFtPer20Kg;
  final List<String> availableWeights; // e.g. ['20 kg Bag', '40 kg Jumbo Bag']
  final Map<String, double> weightPrices; // Weight -> Price in INR
  final Map<String, double> originalPrices; // Weight -> MRP in INR
  final List<String> keyFeatures;
  final String waterRatio;
  final String potLife;
  final String openTime;
  final String tensileStrength;
  final double rating;
  final int reviewsCount;
  final Color packagingColor;
  final String imageUrl;

  const AdhesiveProduct({
    required this.id,
    required this.sku,
    required this.name,
    required this.grade,
    required this.badgeText,
    required this.badgeColor,
    required this.shortDesc,
    required this.idealFor,
    required this.coverageText,
    required this.coverageSqFtPer20Kg,
    required this.availableWeights,
    required this.weightPrices,
    required this.originalPrices,
    required this.keyFeatures,
    required this.waterRatio,
    required this.potLife,
    required this.openTime,
    required this.tensileStrength,
    this.rating = 4.9,
    this.reviewsCount = 142,
    this.packagingColor = AppTheme.primaryNavy,
    required this.imageUrl,
  });

  /// Converts an adhesive bag product to a standard TileProduct so it integrates
  /// seamlessly with AppStateService, Cart, Pricing, and Checkout flows.
  TileProduct toTileProduct({required String selectedWeight}) {
    final price = weightPrices[selectedWeight] ?? (weightPrices.values.first);
    final weightKg = double.tryParse(selectedWeight.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 20.0;

    return TileProduct(
      id: '${id}_${selectedWeight.replaceAll(' ', '_')}',
      productId: id,
      sku: sku,
      name: '$name ($selectedWeight)',
      productLine: 'adhesives',
      tileCategory: 'Fixing Solutions',
      categoryId: 'CAT_ADHESIVES',
      size: selectedWeight,
      surface: grade,
      color: name.contains('WHITE') || name.contains('White') ? 'White' : 'Grey',
      baseColour: name.contains('WHITE') || name.contains('White') ? 'White' : 'Grey',
      pattern: 'Polymer Modified Powder',
      basePrice: price,
      moq: 1,
      unit: 'bag',
      stockStatus: 'available_now',
      availableQuantity: 1000,
      images: [imageUrl],
      collection: 'ITA LX Series',
      productType: 'Adhesives',
      bodyType: 'Polymer Cementitious Matrix',
      thickness: grade,
      classification: grade,
      bagWeightKg: weightKg,
      usageTileSizes: idealFor,
      applicationNotes: shortDesc,
      boxWeightKg: weightKg,
      sqFtPerBox: 1.0,
      spaces: const ['Living Room', 'Bath Room', 'Outdoor', 'Commercial'],
      finish: grade,
    );
  }
}

/// Catalog of ITACON Adhesive Bags
class AdhesiveData {
  static const List<AdhesiveProduct> products = [
    AdhesiveProduct(
      id: 'PROD_ADH_LX01',
      sku: 'ITA-LX-01',
      name: 'ITA LX-01 Tile Adhesive',
      grade: 'TYPE-1 (C1T)',
      badgeText: 'C1T TYPE-1',
      badgeColor: AppTheme.primaryNavy,
      shortDesc: 'Standard interior floor & wall ceramic/vitrified tiling.',
      idealFor: 'Floor 2x2, Wall 12x18, Parking Tiles 16x16, 12x12',
      coverageText: '50 - 60 sq.ft / 20kg Bag',
      coverageSqFtPer20Kg: 55.0,
      availableWeights: ['20 kg Bag'],
      weightPrices: {
        '20 kg Bag': 150.0,
      },
      originalPrices: {
        '20 kg Bag': 190.0,
      },
      keyFeatures: [
        'TYPE-1 (C1T) Certified formulation',
        'Grey cementitious polymer powder',
        'Ideal for floor 2x2 & wall 12x18 tiles',
        '20 kg Moisture-Lock packaging',
      ],
      waterRatio: '4.5 to 5.0 Litres per 20 kg bag',
      potLife: '2.5 - 3 Hours at 27°C',
      openTime: '20 Minutes',
      tensileStrength: '≥ 0.5 N/mm²',
      rating: 4.8,
      reviewsCount: 142,
      packagingColor: Color(0xFF0E274D),
      imageUrl: 'assets/images/adhesives/ITA-LX-01.png',
    ),
    AdhesiveProduct(
      id: 'PROD_ADH_LX02',
      sku: 'ITA-LX-02',
      name: 'ITA LX-02 Tile Adhesive',
      grade: 'TYPE-2 (C2T)',
      badgeText: 'C2T TYPE-2',
      badgeColor: AppTheme.primaryNavy,
      shortDesc: 'Interior & Exterior Wall or Floor tile-on-tile, high dip elevation.',
      idealFor: '300x600, 300x450 Wall, 800x800, 600x1200 (upto 10 ft)',
      coverageText: '45 - 55 sq.ft / 20kg Bag',
      coverageSqFtPer20Kg: 50.0,
      availableWeights: ['20 kg Bag'],
      weightPrices: {
        '20 kg Bag': 185.0,
      },
      originalPrices: {
        '20 kg Bag': 230.0,
      },
      keyFeatures: [
        'TYPE-2 (C2T) High-shear adhesion',
        'Tile-on-tile & high dip elevation',
        'Zero vertical tile slippage on walls',
        '20 kg Moisture-Lock packaging',
      ],
      waterRatio: '4.8 to 5.2 Litres per 20 kg bag',
      potLife: '3 Hours at 27°C',
      openTime: '25 Minutes',
      tensileStrength: '≥ 1.0 N/mm²',
      rating: 4.9,
      reviewsCount: 210,
      packagingColor: Color(0xFF1E3A8A),
      imageUrl: 'assets/images/adhesives/ITA-LX-02.png',
    ),
    AdhesiveProduct(
      id: 'PROD_ADH_LX03',
      sku: 'ITA-LX-03',
      name: 'ITA LX-03 Tile Adhesive',
      grade: 'TYPE-3 (C2TE)',
      badgeText: 'C2TE TYPE-3',
      badgeColor: AppTheme.accentOrange,
      shortDesc: 'Wall & floor heavy vitrified tiles, window/door framing marble, continuous sunlight.',
      idealFor: '1000x1000, 800x1600 (upto 10 ft), 600x1200 (upto 20 ft), 200x1200 Wooden Plank',
      coverageText: '40 - 50 sq.ft / 20kg Bag',
      coverageSqFtPer20Kg: 45.0,
      availableWeights: ['20 kg Bag'],
      weightPrices: {
        '20 kg Bag': 220.0,
      },
      originalPrices: {
        '20 kg Bag': 275.0,
      },
      keyFeatures: [
        'TYPE-3 (C2TE) Heavy polymer formulation',
        'Window & door framing with marble',
        'Continuous sunlight & thermal resistance',
        'Extended open time for large format tiles',
      ],
      waterRatio: '5.0 to 5.5 Litres per 20 kg bag',
      potLife: '3.5 Hours at 27°C',
      openTime: '30 Minutes',
      tensileStrength: '≥ 1.5 N/mm²',
      rating: 4.9,
      reviewsCount: 184,
      packagingColor: Color(0xFFD97706),
      imageUrl: 'assets/images/adhesives/ITA-LX-03.png',
    ),
    AdhesiveProduct(
      id: 'PROD_ADH_LX03W',
      sku: 'ITA-LX-03W',
      name: 'ITA LX-03W White Tile Adhesive',
      grade: 'TYPE-3 (WHITE) (C2TE)',
      badgeText: 'TYPE-3 WHITE',
      badgeColor: Color(0xFF0D9488),
      shortDesc: 'Pure white adhesive for composite marble, glass mosaics, and external walls.',
      idealFor: 'Composite Marble, Glass Mosaics, White Stones, External Sunlight Walls',
      coverageText: '40 - 50 sq.ft / 20kg Bag',
      coverageSqFtPer20Kg: 45.0,
      availableWeights: ['20 kg Bag'],
      weightPrices: {
        '20 kg Bag': 310.0,
      },
      originalPrices: {
        '20 kg Bag': 380.0,
      },
      keyFeatures: [
        'TYPE-3 WHITE (C2TE) Pure white cement base',
        'Non-staining formulation for translucent stones',
        'Glass mosaics & composite marble cladding',
        'High weatherability & UV stability',
      ],
      waterRatio: '5.0 to 5.5 Litres per 20 kg bag',
      potLife: '3.5 Hours at 27°C',
      openTime: '30 Minutes',
      tensileStrength: '≥ 1.5 N/mm²',
      rating: 5.0,
      reviewsCount: 96,
      packagingColor: Color(0xFF0F766E),
      imageUrl: 'assets/images/adhesives/ITA-LX-03W.png',
    ),
    AdhesiveProduct(
      id: 'PROD_ADH_LX04',
      sku: 'ITA-LX-04',
      name: 'ITA LX-04 High-Polymer Adhesive',
      grade: 'TYPE-4 (C2TES1)',
      badgeText: 'C2TES1 TYPE-4',
      badgeColor: Color(0xFF854D0E),
      shortDesc: 'High-flex polymer adhesive for large format slabs, elevation facades, and thermal expansion.',
      idealFor: '1200x1800, 1200x1200, 1200x1600, 800x2400 Slabs, Marble & Granite',
      coverageText: '35 - 45 sq.ft / 20kg Bag',
      coverageSqFtPer20Kg: 40.0,
      availableWeights: ['20 kg Bag'],
      weightPrices: {
        '20 kg Bag': 290.0,
      },
      originalPrices: {
        '20 kg Bag': 360.0,
      },
      keyFeatures: [
        'TYPE-4 (C2TES1) S1 Deformable Class',
        'Large format extra-heavy slabs & elevation facades',
        'Extreme vibration & thermal flexibility',
        'High tensile shear strength > 2.0 N/mm²',
      ],
      waterRatio: '5.2 to 5.8 Litres per 20 kg bag',
      potLife: '4 Hours at 27°C',
      openTime: '35 Minutes',
      tensileStrength: '≥ 2.0 N/mm²',
      rating: 5.0,
      reviewsCount: 230,
      packagingColor: Color(0xFFB45309),
      imageUrl: 'assets/images/adhesives/ITA-LX-04.png',
    ),
    AdhesiveProduct(
      id: 'PROD_ADH_LX04W',
      sku: 'ITA-LX-04W',
      name: 'ITA LX-04W White Polymer Adhesive',
      grade: 'TYPE-4 (WHITE) (C2TES1)',
      badgeText: 'TYPE-4 WHITE',
      badgeColor: Color(0xFF7C3AED),
      shortDesc: 'Premium white polymer adhesive for luxury translucent marble slabs & heavy sunlight.',
      idealFor: '1200x1800 Jumbo Slabs, Onyx Marble, Translucent Stones, External Facades',
      coverageText: '35 - 45 sq.ft / 20kg Bag',
      coverageSqFtPer20Kg: 40.0,
      availableWeights: ['20 kg Bag'],
      weightPrices: {
        '20 kg Bag': 380.0,
      },
      originalPrices: {
        '20 kg Bag': 470.0,
      },
      keyFeatures: [
        'TYPE-4 WHITE (C2TES1) S1 Deformable Class',
        'Pure white matrix for luxury translucent marble',
        'Maximum UV & extreme weathering protection',
        'High shear bond strength > 2.0 N/mm²',
      ],
      waterRatio: '5.2 to 5.8 Litres per 20 kg bag',
      potLife: '4 Hours at 27°C',
      openTime: '35 Minutes',
      tensileStrength: '≥ 2.0 N/mm²',
      rating: 5.0,
      reviewsCount: 112,
      packagingColor: Color(0xFF6D28D9),
      imageUrl: 'assets/images/adhesives/ITA-LX-04W.png',
    ),
  ];
}

/// A Tile Adhesive Bags section with the EXACT same card design as Trending Collection
class AdhesiveSectionWidget extends StatefulWidget {
  const AdhesiveSectionWidget({super.key});

  @override
  State<AdhesiveSectionWidget> createState() => _AdhesiveSectionWidgetState();
}

class _AdhesiveSectionWidgetState extends State<AdhesiveSectionWidget> {
  // Track selected weight for each adhesive product
  final Map<String, String> _selectedWeights = {};

  @override
  void initState() {
    super.initState();
    for (final p in AdhesiveData.products) {
      _selectedWeights[p.id] = p.availableWeights.first;
    }
  }

  void _showAdhesiveCalculatorModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const _AdhesiveCalculatorBottomSheet(),
    );
  }

  void _showProductDetailsModal(BuildContext context, AdhesiveProduct product) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AdhesiveDetailsBottomSheet(
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
    final appState = AppStateService.instance;
    final double screenWidth = MediaQuery.of(context).size.width;
    final double cardAspectRatio = screenWidth < 360 ? 0.65 : (screenWidth < 400 ? 0.68 : 0.72);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header matching Trending Collection
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Fixing Solutions (Adhesives)',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
            GestureDetector(
              onTap: () => _showAdhesiveCalculatorModal(context),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(
                    Icons.calculate_outlined,
                    size: 16,
                    color: AppTheme.accentOrange,
                  ),
                  SizedBox(width: 4),
                  Text(
                    'Calculator',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.accentOrange,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // 2-Column Responsive Grid matching EXACT Trending Collection card layout
        GridView.builder(
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: AdhesiveData.products.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: cardAspectRatio,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemBuilder: (context, index) {
            final adhesive = AdhesiveData.products[index];
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
                    // Product Image & Top Badges Stack (Identical to Trending Collection)
                    Expanded(
                      child: Stack(
                        children: [
                          _buildAdhesiveSectionImage(adhesive.imageUrl, adhesive.packagingColor),
                          // Subtle Badge in top left
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
                          // Favorite Icon Button in top right (Identical to Trending Collection)
                          Positioned(
                            top: 8,
                            right: 8,
                            child: ListenableBuilder(
                              listenable: appState,
                              builder: (context, _) {
                                final isFav = appState.isFavorite(tileProduct.id);
                                return GestureDetector(
                                  onTap: () => appState.toggleFavorite(tileProduct),
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
                    // Product Meta Text (Identical to Trending Collection)
                    Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            adhesive.name,
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
                            '${adhesive.grade.split('•').first.trim()} • $selectedWeight',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppTheme.textSubtle,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '₹${currentPrice.toStringAsFixed(0)} / bag',
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
            ),
          );
        },
        ),
      ],
    );
  }

  Widget _buildAdhesiveSectionImage(String path, Color fallbackColor) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return Image.network(
        path,
        width: double.infinity,
        height: double.infinity,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) => _buildFallbackBox(fallbackColor),
      );
    }

    String cleanPath = path;
    if (!cleanPath.startsWith('assets/images/adhesives/') && cleanPath.contains('adhesives/')) {
      final fileName = cleanPath.split('adhesives/').last;
      cleanPath = 'assets/images/adhesives/$fileName';
    }

    final String altPath = cleanPath.contains('assets/images/adhesives')
        ? cleanPath.replaceFirst('assets/images/adhesives', 'assets/adhesives')
        : cleanPath;

    return Image.asset(
      cleanPath,
      width: double.infinity,
      height: double.infinity,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) {
        return Image.asset(
          altPath,
          width: double.infinity,
          height: double.infinity,
          fit: BoxFit.contain,
          errorBuilder: (context, error2, stackTrace2) => _buildFallbackBox(fallbackColor),
        );
      },
    );
  }

  Widget _buildFallbackBox(Color fallbackColor) {
    return Container(
      color: fallbackColor,
      child: Center(
        child: Icon(
          Icons.inventory_2_rounded,
          color: Colors.white.withValues(alpha: 0.5),
          size: 48,
        ),
      ),
    );
  }
}

/// Interactive Tile Adhesive Coverage Calculator Modal
class _AdhesiveCalculatorBottomSheet extends StatefulWidget {
  const _AdhesiveCalculatorBottomSheet();

  @override
  State<_AdhesiveCalculatorBottomSheet> createState() =>
      _AdhesiveCalculatorBottomSheetState();
}

class _AdhesiveCalculatorBottomSheetState
    extends State<_AdhesiveCalculatorBottomSheet> {
  final TextEditingController _areaController = TextEditingController(text: '350');
  String _selectedTileType = 'Vitrified Floor Tiles (600x1200 / 600x600)';

  final List<String> _tileTypes = [
    'Vitrified Floor Tiles (600x1200 / 600x600)',
    'Large Format Porcelain Slabs (800x1600+)',
    'Standard Ceramic Wall & Floor Tiles',
    'Glass Mosaic / Swimming Pool Tiles',
  ];

  @override
  void dispose() {
    _areaController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final double area = double.tryParse(_areaController.text.trim()) ?? 0.0;

    // Adhesive recommendation logic
    AdhesiveProduct recProduct;
    if (_selectedTileType.contains('Large Format') || _selectedTileType.contains('Slab')) {
      recProduct = AdhesiveData.products[4]; // ITA LX-04 High-Polymer
    } else if (_selectedTileType.contains('Ceramic')) {
      recProduct = AdhesiveData.products[0]; // ITA LX-01 Tile Adhesive
    } else if (_selectedTileType.contains('Glass Mosaic') || _selectedTileType.contains('White Marble')) {
      recProduct = AdhesiveData.products[3]; // ITA LX-03W White Adhesive
    } else {
      recProduct = AdhesiveData.products[1]; // ITA LX-02 Tile Adhesive
    }

    final double coveragePerBag = recProduct.coverageSqFtPer20Kg;
    final int requiredBags = area > 0 ? (area / coveragePerBag).ceil() : 0;
    final double pricePerBag = recProduct.weightPrices['20 kg Bag'] ?? 420.0;
    final double estimatedTotal = requiredBags * pricePerBag;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Modal Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.accentOrange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.calculate_rounded,
                    color: AppTheme.accentOrange,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Tile Adhesive Estimator',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.primaryNavy,
                        ),
                      ),
                      Text(
                        'Calculate exact bag requirement based on IS 15477 standards',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: AppTheme.textSubtle,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: AppTheme.textSubtle),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Step 1: Area Input
            const Text(
              '1. Total Tiling Area (in Sq. Ft.)',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _areaController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                hintText: 'e.g. 500',
                suffixText: 'sq.ft',
                suffixStyle: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryNavy,
                ),
                prefixIcon: Icon(Icons.square_foot_rounded, color: AppTheme.primaryNavy),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            // Step 2: Tile Type Selector
            const Text(
              '2. Select Tile Surface & Type',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _selectedTileType,
              isExpanded: true,
              decoration: const InputDecoration(
                contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              items: _tileTypes.map((type) {
                return DropdownMenuItem(
                  value: type,
                  child: Text(
                    type,
                    style: const TextStyle(fontSize: 13, color: AppTheme.textDark),
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() {
                    _selectedTileType = val;
                  });
                }
              },
            ),
            const SizedBox(height: 18),

            // Result Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    AppTheme.primaryNavy,
                    AppTheme.secondaryNavy,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.accentOrange,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'RECOMMENDED ADHESIVE',
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      Text(
                        'Coverage: ~${coveragePerBag.toInt()} sq.ft/bag',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    recProduct.name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    recProduct.grade,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.white70,
                    ),
                  ),
                  const Divider(color: Colors.white24, height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Required Quantity',
                            style: TextStyle(fontSize: 11, color: Colors.white70),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$requiredBags Bags (20kg)',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'Approx ${(requiredBags * 20)} kg total',
                            style: const TextStyle(fontSize: 10, color: Colors.white60),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'Estimated Total',
                            style: TextStyle(fontSize: 11, color: Colors.white70),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '₹${estimatedTotal.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: AppTheme.accentOrange,
                            ),
                          ),
                          Text(
                            '₹${pricePerBag.toInt()}/bag factory price',
                            style: const TextStyle(fontSize: 10, color: Colors.white60),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // One-Tap Add to Cart Button
            ElevatedButton(
              onPressed: requiredBags > 0
                  ? () {
                      final tileProduct = recProduct.toTileProduct(
                        selectedWeight: '20 kg Bag',
                      );
                      AppStateService.instance.addToCart(
                        tileProduct,
                        size: '20 kg Bag',
                        finish: recProduct.grade,
                        quantity: requiredBags,
                      );
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: AppTheme.primaryNavy,
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          content: Text(
                            'Added $requiredBags Bags of ${recProduct.name} to Cart!',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      );
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentOrange,
                padding: const EdgeInsets.symmetric(vertical: 14),
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                'Add $requiredBags Bags to Cart (₹${estimatedTotal.toStringAsFixed(0)})',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Technical Data Sheet (TDS) and Application Guide Bottom Sheet
class _AdhesiveDetailsBottomSheet extends StatefulWidget {
  final AdhesiveProduct product;
  final String initialWeight;
  final ValueChanged<String> onWeightSelected;

  const _AdhesiveDetailsBottomSheet({
    required this.product,
    required this.initialWeight,
    required this.onWeightSelected,
  });

  @override
  State<_AdhesiveDetailsBottomSheet> createState() =>
      _AdhesiveDetailsBottomSheetState();
}

class _AdhesiveDetailsBottomSheetState
    extends State<_AdhesiveDetailsBottomSheet> {
  late String _selectedWeight;

  @override
  void initState() {
    super.initState();
    _selectedWeight = widget.initialWeight;
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final currentPrice = product.weightPrices[_selectedWeight] ?? product.weightPrices.values.first;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 30),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Header Row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: product.badgeColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    product.badgeText,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: product.badgeColor,
                    ),
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: AppTheme.textSubtle),
                ),
              ],
            ),
            Text(
              product.name,
              style: const TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w900,
                color: AppTheme.primaryNavy,
              ),
            ),
            Text(
              product.grade,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppTheme.accentOrange,
              ),
            ),
            const SizedBox(height: 14),

            // Short Description
            Text(
              product.shortDesc,
              style: const TextStyle(
                fontSize: 13,
                color: AppTheme.textDark,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 14),

            // Key Highlights / TDS specs table
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _buildTdsRow('Ideal For', product.idealFor),
                  const Divider(height: 16),
                  _buildTdsRow('Coverage', product.coverageText),
                  const Divider(height: 16),
                  _buildTdsRow('Water Ratio', product.waterRatio),
                  const Divider(height: 16),
                  _buildTdsRow('Pot Life', product.potLife),
                  const Divider(height: 16),
                  _buildTdsRow('Open Time', product.openTime),
                  const Divider(height: 16),
                  _buildTdsRow('Tensile Strength', product.tensileStrength),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Feature Checkmarks
            const Text(
              'Key Performance Advantages',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 8),
            ...product.keyFeatures.map((feat) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.check_circle_rounded,
                          color: AppTheme.statusSuccess, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          feat,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: AppTheme.textDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                )),
            const SizedBox(height: 18),

            // Weight Selection
            const Text(
              'Select Bag Weight',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: product.availableWeights.map((w) {
                final isSel = w == _selectedWeight;
                final price = product.weightPrices[w] ?? 0.0;
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedWeight = w;
                      });
                      widget.onWeightSelected(w);
                    },
                    child: Container(
                      margin: EdgeInsets.only(
                        right: w == product.availableWeights.last ? 0 : 8,
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                      decoration: BoxDecoration(
                        color: isSel ? AppTheme.primaryNavy : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isSel ? AppTheme.primaryNavy : const Color(0xFFCBD5E1),
                          width: 1.5,
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(
                            w,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: isSel ? Colors.white : AppTheme.textDark,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '₹${price.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: AppTheme.accentOrange,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Add To Cart Footer
            ElevatedButton(
              onPressed: () {
                final tileProduct = product.toTileProduct(selectedWeight: _selectedWeight);
                AppStateService.instance.addToCart(
                  tileProduct,
                  size: _selectedWeight,
                  finish: product.grade,
                  quantity: 1,
                );
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: AppTheme.primaryNavy,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    content: Text(
                      'Added ${product.name} ($_selectedWeight) to Cart!',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryNavy,
                padding: const EdgeInsets.symmetric(vertical: 14),
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                'Add to Cart • ₹${currentPrice.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTdsRow(String title, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppTheme.textSubtle,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppTheme.textDark,
            ),
          ),
        ),
      ],
    );
  }
}
