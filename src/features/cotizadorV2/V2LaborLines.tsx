import { useEffect, useState } from "react";

import { PrimaryButton, SelectField, TextField } from "@/components/form";
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
import {
  LABOR_WARNING_LABEL,
  WORKER_TYPE_LABEL,
  type V2LaborLine,
  type V2WorkerLoad,
} from "@/types/quoterV2Labor";

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
 * Los campos guardan al SALIR del campo. Borrar «20» para escribir «50» pasa
 * por la cadena vacía, y `Number("")` es 0: guardando al vuelo, unas horas se
 * pondrían en cero a mitad de una pulsación.
 */

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

/** Campo que solo avisa cuando el usuario termina de escribir. */
function CampoDiferido({
  label,
  value,
  onCommit,
  disabled,
  hint,
  inputMode,
  error,
}: {
  label: string;
  value: string;
  onCommit: (valor: string) => void;
  disabled: boolean;
  hint?: string | undefined;
  inputMode?: "numeric" | "decimal" | undefined;
  error?: string | undefined;
}) {
  const [borrador, setBorrador] = useState(value);
  useEffect(() => setBorrador(value), [value]);

  return (
    <TextField
      label={label}
      requirement="required"
      value={borrador}
      onChange={setBorrador}
      onBlur={() => {
        if (borrador !== value) onCommit(borrador);
      }}
      disabled={disabled}
      {...(inputMode ? { inputMode } : {})}
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
    />
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
  const borrar = useDeleteV2Labor(quotationId);
  const trabajadores = useV2Workers(true);
  const tecnicas = useV2Techniques(true);
  const [invalido, setInvalido] = useState<string | null>(null);

  const guardar = (cambios: Record<string, unknown>) =>
    actualizar.mutate({ laborId: tarea.id, payload: cambios });

  /** Un campo vacío no es un cero: es un campo a medio escribir. */
  const numero = (valor: string, campo: string, mensaje: string) => {
    const limpio = valor.trim();
    if (limpio === "" || !Number.isFinite(Number(limpio)) || Number(limpio) < 0) {
      setInvalido(mensaje);
      return;
    }
    setInvalido(null);
    guardar({ [campo]: limpio });
  };

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
            className="text-xs font-semibold text-red-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
          >
            Quitar
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField
          label="Trabajador"
          requirement="required"
          value={String(tarea.worker_id)}
          options={(trabajadores.data?.items ?? []).map((worker) => ({
            value: String(worker.id),
            label: `${worker.name} (${WORKER_TYPE_LABEL[worker.worker_type]})`,
          }))}
          onChange={(valor) => guardar({ worker_id: Number(valor) })}
          disabled={!canEdit}
        />
        <SelectField
          label="Técnica"
          requirement="required"
          value={String(tarea.technique_id)}
          options={(tecnicas.data?.items ?? []).map((tecnica) => ({
            value: String(tecnica.id),
            label: tecnica.name,
          }))}
          onChange={(valor) => guardar({ technique_id: Number(valor) })}
          disabled={!canEdit}
        />
        <CampoDiferido
          label="Piezas por trabajar"
          value={tarea.quantity}
          onCommit={(valor) => numero(valor, "quantity", "Indique la cantidad. Vacío no es cero.")}
          disabled={!canEdit}
          inputMode="decimal"
          hint={`Se miden en ${tarea.technique_unit}, como dice la técnica.`}
          {...(invalido ? { error: invalido } : {})}
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
        <CampoDiferido
          label="Horas finales"
          value={tarea.final_hours}
          onCommit={(valor) =>
            numero(valor, "final_hours_override", "Indique las horas. Vacío no es cero.")
          }
          disabled={!canEdit}
          inputMode="decimal"
          hint={
            tarea.hours_overridden
              ? "Acordadas para este encargo. No cambian el estándar del catálogo."
              : "Salen del rendimiento estándar. Puede ajustarlas para este encargo."
          }
        />
        <CampoDiferido
          label="Tarifa acordada por hora"
          value={tarea.rate_overridden ? tarea.hourly_rate : ""}
          onCommit={(valor) =>
            guardar({ hourly_rate_override: valor.trim() === "" ? null : valor.trim() })
          }
          disabled={!canEdit}
          inputMode="decimal"
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
          <CampoDiferido
            label="Piezas a ilustrar"
            value={ilustracion.quantity}
            onCommit={(valor) => {
              if (valor.trim() === "") return;
              guardar.mutate({ illustration_quantity: valor.trim() });
            }}
            disabled={!canEdit}
            inputMode="decimal"
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
  const anadir = useAddV2Labor(quotationId);
  const planificar = useSetV2Planning(quotationId);
  const trabajadores = useV2Workers(true);
  const tecnicas = useV2Techniques(true);
  const [worker, setWorker] = useState(SIN_SELECCION);
  const [tecnica, setTecnica] = useState(SIN_SELECCION);
  const [adicional, setAdicional] = useState(false);

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
        <CampoDiferido
          label="Días efectivos de taller"
          value={pagina.effective_work_days === null ? "" : String(pagina.effective_work_days)}
          onCommit={(valor) =>
            planificar.mutate(valor.trim() === "" ? null : Number(valor.trim()))
          }
          disabled={!canEdit}
          inputMode="numeric"
          hint="Lo decide quien planifica. No es la vigencia de la cotización."
        />
        <Dato
          label="Mínimo sugerido"
          value={String(pagina.suggested_work_days)}
          hint="Los días que harían falta si nadie alargara su jornada. Es una sugerencia."
        />
      </div>

      <Ilustracion quotationId={quotationId} canEdit={canEdit} />

      {canEdit ? (
        <div className="mt-6 border-t border-black/[0.04] pt-4">
          {sinMaestros ? (
            <p className="text-xs text-zinc-500">
              Para asignar trabajo hace falta al menos un trabajador y una técnica. Se dan de alta en
              Configuración → Cotizador V2.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <SelectField
                label="Trabajador"
                requirement="optional"
                value={worker}
                options={[
                  { value: SIN_SELECCION, label: "Seleccionar..." },
                  ...(trabajadores.data?.items ?? []).map((fila) => ({
                    value: String(fila.id),
                    label: fila.name,
                  })),
                ]}
                onChange={setWorker}
                className="max-w-xs"
              />
              <SelectField
                label="Técnica"
                requirement="optional"
                value={tecnica}
                options={[
                  { value: SIN_SELECCION, label: "Seleccionar..." },
                  ...(tecnicas.data?.items ?? []).map((fila) => ({
                    value: String(fila.id),
                    label: fila.name,
                  })),
                ]}
                onChange={setTecnica}
                className="max-w-xs"
              />
              <SelectField
                label="Personal adicional"
                requirement="optional"
                value={adicional ? "SI" : "NO"}
                options={[
                  { value: "NO", label: "No" },
                  { value: "SI", label: "Sí" },
                ]}
                onChange={(valor) => setAdicional(valor === "SI")}
                hint="Suma costo. No reduce el plazo."
                className="max-w-xs"
              />
              <PrimaryButton
                type="button"
                disabled={
                  anadir.isPending || worker === SIN_SELECCION || tecnica === SIN_SELECCION
                }
                onClick={() =>
                  anadir.mutate(
                    {
                      worker_id: Number(worker),
                      technique_id: Number(tecnica),
                      is_additional_personnel: adicional,
                    },
                    {
                      onSuccess: () => {
                        setWorker(SIN_SELECCION);
                        setTecnica(SIN_SELECCION);
                        setAdicional(false);
                      },
                    },
                  )
                }
              >
                {anadir.isPending ? "Añadiendo..." : "Añadir trabajo"}
              </PrimaryButton>
            </div>
          )}
          {anadir.isError ? (
            <p role="alert" className="mt-3 text-xs text-red-600">
              {describeError(anadir.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
