"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  limit
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut as fbSignOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { hashPassword } from "./auth-utils";
import { UserProfile, SalesPerson, UserRole } from "@/types";

interface AuthContextType {
  user: UserProfile | null;
  salesperson: SalesPerson | null;
  role: UserRole | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "itacon_portal_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [salesperson, setSalesperson] = useState<SalesPerson | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setSalesperson(parsed.salesperson || null);
        setRole(parsed.role);
      }
    } catch (e) {
      console.error("Failed to restore session", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const cleanIdent = identifier.trim().toLowerCase();
      const usersRef = collection(db, "users");

      // 1. Try finding user by email or phone in Firestore
      let userDocData: any = null;
      let userId: string = "";

      // Query by email
      const emailQuery = query(usersRef, where("email", "==", cleanIdent), limit(1));
      let querySnap = await getDocs(emailQuery);

      if (querySnap.empty) {
        // Query by phone
        const phoneQuery = query(usersRef, where("phone", "==", identifier.trim()), limit(1));
        querySnap = await getDocs(phoneQuery);
      }

      if (querySnap.empty) {
        // Query by phoneNumber field if phone field is not used
        const altPhoneQuery = query(usersRef, where("phoneNumber", "==", identifier.trim()), limit(1));
        querySnap = await getDocs(altPhoneQuery);
      }

      if (!querySnap.empty) {
        const snapDoc = querySnap.docs[0];
        userId = snapDoc.id;
        userDocData = snapDoc.data();
      }

      // If user doc not found via Firestore query, try direct Firebase Auth sign-in first
      let authUid: string | null = null;
      try {
        const authEmail = cleanIdent.includes("@") ? cleanIdent : `user_${cleanIdent.replace(/\D/g, "")}@itacon.com`;
        const cred = await signInWithEmailAndPassword(auth, authEmail, password);
        authUid = cred.user.uid;
      } catch (_) {
        // Firebase Auth sign-in might fail or phone accounts may not have email/pass
      }

      // If we didn't find by email/phone query earlier but got authUid, fetch user doc
      if (!userDocData && authUid) {
        const userDoc = await getDoc(doc(db, "users", authUid));
        if (userDoc.exists()) {
          userId = userDoc.id;
          userDocData = userDoc.data();
        }
      }

      if (!userDocData) {
        throw new Error("No account found matching this email or phone number.");
      }

      // 2. Validate password using salt + SHA-256 hash if present
      const storedHash = userDocData.passwordHash;
      const storedSalt = userDocData.passwordSalt;

      if (storedHash && storedSalt) {
        const computedHash = await hashPassword(password, storedSalt);
        if (computedHash !== storedHash) {
          throw new Error("Invalid password. Please check your credentials and try again.");
        }
      } else if (!authUid) {
        // Neither custom hash nor Firebase auth succeeded
        throw new Error("Password authentication failed. Please contact your administrator.");
      }

      // 3. Verify Role: Salesperson or Admin allowed
      const userRole = (userDocData.role as UserRole) || "salesperson";
      if (userRole !== "salesperson" && userRole !== "admin") {
        throw new Error("Access Denied: This web portal is restricted to Salespersons and Admins. Customer accounts must use the ITACON mobile app.");
      }

      if (userDocData.status === "blocked" || userDocData.status === "inactive") {
        throw new Error("Your account has been deactivated or blocked. Please contact admin.");
      }

      const userProfile: UserProfile = {
        userId: userId || authUid || "",
        name: userDocData.name || userDocData.fullName || "User",
        email: userDocData.email || "",
        phone: userDocData.phone || userDocData.phoneNumber || "",
        role: userRole,
        companyName: userDocData.companyName,
        userCategory: userDocData.userCategory,
        salesPersonId: userDocData.salesPersonId,
        city: userDocData.city,
        state: userDocData.state,
        status: userDocData.status || "active",
      };

      // 4. Try fetching salesperson profile if salesperson
      let spProfile: SalesPerson | null = null;
      if (userRole === "salesperson" && userProfile.salesPersonId) {
        try {
          const spDoc = await getDoc(doc(db, "salesPersons", userProfile.salesPersonId));
          if (spDoc.exists()) {
            const data = spDoc.data();
            spProfile = {
              salesPersonId: spDoc.id,
              employeeId: data.employeeId || "",
              name: data.name || userProfile.name,
              phone: data.phone || userProfile.phone,
              email: data.email || userProfile.email,
              referralCode: data.referralCode || "",
              region: data.region || "Western Region",
              states: data.states || ["GJ"],
              status: data.status || "active",
              assignedClientsCount: data.assignedClientsCount || 0,
              activeClientsCount: data.activeClientsCount || 0,
            };
          }
        } catch (e) {
          console.warn("Could not fetch salesperson profile document:", e);
        }
      }

      // Update state and persist
      setUser(userProfile);
      setSalesperson(spProfile);
      setRole(userRole);

      localStorage.setItem(SESSION_KEY, JSON.stringify({
        user: userProfile,
        salesperson: spProfile,
        role: userRole,
      }));

    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (_) {}
    setUser(null);
    setSalesperson(null);
    setRole(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, salesperson, role, loading, login, logout }}>
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
