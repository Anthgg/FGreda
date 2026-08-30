import { useMemo } from "react";
import type { FormEvent } from "react";

import { FormSection, SelectField, TextAreaField, TextField } from "@/components/form";
import { toCommercialInput } from "@/features/settings/mappers";
import { SaveBar } from "@/features/settings/SaveBar";
import { useEditableForm } from "@/features/settings/useEditableForm";
import {
  useCommercialSettings,
  useReferenceData,
  useUpdateCommercial,
} from "@/features/settings/useSettings";
import type { CommercialSettingsInput } from "@/types/settings";

const ROUNDING_OPTIONS = [
  { value: "0.50", label: "S/ 0.50" },
  { value: "1.00", label: "S/ 1.00" },
];

/** Validación de experiencia de usuario. El backend la repite entera. */
function validate(draft: CommercialSettingsInput): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};

  if (draft.tax_percent !== null && draft.tax_percent !== "") {
    const value = Number(draft.tax_percent);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      errors.tax_percent = "Debe ser un porcentaje entre 0 y 100.";
    }
  }
  // El porcentaje de esmalte no admite vacio ni cero: cero no es "sin
  // esmalte", es una estimacion que siempre da cero gramos y hace desaparecer
  // el material del costo sin que nadie lo note.
  const glaze = String(draft.estimated_glaze_percent ?? "").trim();
  if (glaze === "") {
    errors.estimated_glaze_percent = "Indique un porcentaje mayor que cero.";
  } else {
    const value = Number(glaze);
    if (Number.isNaN(value) || value <= 0 || value > 100) {
      errors.estimated_glaze_percent = "Debe ser un porcentaje mayor que 0 y hasta 100.";
    }
  }
  // Fase 009E: el factor de PRODUCCION. El backend lo valida de nuevo; esto
  // solo evita el viaje.
  const factor = String(draft.production_factor_default ?? "").trim();
  if (factor === "" || Number.isNaN(Number(factor)) || Number(factor) <= 0) {
    errors.production_factor_default = "Debe ser un número mayor que 0.";
  }
  if (draft.quote_validity_days !== null) {
    const days = Number(draft.quote_validity_days);
    if (!Number.isInteger(days) || days < 1) {
      errors.quote_validity_days = "Debe ser un número entero de días mayor que cero.";
    }
  }
  const cci = draft.bank_account?.cci?.replace(/[\s-]/g, "");
  if (cci && !/^\d{20}$/.test(cci)) {
    errors.cci = "El CCI peruano tiene 20 dígitos.";
  }
  return errors;
}

