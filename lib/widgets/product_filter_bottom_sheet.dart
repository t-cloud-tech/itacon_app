import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/product_enums.dart';
import '../models/tile_product.dart';
import '../services/product_catalog_service.dart';

/// Multi-Select Filter Criteria supporting Sets for Surfaces, Sizes, Colours, Spaces, and Collections.
class ProductFilterCriteria {
  final Set<String> selectedSpaces;
  final Set<String> selectedSurfaces;
  final Set<String> selectedBaseColours;
  final Set<String> selectedCollections;
  final String selectedProductType; // 'All' | 'Vitrified' | 'Ceramic'
  final Set<String> selectedSizes;

  ProductFilterCriteria({
    Set<String>? selectedSpaces,
    Set<String>? selectedSurfaces,
    Set<String>? selectedBaseColours,
    Set<String>? selectedCollections,
    this.selectedProductType = 'All',
    Set<String>? selectedSizes,
    // Backward compatibility parameter aliases
    String? selectedSpace,
    String? selectedSurface,
    String? selectedBaseColour,
    String? selectedCollection,
    String? selectedSize,
  })  : selectedSpaces = selectedSpaces ??
            (selectedSpace != null && selectedSpace.isNotEmpty ? {selectedSpace} : {}),
        selectedSurfaces = selectedSurfaces ??
            (selectedSurface != null &&
                    selectedSurface.isNotEmpty &&
                    selectedSurface != 'All Surfaces'
                ? {selectedSurface}
                : {}),
        selectedBaseColours = selectedBaseColours ??
            (selectedBaseColour != null && selectedBaseColour.isNotEmpty ? {selectedBaseColour} : {}),
        selectedCollections = selectedCollections ??
            (selectedCollection != null && selectedCollection.isNotEmpty ? {selectedCollection} : {}),
        selectedSizes = selectedSizes ??
            (selectedSize != null &&
                    selectedSize.isNotEmpty &&
                    selectedSize != 'All Sizes'
                ? {selectedSize}
                : {});

  // Backward compatibility getters
  String? get selectedSpace => selectedSpaces.isNotEmpty ? selectedSpaces.first : null;
  String? get selectedSurface => selectedSurfaces.isNotEmpty ? selectedSurfaces.first : null;
  String? get selectedBaseColour => selectedBaseColours.isNotEmpty ? selectedBaseColours.first : null;
  String? get selectedCollection => selectedCollections.isNotEmpty ? selectedCollections.first : null;
  String? get selectedSize => selectedSizes.isNotEmpty ? selectedSizes.first : null;

  bool get isEmpty =>
      selectedSpaces.isEmpty &&
      selectedSurfaces.isEmpty &&
      selectedBaseColours.isEmpty &&
      selectedCollections.isEmpty &&
      (selectedProductType == 'All' || selectedProductType.isEmpty) &&
      selectedSizes.isEmpty;

  int get activeFilterCount {
    int count = selectedSpaces.length +
        selectedSurfaces.length +
        selectedBaseColours.length +
        selectedCollections.length +
        selectedSizes.length;
    if (selectedProductType != 'All' && selectedProductType.isNotEmpty) {
      count += 1;
    }
    return count;
  }

