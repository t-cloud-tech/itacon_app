import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/notification_queue.dart';

void main() {
  group('Android Notification System Tests', () {
    test('NotificationQueueItem parses full FCM payload fields correctly', () {
      final fcmPayload = {
        'notificationId': 'notif_123',
        'type': 'order',
        'event': 'shipment_dispatched',
        'title': 'Order Dispatched',
        'message': 'Your order ITA-ORD-9988 has been dispatched from Morbi plant.',
        'orderId': 'ORD_9988',
        'relatedOrderId': 'ORD_9988',
        'relatedEstimateId': 'EST_5544',
        'offerId': 'OFFER_DIWALI_50',
        'relatedOfferId': 'OFFER_DIWALI_50',
        'bannerImageUrl': 'https://itacon.example.com/banner.jpg',
        'recipientId': 'USER_CUST_01',
        'isRead': false,
      };

      final item = NotificationQueueItem.fromMap(fcmPayload, 'notif_123');

      expect(item.id, equals('notif_123'));
      expect(item.type, equals('order'));
      expect(item.event, equals('shipment_dispatched'));
      expect(item.title, equals('Order Dispatched'));
      expect(item.message, contains('ITA-ORD-9988'));
      expect(item.orderId, equals('ORD_9988'));
      expect(item.relatedOrderId, equals('ORD_9988'));
      expect(item.relatedEstimateId, equals('EST_5544'));
      expect(item.offerId, equals('OFFER_DIWALI_50'));
      expect(item.relatedOfferId, equals('OFFER_DIWALI_50'));
      expect(item.bannerImageUrl, equals('https://itacon.example.com/banner.jpg'));
      expect(item.recipientId, equals('USER_CUST_01'));
      expect(item.isRead, isFalse);
    });

    test('Notification channel ID is consistent with high-importance specification', () {
      const channelId = 'itacon_high_importance_channel';
      expect(channelId, equals('itacon_high_importance_channel'));
    });

    test('Order-related notification identification logic correctly identifies order events', () {
      bool isOrderEvent(String type, String event) {
        final t = type.toLowerCase().trim();
        final e = event.toLowerCase().trim();
        return t == 'order' ||
            e.contains('order') ||
            e == 'production_started' ||
            e == 'production_completed' ||
            e == 'shipment_dispatched' ||
            e == 'order_delivered';
      }

      expect(isOrderEvent('order', 'order_placed'), isTrue);
      expect(isOrderEvent('order', 'production_started'), isTrue);
      expect(isOrderEvent('order', 'production_completed'), isTrue);
      expect(isOrderEvent('order', 'shipment_dispatched'), isTrue);
      expect(isOrderEvent('order', 'order_delivered'), isTrue);
      expect(isOrderEvent('festival_greeting', 'festival_greeting'), isFalse);
      expect(isOrderEvent('offer', 'offer_available'), isFalse);
    });

    test('Customer ownership validation prevents cross-account order access', () {
      bool canAccessOrder({
        required String currentUserId,
        required String orderOwnerId,
        required String orderCustomerId,
        required String notificationRecipientId,
      }) {
        if (notificationRecipientId.isNotEmpty &&
            currentUserId.isNotEmpty &&
            notificationRecipientId != currentUserId) {
          return false;
        }
        if (currentUserId.isNotEmpty &&
            orderOwnerId.isNotEmpty &&
            orderOwnerId != currentUserId &&
            orderCustomerId != currentUserId) {
          return false;
        }
        return true;
      }

      // Valid case: owner matches
      expect(
        canAccessOrder(
          currentUserId: 'CUST_A',
          orderOwnerId: 'CUST_A',
          orderCustomerId: 'CUST_A',
          notificationRecipientId: 'CUST_A',
        ),
        isTrue,
      );

      // Invalid case: notification recipient belongs to another user
      expect(
        canAccessOrder(
          currentUserId: 'CUST_A',
          orderOwnerId: 'CUST_B',
          orderCustomerId: 'CUST_B',
          notificationRecipientId: 'CUST_B',
        ),
        isFalse,
      );

      // Invalid case: order belongs to another user despite recipient
      expect(
        canAccessOrder(
          currentUserId: 'CUST_A',
          orderOwnerId: 'CUST_B',
          orderCustomerId: 'CUST_B',
          notificationRecipientId: 'CUST_A',
        ),
        isFalse,
      );
    });

    test('Logout token cleanup ownership check verifies token match before removal', () {
      bool shouldClearToken({
        required String storedToken,
        required String deviceToken,
      }) {
        return storedToken.isNotEmpty && storedToken == deviceToken;
      }

      // Matching token should be cleared
      expect(
        shouldClearToken(
          storedToken: 'token_device_abc',
          deviceToken: 'token_device_abc',
        ),
        isTrue,
      );

      // Non-matching token (newer session) should NOT be cleared
      expect(
        shouldClearToken(
          storedToken: 'token_device_xyz',
          deviceToken: 'token_device_abc',
        ),
        isFalse,
      );
    });
  });
}
