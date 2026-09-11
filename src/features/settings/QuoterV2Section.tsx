import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { FormSection, PrimaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import {
  useSetV2KilnRate,
  useUpdateV2Settings,
  useV2Settings,
} from "@/features/settings/useQuoterV2Settings";
import type { V2CustomerKind, V2ProductionType } from "@/types/quoterV2";
import {
  FIRING_TYPE_LABEL,
  type FiringType,
  type V2KilnRate,
  type V2SettingsUpdateInput,
  type V2SettingsValues,
} from "@/types/quoterV2Settings";

/**
 * Configuración del Cotizador V2.
 *
 * Define con qué números NACE una cotización nueva. No toca las que ya
 * existen: cada una se llevó su copia al crearse, y por eso subir el costo del
 * taller no reescribe un precio que ya se envió a un cliente.
 *
 * El IGV, la moneda y su símbolo se muestran aquí pero no se editan aquí: su
 * único dueño es la pestaña Comercial. Una segunda puerta para el mismo dato
 * sería una segunda verdad.
 */

const PRODUCTION_TYPE_OPTIONS: readonly { value: V2ProductionType; label: string }[] = [
  { value: "RETAIL", label: "Por menor" },
  { value: "WHOLESALE", label: "Por mayor" },
];

const CUSTOMER_KIND_OPTIONS: readonly { value: V2CustomerKind; label: string }[] = [
  { value: "EXTERNAL", label: "Cliente externo" },
  { value: "STUDENT", label: "Alumno" },
];

const SI_NO: readonly { value: "SI" | "NO"; label: string }[] = [
  { value: "SI", label: "Sí" },
  { value: "NO", label: "No" },
];

type Draft = Record<string, string>;

function toDraft(values: V2SettingsValues): Draft {
  return {
    workday_hours: values.workday_hours,
    space_service_cost_per_day: values.space_service_cost_per_day,
    administrative_cost_per_quote: values.administrative_cost_per_quote,
    commercial_factor_min: values.commercial_factor_min,
    commercial_factor_default: values.commercial_factor_default,
    commercial_factor_max: values.commercial_factor_max,
    quotation_validity_days: String(values.quotation_validity_days),
    default_exchange_rate: values.default_exchange_rate,
    default_production_type: values.default_production_type,
    default_customer_kind: values.default_customer_kind,
    low_fire_enabled_default: values.low_fire_enabled_default ? "SI" : "NO",
    high_fire_enabled_default: values.high_fire_enabled_default ? "SI" : "NO",
    illustration_daily_rate: values.illustration_daily_rate,
    illustration_pieces_per_workday: values.illustration_pieces_per_workday,
  };
}

/** Validación de experiencia de usuario. El backend la repite entera. */
function validate(draft: Draft): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  const crudo = (campo: string) => String(draft[campo] ?? "").trim();
  const numero = (campo: string) => Number(crudo(campo));

  // Un campo vacío NO es un cero: `Number("")` da 0 y pasaría cualquier
  // comprobación de «>= 0», enviando una cadena vacía que el backend rechaza
  // con un 422 que el usuario no esperaba.
  for (const campo of [
    "workday_hours",
    "space_service_cost_per_day",
    "administrative_cost_per_quote",
    "quotation_validity_days",
    "default_exchange_rate",
    "commercial_factor_min",
    "commercial_factor_default",
    "commercial_factor_max",
    "illustration_daily_rate",
    "illustration_pieces_per_workday",
  ]) {
    if (crudo(campo) === "" || Number.isNaN(numero(campo))) {
      errors[campo] = "Indique un valor.";
    }
  }
  if (Object.keys(errors).length > 0) return errors;

  if (!(numero("workday_hours") > 0)) {
    // Cero horas sería una división por cero en cuanto se calcule una tarifa
    // por hora, que es justo para lo que sirve este campo.
    errors.workday_hours = "La jornada tiene que ser mayor que cero.";
  }
  for (const campo of ["space_service_cost_per_day", "administrative_cost_per_quote"]) {
    if (!(numero(campo) >= 0)) errors[campo] = "No puede ser negativo.";
  }
  if (!(numero("quotation_validity_days") > 0)) {
    errors.quotation_validity_days = "La vigencia tiene que ser de al menos un día.";
  }
  if (!(numero("default_exchange_rate") > 0)) {
    errors.default_exchange_rate = "El tipo de cambio tiene que ser mayor que cero.";
  }

  const min = numero("commercial_factor_min");
  const porDefecto = numero("commercial_factor_default");
  const max = numero("commercial_factor_max");
  if (!(min >= 2)) {
    errors.commercial_factor_min = "El mínimo no puede bajar de ×2.";
  }
  if (!(max >= min)) {
    errors.commercial_factor_max = "El máximo no puede ser menor que el mínimo.";
  }
  if (!(porDefecto >= min && porDefecto <= max)) {
    errors.commercial_factor_default = "Tiene que estar entre el mínimo y el máximo.";
  }
  if (!(numero("illustration_daily_rate") >= 0)) {
    errors.illustration_daily_rate = "No puede ser negativo.";
  }
  if (!(numero("illustration_pieces_per_workday") > 0)) {
    errors.illustration_pieces_per_workday = "Indique cuántas piezas se ilustran por jornada.";
  }
  return errors;
}

