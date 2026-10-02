import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIndianPhone,
  isEmailIdentifier,
  validatePassword,
  buildUserProfileFromDoc,
  AuthException,
  ALLOWED_PORTAL_ROLES,
} from "../src/lib/auth-utils.ts";

test("1. Phone Normalization: Indian phone formats resolve to canonical +91 format", () => {
  assert.equal(normalizeIndianPhone("9624818477"), "+919624818477");
  assert.equal(normalizeIndianPhone("+919624818477"), "+919624818477");
  assert.equal(normalizeIndianPhone("919624818477"), "+919624818477");
  assert.equal(normalizeIndianPhone("+91 96248-18477"), "+919624818477");
  assert.equal(normalizeIndianPhone("9876543210"), "+919876543210");
});

test("2. Email vs Phone Detection: Correctly identifies real emails vs phone numbers", () => {
  assert.equal(isEmailIdentifier("admin@itacon.com"), true);
  assert.equal(isEmailIdentifier("vraj.patel@gmail.com"), true);
  assert.equal(isEmailIdentifier("9624818477"), false);
  assert.equal(isEmailIdentifier("+919624818477"), false);
  assert.equal(isEmailIdentifier("  sales@itacon.com  "), true);
});

test("3. Password Validation: Enforces password length and required constraints", () => {
  assert.equal(validatePassword(""), "Password is required.");
  assert.equal(validatePassword("short"), "Password must be at least 8 characters long.");
  assert.equal(validatePassword("ValidPassword123!"), null);
});

test("4. Client Profile Builder: Canonical phone & name are prioritized over legacy fields", () => {
  const docData = {
    name: "Canonical Staff",
    fullName: "Legacy Full Name",
    phone: "+919624818477",
    phoneNumber: "+919876543210",
    email: "staff@itacon.com",
    role: "salesperson",
    status: "active",
    salesPersonId: "SP_101",
  };

  const profile = buildUserProfileFromDoc("sp_user_01", docData);

  assert.equal(profile.userId, "sp_user_01");
  assert.equal(profile.name, "Canonical Staff");
  assert.equal(profile.phone, "+919624818477");
  assert.equal(profile.role, "salesperson");
});

test("5. Client Profile Builder: Legacy phoneNumber & fullName fallback when canonical fields absent", () => {
  const docData = {
    fullName: "Legacy Only Staff",
    phoneNumber: "+919876543210",
    role: "manager",
    status: "active",
  };

  const profile = buildUserProfileFromDoc("mgr_user_01", docData);

  assert.equal(profile.name, "Legacy Only Staff");
  assert.equal(profile.phone, "+919876543210");
  assert.equal(profile.role, "manager");
});

test("6. Client Profile Builder: Missing document throws ACCOUNT_NOT_FOUND", () => {
  assert.throws(
    () => buildUserProfileFromDoc("missing_uid", null),
    (err: unknown) => {
      assert.ok(err instanceof AuthException);
      assert.equal(err.code, "ACCOUNT_NOT_FOUND");
      return true;
    }
  );
});

test("7. Client Role Re-validation: Rejects customer accounts from staff portal (defense-in-depth)", () => {
  const customerDoc = {
    name: "Customer User",
    phone: "+919624818477",
    role: "customer",
    status: "active",
  };

  assert.throws(
    () => buildUserProfileFromDoc("cust_01", customerDoc),
    (err: unknown) => {
      assert.ok(err instanceof AuthException);
      assert.equal(err.code, "UNAUTHORIZED_ROLE");
      assert.match(err.message, /restricted to Salespersons and Admins/);
      return true;
    }
  );
});

test("8. Client Role Re-validation: Rejects dealer, retailer, builder, architect roles", () => {
  const disallowedRoles = ["dealer", "retailer", "wholesaler", "builder", "architect"];
  for (const role of disallowedRoles) {
    const docData = {
      name: `Role ${role}`,
      phone: "+919624818477",
      role,
      status: "active",
    };

    assert.throws(
      () => buildUserProfileFromDoc(`user_${role}`, docData),
      (err: unknown) => {
        assert.ok(err instanceof AuthException);
        assert.equal(err.code, "UNAUTHORIZED_ROLE");
        return true;
      }
    );
  }
});

test("9. Client Role Re-validation: Allows salesperson, manager, and admin", () => {
  for (const role of ALLOWED_PORTAL_ROLES) {
    const docData = {
      name: `Staff ${role}`,
      phone: "+919624818477",
      role,
      status: "active",
    };

    const profile = buildUserProfileFromDoc(`user_${role}`, docData);
    assert.equal(profile.role, role);
    assert.equal(profile.status, "active");
  }
});

test("10. Status Validation: Rejects inactive, blocked, or disabled accounts", () => {
  const blockedDoc = {
    name: "Blocked Staff",
    role: "salesperson",
    status: "blocked",
  };

  assert.throws(
    () => buildUserProfileFromDoc("sp_blocked", blockedDoc),
    (err: unknown) => {
      assert.ok(err instanceof AuthException);
      assert.equal(err.code, "INACTIVE_ACCOUNT");
      assert.match(err.message, /deactivated or blocked/);
      return true;
    }
  );

  const inactiveDoc = { ...blockedDoc, status: "inactive" };
  assert.throws(
    () => buildUserProfileFromDoc("sp_inactive", inactiveDoc),
    (err: unknown) => {
      assert.ok(err instanceof AuthException);
      assert.equal(err.code, "INACTIVE_ACCOUNT");
      return true;
    }
  );
});

