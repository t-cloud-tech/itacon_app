import 'package:flutter/foundation.dart';
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

  /// Web VAPID public key. Can be provided via --dart-define=FCM_WEB_VAPID_KEY=...
  /// If empty, web push registration is safely skipped to avoid browser exceptions.
  static const String webVapidKey =
      String.fromEnvironment('FCM_WEB_VAPID_KEY', defaultValue: '');

  /// Global navigator key allowing navigation from notification callbacks
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static RemoteMessage? _pendingMessage;
  static bool _isAppReady = false;
  static final Set<String> _recentForegroundAlertIds = {};

  /// Retrieves the device FCM token safely across both mobile and web.
  /// On web, skips registration gracefully if webVapidKey is empty or unconfigured.
  static Future<String?> _getTokenSafely() async {
    try {
      if (kIsWeb) {
        if (webVapidKey.isEmpty) {
          debugPrint('[NotificationService] FCM_WEB_VAPID_KEY not configured. Web push registration safely skipped.');
          return null;
        }
        return await _messaging.getToken(vapidKey: webVapidKey);
      } else {
        return await _messaging.getToken();
      }
    } catch (e) {
      debugPrint('[NotificationService] getTokenSafely non-fatal error: $e');
      return null;
    }
  }

  /// Explicitly requests notification permission on Web following user interaction.
  static Future<NotificationSettings?> requestWebNotificationPermission() async {
    try {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        final token = await _getTokenSafely();
        if (token != null && token.isNotEmpty) {
          await _saveToken(token);
        }
      }
      return settings;
    } catch (e) {
      debugPrint('[NotificationService] requestWebNotificationPermission error: $e');
      return null;
    }
  }

  static Future<void> initialize() async {
    if (!kIsWeb) {
      try {
        // Ask notification permission (Android 13+ and iOS)
        await _messaging.requestPermission(
          alert: true,
          badge: true,
          sound: true,
        );

        if (defaultTargetPlatform == TargetPlatform.iOS) {
          // Explicitly configure iOS foreground notification presentation:
          // Keep alert false to avoid duplicate system banner while in-app luxury SnackBar handles foreground alerts,
          // and allow native badge updates and sound.
          await _messaging.setForegroundNotificationPresentationOptions(
            alert: false,
            badge: true,
            sound: true,
          );
        }
      } catch (e) {
        debugPrint('[NotificationService] Permission/presentation request non-fatal error: $e');
      }
    }

    try {
      // Get FCM token safely
      final token = await _getTokenSafely();

      if (token != null && token.isNotEmpty) {
        debugPrint('[NotificationService] FCM Token initialized successfully');
        await _saveToken(token);
      }
    } catch (e) {
      debugPrint('[NotificationService] Initial token retrieval non-fatal error: $e');
    }

    // Token can change in the future
    _messaging.onTokenRefresh.listen((newToken) async {
      debugPrint('[NotificationService] FCM Token refreshed');
      await _saveToken(newToken);
    }).onError((error) {
      debugPrint('[NotificationService] onTokenRefresh non-fatal error: $error');
    });

    // App is open (foreground) and receives a notification
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[NotificationService] Foreground notification received');
      debugPrint('[NotificationService] Title: ${message.notification?.title}');
      debugPrint('[NotificationService] Body: ${message.notification?.body}');
      _handleForegroundNotification(message);
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
      final token = await _getTokenSafely();

      if (token == null || token.isEmpty) {
        debugPrint('[NotificationService] Cannot save FCM token: token is empty or skipped on web.');
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

  /// Displays an in-app luxury banner when a notification is received in the foreground
  static void _handleForegroundNotification(RemoteMessage message) {
    final title = message.notification?.title ?? message.data['title'] ?? 'ITACON Granito';
    final body = message.notification?.body ?? message.data['message'] ?? message.data['body'] ?? '';
    final dedupeKey = message.messageId ??
        '${message.data['notificationId']}_${message.data['orderId']}_${message.data['offerId']}_${title}_$body';

    // Prevent duplicate foreground alerts
    if (_recentForegroundAlertIds.contains(dedupeKey)) {
      debugPrint('[NotificationService] Duplicate foreground alert suppressed: $dedupeKey');
      return;
    }
    _recentForegroundAlertIds.add(dedupeKey);
    if (_recentForegroundAlertIds.length > 50) {
      _recentForegroundAlertIds.remove(_recentForegroundAlertIds.first);
    }

    final context = navigatorKey.currentContext;
    if (context == null) {
      debugPrint('[NotificationService] No active context to show foreground alert');
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final messenger = ScaffoldMessenger.maybeOf(context);
      if (messenger == null) return;

      messenger.hideCurrentSnackBar();
      messenger.showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFF0E274D), // AppTheme.primaryNavy
          elevation: 6,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFFFF8F00), width: 1), // AppTheme.accentOrange
          ),
          duration: const Duration(seconds: 5),
          content: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF8F00).withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.notifications_active_rounded,
                  color: Color(0xFFFF8F00),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (body.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        body,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          action: SnackBarAction(
            label: 'VIEW',
            textColor: const Color(0xFFFF8F00),
            onPressed: () {
              handleNotificationNavigation(message);
            },
          ),
        ),
      );
    });
  }

  /// Safely removes FCM device token association in Firestore on logout
  static Future<void> clearTokenOnLogout(String userId) async {
    if (userId.isEmpty) return;
    try {
      final currentToken = await _getTokenSafely().timeout(
        const Duration(seconds: 2),
        onTimeout: () => null,
      );
      if (currentToken != null && currentToken.isNotEmpty) {
        await _firestoreService
            .removeFcmTokenIfMatches(userId, currentToken)
            .timeout(const Duration(seconds: 2), onTimeout: () {});
        debugPrint('[NotificationService] Cleaned up FCM device token for user $userId on logout.');
      }
    } catch (e) {
      debugPrint('[NotificationService] Error clearing FCM token on logout: $e');
    }
  }
}
