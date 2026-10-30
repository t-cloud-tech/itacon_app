import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc, query, where } from "firebase/firestore";
import { generateSaltHex, hashStaffPassword, normalizePhone, generateDesignerEmployeeId } from "@/lib/salesperson-service";

export interface DesignerRecord {
  designerId: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  tilesAdded: number;
  lastTileAt?: string;
  createdAt?: string;
}

export interface DesignerTile {
  id: string;
  name: string;
  sku: string;
  tileCategory?: string;
  size?: string;
  createdAt?: string;
}

export interface NewDesignerInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  /** Optional: auto-generated as "DD IGPL-001" when blank. */
  employeeId?: string;
}

const toIso = (v: any): string | undefined => {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (v.seconds) return new Date(v.seconds * 1000).toISOString();
  if (v instanceof Date) return v.toISOString();
  return undefined;
};

/** Tiles (not fixing solutions) published by one designer, newest first. */
export async function fetchDesignerTiles(designerId: string): Promise<DesignerTile[]> {
  const snap = await getDocs(query(collection(db, "products"), where("createdByUid", "==", designerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((p) => p.productLine !== "adhesives")
    .map((p) => ({
      id: p.id,
      name: p.name || "Untitled tile",
      sku: p.sku || "",
      tileCategory: p.tileCategory,
      size: p.size,
      createdAt: toIso(p.createdAt),
    }))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function fetchDesigners(): Promise<DesignerRecord[]> {
  const snap = await getDocs(collection(db, "Designer"));
  const designers = await Promise.all(
    snap.docs.map(async (d) => {
      const data: any = d.data();
      let tiles: DesignerTile[] = [];
      try {
        tiles = await fetchDesignerTiles(data.userId || d.id);
      } catch (e) {
        console.warn("Could not count tiles for designer", d.id, e);
      }
      return {
        designerId: d.id,
        employeeId: data.employeeId || "",
        name: data.name || data.fullName || "Unnamed designer",
        email: data.email || "",
        phone: data.phone || data.phoneNumber || "",
        status: data.status === "inactive" ? "inactive" : "active",
        tilesAdded: tiles.length,
        lastTileAt: tiles[0]?.createdAt,
        createdAt: toIso(data.createdAt),
      } as DesignerRecord;
    })
  );
  return designers.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Creates a designer login the same way createSalespersonAccount does: a Firebase Auth user,
 * an authoritative users/{uid} doc (role "designer" + salted hash read by staffAuthEngine)
 * and a Designer/{uid} profile doc.
 */
export async function createDesignerAccount(
  input: NewDesignerInput
): Promise<{ success: boolean; uid: string; employeeId?: string; error?: string }> {
  try {
    const email = input.email.trim().toLowerCase();
    const phone = normalizePhone(input.phone);
    const name = input.name.trim();
    const employeeId = (input.employeeId || "").trim().toUpperCase() || (await generateDesignerEmployeeId());

    if (!name) throw new Error("Please enter the designer's full name.");
    if (!email || !email.includes("@")) throw new Error("Please enter a valid email address.");
    if (!phone || phone.length < 10) throw new Error("Please enter a valid phone number (10 digits).");
    if (!input.password || input.password.length < 6) throw new Error("Password must be at least 6 characters long.");

    const salt = generateSaltHex(16);
    const passwordHash = await hashStaffPassword(input.password, salt);

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ";
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: input.password, returnSecureToken: true }),
    });
    const data = await res.json();

    let uid = "";
    if (data.error) {
      if (!data.error.message?.includes("EMAIL_EXISTS")) {
        throw new Error(data.error.message || "Failed to create Firebase Auth user.");
      }
      // Email already registered: only reuse it if it is an existing designer user doc
      const existing = await getDocs(query(collection(db, "users"), where("email", "==", email)));
      const match = existing.docs.find((d) => !d.data().role || d.data().role === "designer");
      if (!match) throw new Error("This email is already registered to another account. Use a different email.");
      uid = match.id;
    } else {
      uid = data.localId;
    }

    const nowIso = new Date().toISOString();

    await setDoc(
      doc(db, "users", uid),
      {
        userId: uid,
        uid,
        name,
        fullName: name,
        email,
        phone,
        phoneNumber: phone,
        role: "designer",
        userCategory: "designer",
        designerId: uid,
        employeeId,
        status: "active",
        isActive: true,
        passwordHash,
        passwordSalt: salt,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    await setDoc(
      doc(db, "Designer", uid),
      {
        designerId: uid,
        userId: uid,
        employeeId,
        name,
        email,
        phone,
        designation: "Tile Designer",
        specializations: [],
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return { success: true, uid, employeeId };
  } catch (err: any) {
    console.error("createDesignerAccount error:", err);
    return { success: false, uid: "", error: err.message || "Failed to create designer." };
  }
}

export async function resetDesignerPassword(
  designerId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters long.");
    const salt = generateSaltHex(16);
    const passwordHash = await hashStaffPassword(newPassword, salt);
    await updateDoc(doc(db, "users", designerId), {
      passwordHash,
      passwordSalt: salt,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: any) {
    console.error("resetDesignerPassword error:", err);
    return { success: false, error: err.message || "Failed to update password." };
  }
}

export async function toggleDesignerStatus(designerId: string, status: "active" | "inactive"): Promise<boolean> {
  const patch = { status, isActive: status === "active", updatedAt: new Date().toISOString() };
  try {
    await updateDoc(doc(db, "Designer", designerId), patch);
    await updateDoc(doc(db, "users", designerId), patch);
    return true;
  } catch (err) {
    console.error("toggleDesignerStatus error:", err);
    return false;
  }
}