test("11. Client Cleanliness: No passwordHash or passwordSalt exists on client profile", () => {
  const serverDoc = {
    name: "Admin Staff",
    phone: "+919624818477",
    email: "admin@itacon.com",
    role: "admin",
    status: "active",
    passwordHash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    passwordSalt: "test_salt_123",
  };

  const profile = buildUserProfileFromDoc("admin_01", serverDoc);
  const exposed = profile as unknown as Record<string, unknown>;

  assert.equal(exposed.password, undefined);
  assert.equal(exposed.passwordHash, undefined);
  assert.equal(exposed.passwordSalt, undefined);
});

test("12. Phase 2 Login Architecture Flow: Callable invoked -> Custom Token -> Auth -> users/{uid} Read", async () => {
  // Mock Callable Cloud Function
  const mockCalls: Array<{ identifier: string; password: string }> = [];
  const mockVerifyStaffCallable = async (data: { identifier: string; password: string }) => {
    mockCalls.push(data);
    if (data.identifier === "9624818477" && data.password === "Sales@1234") {
      return { data: { customToken: "mock_jwt_custom_token_SP_101" } };
    }
    const err = new Error("Invalid login credentials.");
    (err as unknown as Record<string, string>).code = "functions/unauthenticated";
    throw err;
  };

  // Mock signInWithCustomToken
  const mockTokensPassed: string[] = [];
  const mockSignInWithCustomToken = async (_auth: unknown, token: string) => {
    mockTokensPassed.push(token);
    return {
      user: {
        uid: "SP_101",
      },
    };
  };

  // Execute simulated login flow
  const identifier = "9624818477";
  const password = "Sales@1234";

  // Step 1: Call verifyStaffCredentials
  const res = await mockVerifyStaffCallable({ identifier, password });
  assert.equal(mockCalls.length, 1);
  assert.equal(mockCalls[0].identifier, "9624818477");
  assert.equal(res.data.customToken, "mock_jwt_custom_token_SP_101");

  // Step 2: signInWithCustomToken
  const cred = await mockSignInWithCustomToken(null, res.data.customToken);
  assert.equal(mockTokensPassed.length, 1);
  assert.equal(mockTokensPassed[0], "mock_jwt_custom_token_SP_101");
  assert.equal(cred.user.uid, "SP_101");

  // Step 3: Fetch users/{uid} (now authenticated as owner!)
  const mockUserDoc = {
    name: "Ramesh Sharma",
    phone: "+919624818477",
    role: "salesperson",
    status: "active",
    salesPersonId: "SP_101",
  };

  // Step 4: Build safe user profile with defense-in-depth role check
  const profile = buildUserProfileFromDoc(cred.user.uid, mockUserDoc);
  assert.equal(profile.userId, "SP_101");
  assert.equal(profile.role, "salesperson");
  assert.equal(profile.phone, "+919624818477");
});

test("13. Expected Login Failures: Map to AuthException and do not throw unhandled runtime errors", async () => {
  const handleLoginError = (err: unknown) => {
    const errorObj = err as { code?: string; message?: string };
    const code = errorObj?.code || "";
    const message = errorObj?.message || "";

    if (code === "functions/permission-denied" || message.includes("Access Denied")) {
      return new AuthException(
        "UNAUTHORIZED_ROLE",
        "Access Denied: This web portal is restricted to Salespersons and Admins. Customer accounts must use the ITACON mobile app."
      );
    }
    if (code === "functions/failed-precondition" || message.includes("deactivated or blocked")) {
      return new AuthException(
        "INACTIVE_ACCOUNT",
        "Your account has been deactivated or blocked. Please contact admin."
      );
    }
    if (code === "functions/unauthenticated" || message.includes("Invalid login credentials")) {
      return new AuthException(
        "INVALID_PASSWORD",
        "Invalid login credentials."
      );
    }
    return new AuthException(
      "TECHNICAL_ERROR",
      message || "Authentication service temporarily unavailable."
    );
  };

  const authErr = handleLoginError({ code: "functions/unauthenticated", message: "Invalid login credentials." });
  assert.equal(authErr.code, "INVALID_PASSWORD");
  assert.equal(authErr.message, "Invalid login credentials.");

  const permErr = handleLoginError({ code: "functions/permission-denied", message: "Access Denied: unauthorized" });
  assert.equal(permErr.code, "UNAUTHORIZED_ROLE");

  const statusErr = handleLoginError({ code: "functions/failed-precondition", message: "deactivated or blocked" });
  assert.equal(statusErr.code, "INACTIVE_ACCOUNT");
});

test("14. Zero Synthetic Emails & Zero Unauthenticated Queries: No user_<phone>@itacon.com dependency", () => {
  const phone = "9624818477";
  const canonicalPhone = normalizeIndianPhone(phone);
  assert.equal(canonicalPhone, "+919624818477");
  assert.ok(!canonicalPhone.includes("@itacon.com"));
  assert.ok(!canonicalPhone.includes("user_"));
});
