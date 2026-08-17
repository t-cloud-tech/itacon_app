import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents system configuration for document `systemConfigs/app_features`
class SystemConfigModel {
  final bool enableTransportation;
  final String appVersion;
  final bool maintenanceMode;

  const SystemConfigModel({
    this.enableTransportation = false,
    this.appVersion = '1.0.0',
    this.maintenanceMode = false,
  });

  Map<String, dynamic> toMap() {
    return {
      'enableTransportation': enableTransportation,
      'appVersion': appVersion,
      'maintenanceMode': maintenanceMode,
    };
  }

  factory SystemConfigModel.fromMap(Map<String, dynamic> map) {
    return SystemConfigModel(
      enableTransportation: map['enableTransportation'] as bool? ?? false,
      appVersion: map['appVersion'] as String? ?? '1.0.0',
      maintenanceMode: map['maintenanceMode'] as bool? ?? false,
    );
  }

  factory SystemConfigModel.fromSnapshot(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return SystemConfigModel.fromMap(data);
  }
}
