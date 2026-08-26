/**
 * Captura de una hoja de quema: sesiones de horno, piezas y resumen.
 *
 * El resumen no lo calcula esta pantalla. Se pide a `/firings/calculate` con un
 * retardo corto y se muestra lo que responde el servidor. Reimplementar aqui el
 * reparto o el factor crearia una segunda verdad que tarde o temprano diverge
 * de la primera.
 */

import { useEffect, useMemo, useState } from "react";

import {
  DatePickerField,
  ProductSelectField,
  SecondaryButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/form";


import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/useSession";
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
import { NuevaPiezaModal } from "@/features/masters/NuevaPiezaModal";
import { FIRING_PIECE_PRODUCT_TYPES } from "@/features/firings/pieceTypes";
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
    neutral: "border-black/[0.04] bg-white/40 text-zinc-900",
    accent: "border-black bg-black text-white",
    alert: "border-red-200/60 bg-red-50/80 text-red-900",
  };
  const labelTones = {
    neutral: "text-zinc-400",
    accent: "text-white/70",
    alert: "text-red-700/80",
  };
  const valueTones = {
    neutral: "text-zinc-900",
    accent: "text-white",
    alert: "text-red-900",
  };
  return (
    <div className={`rounded-2xl border p-3.5 shadow-2xs ${tones[tone]}`}>
      <p className={`text-[10px] uppercase tracking-wider font-semibold ${labelTones[tone]}`}>{label}</p>
      <p className={`mt-0.5 truncate text-base font-bold tabular-nums ${valueTones[tone]}`}>{value}</p>
      {hint ? <p className={`mt-0.5 text-[10px] ${labelTones[tone]}`}>{hint}</p> : null}
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
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [nuevoHorno, setNuevoHorno] = useState<string>(SIN_HORNO);
  const [nuevoTipo, setNuevoTipo] = useState<FiringType>("LOW");
  const [creandoPieza, setCreandoPieza] = useState<{
    lineIndex: number;
    initialName: string;
  } | null>(null);

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
    const restantes = value.sessions.filter((_, i) => i !== indice);
    const hornosRestantes = new Set(restantes.map((s) => s.kiln_id));
    onChange({
      ...value,
      sessions: restantes,
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
          linea.factor_kiln_id !== null && !hornosRestantes.has(linea.factor_kiln_id)
            ? null
            : linea.factor_kiln_id,
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

  const porIndice = new Map(preview.data?.lines.map((l) => [l.sort_order, l]) ?? []);

  return (
    <div className="space-y-6 sm:space-y-8">
      {showMetadata ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-6">
          <div className="col-span-1">
            <DatePickerField
              label="Fecha de quema"
              value={value.firing_date}
              onChange={(fecha) => onChange({ ...value, firing_date: fecha })}
              placeholder="DD/MM/AAAA"
              hint="Opcional mientras la hoja esté en borrador."
            />
          </div>
          <div className="col-span-1 md:col-span-2">

            <TextAreaField
              label="Notas"
              value={value.notes}
              onChange={(notas) => onChange({ ...value, notes: notas })}
              rows={2}
              placeholder="Añadir observaciones adicionales..."
            />
          </div>
        </div>
      ) : null}

      <hr className="border-zinc-200/60" />

      {/* Sesiones de horno */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Sesiones de horno
          </h3>
        </div>

        <div className="bg-blue-50/60 border border-blue-200/60 rounded-2xl p-4 flex items-start text-xs text-blue-900 gap-3">
          <svg
            className="size-5 text-blue-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>
            Añada al menos un horno y su tipo de quema. Una pieza suele pasar por una quema
            baja y otra alta, que pueden ocurrir en hornos distintos.
          </p>
        </div>

        {value.sessions.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-black/[0.04] bg-white/40 shadow-2xs">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-black/[0.04] bg-black/[0.02] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5">Horno</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5 text-right">Tarifa</th>
                  <th className="px-4 py-2.5 text-right">Capacidad</th>
                  <th className="px-4 py-2.5 text-right">Ocupación</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
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
                    <tr key={sessionKey(sesion)} className="hover:bg-white/60 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-zinc-900">
                        {kiln?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">{FIRING_TYPE_LABEL[sesion.firing_type]}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {tarifa ? (
                          formatDecimalString(tarifa, 2)
                        ) : (
                          <span className="text-red-600 font-normal">Sin tarifa</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                        {formatDecimalString(kiln?.capacity_volume_cm3, 0)} cm³
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                        {calculada
                          ? formatPercentage(calculada.physical_occupancy_percentage)
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => quitarSesion(indice)}
                          className="text-[11px] font-medium text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline cursor-pointer"
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
        ) : null}

        <div className="flex flex-wrap md:flex-nowrap items-end gap-3 rounded-2xl border border-black/[0.04] bg-white/50 p-4 shadow-2xs">
          <div className="flex-1 min-w-[200px]">
            <SelectField
              label="Horno"
              value={nuevoHorno}
              options={opcionesHorno}
              onChange={setNuevoHorno}
              placeholder="Seleccionar horno…"
            />
          </div>
          <div className="w-full md:w-48">
            <SelectField
              label="Tipo de quema"
              value={nuevoTipo}
              options={FIRING_TYPE_OPTIONS}
              onChange={setNuevoTipo}
            />
          </div>
          <div className="pb-0.5">
            <SecondaryButton
              onClick={anadirSesion}
              disabled={nuevoHorno === SIN_HORNO}
            >
              Añadir sesión
            </SecondaryButton>
          </div>
        </div>
      </section>

      {/* Piezas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
            Piezas
          </h3>
        </div>

        <div className="space-y-4">
          {value.lines.map((linea, indice) => {
            const calculada = porIndice.get(indice);
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
                  "rounded-3xl border p-5 shadow-xs relative space-y-4 transition-colors backdrop-blur-md",
                  calculada?.capacity_exceeded
                    ? "border-red-300 bg-red-50/40"
                    : "border-white/60 bg-white/60",
                ].join(" ")}
              >
                {/* Fila 1: Pieza, Cantidad y Dimensiones */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-5">
                    <ProductSelectField
                      label="Pieza"
                      value={linea.product_id === null ? "" : String(linea.product_id)}
                      selectedLabel={
                        linea.product_internal_reference && linea.description
                          ? `${linea.product_internal_reference} · ${linea.description}`
                          : linea.description || undefined
                      }
                      onChange={(valor, product) =>
                        cambiarLinea(indice, {
                          product_id: valor === "" ? null : Number(valor),
                          product_internal_reference: product ? product.internal_reference : null,
                          description: product ? product.name : "",
                        })
                      }
                      productTypes={FIRING_PIECE_PRODUCT_TYPES}
                      placeholder="Seleccionar pieza…"
                      searchPlaceholder="Buscar por nombre o referencia (ej. Plato, LAB50…)"
                      allowCreate={isAdmin}
                      onCreateRequested={(searchText) =>
                        setCreandoPieza({ lineIndex: indice, initialName: searchText })
                      }
                      createLabel={(searchText) => `+ Crear pieza "${searchText}"`}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <TextField
                      label="Cantidad"
                      value={linea.quantity}
                      onChange={(texto) => cambiarLinea(indice, { quantity: texto })}
                      inputMode="numeric"
                    />
                  </div>

                  <div className="lg:col-span-5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Dimensiones (cm)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={linea.length_cm}
                          onChange={(e) => cambiarLinea(indice, { length_cm: e.target.value })}
                          placeholder="Largo"
                          inputMode="decimal"
                          className="input-glass w-full h-10 pl-7 pr-2 rounded-xl text-xs sm:text-sm text-zinc-900 font-medium"
                        />
                        <span className="absolute left-2.5 top-2.5 text-xs font-bold text-zinc-400 select-none">
                          L
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={linea.width_cm}
                          onChange={(e) => cambiarLinea(indice, { width_cm: e.target.value })}
                          placeholder="Ancho"
                          inputMode="decimal"
                          className="input-glass w-full h-10 pl-7 pr-2 rounded-xl text-xs sm:text-sm text-zinc-900 font-medium"
                        />
                        <span className="absolute left-2.5 top-2.5 text-xs font-bold text-zinc-400 select-none">
                          A
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={linea.height_cm}
                          onChange={(e) => cambiarLinea(indice, { height_cm: e.target.value })}
                          placeholder="Alto"
                          inputMode="decimal"
                          className="input-glass w-full h-10 pl-7 pr-2 rounded-xl text-xs sm:text-sm text-zinc-900 font-medium"
                        />
                        <span className="absolute left-2.5 top-2.5 text-xs font-bold text-zinc-400 select-none">
                          H
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fila 2: Configuración de Quema */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-white/40 p-4 rounded-2xl border border-black/[0.04]">
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
                  <div>
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
                </div>

                {/* Fila 3: Métricas y acciones */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 pt-1 border-t border-black/[0.04]">
                  <span className="tabular-nums">
                    Volumen:{" "}
                    <strong className="text-zinc-800">
                      {calculada
                        ? `${formatDecimalString(calculada.total_volume_cm3, 0)} cm³`
                        : volumenLocal
                          ? `${volumenLocal} cm³`
                          : "—"}
                    </strong>
                    {calculada ? (
                      <>
                        {" · ocupación "}
                        <strong className="text-zinc-800">
                          {formatPercentage(calculada.occupancy_percentage)}
                        </strong>
                        {" · tramo "}
                        <strong className="text-zinc-800">
                          {calculada.occupancy_bracket} %
                        </strong>
                        {" · factor ×"}
                        <strong className="text-zinc-800">
                          {formatDecimalString(calculada.occupancy_factor, 2)}
                        </strong>
                        {" · costo "}
                        <strong className="text-zinc-950 font-bold">
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
                      className="text-xs font-semibold text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline cursor-pointer"
                    >
                      Quitar pieza
                    </button>
                  ) : null}
                </div>

                {calculada?.capacity_exceeded ? (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    Capacidad excedida: {formatDecimalString(calculada.total_volume_cm3, 0)} cm³
                    frente a la capacidad del horno elegido.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <SecondaryButton
          onClick={() => onChange({ ...value, lines: [...value.lines, nuevaLinea()] })}
        >
          + Agregar pieza
        </SecondaryButton>
      </section>

      {/* Resumen */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
            Resumen
          </h3>
          {preview.isFetching ? <Spinner className="size-3" label="Calculando…" /> : null}
        </div>

        {payloadDebounced === null ? (
          <div className="rounded-2xl border border-dashed border-black/[0.1] p-6 text-center text-xs text-zinc-400 bg-white/30">
            Complete al menos una sesión de horno y una pieza con sus dimensiones para ver el
            costo estimado.
          </div>
        ) : preview.isError ? (
          <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-xs text-red-700">
            {describeError(preview.error)}
          </p>
        ) : preview.data ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
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
                label="Quema sin IGV"
                value={`${preview.data.currency_symbol} ${formatDecimalString(preview.data.total_cost, 2)}`}
                tone={preview.data.capacity_exceeded ? "alert" : "accent"}
              />
              <Metric
                label={`IGV (${formatDecimalString(preview.data.tax_percentage, 2)}%)`}
                value={`${preview.data.currency_symbol} ${formatDecimalString(preview.data.tax_amount, 2)}`}
              />
              <Metric
                label="Quema con IGV"
                value={`${preview.data.currency_symbol} ${formatDecimalString(preview.data.total_with_tax, 2)}`}
                tone={preview.data.capacity_exceeded ? "alert" : "accent"}
              />
            </div>

            {preview.data.capacity_exceeded ? (
              <p role="alert" className="text-xs font-medium text-red-600">
                Capacidad excedida: la hoja no podrá confirmarse hasta corregir las piezas
                marcadas.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex justify-center py-6">
            <Spinner className="size-4" label="Calculando…" />
          </div>
        )}
      </section>

      {/* Modal de alta rápida de pieza contextual */}
      {creandoPieza !== null ? (
        <NuevaPiezaModal
          initialName={creandoPieza.initialName}
          onClose={() => setCreandoPieza(null)}
          onCreated={(nuevoProducto) => {
            cambiarLinea(creandoPieza.lineIndex, {
              product_id: nuevoProducto.id,
              product_internal_reference: nuevoProducto.internal_reference,
              description: nuevoProducto.name,
            });
          }}
        />
      ) : null}
    </div>
  );
}
