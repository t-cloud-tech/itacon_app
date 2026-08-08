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

  /// Get category label by [id]. Returns 'Unknown' if category is not found.
  static String getLabel(String id) {
    try {
      return allCategories
          .firstWhere((cat) => cat.id.toLowerCase() == id.toLowerCase())
          .label;
    } catch (_) {
      return 'Unknown';
    }
  }

  /// Checks if [id] is a valid registered user category.
  static bool isValidCategory(String id) {
    return allCategories.any((cat) => cat.id.toLowerCase() == id.toLowerCase());
  }

  /// List of all category IDs.
  static List<String> get categoryIds =>
      allCategories.map((c) => c.id).toList();
}

