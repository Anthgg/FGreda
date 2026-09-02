/**
 * Superficie pública de seguimiento (Fase 009I.1).
 *
 * Ninguna de estas llamadas necesita sesión, y ninguna escribe. El token del QR
 * viaja **una sola vez**, en `resolveTracking`; a partir de ahí el backend deja
 * una cookie `HttpOnly` acotada a `/api/v1/tracking` y las consultas siguientes
 * no llevan el token en ninguna parte.
 *
 * Por eso no hay ninguna función aquí que reciba un token salvo la primera: si
 * la hubiera, el token volvería a la barra de direcciones o al estado de React,
 * y de ahí a un enlace que alguien reenvía.
 */

import { apiClient } from "@/api/client";
import type { PublicTracking, TrackingInternalLink } from "@/types/tracking";

const TRACKING = "/tracking/production-orders";

/**
 * Cambia el token del QR por el seguimiento y por el contexto en cookie.
 *
 * Un token inválido, corto o desconocido responde el mismo 404 que uno que no
 * existe: el endpoint no confirma qué tokens hay.
 */
export const resolveTracking = (token: string): Promise<PublicTracking> =>
  apiClient.get<PublicTracking>(`${TRACKING}/scan/${encodeURIComponent(token)}`);

/** El seguimiento del contexto vigente en este navegador. */
export const fetchTracking = (): Promise<PublicTracking> =>
  apiClient.get<PublicTracking>(`${TRACKING}/current`);

/**
 * Constancia de seguimiento en PDF.
 *
 * **No es la hoja de taller.** Aquélla lleva el almacén, el material preparado
 * y los gramos, y sigue exigiendo sesión.
 */
export const fetchTrackingDocument = (): Promise<{ blob: Blob; filename: string | null }> =>
  apiClient.getBlobWithFilename(`${TRACKING}/current/document`);

/** Sólo para quien tiene sesión. Devuelve 401 a cualquier otro. */
export const fetchTrackingInternalLink = (): Promise<TrackingInternalLink> =>
  apiClient.get<TrackingInternalLink>(`${TRACKING}/current/internal-link`);
