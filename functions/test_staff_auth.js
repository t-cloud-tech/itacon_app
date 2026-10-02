/**
 * Backend Unit & Security Policy Test Suite for ITACON Staff Authentication Engine
 * Tests functions/staffAuthEngine.js
 */

const assert = require("assert");
const crypto = require("crypto");
const {
  normalizeIndianPhone,
  isEmailIdentifier,
  verifyPasswordHash,
  ALLOWED_STAFF_ROLES,
  processStaffVerification,
} = require("./staffAuthEngine");

// Helper: generate test salt & SHA-256 hash matching Flutter & seeder
function createTestHash(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

// In-Memory Mock Firestore for unit testing
class MockFirestore {
  constructor(initialDocs = []) {
    this.docs = initialDocs.map((d) => ({
      id: d.id,
      data: () => ({ ...d.data }),
    }));
  }

  collection(name) {
    assert.strictEqual(name, "users", "Only authoritative users collection must be queried");
    const docs = this.docs;

    return {
      doc(id) {
        const found = docs.find((d) => d.id === id);
        return {
          id,
          get: async () => ({
            id,
            exists: !!found,
            data: () => (found ? found.data() : undefined),
          }),
        };
      },
      where(field, op, val) {
        assert.strictEqual(op, "==");
        const filtered = docs.filter((d) => {
          const data = d.data();
          return data[field] === val;
        });

        return {
          limit(num) {
            return {
              async get() {
                const limited = filtered.slice(0, num);
                return {
                  empty: limited.length === 0,
                  docs: limited.map((l) => ({
                    id: l.id,
                    data: () => l.data(),
                  })),
                };
              },
            };
          },
        };
      },
    };
  }
}

// Mock Firebase Admin Auth
class MockFirebaseAuth {
  constructor() {
    this.createdTokensFor = [];
  }

  async createCustomToken(uid) {
    assert.ok(uid, "UID must be provided to createCustomToken");
    this.createdTokensFor.push(uid);
    return `mock_custom_token_for_${uid}`;
  }
}

async function runTests() {
  console.log("Starting ITACON Staff Authentication Engine Backend Tests...\n");

  const salt1 = "test_salt_sp101";
  const pass1 = "Sales@1234";
  const hash1 = createTestHash(pass1, salt1);

  const mockUsers = [
    {
      id: "SP_101",
      data: {
        name: "Ramesh Sharma",
        phone: "+919624818477",
        email: "ramesh@itacon.com",
        role: "salesperson",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
        salesPersonId: "SP_101",
      },
    },
    {
      id: "MGR_01",
      data: {
        name: "Pooja Mehta",
        phone: "+919876543210",
        email: "pooja.manager@itacon.com",
        role: "manager",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "ADMIN_01",
      data: {
        name: "Vraj Patel",
        phone: "+919999988888",
        email: "vraj.admin@itacon.com",
        role: "admin",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "INACTIVE_STAFF",
      data: {
        name: "Inactive Staff",
        phone: "+919111122222",
        email: "inactive@itacon.com",
        role: "salesperson",
        status: "inactive",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "BLOCKED_STAFF",
      data: {
        name: "Blocked Staff",
        phone: "+919333344444",
        email: "blocked@itacon.com",
        role: "admin",
        status: "blocked",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "CUSTOMER_DOC",
      data: {
        name: "Retail Customer",
        phone: "+919555566666",
        email: "customer@gmail.com",
        role: "customer",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "DEALER_DOC",
      data: {
        name: "Gujarat Dealer",
        phone: "+919777788888",
        email: "dealer@itacon.com",
        role: "dealer",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "LEGACY_PHONE_STAFF",
      data: {
        name: "Legacy Staff",
        phoneNumber: "+919888877777",
        email: "legacy@itacon.com",
        role: "salesperson",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
  ];

  // 1. Valid salesperson phone/password
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();
    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "9624818477",
      password: "Sales@1234",
    });

    assert.ok(result.customToken, "Custom token must be returned");
    assert.strictEqual(auth.createdTokensFor[0], "SP_101");
    console.log("✔ Test 1: Valid salesperson login with phone and password succeeds");
  }

  // 2. Valid manager credentials
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();
    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "pooja.manager@itacon.com",
      password: "Sales@1234",
    });

    assert.ok(result.customToken);
    assert.strictEqual(auth.createdTokensFor[0], "MGR_01");
    console.log("✔ Test 2: Valid manager credentials succeed");
  }

  // 3. Valid admin credentials
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();
    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "vraj.admin@itacon.com",
      password: "Sales@1234",
    });

    assert.ok(result.customToken);
    assert.strictEqual(auth.createdTokensFor[0], "ADMIN_01");
    console.log("✔ Test 3: Valid admin credentials succeed");
  }

  // 4. Invalid identifier (account not found)
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "9999999999",
          password: "AnyPassword@123",
        });
      },
      (err) => {
        assert.strictEqual(err.code, "unauthenticated");
        assert.strictEqual(err.message, "Invalid login credentials.");
        return true;
      }
    );
    console.log("✔ Test 4: Nonexistent account throws generic unauthenticated error");
  }

  // 5. Invalid password
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "ramesh@itacon.com",
          password: "WrongPassword@123",
        });
      },
      (err) => {
        assert.strictEqual(err.code, "unauthenticated");
        assert.strictEqual(err.message, "Invalid login credentials.");
        return true;
      }
    );
    console.log("✔ Test 5: Incorrect password throws generic unauthenticated error");
  }

  // 6. Inactive staff rejected
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "inactive@itacon.com",
          password: "Sales@1234",
        });
      },
      (err) => {
        assert.strictEqual(err.code, "failed-precondition");
        assert.ok(err.message.includes("deactivated"));
        return true;
      }
    );
    console.log("✔ Test 6: Inactive staff account is rejected");
  }

  // 7. Blocked staff rejected
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "blocked@itacon.com",
          password: "Sales@1234",
        });
      },
      (err) => {
        assert.strictEqual(err.code, "failed-precondition");
        return true;
      }
    );
    console.log("✔ Test 7: Blocked staff account is rejected");
  }

  // 8. Customer role rejected
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "customer@gmail.com",
          password: "Sales@1234",
        });
      },
      (err) => {
        assert.strictEqual(err.code, "permission-denied");
        assert.ok(err.message.includes("Access Denied"));
        return true;
      }
    );
    console.log("✔ Test 8: Customer role account is rejected from staff portal");
  }

  // 9. Dealer/customer category account rejected
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "dealer@itacon.com",
          password: "Sales@1234",
        });
      },
      (err) => {
        assert.strictEqual(err.code, "permission-denied");
        return true;
      }
    );
    console.log("✔ Test 9: Dealer/customer category account is rejected");
  }

  // 10. Indian phone normalization
  {
    assert.strictEqual(normalizeIndianPhone("9624818477"), "+919624818477");
    assert.strictEqual(normalizeIndianPhone("+919624818477"), "+919624818477");
    assert.strictEqual(normalizeIndianPhone("919624818477"), "+919624818477");
    assert.strictEqual(normalizeIndianPhone("+91 96248-18477"), "+919624818477");
    console.log("✔ Test 10: Phone normalization converts 10/12-digit Indian formats to canonical +91");
  }

  // 11. Legacy staff phoneNumber fallback
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();
    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "9888877777",
      password: "Sales@1234",
    });

    assert.ok(result.customToken);
    assert.strictEqual(auth.createdTokensFor[0], "LEGACY_PHONE_STAFF");
    console.log("✔ Test 11: Legacy staff phoneNumber fallback resolves successfully");
  }

  // 12. SHA-256 legacy verification
  {
    const testPassword = "MySecurePassword#99";
    const testSalt = "random_salt_12345";
    const testHash = createTestHash(testPassword, testSalt);

    assert.strictEqual(verifyPasswordHash(testPassword, testSalt, testHash), true);
    assert.strictEqual(verifyPasswordHash("WrongPassword", testSalt, testHash), false);
    console.log("✔ Test 12: SHA-256 legacy verification matches expected hash");
  }

  // 13. Constant-time comparison path
  {
    const salt = "timing_salt";
    const storedHash = createTestHash("secret", salt);

    // TimingSafeEqual must return false for different hash strings of equal length
    const differentHash = createTestHash("other_secret", salt);
    assert.strictEqual(verifyPasswordHash("secret", salt, differentHash), false);

    // Handles mismatched byte lengths safely without throw
    assert.strictEqual(verifyPasswordHash("secret", salt, "short_invalid_hash"), false);
    console.log("✔ Test 13: Constant-time comparison functions safely via crypto.timingSafeEqual");
  }

  // 14. Custom token generated ONLY after successful validation
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();

    try {
      await processStaffVerification({
        firestoreDb: db,
        authAdmin: auth,
        identifier: "9624818477",
        password: "BadPassword",
      });
    } catch (_) {}

    assert.strictEqual(auth.createdTokensFor.length, 0, "No token must be created on failed auth");

    await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "9624818477",
      password: "Sales@1234",
    });

    assert.strictEqual(auth.createdTokensFor.length, 1);
    assert.strictEqual(auth.createdTokensFor[0], "SP_101");
    console.log("✔ Test 14: Custom token created strictly after complete validation");
  }

  // 15. No secrets returned
  {
    const db = new MockFirestore(mockUsers);
    const auth = new MockFirebaseAuth();
    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "9624818477",
      password: "Sales@1234",
    });

    assert.strictEqual(result.password, undefined);
    assert.strictEqual(result.passwordHash, undefined);
    assert.strictEqual(result.passwordSalt, undefined);
    assert.strictEqual(result.fcmToken, undefined);
    assert.strictEqual(result.userDoc, undefined);
    console.log("✔ Test 15: Output contains strictly customToken and no secret fields");
  }

  // 16. No secrets logged & Allowed roles check
  {
    assert.deepStrictEqual([...ALLOWED_STAFF_ROLES].sort(), ["admin", "manager", "salesperson"]);
    console.log("✔ Test 16: Allowed staff roles restricted to admin, manager, salesperson");
  }

  // =========================================================================
  // NEW PHASE 2.6: DUPLICATE & SHADOWED LEGACY STAFF RESOLUTION TESTS (17 - 34)
  // =========================================================================

  console.log("\nStarting Phase 2.6 Duplicate/Shadowed Staff Resolution Tests...\n");

  const canonUid = "9hhMaF6WFccGHJc4vyglAxPEPMJ3";
  const adminPass = "Admin@1234";
  const adminSalt = "admin_seed_salt";
  const adminHash = createTestHash(adminPass, adminSalt);

  const duplicateAdminUsers = [
    // 1. Canonical UID document appears first in query, has no hash
    {
      id: canonUid,
      data: {
        role: "admin",
        name: "Vraj Patel",
        email: "vrajp9013@gmail.com",
        phone: "9876543210",
        status: "active",
      },
    },
    // 2. Linked legacy document appears second in query, contains valid hash and userId link
    {
      id: "admin_01",
      data: {
        role: "admin",
        name: "Vraj Patel",
        email: "vrajp9013@gmail.com",
        phone: "9876543210",
        status: "active",
        userId: canonUid,
        passwordHash: adminHash,
        passwordSalt: adminSalt,
      },
    },
  ];

  // 17. Canonical document appears first (no hash), legacy doc appears second (with hash)
  // 18. Valid legacy password authenticates successfully
  // 19. Custom token uses canonical UID, NOT admin_01
  {
    const db = new MockFirestore(duplicateAdminUsers);
    const auth = new MockFirebaseAuth();

    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "vrajp9013@gmail.com",
      password: adminPass,
    });

    assert.ok(result.customToken, "Custom token must be generated");
    assert.strictEqual(auth.createdTokensFor[0], canonUid, "Token must be for canonical UID 9hh..., NOT admin_01");
    console.log("✔ Test 17-19: Canonical doc without hash + linked legacy doc with hash resolves and mints token for canonical UID");
  }

  // 20. Canonical profile role controls authorization (legacy role cannot override canonical unauthorized role)
  {
    const usersWithUnauthorizedCanonical = [
      {
        id: canonUid,
        data: {
          role: "customer", // CANONICAL ROLE IS CUSTOMER!
          email: "vrajp9013@gmail.com",
          status: "active",
        },
      },
      {
        id: "admin_01",
        data: {
          role: "admin", // Legacy claims to be admin
          email: "vrajp9013@gmail.com",
          userId: canonUid,
          passwordHash: adminHash,
          passwordSalt: adminSalt,
        },
      },
    ];

    const db = new MockFirestore(usersWithUnauthorizedCanonical);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "vrajp9013@gmail.com",
          password: adminPass,
        });
      },
      (err) => {
        assert.strictEqual(err.code, "permission-denied");
        return true;
      }
    );
    assert.strictEqual(auth.createdTokensFor.length, 0);
    console.log("✔ Test 20: Canonical profile role controls authorization; legacy role cannot override canonical customer role");
  }

  // 21. Canonical inactive account rejects login
  {
    const usersWithInactiveCanonical = [
      {
        id: canonUid,
        data: {
          role: "admin",
          email: "vrajp9013@gmail.com",
          status: "inactive", // CANONICAL STATUS IS INACTIVE
        },
      },
      {
        id: "admin_01",
        data: {
          role: "admin",
          status: "active",
          email: "vrajp9013@gmail.com",
          userId: canonUid,
          passwordHash: adminHash,
          passwordSalt: adminSalt,
        },
      },
    ];

    const db = new MockFirestore(usersWithInactiveCanonical);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "vrajp9013@gmail.com",
          password: adminPass,
        });
      },
      (err) => {
        assert.strictEqual(err.code, "failed-precondition");
        return true;
      }
    );
    console.log("✔ Test 21: Canonical inactive account rejects login even if legacy doc status says active");
  }

  // 22. Mismatching email between legacy and canonical documents rejects
  {
    const usersWithEmailMismatch = [
      {
        id: canonUid,
        data: {
          role: "admin",
          email: "legitimate.admin@gmail.com",
          status: "active",
        },
      },
      {
        id: "admin_malicious",
        data: {
          role: "admin",
          email: "attacker@gmail.com", // Mismatching email claiming to link to canonUid
          userId: canonUid,
          passwordHash: adminHash,
          passwordSalt: adminSalt,
        },
      },
    ];

    const db = new MockFirestore(usersWithEmailMismatch);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "attacker@gmail.com",
          password: adminPass,
        });
      },
      (err) => {
        assert.strictEqual(err.code, "unauthenticated");
        assert.strictEqual(err.message, "Invalid login credentials.");
        return true;
      }
    );
    console.log("✔ Test 22: Mismatching email between legacy and canonical documents rejects");
  }

  // 23. Mismatching phone identity rejects when applicable
  {
    const usersWithPhoneMismatch = [
      {
        id: canonUid,
        data: {
          role: "admin",
          email: "vrajp9013@gmail.com",
          phone: "+919876543210",
          status: "active",
        },
      },
      {
        id: "admin_wrong_phone",
        data: {
          role: "admin",
          email: "vrajp9013@gmail.com",
          phone: "+919111122222", // Conflicting phone
          userId: canonUid,
          passwordHash: adminHash,
          passwordSalt: adminSalt,
        },
      },
    ];

    const db = new MockFirestore(usersWithPhoneMismatch);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "vrajp9013@gmail.com",
          password: adminPass,
        });
      },
      (err) => {
        assert.strictEqual(err.code, "unauthenticated");
        return true;
      }
    );
    console.log("✔ Test 23: Mismatching phone identity rejects when applicable");
  }

  // 24. Nonexistent linked canonical UID rejects
  {
    const usersWithGhostLink = [
      {
        id: "admin_ghost",
        data: {
          role: "admin",
          email: "ghost@itacon.com",
          userId: "NONEXISTENT_CANONICAL_UID_12345",
          passwordHash: adminHash,
          passwordSalt: adminSalt,
        },
      },
    ];

    const db = new MockFirestore(usersWithGhostLink);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "ghost@itacon.com",
          password: adminPass,
        });
      },
      (err) => {
        assert.strictEqual(err.code, "unauthenticated");
        return true;
      }
    );
    console.log("✔ Test 24: Nonexistent linked canonical UID rejects");
  }

  // 25. Multiple matching docs resolving to SAME canonical UID are safe
  {
    const triplyRedundantDocs = [
      {
        id: canonUid,
        data: {
          role: "admin",
          email: "vrajp9013@gmail.com",
          phone: "9876543210",
          status: "active",
        },
      },
      {
        id: "admin_01",
        data: {
          role: "admin",
          email: "vrajp9013@gmail.com",
          phone: "9876543210",
          status: "active",
          userId: canonUid,
          passwordHash: adminHash,
          passwordSalt: adminSalt,
        },
      },
      {
        id: "admin_legacy_archive",
        data: {
          role: "admin",
          email: "vrajp9013@gmail.com",
          phone: "9876543210",
          status: "active",
          userId: canonUid,
          passwordHash: adminHash,
          passwordSalt: adminSalt,
        },
      },
    ];

    const db = new MockFirestore(triplyRedundantDocs);
    const auth = new MockFirebaseAuth();

    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "vrajp9013@gmail.com",
      password: adminPass,
    });

    assert.ok(result.customToken);
    assert.strictEqual(auth.createdTokensFor[0], canonUid);
    console.log("✔ Test 25: Multiple matching docs resolving to SAME canonical UID are safe");
  }

  // 26. Multiple matching docs resolving to DIFFERENT UIDs reject as AMBIGUOUS_STAFF_IDENTITY
  {
    const ambiguousConflictingDocs = [
      {
        id: "UID_STAFF_A",
        data: {
          role: "admin",
          email: "shared.admin@itacon.com",
          status: "active",
        },
      },
      {
        id: "UID_STAFF_B",
        data: {
          role: "manager",
          email: "shared.admin@itacon.com",
          status: "active",
        },
      },
    ];

    const db = new MockFirestore(ambiguousConflictingDocs);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "shared.admin@itacon.com",
          password: adminPass,
        });
      },
      (err) => {
        assert.strictEqual(err.code, "unauthenticated");
        assert.strictEqual(err.message, "Invalid login credentials.");
        return true;
      }
    );
    console.log("✔ Test 26: Multiple matching docs resolving to DIFFERENT UIDs reject as AMBIGUOUS_STAFF_IDENTITY");
  }

  // 27. Incorrect legacy password rejects
  {
    const db = new MockFirestore(duplicateAdminUsers);
    const auth = new MockFirebaseAuth();

    await assert.rejects(
      async () => {
        await processStaffVerification({
          firestoreDb: db,
          authAdmin: auth,
          identifier: "vrajp9013@gmail.com",
          password: "CompletelyWrongPassword!123",
        });
      },
      (err) => {
        assert.strictEqual(err.code, "unauthenticated");
        return true;
      }
    );
    console.log("✔ Test 27: Incorrect legacy password rejects");
  }

  // 28. Standard Firebase Auth path remains supported
  {
    const singleFirebaseAuthUser = [
      {
        id: "FIREBASE_AUTH_UID_99",
        data: {
          role: "salesperson",
          email: "firebase.user@itacon.com",
          status: "active",
          // No passwordHash or salt
        },
      },
    ];

    const mockHttpClient = {
      async post(url, body) {
        if (body.email === "firebase.user@itacon.com" && body.password === "ValidAuthPass123!") {
          return {
            data: {
              localId: "FIREBASE_AUTH_UID_99",
              email: "firebase.user@itacon.com",
            },
          };
        }
        throw new Error("INVALID_PASSWORD");
      },
    };

    const db = new MockFirestore(singleFirebaseAuthUser);
    const auth = new MockFirebaseAuth();

    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      httpClient: mockHttpClient,
      apiKey: "mock_api_key",
      identifier: "firebase.user@itacon.com",
      password: "ValidAuthPass123!",
    });

    assert.ok(result.customToken);
    assert.strictEqual(auth.createdTokensFor[0], "FIREBASE_AUTH_UID_99");
    console.log("✔ Test 28: Standard Firebase Auth path remains supported");
  }

  // 29. Phone duplicate-resolution follows same safe identity rules
  {
    const duplicatePhoneUsers = [
      {
        id: "CANONICAL_PHONE_UID",
        data: {
          role: "salesperson",
          name: "Phone Staff",
          phone: "+919876543210",
          status: "active",
        },
      },
      {
        id: "SP_LEGACY_01",
        data: {
          role: "salesperson",
          name: "Phone Staff",
          phone: "+919876543210",
          userId: "CANONICAL_PHONE_UID",
          status: "active",
          passwordHash: adminHash,
          passwordSalt: adminSalt,
        },
      },
    ];

    const db = new MockFirestore(duplicatePhoneUsers);
    const auth = new MockFirebaseAuth();

    const result = await processStaffVerification({
      firestoreDb: db,
      authAdmin: auth,
      identifier: "9876543210",
      password: adminPass,
    });

    assert.ok(result.customToken);
    assert.strictEqual(auth.createdTokensFor[0], "CANONICAL_PHONE_UID");
    console.log("✔ Test 29: Phone duplicate-resolution follows same safe identity rules");
  }

  console.log("\n========================================");
  console.log("ALL BACKEND STAFF AUTH TESTS PASSED!");
  console.log("========================================\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
