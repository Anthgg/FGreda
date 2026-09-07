import { useCallback, useEffect, useRef, useState } from "react";
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
import { PrototypeOrderContext } from "@/features/production/PrototypeOrderContext";
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

/** Que se fabrica en esta orden, en una linea. */
function queSeFabrica(data: ProductionOrder): string {
  if (data.lines.length === 0) return "—";
  if (data.lines.length === 1) return data.lines[0]!.product_name;
  return `${data.lines.length} productos`;
}

/**
 * Cuantas piezas salen de la orden.
 *
 * Sumar cuenta de piezas no es calcular dinero: cada cantidad viene del
 * backend y aqui solo se dice cuantas cosas hay en total. Ningun importe pasa
 * por esta funcion.
 */
function cuantasPiezas(data: ProductionOrder): string {
  const total = data.lines.reduce(
    (suma, linea) => suma + (linea.quantity ?? 0),
    0,
  );
  if (total === 0) return "—";
  return `${total} ${total === 1 ? "pieza" : "piezas"}`;
}

function Dato({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
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
      {faltante ? (
        <p className="mt-0.5 text-[11px] tabular-nums text-amber-800">
          {faltante}
        </p>
      ) : null}
      {detalle ? (
        <p className="mt-0.5 text-[11px] text-amber-800/90">{detalle}</p>
      ) : null}
    </li>
  );
}

/**
 * De dónde viene la orden, escrito con códigos.
 *
 * El origen lo dice el backend en un campo propio. Deducirlo de qué campo venga
 * relleno convertiría una regla del dominio en una heurística de pantalla, y
 * las dos acabarían discrepando.
 */
