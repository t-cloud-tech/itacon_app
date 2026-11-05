import { app, db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

let messagingInstance: any = null;

async function getMessagingClient() {
  if (typeof window === "undefined") return null;
  if (messagingInstance) return messagingInstance;

  try {
    const { getMessaging, isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (!supported) {
      console.warn("[FCMClient] Firebase Messaging is not supported in this browser.");
      return null;
    }
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn("[FCMClient] Failed to initialize Firebase Messaging:", err);
    return null;
  }
}

/**
 * Validates whether push registration is permitted for this environment.
 * Rejects localhost, loopback addresses, and non-whitelisted preview domains.
 */
export function isPushRegistrationAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.endsWith(".local")
  ) {
    return false;
  }

  // Preview domains (Vercel) only allowed if explicitly enabled
  const isVercelPreview = hostname.endsWith(".vercel.app");
  if (isVercelPreview && process.env.NEXT_PUBLIC_ALLOW_PREVIEW_PUSH !== "true") {
    return false;
  }

  return true;
}

/**
 * Registers the web push service worker and retrieves an FCM registration token.
 * Saves the token to staffDevices/{uid}/tokens/{token}.
 */
export async function requestAndRegisterPushToken(
  uid: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return { success: false, error: "Push notifications are not supported in this browser." };
  }

  if (!isPushRegistrationAllowed()) {
    console.warn("[FCMClient] Push registration blocked: running on localhost or disallowed preview origin:", window.location.origin);
    return {
      success: false,
      error: "Push notifications are disabled on localhost and non-production environments.",
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Notification permission denied." };
    }

    const messaging = await getMessagingClient();
    if (!messaging) {
      return { success: false, error: "Firebase messaging is unavailable." };
    }

    // Register Service Worker
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    const { getToken } = await import("firebase/messaging");
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;

    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey,
    });

    if (!token) {
      return { success: false, error: "Could not retrieve FCM token." };
    }

    // Save token to Firestore: staffDevices/{uid}/tokens/{token}
    const tokenRef = doc(db, "staffDevices", uid, "tokens", token);
    await setDoc(
      tokenRef,
      {
        token,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        origin: window.location.origin,
        hostname: window.location.hostname,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    localStorage.setItem("staff_fcm_token", token);
    localStorage.setItem("push_notifications_enabled", "true");
    console.log("[FCMClient] Registered device token successfully:", token);

    return { success: true, token };
  } catch (err: any) {
    console.warn("[FCMClient] requestAndRegisterPushToken error:", err);
    return { success: false, error: err?.message || "Failed to register push notifications." };
  }
}

/**
 * Removes the stored FCM token on logout or when the user toggles push notifications OFF.
 */
export async function unregisterPushToken(uid: string): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const storedToken = localStorage.getItem("staff_fcm_token");
    if (storedToken && uid) {
      const tokenRef = doc(db, "staffDevices", uid, "tokens", storedToken);
      await deleteDoc(tokenRef);
    }
  } catch (err) {
    console.warn("[FCMClient] unregisterPushToken error:", err);
  } finally {
    localStorage.removeItem("staff_fcm_token");
    localStorage.setItem("push_notifications_enabled", "false");
  }
}

/**
 * Subscribes to foreground push messages while the portal tab is active.
 * Used to display the in-app notification toast instead of a browser pop-up.
 */
export async function listenForegroundPushMessages(
  callback: (payload: any) => void
): Promise<() => void> {
  const messaging = await getMessagingClient();
  if (!messaging) return () => {};

  try {
    const { onMessage } = await import("firebase/messaging");
    return onMessage(messaging, (payload) => {
      console.log("[FCMClient] Foreground message received:", payload);
      callback(payload);
    });
  } catch (err) {
    console.warn("[FCMClient] listenForegroundPushMessages error:", err);
    return () => {};
  }
}

/**
 * Checks whether push notifications are currently supported and enabled.
 */
export function getPushNotificationState(): {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  enabled: boolean;
} {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { supported: false, permission: "unsupported", enabled: false };
  }

  if (!isPushRegistrationAllowed()) {
    return { supported: false, permission: "unsupported", enabled: false };
  }

  const permission = Notification.permission;
  const pref = localStorage.getItem("push_notifications_enabled");
  const hasToken = Boolean(localStorage.getItem("staff_fcm_token"));
  const enabled = permission === "granted" && pref !== "false" && hasToken;

  return {
    supported: true,
    permission,
    enabled,
  };
}