//: Campos de texto que viajan tal cual. Se recorren en vez de escribirse uno a
//: uno para que anadir uno no signifique tocar tres sitios.
const TEXT_FIELDS = [
  "workday_hours",
  "space_service_cost_per_day",
  "administrative_cost_per_quote",
  "commercial_factor_min",
  "commercial_factor_default",
  "commercial_factor_max",
  "default_exchange_rate",
  "illustration_daily_rate",
  "illustration_pieces_per_workday",
] as const;

function toPayload(draft: Draft, version: number): V2SettingsUpdateInput {
  const payload: V2SettingsUpdateInput = {
    expected_version: version,
    quotation_validity_days: Number(draft.quotation_validity_days),
    default_production_type: draft.default_production_type as V2ProductionType,
    default_customer_kind: draft.default_customer_kind as V2CustomerKind,
    low_fire_enabled_default: draft.low_fire_enabled_default === "SI",
    high_fire_enabled_default: draft.high_fire_enabled_default === "SI",
  };
  // Sin claves indefinidas: el backend distingue «no lo mandes» de «mandalo
  // vacio», y una clave con `undefined` acabaria pareciendo lo segundo.
  for (const campo of TEXT_FIELDS) {
    const valor = draft[campo];
    if (valor !== undefined) payload[campo] = valor;
  }
  return payload;
}

