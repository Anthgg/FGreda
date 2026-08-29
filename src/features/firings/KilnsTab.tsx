/**
 * Hornos y tarifas.
 *
 * Cambiar una tarifa no reescribe las quemas ya confirmadas: abre una vigencia
 * nueva y cierra la anterior. El historial se muestra para que eso se vea.
 */

import { useState } from "react";

import { PrimaryButton, SecondaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Badge, EmptyState } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  FIRING_TYPE_LABEL,
  FIRING_TYPE_OPTIONS,
  formatDecimalString,
} from "@/features/firings/labels";
import {
  useCreateKiln,
  useKilnRates,
  useKilns,
  useSetKilnRate,
  useUpdateKiln,
} from "@/features/firings/useFirings";
import type { FiringType, KilnOut } from "@/types/firings";

const DECIMAL_POSITIVO = /^\d+(\.\d+)?$/;

function esImporteValido(valor: string): boolean {
  return DECIMAL_POSITIVO.test(valor.trim());
}

/** Alta de horno. La capacidad es lo único que decide el reparto, así que se pide siempre. */
function NuevoHorno({ onDone }: { onDone: () => void }) {
  const [nombre, setNombre] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const crear = useCreateKiln();

  const valido = nombre.trim() !== "" && esImporteValido(capacidad) && Number(capacidad) !== 0;

  return (
    <form
      className="space-y-3 rounded-3xl border border-white/60 bg-white/60 p-5 shadow-xs backdrop-blur-md"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!valido) return;
        crear.mutate(
          { name: nombre.trim(), capacity_volume_cm3: capacidad.trim() },
          {
            onSuccess: () => {
              setNombre("");
              setCapacidad("");
              onDone();
            },
          },
        );
      }}
    >
      <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">Nuevo horno</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Nombre" value={nombre} onChange={setNombre} requirement="required" />
        <TextField
          label="Capacidad (cm³)"
          value={capacidad}
          onChange={setCapacidad}
          inputMode="decimal"
          requirement="required"
          hint="El código lo genera el sistema."
        />
      </div>
      {crear.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(crear.error)}
        </p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <PrimaryButton disabled={!valido || crear.isPending}>
          {crear.isPending ? "Creando…" : "Crear horno"}
        </PrimaryButton>
        <SecondaryButton onClick={onDone}>Cancelar</SecondaryButton>
      </div>
    </form>
  );
}

