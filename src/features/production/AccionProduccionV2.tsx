import { useState } from "react";
import { Link } from "react-router-dom";

import { SecondaryButton } from "@/components/form";
import { capabilitiesFor } from "@/features/auth/capabilities";
import { useSession } from "@/features/auth/useSession";
import { StockLocationDialog } from "@/features/production/StockLocationDialog";
import {
  useCreateProductionOrder,
  useIdempotencyKey,
  useProductionOrderForV2Quotation,
} from "@/features/production/useProductionOrders";

/**
 * El puente entre una cotización V2 y el taller. Fase 010I.
 *
 * Sólo aparece cuando la cotización ya se ENVIÓ a producción (010H): antes de
 * eso el backend no admite crear la orden, y el botón que corresponde es
 * «Enviar a producción», que vive en el ciclo de vida de la cotización.
 *
 * - Con orden: «Ver orden de producción». Nunca una segunda: la base admite
 *   una sola por cotización.
 * - Sin orden: «Crear orden de producción», sólo para ADMIN.
 *
 * Crear la orden no descuenta material, y el texto lo dice.
 */
export function AccionProduccionV2({ quotationId }: { quotationId: number }) {
  const { data: user } = useSession();
  const puede = capabilitiesFor(user?.role);
  const existente = useProductionOrderForV2Quotation(quotationId);
  const crear = useCreateProductionOrder();
  const { key } = useIdempotencyKey();
  const [abierto, setAbierto] = useState(false);

  if (existente.isPending) return null;

  if (existente.data) {
    return (
      <Link
        to={`/produccion/${existente.data.id}`}
        data-testid="v2-ver-orden"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
      >
        Ver orden de producción · {existente.data.code}
      </Link>
    );
  }

  if (!puede.crearOrdenDesdeCotizacionV2) return null;

  return (
    <>
      <SecondaryButton onClick={() => setAbierto(true)}>Crear orden de producción</SecondaryButton>
      {abierto ? (
        <StockLocationDialog
          title="Crear orden de producción"
          description={
            "Se abrirá la orden con las piezas de esta cotización. No se descuenta " +
            "ningún material: el consumo real se registra en la orden, cuando sale del almacén."
          }
          confirmLabel="Crear orden"
          pendingLabel="Creando…"
          pending={crear.isPending}
          error={crear.error}
          onClose={() => setAbierto(false)}
          onConfirm={(stockLocationId) => {
            if (crear.isPending) return;
            crear.mutate(
              {
                v2_quotation_id: quotationId,
                stock_location_id: stockLocationId,
                // La misma en cada reintento de esta creación: el backend
                // devuelve la orden ya creada en vez de abrir otra.
                idempotency_key: key,
              },
              { onSuccess: () => setAbierto(false) },
            );
          }}
        />
      ) : null}
    </>
  );
}
