/**
 * Firestore Product Seeding Script - Fixing Solutions (Tile & Stone Adhesives)
 * 
 * Inject the 6 adhesive items with technical classifications, application rules,
 * and bag pricing into the Firestore `products` collection and category `CAT_ADHESIVES`.
 */

const adhesiveCategory = {
  categoryId: "CAT_ADHESIVES",
  name: "Fixing Solutions",
  subtitle: "Tile & Stone Adhesives",
  displayOrder: 5,
  isFeatured: true,
  imageUrl: "assets/images/adhesives/ITA-LX-01.png"
};

const adhesiveProducts = [
  {
    productId: "PROD_ADH_LX01",
    sku: "ITA-LX-01",
    name: "ITA LX-01 Tile Adhesive",
    productLine: "adhesives",
    categoryId: "CAT_ADHESIVES",
    categoryName: "Fixing Solutions",
    classification: "TYPE-1 (C1T)",
    color: "Grey",
    basePrice: 150,
    unit: "bag",
    bagWeightKg: 20,
    usageTileSizes: "Floor 2x2, Wall 12x18, Parking Tiles 16x16, 12x12",
    applicationNotes: "Standard interior floor & wall ceramic/vitrified tiling.",
    images: ["assets/images/adhesives/ITA-LX-01.png"],
    stockStatus: "available_now",
    isActive: true
  },
  {
    productId: "PROD_ADH_LX02",
    sku: "ITA-LX-02",
    name: "ITA LX-02 Tile Adhesive",
    productLine: "adhesives",
    categoryId: "CAT_ADHESIVES",
    categoryName: "Fixing Solutions",
    classification: "TYPE-2 (C2T)",
    color: "Grey",
    basePrice: 185,
    unit: "bag",
    bagWeightKg: 20,
    usageTileSizes: "300x600, 300x450 Wall, 800x800, 600x1200 upto 10 ft.",
    applicationNotes: "Interior & Exterior Wall or Floor tile-on-tile, high dip elevation.",
    images: ["assets/images/adhesives/ITA-LX-02.png"],
    stockStatus: "available_now",
    isActive: true
  },
  {
    productId: "PROD_ADH_LX03",
    sku: "ITA-LX-03",
    name: "ITA LX-03 Tile Adhesive",
    productLine: "adhesives",
    categoryId: "CAT_ADHESIVES",
    categoryName: "Fixing Solutions",
    classification: "TYPE-3 (C2TE)",
    color: "Grey",
    basePrice: 220,
    unit: "bag",
    bagWeightKg: 20,
    usageTileSizes: "1000x1000, 800x1600 upto 10 ft., 600x1200 upto 20 ft., 200x1200 Wooden Plank.",
    applicationNotes: "Wall and floor heavy vitrified tiles, window/door framing with marble, continuous sunlight exposure.",
    images: ["assets/images/adhesives/ITA-LX-03.png"],
    stockStatus: "available_now",
    isActive: true
  },
  {
    productId: "PROD_ADH_LX03W",
    sku: "ITA-LX-03W",
    name: "ITA LX-03W White Tile Adhesive",
    productLine: "adhesives",
    categoryId: "CAT_ADHESIVES",
    categoryName: "Fixing Solutions",
    classification: "TYPE-3 (WHITE) (C2TE)",
    color: "White",
    basePrice: 310,
    unit: "bag",
    bagWeightKg: 20,
    usageTileSizes: "1000x1000, 800x1600 upto 10 ft., 600x1200 upto 20 ft., 200x1200 Wooden Plank.",
    applicationNotes: "Pure white adhesive for composite marble, glass mosaics, and external walls exposed to continuous sunlight.",
    images: ["assets/images/adhesives/ITA-LX-03W.png"],
    stockStatus: "available_now",
    isActive: true
  },
  {
    productId: "PROD_ADH_LX04",
    sku: "ITA-LX-04",
    name: "ITA LX-04 High-Polymer Adhesive",
    productLine: "adhesives",
    categoryId: "CAT_ADHESIVES",
    categoryName: "Fixing Solutions",
    classification: "TYPE-4 (C2TES1)",
    color: "Grey",
    basePrice: 290,
    unit: "bag",
    bagWeightKg: 20,
    usageTileSizes: "1200x1800, 1200x1200, 1200x1600, 800x2400, Slabs, Marble and Granite.",
    applicationNotes: "High-flex polymer adhesive for large format slabs, elevation facades, and thermal expansion zones.",
    images: ["assets/images/adhesives/ITA-LX-04.png"],
    stockStatus: "available_now",
    isActive: true
  },
  {
    productId: "PROD_ADH_LX04W",
    sku: "ITA-LX-04W",
    name: "ITA LX-04W White Polymer Adhesive",
    productLine: "adhesives",
    categoryId: "CAT_ADHESIVES",
    categoryName: "Fixing Solutions",
    classification: "TYPE-4 (WHITE) (C2TES1)",
    color: "White",
    basePrice: 380,
    unit: "bag",
    bagWeightKg: 20,
    usageTileSizes: "1200x1800, 1200x1200, 1200x1600, 800x2400, Slabs, Marble and Granite.",
    applicationNotes: "Premium white polymer adhesive for luxury translucent marble slabs and heavy-duty external sunlight applications.",
    images: ["assets/images/adhesives/ITA-LX-04W.png"],
    stockStatus: "available_now",
    isActive: true
  }
];

module.exports = {
  adhesiveCategory,
  adhesiveProducts
};
