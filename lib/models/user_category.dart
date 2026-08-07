class UserCategory {
  final String id;
  final String label;

  const UserCategory({
    required this.id,
    required this.label,
  });

  static const List<UserCategory> allCategories = [
    UserCategory(id: 'dealer', label: 'Tile Dealer / Showroom'),
    UserCategory(id: 'architect', label: 'Architect / Interior Designer'),
    UserCategory(id: 'builder', label: 'Builder / Contractor'),
    UserCategory(id: 'wholesaler', label: 'Wholesaler / Distributor'),
    UserCategory(id: 'retailer', label: 'Retailer'),
  ];
}
