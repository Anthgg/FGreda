import { useState } from "react";
import type { ReactNode } from "react";

import { DecimalField } from "@/components/DecimalField";
import { PrimaryButton, SecondaryButton, SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import { formatCosto, MONEDA_BASE } from "@/features/cotizadorV2/moneda";
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
import { useV2QuotationProducts } from "@/features/cotizadorV2/useQuoterV2Materials";
import {
  useAddV2Process,
  useAssignV2Process,
  useRemoveV2Process,
  useSetV2ProcessQuantity,
  useV2Processes,
} from "@/features/cotizadorV2/useQuoterV2Processes";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import { formatDecimalString } from "@/features/firings/labels";
import { Panel } from "@/features/masters/MasterTable";
import { currencySymbol, formatMoney } from "@/features/quotations/money";
import { describeError } from "@/features/settings/messages";
import type {
  V2Illustration,
  V2IllustrationLine,
  V2LaborLine,
  V2LaborPage,
  V2Technique,
  V2Worker,
  V2WorkerLoad,
  V2WorkerType,
} from "@/types/quoterV2Labor";
import { LABOR_WARNING_LABEL, WORKER_TYPE_LABEL } from "@/types/quoterV2Labor";
import type { V2QuotationProduct } from "@/types/quoterV2Materials";
import type { V2Process } from "@/types/quoterV2Processes";

const SIN_SELECCION = "";
const TODO_EL_PEDIDO = "";

type LaborPageConAvisos = V2LaborPage & { warnings?: string[] };

function textoLinea(linea: Pick<V2QuotationProduct, "id" | "product_name">): string {
  return linea.product_name ?? `Línea ${linea.id}`;
}

function etiquetaTipoTrabajador(tipo: V2WorkerType): string {
  return tipo === "INTERNAL" ? "Taller" : WORKER_TYPE_LABEL[tipo];
}

function importeCosto(valor: string | null | undefined, decimales = 2): string {
  return formatMoney(valor, MONEDA_BASE, { decimals: decimales });
}

function textoHoras(valor: string | null | undefined): string {
  // Solo presentación: el backend manda seis decimales («5.333333»).
  return valor ? `${formatDecimalString(valor, 2)} h` : "Pendiente";
}

function hayCantidad(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return !/^0(?:[.,]0+)?$/.test(valor.trim());
}

function Dato({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={className}>
      <dt className="text-[11.5px] font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 min-w-0 break-words text-[13px] font-semibold text-zinc-900 tabular-nums">
        {value}
      </dd>
      {hint ? <dd className="mt-0.5 text-[11.5px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

function Avisos({ codigos }: { codigos: readonly string[] }) {
  if (codigos.length === 0) return null;
  return (
    <ul data-testid="v2next-labor-avisos" className="mt-3 space-y-1.5">
      {codigos.map((codigo, indice) => (
        <li
          key={`${codigo}-${indice}`}
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          {LABOR_WARNING_LABEL[codigo] ??
            "Hay un aviso del cálculo de mano de obra. Revise esta parte del trabajo."}
        </li>
      ))}
    </ul>
  );
}

function EstadoDeCarga({ label }: { label: string }) {
  return (
    <Panel>
      <Spinner className="size-5" label={label} />
    </Panel>
  );
}

function EstadoDeError({ error }: { error: unknown }) {
  return (
    <Panel>
      <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {describeError(error)}
      </p>
    </Panel>
  );
}

export function V2NextLaborStep({
  quotationId,
  canEdit,
  datos,
  irAPaso,
}: PasoDelAsistenteProps) {
  const manoDeObra = useV2Labor(quotationId);
  const procesos = useV2Processes(quotationId);
  const productos = useV2QuotationProducts(quotationId);
  const trabajadores = useV2Workers(true);
  const tecnicas = useV2Techniques(true);

  if (
    manoDeObra.isPending ||
    procesos.isPending ||
    productos.isPending ||
    trabajadores.isPending ||
    tecnicas.isPending
  ) {
    return <EstadoDeCarga label="Cargando trabajo del taller..." />;
  }

  if (manoDeObra.isError || procesos.isError || productos.isError || trabajadores.isError || tecnicas.isError) {
    return (
      <EstadoDeError
        error={manoDeObra.error ?? procesos.error ?? productos.error ?? trabajadores.error ?? tecnicas.error}
      />
    );
  }

  const pagina = manoDeObra.data as LaborPageConAvisos;
  const lineas = productos.data?.items ?? datos.productos?.items ?? [];
  const listaProcesos = procesos.data?.items ?? [];
  const listaTrabajadores = trabajadores.data?.items ?? [];
  const listaTecnicas = tecnicas.data?.items ?? [];
  const laborConProceso = new Set(
    listaProcesos.map((proceso) => proceso.labor_id).filter((id): id is number => id !== null),
  );
  const tareasSueltas = pagina.items.filter(
    (tarea) => tarea.is_additional_personnel || !laborConProceso.has(tarea.id),
  );
  const sinMaestros = listaTrabajadores.length === 0 || listaTecnicas.length === 0;

  return (
    <Panel>
      <section data-testid="v2next-paso-trabajo" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            El personal del taller no suma costo porque ya tiene sueldo. Un externo se paga por sus
            horas.
          </p>
          <div className="rounded-2xl border border-black/[0.06] bg-white/60 px-4 py-3 text-right">
            <p className="text-[11.5px] font-medium text-zinc-500">Mano de obra</p>
            <p data-testid="v2next-labor-total" className="text-lg font-bold text-zinc-950 tabular-nums">
              {formatCosto(pagina.labor_cost)}
            </p>
          </div>
        </div>

        {sinMaestros ? (
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          >
            Sin trabajadores o técnicas activos: se dan de alta en Configuración → Cotizador V2.
          </p>
        ) : null}

        <Avisos codigos={[...(pagina.warnings ?? []), ...(procesos.data?.warnings ?? [])]} />

        {lineas.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-950">Primero agregue las piezas.</p>
            <p className="mt-1 text-xs text-amber-900">
              Los procesos nacen desde la ficha de cada pieza y aparecen aquí cuando el pedido tiene
              líneas.
            </p>
            <SecondaryButton type="button" className="mt-3" onClick={() => irAPaso("productos")}>
              Ir a Piezas
            </SecondaryButton>
          </div>
        ) : (
          <>
            <ProcesosPorPieza
              quotationId={quotationId}
              canEdit={canEdit}
              lineas={lineas}
              procesos={listaProcesos}
              tareas={pagina.items}
              trabajadores={listaTrabajadores}
              tecnicas={listaTecnicas}
            />

            <PersonalAdicional
              quotationId={quotationId}
              canEdit={canEdit && !sinMaestros}
              tareas={tareasSueltas}
              lineas={lineas}
              trabajadores={listaTrabajadores}
              tecnicas={listaTecnicas}
            />

            <CargaDeJornada carga={pagina.workday_load} />

            <DiasDeTaller
              quotationId={quotationId}
              canEdit={canEdit}
              labor={pagina}
              costoPorDia={datos.cotizacion?.space_service_cost_per_day}
            />

            <Ilustracion quotationId={quotationId} canEdit={canEdit} />
          </>
        )}
      </section>
    </Panel>
  );
}

function ProcesosPorPieza({
  quotationId,
  canEdit,
  lineas,
  procesos,
  tareas,
  trabajadores,
  tecnicas,
}: {
  quotationId: number;
  canEdit: boolean;
  lineas: V2QuotationProduct[];
  procesos: V2Process[];
  tareas: V2LaborLine[];
  trabajadores: V2Worker[];
  tecnicas: V2Technique[];
}) {
  return (
    <div className="space-y-4">
      {lineas.map((linea) => {
        const procesosDeLinea = procesos.filter((proceso) => proceso.v2_quotation_product_id === linea.id);
        return (
          <section
            key={linea.id}
            data-testid={`labor-piece-${linea.id}`}
            className="rounded-2xl border border-black/[0.06] bg-white/60 p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-zinc-950">{textoLinea(linea)}</h3>
              <p className="text-xs font-medium text-zinc-500 tabular-nums">{linea.quantity} piezas</p>
            </div>

            {procesosDeLinea.length === 0 ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Esta pieza no tiene procesos configurados en su ficha. Añádalos aquí para esta
                cotización, o configúrelos en Configuración → Cotizador V2.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {procesosDeLinea.map((proceso) => (
                  <ProcesoFila
                    key={proceso.id}
                    quotationId={quotationId}
                    canEdit={canEdit}
                    proceso={proceso}
                    tarea={tareas.find((una) => una.id === proceso.labor_id)}
                    trabajadores={trabajadores}
                  />
                ))}
              </ul>
            )}

            {canEdit ? (
              <AgregarProceso
                quotationId={quotationId}
                lineaId={linea.id}
                tecnicas={tecnicas}
                yaPuestas={procesosDeLinea.map((proceso) => proceso.technique_id)}
              />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function ProcesoFila({
  quotationId,
  canEdit,
  proceso,
  tarea,
  trabajadores,
}: {
  quotationId: number;
  canEdit: boolean;
  proceso: V2Process;
  tarea: V2LaborLine | undefined;
  trabajadores: V2Worker[];
}) {
  const asignar = useAssignV2Process(quotationId);
  const quitar = useRemoveV2Process(quotationId);
  const cambiarPiezas = useSetV2ProcessQuantity(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);
  const capaces = trabajadores.filter((worker) => worker.technique_ids.includes(proceso.technique_id));
  const costo = tarea?.labor_cost ?? proceso.labor_cost;

  return (
    <li
      data-testid={`labor-process-${proceso.id}`}
      className="rounded-2xl border border-black/[0.06] bg-white/70 p-4"
    >
      <div className="grid grid-cols-1 gap-3 @min-[480px]:grid-cols-2 @min-[860px]:grid-cols-[minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] @min-[860px]:items-start">
        <dl>
          <Dato
            label="Técnica"
            value={
              <span>
                {proceso.technique_name}
                {proceso.origin === "MANUAL" ? (
                  <span className="mt-1 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                    Añadido aquí
                  </span>
                ) : null}
              </span>
            }
          />
        </dl>

        {canEdit ? (
          <DecimalField
            label="Piezas por trabajar"
            requirement="required"
            value={proceso.quantity}
            sufijo={proceso.technique_unit}
            onCommit={(valor) =>
              valor !== null
                ? esperarGuardado(cambiarPiezas, "proceso-editar", {
                    processId: proceso.id,
                    quantity: valor,
                  })
                : undefined
            }
            hint={
              proceso.quantity_overridden
                ? "Escritas para este encargo."
                : "Vienen de la cantidad de la pieza."
            }
          />
        ) : (
          <dl>
            <Dato
              label="Piezas por trabajar"
              value={`${proceso.quantity} ${proceso.technique_unit}`}
              hint={proceso.quantity_overridden ? "Escritas para este encargo." : undefined}
            />
          </dl>
        )}

        <dl>
          <Dato
            label="Horas calculadas"
            value={proceso.manual_hours ? "Horas a mano" : textoHoras(proceso.calculated_hours)}
            hint="Las devuelve el cálculo del backend."
          />
        </dl>

        {canEdit ? (
          <SelectField
            label="Lo hace"
            requirement="optional"
            value={proceso.worker_id === null ? SIN_SELECCION : String(proceso.worker_id)}
            options={[
              { value: SIN_SELECCION, label: "Sin asignar" },
              ...capaces.map((worker) => ({
                value: String(worker.id),
                label: `${worker.name} (${etiquetaTipoTrabajador(worker.worker_type)})`,
              })),
            ]}
            onChange={(valor) =>
              asignar.mutate({
                processId: proceso.id,
                workerId: valor === SIN_SELECCION ? null : Number(valor),
              })
            }
            disabled={asignar.isPending}
            hint={
              capaces.length === 0
                ? "Nadie tiene esta técnica habilitada."
                : "Solo aparece quien sabe hacer esta técnica."
            }
          />
        ) : (
          <dl>
            <Dato
              label="Lo hace"
              value={proceso.worker_name ?? "Sin asignar"}
              hint={proceso.worker_id === null ? "Aún no cuesta." : undefined}
            />
          </dl>
        )}

        <dl>
          <Dato
            label="Costo del proceso"
            value={proceso.worker_id === null ? "Sin asignar: aún no cuesta" : formatCosto(costo)}
          />
        </dl>

        {canEdit ? (
          <button
            type="button"
            aria-label={`Quitar ${proceso.technique_name} de esta cotización`}
            onClick={() => quitar.mutate(proceso.id)}
            disabled={quitar.isPending}
            className="min-h-8 justify-self-start rounded-lg px-2 py-1 text-xs font-semibold text-red-700 underline underline-offset-2 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 @min-[860px]:justify-self-end"
          >
            Quitar
          </button>
        ) : null}
      </div>

      {proceso.worker_id !== null ? (
        <DetalleDeTarea
          quotationId={quotationId}
          canEdit={canEdit}
          tarea={tarea}
          proceso={proceso}
        />
      ) : null}

      <Avisos codigos={[...proceso.warnings, ...(tarea?.warnings ?? [])]} />

      {asignar.isError || quitar.isError || cambiarPiezas.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(asignar.error ?? quitar.error ?? cambiarPiezas.error)}
        </p>
      ) : null}
    </li>
  );
}

function DetalleDeTarea({
  quotationId,
  canEdit,
  tarea,
  proceso,
}: {
  quotationId: number;
  canEdit: boolean;
  tarea: V2LaborLine | undefined;
  proceso: V2Process;
}) {
  const actualizar = useUpdateV2Labor(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  if (!tarea) {
    return (
      <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-black/[0.04] pt-3 @min-[480px]:grid-cols-2">
        <Dato label="Horas finales" value={textoHoras(proceso.final_hours)} />
        <Dato label="Costo" value={formatCosto(proceso.labor_cost)} />
      </dl>
    );
  }

  const guardar = (payload: Record<string, unknown>) =>
    actualizar.mutate({ laborId: tarea.id, payload });
  const guardarYEsperar = (payload: Record<string, unknown>) =>
    esperarGuardado(actualizar, "tarea-editar", { laborId: tarea.id, payload });

  if (!canEdit) {
    return (
      <dl className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-black/[0.04] bg-white/60 p-3 @min-[480px]:grid-cols-4">
        <Dato
          label="Horas finales"
          value={textoHoras(tarea.final_hours)}
          hint={tarea.hours_overridden ? "Acordadas para esta cotización." : undefined}
        />
        <Dato
          label="Tarifa acordada por hora"
          value={tarea.rate_overridden ? importeCosto(tarea.hourly_rate, 4) : "Jornal del maestro"}
        />
        <Dato label="Rendimiento estándar" value={`${tarea.standard_capacity} / jornada`} />
        <Dato label="Costo" value={formatCosto(tarea.labor_cost)} />
      </dl>
    );
  }

  return (
    <details className="mt-3 rounded-xl border border-black/[0.04] bg-white/60 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-800">
        Ajustar horas y tarifa
      </summary>

      <div className="mt-3 grid grid-cols-1 gap-4 @min-[480px]:grid-cols-2">
        <div>
          <DecimalField
            label="Horas finales"
            requirement="required"
            value={tarea.final_hours}
            sufijo="h"
            onCommit={(valor) => guardarYEsperar({ final_hours_override: valor })}
            hint={
              tarea.hours_overridden
                ? "Acordadas para esta cotización."
                : "Salen del rendimiento estándar."
            }
          />
          {tarea.hours_overridden ? (
            <button
              type="button"
              onClick={() => guardar({ final_hours_override: null })}
              className="mt-2 min-h-8 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-700 underline underline-offset-2 hover:bg-zinc-100"
            >
              Volver al estándar ({textoHoras(tarea.calculated_hours)})
            </button>
          ) : null}
        </div>
        <DecimalField
          label="Tarifa acordada por hora"
          value={tarea.rate_overridden ? tarea.hourly_rate : ""}
          sufijo={currencySymbol(MONEDA_BASE)}
          onCommit={(valor) => guardarYEsperar({ hourly_rate_override: valor })}
          hint="Vacío: se usa el jornal del maestro."
        />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-black/[0.04] pt-3 @min-[480px]:grid-cols-4">
        <Dato
          label="Rendimiento estándar"
          value={`${tarea.standard_capacity} / jornada`}
          hint="Del catálogo de técnicas."
        />
        <Dato label="Horas del estándar" value={textoHoras(tarea.calculated_hours)} />
        <Dato label="Tarifa actual" value={importeCosto(tarea.hourly_rate, 4)} />
        <Dato label="Costo" value={formatCosto(tarea.labor_cost)} />
      </dl>

      {actualizar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(actualizar.error)}
        </p>
      ) : null}
    </details>
  );
}

function AgregarProceso({
  quotationId,
  lineaId,
  tecnicas,
  yaPuestas,
}: {
  quotationId: number;
  lineaId: number;
  tecnicas: V2Technique[];
  yaPuestas: number[];
}) {
  const anadir = useAddV2Process(quotationId);
  const [tecnica, setTecnica] = useState(SIN_SELECCION);
  const disponibles = tecnicas.filter((una) => !yaPuestas.includes(una.id));

  if (disponibles.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-black/[0.04] pt-3">
      <SelectField
        label="Agregar proceso"
        requirement="optional"
        value={tecnica}
        options={[
          { value: SIN_SELECCION, label: "Seleccionar..." },
          ...disponibles.map((una) => ({ value: String(una.id), label: una.name })),
        ]}
        onChange={setTecnica}
        className="min-w-0 flex-1 @min-[480px]:max-w-xs"
        hint="Solo para esta cotización: la ficha de la pieza no cambia."
      />
      <PrimaryButton
        type="button"
        disabled={tecnica === SIN_SELECCION || anadir.isPending}
        onClick={() =>
          anadir.mutate(
            { v2_quotation_product_id: lineaId, technique_id: Number(tecnica) },
            { onSuccess: () => setTecnica(SIN_SELECCION) },
          )
        }
      >
        {anadir.isPending ? "Agregando..." : "Agregar"}
      </PrimaryButton>
      {anadir.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(anadir.error)}
        </p>
      ) : null}
    </div>
  );
}

function PersonalAdicional({
  quotationId,
  canEdit,
  tareas,
  lineas,
  trabajadores,
  tecnicas,
}: {
  quotationId: number;
  canEdit: boolean;
  tareas: V2LaborLine[];
  lineas: V2QuotationProduct[];
  trabajadores: V2Worker[];
  tecnicas: V2Technique[];
}) {
  const anadir = useAddV2Labor(quotationId);
  const [worker, setWorker] = useState(SIN_SELECCION);
  const [tecnica, setTecnica] = useState(SIN_SELECCION);
  const [linea, setLinea] = useState(TODO_EL_PEDIDO);

  const ficha = trabajadores.find((uno) => String(uno.id) === worker);
  const tecnicasDelTrabajador = ficha
    ? tecnicas.filter((una) => ficha.technique_ids.includes(una.id))
    : [];

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <h3 className="text-base font-bold text-zinc-950">Personal adicional y apoyo</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        Una persona de apoyo se añade con la técnica que sí sabe hacer y se puede aplicar a una pieza
        o a todo el pedido.
      </p>

      {tareas.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {tareas.map((tarea) => (
            <TareaAdicional
              key={tarea.id}
              quotationId={quotationId}
              canEdit={canEdit}
              tarea={tarea}
              lineas={lineas}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">Esta cotización no tiene personal adicional.</p>
      )}

      {canEdit ? (
        <div className="mt-3 grid grid-cols-1 items-end gap-3 border-t border-black/[0.04] pt-3 @min-[480px]:grid-cols-2 @min-[860px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <SelectField
            label="Trabajador de apoyo"
            requirement="optional"
            value={worker}
            options={[
              { value: SIN_SELECCION, label: "Seleccionar..." },
              ...trabajadores.map((uno) => ({
                value: String(uno.id),
                label: `${uno.name} (${etiquetaTipoTrabajador(uno.worker_type)})`,
              })),
            ]}
            onChange={(valor) => {
              setWorker(valor);
              setTecnica(SIN_SELECCION);
            }}
          />
          <SelectField
            label="Técnica que sabe"
            requirement="optional"
            value={tecnica}
            options={[
              { value: SIN_SELECCION, label: "Seleccionar..." },
              ...tecnicasDelTrabajador.map((una) => ({ value: String(una.id), label: una.name })),
            ]}
            onChange={setTecnica}
            disabled={!ficha}
            hint={ficha ? "Solo las técnicas habilitadas en su ficha." : "Primero elija a la persona."}
          />
          <SelectField
            label="Pieza"
            requirement="optional"
            value={linea}
            options={[
              { value: TODO_EL_PEDIDO, label: "Todo el pedido" },
              ...lineas.map((una) => ({ value: String(una.id), label: textoLinea(una) })),
            ]}
            onChange={setLinea}
          />
          <PrimaryButton
            type="button"
            disabled={worker === SIN_SELECCION || tecnica === SIN_SELECCION || anadir.isPending}
            onClick={() =>
              anadir.mutate(
                {
                  worker_id: Number(worker),
                  technique_id: Number(tecnica),
                  v2_quotation_product_id: linea === TODO_EL_PEDIDO ? null : Number(linea),
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
        </div>
      ) : null}

      {anadir.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(anadir.error)}
        </p>
      ) : null}
    </section>
  );
}

function TareaAdicional({
  quotationId,
  canEdit,
  tarea,
  lineas,
}: {
  quotationId: number;
  canEdit: boolean;
  tarea: V2LaborLine;
  lineas: V2QuotationProduct[];
}) {
  const actualizar = useUpdateV2Labor(quotationId);
  const borrar = useDeleteV2Labor(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);
  const nombreProducto =
    tarea.v2_quotation_product_id === null
      ? "Todo el pedido"
      : textoLinea(
          lineas.find((linea) => linea.id === tarea.v2_quotation_product_id) ?? {
            id: tarea.v2_quotation_product_id,
            product_name: null,
          },
        );

  const guardar = (payload: Record<string, unknown>) =>
    actualizar.mutate({ laborId: tarea.id, payload });
  const guardarYEsperar = (payload: Record<string, unknown>) =>
    esperarGuardado(actualizar, "tarea-editar", { laborId: tarea.id, payload });

  return (
    <li className="rounded-2xl border border-black/[0.06] bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {tarea.worker_name} · {tarea.technique_name}
          </p>
          <p className="mt-0.5 text-[11.5px] text-zinc-500">{nombreProducto}</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => borrar.mutate(tarea.id)}
            disabled={borrar.isPending}
            className="min-h-8 rounded-lg px-2 py-1 text-xs font-semibold text-red-700 underline underline-offset-2 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Quitar
          </button>
        ) : null}
      </div>

      {canEdit ? (
        <div className="mt-3 grid grid-cols-1 gap-4 @min-[480px]:grid-cols-2 @min-[860px]:grid-cols-4">
          <SelectField
            label="Pieza"
            requirement="optional"
            value={
              tarea.v2_quotation_product_id === null ? TODO_EL_PEDIDO : String(tarea.v2_quotation_product_id)
            }
            options={[
              { value: TODO_EL_PEDIDO, label: "Todo el pedido" },
              ...lineas.map((linea) => ({ value: String(linea.id), label: textoLinea(linea) })),
            ]}
            onChange={(valor) =>
              guardar({ v2_quotation_product_id: valor === TODO_EL_PEDIDO ? null : Number(valor) })
            }
          />
          <DecimalField
            label="Piezas por trabajar"
            requirement="required"
            value={tarea.quantity}
            sufijo={tarea.technique_unit}
            onCommit={(valor) => guardarYEsperar({ quantity: valor })}
          />
          <DecimalField
            label="Horas finales"
            requirement="required"
            value={tarea.final_hours}
            sufijo="h"
            onCommit={(valor) => guardarYEsperar({ final_hours_override: valor })}
          />
          <DecimalField
            label="Tarifa acordada por hora"
            value={tarea.rate_overridden ? tarea.hourly_rate : ""}
            sufijo={currencySymbol(MONEDA_BASE)}
            onCommit={(valor) => guardarYEsperar({ hourly_rate_override: valor })}
            hint="Vacío: se usa el jornal del maestro."
          />
        </div>
      ) : null}

      {canEdit && tarea.hours_overridden ? (
        <button
          type="button"
          onClick={() => guardar({ final_hours_override: null })}
          className="mt-2 min-h-8 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-700 underline underline-offset-2 hover:bg-zinc-100"
        >
          Volver al estándar ({textoHoras(tarea.calculated_hours)})
        </button>
      ) : null}

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-black/[0.04] pt-3 @min-[480px]:grid-cols-4">
        <Dato label="Rendimiento estándar" value={`${tarea.standard_capacity} / jornada`} />
        <Dato label="Horas calculadas" value={textoHoras(tarea.calculated_hours)} />
        <Dato label="Tarifa actual" value={importeCosto(tarea.hourly_rate, 4)} />
        <Dato label="Costo" value={formatCosto(tarea.labor_cost)} />
      </dl>

      <Avisos codigos={tarea.warnings} />

      {actualizar.isError || borrar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(actualizar.error ?? borrar.error)}
        </p>
      ) : null}
    </li>
  );
}

function CargaDeJornada({ carga }: { carga: V2WorkerLoad[] }) {
  if (carga.length === 0) return null;
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <h3 className="text-base font-bold text-zinc-950">Jornada por persona</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">Persona</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Jornada</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Asignado</th>
              <th scope="col" className="py-2 font-semibold">Días mínimos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {carga.map((fila) => (
              <tr key={fila.worker_id}>
                <td className="py-2 pr-3 text-zinc-900">{fila.worker_name}</td>
                <td className="py-2 pr-3 text-zinc-600">{textoHoras(fila.workday_hours)}</td>
                <td className="py-2 pr-3 text-zinc-700">
                  <span className={fila.exceeds_workday ? "font-semibold text-amber-800" : undefined}>
                    {textoHoras(fila.assigned_hours)}
                  </span>
                  {fila.exceeds_workday ? (
                    <span className="block text-[11.5px] text-amber-800">Supera la jornada</span>
                  ) : null}
                </td>
                <td className="py-2 text-zinc-600 tabular-nums">{fila.minimum_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DiasDeTaller({
  quotationId,
  canEdit,
  labor,
  costoPorDia,
}: {
  quotationId: number;
  canEdit: boolean;
  labor: V2LaborPage;
  costoPorDia: string | null | undefined;
}) {
  const planificar = useSetV2Planning(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <h3 className="text-base font-bold text-zinc-950">Días de taller</h3>
      <div className="mt-3 grid grid-cols-1 gap-4 @min-[480px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[480px]:items-end">
        {canEdit ? (
          <DecimalField
            label="¿Cuántos días le dedicarás?"
            value={labor.effective_work_days === null ? "" : String(labor.effective_work_days)}
            entero
            sufijo="días"
            onCommit={(valor) =>
              esperarGuardado(planificar, "planificacion", valor === null ? null : Number(valor))
            }
            hint={`Cada día suma ${formatCosto(costoPorDia)} de espacio y servicios.`}
          />
        ) : (
          <dl>
            <Dato
              label="Días decididos"
              value={labor.effective_work_days === null ? "Pendiente" : `${labor.effective_work_days} días`}
              hint={`Cada día suma ${formatCosto(costoPorDia)} de espacio y servicios.`}
            />
          </dl>
        )}

        <div className="rounded-xl border border-black/[0.06] bg-white/70 p-3">
          <p className="text-xs text-zinc-600">
            Mínimo sugerido:{" "}
            <strong className="text-zinc-950 tabular-nums">{labor.suggested_work_days} días</strong>
          </p>
          {canEdit ? (
            <SecondaryButton
              type="button"
              className="mt-2"
              disabled={planificar.isPending}
              onClick={() => esperarGuardado(planificar, "planificacion", labor.suggested_work_days)}
            >
              Usar sugerencia
            </SecondaryButton>
          ) : null}
        </div>
      </div>
      {planificar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(planificar.error)}
        </p>
      ) : null}
    </section>
  );
}

function Ilustracion({ quotationId, canEdit }: { quotationId: number; canEdit: boolean }) {
  const query = useV2Illustration(quotationId);
  const guardar = useSetV2Illustration(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  if (query.isPending) {
    return (
      <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
        <Spinner className="size-5" label="Cargando ilustración..." />
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
        <p role="alert" className="text-xs text-red-600">{describeError(query.error)}</p>
      </section>
    );
  }

  const ilustracion = query.data;

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-950">Ilustración</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Se indica por piezas. Las horas y el costo los devuelve el backend.
          </p>
        </div>
        {canEdit ? (
          <label className="inline-flex min-h-8 items-center gap-3 rounded-xl border border-black/[0.06] bg-white/70 px-3 py-2 text-xs font-semibold text-zinc-800">
            <span>Lleva ilustración</span>
            <input
              type="checkbox"
              role="switch"
              checked={ilustracion.enabled}
              onChange={(evento) => guardar.mutate({ illustration_enabled: evento.currentTarget.checked })}
              className="h-4 w-4 accent-zinc-900"
            />
          </label>
        ) : (
          <dl>
            <Dato label="Ilustración" value={ilustracion.enabled ? "Sí" : "No"} />
          </dl>
        )}
      </div>

      {ilustracion.enabled ? (
        <>
          <LineasDeIlustracion
            canEdit={canEdit}
            ilustracion={ilustracion}
            guardar={(payload) => esperarGuardado(guardar, "ilustracion", payload)}
          />
          <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-black/[0.04] pt-3 @min-[480px]:grid-cols-4">
            <Dato label="Rendimiento" value={`${ilustracion.capacity_per_workday ?? "Pendiente"} / jornada`} />
            <Dato label="Tarifa por hora" value={formatCosto(ilustracion.hourly_rate)} />
            <Dato label="Horas" value={textoHoras(ilustracion.total_hours)} />
            <Dato label="Costo" value={formatCosto(ilustracion.total_cost)} />
          </dl>
        </>
      ) : null}

      {guardar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(guardar.error)}
        </p>
      ) : null}
    </section>
  );
}

function LineasDeIlustracion({
  canEdit,
  ilustracion,
  guardar,
}: {
  canEdit: boolean;
  ilustracion: V2Illustration;
  guardar: (payload: { lines?: { line_id: number; quantity: string }[]; illustration_quantity?: string }) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 @min-[480px]:grid-cols-2">
      {ilustracion.lines.map((linea) => (
        <LineaIlustracion
          key={linea.line_id}
          canEdit={canEdit}
          linea={linea}
          todas={ilustracion.lines}
          guardar={guardar}
        />
      ))}
      {canEdit || hayCantidad(ilustracion.quantity) ? (
        <div className="rounded-xl border border-black/[0.06] bg-white/70 p-3">
          {canEdit ? (
            <DecimalField
              label="Piezas sin producto asignado"
              value={ilustracion.quantity}
              onCommit={(valor) =>
                valor !== null ? guardar({ illustration_quantity: valor }) : undefined
              }
              hint="Póngalas en cero y asígnelas a una pieza cuando corresponda."
            />
          ) : (
            <dl>
              <Dato label="Piezas sin producto asignado" value={ilustracion.quantity} />
            </dl>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Dato label="Horas" value={textoHoras(ilustracion.hours)} />
            <Dato label="Costo" value={formatCosto(ilustracion.cost)} />
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function LineaIlustracion({
  canEdit,
  linea,
  todas,
  guardar,
}: {
  canEdit: boolean;
  linea: V2IllustrationLine;
  todas: V2IllustrationLine[];
  guardar: (payload: { lines: { line_id: number; quantity: string }[] }) => void;
}) {
  const nombre = linea.product_name ?? `Línea ${linea.line_id}`;
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white/70 p-3">
      {canEdit ? (
        <DecimalField
          label={`Piezas a ilustrar · ${nombre}`}
          value={linea.quantity}
          onCommit={(valor) =>
            valor !== null
              ? guardar({
                  lines: todas.map((otra) => ({
                    line_id: otra.line_id,
                    quantity: otra.line_id === linea.line_id ? valor : otra.quantity,
                  })),
                })
              : undefined
          }
        />
      ) : (
        <dl>
          <Dato label={`Piezas a ilustrar · ${nombre}`} value={linea.quantity} />
        </dl>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Dato label="Horas" value={textoHoras(linea.hours)} />
        <Dato label="Costo" value={formatCosto(linea.cost)} />
      </dl>
    </div>
  );
}
