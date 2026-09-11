/**
 * Materiales del Cotizador V2: pastas y esmaltes.
 *
 * Dos superficies que conviene no confundir:
 *
 * - la **valorización** de un material del maestro, que vale para todo lo que
 *   se cotice después;
 * - la **línea** de una cotización, que lleva congelado lo que usó *esa*
 *   cotización y no cambia aunque el maestro suba de precio.
 *
 * El navegador manda intenciones —qué pasta, cuánto pesa una pieza, si lleva
 * esmalte— y recibe importes. El único costo que viaja de ida es el override
 * explícito, que es una decisión y no un resultado.
 */

export type V2MaterialKind = "BODY" | "GLAZE";
export type V2MaterialOrigin = "PURCHASE" | "MANUAL" | "DONATION" | "OTHER";

export interface V2Material {
  product_id: number;
  product_name: string;
  product_type: string;
  uom_code: string | null;
  active: boolean;

  material_kind: V2MaterialKind;
  origin: V2MaterialOrigin;
  purchase_quantity: string;
  purchase_cost: string;
  /** Parte del costo del material: sin transporte, el material no está aquí. */
  transport_cost: string;
  /** Compra más transporte. Lo calcula el backend para no repetir la suma. */
  acquisition_total_cost: string;
  /** Valor de costeo cuando no coincide con lo pagado (material donado). */
  costing_override_per_unit: string | null;
  /** El costo con el que se cotiza. Lo deriva la base de datos. */
  effective_cost_per_unit: string;
  ml_per_gram: string | null;
  notes: string | null;

  /** Se muestra para avisar, NO para bloquear: sin stock se cotiza igual. */
  stock: string;
}

export interface V2MaterialUpsertInput {
  material_kind: V2MaterialKind;
  origin: V2MaterialOrigin;
  purchase_quantity: string;
  purchase_cost: string;
  transport_cost?: string;
  costing_override_per_unit?: string | null;
  ml_per_gram?: string | null;
  notes?: string | null;
}

export interface V2QuotationProduct {
  id: number;
  sort_order: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number;

  body_material_id: number | null;
  body_material_name: string | null;
  body_unit_weight: string | null;
  body_uom: string | null;
  body_cost_per_unit: string | null;
  body_cost_is_override: boolean;
  body_total_weight: string;
  body_cost: string;

  requires_glaze: boolean;
  glaze_material_id: number | null;
  glaze_material_name: string | null;
  /**
   * Si lo eligió el sistema —el activo más caro por gramo—.
   *
   * Importa decirlo en pantalla: producción usará otro esmalte y el precio NO
   * cambiará por eso. Esto es una referencia de costeo, no el esmalte final.
   */
  glaze_is_reference: boolean;
  glaze_cost_per_unit: string | null;
  glaze_cost_is_override: boolean;
  glaze_percent: string | null;
  glaze_ml_per_gram: string | null;
  /** Si se usó la conversión de reserva 1 g = 1 ml. */
  glaze_conversion_is_fallback: boolean;
  glaze_total_weight: string;
  glaze_volume_ml: string;
  glaze_cost: string;

  warnings: string[];
}

export interface V2QuotationProductInput {
  product_id?: number | null;
  quantity?: number;
  body_material_id?: number | null;
  body_unit_weight?: string | null;
  body_cost_per_unit_override?: string | null;
  requires_glaze?: boolean;
  glaze_material_id?: number | null;
  glaze_cost_per_unit_override?: string | null;
}

export interface V2QuotationProductsPage {
  items: V2QuotationProduct[];
  /** Suma de los materiales. Sin redondear y sin factor: el precio es 010F. */
  materials_cost: string;
}

export const MATERIAL_KIND_LABEL: Record<V2MaterialKind, string> = {
  BODY: "Pasta",
  GLAZE: "Esmalte",
};

export const MATERIAL_ORIGIN_LABEL: Record<V2MaterialOrigin, string> = {
  PURCHASE: "Compra",
  MANUAL: "Ingreso manual",
  DONATION: "Donación",
  OTHER: "Otro",
};

/** Los avisos que devuelve el backend, en lenguaje de taller. */
export const WARNING_LABEL: Record<string, string> = {
  V2_BODY_WEIGHT_REQUIRED: "Falta indicar cuánta pasta lleva una pieza.",
  V2_GLAZE_NO_ACTIVE_MATERIAL: "No hay ningún esmalte activo valorizado para costear.",
  V2_GLAZE_REFERENCE_WITHOUT_STOCK:
    "El esmalte usado como referencia no tiene stock. Sirve para costear; producción elegirá el real.",
};