  /// Checks if a tile product matches this filter criteria
  bool matches(TileProduct p) {
    // 1. Spaces Multi-Select
    if (selectedSpaces.isNotEmpty &&
        !p.spaces.any((sp) => selectedSpaces.contains(sp))) {
      return false;
    }

    // 2. Surfaces Multi-Select
    if (selectedSurfaces.isNotEmpty &&
        !selectedSurfaces.contains(p.surface) &&
        !selectedSurfaces.contains(p.finish)) {
      return false;
    }

    // 3. Base Colours Multi-Select
    if (selectedBaseColours.isNotEmpty) {
      final matchesColour = selectedBaseColours.any((selectedCol) {
        final sCol = selectedCol.toLowerCase().trim();
        final pBase = p.baseColour.toLowerCase().trim();
        final pCol = p.color.toLowerCase().trim();

        if (pBase == sCol || pCol == sCol) return true;

        if (sCol == 'white') {
          return pBase.contains('white') || pBase.contains('statuario') || pCol.contains('white');
        }
        if (sCol == 'grey') {
          return pBase.contains('grey') || pBase.contains('grery') || pCol.contains('grey');
        }
        if (sCol == 'beige') {
          return pBase.contains('beige') || pBase.contains('taupe') || pCol.contains('beige');
        }
        if (sCol == 'brown') {
          return pBase.contains('brown') || pCol.contains('brown');
        }
        if (sCol == 'blue') {
          return pBase.contains('blue') || pCol.contains('blue');
        }
        if (sCol == 'aqua') {
          return pBase.contains('aqua') || pCol.contains('aqua');
        }
        if (sCol == 'crema') {
          return pBase.contains('crem') || pCol.contains('crem');
        }
        if (sCol == 'bianco') {
          return pBase.contains('bianco') || pCol.contains('bianco');
        }
        if (sCol == 'ivory') {
          return pBase.contains('ivory') || pCol.contains('ivory');
        }

        return pBase.contains(sCol) || sCol.contains(pBase) || pCol.contains(sCol);
      });
      if (!matchesColour) return false;
    }

    // 4. Collections / Design Multi-Select
    if (selectedCollections.isNotEmpty) {
      final matchesCollection = selectedCollections.any((selectedCol) {
        final sCol = selectedCol.toLowerCase().trim();
        final pCol = p.collection.toLowerCase().trim();
        final pPat = p.pattern.toLowerCase().trim();

        if (pCol == sCol || pPat == sCol) return true;

        // Flexible sub-matching e.g. "Endless" or "Random" or "Décor"
        if (sCol.contains('endless') && (pCol.contains('endless') || pPat.contains('endless'))) return true;
        if (sCol.contains('random') && (pCol.contains('random') || pPat.contains('random'))) return true;
        if (sCol.contains('décor') || sCol.contains('decor')) {
          return pCol.contains('décor') || pCol.contains('decor') || pPat.contains('décor') || pPat.contains('decor');
        }
        if (sCol.contains('plain') && (pCol.contains('plain') || pPat.contains('plain'))) return true;
        if (sCol.contains('marble') && (pCol.contains('marble') || pPat.contains('marble'))) return true;

        return pCol.contains(sCol) || sCol.contains(pCol) || pPat.contains(sCol);
      });
      if (!matchesCollection) return false;
    }

    // 5. Product Type Segment
    if (selectedProductType != 'All' &&
        selectedProductType.isNotEmpty &&
        p.productType != selectedProductType) {
      return false;
    }

    // 6. Sizes Multi-Select
    if (selectedSizes.isNotEmpty && !selectedSizes.contains(p.size)) {
      return false;
    }

    return true;
  }

  ProductFilterCriteria copyWith({
    Set<String>? selectedSpaces,
    Set<String>? selectedSurfaces,
    Set<String>? selectedBaseColours,
    Set<String>? selectedCollections,
    String? selectedProductType,
    Set<String>? selectedSizes,
  }) {
    return ProductFilterCriteria(
      selectedSpaces: selectedSpaces ?? Set.from(this.selectedSpaces),
      selectedSurfaces: selectedSurfaces ?? Set.from(this.selectedSurfaces),
      selectedBaseColours: selectedBaseColours ?? Set.from(this.selectedBaseColours),
      selectedCollections: selectedCollections ?? Set.from(this.selectedCollections),
      selectedProductType: selectedProductType ?? this.selectedProductType,
      selectedSizes: selectedSizes ?? Set.from(this.selectedSizes),
    );
  }
}

class ProductFilterBottomSheet extends StatefulWidget {
  final ProductFilterCriteria initialFilter;
  final ValueChanged<ProductFilterCriteria> onApplyFilter;
  final List<TileProduct>? allProducts;
  final String? searchQuery;

  const ProductFilterBottomSheet({
    super.key,
    required this.initialFilter,
    required this.onApplyFilter,
    this.allProducts,
    this.searchQuery,
  });

  @override
  State<ProductFilterBottomSheet> createState() =>
      _ProductFilterBottomSheetState();
}

class _ProductFilterBottomSheetState extends State<ProductFilterBottomSheet> {
  late Set<String> _selectedSpaces;
  late Set<String> _selectedSurfaces;
  late Set<String> _selectedBaseColours;
  late Set<String> _selectedCollections;
  late String _productType;
  late Set<String> _selectedSizes;

  @override
  void initState() {
    super.initState();
    _selectedSpaces = Set.from(widget.initialFilter.selectedSpaces);
    _selectedSurfaces = Set.from(widget.initialFilter.selectedSurfaces);
    _selectedBaseColours = Set.from(widget.initialFilter.selectedBaseColours);
    _selectedCollections = Set.from(widget.initialFilter.selectedCollections);
    _productType = widget.initialFilter.selectedProductType;
    _selectedSizes = Set.from(widget.initialFilter.selectedSizes);
  }

