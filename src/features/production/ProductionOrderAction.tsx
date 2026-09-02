import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SecondaryButton, SelectField } from "@/components/form";
import { PrimaryButton } from "@/components/form";
import { useLocations } from "@/features/masters/useMasters";
import {
  useCreateProductionOrder,
  useProductionOrderForQuotation,
} from "@/features/production/useProductionOrders";
import { describeError } from "@/features/settings/messages";
import type { QuotationStatus } from "@/types/quotations";

interface Props {
  quotationId: number;
  status: QuotationStatus;
  canEdit: boolean;
  disabled?: boolean;
}

/**
 * El puente entre la cotización y el taller.
 *
 * Sólo aparece sobre una CONFIRMADA: un borrador todavía se edita y una anulada
 * ya no se fabrica. El estado de cobro **no** se consulta a propósito —cobrar
 * (009H) y fabricar (009I) son ejes distintos, y atarlos aquí pararía el taller
 * por una gestión administrativa.
 *
 * Si la cotización ya tiene orden, se ofrece abrirla y no crear otra: una
 * cotización tiene como mucho una, y el backend lo impone en la base.
 */
export function ProductionOrderAction({ quotationId, status, canEdit, disabled }: Props) {
  const existente = useProductionOrderForQuotation(status === "CONFIRMED" ? quotationId : null);
  const locations = useLocations();
  const create = useCreateProductionOrder();
  const [abierto, setAbierto] = useState(false);
  const [locationId, setLocationId] = useState("");

  const activas = (locations.data ?? []).filter((location) => location.active);

  // Con un solo almacén se preselecciona, que es comodidad de la pantalla. Lo
  // que no se hace es dejar que el backend lo adivine: allí sigue siendo
  // obligatorio, de modo que el día que haya dos nadie descuente del que no era.
  useEffect(() => {
    if (!locationId && activas.length === 1 && activas[0]) {
      setLocationId(String(activas[0].id));
    }
  }, [activas, locationId]);

  if (status !== "CONFIRMED") return null;

  if (existente.data) {
    return (
      <Link
        to={`/produccion/${existente.data.id}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
      >
        Ver orden de producción · {existente.data.code}
      </Link>
    );
  }

  if (!canEdit || existente.isPending) return null;

  return (
    <>
      <SecondaryButton disabled={disabled} onClick={() => setAbierto(true)}>
        Crear orden de producción
      </SecondaryButton>

      {abierto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crear orden de producción"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-bold">Crear orden de producción</h2>
            {/* El texto dice sólo lo que la acción hace. Crear la orden NO
                descuenta material: eso ocurre al arrancarla, y prometerlo aquí
                haría creer que el almacén ya cambió. */}
            <p className="mt-2 text-sm text-zinc-600">
              Se copiará lo confirmado y se reservará un código de orden. No se
              descuenta ningún material: eso ocurre al arrancar la orden.
            </p>

            <div className="mt-4">
              <SelectField
                label="Almacén de salida"
                requirement="required"
                value={locationId}
                options={activas.map((location) => ({
                  value: String(location.id),
                  label: location.name,
                }))}
                onChange={setLocationId}
                placeholder="Elija el almacén"
              />
              {activas.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  No hay almacenes activos. Cree uno en Inventario antes de producir.
                </p>
              ) : null}
            </div>

            {create.error ? (
              <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                {describeError(create.error)}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => setAbierto(false)}>Volver</SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={create.isPending || !locationId}
                onClick={() =>
                  create.mutate(
                    { quotation_id: quotationId, stock_location_id: Number(locationId) },
                    { onSuccess: () => setAbierto(false) },
                  )
                }
              >
                {create.isPending ? "Creando…" : "Crear orden"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
