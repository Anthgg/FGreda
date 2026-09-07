import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

import { PrimaryButton, SecondaryButton, TextAreaField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { capabilitiesFor } from "@/features/auth/capabilities";
import { useSession } from "@/features/auth/useSession";
import { Alert, ApprovalBadge, StatusBadge } from "@/features/prototypes/PrototypeUi";
import { describePrototypeError } from "@/features/prototypes/prototypeLabels";
import {
  useApprovePrototype,
  useCreateFinalQuotation,
  useCancelPrototype,
  useCreatePrototypeSuccessor,
  usePrototype,
  usePrototypes,
  useRejectPrototype,
} from "@/features/prototypes/usePrototypes";
import type { Prototype, PrototypeTechnicalSpecifications } from "@/types/prototypes";

/**
 * Las secciones que quedan de una muestra HISTÓRICA. Fase 009K.4.
 *
 * Se fueron «editar» y «operacion»: editar los datos físicos y arrancar la
 * fabricación son ejecución, y la ejecución vive en la orden de producción.
 * Una muestra sin orden es una que ya se hizo, y lo hecho se lee.
 */
export type PrototypeSection = "resumen" | "materiales" | "evaluacion" | "iteraciones";

const SECTIONS: Array<{ key: PrototypeSection; label: string }> = [
  { key: "resumen", label: "Detalle" },
  { key: "materiales", label: "Materiales" },
  { key: "evaluacion", label: "Evaluación" },
  { key: "iteraciones", label: "Iteraciones" },
];

function routeFor(id: number, section: PrototypeSection) {
  return section === "resumen"
    ? `/produccion/prototipos/${id}`
    : `/produccion/prototipos/${id}/${section}`;
}


const CAMPOS_FICHA: Array<[keyof PrototypeTechnicalSpecifications, string]> = [
  ["width_cm", "Ancho cm"],
  ["height_cm", "Alto cm"],
  ["length_cm", "Largo cm"],
  ["depth_cm", "Profundidad cm"],
  ["estimated_weight_g", "Peso estimado g"],
  ["technique", "Técnica"],
  ["finish", "Esmalte / acabado"],
  ["mold", "Molde"],
  ["color", "Color"],
  ["reference", "Referencia"],
  ["responsible", "Responsable"],
  ["priority", "Prioridad"],
];

function FichaTecnica({ ficha }: { ficha: PrototypeTechnicalSpecifications }) {
  const declarados = CAMPOS_FICHA.filter(([clave]) => ficha[clave]);
  const evaluacion = ficha.evaluation ?? [];
  if (!declarados.length && !evaluacion.length && !ficha.technical_notes) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-zinc-500">Ficha técnica</p>
      {declarados.length ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {declarados.map(([clave, etiqueta]) => (
            <div key={clave}>
              <dt className="text-[11px] text-zinc-500">{etiqueta}</dt>
              <dd className="text-sm text-zinc-900">{String(ficha[clave])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {ficha.technical_notes ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{ficha.technical_notes}</p>
      ) : null}
      {evaluacion.length ? (
        <div className="mt-4">
          <p className="text-[11px] font-medium text-zinc-500">Evaluación</p>
          <ul className="mt-1 space-y-1">
            {evaluacion.map((criterio, index) => (
              <li key={`${criterio.criterion}-${index}`} className="text-sm text-zinc-800">
                {criterio.criterion}
                {criterio.result ? ` · ${criterio.result}` : ""}
                {criterio.responsible ? ` · ${criterio.responsible}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ prototype }: { prototype: Prototype }) {
  const cancel = useCancelPrototype(prototype.id);
  const { data: user } = useSession();
  const canCancel = capabilitiesFor(user?.role).anularPrototipo && prototype.status === "CREATED";
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Código" value={prototype.code} mono />
        <Info label="Cantidad de muestra" value={String(prototype.quantity)} />
        <Info label="Días objetivo" value={prototype.target_days ? String(prototype.target_days) : "No definido"} />
        <Info label="Fecha" value={prototype.requested_at.slice(0, 10)} />
        <Info label="Producto" value={prototype.product_id ? "Producto vinculado" : "Sin producto"} />
        <Info label="Cotización" value={prototype.quotation_code ?? "Sin cotización"} mono={Boolean(prototype.quotation_code)} />
        <Info label="Almacén" value={prototype.stock_location_id ? "Almacén seleccionado" : "Sin almacén"} />
        <Info label="Materiales" value={String(prototype.material_count)} />
      </div>
      {/* La ficha se PINTA desde los datos, no desde un bloque de texto. Es la
          misma estructura que lee el puente al crear la cotización final: si lo
          que se ve aquí y lo que se precarga allí salieran de sitios distintos,
          algún día dirían cosas distintas. */}
      {prototype.technical_specifications ? (
        <FichaTecnica ficha={prototype.technical_specifications} />
      ) : null}
      {/* La «Cotización» de arriba es la que PIDIÓ la muestra. Esta es la que
          NACIÓ de ella, que es la relación contraria y se lee al revés. */}
      {prototype.origin_quotations?.length ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Cotizaciones originadas por esta muestra
          </p>
          <ul className="mt-2 space-y-1">
            {prototype.origin_quotations.map((cotizacion) => (
              <li key={cotizacion.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono">{cotizacion.code}</span>
                <span className="text-xs text-zinc-500">
                  {cotizacion.status === "DRAFT" ? "Borrador" : "Historial"}
                </span>
                <Link to={`/cotizador/${cotizacion.id}`} className="text-xs text-zinc-600 hover:underline">
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {prototype.notes ? <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700"><p className="text-xs font-semibold uppercase text-zinc-500">Notas</p><p className="mt-2 whitespace-pre-wrap">{prototype.notes}</p></div> : null}
      {cancel.error ? <Alert>{describePrototypeError(cancel.error)}</Alert> : null}
      {canCancel ? <SecondaryButton className="border-red-200 text-red-700" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? "Anulando…" : "Anular prototipo"}</SecondaryButton> : null}
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-2xl border border-zinc-100 bg-white/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 text-sm font-semibold text-zinc-900 ${mono ? "font-mono" : ""}`}>{value}</p></div>;
}

/**
 * Los materiales de una muestra histórica. Sólo lectura. Fase 009K.4.
 *
 * Ya no se editan desde aquí: esta pantalla existe para las once muestras que
 * se fabricaron antes de que la orden de producción fuera el único documento
 * de ejecución. Guardar materiales sobre una de ellas cambiaría lo que dice
 * un hecho que ya ocurrió.
 */
function MaterialsReadOnly({ prototype }: { prototype: Prototype }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Materiales de la muestra</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Lista física explícita: no se dedujo de ninguna receta. Lo real lo escribió el arranque.
        </p>
      </div>
      {prototype.materials.length === 0 ? (
        <p className="text-sm text-zinc-500">Esta muestra no llegó a declarar materiales.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Material</th>
                <th className="px-4 py-3 text-right font-semibold">Previsto</th>
                <th className="px-4 py-3 text-right font-semibold">Real</th>
                <th className="px-4 py-3 font-semibold">Unidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {prototype.materials.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-zinc-900">{line.product_name}</span>
                    <span className="block font-mono text-[10px] text-zinc-400">
                      {line.product_internal_reference}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{line.quantity_planned}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {line.quantity_actual ?? <span className="text-zinc-400">No consta</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{line.uom_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EvaluationSection({ prototype }: { prototype: Prototype }) {
  const { data: user } = useSession();
  const canDecide = capabilitiesFor(user?.role).decidirPrototipo;
  const approve = useApprovePrototype(prototype.id);
  const reject = useRejectPrototype(prototype.id);
  const [note, setNote] = useState("");
  const pending = prototype.status === "COMPLETED" && prototype.approval === "PENDING";
  return <div className="space-y-5">
    <div className="flex items-center gap-3"><h2 className="font-semibold">Evaluación</h2><ApprovalBadge approval={prototype.approval} /></div>
    {prototype.status !== "COMPLETED" ? <Alert tone="amber">La evaluación estará disponible después de completar la fabricación.</Alert> : null}
    {pending && !canDecide ? <p className="text-sm text-zinc-600">La decisión corresponde a una persona administradora.</p> : null}
    {pending && canDecide ? <><TextAreaField label="Nota de evaluación" requirement="optional" value={note} onChange={setNote} /><div className="flex gap-2"><PrimaryButton type="button" disabled={approve.isPending || reject.isPending} onClick={() => approve.mutate(note)}>Aprobar</PrimaryButton><SecondaryButton className="border-red-200 text-red-700" disabled={approve.isPending || reject.isPending} onClick={() => reject.mutate(note)}>Rechazar</SecondaryButton></div></> : null}
    {approve.error ? <Alert>{describePrototypeError(approve.error)}</Alert> : null}{reject.error ? <Alert>{describePrototypeError(reject.error)}</Alert> : null}
    {approve.isSuccess ? <Alert tone="green">Prototipo aprobado. No se creó ninguna orden de producción.</Alert> : null}{reject.isSuccess ? <Alert tone="amber">Prototipo rechazado. Puede crear una nueva iteración.</Alert> : null}
    <FinalQuotationAction prototype={prototype} />
  </div>;
}

/**
 * La cotización final de una muestra aprobada.
 *
 * Es una acción explícita a propósito: aprobar una muestra dice que la pieza
 * vale, no que alguien la haya pedido. Quien decide cotizar es una persona.
 */
function FinalQuotationAction({ prototype }: { prototype: Prototype }) {
  const navigate = useNavigate();
  const { data: user } = useSession();
  // Su propia capacidad, no la de decidir la muestra: aprobar y cotizar son
  // dos permisos distintos aunque hoy los tenga el mismo rol.
  const puedeCotizar = capabilitiesFor(user?.role).cotizarDesdePrototipo;
  const crear = useCreateFinalQuotation(prototype.id);
  const aprobada = prototype.status === "COMPLETED" && prototype.approval === "APPROVED";

  if (!aprobada) return null;
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4">
    <p className="text-sm font-semibold text-zinc-900">Cotización final</p>
    <p className="mt-1 text-xs text-zinc-600">
      Se abre un borrador nuevo con lo que la muestra demostró: el producto, sus medidas y el
      material del cuerpo. La cantidad y el cliente los defines tú.
    </p>
    {puedeCotizar ? (
      <PrimaryButton
        type="button"
        className="mt-3"
        disabled={crear.isPending}
        onClick={() =>
          crear.mutate(undefined, {
            // El backend devuelve 201 si la crea y 200 si ya existía. Aquí da
            // igual: en los dos casos se abre la que devuelve, así que pulsar
            // dos veces lleva al mismo sitio en vez de dar un error.
            onSuccess: (cotizacion) => navigate(`/cotizador/${cotizacion.id}`),
          })
        }
      >
        {crear.isPending ? "Creando…" : "Crear cotización final"}
      </PrimaryButton>
    ) : (
      <p className="mt-3 text-sm text-zinc-600">Cotizar corresponde a una persona administradora.</p>
    )}
    {crear.error ? <Alert>{describePrototypeError(crear.error)}</Alert> : null}
  </div>;
}

function IterationsSection({ prototype }: { prototype: Prototype }) {
  const navigate = useNavigate();
  const successor = useCreatePrototypeSuccessor(prototype.id);
  const all = usePrototypes({ limit: 200 });
  const next = all.data?.items.find((row) => row.supersedes_prototype_id === prototype.id);
  return <div className="space-y-5">
    <div><h2 className="font-semibold">Iteraciones</h2><p className="mt-1 text-sm text-zinc-500">Cada intento conserva su historia. Una nueva iteración recibe otro código PRT.</p></div>
    {prototype.supersedes_prototype_id ? <p className="text-sm">Sustituye a: <Link className="font-mono font-semibold hover:underline" to={`/produccion/prototipos/${prototype.supersedes_prototype_id}`}>ver iteración anterior</Link></p> : <p className="text-sm text-zinc-500">Este es el primer intento.</p>}
    {next ? <p className="text-sm">Iteración posterior: <Link className="font-mono font-semibold hover:underline" to={`/produccion/prototipos/${next.id}`}>{next.code}</Link></p> : null}
    {prototype.approval === "REJECTED" && !next ? <PrimaryButton type="button" disabled={successor.isPending} onClick={() => successor.mutate(undefined, { onSuccess: (created) => navigate(`/produccion/prototipos/${created.id}`) })}>{successor.isPending ? "Creando…" : "Crear nueva iteración"}</PrimaryButton> : null}
    {successor.error ? <Alert>{describePrototypeError(successor.error)}</Alert> : null}
  </div>;
}

export function PrototypeDetailPage({ section }: { section: PrototypeSection }) {
  const params = useParams();
  const id = Number(params.id);
  const location = useLocation();
  const prototype = usePrototype(Number.isInteger(id) && id > 0 ? id : null);
  const createdCode = (location.state as { createdCode?: string } | null)?.createdCode;
  if (prototype.isPending) return <div className="flex justify-center py-20"><Spinner className="size-5" label="Cargando prototipo…" /></div>;
  if (prototype.isError || !prototype.data) return <Alert>{describePrototypeError(prototype.error)}</Alert>;
  const row = prototype.data;

  // Fase 009K.4. Si la muestra tiene orden, la ficha canónica es la de la
  // orden: ahí está el material, el arranque, la hoja de taller y la
  // evaluación. Los enlaces antiguos siguen funcionando y llevan allí.
  if (row.production_order_id) {
    return <Navigate to={`/produccion/${row.production_order_id}`} replace />;
  }

  // Sin orden: es una de las muestras anteriores a esta fase. Se lee y no se
  // toca. Y leerla NO le crea una orden: el backend tampoco lo hace.
  return <div className="mx-auto w-full max-w-6xl space-y-5">
    <header><Link to="/produccion" className="text-sm text-zinc-500 hover:underline">← Producción</Link><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold">{row.name}</h1><span className="font-mono text-sm font-bold text-zinc-500">{row.code}</span><StatusBadge status={row.status} /><ApprovalBadge approval={row.approval} /></div></header>
    {createdCode ? <Alert tone="green">Prototipo creado con código {createdCode}.</Alert> : null}
    <Alert tone="amber">
      Muestra histórica, en sólo lectura. Se fabricó antes de que la orden de producción fuera
      el único documento de ejecución, así que no tiene orden y no se le crea una ahora.
    </Alert>
    <nav aria-label="Secciones del prototipo" className="flex gap-2 overflow-x-auto pb-1">{SECTIONS.map((item) => <Link key={item.key} to={routeFor(id, item.key)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${section === item.key ? "bg-black text-white" : "border border-zinc-200 bg-white/70 text-zinc-700"}`}>{item.label}</Link>)}</nav>
    <section className="glass-panel rounded-3xl border border-white/60 p-5 shadow-sm sm:p-6">
      {section === "materiales" ? <MaterialsReadOnly prototype={row} /> : section === "evaluacion" ? <EvaluationSection prototype={row} /> : section === "iteraciones" ? <IterationsSection prototype={row} /> : <Summary prototype={row} />}
    </section>
  </div>;
}
