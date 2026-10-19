/**
 * Backend Unit & Security Policy Test Suite for ITACON Business Defaulters Engine
 * Tests functions/businessDefaultersEngine.js
 */

const assert = require('assert');
const {
  processDefaulterCheck,
  normalizeGst,
  normalizePhone,
  maskGst,
  maskPhone,
  checkProxyRateLimit,
  userLookupCache,
} = require('./businessDefaultersEngine');

// Mock in-memory Firestore
class MockFirestore {
  constructor(users = {}) {
    this.users = users;
  }

  collection(name) {
    assert.strictEqual(name, 'users', 'Only authoritative users collection must be queried');
    return {
      doc: (id) => ({
        get: async () => {
          const userData = this.users[id];
          return {
            id,
            exists: !!userData,
            data: () => userData,
          };
        },
      }),
    };
  }
}

// Mock HTTP client simulating external Partner API
function createMockHttpClient(mockBehavior) {
  return {
    post: async (url, data, config) => {
      if (typeof mockBehavior === 'function') {
        return mockBehavior(url, data, config);
      }
      return mockBehavior;
    },
  };
}

async function runTests() {
  console.log('Starting ITACON Business Defaulters Engine Backend Tests...\n');

  const validConfig = {
    apiUrl: 'https://api.businessdefaulters.com/api/external',
    apiKey: 'bd_live_test_key_1234567890abcdef1234567890abcdef',
  };

  const mockUsers = {
    salesperson_1: {
      userId: 'salesperson_1',
      role: 'salesperson',
      status: 'active',
    },
    manager_1: {
      userId: 'manager_1',
      role: 'manager',
      status: 'active',
    },
    admin_1: {
      userId: 'admin_1',
      role: 'admin',
      status: 'active',
    },
    customer_1: {
      userId: 'customer_1',
      role: 'customer',
      status: 'active',
    },
    customer_with_can_check_only: {
      userId: 'customer_with_can_check_only',
      role: 'customer',
      status: 'active',
      canCheckDefaulters: true,
    },
    customer_management_authorized: {
      userId: 'customer_management_authorized',
      role: 'customer',
      status: 'active',
      canCheckDefaulters: true,
      managementAuthorizedDefaulterAccess: true,
    },
    salesperson_blocked: {
      userId: 'salesperson_blocked',
      role: 'salesperson',
      status: 'blocked',
    },
    staff_inactive: {
      userId: 'staff_inactive',
      role: 'salesperson',
      status: 'inactive',
    },
    staff_missing_status: {
      userId: 'staff_missing_status',
      role: 'manager',
    },
    staff_suspended: {
      userId: 'staff_suspended',
      role: 'admin',
      status: 'suspended',
    },
  };

  const db = new MockFirestore(mockUsers);

  // --- Test 1: GST-only lookup ---
  {
    let capturedBody = null;
    let capturedHeaders = null;
    const client = createMockHttpClient((url, data, config) => {
      capturedBody = data;
      capturedHeaders = config.headers;
      return {
        status: 200,
        data: {
          success: true,
          exists: true,
          isDefaulter: false,
          riskLevel: 'CLEAN',
          matchedCount: 1,
          reportCount: { total: 0, verified: 0, pending: 0, closed: 0 },
          parties: [{ id: 'p1', companyName: 'Acme Tiles', gst: '24AAACG1234F1Z8' }],
        },
      };
    });

    const result = await processDefaulterCheck({
      data: { gst: '24aaacg1234f1z8' },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.riskLevel, 'CLEAN');
    assert.strictEqual(capturedBody.gst, '24AAACG1234F1Z8');
    assert.strictEqual(capturedBody.phone, undefined);
    assert.strictEqual(capturedHeaders['x-api-key'], validConfig.apiKey);
    console.log('✔ Test 1: GST-only lookup succeeds and normalizes input to uppercase');
  }

  // --- Test 2: Phone-only lookup ---
  {
    let capturedBody = null;
    const client = createMockHttpClient((url, data) => {
      capturedBody = data;
      return {
        status: 200,
        data: {
          success: true,
          exists: true,
          isDefaulter: true,
          riskLevel: 'HIGH',
          matchedCount: 1,
          reportCount: { total: 2, verified: 2, pending: 0, closed: 0 },
          parties: [{ id: 'p2', companyName: 'Shree Logistics', phone: '******2651' }],
        },
      };
    });

    const result = await processDefaulterCheck({
      data: { phone: '+91 99793 12651' },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isDefaulter, true);
    assert.strictEqual(result.riskLevel, 'HIGH');
    assert.strictEqual(capturedBody.phone, '9979312651');
    assert.strictEqual(capturedBody.gst, undefined);
    console.log('✔ Test 2: Phone-only lookup succeeds and normalizes +91 and spaces to 10 digits');
  }

  // --- Test 3: GST and phone simultaneous lookup ---
  {
    let capturedBody = null;
    const client = createMockHttpClient((url, data) => {
      capturedBody = data;
      return {
        status: 200,
        data: {
          success: true,
          exists: true,
          isDefaulter: false,
          riskLevel: 'CLEAN',
          matchedCount: 1,
          reportCount: { total: 0, verified: 0, pending: 0, closed: 0 },
          parties: [{ id: 'p3', companyName: 'Gujarat Granito', gst: '24AAACG1234F1Z8', phone: '******1265' }],
        },
      };
    });

    const result = await processDefaulterCheck({
      data: { gst: '24AAACG1234F1Z8', phone: '9979312651' },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(capturedBody.gst, '24AAACG1234F1Z8');
    assert.strictEqual(capturedBody.phone, '9979312651');
    assert.strictEqual(result.exists, true);
    console.log('✔ Test 3: GST and phone simultaneous lookup passes both parameters to external service');
  }

  // --- Test 4: Missing search parameters ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: {},
          callerUid: 'salesperson_1',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'invalid-argument');
        assert(err.message.includes('at least one search field'));
        return true;
      }
    );
    console.log('✔ Test 4: Missing search parameters rejected with invalid-argument');
  }

  // --- Test 5: Invalid GST format ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: 'SHORT123' },
          callerUid: 'salesperson_1',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'invalid-argument');
        assert(err.message.includes('15 alphanumeric characters'));
        return true;
      }
    );
    console.log('✔ Test 5: Invalid GSTIN length rejected with invalid-argument');
  }

  // --- Test 6: Invalid Phone format ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { phone: '12345' },
          callerUid: 'salesperson_1',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'invalid-argument');
        assert(err.message.includes('10-digit mobile number'));
        return true;
      }
    );
    console.log('✔ Test 6: Invalid Phone length rejected with invalid-argument');
  }

  // --- Test 7: HIGH result scenario ---
  {
    const client = createMockHttpClient({
      status: 200,
      data: {
        success: true,
        exists: true,
        isDefaulter: true,
        riskLevel: 'HIGH',
        matchedCount: 1,
        reportCount: { total: 3, verified: 2, pending: 1, closed: 0 },
        parties: [{ id: 'p_high', companyName: 'Defaulter Corp', gst: '27AABCS1429B1Z2' }],
      },
    });

    const result = await processDefaulterCheck({
      data: { gst: '27AABCS1429B1Z2' },
      callerUid: 'manager_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(result.riskLevel, 'HIGH');
    assert.strictEqual(result.isDefaulter, true);
    assert.strictEqual(result.reportCount.verified, 2);
    assert.strictEqual(result.reportCount.pending, 1);
    console.log('✔ Test 7: HIGH result correctly preserves verified and pending report tallies');
  }

  // --- Test 8: MEDIUM result scenario ---
  {
    const client = createMockHttpClient({
      status: 200,
      data: {
        success: true,
        exists: true,
        isDefaulter: true,
        riskLevel: 'MEDIUM',
        matchedCount: 1,
        reportCount: { total: 1, verified: 0, pending: 1, closed: 0 },
        parties: [{ id: 'p_med', companyName: 'Disputed Trader Ltd' }],
      },
    });

    const result = await processDefaulterCheck({
      data: { phone: '9820012345' },
      callerUid: 'admin_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(result.riskLevel, 'MEDIUM');
    assert.strictEqual(result.reportCount.verified, 0);
    assert.strictEqual(result.reportCount.pending, 1);
    console.log('✔ Test 8: MEDIUM result correctly processed with pending dispute under review');
  }

  // --- Test 9: LOW result scenario ---
  {
    const client = createMockHttpClient({
      status: 200,
      data: {
        success: true,
        exists: true,
        isDefaulter: false,
        riskLevel: 'LOW',
        matchedCount: 1,
        reportCount: { total: 1, verified: 0, pending: 0, closed: 1 },
        parties: [{ id: 'p_low', companyName: 'Settled Vendor LLP' }],
      },
    });

    const result = await processDefaulterCheck({
      data: { gst: '29AABCS8888D1Z1' },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(result.riskLevel, 'LOW');
    assert.strictEqual(result.isDefaulter, false);
    assert.strictEqual(result.reportCount.closed, 1);
    console.log('✔ Test 9: LOW result correctly processed with resolved disputes');
  }

  // --- Test 10: CLEAN result scenario ---
  {
    const client = createMockHttpClient({
      status: 200,
      data: {
        success: true,
        exists: true,
        isDefaulter: false,
        riskLevel: 'CLEAN',
        matchedCount: 1,
        reportCount: { total: 0, verified: 0, pending: 0, closed: 0 },
        parties: [{ id: 'p_clean', companyName: 'Apex Ceramics' }],
      },
    });

    const result = await processDefaulterCheck({
      data: { gst: '24AAACG1234F1Z8' },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(result.riskLevel, 'CLEAN');
    assert.strictEqual(result.isDefaulter, false);
    assert.strictEqual(result.exists, true);
    console.log('✔ Test 10: CLEAN result correctly indicates registered party with 0 negative reports');
  }

  // --- Test 11: SAFE (not found) scenario & mandatory cautionary disclaimer ---
  {
    const client = createMockHttpClient({
      status: 200,
      data: {
        success: true,
        exists: false,
        isDefaulter: false,
        riskLevel: 'SAFE',
        matchedCount: 0,
        reportCount: { total: 0, verified: 0, pending: 0, closed: 0 },
        message: 'No matching record found in the database.',
      },
    });

    const result = await processDefaulterCheck({
      data: { phone: '9999999999' },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(result.riskLevel, 'SAFE');
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.isDefaulter, false);
    assert(result.disclaimer.includes('SAFE indicates no negative records exist'));
    console.log('✔ Test 11: SAFE result includes mandatory cautionary disclaimer (not financial immunity)');
  }

  // --- Test 12: Multiple matching businesses ---
  {
    const client = createMockHttpClient({
      status: 200,
      data: {
        success: true,
        exists: true,
        isDefaulter: true,
        riskLevel: 'HIGH',
        matchedCount: 2,
        reportCount: { total: 4, verified: 3, pending: 1, closed: 0 },
        parties: [
          { id: 'p_1', companyName: 'Entity One', gst: '24AAACG1111A1Z1', city: 'Morbi' },
          { id: 'p_2', companyName: 'Entity Two', gst: '24AAACG2222B1Z2', city: 'Rajkot' },
        ],
      },
    });

    const result = await processDefaulterCheck({
      data: { phone: '9898012345' },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });

    assert.strictEqual(result.matchedCount, 2);
    assert.strictEqual(result.parties.length, 2);
    assert.strictEqual(result.parties[0].companyName, 'Entity One');
    assert.strictEqual(result.parties[1].companyName, 'Entity Two');
    console.log('✔ Test 12: Multiple matching businesses returned safely in array');
  }

  // --- Test 13: HTTP 401 Unauthorized from External API (invalid key) ---
  {
    const client = createMockHttpClient(() => {
      const err = new Error('Request failed with status code 401');
      err.response = { status: 401, data: { message: 'Invalid API key provided.' } };
      throw err;
    });

    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'salesperson_1',
          firestoreDb: db,
          httpClient: client,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'internal');
        // Critical: Must NOT leak API key
        assert(!err.message.includes('bd_live_'));
        return true;
      }
    );
    console.log('✔ Test 13: HTTP 401 from external service handled securely without leaking secret key');
  }

  // --- Test 14: HTTP 403 Forbidden from External API (deactivated key) ---
  {
    const client = createMockHttpClient(() => {
      const err = new Error('Request failed with status code 403');
      err.response = { status: 403, data: { message: 'This API key has been deactivated.' } };
      throw err;
    });

    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'salesperson_1',
          firestoreDb: db,
          httpClient: client,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'unavailable');
        return true;
      }
    );
    console.log('✔ Test 14: HTTP 403 from external service translated to unavailable');
  }

  // --- Test 15: HTTP 429 Too Many Requests (rate limit) ---
  {
    const client = createMockHttpClient(() => {
      const err = new Error('Request failed with status code 429');
      err.response = { status: 429, data: { message: 'Rate limit exceeded.' } };
      throw err;
    });

    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'salesperson_1',
          firestoreDb: db,
          httpClient: client,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'resource-exhausted');
        return true;
      }
    );
    console.log('✔ Test 15: HTTP 429 from external service translated to resource-exhausted');
  }

  // --- Test 16: HTTP 500 Internal Server Error ---
  {
    const client = createMockHttpClient(() => {
      const err = new Error('Request failed with status code 500');
      err.response = { status: 500, data: { message: 'Internal server error.' } };
      throw err;
    });

    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'salesperson_1',
          firestoreDb: db,
          httpClient: client,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'unavailable');
        return true;
      }
    );
    console.log('✔ Test 16: HTTP 500 server error handled safely');
  }

  // --- Test 17: Network Timeout (ECONNABORTED) ---
  {
    const client = createMockHttpClient(() => {
      const err = new Error('timeout of 10000ms exceeded');
      err.code = 'ECONNABORTED';
      throw err;
    });

    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'salesperson_1',
          firestoreDb: db,
          httpClient: client,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'deadline-exceeded');
        return true;
      }
    );
    console.log('✔ Test 17: Network timeout translated to deadline-exceeded');
  }

  // --- Test 18: Unauthenticated caller access strictly rejected ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: null,
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'unauthenticated');
        return true;
      }
    );
    console.log('✔ Test 18: Unauthenticated caller access strictly rejected');
  }

  // --- Test 19: Unauthorized customer role strictly rejected ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'customer_1',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'permission-denied');
        return true;
      }
    );
    console.log('✔ Test 19: Customer role without explicit permission strictly rejected');
  }

  // --- Test 20: Customer with canCheckDefaulters only strictly rejected without management authorization ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'customer_with_can_check_only',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'permission-denied');
        assert(err.message.includes('restricted to authorized sales and management staff'));
        return true;
      }
    );
    console.log('✔ Test 20: Customer with canCheckDefaulters alone is strictly rejected without explicit management authorization');
  }

  // --- Test 20b: Customer with explicit management authorization permitted ---
  {
    const client = createMockHttpClient({
      status: 200,
      data: { success: true, exists: false, isDefaulter: false, riskLevel: 'SAFE' },
    });

    const result = await processDefaulterCheck({
      data: { phone: '9898012345' },
      callerUid: 'customer_management_authorized',
      firestoreDb: db,
      httpClient: client,
      configOverride: validConfig,
    });
    assert.strictEqual(result.success, true);
    console.log('✔ Test 20b: Customer with explicit management-authorized override permitted');
  }

  // --- Test 21a: Blocked account rejected even if role is salesperson ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'salesperson_blocked',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'permission-denied');
        assert(err.message.includes('inactive, suspended, or unverified'));
        return true;
      }
    );
    console.log('✔ Test 21a: Blocked staff account rejected from querying defaulter database');
  }

  // --- Test 21b: Inactive staff account strictly rejected ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'staff_inactive',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'permission-denied');
        assert(err.message.includes('inactive, suspended, or unverified'));
        return true;
      }
    );
    console.log('✔ Test 21b: Inactive staff account rejected');
  }

  // --- Test 21c: Missing-status staff account strictly rejected ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'staff_missing_status',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'permission-denied');
        assert(err.message.includes('inactive, suspended, or unverified'));
        return true;
      }
    );
    console.log('✔ Test 21c: Missing-status staff account rejected');
  }

  // --- Test 21d: Suspended staff account strictly rejected ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'staff_suspended',
          firestoreDb: db,
          configOverride: validConfig,
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'permission-denied');
        assert(err.message.includes('inactive, suspended, or unverified'));
        return true;
      }
    );
    console.log('✔ Test 21d: Suspended staff account rejected');
  }

  // --- Test 22: Missing server configuration rejected with failed-precondition ---
  {
    await assert.rejects(
      async () => {
        await processDefaulterCheck({
          data: { gst: '24AAACG1234F1Z8' },
          callerUid: 'salesperson_1',
          firestoreDb: db,
          configOverride: { apiUrl: null, apiKey: null },
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'failed-precondition');
        assert(err.message.includes('Missing production API credentials'));
        return true;
      }
    );
    console.log('✔ Test 22: Missing server API configuration fails safely with failed-precondition');
  }

  // --- Test 23: Data privacy masking helper functions ---
  {
    assert.strictEqual(maskGst('24AAACG1234F1Z8'), '24AA****1Z8');
    assert.strictEqual(maskPhone('9979312651'), '******2651');
    assert.strictEqual(normalizeGst(' 24aaacg1234f1z8 '), '24AAACG1234F1Z8');
    assert.strictEqual(normalizePhone('+91 99793-12651'), '9979312651');
    console.log('✔ Test 23: Data privacy masking and normalization utilities verified');
  }

  // --- Test 24: Proxy rate limiting per UID ---
  {
    userLookupCache.clear();
    const testUid = 'user_rate_test';
    for (let i = 0; i < 30; i++) {
      const res = checkProxyRateLimit(testUid);
      assert.strictEqual(res.allowed, true);
    }
    const limitExceeded = checkProxyRateLimit(testUid);
    assert.strictEqual(limitExceeded.allowed, false);
    assert(limitExceeded.retryAfterSec > 0);
    console.log('✔ Test 24: Proxy rate limiting enforces maximum 30 requests per window');
  }

  // --- Test 25: Provider-supplied sample inputs (GSTIN: 27AAPCA1234A1Z5, Phone: 9876543210) ---
  {
    let capturedUrl = null;
    let capturedBody = null;
    let capturedHeaders = null;

    const client = createMockHttpClient((url, data, config) => {
      capturedUrl = url;
      capturedBody = data;
      capturedHeaders = config.headers;
      return {
        status: 200,
        data: {
          success: true,
          exists: true,
          isDefaulter: false,
          riskLevel: 'CLEAN',
          matchedCount: 1,
          reportCount: { total: 0, verified: 0, pending: 0, closed: 0 },
          parties: [{ id: 'p_sample', companyName: 'Sample Provider Tiles', gst: '27AAPCA1234A1Z5', phone: '9876543210' }],
        },
      };
    });

    const result = await processDefaulterCheck({
      data: {
        gst: '27AAPCA1234A1Z5',
        phone: '9876543210',
      },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: {
        apiUrl: 'https://api.businessdefaulters.com/api/external',
        apiKey: 'bd_sample_test_key_abc123',
      },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(capturedUrl, 'https://api.businessdefaulters.com/api/external/check-defaulter');
    assert.strictEqual(capturedBody.gst, '27AAPCA1234A1Z5');
    assert.strictEqual(capturedBody.phone, '9876543210');
    assert.strictEqual(capturedHeaders['Content-Type'], 'application/json');
    assert.strictEqual(capturedHeaders['x-api-key'], 'bd_sample_test_key_abc123');
    console.log('✔ Test 25: Provider sample inputs dispatched via POST with JSON body and x-api-key header');
  }

  // --- Test 26: Endpoint URL resolution prevents duplicate /check-defaulter suffixes ---
  {
    let capturedUrlWithFullEndpoint = null;
    const client = createMockHttpClient((url) => {
      capturedUrlWithFullEndpoint = url;
      return {
        status: 200,
        data: { success: true, exists: false, isDefaulter: false, riskLevel: 'SAFE' },
      };
    });

    await processDefaulterCheck({
      data: { phone: '9876543210' },
      callerUid: 'salesperson_1',
      firestoreDb: db,
      httpClient: client,
      configOverride: {
        apiUrl: 'https://api.businessdefaulters.com/api/external/check-defaulter',
        apiKey: 'bd_sample_test_key_abc123',
      },
    });

    assert.strictEqual(capturedUrlWithFullEndpoint, 'https://api.businessdefaulters.com/api/external/check-defaulter');
    console.log('✔ Test 26: Endpoint resolution normalizes base URL and full endpoint without duplication');
  }

  console.log('\n======================================================');
  console.log('ALL 30 BUSINESS DEFAULTERS BACKEND TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
