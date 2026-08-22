/**
 * Datos sinteticos para las pruebas de los maestros.
 *
 * Nada de esto sale del maestro real del taller: son valores inventados que
 * solo existen para ejercitar la interfaz.
 */

import type {
  ImportBatch,
  ImportPreview,
  ImportRow,
  Page,
  Partner,
  PosCategory,
  Product,
  ProductCategory,
  StockBalance,
  StockMovement,
  UnitOfMeasure,
} from "@/types/masters";

export const CATEGORIES: ProductCategory[] = [
  { id: 1, name: "Insumos Taller", parent_id: null, display_path: "Insumos Taller", active: true },
  {
    id: 2,
    name: "Pastas",
    parent_id: 1,
    display_path: "Insumos Taller / Pastas",
    active: true,
  },
];

export const POS_CATEGORIES: PosCategory[] = [
  { id: 1, name: "Menaje", parent_id: null, active: true },
];

export const UNITS: UnitOfMeasure[] = [
  {
    code: "g",
    name: "Gramo",
    symbol: "g",
    dimension: "MASS",
    factor_to_base: "1.000000000000",
    is_base: true,
    active: true,
  },
  {
    code: "kg",
    name: "Kilogramo",
    symbol: "kg",
    dimension: "MASS",
    factor_to_base: "1000.000000000000",
    is_base: false,
    active: true,
  },
  {
    code: "unit",
    name: "Unidad",
    symbol: "u",
    dimension: "COUNT",
    factor_to_base: "1.000000000000",
    is_base: true,
    active: true,
  },
];

export const PRODUCT: Product = {
  id: 1,
  internal_reference: "INS-1",
  name: "Arcilla blanca",
  product_type: "RAW_MATERIAL",
  product_category_id: 2,
  product_category_path: "Insumos Taller / Pastas",
  pos_category_id: null,
  pos_category_name: null,
  base_uom_code: "g",
  purchase_uom_code: "kg",
  cost: "0.016906843137",
  sale_price: null,
  sale_tax_rate: null,
  purchase_tax_rate: "18.000000",
  sellable: false,
  purchasable: true,
  available_in_pos: false,
  active: true,
  notes: null,
};

export const PRODUCTS_PAGE: Page<Product> = {
  items: [PRODUCT],
  total: 1,
  limit: 25,
  offset: 0,
};

export const PARTNER: Partner = {
  id: 1,
  name: "Proveedor de prueba S.A.",
  role: "SUPPLIER",
  document_type: "RUC",
  document_number: "20999999999",
  address: "Av. Inventada 123",
  reference: null,
  ubigeo_code: "150104",
  district: "BARRANCO",
  province: "LIMA",
  department: "LIMA",
  country: "Peru",
  email: null,
  mobile: "999999999",
  phone: null,
  active: true,
  notes: null,
};

export const PARTNERS_PAGE: Page<Partner> = {
  items: [PARTNER],
  total: 1,
  limit: 25,
  offset: 0,
};

export const STOCK_PAGE: Page<StockBalance> = {
  items: [
    {
      product_id: 1,
      internal_reference: "INS-1",
      product_name: "Arcilla blanca",
      location_id: 1,
      location_name: "Mariano Pastor",
      uom_code: "g",
      quantity: "120.000000000000",
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

export const MOVEMENTS_PAGE: Page<StockMovement> = {
  items: [
    {
      id: 1,
      product_id: 1,
      internal_reference: "INS-1",
      product_name: "Arcilla blanca",
      location_id: 1,
      location_name: "Mariano Pastor",
      movement_type: "INITIAL_IMPORT",
      quantity: "120.000000000000",
      balance_after: "120.000000000000",
      uom_code: "g",
      reason: "Importacion inicial (lote 1)",
      import_batch_id: 1,
      created_by_name: "Administrador",
      created_at: "2026-08-22T10:00:00Z",
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

export const IMPORT_BATCH: ImportBatch = {
  id: 1,
  filename: "maestros.xlsx",
  file_hash: "a".repeat(64),
  file_size: 1024,
  status: "ANALYZED",
  summary: {
    creates: 3,
    updates: 1,
    skips: 2,
    errors: 0,
    warnings: 2,
    review_required: 1,
    by_entity: {},
    sheets: [
      {
        name: "Productos",
        rows: 2,
        columns: 13,
        headers: [],
        entity: "PRODUCT",
        detected: 2,
        warnings: [],
      },
    ],
    recipes_detected: 3,
    recipe_lines_detected: 9,
    recipes_imported: 0,
    duplicate_file: false,
    duplicate_of_batch_id: null,
  },
  error_message: null,
  created_by_name: "Administrador",
  created_at: "2026-08-22T10:00:00Z",
  analyzed_at: "2026-08-22T10:00:01Z",
  confirmed_at: null,
  completed_at: null,
};

export const PRODUCT_ROW: ImportRow = {
  id: 10,
  entity: "PRODUCT",
  sheet_name: "Productos",
  source_row: 2,
  raw: { name: "Arcilla blanca", cost: "0.0169068431372549" },
  normalized: { name: "Arcilla blanca", internal_reference: "INS-1", cost: "0.016906843137" },
  action: "CREATE",
  status: "READY",
  errors: [],
  warnings: [
    {
      code: "ROUNDED_TO_12_DECIMALS",
      message: "El costo del archivo excede la escala de 12 decimales del proyecto",
      source: "0.0169068431372549",
      normalized: "0.016906843137",
    },
  ],
  candidates: [],
  resolution: null,
  target_id: null,
};

export const PARTNER_ROW: ImportRow = {
  id: 11,
  entity: "PARTNER",
  sheet_name: "Proveedores y clientes",
  source_row: 2,
  raw: { name: "Proveedor de prueba S.A." },
  normalized: {
    name: "Proveedor de prueba S.A.",
    role: "PENDING_CLASSIFICATION",
    document_number: "1234567",
    document_suggestion: "01234567",
  },
  action: "CREATE",
  status: "REVIEW_REQUIRED",
  errors: [],
  warnings: [
    {
      code: "PARTNER_ROLE_NOT_CLASSIFIED",
      message: "Falta clasificar el tercero como CLIENT, SUPPLIER o BOTH",
    },
    {
      code: "DOCUMENT_FORMAT_LOST",
      message: "Excel guardo el documento como numero y pudo perder formato",
      source: "1234567.0",
      suggested: "01234567",
      stored: "1234567",
    },
  ],
  candidates: [],
  resolution: null,
  target_id: null,
};

export const IMPORT_PREVIEW: ImportPreview = {
  batch: IMPORT_BATCH,
  items: [PRODUCT_ROW, PARTNER_ROW],
  total: 2,
  limit: 200,
  offset: 0,
};
