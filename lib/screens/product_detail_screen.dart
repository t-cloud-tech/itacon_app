import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../models/tile_product.dart';
import '../services/app_state_service.dart';
import '../services/pricing_service.dart';
import '../utils/tile_dimension_helper.dart';
import '../utils/app_notification_utils.dart';
import '../widgets/interactive_pressable.dart';
import '../widgets/app_product_image.dart';
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
  bool _isMockupMode = false;

  final List<String> _sizes = const ['600x1200 mm', '600x600 mm'];
  final List<String> _finishes = const [
    'Glossy',
    'Satin Matt',
    'Matt - Carving',
    'Rustic Wood',
    'Inky Colors',
    'High Gloss',
    'Anti - Skid',
    'Matt Punch',
    'Sugar Lapato',
    'Pastel Colors',
  ];

  List<String> get _currentFaceImages => _product.resolvedFaceImages;
  List<String> get _currentMockupImages => _product.resolvedMockupImages;
  List<String> get _activeImages =>
      _isMockupMode ? _currentMockupImages : _currentFaceImages;

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
            'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
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
    _quantity = 1;
  }

  void _showManualQuantityDialog() {
    final controller = TextEditingController(text: '$_quantity');
    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Enter Box Quantity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: 'Quantity (Boxes)',
                  suffixText: 'Boxes',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                children: [10, 50, 100, 500].map((preset) {
                  return ActionChip(
                    label: Text('+$preset'),
                    onPressed: () {
                      final current = int.tryParse(controller.text) ?? 0;
                      controller.text = '${current + preset}';
                    },
                  );
                }).toList(),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('CANCEL'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryNavy),
              onPressed: () {
                final parsed = int.tryParse(controller.text.trim());
                if (parsed != null && parsed > 0) {
                  setState(() {
                    _quantity = parsed;
                  });
                  Navigator.pop(dialogContext);
                }
              },
              child: const Text('SET QUANTITY'),
            ),
          ],
        );
      },
    );
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
  void dispose() {
    _pageController.dispose();
    super.dispose();
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
        leading: Center(
          child: AppPressable(
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
            scaleDown: 0.88,
            borderRadius: BorderRadius.circular(20),
            child: const Padding(
              padding: EdgeInsets.all(8.0),
              child: Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
            ),
          ),
        ),
        title: const Text('Product Details'),
        actions: [
          ListenableBuilder(
            listenable: _appState,
            builder: (context, _) {
              final cartCount = _appState.cartCount;
              return Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  AppPressable(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const CartScreen()),
                      );
                    },
                    scaleDown: 0.88,
                    borderRadius: BorderRadius.circular(20),
                    child: const Padding(
                      padding: EdgeInsets.all(8.0),
                      child: Icon(Icons.shopping_bag_outlined, color: AppTheme.primaryNavy),
                    ),
                  ),
                  if (cartCount > 0)
                    Positioned(
                      top: 4,
                      right: 4,
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
                          '$cartCount',
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
          ListenableBuilder(
            listenable: _appState,
            builder: (context, _) {
              final isFav = _appState.isFavorite(_product.id);
              return AppPressable(
                onTap: () => _appState.toggleFavorite(_product),
                scaleDown: 0.85,
                borderRadius: BorderRadius.circular(20),
                child: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Icon(
                    isFav ? Icons.favorite_rounded : Icons.favorite_outline_rounded,
                    color: isFav ? Colors.red : AppTheme.primaryNavy,
                  ),
                ),
              );
            },
          ),
          AppPressable(
            onTap: () {},
            scaleDown: 0.88,
            borderRadius: BorderRadius.circular(20),
            child: const Padding(
              padding: EdgeInsets.all(8.0),
              child: Icon(Icons.share_outlined, color: AppTheme.primaryNavy),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dynamic Proportional Frame Container with Visualizer
            Stack(
              alignment: Alignment.bottomCenter,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 450),
                  curve: Curves.easeInOutCubic,
                  height: calculatedFrameHeight,
                  color: Colors.grey.shade100,
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: _activeImages.length,
                    onPageChanged: (idx) {
                      setState(() => _currentImageIndex = idx);
                    },
                    itemBuilder: (context, index) {
                      final img = _activeImages[index];
                      // If in mockup mode and this image is the tile face image (not a room mockup render), show 4-tile floor layout
                      if (_isMockupMode && img.contains('tiles/') && !img.contains('mockup')) {
                        return _buildFloorTiledMockup(img, calculatedFrameHeight);
                      }
                      return InteractiveViewer(
                        minScale: 1.0,
                        maxScale: 4.0,
                        panEnabled: true,
                        clipBehavior: Clip.hardEdge,
                        child: Center(
                          child: AppProductImage(
                            imagePath: img,
                            width: double.infinity,
                            height: calculatedFrameHeight,
                            fit: _isMockupMode ? BoxFit.cover : BoxFit.contain,
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // Pinch to Zoom Hint Pill (Top Left)
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.65),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.zoom_in_rounded, color: Colors.white, size: 14),
                        SizedBox(width: 4),
                        Text(
                          'Pinch to zoom',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Top Mode Toggle Switch: [ Tile Face ] vs [ Room Mockup ] (Top Right)
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.94),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.16),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                      border: Border.all(
                        color: AppTheme.borderSubtle.withValues(alpha: 0.8),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildModeTogglePill(
                          label: 'Tile Face',
                          icon: Icons.grid_view_rounded,
                          isSelected: !_isMockupMode,
                          onTap: () {
                            if (_isMockupMode) {
                              setState(() {
                                _isMockupMode = false;
                                _currentImageIndex = 0;
                              });
                              _pageController.jumpToPage(0);
                            }
                          },
                        ),
                        _buildModeTogglePill(
                          label: 'Room Mockup',
                          icon: Icons.meeting_room_outlined,
                          isSelected: _isMockupMode,
                          onTap: () {
                            if (!_isMockupMode) {
                              setState(() {
                                _isMockupMode = true;
                                _currentImageIndex = 0;
                              });
                              _pageController.jumpToPage(0);
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                // Unified Bottom Info & Counter Overlay Bar (Guaranteed Zero Overlap on Any Device)
                Positioned(
                  bottom: 12,
                  left: 12,
                  right: 12,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Context Watermark Badge (Tile Size & Face / Room Scene)
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryNavy.withValues(alpha: 0.88),
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.25),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _isMockupMode
                                    ? (_currentImageIndex == 0
                                        ? Icons.meeting_room_rounded
                                        : Icons.grid_4x4_rounded)
                                    : Icons.aspect_ratio_rounded,
                                color: AppTheme.accentOrange,
                                size: 14,
                              ),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  _isMockupMode
                                      ? (_currentImageIndex == 0
                                          ? '3D Room Scene Mockup'
                                          : 'Floor Layout (4 Tiles)')
                                      : (_activeImages.length > 1
                                          ? '${TileDimensionHelper.getFormattedWatermark(_selectedSize, category: _product.tileCategory)} • Face ${_currentImageIndex + 1}'
                                          : TileDimensionHelper.getFormattedWatermark(
                                              _selectedSize,
                                              category: _product.tileCategory)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Photo Counter Badge (Right)
                      if (_activeImages.length > 1) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 9, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.72),
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.2),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.photo_library_outlined,
                                color: Colors.white,
                                size: 12,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${_currentImageIndex + 1}/${_activeImages.length}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // Horizontal Mini-Thumbnail Selector
            _buildThumbnailSelector(_activeImages),

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
                      final isAdhesive = _product.isAdhesive;
                      final pcsPerBox = _product.pcsPerBox > 0 ? _product.pcsPerBox : 2;
                      final sqFtPerBox = _product.sqFtPerBox > 0 ? _product.sqFtPerBox : 15.5;
                      final boxCost = isAdhesive ? resolved.unitPrice : resolved.unitPrice * pcsPerBox;
                      final totalArea = _quantity * sqFtPerBox;
                      final totalCost = _quantity * boxCost;
                      final totalWeightKg = isAdhesive ? (_quantity * 20.0) : (_quantity * _product.boxWeightKg);

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
                                    const SizedBox(height: 4),
                                    if (isAdhesive && _product.classification.isNotEmpty)
                                       Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: AppTheme.primaryNavy,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          _product.classification,
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                    if (resolved.hasDiscount && !isAdhesive) ...[
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
                                   if (resolved.hasDiscount && !isAdhesive)
                                    Text(
                                      '₹${resolved.basePrice.toStringAsFixed(0)} / sq ft',
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
                                      isAdhesive
                                          ? '₹${resolved.unitPrice.toStringAsFixed(0)} / Bag + Tax'
                                          : '₹${resolved.unitPrice.toStringAsFixed(0)} / sq ft',
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
                          // Dynamic Box / Bag Cost & Area / Weight Card
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
                                    Text(
                                      isAdhesive ? 'Bag Rate' : 'Cost Per Box',
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                                    ),
                                    Text(
                                      isAdhesive
                                          ? '₹${boxCost.toStringAsFixed(0)} / Bag'
                                          : '₹${boxCost.toStringAsFixed(0)} / Box',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.primaryNavy,
                                      ),
                                    ),
                                    Text(
                                      isAdhesive ? '(20 kg / Bag)' : '($pcsPerBox Pcs • $sqFtPerBox sq.ft / Box)',
                                      style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                                    ),
                                  ],
                                ),
                                Container(width: 1, height: 32, color: AppTheme.borderSubtle),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      isAdhesive ? 'Total Order Weight ($_quantity Bags)' : 'Est. Coverage ($_quantity Boxes)',
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                                    ),
                                    Text(
                                      isAdhesive
                                          ? '${totalWeightKg.toStringAsFixed(0)} kg (${(totalWeightKg / 1000).toStringAsFixed(2)} Tons)'
                                          : '${totalArea.toStringAsFixed(1)} sq.ft',
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

                  // Dedicated Adhesive Highlight Cards
                  if (_product.isAdhesive) ...[
                    // Suitable Tile Formats & Sizes Card
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: AppTheme.luxuryCardDecorationWithBorder(
                        borderColor: AppTheme.primaryNavy.withValues(alpha: 0.15),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.grid_view_rounded, color: AppTheme.primaryNavy, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                'Suitable Tile Formats & Sizes',
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.primaryNavy,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _product.usageTileSizes.isNotEmpty
                                ? _product.usageTileSizes
                                : 'Floor 2x2, Wall 12x18, Parking Tiles 16x16, 12x12',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              height: 1.4,
                              color: AppTheme.textDark,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Application & Substrate Guide Card
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: AppTheme.luxuryCardDecorationWithBorder(
                        borderColor: AppTheme.accentOrange.withValues(alpha: 0.25),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.build_circle_outlined, color: AppTheme.accentOrange, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                'Application & Substrate Guide',
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.primaryNavy,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _product.applicationNotes.isNotEmpty
                                ? _product.applicationNotes
                                : 'Standard interior floor & wall ceramic/vitrified tiling.',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              height: 1.45,
                              color: AppTheme.textDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
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
              // Quantity Controller with Tactile AppPressable
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: Row(
                  children: [
                    AppPressable(
                      onTap: _quantity > 1
                          ? () {
                              setState(() {
                                _quantity--;
                              });
                            }
                          : null,
                      scaleDown: 0.85,
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: Icon(
                          Icons.remove,
                          size: 18,
                          color: _quantity > 1 ? AppTheme.primaryNavy : Colors.grey.shade400,
                        ),
                      ),
                    ),
                    AppPressable(
                      onTap: _showManualQuantityDialog,
                      scaleDown: 0.94,
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryNavy.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          children: [
                            Text(
                              '$_quantity',
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.primaryNavy,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.edit_outlined, size: 13, color: AppTheme.accentOrange),
                          ],
                        ),
                      ),
                    ),
                    AppPressable(
                      onTap: () {
                        setState(() {
                          _quantity++;
                        });
                      },
                      scaleDown: 0.85,
                      borderRadius: BorderRadius.circular(8),
                      child: const Padding(
                        padding: EdgeInsets.all(8.0),
                        child: Icon(Icons.add, size: 18, color: AppTheme.primaryNavy),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),

              // Add to Cart Button with Micro-Press Animation
              Expanded(
                child: AppButton(
                  text: 'Add to Cart',
                  icon: Icons.shopping_bag_outlined,
                  height: 48,
                  variant: AppButtonVariant.primary,
                  onPressed: () {
                    _appState.addToCart(
                      _product,
                      size: _selectedSize,
                      finish: _selectedFinish,
                      quantity: _quantity,
                    );
                    AppNotificationUtils.showAddToCartSnackBar(
                      context,
                      productName: _product.name,
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

  Widget _buildModeTogglePill({
    required String label,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryNavy : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected ? Colors.white : AppTheme.textSubtle,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? Colors.white : AppTheme.textDark,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Renders a realistic 4-tile floor installation mockup displaying the actual tile from Excel
  Widget _buildFloorTiledMockup(String tileImagePath, double frameHeight) {
    final tileAspectRatio = TileDimensionHelper.calculateTileAspectRatio(_selectedSize);

    return InteractiveViewer(
      minScale: 1.0,
      maxScale: 4.0,
      panEnabled: true,
      clipBehavior: Clip.hardEdge,
      child: Stack(
        children: [
          // 4-Tile Floor Grid with Realistic 2.5mm Grout Joints
          Positioned.fill(
            child: Container(
              color: const Color(0xFFD6D3D1), // Realistic 2mm light stone-grey grout line
              child: GridView.builder(
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.all(2.5),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 2.5,
                  mainAxisSpacing: 2.5,
                  childAspectRatio: tileAspectRatio,
                ),
                itemCount: 4,
                itemBuilder: (context, index) {
                  return AppProductImage(
                    imagePath: tileImagePath,
                    fit: BoxFit.cover,
                  );
                },
              ),
            ),
          ),

          // Ambient Floor Reflection & Vignette
          Positioned.fill(
            child: IgnorePointer(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.08),
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.15),
                    ],
                  ),
                ),
              ),
            ),
          ),

        ],
      ),
    );
  }

  Widget _buildThumbnailSelector(List<String> images) {
    if (images.length <= 1) return const SizedBox.shrink();

    final roomLabels = const ['Floor Mockup', 'Living Room', 'Bathroom', 'Bedroom', 'Foyer', 'Lobby'];

    return Container(
      height: 84,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      decoration: BoxDecoration(
        color: AppTheme.backgroundColor,
        border: Border(
          bottom: BorderSide(color: AppTheme.borderSubtle.withValues(alpha: 0.6)),
        ),
      ),
      child: Row(
        children: [
          Container(
            margin: const EdgeInsets.only(right: 10),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.primaryNavy.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _isMockupMode ? Icons.meeting_room_outlined : Icons.grid_view_rounded,
                  size: 16,
                  color: AppTheme.primaryNavy,
                ),
                const SizedBox(height: 2),
                Text(
                  _isMockupMode ? 'Mockups' : 'Faces',
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryNavy,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final isSelected = _currentImageIndex == index;
                final label = _isMockupMode
                    ? (images[index].contains('mockup')
                        ? 'Room View'
                        : (images[index].contains('tiles')
                            ? 'Floor Grid'
                            : (index < roomLabels.length ? roomLabels[index] : 'Room ${index + 1}')))
                    : 'Face ${index + 1}';

                return GestureDetector(
                  onTap: () {
                    setState(() => _currentImageIndex = index);
                    _pageController.animateToPage(
                      index,
                      duration: const Duration(milliseconds: 480),
                      curve: Curves.easeInOutCubic,
                    );
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 350),
                    curve: Curves.easeInOutCubic,
                    width: 68,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isSelected ? AppTheme.accentOrange : AppTheme.borderSubtle,
                        width: isSelected ? 2.5 : 1,
                      ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: AppTheme.accentOrange.withValues(alpha: 0.25),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          AppProductImage(
                            imagePath: images[index],
                            fit: BoxFit.cover,
                          ),
                          Positioned(
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              color: isSelected
                                  ? AppTheme.primaryNavy.withValues(alpha: 0.88)
                                  : Colors.black.withValues(alpha: 0.6),
                              child: Text(
                                label,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
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
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: AppTheme.textDark,
              fontSize: 13,
            ),
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
        const SizedBox(width: 8),
        Flexible(
          child: Row(
            mainAxisSize: MainAxisSize.min,
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
              Flexible(
                child: Text(
                  colorName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
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
