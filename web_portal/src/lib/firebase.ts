import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "itacon-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "itacon-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "itacon-app.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "889001862943",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:889001862943:web:7c9c09c666f0d4cf55f22a",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-0G58TV66PP",
};

// Initialize Firebase (singleton pattern for Next.js SSR/client)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Functions instance for asia-south1 (dedicated for staff authentication)
export const functionsAsia = getFunctions(app, "asia-south1");

// Functions instance for us-central1 (default region where paymentEngine and loyalty callables reside)
export const functionsUs = getFunctions(app, "us-central1");

// Default export alias: points to functionsAsia for backward-compatibility with staff auth
export const functions = functionsAsia;

// Safe optional emulator routing: ONLY connects if explicitly set in environment
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
  const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "localhost";
  const functionsPort = Number(process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT) || 5001;
  connectFunctionsEmulator(functionsAsia, host, functionsPort);
  connectFunctionsEmulator(functionsUs, host, functionsPort);
}

/**
 * Robust caller for Firebase Cloud Functions that handles multi-region deployments.
 * Tries the preferred region first (us-central1 for payments, asia-south1 for staff auth)
 * and automatically falls back to the alternate region if an internal or not-found error occurs.
 */
export async function invokeCallable<Req = any, Res = any>(
  name: string,
  data?: Req,
  preferredRegion: "us-central1" | "asia-south1" = "us-central1"
): Promise<{ data: Res }> {
  const primaryFunctions = preferredRegion === "us-central1" ? functionsUs : functionsAsia;
  const secondaryFunctions = preferredRegion === "us-central1" ? functionsAsia : functionsUs;

  try {
    const fn = httpsCallable<Req, Res>(primaryFunctions, name);
    return await fn(data as any);
  } catch (err: any) {
    const msg = String(err?.message || "");
    const code = String(err?.code || "");
    // If not found or internal error due to wrong regional endpoint (HTML 404 mapped to internal [0]),
    // attempt fallback region.
    if (code === "functions/not-found" || code === "functions/internal" || msg.includes("internal")) {
      try {
        const fallbackFn = httpsCallable<Req, Res>(secondaryFunctions, name);
        return await fallbackFn(data as any);
      } catch (fallbackErr: any) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

export default app;

