/// Master Product Enums & Master Constants according to Client Specification
class ProductEnums {
  // Tile Categories
  static const List<Map<String, dynamic>> tileCategories = [
    {
      'id': 'floor_tiles',
      'label': 'Floor Tiles',
      'subtitle': 'Made for everyday elegance.',
      'image': 'assets/images/Home/Floor_tile.jpg',
      'isComingSoon': false,
      'isDark': false,
      'icon': 'grid_view',
    },
    {
      'id': 'wall_tiles',
      'label': 'Wall Tiles',
      'subtitle': 'Transform ordinary walls.',
      'image': 'assets/images/Home/Wall_tile.jpg',
      'isComingSoon': false,
      'isDark': false,
      'icon': 'wall_tiles',
    },
    {
      'id': 'slab_tiles',
      'label': 'Slab Tiles',
      'subtitle': 'Statement surfaces for exceptional spaces.',
      'image': 'assets/images/Home/Slab_tile.jpg',
      'isComingSoon': true,
      'isDark': false,
      'icon': 'slab_tiles',
    },
    {
      'id': 'heavy_duty_parkings',
      'label': 'Heavy Duty Parking',
      'subtitle': 'Performance without compromise.',
      'image': 'assets/images/Home/Parking_tile.jpg',
      'isComingSoon': true,
      'isDark': true,
      'icon': 'parking',
    },
  ];

  // Tile Sizes
  static const List<Map<String, dynamic>> sizes = [
    {
      'label': '600x1200 mm',
      'aspectRatio': 0.5,
      'pcsPerBox': 2,
      'sqFtPerBox': 15.5,
    },
    {
      'label': '600x600 mm',
      'aspectRatio': 1.0,
      'pcsPerBox': 4,
      'sqFtPerBox': 15.5,
    },
  ];

  // Tile Surfaces
  static const List<String> surfaces = [
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

  // Base Colours
  static const List<String> baseColours = [
    'White',
    'Beige - Brown',
    'Bianco - Grey',
    'Nero',
    'Black',
  ];

  // Spaces
  static const List<String> spaces = [
    'Living Room',
    'Bath Room',
    'Bedroom',
    'Outdoor',
  ];

  // Collections
  static const List<String> collections = [
    'Endless',
    'Marbles',
    'Golden',
    'Terrazzo',
    '3D',
    'Book Match',
    'Wall Decore',
    'Moracan',
  ];

  // Product Types
  static const List<String> productTypes = [
    'Vitrified',
    'Ceramic',
  ];
}
