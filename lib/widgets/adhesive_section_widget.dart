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
      tileCategory: 'Tile Adhesives',
      categoryId: 'CAT_ADHESIVES_01',
      size: selectedWeight,
      surface: grade,
      color: 'Grey / White Polymer',
      baseColour: 'Grey',
      pattern: 'Polymer Modified Powder',
      basePrice: price,
      moq: 1,
      unit: 'bag',
      stockStatus: 'available_now',
      availableQuantity: 1000,
      images: [imageUrl],
      collection: 'FixBond Adhesive Series',
      productType: 'Adhesives',
      bodyType: 'Polymer Cementitious Matrix',
      thickness: grade,
      boxWeightKg: weightKg,
      sqFtPerBox: 1.0, // 1 bag = 1 unit
      spaces: const ['Living Room', 'Bath Room', 'Outdoor', 'Commercial'],
      finish: grade,
    );
  }
}

/// Catalog of ITACON Adhesive Bags
class AdhesiveData {
  static const List<AdhesiveProduct> products = [
    AdhesiveProduct(
      id: 'ADH_ULTRAGRIP_T02',
      sku: 'ITA-ADH-T02-PRO',
      name: 'ITACON UltraGrip™ T-02 Pro',
      grade: 'Type 2 • Vitrified & Porcelain',
      badgeText: 'BEST SELLER',
      badgeColor: AppTheme.accentOrange,
      shortDesc: 'Polymer-enriched high-shear bond adhesive for vitrified floor & wall tiles.',
      idealFor: '600x600 & 600x1200 mm Vitrified Tiles, Low Porosity Floor/Walls, Bathrooms & Commercial Floors',
      coverageText: '50 - 60 sq.ft / 20kg (at 3-4mm trowel)',
      coverageSqFtPer20Kg: 55.0,
      availableWeights: ['20 kg Bag', '40 kg Jumbo Bag'],
      weightPrices: {
        '20 kg Bag': 420.0,
        '40 kg Jumbo Bag': 790.0,
      },
      originalPrices: {
        '20 kg Bag': 520.0,
        '40 kg Jumbo Bag': 980.0,
      },
      keyFeatures: [
        'IS 15477:2019 Type 2 Certified formulation',
        'Zero vertical tile slippage on vertical walls',
        'Enhanced polymers prevent hollow sound',
        'Water-resistant and high thermal stability',
      ],
      waterRatio: '5.0 to 5.5 Litres per 20 kg bag',
      potLife: '3 - 4 Hours at 27°C',
      openTime: '25 - 30 Minutes',
      tensileStrength: '≥ 1.50 N/mm² (Superior Bond)',
      rating: 4.9,
      reviewsCount: 318,
      packagingColor: Color(0xFF0E274D), // Deep Navy
      imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=600&q=80',
    ),
    AdhesiveProduct(
      id: 'ADH_PLATINUM_T03',
      sku: 'ITA-ADH-T03-MAX',
      name: 'ITACON PlatinumFlex™ T-03 Max',
      grade: 'Type 4 S2 • Heavy Slabs & Cladding',
      badgeText: 'HEAVY SLABS',
      badgeColor: Color(0xFF0D9488), // Teal
      shortDesc: 'S2 Highly deformable polymer-modified adhesive for extra-large slabs & facade cladding.',
      idealFor: '800x1600 & 1200x1800 mm Slim Slabs, External Elevations, Tile-on-Tile & Heated Floors',
      coverageText: '40 - 50 sq.ft / 20kg (at 4-6mm trowel)',
      coverageSqFtPer20Kg: 45.0,
      availableWeights: ['20 kg Bag', '40 kg Jumbo Bag'],
      weightPrices: {
        '20 kg Bag': 680.0,
        '40 kg Jumbo Bag': 1290.0,
      },
      originalPrices: {
        '20 kg Bag': 840.0,
        '40 kg Jumbo Bag': 1580.0,
      },
      keyFeatures: [
        'Class S2 extreme flexibility & vibration absorption',
        'Ideal for direct Tile-over-Tile installations',
        'Withstands harsh outdoor sun & thermal expansion',
        'High tensile shear adhesion > 2.0 N/mm²',
      ],
      waterRatio: '5.2 to 5.8 Litres per 20 kg bag',
      potLife: '4 Hours at 27°C',
      openTime: '30 - 35 Minutes',
      tensileStrength: '≥ 2.20 N/mm² (Extreme Heavy Duty)',
      rating: 5.0,
      reviewsCount: 184,
      packagingColor: Color(0xFF1E3A8A), // Royal Blue
      imageUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=600&q=80',
    ),
    AdhesiveProduct(
      id: 'ADH_FIXBOND_T01',
      sku: 'ITA-ADH-T01-STD',
      name: 'ITACON FixBond™ T-01 Elite',
      grade: 'Type 1 • Ceramic & Terracotta',
      badgeText: 'CERAMIC TILES',
      badgeColor: Color(0xFF4F46E5), // Indigo
      shortDesc: 'Economical high-adhesion cementitious adhesive for standard ceramic and clay tiles.',
      idealFor: 'Interior Ceramic Wall & Floor Tiles, Terracotta, Kitchen Splashes & Domestic Floors',
      coverageText: '55 - 65 sq.ft / 20kg (at 3mm trowel)',
      coverageSqFtPer20Kg: 60.0,
      availableWeights: ['20 kg Bag', '40 kg Jumbo Bag'],
      weightPrices: {
        '20 kg Bag': 340.0,
        '40 kg Jumbo Bag': 630.0,
      },
      originalPrices: {
        '20 kg Bag': 420.0,
        '40 kg Jumbo Bag': 780.0,
      },
      keyFeatures: [
        'IS 15477:2019 Type 1 Compliant',
        'No tile pre-soaking required in water',
        'Smooth trowel workability with easy spread',
        'High cost-efficiency for residential projects',
      ],
      waterRatio: '4.8 to 5.2 Litres per 20 kg bag',
      potLife: '2.5 - 3 Hours at 27°C',
      openTime: '20 Minutes',
      tensileStrength: '≥ 1.05 N/mm²',
      rating: 4.8,
      reviewsCount: 206,
      packagingColor: Color(0xFF334155), // Slate Dark
      imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
    ),
    AdhesiveProduct(
      id: 'ADH_CRYSTAL_T04',
      sku: 'ITA-ADH-T04-EPX',
      name: 'ITACON CrystalEpoxy™ T-04 Dual',
      grade: 'Epoxy Resin • 100% Solid Waterproof',
      badgeText: 'EPOXY GROUT',
      badgeColor: Color(0xFF854D0E), // Amber Gold
      shortDesc: '3-Part 100% solid epoxy adhesive & chemical-proof grout for pools, spas and glass mosaic.',
      idealFor: 'Glass Mosaic, Swimming Pools, Commercial Kitchens, Chemical Tanks & Cleanrooms',
      coverageText: '30 - 35 sq.ft / 10kg Bucket',
      coverageSqFtPer20Kg: 70.0,
      availableWeights: ['10 kg Bucket', '20 kg Bucket'],
      weightPrices: {
        '10 kg Bucket': 950.0,
        '20 kg Bucket': 1790.0,
      },
      originalPrices: {
        '10 kg Bucket': 1180.0,
        '20 kg Bucket': 2150.0,
      },
      keyFeatures: [
        '100% Waterproof, Stainproof & Anti-Bacterial',
        'Unaffected by acids, alkalis, oils and chemicals',
        'Non-fading sparkling color finish',
        'Heavy mechanical abrasion resistance',
      ],
      waterRatio: 'Pre-dosed 3-Part Epoxy Resin Mix',
      potLife: '45 - 60 Minutes',
      openTime: '45 Minutes',
      tensileStrength: '≥ 6.0 N/mm² (High Epoxy Strength)',
      rating: 4.9,
      reviewsCount: 92,
      packagingColor: Color(0xFF431407), // Amber Dark
      imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header matching Trending Collection
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Tile Adhesives & FixBond™',
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

        // 2-Column Grid matching EXACT Trending Collection card layout
        GridView.builder(
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: AdhesiveData.products.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 0.72,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemBuilder: (context, index) {
            final adhesive = AdhesiveData.products[index];
            final selectedWeight = _selectedWeights[adhesive.id] ?? adhesive.availableWeights.first;
            final tileProduct = adhesive.toTileProduct(selectedWeight: selectedWeight);
            final currentPrice = adhesive.weightPrices[selectedWeight] ?? 420.0;

            return GestureDetector(
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
                          Image.network(
                            adhesive.imageUrl,
                            width: double.infinity,
                            height: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => Container(
                              color: adhesive.packagingColor,
                              child: Center(
                                child: Icon(
                                  Icons.inventory_2_rounded,
                                  color: Colors.white.withValues(alpha: 0.5),
                                  size: 48,
                                ),
                              ),
                            ),
                          ),
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
            );
          },
        ),
      ],
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
    if (_selectedTileType.contains('Large Format')) {
      recProduct = AdhesiveData.products[1]; // PlatinumFlex T-03
    } else if (_selectedTileType.contains('Ceramic')) {
      recProduct = AdhesiveData.products[2]; // FixBond T-01
    } else if (_selectedTileType.contains('Glass Mosaic')) {
      recProduct = AdhesiveData.products[3]; // CrystalEpoxy T-04
    } else {
      recProduct = AdhesiveData.products[0]; // UltraGrip T-02 Pro
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
