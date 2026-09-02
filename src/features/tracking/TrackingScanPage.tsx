import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { resolveTracking } from "@/api/tracking";
import { Spinner } from "@/components/Spinner";
import { TRACKING_KEY } from "@/features/tracking/useTracking";
import { TrackingShell } from "@/features/tracking/TrackingShell";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Destino del QR impreso: `/seguimiento/<token>`.
 *
 * Esta pantalla existe para durar un instante. Cambia el token por el
 * seguimiento —el backend deja de paso una cookie `HttpOnly` acotada— y se
 * aparta reemplazando la dirección por `/seguimiento`, sin token.
 *
 * El reemplazo no es cosmético. Un token en la barra de direcciones acaba en el
 * historial, en el portapapeles de quien comparte el enlace y en los registros
 * del servidor; un enlace reenviado «para que veas cómo va» entregaría el
 * acceso permanente sin que nadie lo decida. Después del reemplazo la consulta
 * viaja en una cookie que JavaScript no puede leer y que no se copia al pegar
 * una dirección.
 *
 * **Es pública.** Está fuera de `ProtectedRoute` a propósito: quien escanea la
 * hoja normalmente no tiene cuenta, y hasta 009J acababa en el login.
 */
export function TrackingScanPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();

  const resolver = useMutation({
    mutationFn: (valor: string) => resolveTracking(valor),
    // El resultado se siembra en la caché con la clave que usa `/seguimiento`,
    // de modo que la pantalla siguiente pinta de inmediato en vez de volver a
    // pedir lo mismo y enseñar un segundo cargando.
    onSuccess: (datos) => qc.setQueryData(TRACKING_KEY, datos),
  });

  const { mutate } = resolver;
  useEffect(() => {
    if (token) mutate(token);
  }, [token, mutate]);

  if (!token) return <Navigate to="/seguimiento" replace />;

  if (resolver.isSuccess) return <Navigate to="/seguimiento" replace />;

  if (resolver.isError) {
    const noExiste = resolver.error instanceof ApiError && resolver.error.status === 404;
    return (
      <TrackingShell>
        <p className="text-sm font-medium text-zinc-900">
          {noExiste
            ? "Ese código no corresponde a ninguna orden."
            : "No pudimos abrir el seguimiento."}
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          {noExiste
            ? "Vuelve a escanear el código de la hoja. Si el problema sigue, pide en el taller que comprueben la orden."
            : "Comprueba tu conexión y vuelve a intentarlo. El código no ha sido rechazado."}
        </p>
        {!noExiste ? (
          <button
            type="button"
            onClick={() => resolver.mutate(token)}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-xs hover:bg-zinc-50"
          >
            Reintentar
          </button>
        ) : null}
      </TrackingShell>
    );
  }

  return (
    <TrackingShell>
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-600">
        <Spinner className="size-4" />
        <span>Abriendo el seguimiento…</span>
      </div>
    </TrackingShell>
  );
}
