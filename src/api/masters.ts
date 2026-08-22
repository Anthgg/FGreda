/**
 * Operaciones de maestros, inventario e importacion contra BGreda.
 *
 * Igual que el resto de la aplicacion: todo pasa por el cliente HTTP unico y
 * ninguna funcion decide permisos ni recalcula valores oficiales.
 */

import { apiClient } from "@/api/client";
import type {
  ImportBatch,
  ImportCommitResult,
  ImportEntity,
  ImportPreview,
  ImportRowStatus,
  Page,
  Partner,
  PartnerFilters,
  PartnerInput,
  PosCategory,
  Product,
  ProductCategory,
  ProductFilters,
  ProductInput,
  RowResolution,
  StockAdjustmentInput,
  StockBalance,
  StockLocation,
  StockMovement,
  UnitOfMeasure,
} from "@/types/masters";

const CATEGORIES = "/categories";
const POS_CATEGORIES = "/pos-categories";
const UNITS = "/units";
const PRODUCTS = "/products";
const PARTNERS = "/partners";
const INVENTORY = "/inventory";
const IMPORTS = "/imports";

/** Serializa filtros omitiendo lo vacio, para no enviar `?search=undefined`. */
export function toQuery(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ---------------------------------------------------------------------------
// Catalogos
// ---------------------------------------------------------------------------
export function fetchProductCategories(): Promise<ProductCategory[]> {
  return apiClient.get<ProductCategory[]>(CATEGORIES);
}

export function createProductCategory(payload: {
  name: string;
  parent_id: number | null;
}): Promise<ProductCategory> {
  return apiClient.post<ProductCategory>(CATEGORIES, payload);
}

export function fetchPosCategories(): Promise<PosCategory[]> {
  return apiClient.get<PosCategory[]>(POS_CATEGORIES);
}

export function fetchUnits(): Promise<UnitOfMeasure[]> {
  return apiClient.get<UnitOfMeasure[]>(UNITS);
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
export function fetchProducts(filters: ProductFilters): Promise<Page<Product>> {
  return apiClient.get<Page<Product>>(`${PRODUCTS}${toQuery({ ...filters })}`);
}

export function fetchProduct(id: number): Promise<Product> {
  return apiClient.get<Product>(`${PRODUCTS}/${id}`);
}

export function createProduct(payload: ProductInput): Promise<Product> {
  return apiClient.post<Product>(PRODUCTS, payload);
}

export function updateProduct(id: number, payload: ProductInput): Promise<Product> {
  return apiClient.put<Product>(`${PRODUCTS}/${id}`, payload);
}


// ---------------------------------------------------------------------------
// Terceros
// ---------------------------------------------------------------------------
export function fetchPartners(filters: PartnerFilters): Promise<Page<Partner>> {
  return apiClient.get<Page<Partner>>(`${PARTNERS}${toQuery({ ...filters })}`);
}

export function createPartner(payload: PartnerInput): Promise<Partner> {
  return apiClient.post<Partner>(PARTNERS, payload);
}

export function updatePartner(id: number, payload: PartnerInput): Promise<Partner> {
  return apiClient.put<Partner>(`${PARTNERS}/${id}`, payload);
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------
export function fetchStock(filters: {
  search?: string;
  product_id?: number;
  location_id?: number;
  limit?: number;
  offset?: number;
}): Promise<Page<StockBalance>> {
  return apiClient.get<Page<StockBalance>>(`${INVENTORY}${toQuery({ ...filters })}`);
}

export function fetchLocations(): Promise<StockLocation[]> {
  return apiClient.get<StockLocation[]>(`${INVENTORY}/locations`);
}

export function fetchMovements(filters: {
  product_id?: number;
  location_id?: number;
  limit?: number;
  offset?: number;
}): Promise<Page<StockMovement>> {
  return apiClient.get<Page<StockMovement>>(
    `${INVENTORY}/movements${toQuery({ ...filters })}`,
  );
}

export function createAdjustment(payload: StockAdjustmentInput): Promise<StockMovement> {
  return apiClient.post<StockMovement>(`${INVENTORY}/adjustments`, payload);
}

// ---------------------------------------------------------------------------
// Importador
// ---------------------------------------------------------------------------
export function uploadMasterWorkbook(file: File): Promise<ImportBatch> {
  const form = new FormData();
  form.append("file", file);
  // Un libro grande tarda en analizarse; el backend lo lee una sola vez.
  return apiClient.postForm<ImportBatch>(`${IMPORTS}/master/upload`, form, {
    timeoutMs: 120_000,
  });
}

export function fetchImports(): Promise<{ items: ImportBatch[]; total: number }> {
  return apiClient.get<{ items: ImportBatch[]; total: number }>(IMPORTS);
}

export function fetchImport(id: number): Promise<ImportBatch> {
  return apiClient.get<ImportBatch>(`${IMPORTS}/${id}`);
}

export function fetchImportPreview(
  id: number,
  filters: {
    entity?: ImportEntity;
    row_status?: ImportRowStatus;
    limit?: number;
    offset?: number;
  },
): Promise<ImportPreview> {
  return apiClient.get<ImportPreview>(
    `${IMPORTS}/${id}/preview${toQuery({ ...filters })}`,
  );
}

export function resolveImportRows(
  id: number,
  resolutions: RowResolution[],
): Promise<ImportBatch> {
  return apiClient.post<ImportBatch>(`${IMPORTS}/${id}/resolve`, { resolutions });
}

export function commitImport(id: number): Promise<ImportCommitResult> {
  return apiClient.post<ImportCommitResult>(`${IMPORTS}/${id}/commit`, {}, {
    timeoutMs: 120_000,
  });
}