function QuoterV2Form({ canEdit }: { canEdit: boolean }) {
  const query = useV2Settings();
  const save = useUpdateV2Settings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const values = query.data?.settings;
  // El borrador se rellena UNA vez por version cargada, no cada vez que la
  // consulta devuelve un objeto nuevo. Sin el guardia, cualquier refetch
  // —volver a la pestaña, una invalidación— reescribiría el formulario con los
  // valores del servidor y el usuario vería desaparecer lo que estaba
  // escribiendo, sin ningún aviso.
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  useEffect(() => {
    if (values && values.version !== loadedVersion) {
      setDraft(toDraft(values));
      setLoadedVersion(values.version);
    }
  }, [values, loadedVersion]);

  if (query.isPending) return <Spinner className="size-5" label="Cargando configuración V2..." />;
  if (query.isError || !query.data || !draft) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {describeError(query.error)}
      </div>
    );
  }

  const config = query.data.settings;
  const set = (campo: string) => (valor: string) =>
    setDraft((actual) => ({ ...(actual ?? {}), [campo]: valor }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const encontrados = validate(draft);
    setErrors(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    save.mutate(toPayload(draft, config.version));
  };

  return (
    // `noValidate`: la validación del navegador bloquearía el envío de un
    // campo `required` vacío ANTES de llegar a la nuestra, con un mensaje
    // que no controlamos y en el idioma del navegador. Con una sola puerta,
    // los mensajes son los del producto y dicen qué corregir.
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <p className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-xs text-zinc-600">
        Estos valores definen con qué nace una cotización <strong>nueva</strong> del Cotizador V2.
        Las cotizaciones que ya existen no cambian: cada una guardó su propia copia al crearse.
      </p>

      <FormSection title="General" description="Jornada y costos que se reparten por cotización.">
        <TextField
          label="Jornada (horas)"
          requirement="required"
          value={draft.workday_hours ?? ""}
          onChange={set("workday_hours")}
          disabled={!canEdit}
          inputMode="decimal"
          hint="De aquí sale la tarifa por hora de cualquier trabajo."
          error={errors.workday_hours}
        />
        <TextField
          label="Espacio y servicios por día"
          requirement="required"
          value={draft.space_service_cost_per_day ?? ""}
          onChange={set("space_service_cost_per_day")}
          disabled={!canEdit}
          inputMode="decimal"
          hint="Por día efectivo de uso del taller, no por día de vigencia."
          error={errors.space_service_cost_per_day}
        />
        <TextField
          label="Administración por cotización"
          requirement="required"
          value={draft.administrative_cost_per_quote ?? ""}
          onChange={set("administrative_cost_per_quote")}
          disabled={!canEdit}
          inputMode="decimal"
          hint="Una sola vez por cotización, sean diez piezas o mil."
          error={errors.administrative_cost_per_quote}
        />
        <TextField
          label="Vigencia (días)"
          requirement="required"
          value={draft.quotation_validity_days ?? ""}
          onChange={set("quotation_validity_days")}
          disabled={!canEdit}
          inputMode="numeric"
          hint="Cuánto tiempo se respeta el precio. No es el plazo de producción."
          error={errors.quotation_validity_days}
        />
      </FormSection>

      <FormSection
        title="Factor comercial"
        description="Global por cotización, nunca por producto. Mínimo ×2 por regla de la casa."
      >
        <TextField
          label="Factor mínimo"
          requirement="required"
          value={draft.commercial_factor_min ?? ""}
          onChange={set("commercial_factor_min")}
          disabled={!canEdit}
          inputMode="decimal"
          error={errors.commercial_factor_min}
        />
        <TextField
          label="Factor por defecto"
          requirement="required"
          value={draft.commercial_factor_default ?? ""}
          onChange={set("commercial_factor_default")}
          disabled={!canEdit}
          inputMode="decimal"
          error={errors.commercial_factor_default}
        />
        <TextField
          label="Factor máximo"
          requirement="required"
          value={draft.commercial_factor_max ?? ""}
          onChange={set("commercial_factor_max")}
          disabled={!canEdit}
          inputMode="decimal"
          error={errors.commercial_factor_max}
        />
      </FormSection>

      <FormSection
        title="Comercial"
        description="El IGV y la moneda se editan en la pestaña Comercial: son los de toda la casa."
      >
        <TextField
          label="IGV (%)"
          requirement="automatic"
          value={config.tax_percent ?? "Sin definir"}
          onChange={() => {}}
          readOnly
          hint="Fuente: configuración comercial de la empresa."
        />
        <TextField
          label="Moneda base"
          requirement="automatic"
          value={config.currency_code ?? "Sin definir"}
          onChange={() => {}}
          readOnly
          hint="Fuente: configuración comercial de la empresa."
        />
        <TextField
          label="Tipo de cambio de referencia"
          requirement="required"
          value={draft.default_exchange_rate ?? ""}
          onChange={set("default_exchange_rate")}
          disabled={!canEdit}
          inputMode="decimal"
          hint="Manual. La cotización en USD se lleva su copia al crearse."
          error={errors.default_exchange_rate}
        />
      </FormSection>

      <FormSection
        title="Producción por defecto"
        description="Con qué nace una cotización. Quien cotiza puede cambiarlo; el sistema nunca lo cambia solo."
      >
        <SelectField
          label="Tipo de producción"
          requirement="required"
          value={(draft.default_production_type ?? "RETAIL") as V2ProductionType}
          options={PRODUCTION_TYPE_OPTIONS}
          onChange={set("default_production_type")}
          disabled={!canEdit}
        />
        <SelectField
          label="Tipo de cliente"
          requirement="required"
          value={(draft.default_customer_kind ?? "EXTERNAL") as V2CustomerKind}
          options={CUSTOMER_KIND_OPTIONS}
          onChange={set("default_customer_kind")}
          disabled={!canEdit}
          hint="Decide qué tarifa de horno se aplica. Nunca se deduce del nombre."
        />
        <SelectField
          label="Quema baja activa por defecto"
          requirement="required"
          value={(draft.low_fire_enabled_default ?? "SI") as "SI" | "NO"}
          options={SI_NO}
          onChange={set("low_fire_enabled_default")}
          disabled={!canEdit}
        />
        <SelectField
          label="Quema alta activa por defecto"
          requirement="required"
          value={(draft.high_fire_enabled_default ?? "SI") as "SI" | "NO"}
          options={SI_NO}
          onChange={set("high_fire_enabled_default")}
          disabled={!canEdit}
          hint="Cada cotización puede apagar cualquiera de las dos."
        />
      </FormSection>

      <FormSection
        title="Ilustración"
        description="Independiente de la mano de obra técnica: ilustrar no es tornear."
      >
        <TextField
          label="Jornal de ilustración"
          requirement="required"
          value={draft.illustration_daily_rate ?? ""}
          onChange={set("illustration_daily_rate")}
          disabled={!canEdit}
          inputMode="decimal"
          error={errors.illustration_daily_rate}
        />
        <TextField
          label="Piezas por jornada"
          requirement="required"
          value={draft.illustration_pieces_per_workday ?? ""}
          onChange={set("illustration_pieces_per_workday")}
          disabled={!canEdit}
          inputMode="decimal"
          error={errors.illustration_pieces_per_workday}
        />
        <TextField
          label="Tarifa por hora"
          requirement="automatic"
          value={config.illustration_hourly_rate}
          onChange={() => {}}
          readOnly
          hint="Se calcula: jornal ÷ jornada. No se guarda, para que no pueda contradecirlas."
        />
      </FormSection>

      {canEdit ? (
        <div className="mt-8 border-t border-black/[0.04] pt-6">
          {save.isError ? (
            <p role="alert" className="mb-3 text-xs text-red-600">
              {describeError(save.error)}
            </p>
          ) : null}
          {save.isSuccess ? (
            <p className="mb-3 text-xs text-emerald-700">Configuración guardada.</p>
          ) : null}
          <PrimaryButton type="submit" disabled={save.isPending}>
            {save.isPending ? "Guardando..." : "Guardar configuración V2"}
          </PrimaryButton>
        </div>
      ) : (
        <p className="mt-8 border-t border-black/[0.04] pt-4 text-xs text-zinc-500">
          Solo un administrador puede modificar esta configuración.
        </p>
      )}
    </form>
  );
}

/**
 * La sección entera: el formulario de configuración y, FUERA de él, la tabla
 * de hornos.
 *
 * Fuera a propósito. Anidada dentro del `<form>`, pulsar Enter mientras se
 * edita una tarifa dispararía el submit del formulario padre y guardaría la
 * configuración global en lugar de la fila del horno —con su control de
 * versiones y todo—, que es justo lo que el usuario no pidió.
 */
export function QuoterV2Section({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="space-y-8">
      <QuoterV2Form canEdit={canEdit} />
      <KilnRatesTable canEdit={canEdit} />
    </div>
  );
}

/**
 * Costo real del gas y tarifas comerciales, por horno y tipo de quema.
 *
 * Tres números distintos a propósito: lo que cuesta encender no es lo que se
 * cobra, y lo que paga un alumno no es lo que paga un cliente externo. La
 * diferencia entre lo cobrado y el gas es la ganancia propia de la quema.
 */
function KilnRatesTable({ canEdit }: { canEdit: boolean }) {
  const query = useV2Settings();
  const save = useSetV2KilnRate();
  const [editing, setEditing] = useState<string | null>(null);
  const [row, setRow] = useState<Record<string, string>>({});

  const rates = query.data?.kiln_rates ?? [];

  const guardar = (kilnId: number, firingType: FiringType) => {
    save.mutate({ kilnId, firingType, payload: row }, { onSuccess: () => setEditing(null) });
  };

  /**
   * Al entrar en edición se copian los TRES valores actuales, no un objeto
   * vacío. Con `{}`, cambiar solo una casilla enviaría únicamente esa y las
   * otras dos dependerían de que el backend las conserve: funciona, pero deja
   * el contrato al azar de una decisión que está en el otro lado.
   */
  const empezarEdicion = (rate: V2KilnRate) => {
    setRow({
      gas_cost: rate.gas_cost,
      external_rate: rate.external_rate,
      student_rate: rate.student_rate,
    });
    setEditing(`${rate.kiln_id}-${rate.firing_type}`);
  };

  return (
    <FormSection
      title="Hornos"
      description="Costo real del gas y tarifas de quema. Se configuran por horno; el sistema no adivina cuál es el chico."
    >
      <div className="sm:col-span-2 overflow-x-auto">
        {save.isError ? (
          <p role="alert" className="mb-3 text-xs text-red-600">
            {describeError(save.error)}
          </p>
        ) : null}
        {rates.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Todavía no hay hornos activos. Dé uno de alta en Quemas y aquí podrá fijar su costo de
            gas y sus tarifas.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-semibold">Horno</th>
                <th className="py-2 pr-3 font-semibold">Quema</th>
                <th className="py-2 pr-3 font-semibold">Gas real</th>
                <th className="py-2 pr-3 font-semibold">Externo</th>
                <th className="py-2 pr-3 font-semibold">Alumno</th>
                {canEdit ? <th className="py-2 font-semibold" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rates.map((rate) => {
                const clave = `${rate.kiln_id}-${rate.firing_type}`;
                const enEdicion = editing === clave;
                return (
                  <tr key={clave}>
                    <td className="py-2 pr-3 text-zinc-800">{rate.kiln_name}</td>
                    <td className="py-2 pr-3 text-zinc-600">
                      {FIRING_TYPE_LABEL[rate.firing_type]}
                    </td>
                    {(["gas_cost", "external_rate", "student_rate"] as const).map((campo) => (
                      <td key={campo} className="py-2 pr-3">
                        {enEdicion ? (
                          <input
                            aria-label={`${campo} de ${rate.kiln_name} ${rate.firing_type}`}
                            value={row[campo] ?? rate[campo]}
                            onChange={(event) =>
                              setRow((actual) => ({ ...actual, [campo]: event.target.value }))
                            }
                            disabled={save.isPending}
                            inputMode="decimal"
                            className="w-24 rounded-lg border border-black/10 px-2 py-1"
                          />
                        ) : rate.configured ? (
                          rate[campo]
                        ) : (
                          <span className="text-zinc-400">sin configurar</span>
                        )}
                      </td>
                    ))}
                    {canEdit ? (
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={save.isPending}
                          onClick={() =>
                            enEdicion
                              ? guardar(rate.kiln_id, rate.firing_type)
                              : empezarEdicion(rate)
                          }
                          className="text-xs font-semibold text-zinc-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
                        >
                          {enEdicion && save.isPending
                            ? "Guardando..."
                            : enEdicion
                              ? "Guardar"
                              : rate.configured
                                ? "Editar"
                                : "Configurar"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </FormSection>
  );
}
