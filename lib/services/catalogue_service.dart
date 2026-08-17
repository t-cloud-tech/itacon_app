import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/models.dart';

/// Service for managing Home Screen catalogue, banners, featured categories, and ready stock tiles
class CatalogueService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  CollectionReference get _promotionsRef => _db.collection('promotions');
  CollectionReference get _categoriesRef => _db.collection('categories');
  CollectionReference get _productsRef => _db.collection('products');

  /// 1. Stream active promotions banners sorted by displayOrder ascending
  Stream<List<PromotionModel>> fetchActivePromotions() {
    return _promotionsRef
        .where('isActive', isEqualTo: true)
        .orderBy('displayOrder', descending: false)
        .snapshots()
        .map((snap) =>
            snap.docs.map((doc) => PromotionModel.fromSnapshot(doc)).toList());
  }

  /// Helper Future to get active promotions banners
  Future<List<PromotionModel>> getActivePromotions() async {
    final snap = await _promotionsRef
        .where('isActive', isEqualTo: true)
        .orderBy('displayOrder', descending: false)
        .get();
    return snap.docs.map((doc) => PromotionModel.fromSnapshot(doc)).toList();
  }

  /// 2. Fetch featured categories where isFeatured == true sorted by displayOrder ascending
  Future<List<ProductCategory>> fetchFeaturedCategories() async {
    try {
      final snap = await _categoriesRef
          .where('isFeatured', isEqualTo: true)
          .orderBy('displayOrder', descending: false)
          .get();
      
      if (snap.docs.isNotEmpty) {
        return snap.docs
            .map((doc) => ProductCategory.fromMap(
                doc.data() as Map<String, dynamic>, doc.id))
            .toList();
      }

      // Fallback: If no isFeatured field query results, fetch all active categories
      final fallbackSnap = await _categoriesRef.get();
      return fallbackSnap.docs
          .map((doc) => ProductCategory.fromMap(
              doc.data() as Map<String, dynamic>, doc.id))
          .where((cat) => cat.isActive && cat.isFeatured)
          .toList();
    } catch (_) {
      final snap = await _categoriesRef.get();
      return snap.docs
          .map((doc) => ProductCategory.fromMap(
              doc.data() as Map<String, dynamic>, doc.id))
          .toList();
    }
  }

  /// 3. Fetch ready stock tiles where stockStatus == "available_now" and isActive == true
  Future<List<TileProduct>> fetchReadyStockTiles() async {
    try {
      final snap = await _productsRef
          .where('stockStatus', whereIn: ['available_now', 'available'])
          .where('isActive', isEqualTo: true)
          .get();
      
      return snap.docs
          .map((doc) => TileProduct.fromMap(
              doc.data() as Map<String, dynamic>, doc.id))
          .toList();
    } catch (_) {
      final snap = await _productsRef.get();
      return snap.docs
          .map((doc) => TileProduct.fromMap(
              doc.data() as Map<String, dynamic>, doc.id))
          .where((prod) =>
              prod.isActive &&
              (prod.stockStatus == 'available_now' ||
                  prod.stockStatus == 'available'))
          .toList();
    }
  }
}
