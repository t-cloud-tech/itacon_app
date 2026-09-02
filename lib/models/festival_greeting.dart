import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a Festival & Regional Greeting record in `festivalGreetings` collection
class FestivalGreeting {
  final String greetingId;
  final String title;
  final String message;
  final String? bannerImageUrl;
  final String targetDate; // YYYY-MM-DD or MM-DD
  final List<String> applicableRegions; // ['All'] or specific region names
  final String type; // 'festival_greeting'
  final bool isActive;
  final DateTime? createdAt;

  const FestivalGreeting({
    required this.greetingId,
    required this.title,
    required this.message,
    this.bannerImageUrl,
    required this.targetDate,
    required this.applicableRegions,
    this.type = 'festival_greeting',
    this.isActive = true,
    this.createdAt,
  });

  String get id => greetingId;

  Map<String, dynamic> toMap() {
    return {
      'greetingId': greetingId,
      'id': greetingId,
      'title': title,
      'message': message,
      'bannerImageUrl': bannerImageUrl,
      'targetDate': targetDate,
      'applicableRegions': applicableRegions,
      'type': type,
      'isActive': isActive,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory FestivalGreeting.fromMap(Map<String, dynamic> map, String docId) {
    return FestivalGreeting(
      greetingId: docId,
      title: map['title'] ?? '',
      message: map['message'] ?? '',
      bannerImageUrl: map['bannerImageUrl'] as String?,
      targetDate: map['targetDate'] ?? '',
      applicableRegions: List<String>.from(map['applicableRegions'] ?? ['All']),
      type: map['type'] ?? 'festival_greeting',
      isActive: map['isActive'] ?? true,
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }
}
