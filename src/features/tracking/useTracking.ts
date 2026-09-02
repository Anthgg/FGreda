import { useQuery } from "@tanstack/react-query";

import { fetchTracking, fetchTrackingInternalLink } from "@/api/tracking";

/** Una sola clave: en este navegador hay como mucho un seguimiento vigente. */
export const TRACKING_KEY = ["tracking", "current"] as const;

export const useTracking = () =>
  useQuery({
    queryKey: TRACKING_KEY,
    queryFn: fetchTracking,
    // Sin reintentos: un 404 aquí significa «no hay contexto», que es un
    // estado normal —se entró a la dirección sin escanear—, no un fallo de red
    // que merezca insistir.
    retry: false,
    staleTime: 30_000,
    // La produccion puede cambiar mientras la persona conserva esta pantalla
    // abierta. React Query vuelve a consultar sin recargar y se detiene cuando
    // la pestana queda en segundo plano.
    refetchInterval: 30_000,
  });

/**
 * El puente hacia la vista interna, si quien mira tiene sesión.
 *
 * Se pregunta al backend en vez de mirar la sesión en el cliente porque la
 * respuesta depende de dos cosas a la vez: que haya sesión y que haya contexto
 * de seguimiento. Un 401 aquí no es un error que enseñar: es la respuesta
 * normal para quien no trabaja en el taller, y lo único que ocurre es que no
 * aparece el enlace.
 */
export const useTrackingInternalLink = (enabled: boolean) =>
  useQuery({
    queryKey: ["tracking", "internal-link"],
    queryFn: fetchTrackingInternalLink,
    enabled,
    retry: false,
  });