export function CommercialSection({ canEdit }: { canEdit: boolean }) {
  const query = useCommercialSettings();
  const reference = useReferenceData();
  const update = useUpdateCommercial();
  const inicial = useMemo(
    () => (query.data ? toCommercialInput(query.data) : undefined),
    [query.data],
  );
  const { draft, setField, setDraft, reset, commit, isDirty } = useEditableForm<CommercialSettingsInput>(
    inicial,
  );

  if (!draft || !reference.data) return null;

  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;

  const setBankField = (field: keyof NonNullable<CommercialSettingsInput["bank_account"]>, value: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            bank_account: {
              bank_name: null,
              account_holder: null,
              account_number: null,
              cci: null,
              notes: null,
              ...current.bank_account,
              [field]: value === "" ? null : value,
            },
          }
        : current,
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || hasErrors || update.isPending) return;
    update.mutate(
      { ...draft, version: query.data?.version ?? draft.version },
      { onSuccess: (data) => commit(toCommercialInput(data)) },
    );
  };

  const disabled = !canEdit || update.isPending;
  // Solo existen dos políticas de redondeo, así que es un selector y no un
  // campo libre: un 0,25 tecleado produciría precios que no son múltiplos de
  // nada, y el backend lo rechazaría después de que el usuario ya escribió.
  const roundingValue = Number(draft.rounding_step) === 1 ? "1.00" : "0.50";
  const bank = draft.bank_account;
  const currencyOptions = [
    { value: "", label: "Sin moneda seleccionada" },
    ...reference.data.currencies.map((currency) => ({
      value: currency.code,
      label: `${currency.code} — ${currency.name} (${currency.symbol})`,
    })),
  ];

  const selectCurrency = (code: string) => {
    const selected = reference.data.currencies.find((currency) => currency.code === code);
    setDraft((current) =>
      current
        ? {
            ...current,
            currency_code: selected?.code ?? null,
            currency_symbol: selected?.symbol ?? null,
          }
        : current,
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-8">
        {/* MONEDA E IMPUESTOS */}
        <FormSection
          title="Moneda e Impuestos"
          description="Valores por defecto de las cotizaciones. El backend es quien los aplica."
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <SelectField
            label="Moneda (ISO 4217)"
            requirement="optional"
            value={draft.currency_code ?? ""}
            options={currencyOptions}
            onChange={selectCurrency}
            disabled={disabled}
          />
          <TextField
            label="Símbolo"
            requirement="automatic"
            value={draft.currency_symbol}
            onChange={() => {}}
            disabled={disabled}
            readOnly
            hint="Se asigna desde la moneda seleccionada."
          />
          <TextField
            label="IGV (%)"
            requirement="optional"
            value={draft.tax_percent === null ? null : String(draft.tax_percent)}
            onChange={(value) => setField("tax_percent", value === "" ? null : value)}
            disabled={disabled}
            inputMode="decimal"
            placeholder="18"
            hint="Porcentaje, no fracción: 18 significa 18%."
            error={errors.tax_percent}
          />
          <TextField
            label="Esmalte estimado (%)"
            requirement="required"
            value={
              draft.estimated_glaze_percent === undefined
                ? null
                : String(draft.estimated_glaze_percent)
            }
            onChange={(value) => setField("estimated_glaze_percent", value)}
            disabled={disabled}
            inputMode="decimal"
            placeholder="15"
            hint="Porcentaje del peso de la pieza. 15 significa 15 %, no 0,15."
            error={errors.estimated_glaze_percent}
          />
          <TextField
            label="Factor de producción"
            requirement="required"
            value={
              draft.production_factor_default === undefined
                ? null
                : String(draft.production_factor_default)
            }
            onChange={(value) => setField("production_factor_default", value)}
            disabled={disabled}
            inputMode="decimal"
            placeholder="3"
            hint="Multiplica el costo técnico antes de los costos fijos y del margen."
            error={errors.production_factor_default}
          />
          <SelectField
            label="Redondeo contractual"
            requirement="required"
            value={roundingValue}
            options={ROUNDING_OPTIONS}
            onChange={(value) => setField("rounding_step", value)}
            disabled={disabled}
            hint="El precio con IGV siempre sube al siguiente múltiplo."
          />
          <TextField
            label="Vigencia de cotización (días)"
            requirement="optional"
            value={draft.quote_validity_days === null ? null : String(draft.quote_validity_days)}
            onChange={(value) =>
              setField("quote_validity_days", value === "" ? null : Number(value))
            }
            disabled={disabled}
            inputMode="numeric"
            error={errors.quote_validity_days}
          />
        </FormSection>

        {/* DATOS BANCARIOS */}
        <FormSection
          title="Datos Bancarios"
          description="Cuenta principal para las instrucciones de pago."
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <TextField
            label="Banco"
            requirement="optional"
            value={bank?.bank_name ?? null}
            onChange={(value) => setBankField("bank_name", value)}
            disabled={disabled}
          />
          <TextField
            label="Titular"
            requirement="optional"
            value={bank?.account_holder ?? null}
            onChange={(value) => setBankField("account_holder", value)}
            disabled={disabled}
          />
          <TextField
            label="Número de cuenta"
            requirement="optional"
            value={bank?.account_number ?? null}
            onChange={(value) => setBankField("account_number", value)}
            disabled={disabled}
          />
          <TextField
            label="CCI"
            requirement="optional"
            value={bank?.cci ?? null}
            onChange={(value) => setBankField("cci", value)}
            disabled={disabled}
            inputMode="numeric"
            hint="20 dígitos"
            error={errors.cci}
          />
          <TextAreaField
            label="Instrucciones de pago"
            requirement="optional"
            value={bank?.notes ?? null}
            onChange={(value) => setBankField("notes", value)}
            disabled={disabled}
            rows={3}
            className="sm:col-span-2 lg:col-span-4"
          />
        </FormSection>
      </div>

      <SaveBar
        canEdit={canEdit}
        isDirty={isDirty && !hasErrors}
        isSaving={update.isPending}
        isSuccess={update.isSuccess && !isDirty}
        error={update.error}
        onCancel={reset}
        onReload={() => void query.refetch()}
      />
    </form>
  );
}
