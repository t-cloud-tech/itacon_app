import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  onSnapshot,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { StaffNotification, NotificationType } from "@/types";

function parseNotificationDoc(d: QueryDocumentSnapshot<DocumentData> | DocumentData, id?: string): StaffNotification {
  const data = typeof d.data === "function" ? d.data() : d;
  const docId = id || (d as any).id || "";

  let createdAt = new Date().toISOString();
  if (data.createdAt?.seconds) {
    createdAt = new Date(data.createdAt.seconds * 1000).toISOString();
  } else if (typeof data.createdAt === "string") {
    createdAt = data.createdAt;
  }

  return {
    id: docId,
    recipientUid: data.recipientUid || "",
    recipientRole: data.recipientRole || "salesperson",
    type: data.type || "customer_assigned",
    title: data.title || "Notification",
    body: data.body || "",
    link: data.link || "/",
    refs: data.refs || {},
    priority: data.priority === "high" ? "high" : "normal",
    read: Boolean(data.read),
    readAt: data.readAt || null,
    createdAt,
    dedupeKey: data.dedupeKey || docId,
  };
}

/**
 * Requirement 4: ONE live onSnapshot listener strictly for the current user's
 * latest 20 UNREAD notifications only. Keeps Firestore read costs minimal.
 */
export function subscribeLiveUnreadNotifications(
  uid: string,
  callback: (notifications: StaffNotification[]) => void
): () => void {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const notifsRef = collection(db, "staffNotifications");
  const q = query(
    notifsRef,
    where("recipientUid", "==", uid),
    where("read", "==", false),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => parseNotificationDoc(d, d.id));
      callback(items);
    },
    (err) => {
      console.warn("[NotificationService] Unread onSnapshot error:", err);
      callback([]);
    }
  );
}

/**
 * Fetches the latest N notifications (read + unread) for the Topbar Dropdown.
 * One-time read.
 */
export async function fetchRecentNotifications(uid: string, count = 10): Promise<StaffNotification[]> {
  if (!uid) return [];
  try {
    const notifsRef = collection(db, "staffNotifications");
    const q = query(
      notifsRef,
      where("recipientUid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => parseNotificationDoc(d, d.id));
  } catch (err) {
    console.error("[NotificationService] fetchRecentNotifications error:", err);
    return [];
  }
}

export type NotificationFilter = "all" | "unread" | "customers" | "payments" | "reminders" | "leads";

const FILTER_TYPE_MAP: Record<NotificationFilter, NotificationType[] | null> = {
  all: null,
  unread: null,
  customers: ["customer_assigned", "customer_inactive", "no_first_order"],
  payments: ["payment_submitted", "payment_verified", "payment_rejected", "payment_overdue"],
  reminders: ["po_approved_unpaid", "follow_up_due", "admin_weekly_summary"],
  leads: ["lead_assigned"],
};

/**
 * Fetches a paginated slice of notifications for the dedicated /notifications page.
 * One-time reads with cursor pagination (25 per page).
 */
export async function fetchNotificationsPage(
  uid: string,
  options: {
    filter?: NotificationFilter;
    pageSize?: number;
    cursorDoc?: QueryDocumentSnapshot<DocumentData> | null;
  }
): Promise<{
  notifications: StaffNotification[];
  cursorDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  if (!uid) return { notifications: [], cursorDoc: null, hasMore: false };

  const filter = options.filter || "all";
  const pageSize = options.pageSize || 25;
  const notifsRef = collection(db, "staffNotifications");

  try {
    // If filter is for specific types, we can query by type if single, or filter in-memory if array
    const allowedTypes = FILTER_TYPE_MAP[filter];

    let baseConstraints: any[] = [
      where("recipientUid", "==", uid),
      orderBy("createdAt", "desc"),
    ];

    if (filter === "unread") {
      baseConstraints = [
        where("recipientUid", "==", uid),
        where("read", "==", false),
        orderBy("createdAt", "desc"),
      ];
    } else if (allowedTypes && allowedTypes.length === 1) {
      baseConstraints.push(where("type", "==", allowedTypes[0]));
    } else if (allowedTypes && allowedTypes.length > 1) {
      baseConstraints.push(where("type", "in", allowedTypes));
    }

    if (options.cursorDoc) {
      baseConstraints.push(startAfter(options.cursorDoc));
    }

    baseConstraints.push(limit(pageSize + 1)); // fetch 1 extra to check hasMore

    const q = query(notifsRef, ...baseConstraints);
    const snap = await getDocs(q);

    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const notifications = docs.map((d) => parseNotificationDoc(d, d.id));
    const nextCursor = docs.length > 0 ? docs[docs.length - 1] : null;

    return {
      notifications,
      cursorDoc: nextCursor,
      hasMore,
    };
  } catch (err) {
    console.error("[NotificationService] fetchNotificationsPage error:", err);
    return { notifications: [], cursorDoc: null, hasMore: false };
  }
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(notifId: string): Promise<void> {
  if (!notifId) return;
  try {
    const notifRef = doc(db, "staffNotifications", notifId);
    await updateDoc(notifRef, {
      read: true,
      readAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[NotificationService] markNotificationAsRead(${notifId}) error:`, err);
  }
}

/**
 * Marks all specified notifications as read in a batch write.
 */
export async function markAllNotificationsAsRead(uid: string, notifIds: string[]): Promise<void> {
  if (!notifIds || notifIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    const readAt = new Date().toISOString();

    // Firestore batch limit is 500
    const slice = notifIds.slice(0, 450);
    slice.forEach((id) => {
      const ref = doc(db, "staffNotifications", id);
      batch.update(ref, {
        read: true,
        readAt,
      });
    });

    await batch.commit();
  } catch (err) {
    console.error("[NotificationService] markAllNotificationsAsRead error:", err);
  }
}

/**
 * Relative time formatter: e.g. "Just now", "2m ago", "1h ago", "3d ago".
 */
export function formatTimeAgo(isoString?: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

