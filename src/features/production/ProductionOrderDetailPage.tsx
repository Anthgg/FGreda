import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchProductionOrderDocument } from "@/api/production";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { capabilitiesFor } from "@/features/auth/capabilities";
import { useSession } from "@/features/auth/useSession";
import { Badge, EmptyState } from "@/features/masters/MasterTable";
import {
  canCancel,
  canComplete,
  canStart,
  describeIssue,
  describeShortfall,
  describeStatus,
  explainIssue,
  issuesForLine,
  statusTone,
  stockIssues,
  estaCobrada,
} from "@/features/production/readiness";
import {
  useCancelProductionOrder,
  useCompleteProductionOrder,
  useProductionOrder,
  useStartProductionOrder,
} from "@/features/production/useProductionOrders";
import { describeError } from "@/features/settings/messages";
import type { ProductionOrder, ReadinessIssue } from "@/types/production";

function fechaHora(valor: string | null): string {
  if (!valor) return "—";
  return `${valor.slice(0, 10)} ${valor.slice(11, 16)}`;
}

function medidas(line: ProductionOrder["lines"][number]): string {
  const partes = [
    line.width ? `A ${line.width}` : null,
    line.height ? `H ${line.height}` : null,
    line.length ? `L ${line.length}` : null,
    line.depth ? `P ${line.depth}` : null,
  ].filter((parte): parte is string => parte !== null);
  return partes.length ? partes.join(" · ") : "—";
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

function IssueRow({ issue }: { issue: ReadinessIssue }) {
  const detalle = explainIssue(issue);
  const faltante = describeShortfall(issue);
  return (
    <li className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
      <p className="text-xs font-semibold text-amber-900">
        {describeIssue(issue)}
        {issue.prepared_product_name ? (
          <span className="font-normal"> · {issue.prepared_product_name}</span>
        ) : null}
      </p>
      {faltante ? <p className="mt-0.5 text-[11px] tabular-nums text-amber-800">{faltante}</p> : null}
      {detalle ? <p className="mt-0.5 text-[11px] text-amber-800/90">{detalle}</p> : null}
    </li>
  );
}

/**
 * Detalle de una orden de producción.
 *
 * La disponibilidad que se muestra la calcula el backend y llega en códigos;
 * aquí sólo se traduce. El navegador no rehace la cuenta de cuánto material
 * hace falta: si la rehiciera y discrepara, ganaría la versión que no consume.
 */
export function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = /^[1-9]\d*$/.test(id ?? "") ? Number(id) : null;
  const { data: user } = useSession();
  // Fase 009J. El taller arranca y completa; anular sigue siendo de quien
  // administra. La autoridad es el backend: esto solo evita ofrecer algo que
  // se sabe que va a responder 403.
  const puede = capabilitiesFor(user?.role);

  const order = useProductionOrder(orderId);
  const start = useStartProductionOrder();
  const complete = useCompleteProductionOrder();
  const cancel = useCancelProductionOrder();
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documento, setDocumento] = useState<{ url: string; filename: string } | null>(null);
  const [cargandoDocumento, setCargandoDocumento] = useState(false);
  // Se guarda en una ref además del estado para poder revocar la URL al
  // desmontar sin que el efecto dependa del propio documento y se reejecute.
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  if (orderId === null) return <EmptyState message="La orden indicada no es válida." />;
  if (order.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-5" label="Cargando la orden…" />
      </div>
    );
  }
  if (order.isError || !order.data) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700"
      >
        {describeError(order.error)}
      </p>
    );
  }

  const data = order.data;
  const { readiness } = data;
  const generales = stockIssues(readiness.issues);
  // Se avisa sólo cuando el cobro es lo ÚNICO que falta. Si además falta
  // material, el panel de disponibilidad ya explica lo suyo y dos avisos a la
  // vez hacen que no se lea ninguno.
  const faltaCobrar =
    data.status === "CREATED" && readiness.ready && !estaCobrada(data.quotation_payment_status);
  const enCurso = start.isPending || complete.isPending || cancel.isPending;
  const errorTransicion = start.error ?? complete.error ?? cancel.error;

  async function verDocumento(): Promise<void> {
    // Se muestra AQUÍ dentro y no con `window.open`.
    //
    // Abrir una pestaña después de un `await` ya no cuenta como gesto del
    // usuario, así que el navegador lo bloquea como si fuera un anuncio: el
    // botón parecía no hacer nada y el QR no había forma de verlo. Es el mismo
    // patrón que ya usa el panel de PDF del Cotizador.
    setDocumentError(null);
    setCargandoDocumento(true);
    try {
      const { blob, filename } = await fetchProductionOrderDocument(orderId!);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setDocumento({ url, filename: filename ?? "orden-de-produccion.pdf" });
    } catch (error) {
      setDocumentError(describeError(error));
    } finally {
      setCargandoDocumento(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              {data.code}
            </h1>
            <Badge tone={statusTone(data.status)}>{describeStatus(data.status)}</Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Orden de producción ·{" "}
            <Link
              to={`/cotizador/${data.quotation_id}`}
              className="font-mono text-zinc-700 hover:text-black hover:underline"
            >
              {data.quotation_code}
            </Link>
            {data.quotation_customer_name ? ` · ${data.quotation_customer_name}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton type="button" disabled={cargandoDocumento} onClick={() => void verDocumento()}>
            {cargandoDocumento ? "Generando…" : documento ? "Actualizar hoja" : "Hoja de taller (PDF)"}
          </SecondaryButton>
          {puede.arrancarProduccion && canStart(data.status, readiness.ready, data.quotation_payment_status) ? (
            <PrimaryButton
              type="button"
              disabled={enCurso}
              onClick={() => start.mutate(data.id)}
            >
              {start.isPending ? "Arrancando…" : "Arrancar producción"}
            </PrimaryButton>
          ) : null}
          {puede.completarProduccion && canComplete(data.status) ? (
            <PrimaryButton
              type="button"
              disabled={enCurso}
              onClick={() => complete.mutate(data.id)}
            >
              {complete.isPending ? "Cerrando…" : "Marcar completada"}
            </PrimaryButton>
          ) : null}
          {puede.anularProduccion && canCancel(data.status) ? (
            <SecondaryButton
              type="button"
              disabled={enCurso}
              onClick={() => cancel.mutate(data.id)}
            >
              Anular orden
            </SecondaryButton>
          ) : null}
        </div>
      </header>

      {errorTransicion ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {describeError(errorTransicion)}
        </p>
      ) : null}
      {documentError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {documentError}
        </p>
      ) : null}

      <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Almacén de salida">{data.stock_location_name}</Dato>
          <Dato label="Creada">{fechaHora(data.created_at)}</Dato>
          <Dato label="Arrancada">{fechaHora(data.started_at)}</Dato>
          <Dato label={data.cancelled_at ? "Anulada" : "Completada"}>
            {fechaHora(data.cancelled_at ?? data.completed_at)}
          </Dato>
        </dl>
      </section>

      {/* Fase 009H.1. Va ANTES de la disponibilidad porque es lo que de verdad
          impide arrancar: enseñar «hay material» sin decir que falta el cobro
          dejaría a quien está en el taller buscando un problema de almacén que
          no existe. Y dice a dónde ir, porque quien fabrica no cobra. */}
      {faltaCobrar ? (
        <section className="glass-panel rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <h2 className="text-sm font-semibold text-amber-900">Cotización pendiente de pago</h2>
          <p className="mt-2 text-xs text-amber-800">
            La cotización debe estar pagada para iniciar la producción. Hay material y la
            orden está lista; sólo falta registrar el cobro.
          </p>
          <Link
            to={`/cotizaciones/${data.quotation_id}`}
            className="mt-3 inline-flex text-xs font-medium text-amber-900 underline underline-offset-2"
          >
            Ir a {data.quotation_code} →
          </Link>
        </section>
      ) : null}

      {/* La disponibilidad sólo importa mientras la orden puede arrancar. Una
          orden ya arrancada consumió lo suyo, y seguir mostrando avisos de
          stock ahí haría pensar que le falta algo. */}
      {data.status === "CREATED" ? (
        <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <h2 className="text-sm font-semibold text-zinc-900">Disponibilidad</h2>
          {readiness.ready ? (
            <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
              Hay material para arrancar. Al hacerlo se descontará del almacén.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-zinc-500">
                Mientras quede algo pendiente, arrancar no descuenta nada.
              </p>
              {generales.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {generales.map((issue, index) => (
                    <IssueRow key={`${issue.code}-${issue.prepared_product_id}-${index}`} issue={issue} />
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {documento ? (
        <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Hoja de taller</h2>
              <p className="text-xs text-zinc-500">
                El QR de arriba a la derecha abre esta orden al escanearlo.
              </p>
            </div>
            <div className="flex gap-2">
              {/* Estos dos SÍ pueden abrir y descargar: actúan sobre un blob
                  que ya está en memoria, así que son un gesto directo del
                  usuario y el navegador no los bloquea. */}
              <a
                href={documento.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
              >
                ↗ Abrir pestaña
              </a>
              <a
                href={documento.url}
                download={documento.filename}
                className="inline-flex min-h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
              >
                ⬇ Descargar
              </a>
            </div>
          </div>
          <iframe
            src={documento.url}
            title={`Hoja de taller ${data.code}`}
            className="h-[70vh] w-full rounded-xl border border-zinc-200 bg-white"
          />
        </section>
      ) : null}

      <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Piezas a fabricar</h2>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Medidas</th>
                <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                <th className="px-4 py-3 font-semibold">Material preparado</th>
                <th className="px-4 py-3 text-right font-semibold">Requerido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.lines.map((line) => {
                const problemas = issuesForLine(readiness.issues, line.id);
                return (
                  <tr key={line.id} className="align-top hover:bg-zinc-50/70">
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900">{line.product_name}</span>
                      <span className="block font-mono text-[10px] text-zinc-400">
                        {line.product_internal_reference}
                      </span>
                      {problemas.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {problemas.map((issue) => (
                            <li key={issue.code} className="text-[11px] text-amber-700">
                              {describeIssue(issue)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{medidas(line)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {line.quantity ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {line.prepared_product_name ? (
                        <>
                          <span className="text-zinc-900">{line.prepared_product_name}</span>
                          <span className="block font-mono text-[10px] text-zinc-400">
                            {line.prepared_product_internal_reference}
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {line.required_material_quantity !== null
                        ? `${line.required_material_quantity} ${line.required_material_uom ?? ""}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
