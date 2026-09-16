import { useState } from "react";

import { PrimaryButton, SelectField } from "@/components/form";
import { DecimalField } from "@/components/DecimalField";
import { Spinner } from "@/components/Spinner";
import { EmptyState, Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  useAddV2Labor,
  useDeleteV2Labor,
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
  useAddV2Process,
  useAssignV2Process,
  useRemoveV2Process,
  useSetV2ProcessQuantity,
  useV2Processes,
} from "@/features/cotizadorV2/useQuoterV2Processes";
import type { V2Process } from "@/types/quoterV2Processes";
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
 * ## El orden lo manda la pieza (corrección de 010H)
 *
 * Una taza necesita torno, asa y acabado: esos PROCESOS aparecen solos al
 * añadir la pieza, con sus piezas puestas y sus horas ya calculadas, y el
 * trabajador se elige después. No hay que reconstruir a mano el proceso
 * productivo ni acordarse de que la taza lleva asa.
 *
 * Quitar un proceso, añadir uno extra o escribir otras piezas son decisiones de
 * ESTA cotización: el maestro de la pieza no cambia.
 *
 * «Personal adicional» ya no es una técnica. Es una PERSONA de más haciendo una
 * técnica real, y por eso vive en su propia sección: suma costo y no reduce el
 * plazo.
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

/**
 * Una tarea que no sale de un proceso: el personal adicional que apoya al
 * pedido. Las tareas de un proceso se editan en la fila del proceso.
 */
