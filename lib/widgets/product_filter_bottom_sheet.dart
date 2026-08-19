import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/product_enums.dart';

/// Class holding filter parameters
class ProductFilterCriteria {
  final String? selectedSpace;
  final String? selectedSurface;
  final String? selectedBaseColour;
  final String? selectedCollection;
  final String? selectedProductType; // 'All' | 'Vitrified' | 'Ceramic'
  final String? selectedSize;

  ProductFilterCriteria({
    this.selectedSpace,
    this.selectedSurface,
    this.selectedBaseColour,
    this.selectedCollection,
    this.selectedProductType,
    this.selectedSize,
  });

  bool get isEmpty =>
      selectedSpace == null &&
      selectedSurface == null &&
      selectedBaseColour == null &&
      selectedCollection == null &&
      (selectedProductType == null || selectedProductType == 'All') &&
      selectedSize == null;

  ProductFilterCriteria copyWith({
    String? selectedSpace,
    String? selectedSurface,
    String? selectedBaseColour,
    String? selectedCollection,
    String? selectedProductType,
    String? selectedSize,
  }) {
    return ProductFilterCriteria(
      selectedSpace: selectedSpace ?? this.selectedSpace,
      selectedSurface: selectedSurface ?? this.selectedSurface,
      selectedBaseColour: selectedBaseColour ?? this.selectedBaseColour,
      selectedCollection: selectedCollection ?? this.selectedCollection,
      selectedProductType: selectedProductType ?? this.selectedProductType,
      selectedSize: selectedSize ?? this.selectedSize,
    );
  }
}

class ProductFilterBottomSheet extends StatefulWidget {
  final ProductFilterCriteria initialFilter;
  final ValueChanged<ProductFilterCriteria> onApplyFilter;

  const ProductFilterBottomSheet({
    super.key,
    required this.initialFilter,
    required this.onApplyFilter,
  });

  @override
  State<ProductFilterBottomSheet> createState() =>
      _ProductFilterBottomSheetState();
}

class _ProductFilterBottomSheetState extends State<ProductFilterBottomSheet> {
  String? _space;
  String? _surface;
  String? _baseColour;
  String? _collection;
  String _productType = 'All';
  String? _size;

  @override
  void initState() {
    super.initState();
    _space = widget.initialFilter.selectedSpace;
    _surface = widget.initialFilter.selectedSurface;
    _baseColour = widget.initialFilter.selectedBaseColour;
    _collection = widget.initialFilter.selectedCollection;
    _productType = widget.initialFilter.selectedProductType ?? 'All';
    _size = widget.initialFilter.selectedSize;
  }

  void _clearAll() {
    setState(() {
      _space = null;
      _surface = null;
      _baseColour = null;
      _collection = null;
      _productType = 'All';
      _size = null;
    });
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
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.filter_list_rounded,
                          color: AppTheme.primaryNavy, size: 20),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Filter Products',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded,
                      color: AppTheme.textSubtle),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          // Scrollable Facet Options
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Product Type Segmented Toggle
                  _buildSectionTitle('Product Type'),
                  const SizedBox(height: 10),
                  Row(
                    children: ['All', 'Vitrified', 'Ceramic'].map((type) {
                      final isSelected = _productType == type;
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _productType = type),
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppTheme.primaryNavy
                                  : Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected
                                    ? AppTheme.primaryNavy
                                    : AppTheme.borderSubtle,
                              ),
                            ),
                            child: Text(
                              type,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color:
                                    isSelected ? Colors.white : AppTheme.textDark,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 2. Spaces Filter Chips
                  _buildSectionTitle('Spaces & Applications'),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.spaces.map((sp) {
                      final selected = _space == sp;
                      return ChoiceChip(
                        label: Text(sp),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight:
                              selected ? FontWeight.bold : FontWeight.w500,
                        ),
                        onSelected: (val) {
                          setState(() => _space = val ? sp : null);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 3. Surface Finish Filter Chips
                  _buildSectionTitle('Surface Finish'),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.surfaces.map((surf) {
                      final selected = _surface == surf;
                      return ChoiceChip(
                        label: Text(surf),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight:
                              selected ? FontWeight.bold : FontWeight.w500,
                        ),
                        onSelected: (val) {
                          setState(() => _surface = val ? surf : null);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 4. Base Colour Palette Chips
                  _buildSectionTitle('Base Colour'),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.baseColours.map((col) {
                      final selected = _baseColour == col;
                      final dotColor = _getColorForBaseName(col);
                      return ChoiceChip(
                        avatar: Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: dotColor,
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: Colors.grey.shade400, width: 1),
                          ),
                        ),
                        label: Text(col),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight:
                              selected ? FontWeight.bold : FontWeight.w500,
                        ),
                        onSelected: (val) {
                          setState(() => _baseColour = val ? col : null);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 5. Collection Filter Chips
                  _buildSectionTitle('Design Collection'),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.collections.map((coll) {
                      final selected = _collection == coll;
                      return ChoiceChip(
                        label: Text(coll),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight:
                              selected ? FontWeight.bold : FontWeight.w500,
                        ),
                        onSelected: (val) {
                          setState(() => _collection = val ? coll : null);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 6. Size Selector Chips
                  _buildSectionTitle('Tile Size'),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: ProductEnums.sizes.map((szMap) {
                      final szLabel = szMap['label'] as String;
                      final selected = _size == szLabel;
                      return ChoiceChip(
                        label: Text(szLabel),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight:
                              selected ? FontWeight.bold : FontWeight.w500,
                        ),
                        onSelected: (val) {
                          setState(() => _size = val ? szLabel : null);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),

          // Bottom Button Actions (Clear All & Apply Filters)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: AppTheme.primaryNavy),
                      ),
                      onPressed: _clearAll,
                      child: const Text('Clear All'),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryNavy,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () {
                        widget.onApplyFilter(
                          ProductFilterCriteria(
                            selectedSpace: _space,
                            selectedSurface: _surface,
                            selectedBaseColour: _baseColour,
                            selectedCollection: _collection,
                            selectedProductType: _productType,
                            selectedSize: _size,
                          ),
                        );
                        Navigator.pop(context);
                      },
                      child: const Text('Apply Filters'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.bold,
        color: AppTheme.primaryNavy,
        letterSpacing: 0.3,
      ),
    );
  }
}
