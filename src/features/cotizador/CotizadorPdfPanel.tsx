import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { fetchDraftPdfPreview } from "@/api/quotationBuilder";
import { fetchQuotationPdf } from "@/api/quotations";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { formatMoney } from "@/features/quotations/money";
import { Badge } from "@/features/masters/MasterTable";
import type { QuotationBuilderDraftIn, QuotationBuilderOut } from "@/types/quotationBuilder";

interface CotizadorPdfPanelProps {
  draftPayload: QuotationBuilderDraftIn;
  preview?: QuotationBuilderOut | null | undefined;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  isDirty: boolean;
  canEdit: boolean;
  busy: boolean;
  cachedPdf?: { url: string; filename: string; payloadStr: string } | null;
  onPdfGenerated?: (cached: { url: string; filename: string; payloadStr: string }) => void;
  onSaveDraft: (exitAfter?: boolean) => void;
  onRequestConfirm: () => void;
}

const STATUS_LABEL = { DRAFT: "Borrador", CONFIRMED: "Confirmada", CANCELLED: "Anulada" } as const;
const STATUS_TONE = { DRAFT: "warning", CONFIRMED: "positive", CANCELLED: "neutral" } as const;
const money = (value: string | number | null | undefined, code: string | null | undefined = "PEN") =>
  formatMoney(value !== null && value !== undefined ? String(value) : "0", code);

