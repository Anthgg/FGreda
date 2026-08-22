import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ApiError } from "@/api/client";
import { LoadingScreen, StatusScreen } from "@/components/StatusScreen";
import { useSession } from "@/features/auth/useSession";

/**
 * Guarda de rutas privadas.
 *
 * La unica evidencia de sesion aceptada es la respuesta de `/auth/me`. La
 * presencia de cookies no se consulta —ni se puede— desde JavaScript.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const { data: user, isPending, isError, error, refetch, isFetching } = useSession();

  if (isPending) {
    return <LoadingScreen />;
  }

  if (isError) {
    const unreachable = error instanceof ApiError && error.isUnreachable;
    return (
      <StatusScreen
        title={unreachable ? "No se pudo contactar con el servidor" : "Error al verificar la sesion"}
        description={
          error instanceof ApiError ? error.message : "Ocurrio un error inesperado al iniciar."
        }
      >
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {isFetching ? "Reintentando..." : "Reintentar"}
        </button>
      </StatusScreen>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/** Impide volver al login cuando ya existe una sesion activa. */
export function PublicOnlyRoute() {
  const { data: user, isPending } = useSession();

  if (isPending) {
    return <LoadingScreen />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
