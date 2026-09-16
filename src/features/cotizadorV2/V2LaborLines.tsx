import { useState } from "react";

import { PrimaryButton, SelectField, SecondaryButton } from "@/components/form";
import { DecimalField } from "@/components/DecimalField";
import { Spinner } from "@/components/Spinner";
import { EmptyState, Panel, TableWrapper, Td, Th } from "@/features/masters/MasterTable";
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
  LABOR_WARNING_LABEL,
  WORKER_TYPE_LABEL,
  type V2LaborLine,
  type V2WorkerLoad,
} from "@/types/quoterV2Labor";
import { formatMoney, formatNumber } from "@/utils/formatters";
import { NuevoTrabajadorDrawer } from "@/features/cotizadorV2/components/NuevoTrabajadorDrawer";

const SIN_PRODUCTO = "";
const SIN_SELECCION = "";

function Aviso({ codigo }: { codigo: string }) {
  return <li className="text-xs text-amber-700">{LABOR_WARNING_LABEL[codigo] ?? codigo}</li>;
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
  onDone,
}: {
  tarea: V2LaborLine;
  quotationId: number;
  onDone: () => void;
}) {
  const actualizar = useUpdateV2Labor(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);
  const trabajadores = useV2Workers(true);
  const tecnicas = useV2Techniques(true);
  const productos = useV2QuotationProducts(quotationId);

  const guardar = (cambios: Record<string, unknown>) =>
    actualizar.mutate({ laborId: tarea.id, payload: cambios });
  const guardarYEsperar = (cambios: Record<string, unknown>) =>
    esperarGuardado(actualizar, "tarea-editar", { laborId: tarea.id, payload: cambios });

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-black/5 pb-3">
        <h3 className="text-base font-semibold text-zinc-900">
          Editar asignación
        </h3>
        <button
          type="button"
          onClick={onDone}
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          Hecho
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SelectField
          label="Aplicar a"
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
        />
        <SelectField
          label="Técnica *"
          value={String(tarea.technique_id)}
          options={(tecnicas.data?.items ?? []).map((tecnica) => ({
            value: String(tecnica.id),
            label: tecnica.name,
          }))}
          onChange={(valor) => guardar({ technique_id: Number(valor) })}
        />
        <SelectField
          label="Trabajador *"
          value={String(tarea.worker_id)}
          options={(trabajadores.data?.items ?? []).map((worker) => ({
            value: String(worker.id),
            label: `${worker.name} (${WORKER_TYPE_LABEL[worker.worker_type]})`,
          }))}
          onChange={(valor) => guardar({ worker_id: Number(valor) })}
        />
        <DecimalField
          label={`Piezas (${tarea.technique_unit}) *`}
          value={tarea.quantity}
          onCommit={(valor) => guardarYEsperar({ quantity: valor })}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 bg-zinc-50 rounded-xl p-4 sm:grid-cols-4 border border-black/5">
        <Dato
          label="Rendimiento estándar"
          value={`${formatNumber(tarea.standard_capacity)} / jornada`}
        />
        <Dato label="Horas calculadas" value={`${formatNumber(tarea.calculated_hours)} h`} />
        
        <div>
          <DecimalField
            label="Horas finales *"
            value={tarea.final_hours}
            onCommit={(valor) => guardarYEsperar({ final_hours_override: valor })}
          />
          {tarea.hours_overridden ? (
            <button
              type="button"
              onClick={() => guardar({ final_hours_override: null })}
              className="mt-1 text-[10px] font-medium text-sky-600 hover:text-sky-700 underline"
            >
              Restaurar estándar
            </button>
          ) : null}
        </div>
        
        <div>
          <Dato 
            label="Tarifa" 
            value={`${formatMoney(tarea.hourly_rate)} / h`} 
          />
          <div className="mt-1">
            <DecimalField
              label="Tarifa acordada (opcional)"
              value={tarea.rate_overridden ? tarea.hourly_rate : ""}
              onCommit={(valor) => guardarYEsperar({ hourly_rate_override: valor })}
            />
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex justify-end">
        <p className="text-sm text-zinc-500 flex items-center gap-2">
          Costo estimado: <strong className="text-lg text-zinc-900 font-bold">{formatMoney(tarea.labor_cost)}</strong>
        </p>
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
    <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
      <h3 className="text-sm font-semibold text-zinc-900">Jornada por persona</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Las horas se suman por persona en toda la cotización.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500 border-b border-black/5">
            <tr>
              <th className="py-2 pr-3 font-medium">Persona</th>
              <th className="py-2 pr-3 font-medium">Jornada</th>
              <th className="py-2 pr-3 font-medium">Asignado</th>
              <th className="py-2 font-medium">Días mínimos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {carga.map((fila) => (
              <tr key={fila.worker_id}>
                <td className="py-3 pr-3 text-zinc-800 font-medium">{fila.worker_name}</td>
                <td className="py-3 pr-3 text-zinc-600">{formatNumber(fila.workday_hours)} h</td>
                <td className="py-3 pr-3">
                  <span className={fila.exceeds_workday ? "font-semibold text-amber-700" : "font-medium text-zinc-800"}>
                    {formatNumber(fila.assigned_hours)} h
                  </span>
                  {fila.exceeds_workday ? (
                    <span className="block text-[10px] text-amber-700 font-medium mt-0.5">
                      Supera la jornada
                    </span>
                  ) : null}
                </td>
                <td className="py-3 text-zinc-600">{fila.minimum_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
      <h3 className="text-sm font-semibold text-zinc-900">ILUSTRACIÓN</h3>
      <p className="mt-1 text-xs text-zinc-500 mb-4">
        Va aparte de las técnicas productivas.
      </p>

      <div className="mb-5 max-w-sm">
        <SelectField
          label="Ilustración"
          value={ilustracion.enabled ? "SI" : "NO"}
          options={[
            { value: "NO", label: "Sin ilustración" },
            { value: "SI", label: "Con ilustración" },
          ]}
          onChange={(valor) => guardar.mutate({ illustration_enabled: valor === "SI" })}
          disabled={!canEdit}
        />
      </div>

      {ilustracion.enabled ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <DecimalField
            label="Piezas a ilustrar *"
            value={ilustracion.quantity}
            onCommit={(valor) =>
              valor !== null
                ? esperarGuardado(guardar, "ilustracion", { illustration_quantity: valor })
                : undefined
            }
            disabled={!canEdit}
          />
          <div className="bg-zinc-50 rounded-xl p-4 grid grid-cols-2 gap-4 border border-black/5">
            <Dato label="Rendimiento" value={`${formatNumber(ilustracion.capacity_per_workday ?? "0")} / jornada`} />
            <Dato label="Horas" value={`${formatNumber(ilustracion.hours)} h`} />
            <Dato label="Tarifa" value={`${formatMoney(ilustracion.hourly_rate ?? "0")} / h`} />
            <Dato label="Costo" value={formatMoney(ilustracion.cost)} />
          </div>
        </div>
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
  const anadir = useAddV2Labor(quotationId);
  const borrar = useDeleteV2Labor(quotationId);
  const planificar = useSetV2Planning(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);
  
  const trabajadores = useV2Workers(true);
  const tecnicas = useV2Techniques(true);
  const productos = useV2QuotationProducts(quotationId);
  
  const [worker, setWorker] = useState(SIN_SELECCION);
  const [tecnica, setTecnica] = useState(SIN_SELECCION);
  const [producto, setProducto] = useState(SIN_PRODUCTO);
  const [adicional, setAdicional] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const [editingId, setEditingId] = useState<number | null>(null);

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
      <div data-testid="panel-mano-de-obra">
        {canEdit ? (
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">MANO DE OBRA</h2>
            
            {sinMaestros ? (
              <p className="text-sm text-amber-700 bg-amber-50 p-4 rounded-xl">
                Para asignar trabajo hace falta al menos un trabajador y una técnica. 
                Se dan de alta en Configuración → Cotizador V2.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <SelectField
                  label="Aplicar a *"
                  value={producto}
                  options={[
                    { value: SIN_PRODUCTO, label: "Todo el pedido" },
                    ...(productos.data?.items ?? []).map((linea) => ({
                      value: String(linea.id),
                      label: linea.product_name ?? `Línea ${linea.id}`,
                    })),
                  ]}
                  onChange={setProducto}
                />
                <SelectField
                  label="Técnica *"
                  value={tecnica}
                  options={[
                    { value: SIN_SELECCION, label: "Seleccionar..." },
                    ...(tecnicas.data?.items ?? []).map((fila) => ({
                      value: String(fila.id),
                      label: fila.name,
                    })),
                  ]}
                  onChange={setTecnica}
                />
                <div>
                  <SelectField
                    label="Trabajador *"
                    value={worker}
                    options={[
                      { value: SIN_SELECCION, label: "Seleccionar..." },
                      ...(trabajadores.data?.items ?? []).map((fila) => ({
                        value: String(fila.id),
                        label: `${fila.name} · ${WORKER_TYPE_LABEL[fila.worker_type]}`,
                      })),
                    ]}
                    onChange={setWorker}
                  />
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="mt-1 text-[11px] font-medium text-sky-600 hover:text-sky-700 underline"
                  >
                    + Nuevo trabajador
                  </button>
                </div>
                <div>
                  <SelectField
                    label="Personal adicional"
                    value={adicional ? "SI" : "NO"}
                    options={[
                      { value: "NO", label: "No" },
                      { value: "SI", label: "Sí" },
                    ]}
                    onChange={(valor) => setAdicional(valor === "SI")}
                  />
                  <div className="mt-3">
                    <PrimaryButton
                      type="button"
                      className="w-full"
                      disabled={
                        anadir.isPending || worker === SIN_SELECCION || tecnica === SIN_SELECCION
                      }
                      onClick={() =>
                        anadir.mutate(
                          {
                            worker_id: Number(worker),
                            technique_id: Number(tecnica),
                            is_additional_personnel: adicional,
                            ...(producto === SIN_PRODUCTO
                              ? {}
                              : { v2_quotation_product_id: Number(producto) }),
                          },
                          {
                            onSuccess: () => {
                              // Solo reseteamos el trabajador y la técnica para encadenar asignaciones más rápido
                              setWorker(SIN_SELECCION);
                              setTecnica(SIN_SELECCION);
                              setAdicional(false);
                            },
                          },
                        )
                      }
                    >
                      {anadir.isPending ? "Añadiendo..." : "Añadir asignación"}
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            )}
            {anadir.isError ? (
              <p role="alert" className="mt-3 text-xs text-red-600">
                {describeError(anadir.error)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-zinc-900">Asignaciones</h3>
            <span className="text-sm font-bold text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full">
              {formatMoney(pagina.labor_cost)}
            </span>
          </div>

          {pagina.items.length === 0 ? (
            <EmptyState message="Todavía no hay asignaciones de mano de obra." />
          ) : (
            <div className="space-y-4">
              <div className="hidden lg:block border border-black/5 rounded-xl overflow-hidden">
                <TableWrapper>
                  <thead className="bg-zinc-50">
                    <tr>
                      <Th>Producto</Th>
                      <Th>Técnica</Th>
                      <Th>Trabajador</Th>
                      <Th align="right">Piezas</Th>
                      <Th align="right">Horas</Th>
                      <Th align="right">Tarifa</Th>
                      <Th align="right">Costo</Th>
                      {canEdit ? <Th align="right">Acciones</Th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 bg-white">
                    {pagina.items.map((tarea) => {
                      if (editingId === tarea.id) {
                        return (
                          <tr key={tarea.id}>
                            <td colSpan={canEdit ? 8 : 7} className="p-0">
                              <div className="p-1">
                                <Tarea tarea={tarea} quotationId={quotationId} onDone={() => setEditingId(null)} />
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={tarea.id} className="hover:bg-zinc-50/50">
                          <Td>
                            <span className="font-medium text-zinc-900">
                              {tarea.v2_quotation_product_id === null ? "Todo el pedido" : "Línea específica"}
                            </span>
                          </Td>
                          <Td>{tarea.technique_name}</Td>
                          <Td>
                            {tarea.worker_name}
                            {tarea.is_additional_personnel ? (
                              <span className="ml-2 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                                Adicional
                              </span>
                            ) : null}
                          </Td>
                          <Td align="right">{formatNumber(tarea.quantity)}</Td>
                          <Td align="right">{formatNumber(tarea.final_hours)} h</Td>
                          <Td align="right">{formatMoney(tarea.hourly_rate)}/h</Td>
                          <Td align="right" className="font-semibold">{formatMoney(tarea.labor_cost)}</Td>
                          {canEdit ? (
                            <Td align="right">
                              <div className="flex justify-end gap-2 text-xs font-medium">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(tarea.id)}
                                  className="text-sky-600 hover:text-sky-800 transition-colors"
                                >
                                  Editar
                                </button>
                                <span className="text-zinc-300">·</span>
                                <button
                                  type="button"
                                  onClick={() => borrar.mutate(tarea.id)}
                                  disabled={borrar.isPending}
                                  className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-40"
                                >
                                  Quitar
                                </button>
                              </div>
                            </Td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrapper>
              </div>

              {/* Vista Mobile (Cards) */}
              <div className="lg:hidden space-y-3">
                {pagina.items.map((tarea) => {
                  if (editingId === tarea.id) {
                    return <Tarea key={tarea.id} tarea={tarea} quotationId={quotationId} onDone={() => setEditingId(null)} />;
                  }
                  return (
                    <div key={tarea.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-xs">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-sm text-zinc-900">{tarea.technique_name}</div>
                        <div className="font-bold text-sm text-zinc-900">{formatMoney(tarea.labor_cost)}</div>
                      </div>
                      <div className="text-xs text-zinc-600 mb-3">
                        {tarea.worker_name} 
                        <span className="mx-1.5 text-zinc-300">|</span> 
                        {tarea.v2_quotation_product_id === null ? "Todo el pedido" : "Línea específica"}
                      </div>
                      <div className="flex gap-4 text-xs text-zinc-500 mb-4 bg-zinc-50 p-2 rounded-lg border border-black/5">
                        <div><span className="font-medium text-zinc-700">{formatNumber(tarea.quantity)}</span> piezas</div>
                        <div><span className="font-medium text-zinc-700">{formatNumber(tarea.final_hours)}</span> h</div>
                        <div><span className="font-medium text-zinc-700">{formatMoney(tarea.hourly_rate)}</span>/h</div>
                      </div>
                      {canEdit ? (
                        <div className="flex gap-3 justify-end pt-3 border-t border-black/5">
                          <SecondaryButton onClick={() => setEditingId(tarea.id)}>
                            Editar
                          </SecondaryButton>
                          <SecondaryButton 
                            onClick={() => borrar.mutate(tarea.id)}
                            disabled={borrar.isPending}
                          >
                            Quitar
                          </SecondaryButton>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <CargaDeJornada carga={pagina.workday_load} />

        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-zinc-900">PLANIFICACIÓN</h3>
          <p className="mt-1 text-xs text-zinc-500 mb-4">
            Lo decide quien planifica. No es la vigencia de la cotización.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-lg">
            <DecimalField
              label="Días efectivos de taller"
              value={pagina.effective_work_days === null ? "" : String(pagina.effective_work_days)}
              onCommit={(valor) =>
                esperarGuardado(planificar, "planificacion", valor === null ? null : Number(valor))
              }
              disabled={!canEdit}
              entero
            />
            <Dato
              label="Mínimo sugerido"
              value={`${pagina.suggested_work_days} días`}
              hint="Días si nadie alargara su jornada."
            />
          </div>
        </div>

        <Ilustracion quotationId={quotationId} canEdit={canEdit} />
      </div>
      
      {drawerOpen && (
        <NuevoTrabajadorDrawer 
          onClose={() => setDrawerOpen(false)} 
          onCreated={(id) => setWorker(String(id))} 
        />
      )}
    </Panel>
  );
}

