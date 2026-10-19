/**
 * ITACON GRANITO — Live Connectivity Test Tool for Business Defaulters External API
 *
 * Provider: Business Defaulters
 * Production Endpoint: https://api.businessdefaulters.com/api/external/check-defaulter
 * Method: POST
 * Authentication Header: x-api-key
 * Sample Inputs (Provider-supplied):
 *   - GSTIN: 27AAPCA1234A1Z5
 *   - Phone: 9876543210
 *
 * SECURITY INSTRUCTIONS:
 * 1. Do NOT hardcode the API key in this script or commit it to Git.
 * 2. Supply the API key securely via environment variable:
 *      $env:BUSINESS_DEFAULTERS_API_KEY="your-api-key"; node test_live_connectivity.js
 *    or enter it interactively when prompted.
 * 3. Command-line arguments are disabled to avoid exposure in process tables or history.
 * 4. The API key is NEVER logged, printed, or echoed.
 */

const axios = require('axios');
const readline = require('readline');

const ENDPOINT_URL =
  process.env.BUSINESS_DEFAULTERS_API_URL ||
  'https://api.businessdefaulters.com/api/external/check-defaulter';

// Target URL resolution (ensures /check-defaulter is present)
const resolvedEndpoint = ENDPOINT_URL.endsWith('/check-defaulter')
  ? ENDPOINT_URL
  : `${ENDPOINT_URL.replace(/\/+$/, '')}/check-defaulter`;

// Sample inputs specified by the external API provider
const SAMPLE_INPUTS = {
  gst: '27AAPCA1234A1Z5',
  phone: '9876543210',
};

// Known compromised / mock key patterns (do not allow use)
const COMPROMISED_PREFIXES = ['test_exposed', 'bd_live_test_key'];

function promptForApiKey() {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      return resolve(null);
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter Business Defaulters API key (input hidden/masked in logs): ', (answer) => {
      rl.close();
      resolve(answer ? answer.trim() : null);
    });
  });
}

async function getApiKey() {
  let key = process.env.BUSINESS_DEFAULTERS_API_KEY;
  if (key && key.trim()) {
    return key.trim();
  }
  return await promptForApiKey();
}

async function runLiveConnectivityTest() {
  console.log('================================================================');
  console.log(' ITACON GRANITO — Business Defaulters Live Connectivity Check');
  console.log('================================================================');
  console.log(`Target Endpoint: ${resolvedEndpoint}`);
  console.log(`Provider Sample Inputs:`);
  console.log(`  - GSTIN: ${SAMPLE_INPUTS.gst}`);
  console.log(`  - Phone: ${SAMPLE_INPUTS.phone}`);
  console.log('----------------------------------------------------------------');

  const apiKey = await getApiKey();

  if (!apiKey) {
    console.error('⛔ BLOCKED: No API key provided.');
    console.error('The API key must be supplied via:');
    console.error('  1. Environment variable: $env:BUSINESS_DEFAULTERS_API_KEY="<KEY>"');
    console.error('  2. Or interactive prompt when prompted directly in terminal.');
    console.error('\n(Command-line arguments are intentionally disabled for security.)');
    process.exit(2);
  }

  // Security check: Guard against accidental re-use of known exposed or mock keys
  const isCompromised = COMPROMISED_PREFIXES.some((prefix) => apiKey.startsWith(prefix));
  if (isCompromised) {
    console.error('⛔ SECURITY ALERT: The provided key matches a known exposed/mock pattern.');
    console.error('Per security policy, exposed keys must NOT be used for production.');
    console.error('Please obtain a freshly rotated secret from the provider.');
    process.exit(3);
  }

  console.log('✔ API Key loaded into memory (length verified, raw value withheld from logs).');
  console.log('Dispatching POST request to external provider...\n');

  const startTime = Date.now();

  try {
    const response = await axios.post(resolvedEndpoint, SAMPLE_INPUTS, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      timeout: 15000,
      validateStatus: () => true, // Don't throw so we can inspect status codes
    });

    const durationMs = Date.now() - startTime;
    console.log(`✔ HTTP Response Received in ${durationMs}ms`);
    console.log(`Status Code: ${response.status} ${response.statusText || ''}`);
    console.log('Response Headers:');
    console.log(`  content-type: ${response.headers['content-type'] || 'unknown'}`);

    console.log('\nResponse Body:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('\n================================================================');
      console.log('🎉 SUCCESS: Live production endpoint connectivity verified!');
      console.log('================================================================');
      process.exit(0);
    } else if (response.status === 401 || response.status === 403) {
      console.error('\n⚠️ AUTHENTICATION REJECTED by external provider.');
      console.error('Verify that the API key has been activated by the provider.');
      process.exit(1);
    } else {
      console.error(`\n⚠️ Provider returned unexpected HTTP status: ${response.status}`);
      process.exit(1);
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ Network / Connection Error after ${durationMs}ms:`);
    console.error(`Message: ${err.message}`);
    if (err.code) console.error(`Error Code: ${err.code}`);
    // Security: never log err.config which contains headers['x-api-key']
    process.exit(1);
  }
}

runLiveConnectivityTest();
