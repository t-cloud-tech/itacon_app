/**
 * ITACON Enterprise — Automated Firestore Seeder for Staff & Salesperson
 * ---------------------------------------------------------------------
 * Automatically writes the Salesperson or Admin document directly
 * into Firestore (`users` and `salesPersons` collections) using Firebase SDK.
 *
 * Usage:
 *   node scripts/seed-staff-direct.mjs
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { createHash, randomBytes } from "crypto";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "itacon-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "itacon-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "itacon-app.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "889001862943",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:889001862943:web:7c9c09c666f0d4cf55f22a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─────────────────────────────────────────────
// CONFIGURATION: Adjust as needed
// ─────────────────────────────────────────────
const CONFIG = {
  name: "Vraj Shah",
  email: "vraj@itacon.com",
  phone: "9876543210",
  role: "salesperson", // "salesperson" or "admin"
  password: "Sales@1234",
  salespersonCode: "SALES101",
  employeeId: "EMP-SP101",
  states: ["GJ", "MH", "DL", "KA"],
};
// ─────────────────────────────────────────────

function generateSalt(length = 16) {
  return randomBytes(length).toString("base64url");
}

function hashPassword(password, salt) {
  return createHash("sha256")
    .update(`${salt}:${password}`)
    .digest("hex");
}

async function main() {
  console.log("Connecting to Firestore...");
  const salt = generateSalt();
  const hash = hashPassword(CONFIG.password, salt);
  const now = new Date().toISOString();
  const isSalesperson = CONFIG.role === "salesperson";
  const cleanPhone = CONFIG.phone.replace(/\D/g, "");
  const spId = isSalesperson ? `SP_${cleanPhone.slice(-4) || "101"}` : undefined;
  const referralCode = (CONFIG.salespersonCode || `SALES${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase();

  // 1. users collection doc
  const userDocId = spId || "admin_01";
  const userPayload = {
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
    userPayload.salesPersonId = spId;
    userPayload.referralCode = referralCode;
    userPayload.employeeId = CONFIG.employeeId;
  }

  await setDoc(doc(db, "users", userDocId), userPayload, { merge: true });
  console.log(`✅ Saved users/${userDocId}`);

  // 2. salesPersons collection doc
  if (isSalesperson && spId) {
    const spPayload = {
      salesPersonId: spId,
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
    };
    await setDoc(doc(db, "salesPersons", spId), spPayload, { merge: true });
    console.log(`✅ Saved salesPersons/${spId}`);
  }

  console.log("\n🎉 Salesperson created & allocated successfully in Firestore!");
  console.log(`   Email            : ${CONFIG.email}`);
  console.log(`   Password         : ${CONFIG.password}`);
  console.log(`   Salesperson Code : ${referralCode}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error creating staff account:", err);
  process.exit(1);
});
