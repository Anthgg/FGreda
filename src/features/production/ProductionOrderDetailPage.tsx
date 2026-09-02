import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchProductionOrderDocument } from "@/api/production";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
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
  const isAdmin = user?.role === "ADMIN";

  const order = useProductionOrder(orderId);
  const start = useStartProductionOrder();
  const complete = useCompleteProductionOrder();
  const cancel = useCancelProductionOrder();
  const [documentError, setDocumentError] = useState<string | null>(null);

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
  const enCurso = start.isPending || complete.isPending || cancel.isPending;
  const errorTransicion = start.error ?? complete.error ?? cancel.error;

  async function abrirDocumento(): Promise<void> {
    setDocumentError(null);
    try {
      const { blob } = await fetchProductionOrderDocument(orderId!);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Se libera en el siguiente ciclo: revocarla de inmediato dejaría la
      // pestaña recién abierta sin nada que mostrar.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setDocumentError(describeError(error));
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
          <SecondaryButton type="button" onClick={() => void abrirDocumento()}>
            Hoja de taller (PDF)
          </SecondaryButton>
          {isAdmin && canStart(data.status, readiness.ready) ? (
            <PrimaryButton
              type="button"
              disabled={enCurso}
              onClick={() => start.mutate(data.id)}
            >
              {start.isPending ? "Arrancando…" : "Arrancar producción"}
            </PrimaryButton>
          ) : null}
          {isAdmin && canComplete(data.status) ? (
            <PrimaryButton
              type="button"
              disabled={enCurso}
              onClick={() => complete.mutate(data.id)}
            >
              {complete.isPending ? "Cerrando…" : "Marcar completada"}
            </PrimaryButton>
          ) : null}
          {isAdmin && canCancel(data.status) ? (
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
