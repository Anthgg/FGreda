import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  PrototypeQuotation,
  PrototypeQuotationDraftInput,
  PrototypeQuotationPage,
  PrototypeQuotationUpdateInput,
} from "@/types/prototypeQuotations";

const BASE = "/prototype-quotations";

export const fetchPrototypeQuotations = (
  filters: Record<string, unknown> = {},
): Promise<PrototypeQuotationPage> => apiClient.get(`${BASE}${toQuery(filters)}`);

export const fetchPrototypeQuotation = (id: number): Promise<PrototypeQuotation> =>
  apiClient.get(`${BASE}/${id}`);

/**
 * Cuánto costaría y cuánto tardaría, sin guardar nada.
 *
 * El backend calcula sobre una fila en memoria y deshace la transacción: mirar
 * un precio no gasta un correlativo ni deja borradores sueltos cada vez que
 * alguien mueve un día arriba o abajo.
 */
export const previewPrototypeQuotation = (
  payload: PrototypeQuotationDraftInput,
): Promise<PrototypeQuotation> => apiClient.post(`${BASE}/preview`, payload);

export const createPrototypeQuotation = (
  payload: PrototypeQuotationDraftInput,
): Promise<PrototypeQuotation> => apiClient.post(BASE, payload);

export const updatePrototypeQuotation = (
  id: number,
  payload: PrototypeQuotationUpdateInput,
): Promise<PrototypeQuotation> => apiClient.put(`${BASE}/${id}`, payload);

/** Emite el documento: le pone número CPR y congela el precio. */
export const confirmPrototypeQuotation = (id: number): Promise<PrototypeQuotation> =>
  apiClient.post(`${BASE}/${id}/confirm`, {});

export const cancelPrototypeQuotation = (id: number): Promise<PrototypeQuotation> =>
  apiClient.post(`${BASE}/${id}/cancel`, {});

/**
 * Registra el cobro y deja la muestra lista para el taller.
 *
 * No gasta material: eso ocurre al arrancar la orden. Devuelve la cotización
 * con la muestra y con la ORDEN de producción ya asociadas.
 *
 * Fase 009K.4: el almacén de salida es obligatorio y viaja explícito. No hay
 * ubicación por defecto ni aunque hoy sólo exista una; el día que haya dos, un
 * valor implícito descontaría del almacén equivocado sin avisar.
 */
export const markPrototypeQuotationPaid = (
  id: number,
  stockLocationId: number,
): Promise<PrototypeQuotation> =>
  apiClient.post(`${BASE}/${id}/mark-paid`, { stock_location_id: stockLocationId });

/**
 * El documento, para verlo dentro de la pantalla.
 *
 * Se trae como blob y no como enlace por la misma razon que en el Cotizador: la
 * peticion lleva la sesion y el CSRF del cliente HTTP, y un `<a href>` a la API
 * saldria del navegador sin ellos.
 */
export const fetchPrototypeQuotationPdf = (
  id: number,
): Promise<{ blob: Blob; filename: string | null }> =>
  apiClient.getBlobWithFilename(`${BASE}/${id}/pdf`);
