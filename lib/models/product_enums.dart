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
      'id': 'marble_collection',
      'label': 'Marble Collection',
      'subtitle': 'Timeless luxury & endless veining.',
      'image': 'assets/images/Home/Slab_tile.jpg',
      'isComingSoon': false,
      'isDark': false,
      'icon': 'auto_awesome',
    },
    {
      'id': 'quartz_surfaces',
      'label': 'Quartz Surfaces',
      'subtitle': 'Engineered durability with refined finish.',
      'image': 'assets/images/Home/Quartz_surface.jpg',
      'isComingSoon': false,
      'isDark': false,
      'icon': 'diamond',
    },
  ];

  // Tile Sizes
  static const List<Map<String, dynamic>> sizes = [
    {
      'label': '1200x1800 mm',
      'aspectRatio': 0.667,
      'pcsPerBox': 1,
      'sqFtPerBox': 23.25,
    },
    {
      'label': '800x1600 mm',
      'aspectRatio': 0.5,
      'pcsPerBox': 2,
      'sqFtPerBox': 27.55,
    },
    {
      'label': '600x1200 mm',
      'aspectRatio': 0.5,
      'pcsPerBox': 2,
      'sqFtPerBox': 15.5,
    },
    {
      'label': '600x800 mm',
      'aspectRatio': 0.75,
      'pcsPerBox': 3,
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

  // Base Colours (Derived from production tile catalog)
  static const List<String> baseColours = [
    'White',
    'Grey',
    'Beige',
    'Bianco',
    'Brown',
    'Blue',
    'Aqua',
    'Crema',
    'Ivory',
  ];

  // Spaces
  static const List<String> spaces = [
    'Living Room',
    'Bath Room',
    'Bedroom',
    'Outdoor',
  ];

  // Design Collections (Derived from production tile catalog)
  static const List<String> collections = [
    'Marble - Endless',
    'Marble - Random',
    'Décor - Endless',
    'Plain Colors',
  ];

  // Product Types
  static const List<String> productTypes = [
    'Vitrified',
    'Ceramic',
  ];
}
