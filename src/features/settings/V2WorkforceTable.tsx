import { useState } from "react";

import { FormSection, SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import {
  useCreateV2Technique,
  useCreateV2Worker,
  useUpdateV2Technique,
  useUpdateV2Worker,
  useV2Techniques,
  useV2Workers,
} from "@/features/cotizadorV2/useQuoterV2Labor";
import {
  WORKER_TYPE_LABEL,
  type V2Technique,
  type V2Worker,
  type V2WorkerType,
} from "@/types/quoterV2Labor";

/**
 * Trabajadores y técnicas del Cotizador V2.
 *
 * Aquí se configura lo único que el sistema necesita saber para costear la
 * mano de obra: **cuánto cuesta un día de cada persona** y **cuánto rinde una
 * jornada de cada técnica**. El precio de una tarea no se escribe en ningún
 * sitio: sale de esos dos números y de las horas que haga falta.
 *
 * Por eso la técnica no tiene campo de precio. «Torno = S/110» sería una
 * constante escondida que deja de ser cierta en cuanto cambia un jornal, y
 * nadie se enteraría.
 *
 * El rendimiento es un **estándar**, no una medición: que alguien haga hoy 70
 * piezas donde dice 50 no lo sube, y que haga 40 no lo baja. Cambiarlo es una
 * decisión de taller, y se toma en esta pantalla.
 */

const WORKER_TYPE_OPTIONS = (Object.keys(WORKER_TYPE_LABEL) as V2WorkerType[]).map((value) => ({
  value,
  label: WORKER_TYPE_LABEL[value],
}));

const SI_NO = [
  { value: "NO", label: "No" },
  { value: "SI", label: "Sí" },
] as const;

function Campo({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  disabled: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-zinc-500">{label}</span>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-black/10 px-2 py-1"
      />
      {hint ? <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Trabajadores
// ---------------------------------------------------------------------------
type WorkerDraft = {
  name: string;
  worker_type: string;
  daily_rate: string;
  workday_hours: string;
};

const WORKER_NUEVO: WorkerDraft = {
  name: "",
  worker_type: "INTERNAL",
  daily_rate: "",
  workday_hours: "",
};

function validarTrabajador(draft: WorkerDraft): string | null {
  if (draft.name.trim() === "") return "Indique el nombre.";
  const jornal = draft.daily_rate.trim();
  // Un campo vacío NO es un cero: `Number("")` da 0 y pasaría cualquier
  // comprobación de «>= 0», enviando una cadena vacía que el backend rechaza.
  if (jornal === "" || Number.isNaN(Number(jornal)) || Number(jornal) < 0) {
    return "Indique cuánto cuesta un día de esta persona.";
  }
  const jornada = draft.workday_hours.trim();
  if (jornada !== "" && (Number.isNaN(Number(jornada)) || !(Number(jornada) > 0))) {
    return "La jornada tiene que ser mayor que cero. Vacío: se usa la del taller.";
  }
  if (jornada !== "" && Number(jornada) > 24) return "Un día tiene 24 horas.";
  return null;
}

function WorkersTable({ canEdit }: { canEdit: boolean }) {
  const query = useV2Workers();
  const crear = useCreateV2Worker();
  const actualizar = useUpdateV2Worker();
  const [draft, setDraft] = useState<WorkerDraft>(WORKER_NUEVO);
  const [error, setError] = useState<string | null>(null);

  if (query.isPending) return <Spinner className="size-5" label="Cargando trabajadores..." />;
  if (query.isError) {
    return (
      <div role="alert" className="text-sm text-red-700">
        {describeError(query.error)}
      </div>
    );
  }

  const trabajadores = query.data?.items ?? [];
  const set = (campo: keyof WorkerDraft) => (valor: string) =>
    setDraft({ ...draft, [campo]: valor });

  const alta = () => {
    const problema = validarTrabajador(draft);
    setError(problema);
    if (problema) return;
    crear.mutate(
      {
        name: draft.name.trim(),
        worker_type: draft.worker_type as V2WorkerType,
        daily_rate: draft.daily_rate.trim(),
        workday_hours: draft.workday_hours.trim() === "" ? null : draft.workday_hours.trim(),
      },
      {
        onSuccess: () => setDraft(WORKER_NUEVO),
        onError: (fallo) => setError(describeError(fallo)),
      },
    );
  };

  const cambiarEstado = (worker: V2Worker) =>
    actualizar.mutate({
      id: worker.id,
      payload: { expected_version: worker.version, active: !worker.active },
    });

  return (
    <div className="sm:col-span-2 space-y-4">
      <p className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-xs text-zinc-600">
        La tarifa por hora no se escribe: es el jornal entre la jornada. Guardarla sería un segundo
        número capaz de contradecir al primero. Un trabajador del taller tiene sueldo y aun así sus
        horas cuestan: saber cuánto es la única forma de conocer el costo real de producir.
      </p>

      {trabajadores.length === 0 ? (
        <p className="text-xs text-zinc-500">Todavía no hay trabajadores dados de alta.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-semibold">Nombre</th>
                <th className="py-2 pr-3 font-semibold">Tipo</th>
                <th className="py-2 pr-3 font-semibold">Jornal</th>
                <th className="py-2 pr-3 font-semibold">Jornada</th>
                <th className="py-2 pr-3 font-semibold">Por hora</th>
                <th className="py-2 pr-3 font-semibold">Estado</th>
                {canEdit ? <th className="py-2 font-semibold" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {trabajadores.map((worker) => (
                <tr key={worker.id}>
                  <td className="py-2 pr-3 text-zinc-800">{worker.name}</td>
                  <td className="py-2 pr-3 text-zinc-600">
                    {WORKER_TYPE_LABEL[worker.worker_type]}
                  </td>
                  <td className="py-2 pr-3 text-zinc-600">{worker.daily_rate}</td>
                  <td className="py-2 pr-3 text-zinc-600">
                    {worker.effective_workday_hours}
                    {worker.workday_hours === null ? (
                      <span className="block text-[11px] text-zinc-400">del taller</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-zinc-800">{worker.hourly_rate}</td>
                  <td className="py-2 pr-3 text-zinc-600">
                    {worker.active ? "Activo" : "De baja"}
                  </td>
                  {canEdit ? (
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => cambiarEstado(worker)}
                        disabled={actualizar.isPending}
                        className="text-xs font-semibold text-zinc-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
                      >
                        {worker.active ? "Dar de baja" : "Reactivar"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit ? (
        <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4">
          <h4 className="text-sm font-semibold text-zinc-900">Nuevo trabajador</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Campo label="Nombre" value={draft.name} onChange={set("name")} disabled={crear.isPending} />
            <SelectField
              label="Tipo"
              requirement="required"
              value={draft.worker_type as V2WorkerType}
              options={WORKER_TYPE_OPTIONS}
              onChange={set("worker_type")}
              disabled={crear.isPending}
            />
            <Campo
              label="Jornal"
              value={draft.daily_rate}
              onChange={set("daily_rate")}
              disabled={crear.isPending}
            />
            <Campo
              label="Jornada propia (horas)"
              value={draft.workday_hours}
              onChange={set("workday_hours")}
              disabled={crear.isPending}
              hint="Vacío: usa la jornada del taller."
            />
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-xs text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={alta}
            disabled={crear.isPending}
            className="mt-4 text-xs font-semibold text-zinc-900 underline underline-offset-2 cursor-pointer disabled:opacity-40"
          >
            {crear.isPending ? "Guardando..." : "Dar de alta"}
          </button>
        </div>
      ) : null}

      {actualizar.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(actualizar.error)}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tecnicas
// ---------------------------------------------------------------------------
type TechniqueDraft = {
  code: string;
  name: string;
  default_capacity_per_workday: string;
  unit: string;
  requires_glaze: string;
};

const TECHNIQUE_NUEVA: TechniqueDraft = {
  code: "",
  name: "",
  default_capacity_per_workday: "",
  unit: "piezas",
  requires_glaze: "NO",
};

function validarTecnica(draft: TechniqueDraft): string | null {
  if (draft.code.trim() === "") return "Indique el código.";
  if (draft.name.trim() === "") return "Indique el nombre.";
  const capacidad = draft.default_capacity_per_workday.trim();
  if (capacidad === "" || Number.isNaN(Number(capacidad)) || !(Number(capacidad) > 0)) {
    return "Indique cuánto rinde una jornada. Cero sería una división por cero.";
  }
  return null;
}

function TechniquesTable({ canEdit }: { canEdit: boolean }) {
  const query = useV2Techniques();
  const crear = useCreateV2Technique();
  const actualizar = useUpdateV2Technique();
  const [draft, setDraft] = useState<TechniqueDraft>(TECHNIQUE_NUEVA);
  const [error, setError] = useState<string | null>(null);

  if (query.isPending) return <Spinner className="size-5" label="Cargando técnicas..." />;
  if (query.isError) {
    return (
      <div role="alert" className="text-sm text-red-700">
        {describeError(query.error)}
      </div>
    );
  }

  const tecnicas = query.data?.items ?? [];
  const set = (campo: keyof TechniqueDraft) => (valor: string) =>
    setDraft({ ...draft, [campo]: valor });

  const alta = () => {
    const problema = validarTecnica(draft);
    setError(problema);
    if (problema) return;
    crear.mutate(
      {
        code: draft.code.trim(),
        name: draft.name.trim(),
        default_capacity_per_workday: draft.default_capacity_per_workday.trim(),
        unit: draft.unit.trim() || "piezas",
        requires_glaze: draft.requires_glaze === "SI",
      },
      {
        onSuccess: () => setDraft(TECHNIQUE_NUEVA),
        onError: (fallo) => setError(describeError(fallo)),
      },
    );
  };

  const cambiarEstado = (tecnica: V2Technique) =>
    actualizar.mutate({
      id: tecnica.id,
      payload: { expected_version: tecnica.version, active: !tecnica.active },
    });

  return (
    <div className="sm:col-span-2 space-y-4">
      <p className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-xs text-zinc-600">
        Una técnica dice <strong>cuánto rinde una jornada</strong>, no cuánto cuesta. El costo lo
        pone quien la ejecuta. El rendimiento es un estándar configurado: el sistema no lo cambia
        solo porque un día se produzca más o menos.
      </p>

      {tecnicas.length === 0 ? (
        <p className="text-xs text-zinc-500">Todavía no hay técnicas en el catálogo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-semibold">Código</th>
                <th className="py-2 pr-3 font-semibold">Nombre</th>
                <th className="py-2 pr-3 font-semibold">Por jornada</th>
                <th className="py-2 pr-3 font-semibold">Por hora</th>
                <th className="py-2 pr-3 font-semibold">Necesita esmalte</th>
                <th className="py-2 pr-3 font-semibold">Estado</th>
                {canEdit ? <th className="py-2 font-semibold" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {tecnicas.map((tecnica) => (
                <tr key={tecnica.id}>
                  <td className="py-2 pr-3 text-zinc-600">{tecnica.code}</td>
                  <td className="py-2 pr-3 text-zinc-800">{tecnica.name}</td>
                  <td className="py-2 pr-3 text-zinc-600">
                    {tecnica.default_capacity_per_workday} {tecnica.unit}
                  </td>
                  <td className="py-2 pr-3 text-zinc-800">{tecnica.units_per_hour}</td>
                  <td className="py-2 pr-3 text-zinc-600">
                    {tecnica.requires_glaze ? "Sí" : "No"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-600">
                    {tecnica.active ? "Activa" : "Retirada"}
                  </td>
                  {canEdit ? (
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => cambiarEstado(tecnica)}
                        disabled={actualizar.isPending}
                        className="text-xs font-semibold text-zinc-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
                      >
                        {tecnica.active ? "Retirar" : "Reactivar"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit ? (
        <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4">
          <h4 className="text-sm font-semibold text-zinc-900">Nueva técnica</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Campo label="Código" value={draft.code} onChange={set("code")} disabled={crear.isPending} />
            <Campo label="Nombre" value={draft.name} onChange={set("name")} disabled={crear.isPending} />
            <Campo
              label="Rinde por jornada"
              value={draft.default_capacity_per_workday}
              onChange={set("default_capacity_per_workday")}
              disabled={crear.isPending}
            />
            <Campo label="Unidad" value={draft.unit} onChange={set("unit")} disabled={crear.isPending} />
            <SelectField
              label="Necesita esmalte"
              requirement="required"
              value={draft.requires_glaze as "SI" | "NO"}
              options={SI_NO}
              onChange={set("requires_glaze")}
              disabled={crear.isPending}
              hint="Avisa si se asigna a una pieza sin esmalte."
            />
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-xs text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={alta}
            disabled={crear.isPending}
            className="mt-4 text-xs font-semibold text-zinc-900 underline underline-offset-2 cursor-pointer disabled:opacity-40"
          >
            {crear.isPending ? "Guardando..." : "Añadir al catálogo"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function V2WorkforceTable({ canEdit }: { canEdit: boolean }) {
  return (
    <>
      <FormSection
        title="Trabajadores"
        description="Cuánto cuesta un día de cada persona. La tarifa por hora se deriva de ahí."
      >
        <WorkersTable canEdit={canEdit} />
      </FormSection>
      <FormSection
        title="Técnicas"
        description="Cuánto rinde una jornada de cada técnica. Rendimiento, nunca precio."
      >
        <TechniquesTable canEdit={canEdit} />
      </FormSection>
    </>
  );
}
