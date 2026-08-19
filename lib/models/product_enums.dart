/// Master Product Enums & Master Constants according to Client Specification
class ProductEnums {
  // Tile Categories
  static const List<Map<String, dynamic>> tileCategories = [
    {
      'id': 'floor_tiles',
      'label': 'Floor Tiles',
      'isComingSoon': false,
      'icon': 'grid_view',
    },
    {
      'id': 'wall_tiles',
      'label': 'Wall Tiles',
      'isComingSoon': false,
      'icon': 'wallpaper',
    },
    {
      'id': 'slab_tiles',
      'label': 'Slab Tiles',
      'isComingSoon': true,
      'icon': 'crop_landscape',
    },
    {
      'id': 'heavy_duty_parkings',
      'label': 'Heavy Duty Parkings',
      'isComingSoon': true,
      'icon': 'local_parking',
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
    'Semi High Gloss',
    'High Gloss',
    'Anti - Skid',
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
