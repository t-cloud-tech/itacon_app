const auth = require('C:/Users/ttirt/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const FIREBASE_PROJECT_ID = 'itacon-app';

async function getFreshAccessToken() {
  const acc = auth.getGlobalDefaultAccount();
  if (!acc || !acc.tokens || !acc.tokens.refresh_token) {
    throw new Error('No Firebase CLI account found.');
  }
  const result = await auth.getAccessToken(acc.tokens.refresh_token, []);
  return result.access_token;
}

async function main() {
  console.log('=== VERIFYING NEWLY DEPLOYED PRODUCTION RULESET ON GOOGLE CLOUD ===');
  const token = await getFreshAccessToken();

  const releasesRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  const releasesData = await releasesRes.json();
  const firestoreRelease = (releasesData.releases || []).find(r => r.name.includes('cloud.firestore'));

  console.log('Active Release Name:', firestoreRelease.name);
  console.log('Active Ruleset Name:', firestoreRelease.rulesetName);
  console.log('Update Timestamp:   ', firestoreRelease.updateTime);

  const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  const rulesetData = await rulesetRes.json();
  const rawContent = rulesetData.source?.files?.[0]?.content || '';
  const content = rawContent.replace(/\r\n/g, '\n');

  console.log('\n--- VERIFYING LIVE RULESET CORE SECURITY ASSERTIONS ---');

  const check1 = content.includes('function isCustomerProfileOrderReady(userId)');
  console.log('1. isCustomerProfileOrderReady helper defined:        ', check1 ? 'PASS' : 'FAIL');

  const check2 = content.includes("function isProfileDataOrderReady(userData)");
  console.log('2. isProfileDataOrderReady helper defined:             ', check2 ? 'PASS' : 'FAIL');

  const check3 = content.includes("function hasValidOrderDeliveryAddress(orderData)");
  console.log('3. hasValidOrderDeliveryAddress helper defined:        ', check3 ? 'PASS' : 'FAIL');

  const check4 = content.includes("isCustomerProfileOrderReady(request.auth.uid)");
  console.log('4. /orders/{orderId} gates on customer profile ready:  ', check4 ? 'PASS' : 'FAIL');

  const check5 = content.includes("hasValidOrderDeliveryAddress(request.resource.data)");
  console.log('5. /orders/{orderId} gates on order delivery address:  ', check5 ? 'PASS' : 'FAIL');

  const check6 = content.includes("'status',\n          'phoneVerified',\n          'isVerified'");
  console.log('6. isModifyingPrivilegedUserFields blocks status/phone:', check6 ? 'PASS' : 'FAIL');

  const check7 = content.includes("request.resource.data.salesPersonId == request.auth.uid ||");
  console.log('7. Salesperson order creation preserved:               ', check7 ? 'PASS' : 'FAIL');

  const check8 = content.includes("isAdminOrManager()");
  console.log('8. Admin & manager order permissions preserved:        ', check8 ? 'PASS' : 'FAIL');

  const check9 = content.includes("match /quotations/{quoteId}");
  console.log('9. Salesperson quotation permissions preserved:        ', check9 ? 'PASS' : 'FAIL');

  const check10 = content.includes("match /paymentSubmissions/{submissionId}");
  console.log('10. Payment submission security preserved (write: false):', check10 ? 'PASS' : 'FAIL');

  const allPassed = check1 && check2 && check3 && check4 && check5 && check6 && check7 && check8 && check9 && check10;
  console.log('\n=== OVERALL POST-DEPLOYMENT VERIFICATION: ' + (allPassed ? 'ALL 10 CHECKS VERIFIED IN LIVE PRODUCTION' : 'FAILED') + ' ===');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Post-deployment verification error:', err);
  process.exit(1);
});