function Origen({ data }: { data: ProductionOrder }) {
  if (data.origin_type === "PROTOTYPE") {
    return (
      <span>
        <span className="font-mono text-zinc-700">
          {data.prototype_quotation_code ?? "Sin cotización de prototipo"}
        </span>
        {data.prototype_code ? (
          <>
            {" · Muestra "}
            <span className="font-mono text-zinc-700">{data.prototype_code}</span>
          </>
        ) : null}
      </span>
    );
  }
  return (
    <span>
      <Link
        to={`/cotizador/${data.quotation_id}`}
        className="font-mono text-zinc-700 hover:text-black hover:underline"
      >
        {data.quotation_code}
      </Link>
      {data.quotation_customer_name ? ` · ${data.quotation_customer_name}` : ""}
    </span>
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
  const [documento, setDocumento] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [cargandoDocumento, setCargandoDocumento] = useState(false);
  // Se guarda en una ref además del estado para poder revocar la URL al
  // desmontar sin que el efecto dependa del propio documento y se reejecute.
  const urlRef = useRef<string | null>(null);

  const verDocumento = useCallback(async (): Promise<void> => {
    if (orderId === null) return;
    // Se muestra AQUÍ dentro y no con `window.open`.
    //
    // Abrir una pestaña después de un `await` ya no cuenta como gesto del
    // usuario, así que el navegador lo bloquea como si fuera un anuncio: el
    // botón parecía no hacer nada y el QR no había forma de verlo. Es el mismo
    // patrón que usa el panel de PDF del Cotizador.
    setDocumentError(null);
    setCargandoDocumento(true);
    try {
      const { blob, filename } = await fetchProductionOrderDocument(orderId);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setDocumento({ url, filename: filename ?? "orden-de-produccion.pdf" });
    } catch (error) {
      setDocumentError(describeError(error));
    } finally {
      setCargandoDocumento(false);
    }
  }, [orderId]);

  // La hoja se pide al abrir la orden, no tras un clic. Quien entra aquí
  // entra a mirar la orden, y esconder su documento detrás de un botón
  // obligaba a saber que existía. Se pide UNA vez por orden: si falla, el
  // botón de la cabecera reintenta, porque reintentar solo en bucle contra un
  // backend caído no arregla nada y llena el log.
  const pedida = useRef<number | null>(null);
  useEffect(() => {
    if (orderId === null || pedida.current === orderId) return;
    pedida.current = orderId;
    void verDocumento();
  }, [orderId, verDocumento]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  if (orderId === null)
    return <EmptyState message="La orden indicada no es válida." />;
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
  const esMuestra = data.origin_type === "PROTOTYPE";
  const generales = stockIssues(readiness.issues);
  // Se avisa sólo cuando el cobro es lo ÚNICO que falta. Si además falta
  // material, el panel de disponibilidad ya explica lo suyo y dos avisos a la
  // vez hacen que no se lea ninguno.
  //
  // Fase 009K.4: sólo en la rama de COTIZACIÓN. Una orden de muestra nace ya
  // cobrada —se crea dentro del propio cobro— y su comprobación de pago viaja
  // en la disponibilidad, así que este aviso ahí no diría nada cierto.
  const faltaCobrar =
    data.origin_type === "QUOTATION" &&
    data.status === "CREATED" &&
    readiness.ready &&
    !estaCobrada(data.quotation_payment_status);
  const enCurso = start.isPending || complete.isPending || cancel.isPending;
  const errorTransicion = start.error ?? complete.error ?? cancel.error;

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              {data.code}
            </h1>
            <Badge tone={statusTone(data.status)}>
              {describeStatus(data.status)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Orden de producción · <Origen data={data} />
          </p>
        </div>

        {/* Las acciones se fueron al lateral de la hoja, junto al documento
            sobre el que actúan. Aquí queda sólo regenerar el papel, que es lo
            único que no cambia el estado de nada. */}
        <SecondaryButton
          type="button"
          disabled={cargandoDocumento}
          onClick={() => void verDocumento()}
        >
          {cargandoDocumento ? "Generando…" : "Actualizar hoja"}
        </SecondaryButton>
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
          <h2 className="text-sm font-semibold text-amber-900">
            Cotización pendiente de pago
          </h2>
          <p className="mt-2 text-xs text-amber-800">
            La cotización debe estar pagada para iniciar la producción. Hay
            material y la orden está lista; sólo falta registrar el cobro.
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
          <h2 className="text-sm font-semibold text-zinc-900">
            Disponibilidad
          </h2>
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
                    <IssueRow
                      key={`${issue.code}-${issue.prepared_product_id}-${index}`}
                      issue={issue}
                    />
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {/* La hoja de taller, con el estado de la orden al lado. Misma forma
          que el paso PDF del Cotizador: el papel a la izquierda y lo que hay
          que decidir a la derecha, siempre a la vista.

          Lo que NO lleva son importes. Una orden de produccion no es un
          documento comercial, y poner el precio de venta delante de quien
          fabrica no le ayuda a fabricar. */}
      <div className="grid gap-4 lg:grid-cols-12">
        <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Hoja de taller
              </h2>
              <p className="text-xs text-zinc-500">
                El QR de arriba a la derecha abre esta orden al escanearlo.
              </p>
            </div>
            {documento ? (
              <div className="flex gap-2">
                {/* Estos dos SI pueden abrir y descargar: actuan sobre un blob
                    que ya esta en memoria, asi que son un gesto directo del
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
            ) : null}
          </div>
          {documento ? (
            <iframe
              // Sin la barra nativa del visor, igual que el Cotizador y
              // el Cotizador de prototipos: abrir y descargar ya estan arriba.
              src={`${documento.url}#toolbar=0&navpanes=0`}
              title={`Hoja de taller ${data.code}`}
              className="h-[70vh] w-full rounded-xl border border-zinc-200 bg-white"
            />
          ) : (
            <div className="flex h-[40vh] items-center justify-center rounded-xl border border-zinc-200 bg-white/60">
              {cargandoDocumento ? (
                <Spinner className="size-5" label="Generando la hoja…" />
              ) : (
                <p className="px-6 text-center text-xs text-zinc-500">
                  La hoja no se pudo generar. Usa «Actualizar hoja» para
                  reintentar.
                </p>
              )}
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
                  {data.code}
                </h3>
              </div>
              <Badge tone={statusTone(data.status)}>
                {describeStatus(data.status)}
              </Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] uppercase text-zinc-400">Producto</p>
                <p className="font-semibold text-zinc-900">
                  {queSeFabrica(data)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-400">Cantidad</p>
                <p className="font-semibold text-zinc-900">
                  {cuantasPiezas(data)}
                </p>
              </div>
              {data.origin_type === "PROTOTYPE" ? (
                <>
                  <div>
                    <p className="text-[10px] uppercase text-zinc-400">Origen</p>
                    <p className="font-mono font-medium text-zinc-800">
                      {data.prototype_quotation_code ?? "Sin cotización de prototipo"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-zinc-400">Muestra</p>
                    <p className="font-mono font-medium text-zinc-800">
                      {data.prototype_code ?? "—"}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-[10px] uppercase text-zinc-400">
                    Cotización
                  </p>
                  <p className="font-medium text-zinc-800">
                    <Link
                      to={`/cotizador/${data.quotation_id}`}
                      className="font-mono hover:text-black hover:underline"
                    >
                      {data.quotation_code}
                    </Link>
                    {" · "}
                    {estaCobrada(data.quotation_payment_status) ? (
                      <span className="text-emerald-700">Pagada</span>
                    ) : (
                      <span className="text-amber-700">Pendiente de pago</span>
                    )}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase text-zinc-400">
                  Almacén de salida
                </p>
                <p className="font-medium text-zinc-800">
                  {data.stock_location_name}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {puede.arrancarProduccion &&
              canStart(
                data.status,
                readiness.ready,
                data.quotation_payment_status,
                data.origin_type,
              ) ? (
                <PrimaryButton
                  type="button"
                  className="w-full"
                  disabled={enCurso}
                  onClick={() => start.mutate(data.id)}
                >
                  {start.isPending ? "Arrancando…" : "Arrancar producción"}
                </PrimaryButton>
              ) : null}
              {puede.completarProduccion && canComplete(data.status) ? (
                <PrimaryButton
                  type="button"
                  className="w-full"
                  disabled={enCurso}
                  onClick={() => complete.mutate(data.id)}
                >
                  {complete.isPending ? "Cerrando…" : "Marcar completada"}
                </PrimaryButton>
              ) : null}
              {puede.anularProduccion && canCancel(data.status) ? (
                <SecondaryButton
                  type="button"
                  className="w-full"
                  disabled={enCurso}
                  onClick={() => cancel.mutate(data.id)}
                >
                  Anular orden
                </SecondaryButton>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">
          Piezas a fabricar
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Medidas</th>
                <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                {/* Una muestra no tiene receta ni material preparado, y su
                    material se enseña entero en su propia sección. Dejar aquí
                    dos columnas con guiones haría parecer que faltan datos. */}
                {esMuestra ? null : (
                  <>
                    <th className="px-4 py-3 font-semibold">Material preparado</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Requerido
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.lines.map((line) => {
                const problemas = issuesForLine(readiness.issues, line.id);
                return (
                  <tr key={line.id} className="align-top hover:bg-zinc-50/70">
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900">
                        {line.product_name}
                      </span>
                      <span className="block font-mono text-[10px] text-zinc-400">
                        {line.product_internal_reference}
                      </span>
                      {problemas.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {problemas.map((issue) => (
                            <li
                              key={issue.code}
                              className="text-[11px] text-amber-700"
                            >
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
                    {esMuestra ? null : (
                      <>
                        <td className="px-4 py-3">
                          {line.prepared_product_name ? (
                            <>
                              <span className="text-zinc-900">
                                {line.prepared_product_name}
                              </span>
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
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Material, evaluación e iteraciones de la muestra. Van DENTRO de esta
          ficha y no en una pantalla aparte: la ejecución física es una sola, y
          mandar a la gente a otro sitio recrearía el segundo flujo que 009K.4
          elimina. */}
      {esMuestra && data.prototype_id !== null ? (
        <PrototypeOrderContext prototypeId={data.prototype_id} />
      ) : null}
    </div>
  );
}
