/**
 * Etiquetas compartidas de los maestros.
 *
 * Viven fuera de los componentes para no romper el fast refresh y para que la
 * tabla y el formulario nombren lo mismo de la misma manera.
 */

import type { PartnerRole, ProductType } from "@/types/masters";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  RAW_MATERIAL: "Insumo",
  PREPARED_MATERIAL: "Preparado",
  FINISHED_PRODUCT: "Producto terminado",
  SERVICE: "Servicio",
};

export const ROLE_LABELS: Record<PartnerRole, string> = {
  CLIENT: "Cliente",
  SUPPLIER: "Proveedor",
  BOTH: "Cliente y proveedor",
};
