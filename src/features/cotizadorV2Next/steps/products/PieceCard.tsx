import { useId, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { createPortal } from "react-dom";

import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { DecimalField } from "@/components/DecimalField";
import { DeferredTextField } from "@/components/DeferredTextField";
import { QuantityStepper } from "./QuantityStepper";
import { formatDecimalString } from "@/features/firings/labels";
import {
  WARNING_LABEL,
  type V2QuotationProduct,
  type V2QuotationProductInput,
} from "@/types/quoterV2Materials";
import { PrimaryButton, SecondaryButton } from "@/components/form";

const AVISO_GENERICO = "Hay un aviso pendiente de revisar en esta pieza.";

function textoDeAviso(codigo: string): string {
  return WARNING_LABEL[codigo] ?? AVISO_GENERICO;
}

function formatearLitros(valorCm3: string | null | undefined): string {
  if (!valorCm3) return "—";
  const litros = Number(valorCm3) / 1000;
  if (!Number.isFinite(litros)) return "—";
  return formatDecimalString(String(litros), 2);
}

const ESCALA_TIEMPO = 1_000_000n;

function aMicrominutos(valor: string): bigint | null {
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(valor.trim())) return null;
  const [entera = "0", fraccion = ""] = valor.trim().replace(",", ".").split(".");
  return BigInt(entera) * ESCALA_TIEMPO + BigInt(fraccion.padEnd(6, "0") || "0");
}

function desdeMicrominutos(valor: bigint): string {
  const enteros = valor / ESCALA_TIEMPO;
  const fraccion = (valor % ESCALA_TIEMPO).toString().padStart(6, "0").replace(/0+$/, "");
  return fraccion ? `${enteros}.${fraccion}` : String(enteros);
}

function partesDelTiempo(valor: string | null) {
  if (!valor) return { horas: "", minutos: "" };
  const total = aMicrominutos(valor);
  if (total === null) return { horas: "", minutos: valor };
  const porHora = ESCALA_TIEMPO * 60n;
  return {
    horas: String(total / porHora),
    minutos: desdeMicrominutos((total % porHora) / 1n),
  };
}

function formatearMinutos(valor: string | null): string {
  if (valor === null) return "Sin definir";
  const micro = aMicrominutos(valor);
  if (micro === null) return `${valor} min`;
  const porHora = ESCALA_TIEMPO * 60n;
  const horas = micro / porHora;
  const minutos = micro % porHora;
  if (horas === 0n) return `${formatDecimalString(desdeMicrominutos(minutos), 2)} min`;
  return minutos === 0n
    ? `${horas} h`
    : `${horas} h ${formatDecimalString(desdeMicrominutos(minutos), 2)} min`;
}

