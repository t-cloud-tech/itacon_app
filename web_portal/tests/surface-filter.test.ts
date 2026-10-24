import { describe, it } from "node:test";
import assert from "node:assert";
import {
  SURFACE_FINISHES,
  normalizeSurfaceFinish,
  matchesSurfaceFilter,
} from "../src/lib/surface-finishes.ts";

describe("Surface Finishes & Catalogue Filter Verification", () => {
  it("1. SURFACE_FINISHES has exactly the 7 expected options in exact order", () => {
    const expected = [
      "High Gloss Polish",
      "Satin Matt",
      "Carving Matt",
      "Wood Embossed",
      "Sugar Finish",
      "Rustic Matt",
      "Glossy Ceramic",
    ];
    assert.deepStrictEqual(Array.from(SURFACE_FINISHES), expected);
    assert.strictEqual(SURFACE_FINISHES.length, 7);
  });

  it("2. Normalizes historical surfaces with alias mapping", () => {
    // Vitrified / Porcelain tiles
    assert.strictEqual(
      normalizeSurfaceFinish("Glossy", { productType: "Vitrified", bodyType: "Porcelain" }),
      "High Gloss Polish"
    );
    assert.strictEqual(
      normalizeSurfaceFinish("GLO", { productType: "Vitrified" }),
      "High Gloss Polish"
    );
    assert.strictEqual(
      normalizeSurfaceFinish("High Gloss", { productType: "Vitrified" }),
      "High Gloss Polish"
    );
    assert.strictEqual(
      normalizeSurfaceFinish("Glossy / High Gloss", { productType: "Vitrified" }),
      "High Gloss Polish"
    );
    assert.strictEqual(
      normalizeSurfaceFinish("high gloss polish", { productType: "Vitrified" }),
      "High Gloss Polish"
    );

    // Carving
    assert.strictEqual(normalizeSurfaceFinish("Carving"), "Carving Matt");
    assert.strictEqual(normalizeSurfaceFinish("carving"), "Carving Matt");
    assert.strictEqual(normalizeSurfaceFinish("Carving Matt"), "Carving Matt");

    // Rustic
    assert.strictEqual(normalizeSurfaceFinish("Rustic"), "Rustic Matt");
    assert.strictEqual(normalizeSurfaceFinish("rustic"), "Rustic Matt");
    assert.strictEqual(normalizeSurfaceFinish("Rustic Matt"), "Rustic Matt");

    // Exact matches
    assert.strictEqual(normalizeSurfaceFinish("Satin Matt"), "Satin Matt");
    assert.strictEqual(normalizeSurfaceFinish("Wood Embossed"), "Wood Embossed");
    assert.strictEqual(normalizeSurfaceFinish("Sugar Finish"), "Sugar Finish");
  });

  it("3. Ceramic tile with glossy surface maps to Glossy Ceramic", () => {
    // Ceramic body or productType
    assert.strictEqual(
      normalizeSurfaceFinish("Glossy", { productType: "Ceramic", bodyType: "Red Body" }),
      "Glossy Ceramic"
    );
    assert.strictEqual(
      normalizeSurfaceFinish("GLO", { tileCategory: "Ceramic Wall Tiles" }),
      "Glossy Ceramic"
    );
    assert.strictEqual(
      normalizeSurfaceFinish("Glossy Ceramic", { productType: "Ceramic" }),
      "Glossy Ceramic"
    );
  });

  it("4. Simulated catalogue dataset: old Glossy tiles match High Gloss Polish, 'all' matches all 298", () => {
    // 297 old glossy tiles + 1 high gloss polish tile = 298 total
    const sampleCatalogue = [
      ...Array.from({ length: 297 }, (_, i) => ({
        id: `PROD_GLO_${i + 1}`,
        name: `ITA ${String(i + 1).padStart(3, "0")}-TILE`,
        sku: `VIT-60120-8.50-GLO-MAR-WHIT-00-${String(i + 1).padStart(3, "0")}`,
        surface: "Glossy",
        productType: "Vitrified",
        bodyType: "Porcelain",
        size: "600x1200 mm",
      })),
      {
        id: "DEMO_01",
        name: "DEMO TILE",
        sku: "DEMO-01",
        surface: "High Gloss Polish",
        productType: "Vitrified",
        bodyType: "Porcelain",
        size: "600x1200 mm",
      },
    ];

    assert.strictEqual(sampleCatalogue.length, 298);

    // All surfaces filter
    const allMatches = sampleCatalogue.filter((t) => matchesSurfaceFilter(t, "all"));
    assert.strictEqual(allMatches.length, 298);

    // High Gloss Polish filter
    const highGlossMatches = sampleCatalogue.filter((t) =>
      matchesSurfaceFilter(t, "High Gloss Polish")
    );
    assert.strictEqual(highGlossMatches.length, 298);

    // Other filters should return 0
    const satinMatches = sampleCatalogue.filter((t) => matchesSurfaceFilter(t, "Satin Matt"));
    assert.strictEqual(satinMatches.length, 0);

    const carvingMatches = sampleCatalogue.filter((t) => matchesSurfaceFilter(t, "Carving Matt"));
    assert.strictEqual(carvingMatches.length, 0);
  });

  it("5. A new tile added with 'Glossy Ceramic' appears under Glossy Ceramic filter", () => {
    const newCeramicTile = {
      id: "NEW_CERAMIC_01",
      name: "Ceramic Wall Metro",
      sku: "CER-3060-001",
      surface: "Glossy Ceramic",
      productType: "Ceramic",
      bodyType: "Ceramic",
      size: "300x600 mm",
    };

    assert.strictEqual(matchesSurfaceFilter(newCeramicTile, "Glossy Ceramic"), true);
    assert.strictEqual(matchesSurfaceFilter(newCeramicTile, "High Gloss Polish"), false);
    assert.strictEqual(matchesSurfaceFilter(newCeramicTile, "all"), true);
  });

  it("6. Search + Filter together operate accurately", () => {
    const mixedCatalogue = [
      {
        id: "T1",
        name: "ITA 001-ADLINE SATUARIO",
        sku: "VIT-60120-001",
        size: "600x1200 mm",
        surface: "Glossy",
        productType: "Vitrified",
      },
      {
        id: "T2",
        name: "ITA 002-PERCIANO",
        sku: "VIT-60120-002",
        size: "600x1200 mm",
        surface: "Glossy",
        productType: "Vitrified",
      },
      {
        id: "T3",
        name: "ITA 003-WOODEN OAK",
        sku: "VIT-20120-003",
        size: "200x1200 mm",
        surface: "Wood Embossed",
        productType: "Vitrified",
      },
    ];

    const filterApp = (items: typeof mixedCatalogue, search: string, finish: string) => {
      return items.filter((p) => {
        const matchesSearch =
          !search ||
          (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
          (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
          (p.size && p.size.toLowerCase().includes(search.toLowerCase()));

        const matchesFinish = matchesSurfaceFilter(p, finish);
        return matchesSearch && matchesFinish;
      });
    };

    // Filter by High Gloss Polish only -> T1 and T2
    assert.strictEqual(filterApp(mixedCatalogue, "", "High Gloss Polish").length, 2);

    // Filter by High Gloss Polish + search "ADLINE" -> only T1
    const adlineResults = filterApp(mixedCatalogue, "ADLINE", "High Gloss Polish");
    assert.strictEqual(adlineResults.length, 1);
    assert.strictEqual(adlineResults[0].id, "T1");

    // Filter by Wood Embossed + search "600x1200" -> 0 matches
    assert.strictEqual(filterApp(mixedCatalogue, "600x1200", "Wood Embossed").length, 0);

    // Filter by Wood Embossed + search "WOODEN" -> 1 match
    assert.strictEqual(filterApp(mixedCatalogue, "WOODEN", "Wood Embossed").length, 1);
  });
});
