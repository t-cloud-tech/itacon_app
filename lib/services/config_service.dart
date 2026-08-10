import 'package:cloud_firestore/cloud_firestore.dart';

/// Configuration service for managing system feature flags and remote configs in Cloud Firestore.
/// Controls document `systemConfigs/app_features` per Firestore schema.
class ConfigService {
  final FirebaseFirestore? _db;

  ConfigService({FirebaseFirestore? firestore}) : _db = firestore;

  FirebaseFirestore get firestore => _db ?? FirebaseFirestore.instance;

  DocumentReference<Map<String, dynamic>> get _appFeaturesRef =>
      firestore.collection('systemConfigs').doc('app_features');

  bool _enableTransportation = false;

  /// Boolean getter `enableTransportation` (defaults to false) to control UI visibility
  bool get enableTransportation => _enableTransportation;

  /// Streams the `systemConfigs/app_features` document snapshot
  Stream<DocumentSnapshot<Map<String, dynamic>>> streamAppFeatures() {
    return _appFeaturesRef.snapshots();
  }

  /// Streams the `enableTransportation` boolean feature flag
  Stream<bool> streamEnableTransportation() {
    return _appFeaturesRef.snapshots().map((snapshot) {
      if (snapshot.exists && snapshot.data() != null) {
        final data = snapshot.data()!;
        _enableTransportation = (data['enableTransportation'] as bool?) ?? false;
        return _enableTransportation;
      }
      _enableTransportation = false;
      return false;
    });
  }

  /// Fetches the `systemConfigs/app_features` document map once
  Future<Map<String, dynamic>?> fetchAppFeatures() async {
    try {
      final snapshot = await _appFeaturesRef.get();
      if (snapshot.exists && snapshot.data() != null) {
        final data = snapshot.data()!;
        _enableTransportation = (data['enableTransportation'] as bool?) ?? false;
        return data;
      }
      _enableTransportation = false;
      return null;
    } catch (_) {
      _enableTransportation = false;
      return null;
    }
  }

  /// Fetches the `enableTransportation` flag value once
  Future<bool> fetchEnableTransportation() async {
    final features = await fetchAppFeatures();
    if (features != null && features.containsKey('enableTransportation')) {
      _enableTransportation = features['enableTransportation'] as bool? ?? false;
      return _enableTransportation;
    }
    _enableTransportation = false;
    return false;
  }

  /// Updates system feature flags in `systemConfigs/app_features`
  Future<void> updateAppFeatures(Map<String, dynamic> features) async {
    await _appFeaturesRef.set(features, SetOptions(merge: true));
    if (features.containsKey('enableTransportation')) {
      _enableTransportation = features['enableTransportation'] as bool? ?? false;
    }
  }

  /// Sets the `enableTransportation` feature flag specifically
  Future<void> setEnableTransportation(bool enabled) async {
    _enableTransportation = enabled;
    await _appFeaturesRef.set({
      'enableTransportation': enabled,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }
}
