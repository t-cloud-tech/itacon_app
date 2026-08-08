import 'package:cloud_firestore/cloud_firestore.dart';

/// Notification Document in `notifications` collection per PDF schema
class NotificationQueueItem {
  final String notificationId; // Notification ID
  final String recipientId; // User receiving notification
  final String type; // order / estimate / price_list etc.
  final String event; // order_placed / estimate_ready etc.
  final String title; // Notification title
  final String message; // Notification message
  final String relatedOrderId; // Related order ID
  final String relatedEstimateId; // Related estimate ID
  final Map<String, dynamic> channels; // inApp / email / whatsapp
  final String status; // pending / sent / failed
  final String orderId;
  final String orderReferenceNumber;
  final List<String> recipients;
  final Map<String, dynamic> payload;
  final DateTime? createdAt;
  final DateTime? sentAt;

  const NotificationQueueItem({
    required this.notificationId,
    required this.recipientId,
    required this.type,
    required this.event,
    required this.title,
    required this.message,
    this.relatedOrderId = '',
    this.relatedEstimateId = '',
    this.channels = const {'inApp': true, 'email': true, 'whatsapp': true},
    this.status = 'pending',
    this.orderId = '',
    this.orderReferenceNumber = '',
    this.recipients = const [],
    this.payload = const {},
    this.createdAt,
    this.sentAt,
  });

  String get id => notificationId;

  Map<String, dynamic> toMap() {
    return {
      'notificationId': notificationId,
      'id': notificationId,
      'recipientId': recipientId,
      'type': type,
      'event': event,
      'eventType': event,
      'title': title,
      'message': message,
      'relatedOrderId': relatedOrderId.isNotEmpty ? relatedOrderId : orderId,
      'relatedEstimateId': relatedEstimateId,
      'channels': channels,
      'status': status,
      'orderId': orderId.isNotEmpty ? orderId : relatedOrderId,
      'orderReferenceNumber': orderReferenceNumber,
      'recipients': recipients,
      'payload': payload.isNotEmpty
          ? payload
          : {
              'title': title,
              'message': message,
              'orderId': relatedOrderId,
            },
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'sentAt': sentAt != null ? Timestamp.fromDate(sentAt!) : null,
    };
  }

  factory NotificationQueueItem.fromMap(Map<String, dynamic> map, String docId) {
    return NotificationQueueItem(
      notificationId: docId,
      recipientId: map['recipientId'] ?? map['userId'] ?? '',
      type: map['type'] ?? 'order',
      event: map['event'] ?? map['eventType'] ?? 'order_placed',
      title: map['title'] ?? 'Order Notification',
      message: map['message'] ?? '',
      relatedOrderId: map['relatedOrderId'] ?? map['orderId'] ?? '',
      relatedEstimateId: map['relatedEstimateId'] ?? '',
      channels: Map<String, dynamic>.from(map['channels'] ?? {'inApp': true, 'email': true, 'whatsapp': true}),
      status: map['status'] ?? 'pending',
      orderId: map['orderId'] ?? map['relatedOrderId'] ?? '',
      orderReferenceNumber: map['orderReferenceNumber'] ?? '',
      recipients: List<String>.from(map['recipients'] ?? []),
      payload: Map<String, dynamic>.from(map['payload'] ?? {}),
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
      sentAt: map['sentAt'] is Timestamp
          ? (map['sentAt'] as Timestamp).toDate()
          : null,
    );
  }
}
