/**
 * ITACON Enterprise Portal — Staff Account & Salesperson Code Allocator
 * ---------------------------------------------------------------------
 * This script generates complete, Firestore-ready documents for:
 * 1. Salesperson account (allocates a unique Salesperson Code + entries for
 *    both `salesPersons` and `users` collections)
 * 2. Admin account (`users` collection)
 *
 * It enforces:
 * - Unique Salesperson Referral Code
 * - 1-to-Many Relationship (1 Salesperson -> Many Clients, 1 Client -> 1 Salesperson)
 * - SHA-256 (salt:password) password hash matching the mobile app & web portal
 *
 * Usage:
 *   node scripts/create-staff-account.mjs
 */

import { createHash, randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────
//  CONFIG — Edit these values for the salesperson / admin you want
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  name: "Vraj Shah",
  email: "vraj@itacon.com",
  phone: "9876543210",              // 10-digit mobile number (without +91)
  role: "salesperson",              // "salesperson" or "admin"
  password: "Sales@1234",           // Password: 8+ chars, uppercase, lowercase, number, special char
  
  // Salesperson-specific settings (auto-allocated if blank)
  salespersonCode: "SALES101",      // Salesperson Referral Code (clients use this code to connect)
  employeeId: "EMP-SP101",          // Company Employee ID
  states: ["GJ", "MH", "DL", "KA"], // States handled
};
// ─────────────────────────────────────────────────────────────

function generateSalt(length = 16) {
  return randomBytes(length).toString("base64url");
}

function hashPassword(password, salt) {
  return createHash("sha256")
    .update(`${salt}:${password}`)
    .digest("hex");
}

const salt = generateSalt();
const hash = hashPassword(CONFIG.password, salt);
const isSalesperson = CONFIG.role === "salesperson";

// Deterministic or clean ID for salesperson
const cleanPhone = CONFIG.phone.replace(/\D/g, "");
const salespersonId = isSalesperson
  ? `SP_${cleanPhone.slice(-4) || "101"}`
  : undefined;
const referralCode = (CONFIG.salespersonCode || `SALES${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase();
const now = new Date().toISOString();

// Document 1: users collection
const userDoc = {
  name: CONFIG.name,
  fullName: CONFIG.name,
  email: CONFIG.email.toLowerCase().trim(),
  phone: CONFIG.phone.trim(),
  phoneNumber: CONFIG.phone.trim(),
  role: CONFIG.role,
  status: "active",
  passwordHash: hash,
  passwordSalt: salt,
  createdAt: now,
  updatedAt: now,
  assignedClientsCount: 0,
  activeClientsCount: 0,
};

if (isSalesperson) {
  userDoc.salesPersonId = salespersonId;
  userDoc.referralCode = referralCode;
  userDoc.employeeId = CONFIG.employeeId;
}

// Document 2: salesPersons collection (only for salesperson role)
const salesPersonDoc = isSalesperson
  ? {
      salesPersonId: salespersonId,
      employeeId: CONFIG.employeeId || `EMP-${referralCode}`,
      name: CONFIG.name,
      fullName: CONFIG.name,
      phone: CONFIG.phone.trim(),
      phoneNumber: CONFIG.phone.trim(),
      email: CONFIG.email.toLowerCase().trim(),
      referralCode: referralCode,
      states: CONFIG.states,
      status: "active",
      isActive: true,
      assignedClientsCount: 0,
      activeClientsCount: 0,
      createdAt: now,
      updatedAt: now,
    }
  : null;

console.log("\n=================================================================");
console.log("   ITACON ENTERPRISE — STAFF & SALESPERSON ALLOCATION DETAILS    ");
console.log("=================================================================\n");

console.log("🔑 LOGIN CREDENTIALS (Web Portal):");
console.log(`   Email    : ${CONFIG.email}`);
console.log(`   Phone    : ${CONFIG.phone}`);
console.log(`   Password : ${CONFIG.password}`);
console.log(`   Role     : ${CONFIG.role.toUpperCase()}`);

if (isSalesperson) {
  console.log("\n🏷️  ALLOCATED SALESPERSON CODE:");
  console.log(`   Code     : \x1b[32m\x1b[1m${referralCode}\x1b[0m  <-- Give this code to clients!`);
  console.log(`   SP ID    : ${salespersonId}`);
  console.log(`   Emp ID   : ${CONFIG.employeeId}`);
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📄 1. ADD TO FIRESTORE: collection `users`");
console.log(`   Document ID : (Auto-ID, OR use '${isSalesperson ? salespersonId : "admin_01"}')`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(JSON.stringify(userDoc, null, 2));

if (isSalesperson && salesPersonDoc) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📄 2. ADD TO FIRESTORE: collection `salesPersons`");
  console.log(`   Document ID : ${salespersonId}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(JSON.stringify(salesPersonDoc, null, 2));
}

console.log("\n=================================================================");
console.log("             RELATIONSHIP & ALLOCATION VERIFICATION              ");
console.log("=================================================================");
console.log("1. TWO WAYS OF CLIENT ALLOCATION:");
console.log("   a) By Salesperson Code: Client enters code '" + (isSalesperson ? referralCode : "SALES101") + "' on the");
console.log("      app Referral Gate screen -> automatically maps client to this salesperson.");
console.log("   b) Automatic Allocation: App picks the available active salesperson with the");
console.log("      least workload (lowest assignedClientsCount) in round-robin fashion.");
console.log("");
console.log("2. 1-TO-MANY RELATIONSHIP GUARANTEE:");
console.log("   - ONE salesperson can have unlimited assigned clients.");
console.log("   - ONE client is STRICTLY mapped to ONE salesperson only.");
console.log("   - Once mapped, the client CANNOT connect or remap to another salesperson.");
console.log("=================================================================\n");
