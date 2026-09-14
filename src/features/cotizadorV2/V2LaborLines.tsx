import { useState } from "react";

import { PrimaryButton, SelectField } from "@/components/form";
import { DecimalField } from "@/components/DecimalField";
import { Spinner } from "@/components/Spinner";
import { EmptyState, Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  useDeleteV2Labor,
  useLoadV2WorkerTechniques,
  useSetV2Illustration,
  useSetV2Planning,
  useUpdateV2Labor,
  useV2Illustration,
  useV2Labor,
  useV2Techniques,
  useV2Workers,
} from "@/features/cotizadorV2/useQuoterV2Labor";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import { useV2QuotationProducts } from "@/features/cotizadorV2/useQuoterV2Materials";
import {
  LABOR_WARNING_LABEL,
  WORKER_TYPE_LABEL,
  type V2LaborLine,
  type V2WorkerLoad,
} from "@/types/quoterV2Labor";

const SIN_PRODUCTO = "";

/**
 * Mano de obra de una cotización V2: quién hace qué, cuánto tarda y cuánto cuesta.
 *
 * Las horas y los importes los calcula el backend. La pantalla no divide
 * cantidades entre rendimientos ni multiplica horas por tarifas: si lo hiciera
 * habría dos aritméticas —y la de aquí sería de coma flotante— y nadie sabría
 * cuál manda.
 *
 * Tres cosas que esta pantalla dice y no decide:
 *
 * - **avisa** cuando a alguien se le asignan más horas de las que caben en su
 *   jornada, y ahí se para. Si eso se resuelve con un día largo, con dos días
 *   o trayendo a alguien más lo elige quien planifica;
 * - los **días efectivos** son un campo que se rellena a mano. El sistema
 *   sugiere el mínimo y no lo impone;
 * - añadir personal **suma costo y no resta plazo**. Que dos personas tarden
 *   la mitad es una decisión, no una división.
 *
 * ## Quién hace qué (corrección de 010H)
 *
 * Se elige a la PERSONA, no la técnica. Cada trabajador tiene sus técnicas
 * habilitadas en su ficha: al elegirlo aparecen todas marcadas, se desmarcan
 * las que no tocan en este encargo y se añaden de una vez. «Quitar» borra la
 * tarea de ESTA cotización y no toca la ficha. Las piezas nacen con la
 * cantidad del producto; «todo el pedido» y las técnicas de horas manuales
 * nacen en cero, porque sumar platos y tazas no es una cantidad de nada.
 *
 * Los campos guardan al SALIR del campo. Borrar «20» para escribir «50» pasa
 * por la cadena vacía, y `Number("")` es 0: guardando al vuelo, unas horas se
 * pondrían en cero a mitad de una pulsación.
 */

const SIN_SELECCION = "";

function Aviso({ codigo }: { codigo: string }) {
  // Nunca el código crudo: un aviso nuevo del backend sin traducir se dice en palabras.
  return (
    <li className="text-xs text-amber-700">
      {LABOR_WARNING_LABEL[codigo] ?? "Hay un aviso del cálculo de mano de obra. Revise esta tarea."}
    </li>
  );
}