  void _clearAll() {
    setState(() {
      _selectedSpaces.clear();
      _selectedSurfaces.clear();
      _selectedBaseColours.clear();
      _selectedCollections.clear();
      _productType = 'All';
      _selectedSizes.clear();
    });
  }

  int _getMatchingTileCount() {
    final criteria = ProductFilterCriteria(
      selectedSpaces: _selectedSpaces,
      selectedSurfaces: _selectedSurfaces,
      selectedBaseColours: _selectedBaseColours,
      selectedCollections: _selectedCollections,
      selectedProductType: _productType,
      selectedSizes: _selectedSizes,
    );
    final sourceList = widget.allProducts ??
        ProductCatalogService.allCatalogProducts
            .where((p) => !p.isAdhesive)
            .toList();

    return sourceList.where((p) {
      if (widget.searchQuery != null && widget.searchQuery!.trim().isNotEmpty) {
        final query = widget.searchQuery!.toLowerCase().trim();
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
      return criteria.matches(p);
    }).length;
  }

  Color _getColorForBaseName(String colorName) {
    switch (colorName) {
      case 'White':
      case 'White Statuario':
        return Colors.white;
      case 'Bianco':
        return const Color(0xFFF5F5F0);
      case 'Grey':
      case 'Light Grey':
        return const Color(0xFF9E9E9E);
      case 'Dark Grey':
        return const Color(0xFF616161);
      case 'Beige':
        return const Color(0xFFD2B48C);
      case 'Crema':
        return const Color(0xFFFFFDD0);
      case 'Ivory':
        return const Color(0xFFFFFFF0);
      case 'Brown':
        return const Color(0xFF795548);
      case 'Blue':
        return const Color(0xFF1976D2);
      case 'Aqua':
        return const Color(0xFF00BCD4);
      case 'Nero':
      case 'Black':
        return Colors.black;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeTotal = _selectedSpaces.length +
        _selectedSurfaces.length +
        _selectedBaseColours.length +
        _selectedCollections.length +
        _selectedSizes.length +
        (_productType != 'All' ? 1 : 0);

    final matchingCount = _getMatchingTileCount();

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Responsive Header Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 10, 10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.tune_rounded,
                    color: AppTheme.primaryNavy,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Flexible(
                        child: Text(
                          'Filter Products',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryNavy,
                          ),
                        ),
                      ),
                      if (activeTotal > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.accentOrange,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '$activeTotal Active',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (activeTotal > 0) ...[
                  TextButton(
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    onPressed: _clearAll,
                    child: const Text(
                      'Clear All',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.accentOrange,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                ],
                IconButton(
                  padding: const EdgeInsets.all(6),
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  icon: const Icon(Icons.close_rounded, color: AppTheme.textSubtle, size: 22),
                  onPressed: () => Navigator.pop(context),
                  tooltip: 'Close',
                ),
              ],
            ),
          ),

          // Real-time Matching Count Ribbon
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFFF4F7FC),
            child: Row(
              children: [
                Icon(
                  matchingCount > 0 ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                  size: 16,
                  color: matchingCount > 0 ? AppTheme.accentOrange : AppTheme.textSubtle,
                ),
                const SizedBox(width: 6),
                Text(
                  matchingCount == 1
                      ? '1 tile found'
                      : '$matchingCount tiles found',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                if (activeTotal > 0) ...[
                  const Spacer(),
                  Text(
                    '$activeTotal filter${activeTotal == 1 ? "" : "s"} applied',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSubtle,
                    ),
                  ),
                ],
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
                  _buildSectionTitle('Product Type', _productType != 'All' ? 1 : 0),
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
                                color: isSelected ? Colors.white : AppTheme.textDark,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 2. Multi-Select Surface Finishes
                  _buildSectionTitle('Surface Finishes', _selectedSurfaces.length),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.surfaces.map((surf) {
                      final selected = _selectedSurfaces.contains(surf);
                      return FilterChip(
                        showCheckmark: true,
                        checkmarkColor: Colors.white,
                        avatar: selected
                            ? null
                            : const Icon(Icons.auto_awesome_rounded, size: 14, color: AppTheme.primaryNavy),
                        label: Text(surf),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        backgroundColor: Colors.grey.shade100,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight: selected ? FontWeight.bold : FontWeight.w500,
                          fontSize: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: selected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
                          ),
                        ),
                        onSelected: (val) {
                          setState(() {
                            if (val) {
                              _selectedSurfaces.add(surf);
                            } else {
                              _selectedSurfaces.remove(surf);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 3. Multi-Select Tile Sizes
                  _buildSectionTitle('Tile Sizes', _selectedSizes.length),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.sizes.map((szMap) {
                      final szLabel = szMap['label'] as String;
                      final selected = _selectedSizes.contains(szLabel);
                      return FilterChip(
                        showCheckmark: true,
                        checkmarkColor: Colors.white,
                        label: Text(szLabel),
                        selected: selected,
                        selectedColor: AppTheme.accentOrange,
                        backgroundColor: Colors.grey.shade100,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight: selected ? FontWeight.bold : FontWeight.w500,
                          fontSize: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: selected ? AppTheme.accentOrange : AppTheme.borderSubtle,
                          ),
                        ),
                        onSelected: (val) {
                          setState(() {
                            if (val) {
                              _selectedSizes.add(szLabel);
                            } else {
                              _selectedSizes.remove(szLabel);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 4. Multi-Select Base Colours
                  _buildSectionTitle('Base Colour Palette', _selectedBaseColours.length),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.baseColours.map((col) {
                      final selected = _selectedBaseColours.contains(col);
                      final dotColor = _getColorForBaseName(col);
                      return FilterChip(
                        showCheckmark: selected,
                        checkmarkColor: selected && (col == 'White' || col == 'Bianco' || col == 'Ivory' || col == 'Crema')
                            ? AppTheme.primaryNavy
                            : Colors.white,
                        avatar: Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: dotColor,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.grey.shade400, width: 1),
                          ),
                        ),
                        label: Text(col),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        backgroundColor: Colors.grey.shade100,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight: selected ? FontWeight.bold : FontWeight.w500,
                          fontSize: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: selected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
                          ),
                        ),
                        onSelected: (val) {
                          setState(() {
                            if (val) {
                              _selectedBaseColours.add(col);
                            } else {
                              _selectedBaseColours.remove(col);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 5. Multi-Select Spaces & Applications
                  _buildSectionTitle('Spaces & Applications', _selectedSpaces.length),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.spaces.map((sp) {
                      final selected = _selectedSpaces.contains(sp);
                      return FilterChip(
                        showCheckmark: true,
                        checkmarkColor: Colors.white,
                        label: Text(sp),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        backgroundColor: Colors.grey.shade100,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight: selected ? FontWeight.bold : FontWeight.w500,
                          fontSize: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: selected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
                          ),
                        ),
                        onSelected: (val) {
                          setState(() {
                            if (val) {
                              _selectedSpaces.add(sp);
                            } else {
                              _selectedSpaces.remove(sp);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),

                  // 6. Multi-Select Design Collections
                  _buildSectionTitle('Design Collections', _selectedCollections.length),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ProductEnums.collections.map((coll) {
                      final selected = _selectedCollections.contains(coll);
                      return FilterChip(
                        showCheckmark: true,
                        checkmarkColor: Colors.white,
                        label: Text(coll),
                        selected: selected,
                        selectedColor: AppTheme.primaryNavy,
                        backgroundColor: Colors.grey.shade100,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppTheme.textDark,
                          fontWeight: selected ? FontWeight.bold : FontWeight.w500,
                          fontSize: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: selected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
                          ),
                        ),
                        onSelected: (val) {
                          setState(() {
                            if (val) {
                              _selectedCollections.add(coll);
                            } else {
                              _selectedCollections.remove(coll);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),

          // Bottom Button Actions (Reset All & Apply Filters with Live Count)
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
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _clearAll,
                      child: const Text('Reset All'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryNavy,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        widget.onApplyFilter(
                          ProductFilterCriteria(
                            selectedSpaces: _selectedSpaces,
                            selectedSurfaces: _selectedSurfaces,
                            selectedBaseColours: _selectedBaseColours,
                            selectedCollections: _selectedCollections,
                            selectedProductType: _productType,
                            selectedSizes: _selectedSizes,
                          ),
                        );
                        Navigator.pop(context);
                      },
                      child: Text(
                        matchingCount > 0
                            ? 'Show $matchingCount ${matchingCount == 1 ? "Tile" : "Tiles"}'
                            : 'No Tiles Found (0)',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
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

  Widget _buildSectionTitle(String title, int count) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: AppTheme.primaryNavy,
            letterSpacing: 0.3,
          ),
        ),
        if (count > 0) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppTheme.primaryNavy,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

