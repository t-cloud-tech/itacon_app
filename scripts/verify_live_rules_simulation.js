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
  console.log('=== VERIFYING LIVE RULES ON FIREBASE ===');
  const token = await getFreshAccessToken();

  const releasesRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/releases`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  const releasesData = await releasesRes.json();
  const firestoreRelease = (releasesData.releases || []).find(r => r.name.includes('cloud.firestore'));

  console.log('Live Active Release:', firestoreRelease.name);
  console.log('Live Active Ruleset:', firestoreRelease.rulesetName);
  console.log('Live Update Time:', firestoreRelease.updateTime);

  const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  const rulesetData = await rulesetRes.json();
  // Normalize CRLF to LF
  const rawContent = rulesetData.source?.files?.[0]?.content || '';
  const content = rawContent.replace(/\r\n/g, '\n');

  console.log('\n--- VERIFYING LIVE RULESET CONTENT PATTERNS ---');
  const hasTraderCategory = content.includes("cat in ['dealer', 'architect', 'builder', 'wholesaler', 'retailer', 'trader']");
  console.log('1. Trader in isValidCustomerCategory():', hasTraderCategory ? 'CONFIRMED' : 'MISSING');

  const hasTraderMatch = content.includes('match /traders/{userId}');
  console.log('2. traders/{userId} collection match:', hasTraderMatch ? 'CONFIRMED' : 'MISSING');

  const hasSeparatedDealers = content.includes('match /dealers/{userId} {\n      allow read: if isAuthenticated() && (isOwner(userId) || isStaff());\n      allow write: if isAuthenticated() && (isOwner(userId) || isStaff()) && !hasSensitiveFields(request.resource.data);\n    }');
  console.log('3. dealers/{userId} separated read/write:', hasSeparatedDealers ? 'CONFIRMED' : 'MISSING');

  const hasSeparatedArchitects = content.includes('match /architects/{userId} {\n      allow read: if isAuthenticated() && (isOwner(userId) || isStaff());\n      allow write: if isAuthenticated() && (isOwner(userId) || isStaff()) && !hasSensitiveFields(request.resource.data);\n    }');
  console.log('4. architects/{userId} separated read/write:', hasSeparatedArchitects ? 'CONFIRMED' : 'MISSING');

  const hasSeparatedBuilders = content.includes('match /builders/{userId} {\n      allow read: if isAuthenticated() && (isOwner(userId) || isStaff());\n      allow write: if isAuthenticated() && (isOwner(userId) || isStaff()) && !hasSensitiveFields(request.resource.data);\n    }');
  console.log('5. builders/{userId} separated read/write:', hasSeparatedBuilders ? 'CONFIRMED' : 'MISSING');

  const hasSeparatedWholesalers = content.includes('match /wholesalers/{userId} {\n      allow read: if isAuthenticated() && (isOwner(userId) || isStaff());\n      allow write: if isAuthenticated() && (isOwner(userId) || isStaff()) && !hasSensitiveFields(request.resource.data);\n    }');
  console.log('6. wholesalers/{userId} separated read/write:', hasSeparatedWholesalers ? 'CONFIRMED' : 'MISSING');

  const hasSeparatedRetailers = content.includes('match /retailers/{userId} {\n      allow read: if isAuthenticated() && (isOwner(userId) || isStaff());\n      allow write: if isAuthenticated() && (isOwner(userId) || isStaff()) && !hasSensitiveFields(request.resource.data);\n    }');
  console.log('7. retailers/{userId} separated read/write:', hasSeparatedRetailers ? 'CONFIRMED' : 'MISSING');

  const hasSeparatedTraders = content.includes('match /traders/{userId} {\n      allow read: if isAuthenticated() && (isOwner(userId) || isStaff());\n      allow write: if isAuthenticated() && (isOwner(userId) || isStaff()) && !hasSensitiveFields(request.resource.data);\n    }');
  console.log('8. traders/{userId} separated read/write:', hasSeparatedTraders ? 'CONFIRMED' : 'MISSING');

  const hasSalespersonLocked = content.includes('match /salesPersons/{spId} {\n      allow read: if isAuthenticated();\n      allow write: if isStaff() && !hasSensitiveFields(request.resource.data);');
  console.log('9. salesPersons/{spId} write restricted to isStaff():', hasSalespersonLocked ? 'CONFIRMED' : 'MISSING');

  const hasSalespersonAssignedClients = content.includes('match /assigned_clients/{clientId} {\n        allow read: if isStaff() || (isAuthenticated() && clientId == request.auth.uid);\n        allow write: if isStaff() || (isAuthenticated() && clientId == request.auth.uid);\n      }');
  console.log('10. assigned_clients/{clientId} customer self-association:', hasSalespersonAssignedClients ? 'CONFIRMED' : 'MISSING');

  const hasPrivilegeEscalationGuard = content.includes("(!('userCategory' in request.resource.data) || !(request.resource.data.userCategory in ['admin', 'manager', 'salesperson', 'staff']))");
  console.log('11. userCategory privilege escalation guard:', hasPrivilegeEscalationGuard ? 'CONFIRMED' : 'MISSING');

  const allPassed = hasTraderCategory && hasTraderMatch && hasSeparatedDealers && hasSeparatedArchitects &&
    hasSeparatedBuilders && hasSeparatedWholesalers && hasSeparatedRetailers && hasSeparatedTraders &&
    hasSalespersonLocked && hasSalespersonAssignedClients && hasPrivilegeEscalationGuard;

  console.log('\nAll structural assertions against live deployed source: ' + (allPassed ? 'ALL 11 CHECKS PASSED' : 'CHECK FAILED'));
}

main().catch(console.error);
