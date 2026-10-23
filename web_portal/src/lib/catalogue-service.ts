import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

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
 * Tiles exactly as the mobile app lists them: active docs from `products`
 * (falling back to `tiles`), with fixing solutions (adhesives) excluded.
 */
export async function fetchAppTiles(): Promise<any[]> {
  let snap = await getDocs(query(collection(db, "products"), where("isActive", "==", true)));
  if (snap.empty) {
    snap = await getDocs(query(collection(db, "tiles"), where("isActive", "==", true)));
  }
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !isAdhesiveProduct(p));
}
