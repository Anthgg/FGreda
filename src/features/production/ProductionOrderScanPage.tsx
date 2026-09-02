import { Navigate, useParams } from "react-router-dom";

import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/features/masters/MasterTable";
import { useProductionOrderByToken } from "@/features/production/useProductionOrders";

/**
 * Destino del QR de la hoja de taller.
 *
 * El QR lleva un token opaco, no el id: uno secuencial dejaría recorrer las
 * órdenes ajenas cambiando un dígito. Aquí se cambia el token por la orden y se
 * redirige a su detalle, de modo que el token no queda en la barra de
 * direcciones ni en el historial del navegador del taller.
 *
 * La ruta está detrás de la sesión como cualquier otra: que el QR sea
 * imprimible no convierte la orden en pública.
 */
export function ProductionOrderScanPage() {
  const { token } = useParams<{ token: string }>();
  const order = useProductionOrderByToken(token ?? null);

  if (!token) return <EmptyState message="El código escaneado no trae ninguna orden." />;

  if (order.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-5" label="Abriendo la orden…" />
      </div>
    );
  }

  if (order.isError || !order.data) {
    return (
      <EmptyState message="Ese código no corresponde a ninguna orden de producción." />
    );
  }

  return <Navigate to={`/produccion/${order.data.id}`} replace />;
}
