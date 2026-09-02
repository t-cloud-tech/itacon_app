const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Scheduled Cloud Function (Runs Daily at 07:00 AM IST)
 * Checks `festivalGreetings` for events matching today's date,
 * batch creates in-app notifications in `users/{userId}/notifications`,
 * and sends targeted FCM Push Notifications to device tokens.
 */
exports.sendRegionalGreetings = onSchedule(
  {
    schedule: '0 7 * * *', // 07:00 AM IST Daily
    timeZone: 'Asia/Kolkata',
  },
  async (event) => {
    const db = admin.firestore();
    const today = new Date();
    const isoDateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const monthDayStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; // MM-DD

    console.log(`[RegionalGreetings] Checking active festival greetings for date: ${isoDateStr} / ${monthDayStr}`);

    try {
      // Query active greetings
      const greetingsSnap = await db
        .collection('festivalGreetings')
        .where('isActive', '==', true)
        .get();

      if (greetingsSnap.empty) {
        console.log('[RegionalGreetings] No active festival greetings found.');
        return;
      }

      const matchingGreetings = [];
      greetingsSnap.forEach((doc) => {
        const data = doc.data();
        const targetDate = data.targetDate || '';
        if (targetDate === isoDateStr || targetDate.endsWith(monthDayStr)) {
          matchingGreetings.push({ id: doc.id, ...data });
        }
      });

      if (matchingGreetings.length === 0) {
        console.log(`[RegionalGreetings] No festival greetings scheduled for today (${isoDateStr}).`);
        return;
      }

      console.log(`[RegionalGreetings] Found ${matchingGreetings.length} greeting(s) for today.`);

      // Process each matching greeting
      for (const greeting of matchingGreetings) {
        const applicableRegions = greeting.applicableRegions || ['All'];
        const isAllRegions = applicableRegions.includes('All');

        let usersQuery = db.collection('users').where('status', '==', 'active');
        if (!isAllRegions && applicableRegions.length > 0) {
          usersQuery = usersQuery.where('region', 'in', applicableRegions);
        }

        const usersSnap = await usersQuery.get();
        if (usersSnap.empty) {
          console.log(`[RegionalGreetings] No targeted users found for regions: ${applicableRegions.join(', ')}`);
          continue;
        }

        console.log(`[RegionalGreetings] Dispatching greeting '${greeting.title}' to ${usersSnap.size} user(s).`);

        const fcmTokens = [];
        let batch = db.batch();
        let operationCount = 0;

        for (const userDoc of usersSnap.docs) {
          const userData = userDoc.data();
          const userId = userDoc.id;

          // Collect FCM Token
          if (userData.fcmToken) {
            fcmTokens.push(userData.fcmToken);
          }

          // Create notification document in `users/{userId}/notifications`
          const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
          batch.set(notifRef, {
            notificationId: notifRef.id,
            recipientId: userId,
            type: 'festival_greeting',
            event: 'festival_greeting',
            title: greeting.title,
            message: greeting.message,
            bannerImageUrl: greeting.bannerImageUrl || null,
            region: userData.region || 'West India (Gujarat/Maharashtra)',
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          operationCount++;
          if (operationCount >= 450) {
            await batch.commit();
            batch = db.batch();
            operationCount = 0;
          }
        }

        if (operationCount > 0) {
          await batch.commit();
        }

        // Send FCM Push Notification via multicast
        if (fcmTokens.length > 0) {
          const payload = {
            notification: {
              title: greeting.title,
              body: greeting.message,
            },
            data: {
              type: 'festival_greeting',
              greetingId: greeting.id,
              bannerImageUrl: greeting.bannerImageUrl || '',
            },
            tokens: fcmTokens,
          };

          try {
            const fcmResponse = await admin.messaging().sendEachForMulticast(payload);
            console.log(`[RegionalGreetings] FCM Push sent. Success: ${fcmResponse.successCount}, Failures: ${fcmResponse.failureCount}`);
          } catch (fcmErr) {
            console.error('[RegionalGreetings] Error sending FCM Push notification:', fcmErr);
          }
        }
      }
    } catch (error) {
      console.error('[RegionalGreetings] Error running scheduled festival greetings:', error);
    }
  }
);
