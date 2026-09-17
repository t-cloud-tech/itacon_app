const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Scheduled Cloud Function (Runs Daily at 07:00 AM IST)
 * Checks `festivalGreetings` for active events matching today's date (Asia/Kolkata),
 * creates in-app notifications in `users/{userId}/notifications/{notificationId}`
 * using a deterministic notification ID to prevent duplicates,
 * and sends targeted FCM Push Notifications to device tokens.
 */
exports.sendRegionalGreetings = onSchedule(
  {
    schedule: '0 7 * * *', // 07:00 AM IST Daily
    timeZone: 'Asia/Kolkata',
  },
  async (event) => {
    const db = admin.firestore();

    // 1. Calculate today's date strictly in Asia/Kolkata timezone
    const now = new Date();
    const istDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // Produces 'YYYY-MM-DD'
    const isoDateStr = istDateStr;
    const parts = isoDateStr.split('-');
    const monthDayStr = `${parts[1]}-${parts[2]}`; // Produces 'MM-DD'

    console.log(`[RegionalGreetings] Checking active festival greetings for IST date: ${isoDateStr} / ${monthDayStr}`);

    try {
      // 2. Query active greetings
      const greetingsSnap = await db
        .collection('festivalGreetings')
        .where('isActive', '==', true)
        .get();

      if (greetingsSnap.empty) {
        console.log('[RegionalGreetings] No active festival greetings found.');
        return;
      }

      // 3. Match against today's date (YYYY-MM-DD or MM-DD)
      const matchingGreetings = [];
      greetingsSnap.forEach((doc) => {
        const data = doc.data() || {};
        const targetDate = data.targetDate || '';
        if (targetDate === isoDateStr || targetDate === monthDayStr || targetDate.endsWith(monthDayStr)) {
          matchingGreetings.push({ id: doc.id, ...data });
        }
      });

      if (matchingGreetings.length === 0) {
        console.log(`[RegionalGreetings] No festival greetings scheduled for today (${isoDateStr}).`);
        return;
      }

      console.log(`[RegionalGreetings] Found ${matchingGreetings.length} greeting(s) for today.`);

      // 4. Fetch users to target
      const allUsersSnap = await db.collection('users').get();

      // 5. Process each matching greeting
      for (const greeting of matchingGreetings) {
        const applicableRegions = greeting.applicableRegions || ['All'];
        const isAllRegions = applicableRegions.includes('All');

        // Filter target users based on status and region
        const targetUsers = allUsersSnap.docs.filter((doc) => {
          const uData = doc.data() || {};
          const status = uData.status || (uData.isActive === false ? 'inactive' : 'active');
          if (status === 'inactive' || status === 'disabled') return false;
          if (isAllRegions) return true;
          const userRegion = uData.region || 'West India (Gujarat/Maharashtra)';
          return applicableRegions.includes(userRegion);
        });

        if (targetUsers.length === 0) {
          console.log(`[RegionalGreetings] No targeted users found for greeting '${greeting.title}' (regions: ${applicableRegions.join(', ')})`);
          continue;
        }

        console.log(`[RegionalGreetings] Evaluating greeting '${greeting.title}' for ${targetUsers.length} user(s).`);

        const cleanFestivalId = String(greeting.id || greeting.greetingId || 'festival').replace(/[^a-zA-Z0-9_-]/g, '_');

        // Build deterministic notification candidates: festival + user + date
        const candidateItems = [];
        for (const userDoc of targetUsers) {
          const userId = userDoc.id;
          const cleanUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
          // Deterministic notification ID prevents duplicates if function is retried or re-run
          const notificationId = `fest_${cleanFestivalId}_${cleanUserId}_${isoDateStr}`;
          const notifRef = db.collection('users').doc(userId).collection('notifications').doc(notificationId);

          candidateItems.push({
            userDoc,
            userId,
            userData: userDoc.data() || {},
            notificationId,
            notifRef,
          });
        }

        // Check for existing notifications in chunks (max 400 per getAll) for idempotency
        const CHUNK_SIZE = 400;
        const usersToNotify = [];

        for (let i = 0; i < candidateItems.length; i += CHUNK_SIZE) {
          const chunk = candidateItems.slice(i, i + CHUNK_SIZE);
          const existingSnaps = await db.getAll(...chunk.map((c) => c.notifRef));

          for (let j = 0; j < chunk.length; j++) {
            const item = chunk[j];
            const existingSnap = existingSnaps[j];
            if (existingSnap && existingSnap.exists) {
              console.log(`[RegionalGreetings] Notification ${item.notificationId} already exists for user ${item.userId}. Skipping duplicate.`);
            } else {
              usersToNotify.push(item);
            }
          }
        }

        if (usersToNotify.length === 0) {
          console.log(`[RegionalGreetings] All targeted users have already received greeting '${greeting.title}' for date ${isoDateStr}. No new notifications needed.`);
          continue;
        }

        console.log(`[RegionalGreetings] Dispatching greeting '${greeting.title}' to ${usersToNotify.length} new user(s).`);

        const fcmTokens = [];
        let batch = db.batch();
        let operationCount = 0;

        for (const item of usersToNotify) {
          const { userId, userData, notificationId, notifRef } = item;

          // Collect FCM Token for push delivery
          if (userData.fcmToken && typeof userData.fcmToken === 'string' && userData.fcmToken.trim().length > 0) {
            fcmTokens.push(userData.fcmToken.trim());
          }

          // Create notification document with exact required production schema
          batch.set(notifRef, {
            notificationId: notificationId,
            id: notificationId,
            recipientId: userId,
            userId: userId,
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

        // Send FCM Push Notification via multicast chunked by 500
        if (fcmTokens.length > 0) {
          const FCM_BATCH_SIZE = 500;
          for (let i = 0; i < fcmTokens.length; i += FCM_BATCH_SIZE) {
            const batchTokens = fcmTokens.slice(i, i + FCM_BATCH_SIZE);
            const payload = {
              notification: {
                title: greeting.title,
                body: greeting.message,
              },
              data: {
                type: 'festival_greeting',
                event: 'festival_greeting',
                greetingId: String(greeting.id || greeting.greetingId || ''),
                bannerImageUrl: String(greeting.bannerImageUrl || ''),
              },
              tokens: batchTokens,
            };

            try {
              const fcmResponse = await admin.messaging().sendEachForMulticast(payload);
              console.log(`[RegionalGreetings] FCM Push sent to ${batchTokens.length} token(s). Success: ${fcmResponse.successCount}, Failures: ${fcmResponse.failureCount}`);
            } catch (fcmErr) {
              console.error('[RegionalGreetings] Error sending FCM Push notification:', fcmErr);
            }
          }
        }
      }
    } catch (error) {
      console.error('[RegionalGreetings] Error running scheduled festival greetings:', error);
    }
  }
);

