import type { UserProfile, UserRole } from "../types/index.ts";

export function validatePassword(password: string): string | null {
  if (!password || !password.trim()) {
    return "Password is required.";
  }
  if (password.trim().length < 8) {
    return "Password must be at least 8 characters long.";
  }
  return null;
}

/**
 * Normalizes Indian phone numbers according to canonical app behavior:
 * - 9624818477 -> +919624818477
 * - +919624818477 -> +919624818477
 * - 919624818477 -> +919624818477
 * Stored canonical phone number in Firestore is +91XXXXXXXXXX.
 */
export function normalizeIndianPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  // 12 digits starting with 91: e.g. 919624818477 -> +919624818477
  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }

  // 10 digits: e.g. 9624818477 -> +919624818477
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // If already starts with '+' and has digits
  if (phoneNumber.trim().startsWith("+")) {
    return `+${digits}`;
  }

  // Fallback
  return digits ? `+${digits}` : phoneNumber.trim();
}

/**
 * Checks whether the login identifier is an email address.
 */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.trim().includes("@");
}

export type AuthErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "INVALID_PASSWORD"
  | "INACTIVE_ACCOUNT"
  | "UNAUTHORIZED_ROLE"
  | "TECHNICAL_ERROR";

export class AuthException extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthException";
    this.code = code;
    Object.setPrototypeOf(this, AuthException.prototype);
  }
}

export const ALLOWED_PORTAL_ROLES: readonly string[] = ["admin", "manager", "salesperson"];

/**
 * Client-side user profile constructor and defense-in-depth role re-validator.
 * Operates purely on the authenticated users/{uid} document.
 * Contains ZERO passwordHash, passwordSalt, or SHA-256 verification.
 */
export function buildUserProfileFromDoc(
  userId: string,
  userDocData: Record<string, unknown> | null
): UserProfile {
  if (!userDocData) {
    throw new AuthException(
      "ACCOUNT_NOT_FOUND",
      "User profile document not found."
    );
  }

  // Verify Role: Staff only (Salesperson, Manager, Admin)
  const rawRole = typeof userDocData.role === "string" ? userDocData.role : "salesperson";
  const userRole = rawRole.toLowerCase().trim() as UserRole;
  if (!ALLOWED_PORTAL_ROLES.includes(userRole)) {
    throw new AuthException(
      "UNAUTHORIZED_ROLE",
      "Access Denied: This web portal is restricted to Salespersons and Admins. Customer accounts must use the ITACON mobile app."
    );
  }

  // Verify Account status
  const status = typeof userDocData.status === "string" ? userDocData.status.toLowerCase().trim() : "active";
  if (status === "blocked" || status === "inactive" || status === "disabled") {
    throw new AuthException(
      "INACTIVE_ACCOUNT",
      "Your account has been deactivated or blocked. Please contact admin."
    );
  }

  // Construct canonical profile (preferring canonical fields 'phone' and 'name')
  const phone = (typeof userDocData.phone === "string" && userDocData.phone) ||
    (typeof userDocData.phoneNumber === "string" && userDocData.phoneNumber) ||
    "";
  const name = (typeof userDocData.name === "string" && userDocData.name) ||
    (typeof userDocData.fullName === "string" && userDocData.fullName) ||
    "User";
  const email = typeof userDocData.email === "string" ? userDocData.email : "";

  const userProfile: UserProfile = {
    userId,
    name,
    email,
    phone,
    role: userRole,
    companyName: typeof userDocData.companyName === "string" ? userDocData.companyName : undefined,
    userCategory: typeof userDocData.userCategory === "string" ? userDocData.userCategory : undefined,
    salesPersonId: typeof userDocData.salesPersonId === "string" ? userDocData.salesPersonId : undefined,
    city: typeof userDocData.city === "string" ? userDocData.city : undefined,
    state: typeof userDocData.state === "string" ? userDocData.state : undefined,
    status: status === "blocked" || status === "inactive" ? status : "active",
  };

  return userProfile;
}


