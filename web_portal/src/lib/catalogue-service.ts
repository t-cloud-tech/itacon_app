import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export * from "./surface-finishes";

// Mirrors the mobile app's TileProduct.isAdhesive
export function isAdhesiveProduct(p: any): boolean {
  return (
    p?.productLine === "adhesives" ||
    p?.unit === "bag" ||
    p?.categoryId === "CAT_ADHESIVES" ||
    String(p?.sku || "").startsWith("ITA-LX")
  );
}

/**
 * Tiles for the portal & mobile app:
 * If includeInactive is true (used by Designer Studio), loads all products/tiles
 * regardless of isActive status so designers can view & reactivate them.
 * If includeInactive is false (default), queries only active tiles.
 */
export async function fetchAppTiles(includeInactive: boolean = false): Promise<any[]> {
  let snap;
  if (includeInactive) {
    snap = await getDocs(collection(db, "products"));
    if (snap.empty) {
      snap = await getDocs(collection(db, "tiles"));
    }
  } else {
    snap = await getDocs(query(collection(db, "products"), where("isActive", "==", true)));
    if (snap.empty) {
      snap = await getDocs(query(collection(db, "tiles"), where("isActive", "==", true)));
    }
  }
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      isActive: d.data().isActive !== false,
    }))
    .filter((p) => !isAdhesiveProduct(p));
}


