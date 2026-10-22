"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  signInWithCustomToken,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";
import {
  buildUserProfileFromDoc,
  AuthException,
  type AuthErrorCode
} from "./auth-utils";
import { UserProfile, SalesPerson, Designer, UserRole } from "@/types";

export { AuthException, type AuthErrorCode };

interface AuthContextType {
  user: UserProfile | null;
  salesperson: SalesPerson | null;
  designer: Designer | null;
  role: UserRole | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadSalespersonProfile(profile: UserProfile): Promise<SalesPerson | null> {
  if ((profile.role !== "salesperson" && profile.role !== "manager") || !profile.salesPersonId) {
    return null;
  }
  try {
    const spDoc = await getDoc(doc(db, "salesPersons", profile.salesPersonId));
    if (!spDoc.exists()) return null;
    const data = spDoc.data();
    return {
      salesPersonId: spDoc.id,
      employeeId: data.employeeId || "",
      name: data.name || profile.name,
      phone: data.phone || profile.phone,
      email: data.email || profile.email,
      referralCode: data.referralCode || "",
      region: data.region || "Western Region",
      states: data.states || ["GJ"],
      status: data.status || "active",
      assignedClientsCount: data.assignedClientsCount || 0,
      activeClientsCount: data.activeClientsCount || 0,
    };
  } catch (e) {
    console.warn("Could not fetch salesperson profile document:", e);
    return null;
  }
}

async function loadDesignerProfile(profile: UserProfile): Promise<Designer | null> {
  if (profile.role !== "designer") return null;
  const designerId = profile.designerId || profile.userId;
  try {
    const designerDoc = await getDoc(doc(db, "Designer", designerId));
    if (!designerDoc.exists()) return null;
    const data = designerDoc.data();
    return {
      designerId: designerDoc.id,
      userId: data.userId || profile.userId,
      employeeId: data.employeeId || "",
      name: data.name || profile.name,
      phone: data.phone || profile.phone,
      email: data.email || profile.email,
      designation: data.designation || "Tile Designer",
      specializations: Array.isArray(data.specializations) ? data.specializations : [],
      status: data.status === "inactive" ? "inactive" : "active",
    };
  } catch (e) {
    console.warn("Could not fetch designer profile document:", e);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [salesperson, setSalesperson] = useState<SalesPerson | null>(null);
  const [designer, setDesigner] = useState<Designer | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    setUser(null);
    setSalesperson(null);
    setDesigner(null);
    setRole(null);
  };

  // Authoritative Firebase Auth persistence listener
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        if (isMounted) {
          clearSession();
          setLoading(false);
        }
        return;
      }

      try {
        // Authenticated users can read their own user profile under isOwner(userId) rule
        const userDocSnap = await getDoc(doc(db, "users", fbUser.uid));
        if (!userDocSnap.exists()) {
          // If no user profile exists for authenticated user, sign out
          await fbSignOut(auth);
          if (isMounted) clearSession();
          return;
        }

        const profile = buildUserProfileFromDoc(fbUser.uid, userDocSnap.data() as Record<string, unknown>);
        const [spProfile, designerProfile] = await Promise.all([
          loadSalespersonProfile(profile),
          loadDesignerProfile(profile),
        ]);

        if (isMounted) {
          setUser(profile);
          setSalesperson(spProfile);
          setDesigner(designerProfile);
          setRole(profile.role);
        }
      } catch (err) {
        console.warn("Session restore error:", err);
        if (isMounted) clearSession();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const trimmedIdent = identifier.trim();
      if (!trimmedIdent) {
        throw new AuthException("ACCOUNT_NOT_FOUND", "Please enter your email or registered phone number.");
      }
      if (!password) {
        throw new AuthException("INVALID_PASSWORD", "Please enter your password.");
      }

      // 1. Invoke server-side verifyStaffCredentials callable
      // Server performs lookup, constant-time password check, status validation & role gating.
      let customToken = "";
      try {
        const verifyStaffCallable = httpsCallable<
          { identifier: string; password: string },
          { customToken: string }
        >(functions, "verifyStaffCredentials");

        const response = await verifyStaffCallable({
          identifier: trimmedIdent,
          password,
        });

        customToken = response.data?.customToken;
      } catch (err: unknown) {
        const errorObj = err as { code?: string; message?: string };
        const code = errorObj?.code || "";
        const message = errorObj?.message || "";

        if (code === "functions/permission-denied" || message.includes("Access Denied")) {
          throw new AuthException(
            "UNAUTHORIZED_ROLE",
            "Access Denied: This web portal is restricted to authorized staff (Admins, Salespersons, Designers). Customer accounts must use the ITACON mobile app."
          );
        }
        if (code === "functions/failed-precondition" || message.includes("deactivated or blocked")) {
          throw new AuthException(
            "INACTIVE_ACCOUNT",
            "Your account has been deactivated or blocked. Please contact admin."
          );
        }
        if (code === "functions/unauthenticated" || message.includes("Invalid login credentials")) {
          throw new AuthException(
            "INVALID_PASSWORD",
            "Invalid login credentials."
          );
        }
        if (code === "functions/invalid-argument") {
          throw new AuthException(
            "INVALID_PASSWORD",
            message || "Invalid credentials."
          );
        }
        throw new AuthException(
          "TECHNICAL_ERROR",
          message || "Authentication service temporarily unavailable. Please try again."
        );
      }

      if (!customToken) {
        throw new AuthException("TECHNICAL_ERROR", "Authentication failed: No token received from server.");
      }

      // 2. Sign in with Custom Token via Firebase Auth
      const userCred = await signInWithCustomToken(auth, customToken);
      const authedUid = userCred.user.uid;

      // 3. Read users/{authedUid} master document under authorized isOwner(userId) rule
      const userDocSnap = await getDoc(doc(db, "users", authedUid));
      if (!userDocSnap.exists()) {
        throw new AuthException("ACCOUNT_NOT_FOUND", "User profile document not found.");
      }

      // 4. Client-side role re-validation (defense-in-depth for UI routing)
      const userProfile = buildUserProfileFromDoc(authedUid, userDocSnap.data() as Record<string, unknown>);

      // 5. Fetch role-specific profile documents (salesPersons / Designer)
      const [spProfile, designerProfile] = await Promise.all([
        loadSalespersonProfile(userProfile),
        loadDesignerProfile(userProfile),
      ]);

      // Update state
      setUser(userProfile);
      setSalesperson(spProfile);
      setDesigner(designerProfile);
      setRole(userProfile.role);

    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (_) {}
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, salesperson, designer, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
