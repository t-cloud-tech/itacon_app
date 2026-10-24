/**
 * Master shared list of 7 Surface Finishes.
 * Used identically across Add New Tile forms and Catalogue filter dropdowns.
 */
export const SURFACE_FINISHES = [
  "High Gloss Polish",
  "Satin Matt",
  "Carving Matt",
  "Wood Embossed",
  "Sugar Finish",
  "Rustic Matt",
  "Glossy Ceramic",
] as const;

export type SurfaceFinish = (typeof SURFACE_FINISHES)[number];

/**
 * Normalizes any historical, abbreviated or variant surface string to one of the 7 standard SurfaceFinish options.
 * Handles aliases case-insensitively and inspects tile product/body type for ceramic vs vitrified/porcelain.
 */
export function normalizeSurfaceFinish(
  rawSurface: string | undefined | null,
  product?: { productType?: string; bodyType?: string; categoryId?: string; tileCategory?: string }
): SurfaceFinish | string {
  if (!rawSurface) return "";
  const s = rawSurface.trim().toLowerCase();

  // Exact / direct match (case-insensitive) to one of the 7 standard options
  if (s === "high gloss polish") return "High Gloss Polish";
  if (s === "satin matt") return "Satin Matt";
  if (s === "carving matt") return "Carving Matt";
  if (s === "wood embossed") return "Wood Embossed";
  if (s === "sugar finish") return "Sugar Finish";
  if (s === "rustic matt") return "Rustic Matt";
  if (s === "glossy ceramic") return "Glossy Ceramic";

  // Check if tile is ceramic
  const pType = (product?.productType || "").toLowerCase();
  const bType = (product?.bodyType || "").toLowerCase();
  const cat = (product?.tileCategory || "").toLowerCase();
  const isCeramic = pType.includes("ceramic") || bType.includes("ceramic") || cat.includes("ceramic");

  // Aliases for Glossy / High Gloss
  if (
    s === "glossy" ||
    s === "high gloss" ||
    s === "glo" ||
    s === "glossy / high gloss" ||
    s === "gloss" ||
    s.startsWith("gloss")
  ) {
    return isCeramic ? "Glossy Ceramic" : "High Gloss Polish";
  }

  // Aliases for Carving
  if (s === "carving" || s.startsWith("carv")) {
    return "Carving Matt";
  }

  // Aliases for Rustic
  if (s === "rustic" || s.startsWith("rust")) {
    return "Rustic Matt";
  }

  // Aliases for Satin / Matt
  if (s === "satin" || s === "matt" || s === "matte" || s === "satin matte") {
    return "Satin Matt";
  }

  // Aliases for Wood Embossed
  if (s === "wood" || s === "wood finish" || s.includes("emboss")) {
    return "Wood Embossed";
  }

  // Aliases for Sugar Finish
  if (s === "sugar" || s.includes("sugar")) {
    return "Sugar Finish";
  }

  return rawSurface;
}

/**
 * Checks if a tile product matches a selected surface filter.
 * When filterValue is "all", matches any tile.
 */
export function matchesSurfaceFilter(tile: any, filterValue: string): boolean {
  if (!filterValue || filterValue === "all") return true;
  const normalized = normalizeSurfaceFinish(tile.surface || tile.finish, tile);
  return normalized.toLowerCase() === filterValue.toLowerCase();
}
