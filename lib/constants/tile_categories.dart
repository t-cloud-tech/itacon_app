/// Matrix of Standard Tile Size Categories and Surface Finishes for ITACON Granito
class TileSizeCategory {
  final String id;
  final String sizeMm; // e.g. '1200x1800 mm'
  final String sizeCm; // e.g. '120x180 cm'
  final String name; // e.g. 'Jumbo Grand Slab'
  final String description; // e.g. 'Seamless luxury grand format slabs'
  final double aspectRatio; // e.g. 0.667 (2:3)
  final String aspectRatioLabel; // e.g. '2:3'
  final String imageUrl;
  final int pcsPerBox;
  final double sqFtPerBox;

  const TileSizeCategory({
    required this.id,
    required this.sizeMm,
    required this.sizeCm,
    required this.name,
    required this.description,
    required this.aspectRatio,
    required this.aspectRatioLabel,
    required this.imageUrl,
    this.pcsPerBox = 2,
    this.sqFtPerBox = 15.5,
  });
}

class TileCategoriesMatrix {
  /// 4 Primary Standard Size Groups per ITACON Product Standard
  static const List<TileSizeCategory> sizeCategories = [
    TileSizeCategory(
      id: 'size_1218',
      sizeMm: '1200x1800 mm',
      sizeCm: '120x180 cm',
      name: 'Jumbo Grand Slab',
      description: 'Ultra-luxurious grand slabs for expansive living rooms & grand facades',
      aspectRatio: 0.667,
      aspectRatioLabel: '2:3',
      imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
      pcsPerBox: 2,
      sqFtPerBox: 23.25,
    ),
    TileSizeCategory(
      id: 'size_8016',
      sizeMm: '800x1600 mm',
      sizeCm: '80x160 cm',
      name: 'Large Luxury Slab',
      description: 'Elegant vertical format for modern architectural interiors',
      aspectRatio: 0.50,
      aspectRatioLabel: '1:2',
      imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
      pcsPerBox: 2,
      sqFtPerBox: 27.55,
    ),
    TileSizeCategory(
      id: 'size_6012',
      sizeMm: '600x1200 mm',
      sizeCm: '60x120 cm',
      name: 'Standard Vertical Slab',
      description: 'The most popular versatile size for premium floor & wall tiling',
      aspectRatio: 0.50,
      aspectRatioLabel: '1:2',
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
      pcsPerBox: 2,
      sqFtPerBox: 15.5,
    ),
    TileSizeCategory(
      id: 'size_6080',
      sizeMm: '600x800 mm',
      sizeCm: '60x80 cm',
      name: 'Medium Vertical Format',
      description: 'Compact vertical proportion ideal for bathrooms & accent feature walls',
      aspectRatio: 0.75,
      aspectRatioLabel: '3:4',
      imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      pcsPerBox: 3,
      sqFtPerBox: 15.5,
    ),
  ];

  /// Standard Surface Finishes Matrix
  static const List<String> surfaceFinishes = [
    'All Surfaces',
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
}
