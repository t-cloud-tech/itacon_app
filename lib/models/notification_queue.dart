import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents an Outgoing Notification Event in Firestore (Steps 6 & 9 of Flow)
/// Dispatches notifications to Company Email, WhatsApp, Salesperson, and Customer.
class NotificationQueueItem {
  final String id;
  final String orderId;
  final String orderReferenceNumber;
  final String eventType; // 'order_placed_step6', 'estimate_approved_step9'
  final List<String> recipients; // ['company_email', 'company_whatsapp', 'salesperson', 'customer']
  final Map<String, dynamic> payload; // Summary message, customer details, PO details
  final String status; // 'queued', 'sent'
  final DateTime? createdAt;

  const NotificationQueueItem({
    required this.id,
    required this.orderId,
    required this.orderReferenceNumber,
    required this.eventType,
    required this.recipients,
    required this.payload,
    this.status = 'queued',
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'orderId': orderId,
      'orderReferenceNumber': orderReferenceNumber,
      'eventType': eventType,
      'recipients': recipients,
      'payload': payload,
      'status': status,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  factory NotificationQueueItem.fromMap(Map<String, dynamic> map, String docId) {
    return NotificationQueueItem(
      id: docId,
      orderId: map['orderId'] ?? '',
      orderReferenceNumber: map['orderReferenceNumber'] ?? '',
      eventType: map['eventType'] ?? 'order_placed_step6',
      recipients: List<String>.from(map['recipients'] ?? []),
      payload: Map<String, dynamic>.from(map['payload'] ?? {}),
      status: map['status'] ?? 'queued',
      createdAt: map['createdAt'] is Timestamp
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }
}
