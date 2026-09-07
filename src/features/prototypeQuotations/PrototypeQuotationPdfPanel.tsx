/**
 * El paso del documento, con el papel a la izquierda y lo comercial al lado.
 *
 * Misma forma que el paso PDF del Cotizador de producto, y a propósito: quien
 * emite una cotización de prototipo hace el mismo gesto que quien emite una de
 * producto, y dos disposiciones distintas para el mismo gesto obligan a
 * aprender la pantalla dos veces.
 *
 * Hay una diferencia que NO se disimula. El Cotizador previsualiza borradores;
 * un CPR en borrador no tiene documento porque el backend lo bloquea
 * (`PROTOTYPE_QUOTATION_PDF_DRAFT_BLOCKED`), y eso es deliberado: el correlativo
 * se gasta al emitir. Así que el hueco de la izquierda dice esa razón en vez de
 * fingir una vista previa que no existe.
 */

import { Link } from "react-router-dom";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { formatDecimalString } from "@/features/firings/labels";
import { Badge } from "@/features/masters/MasterTable";
import { PrototypeQuotationDocument } from "@/features/prototypeQuotations/PrototypeQuotationDocument";
import type {
  PrototypeCostBreakdown,
  PrototypeQuotation,
} from "@/types/prototypeQuotations";

interface PrototypeQuotationPdfPanelProps {
  persisted: PrototypeQuotation | null;
  costing: PrototypeCostBreakdown | null;
  /** Formatea en la moneda de emisión; la resuelve la página, no este panel. */
  money: (value: string | null | undefined) => string;
  cliente: string;
  pieza: string;
  muestras: number;
  readOnly: boolean;
  busy: boolean;
  puedeEmitir: boolean;
  onGuardar: () => void;
  onEmitir: () => void;
  onCobrar: () => void;
}

const ETIQUETA = {
  DRAFT: "Borrador",
  CONFIRMED: "Emitida",
  CANCELLED: "Anulada",
} as const;
const TONO = {
  DRAFT: "warning",
  CONFIRMED: "positive",
  CANCELLED: "neutral",
} as const;

export function PrototypeQuotationPdfPanel({
  persisted,
  costing,
  money,
  cliente,
  pieza,
  muestras,
  readOnly,
  busy,
  puedeEmitir,
  onGuardar,
  onEmitir,
  onCobrar,
}: PrototypeQuotationPdfPanelProps) {
  const estado = persisted?.status ?? "DRAFT";
  const emitida = persisted !== null && estado !== "DRAFT";
  const cobrada = persisted?.payment_status === "PAID";

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <section className="lg:col-span-8">
        {emitida && persisted ? (
          // `revision` lo regenera cuando el documento cambia de estado —al
          // cobrar, al anular—, que es cuando el PDF deja de ser el mismo.
          <PrototypeQuotationDocument
            quotationId={persisted.id}
            revision={`${persisted.status}-${persisted.payment_status}-${persisted.updated_at ?? ""}`}
          />
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center lg:min-h-[620px]">
            <span aria-hidden className="text-3xl text-zinc-300">
              ✕
            </span>
            <p className="max-w-sm text-sm font-medium text-red-600">
              El documento aparece al emitir la cotización.
            </p>
            <p className="max-w-sm text-xs text-zinc-500">
              Un borrador todavía no tiene correlativo, y el número se gasta al
              emitirlo. Por eso no hay vista previa: no habría nada que numerar.
            </p>
          </div>
        )}
      </section>

      <aside className="space-y-4 lg:col-span-4">
        <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Documento
              </p>
              <h3 className="font-mono text-base font-bold text-zinc-950">
                {persisted?.code ?? "BORRADOR"}
              </h3>
            </div>
            <Badge tone={TONO[estado]}>{ETIQUETA[estado]}</Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <p className="text-[10px] uppercase text-zinc-400">Cliente</p>
              <p className="font-semibold text-zinc-900">
                {cliente || "Sin cliente asignado"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-400">Pieza</p>
              <p className="font-medium text-zinc-800">{pieza || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-400">
                Producto interno
              </p>
              <p className="font-medium text-zinc-800">
                {persisted?.product_code ? (
                  <>
                    <span className="font-mono font-semibold">
                      {persisted.product_code}
                    </span>
                    {persisted.product_name
                      ? ` · ${persisted.product_name}`
                      : null}
                  </>
                ) : (
                  "Pendiente de código interno"
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-400">
                Muestras cotizadas
              </p>
              <p className="font-semibold text-zinc-900">
                {muestras} {muestras === 1 ? "muestra" : "muestras"}
              </p>
            </div>
          </div>

          {/* Los importes son los que devolvió BGreda. Aquí no se suma nada. */}
          <div className="space-y-2 rounded-xl bg-zinc-50 p-3.5 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal comercial:</span>
              <span className="font-medium tabular-nums">
                {money(costing?.commercial_net_total)}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600">
              {/* La columna es Numeric y devuelve «18.000000». El porcentaje
                  se escribe con dos decimales, como en el resto del sistema. */}
              <span>
                IGV ({formatDecimalString(costing?.tax_percent ?? "18", 2)}%):
              </span>
              <span className="font-medium tabular-nums">
                {money(costing?.commercial_tax_total)}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-950">
              <span>Total:</span>
              <span className="tabular-nums">
                {money(costing?.commercial_gross_total)}
              </span>
            </div>
          </div>

          {!emitida ? (
            <div className="space-y-3 pt-2">
              <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900">
                ℹ️ <strong>Vista previa comercial:</strong> los importes son la
                simulación actual y son efímeros. Al emitir quedan congelados
                junto con la tasa del día.
              </p>
              {!readOnly ? (
                <div className="space-y-2">
                  <PrimaryButton
                    type="button"
                    className="w-full"
                    disabled={busy || !puedeEmitir}
                    onClick={onEmitir}
                  >
                    Emitir cotización
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    className="w-full"
                    disabled={busy}
                    onClick={onGuardar}
                  >
                    {busy ? "Guardando…" : "Guardar borrador"}
                  </SecondaryButton>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
                ✓ <strong>Documento congelado:</strong> este correlativo ya está
                emitido y no cambia aunque cambie la configuración.
              </p>
              <div className="space-y-2">
                {!cobrada && estado === "CONFIRMED" ? (
                  <PrimaryButton
                    type="button"
                    className="w-full"
                    disabled={busy}
                    onClick={onCobrar}
                  >
                    Registrar cobro
                  </PrimaryButton>
                ) : null}
                {persisted?.prototype_id ? (
                  <Link
                    to={`/prototipos/${persisted.prototype_id}`}
                    className="flex w-full items-center justify-center rounded-xl bg-black py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800"
                  >
                    Ir a producción
                  </Link>
                ) : null}
                <Link
                  to="/prototipos"
                  className="flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50"
                >
                  Ver en Prototipos
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