export function CotizadorPdfPanel({
  draftPayload,
  preview,
  status,
  isDirty,
  canEdit,
  busy,
  cachedPdf,
  onPdfGenerated,
  onSaveDraft,
  onRequestConfirm,
}: CotizadorPdfPanelProps) {
  const currentPayloadStr = JSON.stringify(draftPayload);
  const isInitialStale = Boolean(
    status === "DRAFT" &&
      cachedPdf?.payloadStr &&
      cachedPdf.payloadStr !== currentPayloadStr,
  );

  const [blobUrl, setBlobUrl] = useState<string | null>(cachedPdf?.url ?? null);
  const [filename, setFilename] = useState<string>(cachedPdf?.filename ?? "cotizacion.pdf");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<boolean>(isInitialStale);

  const lastGeneratedPayloadRef = useRef<string | null>(cachedPdf?.payloadStr ?? null);

  const generatePdf = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (status === "CONFIRMED" || status === "CANCELLED") {
        if (!preview?.id) {
          throw new Error("ID de cotización no disponible");
        }
        const result = await fetchQuotationPdf(preview.id);
        const url = URL.createObjectURL(result.blob);
        const name = result.filename ?? "cotizacion.pdf";
        setBlobUrl(url);
        setFilename(name);
        setStale(false);
        onPdfGenerated?.({ url, filename: name, payloadStr: "" });
      } else {
        if (!draftPayload.items || draftPayload.items.length === 0) {
          setError("Agregue al menos un producto para generar la vista previa del documento.");
          setLoading(false);
          return;
        }
        const result = await fetchDraftPdfPreview(draftPayload);
        const url = URL.createObjectURL(result.blob);
        const name = result.filename ?? "cotizacion.pdf";
        const payloadStr = JSON.stringify(draftPayload);
        setBlobUrl(url);
        setFilename(name);
        lastGeneratedPayloadRef.current = payloadStr;
        setStale(false);
        onPdfGenerated?.({ url, filename: name, payloadStr });
      }
    } catch {
      setError("No se pudo generar la vista previa. Completa los datos pendientes antes de generar el documento.");
    } finally {
      setLoading(false);
    }
  }, [draftPayload, onPdfGenerated, preview?.id, status]);

  const prevStatusRef = useRef<string>(status);

  // Si no hay cache, o si cambio de estado/id, generar
  useEffect(() => {
    const statusChanged = prevStatusRef.current !== status;
    prevStatusRef.current = status;

    if (!blobUrl || statusChanged || (status !== "DRAFT" && !lastGeneratedPayloadRef.current)) {
      void generatePdf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.id, status]);

  // Detectar si el borrador cambio respecto al payload generado
  useEffect(() => {
    if (status === "DRAFT" && blobUrl && lastGeneratedPayloadRef.current) {
      if (lastGeneratedPayloadRef.current !== currentPayloadStr) {
        setStale(true);
      } else {
        setStale(false);
      }
    }
  }, [currentPayloadStr, status, blobUrl]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  // El CODIGO manda; el simbolo es presentacion y lo resuelve el formatter.
  const currency = preview?.currency_code_snapshot ?? "PEN";
  const itemCount = preview?.items?.length ?? draftPayload.items?.length ?? 0;

  return (
    <div className="space-y-4">
      {stale && status === "DRAFT" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">⚠️</span>
            <span>Vista previa desactualizada debido a cambios recientes en la cotización.</span>
          </div>
          <SecondaryButton onClick={() => void generatePdf()} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar vista previa"}
          </SecondaryButton>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Visor PDF */}
        <section
          aria-label="Vista previa del documento PDF"
          className="relative min-h-[500px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm lg:col-span-8 lg:min-h-[750px]"
        >
          {loading ? (
            <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-3 p-8 text-center text-zinc-600">
              <Spinner className="size-8 text-orange-700" label="Generando documento…" />
              <p className="text-sm font-medium">Generando vista previa del documento comercial…</p>
              <p className="text-xs text-zinc-400">Renderizando con el motor oficial de cotizaciones de BGreda.</p>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="rounded-full bg-red-100 p-3 text-red-600">
                <span className="text-2xl font-bold">✕</span>
              </div>
              <p role="alert" className="max-w-md text-sm font-medium text-red-700">
                {error}
              </p>
              <SecondaryButton onClick={() => void generatePdf()}>Reintentar</SecondaryButton>
            </div>
          ) : blobUrl ? (
            <div className="flex h-full w-full flex-col">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
                <span className="truncate font-medium">{filename}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleOpenNewTab}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                  >
                    ↗ Abrir pestaña
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
                  >
                    ⬇ Descargar
                  </button>
                </div>
              </div>
              <iframe
                src={`${blobUrl}#toolbar=0&navpanes=0`}
                title="Documento Comercial de Cotización"
                className="h-full min-h-[500px] w-full flex-1 border-0 bg-white lg:min-h-[700px]"
              />
            </div>
          ) : null}
        </section>

        {/* Panel lateral comercial */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Documento</p>
                <h3 className="font-mono text-base font-bold text-zinc-950">{preview?.code ?? "BORRADOR"}</h3>
              </div>
              <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] uppercase text-zinc-400">Cliente</p>
                <p className="font-semibold text-zinc-900">{preview?.customer_name_snapshot ?? "Cliente General"}</p>
              </div>

              {preview?.name ? (
                <div>
                  <p className="text-[10px] uppercase text-zinc-400">Referencia</p>
                  <p className="font-medium text-zinc-800">{preview.name}</p>
                </div>
              ) : null}

              <div>
                <p className="text-[10px] uppercase text-zinc-400">Productos cotizados</p>
                <p className="font-semibold text-zinc-900">{itemCount} {itemCount === 1 ? "pieza" : "piezas"}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-zinc-50 p-3.5 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal comercial:</span>
                <span className="font-medium tabular-nums">{money(preview?.commercial_subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>IGV ({preview?.tax_percentage_snapshot ?? "18"}%):</span>
                <span className="font-medium tabular-nums">{money(preview?.tax_amount, currency)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-950">
                <span>Total:</span>
                <span className="tabular-nums">{money(preview?.total_with_tax, currency)}</span>
              </div>
            </div>

            {status === "DRAFT" ? (
              <div className="space-y-3 pt-2">
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900">
                  ℹ️ <strong>Vista previa comercial:</strong> los datos mostrados corresponden a la simulación actual y son efímeros. Al confirmar, quedarán congelados en snapshots inmutables.
                </p>

                {canEdit ? (
                  <div className="space-y-2">
                    <PrimaryButton
                      type="button"
                      className="w-full"
                      disabled={busy || !preview?.complete || isDirty}
                      onClick={onRequestConfirm}
                    >
                      Confirmar cotización
                    </PrimaryButton>
                    <SecondaryButton
                      type="button"
                      className="w-full"
                      disabled={busy}
                      onClick={() => onSaveDraft(false)}
                    >
                      {busy ? "Guardando…" : "Guardar borrador"}
                    </SecondaryButton>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
                  ✓ <strong>Documento oficial congelado:</strong> esta cotización ya fue {status === "CONFIRMED" ? "confirmada" : "anulada"} y corresponde al registro legal e histórico inmutable.
                </p>

                <div className="space-y-2">
                  <PrimaryButton
                    type="button"
                    className="w-full"
                    onClick={handleDownload}
                    disabled={!blobUrl}
                  >
                    ⬇ Descargar PDF
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    className="w-full"
                    onClick={handleOpenNewTab}
                    disabled={!blobUrl}
                  >
                    ↗ Abrir en nueva pestaña
                  </SecondaryButton>
                  <Link
                    to="/cotizaciones"
                    className="flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50"
                  >
                    Ver en Cotizaciones
                  </Link>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
