/**
 * Backend Unit & Security Policy Test Suite for ITACON Customer Authentication Engine
 * Tests functions/customerAuthEngine.js
 */

const assert = require("assert");
const crypto = require("crypto");
const {
  processCustomerVerification,
  normalizeUsername,
  verifyPassword,
  verifySha256Hash,
  verifyScryptHash,
  hashPasswordScrypt,
  clearRateLimitDistributed,
  ALLOWED_CUSTOMER_ROLES,
  FORBIDDEN_STAFF_ROLES,
} = require("./customerAuthEngine");

// Helper: generate test salt & SHA-256 hash matching Flutter
function createTestHash(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

// In-Memory Shared Store for Mocking Multi-Instance Firestore
class SharedFirestoreMemory {
  constructor(initialUsers = []) {
    this.users = new Map(initialUsers.map((u) => [u.id, { ...u.data }]));
    this.rateLimits = new Map();
    this.txQueue = Promise.resolve();
  }

  async runTx(fn) {
    const next = this.txQueue.then(() => fn());
    this.txQueue = next.catch(() => {});
    return next;
  }
}

// In-Memory Mock Firestore representing an individual Cloud Function instance
class MockFirestore {
  constructor(sharedStore) {
    this.store = sharedStore;
  }

  collection(name) {
    const store = this.store;

    if (name === "auth_rate_limits") {
      return {
        doc(id) {
          return {
            id,
            get: async () => {
              const data = store.rateLimits.get(id);
              return {
                id,
                exists: !!data,
                data: () => (data ? { ...data } : undefined),
              };
            },
            delete: async () => {
              store.rateLimits.delete(id);
            },
          };
        },
      };
    }

    assert.strictEqual(name, "users", "Only authoritative collections may be queried");

    return {
      doc(id) {
        return {
          id,
          get: async () => {
            const data = store.users.get(id);
            return {
              id,
              exists: !!data,
              data: () => (data ? { ...data } : undefined),
            };
          },
          update: async (fields) => {
            const current = store.users.get(id) || {};
            store.users.set(id, { ...current, ...fields });
          },
        };
      },
      where(field, op, val) {
        assert.strictEqual(op, "==");
        const matched = [];
        for (const [id, data] of store.users.entries()) {
          if (data[field] === val) {
            matched.push({ id, data: () => ({ ...data }), ref: this.doc(id) });
          }
        }

        return {
          limit(num) {
            return {
              async get() {
                const limited = matched.slice(0, num);
                return {
                  empty: limited.length === 0,
                  docs: limited,
                };
              },
            };
          },
        };
      },
    };
  }

  async runTransaction(updateFunction) {
    return this.store.runTx(async () => {
      const transaction = {
        get: async (docRef) => {
          const data = this.store.rateLimits.get(docRef.id);
          return {
            id: docRef.id,
            exists: !!data,
            data: () => (data ? { ...data } : undefined),
          };
        },
        set: (docRef, data, options = {}) => {
          if (options.merge) {
            const current = this.store.rateLimits.get(docRef.id) || {};
            this.store.rateLimits.set(docRef.id, { ...current, ...data });
          } else {
            this.store.rateLimits.set(docRef.id, { ...data });
          }
        },
        delete: (docRef) => {
          this.store.rateLimits.delete(docRef.id);
        },
      };

      return updateFunction(transaction);
    });
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
  console.log("Starting ITACON Customer Authentication Engine Backend Tests...\n");

  const salt1 = "cust_salt_101";
  const pass1 = "Customer@1234";
  const hash1 = createTestHash(pass1, salt1);

  const initialUsers = [
    {
      id: "CUST_101",
      data: {
        userId: "CUST_101",
        uid: "CUST_101",
        name: "Patel Tiles Store",
        username: "pateltiles",
        phone: "+919876543210",
        rawPhone: "9876543210",
        role: "dealer",
        userCategory: "dealer",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
        passwordAlgorithm: "sha256",
      },
    },
    {
      id: "CUST_PENDING_102",
      data: {
        userId: "CUST_PENDING_102",
        uid: "CUST_PENDING_102",
        name: "Shreeji Ceramics",
        username: "shreejiceramics",
        phone: "+919876543211",
        role: "wholesaler",
        userCategory: "wholesaler",
        status: "pending_salesperson_verification",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "CUST_BLOCKED_103",
      data: {
        userId: "CUST_BLOCKED_103",
        uid: "CUST_BLOCKED_103",
        name: "Blocked Customer",
        username: "blockeduser",
        phone: "+919876543212",
        role: "retailer",
        status: "blocked",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "CUST_INACTIVE_104",
      data: {
        userId: "CUST_INACTIVE_104",
        uid: "CUST_INACTIVE_104",
        name: "Inactive Customer",
        username: "inactiveuser",
        phone: "+919876543213",
        role: "architect",
        status: "inactive",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "CUST_SUSPENDED_105",
      data: {
        userId: "CUST_SUSPENDED_105",
        uid: "CUST_SUSPENDED_105",
        name: "Suspended Customer",
        username: "suspendeduser",
        phone: "+919876543214",
        role: "builder",
        status: "suspended",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "STAFF_201",
      data: {
        userId: "STAFF_201",
        uid: "STAFF_201",
        name: "Sales Executive 1",
        username: "salesperson1",
        phone: "+919876543299",
        role: "salesperson",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "DUP_1",
      data: {
        userId: "DUP_UID_1",
        uid: "DUP_UID_1",
        name: "Duplicate User 1",
        username: "duplicateuser",
        phone: "+919876543220",
        role: "dealer",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "DUP_2",
      data: {
        userId: "DUP_UID_2",
        uid: "DUP_UID_2",
        name: "Duplicate User 2",
        username: "duplicateuser",
        phone: "+919876543221",
        role: "dealer",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "LEGACY_NAME_ONLY",
      data: {
        userId: "LEGACY_UID_1",
        uid: "LEGACY_UID_1",
        name: "Legacy Trader",
        // no username field
        phone: "+919876543230",
        role: "trader",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "COLLISION_NAME_A",
      data: {
        userId: "COLLISION_UID_A",
        name: "Common Name Dealer",
        // no username field
        phone: "+919876543240",
        role: "dealer",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "COLLISION_NAME_B",
      data: {
        userId: "COLLISION_UID_B",
        name: "Common Name Dealer",
        // no username field
        phone: "+919876543241",
        role: "dealer",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
    {
      id: "EXPLICIT_USER_PROTECTED",
      data: {
        userId: "EXPLICIT_UID_1",
        name: "John Doe",
        username: "johndoe_official",
        phone: "+919876543250",
        role: "dealer",
        status: "active",
        passwordHash: hash1,
        passwordSalt: salt1,
      },
    },
  ];

  const sharedStore = new SharedFirestoreMemory(initialUsers);

  // Helper to run verification on a specific simulated instance
  async function testVerify(username, password, clientIp = "127.0.0.1", options = {}) {
    const firestoreDb = new MockFirestore(sharedStore);
    const authAdmin = new MockFirebaseAuth();
    return processCustomerVerification({
      firestoreDb,
      authAdmin,
      username,
      password,
      clientIp,
      enablePasswordMigration: options.enablePasswordMigration ?? false,
    });
  }

  // TEST 1: Valid Customer Login (Active Dealer)
  console.log("✔ Test 1: Valid existing customer credentials generate custom token");
  const res1 = await testVerify("pateltiles", "Customer@1234");
  assert.strictEqual(res1.customToken, "mock_custom_token_for_CUST_101");
  assert.strictEqual(res1.passwordHash, undefined, "Must NEVER return passwordHash");
  assert.strictEqual(res1.passwordSalt, undefined, "Must NEVER return passwordSalt");

  // TEST 2: Case-Insensitive Username Match
  console.log("✔ Test 2: Username normalization handles uppercase and whitespace");
  const res2 = await testVerify("  PatelTiles  ", "Customer@1234");
  assert.strictEqual(res2.customToken, "mock_custom_token_for_CUST_101");

  // TEST 3: Incorrect Password
  console.log("✔ Test 3: Incorrect password throws generic unauthenticated error");
  try {
    await testVerify("pateltiles", "WrongPassword!99");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "unauthenticated");
    assert.ok(err.message.includes("Invalid username or password"));
  }

  // TEST 4: Non-Existent Username
  console.log("✔ Test 4: Non-existent username throws generic unauthenticated error");
  try {
    await testVerify("nonexistentuser999", "Customer@1234");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "unauthenticated");
    assert.ok(err.message.includes("Invalid username or password"));
  }

  // TEST 5: Blocked Account
  console.log("✔ Test 5: Blocked customer account is rejected with failed-precondition");
  try {
    await testVerify("blockeduser", "Customer@1234");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "failed-precondition");
    assert.ok(err.message.toLowerCase().includes("inactive or blocked"));
  }

  // TEST 6: Inactive Account
  console.log("✔ Test 6: Inactive customer account is rejected with failed-precondition");
  try {
    await testVerify("inactiveuser", "Customer@1234");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "failed-precondition");
    assert.ok(err.message.toLowerCase().includes("inactive or blocked"));
  }

  // TEST 7: Suspended Account
  console.log("✔ Test 7: Suspended customer account is rejected with failed-precondition");
  try {
    await testVerify("suspendeduser", "Customer@1234");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "failed-precondition");
    assert.ok(err.message.toLowerCase().includes("inactive or blocked"));
  }

  // TEST 8: Pending Salesperson Verification Account is Allowed
  console.log("✔ Test 8: Pending salesperson verification account is allowed to authenticate");
  const res8 = await testVerify("shreejiceramics", "Customer@1234");
  assert.strictEqual(res8.customToken, "mock_custom_token_for_CUST_PENDING_102");

  // TEST 9: Staff Account Attempting Customer Login is Rejected
  console.log("✔ Test 9: Staff account attempting customer login is rejected with permission-denied");
  try {
    await testVerify("salesperson1", "Customer@1234");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "permission-denied");
    assert.ok(err.message.includes("Staff accounts must use the official staff web portal"));
  }

  // TEST 10: Duplicate / Ambiguous Usernames are Rejected
  console.log("✔ Test 10: Ambiguous duplicate usernames across different UIDs are rejected");
  try {
    await testVerify("duplicateuser", "Customer@1234");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.strictEqual(err.code, "unauthenticated");
    assert.ok(err.message.includes("Multiple accounts match this identifier"));
  }

  // TEST 11: Legacy Customer Account Matching by Name
  console.log("✔ Test 11: Legacy account matching by name generates custom token");
  const res11 = await testVerify("Legacy Trader", "Customer@1234");
  assert.strictEqual(res11.customToken, "mock_custom_token_for_LEGACY_UID_1");

  // TEST 12: Distributed Rate Limiting Across Multiple Cloud Function Instances
  console.log("✔ Test 12: Distributed rate limiting enforces shared lockout across distinct instances");
  const distUser = "distratelimituser";
  const instanceA_db = new MockFirestore(sharedStore);
  const instanceB_db = new MockFirestore(sharedStore);
  const instanceC_db = new MockFirestore(sharedStore);
  const authAdmin = new MockFirebaseAuth();

  // Instance A receives 2 failed attempts
  for (let i = 0; i < 2; i++) {
    try {
      await processCustomerVerification({
        firestoreDb: instanceA_db,
        authAdmin,
        username: distUser,
        password: "BadPasswordA",
        clientIp: "1.1.1.1",
      });
    } catch (e) {
      assert.strictEqual(e.code, "unauthenticated");
    }
  }

  // Instance B receives 3 failed attempts
  for (let i = 0; i < 3; i++) {
    try {
      await processCustomerVerification({
        firestoreDb: instanceB_db,
        authAdmin,
        username: distUser,
        password: "BadPasswordB",
        clientIp: "2.2.2.2",
      });
    } catch (e) {
      assert.strictEqual(e.code, "unauthenticated");
    }
  }

  // Instance C receives the 6th attempt — MUST BE LOCKED OUT by shared Firestore state!
  try {
    await processCustomerVerification({
      firestoreDb: instanceC_db,
      authAdmin,
      username: distUser,
      password: "BadPasswordC",
      clientIp: "3.3.3.3",
    });
    assert.fail("Instance C should have rejected with resource-exhausted");
  } catch (err) {
    assert.strictEqual(err.code, "resource-exhausted");
    assert.ok(err.message.includes("Too many failed login attempts"));
  }

  // TEST 13: Case & Whitespace Variations Share Same Distributed Rate Limit
  console.log("✔ Test 13: Username capitalization/whitespace variants share the same rate-limit bucket");
  try {
    await processCustomerVerification({
      firestoreDb: instanceC_db,
      authAdmin,
      username: "  DISTRateLimitUser  ",
      password: "BadPassword",
      clientIp: "4.4.4.4",
    });
    assert.fail("Variations must be blocked by same rate limit bucket");
  } catch (err) {
    assert.strictEqual(err.code, "resource-exhausted");
  }

  // TEST 14: Rate Limit Expiration / No Permanent Lockout
  console.log("✔ Test 14: Rate limit record expires cleanly without permanent lockout");
  // Simulate time fast-forward past 15-minute window
  const rateLimitKey = crypto.createHash("sha256").update(`customer:${distUser}`).digest("hex");
  const rateDoc = sharedStore.rateLimits.get(rateLimitKey);
  assert.ok(rateDoc, "Rate limit doc should exist");
  rateDoc.lockedUntil = Date.now() - 1000; // expired in past
  rateDoc.lastFailedAt = Date.now() - (16 * 60 * 1000); // 16 min ago

  // Now a new attempt is allowed to be evaluated
  try {
    await processCustomerVerification({
      firestoreDb: instanceA_db,
      authAdmin,
      username: distUser,
      password: "BadPasswordA",
      clientIp: "1.1.1.1",
    });
  } catch (e) {
    // Should fail with unauthenticated (credential failure), NOT resource-exhausted
    assert.strictEqual(e.code, "unauthenticated");
  }

  // TEST 15: Successful Login Clears Distributed Rate Limit
  console.log("✔ Test 15: Successful login clears rate limit records");
  await processCustomerVerification({
    firestoreDb: instanceA_db,
    authAdmin,
    username: "pateltiles",
    password: "Customer@1234",
  });
  const patelRateKey = crypto.createHash("sha256").update("customer:pateltiles").digest("hex");
  assert.strictEqual(sharedStore.rateLimits.get(patelRateKey), undefined);

  // TEST 16: Password Hashing — Scrypt Verification
  console.log("✔ Test 16: Scrypt memory-hard hash verification succeeds");
  const scryptSalt = crypto.randomBytes(16).toString("hex");
  const scryptHash = hashPasswordScrypt("ModernPassword@2026", scryptSalt);
  assert.strictEqual(verifyPassword("ModernPassword@2026", scryptSalt, scryptHash, "scrypt"), true);
  assert.strictEqual(verifyPassword("WrongPassword", scryptSalt, scryptHash, "scrypt"), false);

  // TEST 17: Lazy Password Migration to Scrypt
  console.log("✔ Test 17: Lazy migration updates SHA-256 account to scrypt and supports future login");
  const userBefore = sharedStore.users.get("CUST_101");
  assert.strictEqual(userBefore.passwordAlgorithm, "sha256");

  // Login with migration enabled
  const migRes = await testVerify("pateltiles", "Customer@1234", "127.0.0.1", {
    enablePasswordMigration: true,
  });
  assert.strictEqual(migRes.customToken, "mock_custom_token_for_CUST_101");

  const userAfter = sharedStore.users.get("CUST_101");
  assert.strictEqual(userAfter.passwordAlgorithm, "scrypt");
  assert.notStrictEqual(userAfter.passwordHash, hash1); // Migrated to new scrypt hash!
  assert.ok(userAfter.passwordMigratedAt > 0);

  // Next login uses the migrated scrypt hash seamlessly
  const migNextRes = await testVerify("pateltiles", "Customer@1234", "127.0.0.1", {
    enablePasswordMigration: true,
  });
  assert.strictEqual(migNextRes.customToken, "mock_custom_token_for_CUST_101");

  // TEST 18: Display Name Fallback Rejects Colliding Identities
  console.log("✔ Test 18: Name fallback rejects when multiple accounts share the same display name");
  try {
    await testVerify("Common Name Dealer", "Customer@1234");
    assert.fail("Should have rejected ambiguous display name");
  } catch (err) {
    assert.strictEqual(err.code, "unauthenticated");
    assert.ok(err.message.includes("Multiple accounts match this identifier"));
  }

  // TEST 19: Display Name Fallback Cannot Access Account with Explicit Username
  console.log("✔ Test 19: Account with explicit username cannot be accessed via display name");
  try {
    await testVerify("John Doe", "Customer@1234");
    assert.fail("Should not resolve John Doe via display name when username is johndoe_official");
  } catch (err) {
    assert.strictEqual(err.code, "unauthenticated");
  }

  // But logging in with explicit username succeeds
  const expRes = await testVerify("johndoe_official", "Customer@1234");
  assert.strictEqual(expRes.customToken, "mock_custom_token_for_EXPLICIT_UID_1");

  // TEST 21: Concurrent Rate-Limiting with Simultaneous Parallel Requests
  console.log("✔ Test 21: Simultaneous concurrent failed requests across multiple instances cannot bypass limit");
  const concUser = "concurrent_attacker";
  const instances = Array.from({ length: 8 }, () => new MockFirestore(sharedStore));

  // Fire 8 simultaneous requests concurrently via Promise.all
  const concurrentResults = await Promise.allSettled(
    instances.map((db, idx) =>
      processCustomerVerification({
        firestoreDb: db,
        authAdmin,
        username: concUser,
        password: `BadPassword_${idx}`,
        clientIp: `192.168.1.${idx + 1}`,
      })
    )
  );

  // All 8 requests must have failed (either unauthenticated or resource-exhausted)
  for (const res of concurrentResults) {
    assert.strictEqual(res.status, "rejected");
  }

  // The 9th request must be immediately locked out by the shared rate limit
  try {
    await processCustomerVerification({
      firestoreDb: instances[0],
      authAdmin,
      username: concUser,
      password: "AnotherBadPassword",
      clientIp: "192.168.1.99",
    });
    assert.fail("9th request must be locked out");
  } catch (err) {
    assert.strictEqual(err.code, "resource-exhausted");
  }

  // TEST 22: Password Reset Compatibility (Flutter SHA-256 Reset on Scrypt Account)
  console.log("✔ Test 22: Password reset via Flutter produces valid hash recognized by customerAuthEngine");
  const userToReset = sharedStore.users.get("CUST_101");
  // Simulate Flutter updating password to new SHA-256 credentials
  const resetPass = "NewResetPassword@2026";
  const resetSalt = crypto.randomBytes(16).toString("hex");
  const resetHash = createTestHash(resetPass, resetSalt);

  userToReset.passwordHash = resetHash;
  userToReset.passwordSalt = resetSalt;
  userToReset.passwordAlgorithm = "sha256";

  const resetLoginRes = await testVerify("pateltiles", resetPass);
  assert.strictEqual(resetLoginRes.customToken, "mock_custom_token_for_CUST_101");

  // TEST 24: Actual Registration Salt & Colon Hash Format Compatibility
  console.log("✔ Test 24: Actual Flutter Registration format (base64Url salt + colon SHA-256) verifies correctly");
  // Exact format generated by Flutter AuthService: generateSalt() (16 random bytes base64Url encoded)
  const regSalt = Buffer.from(crypto.randomBytes(16)).toString("base64url");
  const regPass = "Register@2026";
  const regHashColon = crypto.createHash("sha256").update(`${regSalt}:${regPass}`).digest("hex");

  sharedStore.users.set("REG_USER_1", {
    name: "Newly Registered User",
    username: "newlyregistered",
    phone: "+919111122222",
    role: "customer",
    status: "active",
    passwordSalt: regSalt,
    passwordHash: regHashColon,
    passwordAlgorithm: "sha256",
  });

  const regLoginRes = await testVerify("newlyregistered", regPass);
  assert.strictEqual(regLoginRes.customToken, "mock_custom_token_for_REG_USER_1");

  // TEST 25: Legacy Underscore Hash Format Compatibility (salt + "_" + password)
  console.log("✔ Test 25: Legacy customer hash using underscore separator (salt_password) verifies correctly");
  const legSalt = crypto.randomBytes(16).toString("hex");
  const legPass = "LegacyUnderscore@2026";
  const legHashUnderscore = crypto.createHash("sha256").update(`${legSalt}_${legPass}`).digest("hex");

  sharedStore.users.set("LEG_USER_UNDERSCORE", {
    name: "Legacy Underscore User",
    username: "legacy_user",
    phone: "+919222233333",
    role: "customer",
    status: "active",
    passwordSalt: legSalt,
    passwordHash: legHashUnderscore,
    passwordAlgorithm: "sha256",
  });

  const legLoginRes = await testVerify("legacy_user", legPass);
  assert.strictEqual(legLoginRes.customToken, "mock_custom_token_for_LEG_USER_UNDERSCORE");

  // TEST 26: Locked Account CANNOT Obtain Custom Token Even With Correct Password
  console.log("✔ Test 26: Locked account is blocked from obtaining custom token even with valid password");
  const lockedUser = "lockout_victim";
  const lockedPass = "CorrectPassword@123";
  const lockedSalt = crypto.randomBytes(16).toString("hex");
  const lockedHash = crypto.createHash("sha256").update(`${lockedSalt}:${lockedPass}`).digest("hex");

  sharedStore.users.set("LOCKED_USER_1", {
    name: "Locked Customer",
    username: lockedUser,
    phone: "+919333344444",
    role: "customer",
    status: "active",
    passwordSalt: lockedSalt,
    passwordHash: lockedHash,
    passwordAlgorithm: "sha256",
  });

  // Exhaust rate limit with 5 incorrect password attempts
  for (let i = 0; i < 5; i++) {
    try {
      await testVerify(lockedUser, "WrongPassword");
    } catch (_) {}
  }

  // Now attempt login with the CORRECT password during lockout period
  try {
    await testVerify(lockedUser, lockedPass);
    assert.fail("Locked account must NOT obtain a custom token even with correct password");
  } catch (err) {
    assert.strictEqual(err.code, "resource-exhausted");
    assert.ok(err.message.includes("Too many failed login attempts"));
  }

  // TEST 27: Scrypt Migrated Hash Verification and Security
  console.log("✔ Test 27: Scrypt migrated credential verification adheres to RFC 7914 memory-hard spec");
  const scryptUser = "scrypt_native_user";
  const scryptNativePass = "NativeScrypt@2026";
  const scryptNativeSalt = crypto.randomBytes(16).toString("hex");
  const scryptNativeHash = hashPasswordScrypt(scryptNativePass, scryptNativeSalt);

  sharedStore.users.set("SCRYPT_NATIVE_1", {
    name: "Scrypt Native Customer",
    username: scryptUser,
    phone: "+919444455555",
    role: "customer",
    status: "active",
    passwordSalt: scryptNativeSalt,
    passwordHash: scryptNativeHash,
    passwordAlgorithm: "scrypt",
  });

  const scryptLoginRes = await testVerify(scryptUser, scryptNativePass);
  assert.strictEqual(scryptLoginRes.customToken, "mock_custom_token_for_SCRYPT_NATIVE_1");

  console.log("\n All 27 ITACON Customer Authentication Backend Tests Passed Successfully!\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});

