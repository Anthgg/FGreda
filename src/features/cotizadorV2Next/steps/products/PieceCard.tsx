import { useId, useState } from "react";
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

export function PieceCard({
  linea,
  canEdit,
  onUpdate,
  onDelete,
}: {
  linea: V2QuotationProduct;
  canEdit: boolean;
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
