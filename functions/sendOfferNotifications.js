const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Parses Firestore timestamps, ISO strings, or Date instances into a JavaScript Date.
 * Returns null if the value is empty, invalid, or missing.
 */
function parseDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Verifies whether a user account is active and not blocked/disabled.
 */
function isUserActiveAndNotBlocked(uData) {
  if (!uData) return false;
  const status = String(uData.status || '').toLowerCase();
  if (status === 'inactive' || status === 'blocked' || status === 'disabled') {
    return false;
  }
  if (uData.isActive === false) {
    return false;
  }
  return true;
}

/**
 * Checks if a user is a customer rather than internal staff.
 */
function isCustomerUser(uData) {
  if (!uData) return false;
  const role = String(uData.role || uData.userCategory || 'customer').toLowerCase();
  if (role === 'salesperson' || role === 'admin' || role === 'manager') {
    return false;
  }
  return true;
}

/**
 * Evaluates whether a user's region matches the offer's applicableRegions.
 * Supports 'All' as a universal match.
 */
function matchesRegion(userRegion, applicableRegions) {
  if (!Array.isArray(applicableRegions) || applicableRegions.length === 0) {
    return true;
  }
  if (applicableRegions.includes('All')) {
    return true;
  }
  const cleanUserRegion = String(userRegion || '').trim().toLowerCase();
  return applicableRegions.some(
    (r) => String(r).trim().toLowerCase() === cleanUserRegion
  );
}

/**
 * Validates whether the user document contains a non-empty FCM device token.
 */
function hasValidFcmToken(uData) {
  return (
    Boolean(uData) &&
    typeof uData.fcmToken === 'string' &&
    uData.fcmToken.trim().length > 0
  );
}

/**
 * Scheduled Cloud Function (Runs Daily at 09:00 AM IST)
 *
 * Discovers active offers from `offers/{offerId}` and dispatches in-app notifications
 * under `users/{userId}/notifications/{notificationId}` for eligible customers.
 *
 * Push delivery is automatically handled by the existing `sendFcmOnUserNotification`
 * trigger listening on `users/{userId}/notifications/{notificationId}`.
 */
