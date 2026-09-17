import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../screens/notifications_screen.dart';
import '../screens/order_details_screen.dart';
import 'app_state_service.dart';
import 'firestore_service.dart';

class NotificationService {
  static final FirebaseMessaging _messaging =
      FirebaseMessaging.instance;

  static final FirestoreService _firestoreService =
      FirestoreService.instance;

  /// Global navigator key allowing navigation from notification callbacks
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static RemoteMessage? _pendingMessage;
  static bool _isAppReady = false;

  static Future<void> initialize() async {
    // Ask notification permission
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Get FCM token
    final token = await _messaging.getToken();

    if (token != null && token.isNotEmpty) {
      debugPrint('[NotificationService] FCM TOKEN: $token');
      await _saveToken(token);
    }

    // Token can change in the future
    _messaging.onTokenRefresh.listen((newToken) async {
      debugPrint('[NotificationService] NEW FCM TOKEN: $newToken');
      await _saveToken(newToken);
    });

    // App is open (foreground) and receives a notification
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[NotificationService] Foreground notification received');
      debugPrint('[NotificationService] Title: ${message.notification?.title}');
      debugPrint('[NotificationService] Body: ${message.notification?.body}');
    });

    // User taps a notification while app is in background (Case B)
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[NotificationService] Notification opened from background');
      debugPrint('[NotificationService] Data: ${message.data}');
      handleNotificationNavigation(message);
    });

    // User taps a notification that launched the app from terminated state (Case A)
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      debugPrint('[NotificationService] App launched from terminated notification');
      debugPrint('[NotificationService] Data: ${initialMessage.data}');
      if (_isAppReady && navigatorKey.currentState != null) {
        handleNotificationNavigation(initialMessage);
      } else {
        _pendingMessage = initialMessage;
      }
    }
  }

  /// Marks app as ready to safely navigate after initial routes mount
  static void onAppReady() {
    _isAppReady = true;
    if (_pendingMessage != null) {
      final msg = _pendingMessage!;
      _pendingMessage = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        handleNotificationNavigation(msg);
      });
    }
  }

  /// Handles deep-link navigation based on FCM payload data
  static Future<void> handleNotificationNavigation(RemoteMessage message) async {
    final nav = navigatorKey.currentState;
    if (nav == null) {
      debugPrint('[NotificationService] NavigatorState not ready yet; queuing message.');
      _pendingMessage = message;
      return;
    }

    final data = message.data;
    debugPrint('[NotificationService] Handling notification navigation with data: $data');

    final type = (data['type'] ?? '').toString().toLowerCase().trim();
    final event = (data['event'] ?? '').toString().toLowerCase().trim();
    final orderId = (data['orderId'] ?? '').toString().trim();
    final relatedEstimateId = (data['relatedEstimateId'] ?? '').toString().trim();
    final offerId = (data['offerId'] ?? data['relatedOfferId'] ?? '').toString().trim();
    final notificationId = (data['notificationId'] ?? '').toString().trim();

    // Mark as read in Firestore if current user is logged in
    final currentUserId = AppStateService.instance.currentUserProfile.userId;
    if (currentUserId.isNotEmpty && notificationId.isNotEmpty) {
      try {
        await _firestoreService.markNotificationAsRead(currentUserId, notificationId);
      } catch (e) {
        debugPrint('[NotificationService] Error marking notification read: $e');
      }
    }

    Widget? destinationScreen;

    // 1. Order-related notification
    final isOrderRelated = type == 'order' ||
        event.contains('order') ||
        event == 'production_started' ||
        event == 'production_completed' ||
        event == 'shipment_dispatched' ||
        event == 'order_delivered';

    // 2. Estimate / Quotation-related notification
    final isEstimateRelated = type == 'estimate' ||
        type == 'quotation' ||
        event.contains('estimate') ||
        event.contains('quotation');

    // 3. Offer-related notification
    final isOfferRelated = type == 'offer' ||
        event == 'offer_available' ||
        event.contains('offer');

    if (isOrderRelated && orderId.isNotEmpty) {
      destinationScreen = OrderDetailsScreen(orderId: orderId);
    } else if (isEstimateRelated) {
      if (orderId.isNotEmpty) {
        destinationScreen = OrderDetailsScreen(orderId: orderId);
      } else if (relatedEstimateId.isNotEmpty) {
        try {
          final estimate = await _firestoreService.getEstimate(relatedEstimateId);
          if (estimate != null && estimate.orderId.isNotEmpty) {
            destinationScreen = OrderDetailsScreen(orderId: estimate.orderId);
          }
        } catch (e) {
          debugPrint('[NotificationService] Error resolving orderId from estimate: $e');
        }
      }
    } else if (isOfferRelated) {
      debugPrint('[NotificationService] Identified offer notification (offerId: $offerId). Directing to NotificationsScreen.');
      destinationScreen = const NotificationsScreen();
    }

    // 4. Fallback for festival_greeting, announcement, price_list, or missing IDs
    destinationScreen ??= const NotificationsScreen();

    // Push the resolved destination screen onto navigation stack
    nav.push(
      MaterialPageRoute(builder: (_) => destinationScreen!),
    );
  }

  static Future<void> _saveToken(String token) async {
    final userId =
        AppStateService.instance.currentUserProfile.userId;

    if (userId.isEmpty) {
      debugPrint('[NotificationService] FCM token not saved: user is not logged in yet.');
      return;
    }

    try {
      await _firestoreService.saveFcmToken(
        userId,
        token,
      );

      debugPrint('[NotificationService] FCM token saved to Firestore.');
    } catch (e) {
      debugPrint('[NotificationService] Failed to save FCM token: $e');
    }
  }

  static Future<void> saveCurrentUserToken() async {
    final userId =
        AppStateService.instance.currentUserProfile.userId;

    if (userId.isEmpty) {
      debugPrint('[NotificationService] Cannot save FCM token: user ID is empty.');
      return;
    }

    try {
      final token = await _messaging.getToken();

      if (token == null || token.isEmpty) {
        debugPrint('[NotificationService] Cannot save FCM token: token is empty.');
        return;
      }

      await _firestoreService.saveFcmToken(
        userId,
        token,
      );

      debugPrint('[NotificationService] FCM token saved to Firestore after login.');
    } catch (e) {
      debugPrint('[NotificationService] Failed to save FCM token after login: $e');
    }
  }
}
