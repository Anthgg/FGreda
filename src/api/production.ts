import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  ProductionCommunication,
  ProductionCommunicationCreateIn,
  ProductionConsumption,
  ProductionConsumptionCreateIn,
  ProductionConsumptionPage,
  ProductionNote,
  ProductionNoteCreateIn,
  ProductionOrder,
  ProductionOrderCreateIn,
  ProductionOrderFilters,
  ProductionOrderPage,
  ProductionTimeline,
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

// ---------------------------------------------------------------------------
// Fase 010I — ejecución real de una orden V2
// ---------------------------------------------------------------------------

export const fetchProductionConsumptions = (id: number): Promise<ProductionConsumptionPage> =>
  apiClient.get<ProductionConsumptionPage>(`${ORDERS}/${id}/consumptions`);

/**
 * Registra material REAL gastado. **Mueve inventario**, y sólo por esta llamada.
 *
 * Reintentar con la misma `idempotency_key` no descuenta dos veces: el backend
 * devuelve el consumo que ya existe.
 */
export const registerProductionConsumption = (
  id: number,
  payload: ProductionConsumptionCreateIn,
): Promise<ProductionConsumption> =>
  apiClient.post<ProductionConsumption>(`${ORDERS}/${id}/consumptions`, payload);

/** Nota o quema real en el seguimiento. No mueve inventario. */
export const addProductionNote = (
  id: number,
  payload: ProductionNoteCreateIn,
): Promise<ProductionNote> => apiClient.post<ProductionNote>(`${ORDERS}/${id}/notes`, payload);

/**
 * REGISTRA un aviso al cliente que ya se hizo. **No envía nada**: el sistema
 * no tiene integración con WhatsApp ni con ningún proveedor.
 */
export const registerProductionCommunication = (
  id: number,
  payload: ProductionCommunicationCreateIn,
): Promise<ProductionCommunication> =>
  apiClient.post<ProductionCommunication>(`${ORDERS}/${id}/communications`, payload);

/** Todo lo que le pasó a la orden, en el orden que manda el backend. */
export const fetchProductionTimeline = (id: number): Promise<ProductionTimeline> =>
  apiClient.get<ProductionTimeline>(`${ORDERS}/${id}/timeline`);
