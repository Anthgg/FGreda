import { useState } from "react";

import { PrimaryButton, SecondaryButton, SelectField } from "@/components/form";
import { useLocations } from "@/features/masters/useMasters";
import { describeError } from "@/features/settings/messages";

interface Props {
  title: string;
  /** Qué va a pasar al confirmar. Se dice entero: no se promete de más. */
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  ariaLabel?: string;
  onConfirm: (stockLocationId: number) => void;
  onClose: () => void;
  pending: boolean;
  error: Error | null;
}

/**
 * Elegir el almacén del que va a salir el material. Fase 009K.4.
 *
 * Existe una sola vez porque la regla que lo gobierna es una sola y no puede
 * relajarse en ninguna pantalla: **el almacén empieza vacío y no se
 * preselecciona nunca**, ni cuando sólo hay uno activo.
 *
 * Es la comodidad evidente y es justo la que hay que resistir. El día que haya
 * dos almacenes, un valor por defecto descontará del equivocado sin que nadie
 * lo note, y para entonces la costumbre de no mirar ya estará aprendida. El
 * backend impone lo mismo; esta pantalla no lo inventa ni lo suaviza.
 */
export function StockLocationDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  ariaLabel,
  onConfirm,
  onClose,
  pending,
  error,
}: Props) {
  const locations = useLocations();
  const [locationId, setLocationId] = useState("");

  const activas = (locations.data ?? []).filter((location) => location.active);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>

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
          {locations.isPending ? (
            <p className="mt-2 text-xs text-zinc-500">Cargando almacenes…</p>
          ) : activas.length === 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              No hay almacenes activos. Cree uno en Inventario antes de continuar.
            </p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {describeError(error)}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Volver</SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={pending || !locationId}
            onClick={() => onConfirm(Number(locationId))}
          >
            {pending ? pendingLabel : confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
