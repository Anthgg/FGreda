/**
 * Captura de una hoja de quema: sesiones de horno, piezas y resumen.
 *
 * El resumen no lo calcula esta pantalla. Se pide a `/firings/calculate` con un
 * retardo corto y se muestra lo que responde el servidor. Reimplementar aqui el
 * reparto o el factor crearia una segunda verdad que tarde o temprano diverge
 * de la primera.
 */

import { useEffect, useMemo, useState } from "react";

import { SecondaryButton, SelectField, TextAreaField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import {
  aPayload,
  hornosDeLaHoja,
  hornosDeSesion,
  nuevaLinea,
  sessionKey,
  type FiringDraft,
  type LineDraft,
} from "@/features/firings/draft";
import {
  FIRING_TYPE_LABEL,
  FIRING_TYPE_OPTIONS,
  formatDecimalString,
  formatPercentage,
  multiplyDecimalStrings,
} from "@/features/firings/labels";
import { useFiringPreview } from "@/features/firings/useFirings";
import type { FiringCalculateOut, FiringType, KilnOut } from "@/types/firings";

const PREVIEW_DEBOUNCE_MS = 400;

const SIN_HORNO = "";

interface FiringEditorProps {
  kilns: KilnOut[];
  value: FiringDraft;
  onChange: (draft: FiringDraft) => void;
  /** Resultado de la vista previa, para que el contenedor pueda usarlo. */
  onPreview?: ((preview: FiringCalculateOut | null) => void) | undefined;
  /** El simulador no necesita fecha ni notas. */
  showMetadata?: boolean | undefined;
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "neutral" | "accent" | "alert";
}) {
  const tones = {
    neutral: "border-zinc-200 bg-white/70",
    accent: "border-zinc-900/15 bg-zinc-50",
    alert: "border-red-200 bg-red-50",
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-zinc-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function FiringEditor({
  kilns,
  value,
  onChange,
  onPreview,
  showMetadata = true,
}: FiringEditorProps) {
  const [nuevoHorno, setNuevoHorno] = useState<string>(SIN_HORNO);
  const [nuevoTipo, setNuevoTipo] = useState<FiringType>("LOW");

  const payload = useMemo(() => aPayload(value), [value]);
  const [payloadDebounced, setPayloadDebounced] = useState(payload);

  useEffect(() => {
    const timer = setTimeout(() => setPayloadDebounced(payload), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [payload]);

  const preview = useFiringPreview(payloadDebounced);

  useEffect(() => {
    onPreview?.(preview.data ?? null);
  }, [preview.data, onPreview]);

  const opcionesHorno = kilns.map((kiln) => ({
    value: String(kiln.id),
    label: `${kiln.name} · ${formatDecimalString(kiln.capacity_volume_cm3, 0)} cm³`,
  }));

  const anadirSesion = () => {
    if (nuevoHorno === SIN_HORNO) return;
    const sesion = { kiln_id: Number(nuevoHorno), firing_type: nuevoTipo };
    if (value.sessions.some((s) => sessionKey(s) === sessionKey(sesion))) return;
    onChange({ ...value, sessions: [...value.sessions, sesion] });
    setNuevoHorno(SIN_HORNO);
  };

  const quitarSesion = (indice: number) => {
    const fuera = value.sessions[indice];
    if (!fuera) return;
    onChange({
      ...value,
      sessions: value.sessions.filter((_, i) => i !== indice),
      // Las piezas que apuntaban a esa sesion dejan de apuntarla.
      lines: value.lines.map((linea) => ({
        ...linea,
        low_kiln_id:
          fuera.firing_type === "LOW" && linea.low_kiln_id === fuera.kiln_id
            ? null
            : linea.low_kiln_id,
        high_kiln_id:
          fuera.firing_type === "HIGH" && linea.high_kiln_id === fuera.kiln_id
            ? null
            : linea.high_kiln_id,
        factor_kiln_id:
          linea.factor_kiln_id === fuera.kiln_id ? null : linea.factor_kiln_id,
      })),
    });
  };

  const cambiarLinea = (indice: number, cambios: Partial<LineDraft>) => {
    onChange({
      ...value,
      lines: value.lines.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)),
    });
  };

  const hornosBaja = hornosDeSesion(value, kilns, "LOW");
  const hornosAlta = hornosDeSesion(value, kilns, "HIGH");
  const hornosHoja = hornosDeLaHoja(value, kilns);

  const porLinea = new Map(preview.data?.lines.map((l) => [l.description, l]) ?? []);

  return (
    <div className="space-y-5">
      {showMetadata ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Fecha de quema"
            type="text"
            value={value.firing_date}
            onChange={(fecha) => onChange({ ...value, firing_date: fecha })}
            placeholder="AAAA-MM-DD"
            hint="Opcional mientras la hoja esté en borrador."
          />
          <TextAreaField
            label="Notas"
            value={value.notes}
            onChange={(notas) => onChange({ ...value, notes: notas })}
            rows={2}
          />
        </div>
      ) : null}

      {/* Sesiones de horno */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900">Sesiones de horno</h3>

        {value.sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">
            Añada al menos un horno y su tipo de quema. Una pieza suele pasar por una quema
            baja y otra alta, que pueden ocurrir en hornos distintos.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Horno</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-right font-semibold">Tarifa</th>
                  <th className="px-3 py-2 text-right font-semibold">Capacidad</th>
                  <th className="px-3 py-2 text-right font-semibold">Ocupación</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {value.sessions.map((sesion, indice) => {
                  const kiln = kilns.find((k) => k.id === sesion.kiln_id);
                  const tarifa =
                    sesion.firing_type === "LOW"
                      ? kiln?.current_low_rate
                      : kiln?.current_high_rate;
                  const calculada = preview.data?.sessions.find(
                    (s) => s.kiln_id === sesion.kiln_id && s.firing_type === sesion.firing_type,
                  );
                  return (
                    <tr key={sessionKey(sesion)}>
                      <td className="px-3 py-2 font-medium text-zinc-900">
                        {kiln?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2">{FIRING_TYPE_LABEL[sesion.firing_type]}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {tarifa ? (
                          formatDecimalString(tarifa, 2)
                        ) : (
                          <span className="text-red-600">Sin tarifa</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {formatDecimalString(kiln?.capacity_volume_cm3, 0)} cm³
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {calculada
                          ? formatPercentage(calculada.physical_occupancy_percentage)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => quitarSesion(indice)}
                          className="text-[11px] text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Horno"
            value={nuevoHorno}
            options={opcionesHorno}
            onChange={setNuevoHorno}
            placeholder="Seleccionar horno…"
            className="min-w-[220px] flex-1"
          />
          <SelectField
            label="Tipo de quema"
            value={nuevoTipo}
            options={FIRING_TYPE_OPTIONS}
            onChange={setNuevoTipo}
            className="w-40"
          />
          <div className="pb-0.5">
            <SecondaryButton onClick={anadirSesion} disabled={nuevoHorno === SIN_HORNO}>
              Añadir sesión
            </SecondaryButton>
          </div>
        </div>
      </section>

      {/* Piezas */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900">Piezas</h3>

        <div className="space-y-3">
          {value.lines.map((linea, indice) => {
            const calculada = porLinea.get(linea.description.trim());
            const volumenLocal = multiplyDecimalStrings(
              linea.quantity || "0",
              linea.length_cm || "0",
              linea.width_cm || "0",
              linea.height_cm || "0",
            );
            return (
              <div
                key={linea.key}
                className={[
                  "rounded-2xl border p-3",
                  calculada?.capacity_exceeded
                    ? "border-red-300 bg-red-50/50"
                    : "border-zinc-200 bg-white/60",
                ].join(" ")}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <TextField
                    label="Descripción"
                    value={linea.description}
                    onChange={(texto) => cambiarLinea(indice, { description: texto })}
                    className="col-span-2"
                  />
                  <TextField
                    label="Cantidad"
                    value={linea.quantity}
                    onChange={(texto) => cambiarLinea(indice, { quantity: texto })}
                    inputMode="numeric"
                  />
                  <TextField
                    label="Largo (cm)"
                    value={linea.length_cm}
                    onChange={(texto) => cambiarLinea(indice, { length_cm: texto })}
                    inputMode="decimal"
                  />
                  <TextField
                    label="Ancho (cm)"
                    value={linea.width_cm}
                    onChange={(texto) => cambiarLinea(indice, { width_cm: texto })}
                    inputMode="decimal"
                  />
                  <TextField
                    label="Alto (cm)"
                    value={linea.height_cm}
                    onChange={(texto) => cambiarLinea(indice, { height_cm: texto })}
                    inputMode="decimal"
                  />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SelectField
                    label="Quema baja en"
                    value={linea.low_kiln_id === null ? SIN_HORNO : String(linea.low_kiln_id)}
                    options={[
                      { value: SIN_HORNO, label: "Sin quema baja" },
                      ...hornosBaja.map((k) => ({ value: String(k.id), label: k.name })),
                    ]}
                    onChange={(texto) =>
                      cambiarLinea(indice, {
                        low_kiln_id: texto === SIN_HORNO ? null : Number(texto),
                      })
                    }
                  />
                  <SelectField
                    label="Quema alta en"
                    value={linea.high_kiln_id === null ? SIN_HORNO : String(linea.high_kiln_id)}
                    options={[
                      { value: SIN_HORNO, label: "Sin quema alta" },
                      ...hornosAlta.map((k) => ({ value: String(k.id), label: k.name })),
                    ]}
                    onChange={(texto) =>
                      cambiarLinea(indice, {
                        high_kiln_id: texto === SIN_HORNO ? null : Number(texto),
                      })
                    }
                  />
                  <SelectField
                    label="Ocupación medida en"
                    value={
                      linea.factor_kiln_id === null ? SIN_HORNO : String(linea.factor_kiln_id)
                    }
                    options={[
                      { value: SIN_HORNO, label: "Automático" },
                      ...hornosHoja.map((k) => ({ value: String(k.id), label: k.name })),
                    ]}
                    onChange={(texto) =>
                      cambiarLinea(indice, {
                        factor_kiln_id: texto === SIN_HORNO ? null : Number(texto),
                      })
                    }
                    hint="Horno cuya capacidad decide el factor."
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <span className="tabular-nums">
                    Volumen:{" "}
                    <strong className="text-zinc-700">
                      {calculada
                        ? `${formatDecimalString(calculada.total_volume_cm3, 0)} cm³`
                        : volumenLocal
                          ? `${volumenLocal} cm³`
                          : "—"}
                    </strong>
                    {calculada ? (
                      <>
                        {" · ocupación "}
                        <strong className="text-zinc-700">
                          {formatPercentage(calculada.occupancy_percentage)}
                        </strong>
                        {" · tramo "}
                        <strong className="text-zinc-700">
                          {calculada.occupancy_bracket} %
                        </strong>
                        {" · factor ×"}
                        <strong className="text-zinc-700">
                          {formatDecimalString(calculada.occupancy_factor, 2)}
                        </strong>
                        {" · costo "}
                        <strong className="text-zinc-900">
                          {formatDecimalString(calculada.allocated_cost, 2)}
                        </strong>
                      </>
                    ) : null}
                  </span>
                  {value.lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...value,
                          lines: value.lines.filter((_, i) => i !== indice),
                        })
                      }
                      className="text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline"
                    >
                      Quitar pieza
                    </button>
                  ) : null}
                </div>

                {calculada?.capacity_exceeded ? (
                  <p role="alert" className="mt-2 text-[11px] font-medium text-red-600">
                    Capacidad excedida: {formatDecimalString(calculada.total_volume_cm3, 0)} cm³
                    frente a la capacidad del horno elegido.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <SecondaryButton onClick={() => onChange({ ...value, lines: [...value.lines, nuevaLinea()] })}>
          + Agregar pieza
        </SecondaryButton>
      </section>

      {/* Resumen */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">Resumen</h3>
          {preview.isFetching ? <Spinner className="size-3" label="Calculando…" /> : null}
        </div>

        {payloadDebounced === null ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">
            Complete al menos una sesión de horno y una pieza con sus dimensiones para ver el
            costo.
          </p>
        ) : preview.isError ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
            {describeError(preview.error)}
          </p>
        ) : preview.data ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric
                label="Volumen total"
                value={`${formatDecimalString(preview.data.total_volume_cm3, 0)} cm³`}
              />
              <Metric
                label="Ocupación"
                value={formatPercentage(preview.data.occupancy_percentage)}
                hint="Sesión más cargada"
              />
              <Metric label="Costo base" value={formatDecimalString(preview.data.subtotal, 2)} />
              <Metric
                label="Factor"
                value={`×${formatDecimalString(preview.data.occupancy_factor, 4)}`}
                hint="Efectivo de la hoja"
              />
              <Metric
                label="Costo total"
                value={formatDecimalString(preview.data.total_cost, 2)}
                tone={preview.data.capacity_exceeded ? "alert" : "accent"}
              />
            </div>

            {preview.data.capacity_exceeded ? (
              <p role="alert" className="text-xs font-medium text-red-600">
                Capacidad excedida: la hoja no podrá confirmarse hasta corregir las piezas
                marcadas.
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex justify-center py-6">
            <Spinner className="size-4" label="Calculando…" />
          </div>
        )}
      </section>
    </div>
  );
}
