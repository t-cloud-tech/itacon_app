class UserCategory {
  final String id;
  final String label;

  const UserCategory({
    required this.id,
    required this.label,
  });

  /// The standard user categories available in the system for business partners/customers.
  /// Note: Salesperson data is handled separately in the database and NOT included here.
  static const List<UserCategory> allCategories = [
    UserCategory(id: 'dealer', label: 'Tile Dealer / Showroom'),
    UserCategory(id: 'architect', label: 'Architect / Interior Designer'),
    UserCategory(id: 'builder', label: 'Builder / Contractor'),
    UserCategory(id: 'wholesaler', label: 'Wholesaler / Distributor'),
    UserCategory(id: 'retailer', label: 'Retailer'),
  ];

  /// The exact canonical category values expected for Signup and Profile displays.
  static const List<String> canonicalCategories = [
    'Dealer',
    'Architect / Interior Designer',
    'Builder / Contractor',
    'Wholesaler',
    'Retailer',
  ];

  /// Get category label by [id] or canonical name. Returns 'Unknown' if category is not found.
  static String getLabel(String id) {
    try {
      final clean = id.trim().toLowerCase();
      return allCategories
          .firstWhere((cat) =>
              cat.id.toLowerCase() == clean ||
              cat.label.toLowerCase() == clean ||
              (clean == 'dealer' && cat.id == 'dealer') ||
              (clean == 'architect / interior designer' && cat.id == 'architect') ||
              (clean == 'builder / contractor' && cat.id == 'builder') ||
              (clean == 'wholesaler' && cat.id == 'wholesaler') ||
              (clean == 'retailer' && cat.id == 'retailer'))
          .label;
    } catch (_) {
      return 'Unknown';
    }
  }

  /// Checks if [id] is a valid registered user category.
  static bool isValidCategory(String id) {
    final clean = id.trim().toLowerCase();
    return allCategories.any((cat) =>
        cat.id.toLowerCase() == clean ||
        cat.label.toLowerCase() == clean ||
        clean == 'dealer' ||
        clean == 'architect / interior designer' ||
        clean == 'builder / contractor' ||
        clean == 'wholesaler' ||
        clean == 'retailer');
  }

  /// List of all category IDs.
  static List<String> get categoryIds =>
      allCategories.map((c) => c.id).toList();

  /// Checks if [category] is one of the 5 canonical customer signup categories.
  static bool isValidCanonicalCategory(String? category) {
    if (category == null) return false;
    final trimmed = category.trim();
    if (trimmed.isEmpty) return false;
    return canonicalCategories.contains(trimmed);
  }
}

