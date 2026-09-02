import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  ProductionOrder,
  ProductionOrderCreateIn,
  ProductionOrderFilters,
  ProductionOrderPage,
} from "@/types/production";

const ORDERS = "/production-orders";

export const fetchProductionOrders = (
  filters: ProductionOrderFilters = {},
): Promise<ProductionOrderPage> =>
  apiClient.get<ProductionOrderPage>(`${ORDERS}${toQuery({ ...filters })}`);

export const fetchProductionOrder = (id: number): Promise<ProductionOrder> =>
  apiClient.get<ProductionOrder>(`${ORDERS}/${id}`);

/** Resuelve el token opaco de un QR. Exige sesión, como cualquier lectura. */
export const fetchProductionOrderByToken = (token: string): Promise<ProductionOrder> =>
  apiClient.get<ProductionOrder>(`${ORDERS}/scan/${encodeURIComponent(token)}`);

/**
 * Crea la orden de una cotización confirmada.
 *
 * No consume material. Si la cotización ya tiene orden, el backend devuelve la
 * que hay en vez de crear una segunda.
 */
export const createProductionOrder = (
  payload: ProductionOrderCreateIn,
): Promise<ProductionOrder> => apiClient.post<ProductionOrder>(ORDERS, payload);

/**
 * Arranca la orden y descuenta el material preparado.
 *
 * **La única llamada de este módulo que mueve inventario.** Todo o nada: si un
 * solo material no alcanza, el backend deshace la transacción entera y la orden
 * sigue en CREATED.
 */
export const startProductionOrder = (id: number): Promise<ProductionOrder> =>
  apiClient.post<ProductionOrder>(`${ORDERS}/${id}/start`, {});

export const completeProductionOrder = (id: number): Promise<ProductionOrder> =>
  apiClient.post<ProductionOrder>(`${ORDERS}/${id}/complete`, {});

export const cancelProductionOrder = (id: number): Promise<ProductionOrder> =>
  apiClient.post<ProductionOrder>(`${ORDERS}/${id}/cancel`, {});

/** Hoja de taller en PDF, con el QR de la orden. */
export const fetchProductionOrderDocument = (
  id: number,
): Promise<{ blob: Blob; filename: string | null }> =>
  apiClient.getBlobWithFilename(`${ORDERS}/${id}/document`);
