const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function triggered when a new notification document is created in
 * `users/{userId}/notifications/{notificationId}`.
 *
 * Automatically fetches the user's FCM registration token from `users/{userId}`
 * and sends an FCM push notification to the user's mobile device.
 */
exports.sendFcmOnUserNotification = functions.firestore
  .document('users/{userId}/notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notificationId = context.params.notificationId;
    const userId = context.params.userId;
    const notification = snap.data();

    if (!notification) {
      console.log(`[FCM Trigger] Empty notification data for notificationId: ${notificationId}`);
      return null;
    }

    console.log(`[FCM Trigger] New notification created for user ${userId} (${notificationId}): "${notification.title}"`);

    const db = admin.firestore();

    try {
      // 1. Fetch the user document to retrieve their device FCM token
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        console.log(`[FCM Trigger] User document users/${userId} does not exist. Skipping push.`);
        return null;
      }

      const userData = userDoc.data() || {};
      const fcmToken = userData.fcmToken;

      // 2. Validate token existence
      if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim() === '') {
        console.log(`[FCM Trigger] No valid FCM registration token found for user ${userId}. Skipping push.`);
        return null;
      }

      // 3. Build the FCM message payload
      const title = notification.title || 'ITACON Granito';
      const body = notification.message || '';

      const notificationIdStr = String(notificationId || notification.notificationId || notification.id || '');
      const typeStr = String(notification.type || '');
      const eventStr = String(notification.event || notification.eventType || '');
      const orderIdStr = String(notification.orderId || notification.relatedOrderId || '');
      const relatedEstimateIdStr = String(notification.relatedEstimateId || '');
      const offerIdStr = String(notification.offerId || notification.relatedOfferId || '');
      const relatedOfferIdStr = String(notification.relatedOfferId || notification.offerId || '');
      const bannerImageUrlStr = String(
        notification.bannerImageUrl ||
        (notification.payload && notification.payload.bannerImageUrl) ||
        ''
      );

      const message = {
        token: fcmToken.trim(),
        notification: {
          title: title,
          body: body,
        },
        data: {
          notificationId: notificationIdStr,
          type: typeStr,
          event: eventStr,
          orderId: orderIdStr,
          relatedEstimateId: relatedEstimateIdStr,
          offerId: offerIdStr,
          relatedOfferId: relatedOfferIdStr,
          bannerImageUrl: bannerImageUrlStr,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'itacon_high_importance_channel',
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
      };

      // 4. Send via Firebase Admin Messaging
      const response = await admin.messaging().send(message);
      console.log(`[FCM Trigger] Push notification sent successfully to user ${userId}. FCM message ID: ${response}`);
      return response;
    } catch (error) {
      console.error(`[FCM Trigger] Error sending push notification to user ${userId} for notification ${notificationId}:`, error);
      // Return null so the function completes without retrying needlessly on client errors
      return null;
    }
  });