function TiempoUnitario({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (value: string | null) => void;
}) {
  const id = useId();
  const horasRef = useRef<HTMLInputElement>(null);
  const minutosRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const partes = partesDelTiempo(value);

  const alSalir = (event: FocusEvent<HTMLFieldSetElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    const horas = horasRef.current?.value.trim() ?? "";
    const minutos = minutosRef.current?.value.trim() ?? "";
    if (horas === "" && minutos === "") {
      if (value !== null) onCommit(null);
      setError(null);
      return;
    }
    const microHoras = horas === "" ? 0n : /^\d+$/.test(horas) ? BigInt(horas) : null;
    const microMinutos = minutos === "" ? 0n : aMicrominutos(minutos);
    if (microHoras === null || microMinutos === null || microMinutos >= ESCALA_TIEMPO * 60n) {
      setError("Use horas enteras y minutos menores de 60.");
      return;
    }
    const total = microHoras * ESCALA_TIEMPO * 60n + microMinutos;
    if (total === 0n) {
      setError("El tiempo debe ser mayor que cero.");
      return;
    }
    setError(null);
    const canonico = desdeMicrominutos(total);
    if (canonico !== value) onCommit(canonico);
  };

  return (
    <fieldset onBlur={alSalir} className="sm:col-span-2">
      <legend className="mb-2 text-sm font-medium text-zinc-900">Tiempo por pieza</legend>
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${id}-horas`} className="text-xs font-medium text-zinc-700">
          Horas
          <input
            ref={horasRef}
            id={`${id}-horas`}
            key={`h-${value ?? ""}`}
            type="number"
            min="0"
            step="1"
            defaultValue={partes.horas}
            inputMode="numeric"
            className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] bg-white/70 px-3 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </label>
        <label htmlFor={`${id}-minutos`} className="text-xs font-medium text-zinc-700">
          Minutos
          <input
            ref={minutosRef}
            id={`${id}-minutos`}
            key={`m-${value ?? ""}`}
            type="number"
            min="0"
            max="59.999999"
            step="any"
            defaultValue={partes.minutos}
            inputMode="decimal"
            className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] bg-white/70 px-3 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">Se guarda en minutos. Ejemplo: 1 h y 30 min.</p>
      {error ? <p role="alert" className="mt-1 text-xs text-red-700">{error}</p> : null}
      {value !== null ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-zinc-600 underline underline-offset-2"
          onClick={() => onCommit(null)}
        >
          Quitar tiempo
        </button>
      ) : null}
    </fieldset>
  );
}

function MoldCountField({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="text-sm font-medium text-zinc-900">
      Moldes
      <input
        id={id}
        key={value}
        type="number"
        min="1"
        step="1"
        defaultValue={value}
        onBlur={(event) => {
          const text = event.currentTarget.value;
          if (!/^\d+$/.test(text)) {
            event.currentTarget.value = String(value);
            return;
          }
          const parsed = Number(text);
          if (!Number.isSafeInteger(parsed) || parsed < 1) {
            event.currentTarget.value = String(value);
            return;
          }
          if (parsed !== value) onCommit(parsed);
        }}
        className="mt-2 h-10 w-full rounded-xl border border-black/[0.08] bg-white/70 px-3 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
      />
    </label>
  );
}

export function PieceCard({
  linea,
  canEdit,
  mostrarCampos010P,
  onUpdate,
  onDelete,
}: {
  linea: V2QuotationProduct;
  canEdit: boolean;
  mostrarCampos010P: boolean;
  onUpdate: (payload: V2QuotationProductInput) => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const cantidadId = useId();

  const isCatalog = linea.product_id !== null;

  const renderFact = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-900">{value}</span>
    </div>
  );

  const totalVolLiters = formatearLitros(linea.total_volume_cm3);
  const unitVolLiters = formatearLitros(linea.unit_volume_cm3);
  const occPercent = linea.firing_occupancy_percent
    ? formatDecimalString(linea.firing_occupancy_percent, 2)
    : "—";

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
        <div className="mb-4">
          <h3 className="text-base font-medium text-zinc-900">{linea.product_name}</h3>
          <p className="text-sm text-zinc-500">{isCatalog ? "Del catálogo" : "Pieza a medida"}</p>
        </div>

        {linea.warnings && linea.warnings.length > 0 && (
          <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <ul className="list-inside list-disc">
              {linea.warnings.map((w, i) => (
                <li key={i}>{textoDeAviso(w)}</li>
              ))}
            </ul>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col sm:col-span-4">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Cantidad</dt>
            <dd className="text-sm text-zinc-900">{linea.quantity}</dd>
          </div>

          {linea.client_observation && (
            <div className="col-span-2 flex flex-col sm:col-span-4">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Nota para el cliente</dt>
              <dd className="text-sm text-zinc-900">{linea.client_observation}</dd>
            </div>
          )}

          <div className="col-span-2 flex flex-col sm:col-span-4">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Medidas</dt>
            <dd className="text-sm text-zinc-900">
              {linea.length_cm ? `${formatDecimalString(linea.length_cm, 1)} L` : "— L"} ×{" "}
              {linea.width_cm ? `${formatDecimalString(linea.width_cm, 1)} A` : "— A"} ×{" "}
              {linea.height_cm ? `${formatDecimalString(linea.height_cm, 1)} H` : "— H"} cm
            </dd>
          </div>

          {renderFact("Ocupa en el horno", totalVolLiters !== "—" ? `${totalVolLiters} litros` : "—")}
          {renderFact("Cada una", unitVolLiters !== "—" ? `${unitVolLiters} litros` : "—")}
          {renderFact("% del horno", occPercent !== "—" ? `${occPercent} %` : "—")}
          {mostrarCampos010P ? <>
            {renderFact("Tiempo por pieza", formatearMinutos(linea.production_time_per_unit_minutes))}
            {renderFact("Moldes", String(linea.mold_count))}
            {renderFact("Ciclos", String(linea.cycles))}
            {renderFact("Tiempo activo de esta línea", linea.line_active_minutes ? formatearMinutos(linea.line_active_minutes) : "—")}
          </> : null}
        </dl>
      </div>
    );
  }

  return (
    <div className="group relative rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-medium text-zinc-900">{linea.product_name}</h3>
          <p className="text-sm text-zinc-500">{isCatalog ? "Del catálogo" : "Pieza a medida"}</p>
        </div>

        {mostrarCampos010P ? <>
          <TiempoUnitario
            key={`tiempo-${linea.production_time_per_unit_minutes ?? "sin-definir"}`}
            value={linea.production_time_per_unit_minutes}
            onCommit={(val) => onUpdate({ production_time_per_unit_minutes: val })}
          />
          <MoldCountField
            value={linea.mold_count}
            onCommit={(val) => onUpdate({ mold_count: val })}
          />
        </> : null}
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          aria-label={`Quitar ${linea.product_name ?? "pieza sin nombre"}`}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600"
        >
          Quitar
        </button>
      </div>

      {linea.warnings && linea.warnings.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <ul className="list-inside list-disc">
            {linea.warnings.map((w, i) => (
              <li key={i}>{textoDeAviso(w)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={cantidadId} className="mb-2 block text-sm font-medium text-zinc-900">
            Cantidad
          </label>
          <QuantityStepper
            inputId={cantidadId}
            value={linea.quantity}
            onSave={(val) => onUpdate({ quantity: val })}
          />
        </div>

        {!isCatalog && (
          <div className="sm:col-span-2">
            <DeferredTextField
              label="Nombre de la pieza"
              value={linea.product_name ?? ""}
              onCommit={(val) => onUpdate({ product_name: val })}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <DeferredTextField
            label="Nota para el cliente"
            placeholder="Sale en el PDF junto a esta pieza."
            value={linea.client_observation ?? ""}
            onCommit={(val) => onUpdate({ client_observation: val || null })}
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 block text-sm font-medium text-zinc-900">Medidas de una pieza</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DecimalField
              label="Largo"
              value={linea.length_cm}
              sufijo="cm"
              onCommit={(val) => onUpdate({ length_cm: val })}
            />
            <DecimalField
              label="Ancho"
              value={linea.width_cm}
              sufijo="cm"
              onCommit={(val) => onUpdate({ width_cm: val })}
            />
            <DecimalField
              label="Alto"
              value={linea.height_cm}
              sufijo="cm"
              onCommit={(val) => onUpdate({ height_cm: val })}
            />
          </div>
        </fieldset>
      </div>

      <div className="mt-6 border-t border-black/[0.06] pt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {renderFact("Ocupa en el horno", totalVolLiters !== "—" ? `${totalVolLiters} litros` : "—")}
          {renderFact("Cada una", unitVolLiters !== "—" ? `${unitVolLiters} litros` : "—")}
          {renderFact("% del horno", occPercent !== "—" ? `${occPercent} %` : "—")}
          {mostrarCampos010P ? <>
            {renderFact("Ciclos (backend)", String(linea.cycles))}
            {renderFact("Tiempo activo de la línea", linea.line_active_minutes ? formatearMinutos(linea.line_active_minutes) : "—")}
          </> : null}
        </div>
      </div>

      {showDelete && (
        <DeleteConfirmDialog
          onConfirm={() => {
            setShowDelete(false);
            onDelete();
          }}
          onClose={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}

function DeleteConfirmDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useDialogoAccesible<HTMLDivElement>(true);
  const titleId = useId();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-xl"
        tabIndex={-1}
      >
        <h2 id={titleId} className="mb-4 text-lg font-medium text-zinc-900">
          ¿Quitar pieza?
        </h2>
        <p className="mb-6 text-sm text-zinc-600">
          Se quitará la pieza de la cotización. Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <SecondaryButton type="button" onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-600"
          >
            Quitar pieza
          </PrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