exports.sendOfferNotifications = onSchedule(
  {
    schedule: '0 9 * * *', // 09:00 AM IST Daily
    timeZone: 'Asia/Kolkata',
  },
  async (event) => {
    const db = admin.firestore();
    const now = new Date();

    console.log(`[sendOfferNotifications] Starting scheduled offer notification run at ${now.toISOString()} (Asia/Kolkata)`);

    try {
      // 1. Fetch active offers
      const offersSnap = await db
        .collection('offers')
        .where('isActive', '==', true)
        .get();

      if (offersSnap.empty) {
        console.log('[sendOfferNotifications] No active offers found in offers collection.');
        return;
      }

      // 2. Filter offers that are currently within their validity window
      const activeOffers = [];
      offersSnap.forEach((doc) => {
        const data = doc.data() || {};
        const offerId = data.offerId || doc.id;
        const validFrom = parseDate(data.validFrom);
        const validUntil = parseDate(data.validUntil);

        // Check if offer has not started yet
        if (validFrom && validFrom > now) {
          console.log(`[sendOfferNotifications] Offer ${offerId} has not started yet (validFrom: ${validFrom.toISOString()}). Skipping.`);
          return;
        }

        // Check if offer has expired
        if (validUntil && validUntil < now) {
          console.log(`[sendOfferNotifications] Offer ${offerId} is expired (validUntil: ${validUntil.toISOString()}). Skipping.`);
          return;
        }

        activeOffers.push({
          id: doc.id,
          offerId: offerId,
          ...data,
        });
      });

      if (activeOffers.length === 0) {
        console.log('[sendOfferNotifications] No currently valid offers to dispatch today.');
        return;
      }

      console.log(`[sendOfferNotifications] Found ${activeOffers.length} valid offer(s) to process.`);

      const PAGE_SIZE = 300;
      const WRITE_BATCH_LIMIT = 400; // Under Firestore limit of 500 ops

      // 3. Process each active offer independently
      for (const offer of activeOffers) {
        const offerId = offer.offerId || offer.id;
        const targetAudience = offer.targetAudience || 'all_customers';
        const applicableRegions = Array.isArray(offer.applicableRegions) && offer.applicableRegions.length > 0
          ? offer.applicableRegions
          : ['All'];
        const cleanOfferId = String(offerId).replace(/[^a-zA-Z0-9_-]/g, '_');

        console.log(`\n[sendOfferNotifications] Processing Offer: "${offer.title}" (ID: ${offerId}, Audience: ${targetAudience})`);

        let eligibleUsersCount = 0;
        let notificationsCreated = 0;
        let skippedAlreadyNotified = 0;
        let skippedNoFcmToken = 0;

        let currentBatch = db.batch();
        let currentBatchOps = 0;

        const commitBatchIfNeeded = async (force = false) => {
          if (currentBatchOps > 0 && (force || currentBatchOps >= WRITE_BATCH_LIMIT)) {
            await currentBatch.commit();
            currentBatch = db.batch();
            currentBatchOps = 0;
          }
        };

        // TARGET AUDIENCE: selected_customers
        if (targetAudience === 'selected_customers') {
          const selectedCustomerIds = Array.isArray(offer.selectedCustomerIds)
            ? offer.selectedCustomerIds.filter((id) => Boolean(id) && typeof id === 'string')
            : [];

          console.log(`[sendOfferNotifications] Target selected customers count: ${selectedCustomerIds.length}`);

          if (selectedCustomerIds.length === 0) {
            console.log(`[sendOfferNotifications] Offer ${offerId} has no customer IDs listed in selectedCustomerIds.`);
          } else {
            // Process selected IDs in chunks of PAGE_SIZE
            for (let i = 0; i < selectedCustomerIds.length; i += PAGE_SIZE) {
              const idChunk = selectedCustomerIds.slice(i, i + PAGE_SIZE);
              const userRefs = idChunk.map((id) => db.collection('users').doc(id));
              const userSnaps = await db.getAll(...userRefs);

              // Filter candidate users
              const candidateUsers = [];
              for (const uSnap of userSnaps) {
                if (!uSnap.exists) continue;
                const uData = uSnap.data() || {};
                const userId = uSnap.id;

                if (!isUserActiveAndNotBlocked(uData)) continue;

                // Push eligibility check
                if (!hasValidFcmToken(uData)) {
                  skippedNoFcmToken++;
                  continue;
                }

                eligibleUsersCount++;
                const cleanUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
                const notificationId = `offer_${cleanOfferId}_${cleanUserId}`;
                const notifRef = db.collection('users').doc(userId).collection('notifications').doc(notificationId);

                candidateUsers.push({
                  userId,
                  uData,
                  notificationId,
                  notifRef,
                });
              }

              // Check existing notifications in chunk for idempotency
              if (candidateUsers.length > 0) {
                const notifSnaps = await db.getAll(...candidateUsers.map((c) => c.notifRef));

                for (let k = 0; k < candidateUsers.length; k++) {
                  const candidate = candidateUsers[k];
                  const existingSnap = notifSnaps[k];

                  if (existingSnap && existingSnap.exists) {
                    skippedAlreadyNotified++;
                  } else {
                    currentBatch.set(candidate.notifRef, {
                      notificationId: candidate.notificationId,
                      id: candidate.notificationId,
                      recipientId: candidate.userId,
                      userId: candidate.userId,
                      type: 'offer',
                      event: 'offer_available',
                      eventType: 'offer_available',
                      offerId: offerId,
                      relatedOfferId: offerId,
                      title: offer.title || 'Exclusive Offer',
                      message: offer.message || '',
                      bannerImageUrl: offer.bannerImageUrl || null,
                      region: candidate.uData.region || 'West India (Gujarat/Maharashtra)',
                      isRead: false,
                      status: 'sent',
                      channels: { inApp: true, email: false, whatsapp: false },
                      payload: {
                        type: 'offer',
                        event: 'offer_available',
                        offerId: offerId,
                        title: offer.title || 'Exclusive Offer',
                        message: offer.message || '',
                        bannerImageUrl: offer.bannerImageUrl || null,
                      },
                      createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    currentBatchOps++;
                    notificationsCreated++;
                    await commitBatchIfNeeded();
                  }
                }
              }
            }
          }
        } else {
          // TARGET AUDIENCES: all_customers, existing_customers, region_based
          // Paginate users collection to safely avoid high memory consumption
          let lastDoc = null;
          let hasMore = true;

          while (hasMore) {
            let query = db
              .collection('users')
              .orderBy(admin.firestore.FieldPath.documentId())
              .limit(PAGE_SIZE);

            if (lastDoc) {
              query = query.startAfter(lastDoc);
            }

            const pageSnap = await query.get();
            if (pageSnap.empty) {
              hasMore = false;
              break;
            }

            lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
            if (pageSnap.docs.length < PAGE_SIZE) {
              hasMore = false;
            }

            // Step A: Basic account status & role filtering
            const eligibleOnPage = [];
            for (const doc of pageSnap.docs) {
              const uData = doc.data() || {};
              const userId = doc.id;

              if (!isUserActiveAndNotBlocked(uData)) continue;
              if (!isCustomerUser(uData)) continue;

              // If region-based, verify region match
              if (targetAudience === 'region_based') {
                if (!matchesRegion(uData.region, applicableRegions)) continue;
              }

              eligibleOnPage.push({
                userId,
                uData,
              });
            }

            if (eligibleOnPage.length === 0) continue;

            // Step B: For existing_customers, verify totalOrders > 0 from customerSummary/{userId}
            let audienceFilteredUsers = eligibleOnPage;
            if (targetAudience === 'existing_customers') {
              const summaryRefs = eligibleOnPage.map((u) => db.collection('customerSummary').doc(u.userId));
              const summarySnaps = await db.getAll(...summaryRefs);

              audienceFilteredUsers = [];
              for (let j = 0; j < eligibleOnPage.length; j++) {
                const userItem = eligibleOnPage[j];
                const summarySnap = summarySnaps[j];
                let totalOrders = 0;

                if (summarySnap && summarySnap.exists) {
                  const summaryData = summarySnap.data() || {};
                  totalOrders = Number(summaryData.totalOrders) || 0;
                }

                if (totalOrders > 0) {
                  audienceFilteredUsers.push(userItem);
                }
              }
            }

            // Step C: FCM push eligibility & notification document preparation
            const candidatesForNotif = [];
            for (const userItem of audienceFilteredUsers) {
              const { userId, uData } = userItem;

              if (!hasValidFcmToken(uData)) {
                skippedNoFcmToken++;
                continue;
              }

              eligibleUsersCount++;
              const cleanUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
              const notificationId = `offer_${cleanOfferId}_${cleanUserId}`;
              const notifRef = db.collection('users').doc(userId).collection('notifications').doc(notificationId);

              candidatesForNotif.push({
                userId,
                uData,
                notificationId,
                notifRef,
              });
            }

            // Step D: Idempotency check against existing notification documents
            if (candidatesForNotif.length > 0) {
              const notifSnaps = await db.getAll(...candidatesForNotif.map((c) => c.notifRef));

              for (let k = 0; k < candidatesForNotif.length; k++) {
                const candidate = candidatesForNotif[k];
                const existingSnap = notifSnaps[k];

                if (existingSnap && existingSnap.exists) {
                  skippedAlreadyNotified++;
                } else {
                  currentBatch.set(candidate.notifRef, {
                    notificationId: candidate.notificationId,
                    id: candidate.notificationId,
                    recipientId: candidate.userId,
                    userId: candidate.userId,
                    type: 'offer',
                    event: 'offer_available',
                    eventType: 'offer_available',
                    offerId: offerId,
                    relatedOfferId: offerId,
                    title: offer.title || 'Exclusive Offer',
                    message: offer.message || '',
                    bannerImageUrl: offer.bannerImageUrl || null,
                    region: candidate.uData.region || 'West India (Gujarat/Maharashtra)',
                    isRead: false,
                    status: 'sent',
                    channels: { inApp: true, email: false, whatsapp: false },
                    payload: {
                      type: 'offer',
                      event: 'offer_available',
                      offerId: offerId,
                      title: offer.title || 'Exclusive Offer',
                      message: offer.message || '',
                      bannerImageUrl: offer.bannerImageUrl || null,
                    },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  currentBatchOps++;
                  notificationsCreated++;
                  await commitBatchIfNeeded();
                }
              }
            }
          }
        }

        // Commit any remaining writes in batch for this offer
        await commitBatchIfNeeded(true);

        // 4. Log detailed useful metrics
        console.log(`[sendOfferNotifications] Offer Dispatch Summary for "${offerId}":`);
        console.log(`  - Target Audience: ${targetAudience}`);
        console.log(`  - Number of Eligible Users: ${eligibleUsersCount}`);
        console.log(`  - Number of Notifications Created: ${notificationsCreated}`);
        console.log(`  - Number Skipped (Already Notified): ${skippedAlreadyNotified}`);
        console.log(`  - Number Skipped (No FCM Token): ${skippedNoFcmToken}`);
      }

      console.log('[sendOfferNotifications] Completed scheduled offer notification run successfully.');
    } catch (error) {
      console.error('[sendOfferNotifications] Fatal error during offer notifications dispatch:', error);
    }
  }
);