function Dato({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-800">{value}</dd>
      {hint ? <dd className="text-[11px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

function Tarea({
  tarea,
  quotationId,
  canEdit,
}: {
  tarea: V2LaborLine;
  quotationId: number;
  canEdit: boolean;
}) {
  const actualizar = useUpdateV2Labor(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);
  const borrar = useDeleteV2Labor(quotationId);
  const productos = useV2QuotationProducts(quotationId);

  const guardar = (cambios: Record<string, unknown>) =>
    actualizar.mutate({ laborId: tarea.id, payload: cambios });
  // Para los campos diferidos: el campo recibe el resultado de SU guardado.
  const guardarYEsperar = (cambios: Record<string, unknown>) =>
    esperarGuardado(actualizar, "tarea-editar", { laborId: tarea.id, payload: cambios });

  return (
    <div className="rounded-2xl border border-black/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">
          {tarea.worker_name} · {tarea.technique_name}
          {tarea.is_additional_personnel ? (
            <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              Personal adicional
            </span>
          ) : null}
        </h3>
        {canEdit ? (
          <button
            type="button"
            onClick={() => borrar.mutate(tarea.id)}
            disabled={borrar.isPending}
            title="Quita esta técnica solo de esta cotización. La ficha del trabajador no cambia."
            className="text-xs font-semibold text-red-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
          >
            Quitar de esta cotización
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Quién y qué técnica se deciden al CARGAR al trabajador. Cambiarlos
            aquí dejaría combinar a una persona con una técnica que no sabe
            hacer; para otra técnica se quita esta y se carga la que toca. */}
        <Dato
          label="Trabajador"
          value={`${tarea.worker_name} (${WORKER_TYPE_LABEL[tarea.worker_type]})`}
        />
        <Dato label="Técnica" value={tarea.technique_name} />
        <SelectField
          label="Producto"
          requirement="optional"
          value={
            tarea.v2_quotation_product_id === null
              ? SIN_PRODUCTO
              : String(tarea.v2_quotation_product_id)
          }
          options={[
            { value: SIN_PRODUCTO, label: "Todo el pedido" },
            ...(productos.data?.items ?? []).map((linea) => ({
              value: String(linea.id),
              label: linea.product_name ?? `Línea ${linea.id}`,
            })),
          ]}
          onChange={(valor) =>
            guardar({
              v2_quotation_product_id: valor === SIN_PRODUCTO ? null : Number(valor),
            })
          }
          disabled={!canEdit}
          hint="Sin producto: apoya al pedido entero."
        />
        <DecimalField
          label="Piezas por trabajar"
          requirement="required"
          value={tarea.quantity}
          onCommit={(valor) => guardarYEsperar({ quantity: valor })}
          disabled={!canEdit}
          hint={`Se miden en ${tarea.technique_unit}, como dice la técnica.`}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato
          label="Rendimiento estándar"
          value={`${tarea.standard_capacity} / jornada`}
          hint="Lo fija el catálogo de técnicas. No cambia por lo que se produzca."
        />
        <Dato label="Horas del estándar" value={tarea.calculated_hours} />
        <Dato
          label="Tarifa por hora"
          value={tarea.hourly_rate}
          hint={
            tarea.rate_overridden
              ? "Acordada en esta cotización"
              : `${tarea.daily_rate} por jornada de ${tarea.workday_hours} h`
          }
        />
        <Dato label="Costo" value={tarea.labor_cost} />
      </dl>

      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-black/[0.04] pt-4 sm:grid-cols-2">
        <div>
          <DecimalField
            label="Horas finales"
            requirement="required"
            value={tarea.final_hours}
            onCommit={(valor) => guardarYEsperar({ final_hours_override: valor })}
            disabled={!canEdit}
            hint={
              tarea.hours_overridden
                ? "Acordadas para este encargo. No cambian el estándar del catálogo."
                : "Salen del rendimiento estándar. Puede ajustarlas para este encargo."
            }
          />
          {/* Sin esto, acordar unas horas sería irreversible: el campo no puede
              quedar vacío —vacío no es cero— así que hace falta una forma
              explícita de devolver la decisión al rendimiento estándar. */}
          {canEdit && tarea.hours_overridden ? (
            <button
              type="button"
              onClick={() => guardar({ final_hours_override: null })}
              className="mt-2 text-xs font-semibold text-zinc-700 underline underline-offset-2 cursor-pointer"
            >
              Volver al estándar ({tarea.calculated_hours} h)
            </button>
          ) : null}
        </div>
        <DecimalField
          label="Tarifa acordada por hora"
          value={tarea.rate_overridden ? tarea.hourly_rate : ""}
          onCommit={(valor) => guardarYEsperar({ hourly_rate_override: valor })}
          disabled={!canEdit}
          hint="Solo para esta cotización. Vacío: se usa el jornal del maestro."
        />
      </div>

      {tarea.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {tarea.warnings.map((codigo) => (
            <Aviso key={codigo} codigo={codigo} />
          ))}
        </ul>
      ) : null}

      {actualizar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(actualizar.error)}
        </p>
      ) : null}
    </div>
  );
}

function CargaDeJornada({ carga }: { carga: V2WorkerLoad[] }) {
  if (carga.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-black/[0.06] p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Jornada por persona</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Las horas se suman por persona en toda la cotización: quien hace tres técnicas para el mismo
        pedido trabaja una jornada repartida, no tres.
      </p>
      <table className="mt-3 w-full text-left text-xs">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-2 pr-3 font-semibold">Persona</th>
            <th className="py-2 pr-3 font-semibold">Jornada</th>
            <th className="py-2 pr-3 font-semibold">Asignado</th>
            <th className="py-2 font-semibold">Días mínimos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {carga.map((fila) => (
            <tr key={fila.worker_id}>
              <td className="py-2 pr-3 text-zinc-800">{fila.worker_name}</td>
              <td className="py-2 pr-3 text-zinc-600">{fila.workday_hours} h</td>
              <td className="py-2 pr-3">
                <span className={fila.exceeds_workday ? "font-semibold text-amber-700" : ""}>
                  {fila.assigned_hours} h
                </span>
                {fila.exceeds_workday ? (
                  <span className="block text-[11px] text-amber-700">
                    Supera la jornada configurada
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-zinc-600">{fila.minimum_days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ilustracion({ quotationId, canEdit }: { quotationId: number; canEdit: boolean }) {
  const query = useV2Illustration(quotationId);
  const guardar = useSetV2Illustration(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  if (query.isPending) return <Spinner className="size-5" label="Cargando ilustración..." />;
  if (query.isError || !query.data) return null;
  const ilustracion = query.data;

  return (
    <div className="mt-6 rounded-2xl border border-black/[0.06] p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Ilustración</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Va aparte de las técnicas productivas: ilustrar no es tornear. Se cobra por horas, no por
        tandas: 75 piezas son 12 horas, no dos jornadas completas.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField
          label="Ilustración"
          requirement="required"
          value={ilustracion.enabled ? "SI" : "NO"}
          options={[
            { value: "NO", label: "Sin ilustración" },
            { value: "SI", label: "Con ilustración" },
          ]}
          onChange={(valor) => guardar.mutate({ illustration_enabled: valor === "SI" })}
          disabled={!canEdit}
          hint="Apagada por defecto. Al apagarla, sus horas y su costo quedan en cero."
        />
        {ilustracion.enabled ? (
          <DecimalField
            label="Piezas a ilustrar"
            requirement="required"
            value={ilustracion.quantity}
            onCommit={(valor) =>
              valor !== null
                ? esperarGuardado(guardar, "ilustracion", { illustration_quantity: valor })
                : undefined
            }
            disabled={!canEdit}
          />
        ) : null}
      </div>

      {ilustracion.enabled ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato
            label="Jornal congelado"
            value={ilustracion.daily_rate ?? "—"}
            hint="Lo que valía cuando se cotizó. Subirlo mañana no cambia este número."
          />
          <Dato label="Rendimiento" value={`${ilustracion.capacity_per_workday ?? "—"} / jornada`} />
          <Dato label="Tarifa por hora" value={ilustracion.hourly_rate ?? "—"} />
          <Dato label="Horas" value={ilustracion.hours} />
          <Dato label="Costo" value={ilustracion.cost} />
        </dl>
      ) : null}

      {guardar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(guardar.error)}
        </p>
      ) : null}
    </div>
  );
}

export function V2LaborLines({
  quotationId,
  canEdit,
}: {
  quotationId: number;
  canEdit: boolean;
}) {
  const query = useV2Labor(quotationId);
  const planificar = useSetV2Planning(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);
  const trabajadores = useV2Workers(true);
  const tecnicas = useV2Techniques(true);

  if (query.isPending) return <Spinner className="size-5" label="Cargando mano de obra..." />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        {describeError(query.error)}
      </div>
    );
  }

  const pagina = query.data;
  const sinMaestros =
    (trabajadores.data?.items ?? []).length === 0 || (tecnicas.data?.items ?? []).length === 0;

  return (
    <Panel>
      {/* El identificador acota las consultas de las pruebas a ESTE bloque, como
          en los paneles de quema y de precio: el flujo monta varios y varios
          tienen campos e importes con la misma pinta. */}
      <div data-testid="panel-mano-de-obra">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Mano de obra</h2>
        <span className="text-xs text-zinc-500">
          Costo de mano de obra: <strong>{pagina.labor_cost}</strong>
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        El costo sale del jornal de cada persona dividido entre su jornada, por las horas que hace
        falta. No hay un precio por técnica.
      </p>

      {/* Fase 010H. Sin trabajadores o sin técnicas no se puede asignar nada, y
          eso se dice ARRIBA, junto al estado vacío. Antes el aviso vivía al
          final del panel, debajo de la ilustración, y quien miraba la pantalla
          solo leía «no hay trabajo asignado» sin saber por qué ni dónde
          arreglarlo. */}
      {canEdit && sinMaestros ? (
        <p
          data-testid="mano-de-obra-sin-maestros"
          role="status"
          className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        >
          {(trabajadores.data?.items ?? []).length === 0
            ? "No hay trabajadores activos"
            : "No hay técnicas activas"}
          {(trabajadores.data?.items ?? []).length === 0 &&
          (tecnicas.data?.items ?? []).length === 0
            ? " ni técnicas activas"
            : ""}
          . Para asignar trabajo hace falta al menos uno de cada: se dan de alta en Configuración →
          Cotizador V2.
        </p>
      ) : null}

      {pagina.items.length === 0 ? (
        <EmptyState message="Todavía no hay trabajo asignado en esta cotización." />
      ) : (
        <div className="mt-4 space-y-4">
          {pagina.items.map((tarea) => (
            <Tarea key={tarea.id} tarea={tarea} quotationId={quotationId} canEdit={canEdit} />
          ))}
        </div>
      )}

      <CargaDeJornada carga={pagina.workday_load} />

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-black/[0.06] p-4 sm:grid-cols-2">
        <DecimalField
          label="Días efectivos de taller"
          value={pagina.effective_work_days === null ? "" : String(pagina.effective_work_days)}
          onCommit={(valor) =>
            esperarGuardado(planificar, "planificacion", valor === null ? null : Number(valor))
          }
          disabled={!canEdit}
          entero
          hint="Lo decide quien planifica. No es la vigencia de la cotización."
        />
        <Dato
          label="Mínimo sugerido"
          value={String(pagina.suggested_work_days)}
          hint="Los días que harían falta si nadie alargara su jornada. Es una sugerencia."
        />
      </div>

      <Ilustracion quotationId={quotationId} canEdit={canEdit} />

      {canEdit && !sinMaestros ? (
        <CargarTrabajador quotationId={quotationId} tareas={pagina.items} />
      ) : null}
      </div>
    </Panel>
  );
}

/**
 * Elegir a la persona y traer sus técnicas. Corrección de 010H.
 *
 * Aparecen TODAS sus técnicas habilitadas y activas, marcadas. Quien cotiza
 * desmarca las que no tocan y las añade de una vez: no hay que añadir técnica
 * por técnica, y tampoco hay que añadirlas todas para después quitar siete.
 * Las ya cargadas para esa persona y ese producto salen marcadas y bloqueadas:
 * el backend no las duplica y la pantalla no invita a intentarlo.
 */
function CargarTrabajador({
  quotationId,
  tareas,
}: {
  quotationId: number;
  tareas: readonly V2LaborLine[];
}) {
  const trabajadores = useV2Workers(true);
  const tecnicas = useV2Techniques(true);
  const productos = useV2QuotationProducts(quotationId);
  const cargar = useLoadV2WorkerTechniques(quotationId);
  const [worker, setWorker] = useState(SIN_SELECCION);
  const [producto, setProducto] = useState(SIN_PRODUCTO);
  const [desmarcadas, setDesmarcadas] = useState<number[]>([]);

  const ficha = (trabajadores.data?.items ?? []).find((fila) => String(fila.id) === worker);
  const suyas = ficha
    ? (tecnicas.data?.items ?? []).filter((tecnica) => ficha.technique_ids.includes(tecnica.id))
    : [];
  const productoId = producto === SIN_PRODUCTO ? null : Number(producto);
  const yaCargadas = new Set(
    tareas
      .filter(
        (tarea) =>
          ficha !== undefined &&
          tarea.worker_id === ficha.id &&
          tarea.v2_quotation_product_id === productoId,
      )
      .map((tarea) => tarea.technique_id),
  );
  const aCargar = suyas.filter(
    (tecnica) => !yaCargadas.has(tecnica.id) && !desmarcadas.includes(tecnica.id),
  );
  const linea = (productos.data?.items ?? []).find((fila) => fila.id === productoId);

  // Otro trabajador u otro producto es otro contexto: sus técnicas vuelven a
  // salir todas marcadas, sin arrastrar lo que se desmarcó para el anterior.
  const elegirTrabajador = (valor: string) => {
    setWorker(valor);
    setDesmarcadas([]);
  };
  const elegirProducto = (valor: string) => {
    setProducto(valor);
    setDesmarcadas([]);
  };

  return (
    <div data-testid="cargar-trabajador" className="mt-6 space-y-3 border-t border-black/[0.04] pt-4">
      <h3 className="text-sm font-semibold text-zinc-900">Asignar trabajo</h3>
      <p className="text-xs text-zinc-500">
        Elija a la persona: aparecen sus técnicas. Añadir personal suma costo y no reduce el plazo.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Trabajador"
          requirement="optional"
          value={worker}
          options={[
            { value: SIN_SELECCION, label: "Seleccionar..." },
            ...(trabajadores.data?.items ?? []).map((fila) => ({
              value: String(fila.id),
              label: `${fila.name} (${WORKER_TYPE_LABEL[fila.worker_type]})`,
            })),
          ]}
          onChange={elegirTrabajador}
          className="max-w-xs"
        />
        <SelectField
          label="Producto"
          requirement="optional"
          value={producto}
          options={[
            { value: SIN_PRODUCTO, label: "Todo el pedido" },
            ...(productos.data?.items ?? []).map((fila) => ({
              value: String(fila.id),
              label: fila.product_name ?? `Línea ${fila.id}`,
            })),
          ]}
          onChange={elegirProducto}
          hint={
            linea
              ? `Las piezas nacen en ${linea.quantity}, la cantidad de este producto.`
              : "Todo el pedido: las piezas nacen en cero y se ajustan a mano."
          }
          className="max-w-xs"
        />
      </div>

      {ficha ? (
        suyas.length === 0 ? (
          <p
            data-testid="trabajador-sin-tecnicas"
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          >
            {ficha.name} no tiene técnicas activas habilitadas en su ficha. Configúrelas en
            Configuración → Cotizador V2 → Trabajadores.
          </p>
        ) : (
          <fieldset data-testid="tecnicas-del-trabajador" className="rounded-xl border border-black/[0.06] p-3">
            <legend className="px-1 text-xs font-semibold text-zinc-700">
              Técnicas de {ficha.name}
            </legend>
            <ul className="space-y-1">
              {suyas.map((tecnica) => {
                const cargada = yaCargadas.has(tecnica.id);
                return (
                  <li key={tecnica.id} className="text-xs text-zinc-700">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cargada || !desmarcadas.includes(tecnica.id)}
                        disabled={cargada || cargar.isPending}
                        onChange={(evento) =>
                          setDesmarcadas(
                            evento.target.checked
                              ? desmarcadas.filter((id) => id !== tecnica.id)
                              : [...desmarcadas, tecnica.id],
                          )
                        }
                      />
                      <span className="font-medium">{tecnica.name}</span>
                      <span className="text-zinc-500">
                        {tecnica.manual_hours
                          ? "horas manuales"
                          : `${tecnica.default_capacity_per_workday} ${tecnica.unit} / jornada`}
                      </span>
                      {cargada ? <span className="text-emerald-700">(ya cargada)</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )
      ) : null}

      {ficha && suyas.length > 0 ? (
        <PrimaryButton
          type="button"
          disabled={cargar.isPending || aCargar.length === 0}
          onClick={() =>
            cargar.mutate(
              {
                worker_id: ficha.id,
                v2_quotation_product_id: productoId,
                technique_ids: aCargar.map((tecnica) => tecnica.id),
              },
              { onSuccess: () => setDesmarcadas([]) },
            )
          }
        >
          {cargar.isPending
            ? "Añadiendo..."
            : aCargar.length === 1
              ? "Añadir 1 técnica"
              : `Añadir ${aCargar.length} técnicas`}
        </PrimaryButton>
      ) : null}

      {cargar.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(cargar.error)}
        </p>
      ) : null}
    </div>
  );
}