function Tarea({
  tarea,
  quotationId,
  canEdit,
  dentroDeProceso = false,
}: {
  tarea: V2LaborLine;
  quotationId: number;
  canEdit: boolean;
  /**
   * La tarea sale de un proceso: las piezas, el producto y el «quitar» los
   * manda la fila del proceso, y repetirlos aqui dejaria dos mandos para lo
   * mismo. Queda lo que es de la tarea: las horas acordadas y la tarifa pactada.
   */
  dentroDeProceso?: boolean;
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
        {canEdit && !dentroDeProceso ? (
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

      {/* Quién y qué técnica no se cambian aquí: hacerlo dejaría combinar a una
          persona con una técnica que no sabe hacer. Para otra técnica se quita
          el proceso y se pone el que toca. Dentro de un proceso, las piezas y
          el producto los manda la fila del proceso: dos mandos para lo mismo
          serían dos verdades. */}
      {dentroDeProceso ? null : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      )}

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
  const procesos = useV2Processes(quotationId);

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
  // Las tareas que NO salen de un proceso: el personal adicional y lo que se
  // cargo antes de que existieran los procesos. Las de un proceso se editan en
  // su fila, y repetirlas aqui seria el mismo trabajo dos veces en pantalla.
  //
  // Mientras los procesos no hayan llegado no se sabe cuales son suyas, y dar
  // por suelta una tarea que si tiene proceso la mostraria con su producto y su
  // «quitar» —justo lo que esta correccion quita de en medio—. Hasta que
  // lleguen, aqui solo va lo que se declaro personal adicional.
  const conProceso = new Set(
    (procesos.data?.items ?? []).map((proceso) => proceso.labor_id).filter((id) => id !== null),
  );
  const sueltas = procesos.isSuccess
    ? pagina.items.filter((tarea) => !conProceso.has(tarea.id))
    : pagina.items.filter((tarea) => tarea.is_additional_personnel);
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

      <Procesos quotationId={quotationId} canEdit={canEdit} tareas={pagina.items} />

      <PersonalAdicional
        quotationId={quotationId}
        canEdit={canEdit && !sinMaestros}
        tareas={sueltas}
      />

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

      </div>
    </Panel>
  );
}

/**
 * Los procesos de cada pieza, que es de donde sale el trabajo.
 *
 * Cada fila dice QUE hay que hacer, a CUANTAS piezas y CUANTAS horas son al
 * rendimiento estandar. El trabajador se elige al final, y solo entonces
 * aparece el costo: un proceso sin asignar no cuesta nada todavia.
 */
function Procesos({
  quotationId,
  canEdit,
  tareas,
}: {
  quotationId: number;
  canEdit: boolean;
  tareas: V2LaborLine[];
}) {
  const procesos = useV2Processes(quotationId);
  const productos = useV2QuotationProducts(quotationId);

  if (procesos.isPending) return <Spinner className="size-5" label="Cargando procesos..." />;
  if (procesos.isError) {
    return (
      <p role="alert" className="mt-4 text-xs text-red-600">
        {describeError(procesos.error)}
      </p>
    );
  }

  const lineas = productos.data?.items ?? [];
  const todos = procesos.data?.items ?? [];

  if (lineas.length === 0) {
    return (
      <EmptyState message="Añada primero las piezas: sus procesos aparecen solos, con sus horas ya calculadas." />
    );
  }

  return (
    <div data-testid="procesos" className="mt-4 space-y-4">
      {lineas.map((linea) => {
        const suyos = todos.filter((proceso) => proceso.v2_quotation_product_id === linea.id);
        return (
          <div key={linea.id} className="rounded-2xl border border-black/[0.06] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                {linea.product_name ?? `Línea ${linea.id}`}
              </h3>
              <span className="text-xs text-zinc-500">{linea.quantity} piezas</span>
            </div>

            {suyos.length === 0 ? (
              <p
                data-testid={`pieza-sin-procesos-${linea.id}`}
                className="mt-2 text-xs text-amber-700"
              >
                Esta pieza no tiene procesos configurados en su ficha. Añádalos aquí para esta
                cotización, o configúrelos en Configuración → Cotizador V2.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {suyos.map((proceso) => (
                  <ProcesoFila
                    key={proceso.id}
                    proceso={proceso}
                    tarea={tareas.find((una) => una.id === proceso.labor_id)}
                    quotationId={quotationId}
                    canEdit={canEdit}
                  />
                ))}
              </ul>
            )}

            {canEdit ? (
              <AgregarProceso
                quotationId={quotationId}
                lineaId={linea.id}
                yaPuestas={suyos.map((proceso) => proceso.technique_id)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ProcesoFila({
  proceso,
  tarea,
  quotationId,
  canEdit,
}: {
  proceso: V2Process;
  tarea: V2LaborLine | undefined;
  quotationId: number;
  canEdit: boolean;
}) {
  const asignar = useAssignV2Process(quotationId);
  const quitar = useRemoveV2Process(quotationId);
  const piezas = useSetV2ProcessQuantity(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);
  const trabajadores = useV2Workers(true);

  // Solo quienes tienen la tecnica habilitada en su ficha. El backend rechaza
  // igualmente a los demas; esto evita ofrecer lo que va a fallar.
  const capaces = (trabajadores.data?.items ?? []).filter((worker) =>
    worker.technique_ids.includes(proceso.technique_id),
  );

  return (
    <li className="rounded-xl border border-black/[0.04] bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900">
          {proceso.technique_name}
          {proceso.origin === "MANUAL" ? (
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
              Añadido en esta cotización
            </span>
          ) : null}
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={() => quitar.mutate(proceso.id)}
            disabled={quitar.isPending}
            title="Quita el proceso solo de esta cotización. La ficha de la pieza no cambia."
            className="text-xs font-semibold text-red-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
          >
            Quitar de esta cotización
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <DecimalField
          label="Piezas por trabajar"
          requirement="required"
          value={proceso.quantity}
          onCommit={(valor) =>
            valor !== null
              ? esperarGuardado(piezas, "proceso-editar", {
                  processId: proceso.id,
                  quantity: valor,
                })
              : undefined
          }
          disabled={!canEdit}
          hint={
            proceso.quantity_overridden
              ? "Escritas para este encargo: cambiar la cantidad de la pieza ya no las mueve."
              : `De la cantidad de la pieza. Se miden en ${proceso.technique_unit}.`
          }
        />
        <Dato
          label="Rendimiento estándar"
          value={proceso.manual_hours ? "Horas a mano" : `${proceso.standard_capacity} / jornada`}
          hint="Lo fija el catálogo de técnicas."
        />
        <Dato
          label="Horas calculadas"
          value={proceso.calculated_hours ?? "—"}
          hint={proceso.manual_hours ? "Esta técnica no las deduce del rendimiento." : undefined}
        />
        <SelectField
          label="Trabajador"
          requirement="optional"
          value={proceso.worker_id === null ? SIN_SELECCION : String(proceso.worker_id)}
          options={[
            { value: SIN_SELECCION, label: "Sin asignar" },
            ...capaces.map((worker) => ({
              value: String(worker.id),
              label: `${worker.name} (${WORKER_TYPE_LABEL[worker.worker_type]})`,
            })),
          ]}
          onChange={(valor) =>
            asignar.mutate({
              processId: proceso.id,
              workerId: valor === SIN_SELECCION ? null : Number(valor),
            })
          }
          disabled={!canEdit || asignar.isPending}
          hint={
            capaces.length === 0
              ? "Nadie tiene esta técnica habilitada en su ficha."
              : "Solo aparece quien sabe hacer esta técnica."
          }
        />
      </div>

      {tarea !== undefined ? (
        <div className="mt-3 border-t border-black/[0.04] pt-3">
          <Tarea tarea={tarea} quotationId={quotationId} canEdit={canEdit} dentroDeProceso />
        </div>
      ) : proceso.worker_id !== null ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-black/[0.04] pt-3 sm:grid-cols-3">
          <Dato label="Horas finales" value={proceso.final_hours ?? "—"} />
          <Dato label="Costo" value={proceso.labor_cost ?? "—"} />
        </dl>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          Sin trabajador todavía: este proceso aún no cuesta nada.
        </p>
      )}

      {proceso.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {proceso.warnings.map((codigo) => (
            <Aviso key={codigo} codigo={codigo} />
          ))}
        </ul>
      ) : null}

      {asignar.isError || quitar.isError || piezas.isError ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {describeError(asignar.error ?? quitar.error ?? piezas.error)}
        </p>
      ) : null}
    </li>
  );
}

/** Un proceso mas para esta pieza, solo en esta cotizacion. */
function AgregarProceso({
  quotationId,
  lineaId,
  yaPuestas,
}: {
  quotationId: number;
  lineaId: number;
  yaPuestas: number[];
}) {
  const tecnicas = useV2Techniques(true);
  const anadir = useAddV2Process(quotationId);
  const [elegida, setElegida] = useState(SIN_SELECCION);

  const disponibles = (tecnicas.data?.items ?? []).filter(
    (tecnica) => !yaPuestas.includes(tecnica.id),
  );
  if (disponibles.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-black/[0.04] pt-3">
      <SelectField
        label="Agregar proceso"
        requirement="optional"
        value={elegida}
        options={[
          { value: SIN_SELECCION, label: "Seleccionar..." },
          ...disponibles.map((tecnica) => ({ value: String(tecnica.id), label: tecnica.name })),
        ]}
        onChange={setElegida}
        className="max-w-xs"
        hint="Solo para esta cotización: la ficha de la pieza no cambia."
      />
      <PrimaryButton
        type="button"
        disabled={elegida === SIN_SELECCION || anadir.isPending}
        onClick={() =>
          anadir.mutate(
            { v2_quotation_product_id: lineaId, technique_id: Number(elegida) },
            { onSuccess: () => setElegida(SIN_SELECCION) },
          )
        }
      >
        {anadir.isPending ? "Añadiendo..." : "Agregar"}
      </PrimaryButton>
      {anadir.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(anadir.error)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Personal adicional: una PERSONA de mas, no una tecnica.
 *
 * Antes «Personal adicional» era una tecnica del catalogo, lo que mezclaba dos
 * cosas distintas: que se hace y quien lo hace. Aqui se elige a la persona, la
 * tecnica real que viene a hacer y las horas se ajustan a mano.
 */
function PersonalAdicional({
  quotationId,
  canEdit,
  tareas,
}: {
  quotationId: number;
  canEdit: boolean;
  tareas: V2LaborLine[];
}) {
  const anadir = useAddV2Labor(quotationId);
  const trabajadores = useV2Workers(true);
  const tecnicas = useV2Techniques(true);
  const productos = useV2QuotationProducts(quotationId);
  const [worker, setWorker] = useState(SIN_SELECCION);
  const [tecnica, setTecnica] = useState(SIN_SELECCION);
  const [producto, setProducto] = useState(SIN_PRODUCTO);

  const ficha = (trabajadores.data?.items ?? []).find((fila) => String(fila.id) === worker);
  const suyas = ficha
    ? (tecnicas.data?.items ?? []).filter((una) => ficha.technique_ids.includes(una.id))
    : [];

  return (
    <div data-testid="personal-adicional" className="mt-6 border-t border-black/[0.04] pt-4">
      <h3 className="text-sm font-semibold text-zinc-900">Personal adicional y apoyo</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Gente de más para el pedido. Añadir personal suma costo y no reduce el plazo: que dos
        personas tarden la mitad es una decisión, no una división.
      </p>

      {tareas.length > 0 ? (
        <div className="mt-3 space-y-4">
          {tareas.map((tarea) => (
            <Tarea key={tarea.id} tarea={tarea} quotationId={quotationId} canEdit={canEdit} />
          ))}
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
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
            onChange={(valor) => {
              setWorker(valor);
              setTecnica(SIN_SELECCION);
            }}
            className="max-w-xs"
          />
          <SelectField
            label="Técnica que viene a hacer"
            requirement="optional"
            value={tecnica}
            options={[
              { value: SIN_SELECCION, label: "Seleccionar..." },
              ...suyas.map((una) => ({ value: String(una.id), label: una.name })),
            ]}
            onChange={setTecnica}
            disabled={ficha === undefined}
            className="max-w-xs"
            hint={
              ficha !== undefined && suyas.length === 0
                ? `${ficha.name} no tiene técnicas habilitadas en su ficha.`
                : "Solo las que sabe hacer."
            }
          />
          <SelectField
            label="Producto"
            requirement="optional"
            value={producto}
            options={[
              { value: SIN_PRODUCTO, label: "Todo el pedido" },
              ...(productos.data?.items ?? []).map((linea) => ({
                value: String(linea.id),
                label: linea.product_name ?? `Línea ${linea.id}`,
              })),
            ]}
            onChange={setProducto}
            className="max-w-xs"
          />
          <PrimaryButton
            type="button"
            disabled={worker === SIN_SELECCION || tecnica === SIN_SELECCION || anadir.isPending}
            onClick={() =>
              anadir.mutate(
                {
                  worker_id: Number(worker),
                  technique_id: Number(tecnica),
                  v2_quotation_product_id: producto === SIN_PRODUCTO ? null : Number(producto),
                  is_additional_personnel: true,
                },
                {
                  onSuccess: () => {
                    setWorker(SIN_SELECCION);
                    setTecnica(SIN_SELECCION);
                  },
                },
              )
            }
          >
            {anadir.isPending ? "Añadiendo..." : "Añadir personal"}
          </PrimaryButton>
          {anadir.isError ? (
            <p role="alert" className="text-xs text-red-600">
              {describeError(anadir.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
