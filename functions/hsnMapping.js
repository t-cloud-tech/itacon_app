/**
 * Shared HSN Mapping Engine for ITACON GRANITO
 *
 * Single source of truth for categorizing products/tiles into their
 * corresponding HSN categories:
 * - vitrified: 69072100
 * - ceramicFloor: 69072200
 * - ceramicWall: 69072300
 * - tileAdhesive: 32149090
 *
 * Used by:
 * 1. scripts/applyHsnCodes.js (bulk batch processor)
 * 2. functions/assignHsnCode.js (Cloud Function 2nd gen trigger on products/{id})
 */

const FIELDS_USED_FOR_TYPE_DETECTION = [
  'isAdhesive',
  'sku',
  'productType',
  'type',
  'material',
  'bodyType',
  'tileCategory',
  'category',
  'classification',
  'id',
  'productId',
  'name',
  'productName',
];

/**
 * Decides the HSN category for a product/tile doc:
 *
 * Rules:
 * 1. isAdhesive == true OR PROD_ADH_LX01 to PROD_ADH_LX04W (or SKU ITA-LX-01..04W) -> tileAdhesive
 * 2. Tile type/material contains "vitrified", "porcelain", "GVT", "PGVT", "double charge",
 *    "full body", or SKU starts with "VIT-" -> vitrified
 * 3. Tile type contains "ceramic" AND "wall" -> ceramicWall
 * 4. Tile type contains "ceramic" AND "floor" -> ceramicFloor
 * 5. Anything else -> null (UNMAPPED)
 *
 * @param {Object} data - Product document data
 * @param {string} [docId] - Document ID in Firestore
 * @returns {'tileAdhesive' | 'vitrified' | 'ceramicWall' | 'ceramicFloor' | null}
 */
function resolveHsnCategory(data = {}, docId = '') {
  if (!data) return null;

  const id = String(docId || data.id || data.productId || '').trim();
  const sku = String(data.sku || '').toUpperCase().trim();
  const isAdhesive = data.isAdhesive === true;

  // Rule 1: Tile Adhesives
  // isAdhesive == true (PROD_ADH_LX01 to PROD_ADH_LX04W) -> tileAdhesive
  if (
    isAdhesive ||
    id.startsWith('PROD_ADH_') ||
    /^ITA-LX-0[1-4]W?$/i.test(sku)
  ) {
    return 'tileAdhesive';
  }

  // Concatenate relevant fields for keyword matching
  const searchFields = [
    data.productType,
    data.type,
    data.material,
    data.bodyType,
    data.tileCategory,
    data.category,
    data.classification,
    data.name,
    data.productName,
  ]
    .filter(Boolean)
    .map(s => String(s).toLowerCase())
    .join(' ');

  // Rule 2: Vitrified / Porcelain Tiles
  // Tile type/material contains "vitrified", "porcelain", "GVT", "PGVT", "double charge", "full body", or the SKU starts with "VIT-" -> vitrified
  const isVitrified =
    sku.startsWith('VIT-') ||
    searchFields.includes('vitrified') ||
    searchFields.includes('porcelain') ||
    searchFields.includes('gvt') ||
    searchFields.includes('pgvt') ||
    searchFields.includes('double charge') ||
    searchFields.includes('full body');

  if (isVitrified) {
    return 'vitrified';
  }

  // Rule 3: Ceramic Wall
  // Tile type contains "ceramic" AND "wall" -> ceramicWall
  if (searchFields.includes('ceramic') && searchFields.includes('wall')) {
    return 'ceramicWall';
  }

  // Rule 4: Ceramic Floor
  // Tile type contains "ceramic" AND "floor" -> ceramicFloor
  if (searchFields.includes('ceramic') && searchFields.includes('floor')) {
    return 'ceramicFloor';
  }

  // Anything else -> UNMAPPED
  return null;
}

/**
 * Checks if any of the type/category/sku defining fields changed between before and after
 */
function hasTileTypeChanged(before = {}, after = {}) {
  if (!before) return true;
  return (
    before.productType !== after.productType ||
    before.type !== after.type ||
    before.material !== after.material ||
    before.bodyType !== after.bodyType ||
    before.tileCategory !== after.tileCategory ||
    before.category !== after.category ||
    before.classification !== after.classification ||
    before.sku !== after.sku ||
    before.isAdhesive !== after.isAdhesive
  );
}

module.exports = {
  FIELDS_USED_FOR_TYPE_DETECTION,
  resolveHsnCategory,
  hasTileTypeChanged,
};

