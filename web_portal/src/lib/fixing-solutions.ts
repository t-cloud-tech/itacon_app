// ITACON LX fixing solutions (tile & stone adhesives) — same range as the mobile app's AdhesiveData
export interface FixingSolution {
  id: string;
  sku: string;
  name: string;
  grade: string;
  shortDesc: string;
  idealFor: string;
  coverage: string;
  weight: string;
  price: number;
  mrp: number;
  waterRatio: string;
  potLife: string;
  openTime: string;
  tensileStrength: string;
}

export const FIXING_SOLUTIONS: FixingSolution[] = [
  {
    id: "PROD_ADH_LX01",
    sku: "ITA-LX-01",
    name: "ITA LX-01 Tile Adhesive",
    grade: "TYPE-1 (C1T)",
    shortDesc: "Standard interior floor & wall ceramic/vitrified tiling.",
    idealFor: "Floor 2x2, Wall 12x18, Parking Tiles 16x16, 12x12",
    coverage: "50 - 60 sq.ft / 20kg Bag",
    weight: "20 kg Bag",
    price: 150,
    mrp: 190,
    waterRatio: "4.5 to 5.0 Litres per 20 kg bag",
    potLife: "2.5 - 3 Hours at 27°C",
    openTime: "20 Minutes",
    tensileStrength: "≥ 0.5 N/mm²",
  },
  {
    id: "PROD_ADH_LX02",
    sku: "ITA-LX-02",
    name: "ITA LX-02 Tile Adhesive",
    grade: "TYPE-2 (C2T)",
    shortDesc: "Interior & Exterior Wall or Floor tile-on-tile, high dip elevation.",
    idealFor: "300x600, 300x450 Wall, 800x800, 600x1200 (upto 10 ft)",
    coverage: "45 - 55 sq.ft / 20kg Bag",
    weight: "20 kg Bag",
    price: 185,
    mrp: 230,
    waterRatio: "4.8 to 5.2 Litres per 20 kg bag",
    potLife: "3 Hours at 27°C",
    openTime: "25 Minutes",
    tensileStrength: "≥ 1.0 N/mm²",
  },
  {
    id: "PROD_ADH_LX03",
    sku: "ITA-LX-03",
    name: "ITA LX-03 Tile Adhesive",
    grade: "TYPE-3 (C2TE)",
    shortDesc: "Wall & floor heavy vitrified tiles, window/door framing marble, continuous sunlight.",
    idealFor: "1000x1000, 800x1600 (upto 10 ft), 600x1200 (upto 20 ft), 200x1200 Wooden Plank",
    coverage: "40 - 50 sq.ft / 20kg Bag",
    weight: "20 kg Bag",
    price: 220,
    mrp: 275,
    waterRatio: "5.0 to 5.5 Litres per 20 kg bag",
    potLife: "3.5 Hours at 27°C",
    openTime: "30 Minutes",
    tensileStrength: "≥ 1.5 N/mm²",
  },
  {
    id: "PROD_ADH_LX03W",
    sku: "ITA-LX-03W",
    name: "ITA LX-03W White Tile Adhesive",
    grade: "TYPE-3 (WHITE) (C2TE)",
    shortDesc: "Pure white adhesive for composite marble, glass mosaics, and external walls.",
    idealFor: "Composite Marble, Glass Mosaics, White Stones, External Sunlight Walls",
    coverage: "40 - 50 sq.ft / 20kg Bag",
    weight: "20 kg Bag",
    price: 310,
    mrp: 380,
    waterRatio: "5.0 to 5.5 Litres per 20 kg bag",
    potLife: "3.5 Hours at 27°C",
    openTime: "30 Minutes",
    tensileStrength: "≥ 1.5 N/mm²",
  },
  {
    id: "PROD_ADH_LX04",
    sku: "ITA-LX-04",
    name: "ITA LX-04 High-Polymer Adhesive",
    grade: "TYPE-4 (C2TES1)",
    shortDesc: "High-flex polymer adhesive for large format slabs, elevation facades, and thermal expansion.",
    idealFor: "1200x1800, 1200x1200, 1200x1600, 800x2400 Slabs, Marble & Granite",
    coverage: "35 - 45 sq.ft / 20kg Bag",
    weight: "20 kg Bag",
    price: 290,
    mrp: 360,
    waterRatio: "5.2 to 5.8 Litres per 20 kg bag",
    potLife: "4 Hours at 27°C",
    openTime: "35 Minutes",
    tensileStrength: "≥ 2.0 N/mm²",
  },
  {
    id: "PROD_ADH_LX04W",
    sku: "ITA-LX-04W",
    name: "ITA LX-04W White Polymer Adhesive",
    grade: "TYPE-4 (WHITE) (C2TES1)",
    shortDesc: "Premium white polymer adhesive for luxury translucent marble slabs & heavy sunlight.",
    idealFor: "1200x1800 Jumbo Slabs, Onyx Marble, Translucent Stones, External Facades",
    coverage: "35 - 45 sq.ft / 20kg Bag",
    weight: "20 kg Bag",
    price: 380,
    mrp: 470,
    waterRatio: "5.2 to 5.8 Litres per 20 kg bag",
    potLife: "4 Hours at 27°C",
    openTime: "35 Minutes",
    tensileStrength: "≥ 2.0 N/mm²",
  },
];