/** Historial de tarifas de un horno, con la vigente marcada. */
function HistorialTarifas({ kilnId }: { kilnId: number }) {
  const rates = useKilnRates(kilnId);

  if (rates.isPending) {
    return (
      <div className="flex justify-center py-4">
        <Spinner className="size-4" label="Cargando historial…" />
      </div>
    );
  }
  if (rates.isError) {
    return (
      <p role="alert" className="py-3 text-xs text-red-600">
        {describeError(rates.error)}
      </p>
    );
  }
  if (!rates.data?.length) {
    return <p className="py-3 text-xs text-zinc-400">Todavía no hay tarifas registradas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/[0.04] bg-white/40">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-black/[0.04] bg-black/[0.02] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2 text-right">Tarifa</th>
            <th className="px-3 py-2">Desde</th>
            <th className="px-3 py-2">Hasta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.03]">
          {rates.data.map((rate) => (
            <tr key={rate.id} className="hover:bg-white/60 transition-colors">
              <td className="px-3 py-2 font-medium text-zinc-900">{FIRING_TYPE_LABEL[rate.firing_type]}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-zinc-900">
                {formatDecimalString(rate.rate, 2)}
              </td>
              <td className="px-3 py-2 text-zinc-500">{rate.valid_from}</td>
              <td className="px-3 py-2">
                {rate.valid_to ? (
                  <span className="text-zinc-500">{rate.valid_to}</span>
                ) : (
                  <Badge tone="positive">Vigente</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ficha de un horno: datos, tarifas, tabla de factores e historial. */
function FichaHorno({ kiln, canEdit }: { kiln: KilnOut; canEdit: boolean }) {
  const [capacidad, setCapacidad] = useState(kiln.capacity_volume_cm3);
  const [dias, setDias] = useState(String(kiln.firing_days_per_batch));
  const [tipoTarifa, setTipoTarifa] = useState<FiringType>("LOW");
  const [importe, setImporte] = useState("");
  const [verHistorial, setVerHistorial] = useState(false);

  const actualizar = useUpdateKiln(kiln.id);
  const fijarTarifa = useSetKilnRate(kiln.id);

  return (
    <article className="space-y-4 rounded-3xl border border-white/60 bg-white/60 p-5 shadow-xs backdrop-blur-md">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-black/[0.04] pb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">{kiln.name}</h3>
          <p className="font-mono text-[10px] text-zinc-400">{kiln.code}</p>
        </div>
        <Badge tone={kiln.active ? "positive" : "neutral"}>
          {kiln.active ? "Activo" : "Inactivo"}
        </Badge>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/[0.04] bg-white/40 p-3 shadow-2xs">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Capacidad</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
            {formatDecimalString(kiln.capacity_volume_cm3, 0)} cm³
          </p>
        </div>
        <div className="rounded-2xl border border-black/[0.04] bg-white/40 p-3 shadow-2xs">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
            Días / hornada
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
            {kiln.firing_days_per_batch}
          </p>
        </div>
        <div className="rounded-2xl border border-black/[0.04] bg-white/40 p-3 shadow-2xs">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Quema baja</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
            {formatDecimalString(kiln.current_low_rate, 2)}
          </p>
        </div>
        <div className="rounded-2xl border border-black/[0.04] bg-white/40 p-3 shadow-2xs">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Quema alta</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
            {formatDecimalString(kiln.current_high_rate, 2)}
          </p>
        </div>
      </div>

      {canEdit ? (
        <div className="grid grid-cols-1 gap-4 border-t border-black/[0.04] pt-3 lg:grid-cols-2">
          <div className="space-y-2">
            <TextField
              label="Cambiar capacidad (cm³)"
              value={capacidad}
              onChange={setCapacidad}
              inputMode="decimal"
            />
            {/* La duración de una hornada es un dato del horno, no del tipo de
                quema: baja y alta tardan lo mismo en el mismo horno. Cambiarla
                afecta a los borradores, nunca a lo ya confirmado. */}
            <TextField
              label="Días por hornada"
              value={dias}
              onChange={setDias}
              inputMode="numeric"
              hint="Días que el horno queda ocupado por cada hornada. Mínimo 1."
            />
            <div className="flex gap-2">
              <SecondaryButton
                onClick={() =>
                  actualizar.mutate({ capacity_volume_cm3: capacidad.trim() })
                }
                disabled={
                  !esImporteValido(capacidad) ||
                  capacidad === kiln.capacity_volume_cm3 ||
                  actualizar.isPending
                }
              >
                Guardar capacidad
              </SecondaryButton>
              <SecondaryButton
                onClick={() => actualizar.mutate({ firing_days_per_batch: Number(dias) })}
                disabled={
                  !/^[1-9]\d*$/.test(dias.trim()) ||
                  dias.trim() === String(kiln.firing_days_per_batch) ||
                  actualizar.isPending
                }
              >
                Guardar días
              </SecondaryButton>
              <SecondaryButton
                onClick={() => actualizar.mutate({ active: !kiln.active })}
                disabled={actualizar.isPending}
              >
                {kiln.active ? "Desactivar" : "Activar"}
              </SecondaryButton>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <SelectField
                label="Tipo de quema"
                value={tipoTarifa}
                options={FIRING_TYPE_OPTIONS}
                onChange={setTipoTarifa}
                className="w-32"
              />
              <TextField
                label="Nueva tarifa"
                value={importe}
                onChange={setImporte}
                inputMode="decimal"
                className="min-w-[120px] flex-1"
              />
            </div>
            <SecondaryButton
              onClick={() =>
                fijarTarifa.mutate(
                  { firing_type: tipoTarifa, rate: importe.trim() },
                  { onSuccess: () => setImporte("") },
                )
              }
              disabled={!esImporteValido(importe) || fijarTarifa.isPending}
            >
              Fijar tarifa
            </SecondaryButton>
            <p className="text-[10px] text-zinc-400">
              Cierra la tarifa vigente y abre una nueva. Las quemas ya confirmadas conservan
              la suya.
            </p>
          </div>
        </div>
      ) : null}

      {actualizar.isError || fijarTarifa.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(actualizar.error ?? fijarTarifa.error)}
        </p>
      ) : null}

      {/* Tabla de factores por tramo de ocupación */}
      {kiln.occupancy_factors.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-600 hover:text-zinc-900">
            Factor por ocupación ({kiln.occupancy_factors.length} tramos)
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {kiln.occupancy_factors.map((tramo) => (
              <span
                key={tramo.id}
                className="rounded-xl border border-black/[0.04] bg-white/60 px-2.5 py-1 text-[10px] tabular-nums text-zinc-600 shadow-2xs"
              >
                {tramo.min_percentage}–{tramo.max_percentage} %{" "}
                <strong className="text-zinc-900 font-bold">
                  ×{formatDecimalString(tramo.factor, 2)}
                </strong>
              </span>
            ))}
          </div>
        </details>
      ) : (
        <p className="text-[11px] text-amber-700">
          Este horno no tiene tabla de factores: no podrá usarse en una quema hasta
          configurarla.
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={() => setVerHistorial((visible) => !visible)}
          className="text-xs font-semibold text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline cursor-pointer"
        >
          {verHistorial ? "Ocultar historial de tarifas" : "Ver historial de tarifas"}
        </button>
        {verHistorial ? (
          <div className="mt-2">
            <HistorialTarifas kilnId={kiln.id} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function KilnsTab({ canEdit }: { canEdit: boolean }) {
  const [creando, setCreando] = useState(false);
  const kilns = useKilns({ limit: 200 });

  return (
    <div className="space-y-4">
      {canEdit ? (
        creando ? (
          <NuevoHorno onDone={() => setCreando(false)} />
        ) : (
          <SecondaryButton onClick={() => setCreando(true)}>+ Nuevo horno</SecondaryButton>
        )
      ) : null}

      {kilns.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-5" label="Cargando hornos…" />
        </div>
      ) : kilns.isError ? (
        <p role="alert" className="py-12 text-center text-xs text-red-600">
          {describeError(kilns.error)}
        </p>
      ) : !kilns.data?.items.length ? (
        <EmptyState message="Todavía no hay hornos registrados." />
      ) : (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {kilns.data.items.map((kiln) => (
            <FichaHorno key={kiln.id} kiln={kiln} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
