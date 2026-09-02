/**
 * Seguimiento público de una orden de producción (Fase 009I.1).
 *
 * Es lo que responde la aplicación **sin sesión**, a quien escanea el QR de una
 * hoja de taller. La lista de campos es corta a propósito y la decide el
 * backend: aquí no hay forma de pedir uno más.
 *
 * Lo que NO está —y no puede estar— es la parte importante: ni cotización de
 * origen, ni almacén, ni material preparado, ni gramos, ni receta, ni saldos,
 * ni cliente, ni quién la manejó, ni identificadores de base de datos, ni el
 * token del QR.
 */

import type { ProductionOrderStatus } from "@/types/production";

export interface PublicTrackingItem {
  /** El nombre comercial. Ni el código interno ni las medidas. */
  product_name: string;
  quantity: number | null;
}

export interface PublicTracking {
  company_name: string;
  order_code: string;
  /**
   * El código, no una frase. El backend manda códigos y el castellano lo pone
   * esta capa, para que corregir una errata no obligue a desplegar el backend.
   */
  status: ProductionOrderStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  items: PublicTrackingItem[];
}

/**
 * A qué orden interna corresponde el seguimiento vigente.
 *
 * Sólo se responde a quien tiene sesión. Es el puente entre el papel y la
 * aplicación: quien trabaja aquí escanea el mismo QR y llega a la vista
 * interna sin teclear un código.
 */
export interface TrackingInternalLink {
  production_order_id: number;
}
