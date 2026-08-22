import { useMemo } from "react";
import type { FormEvent } from "react";

import { FormSection, TextAreaField, TextField } from "@/components/form";
import { toCommercialInput } from "@/features/settings/mappers";
import { SaveBar } from "@/features/settings/SaveBar";
import { useEditableForm } from "@/features/settings/useEditableForm";
import { useCommercialSettings, useUpdateCommercial } from "@/features/settings/useSettings";
import type { CommercialSettingsInput } from "@/types/settings";

/** Validacion de experiencia de usuario. El backend la repite entera. */
function validate(draft: CommercialSettingsInput): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};

  if (draft.currency_code && !/^[A-Za-z]{3}$/.test(draft.currency_code)) {
    errors.currency_code = "Codigo ISO de tres letras, por ejemplo PEN.";
  }
  if (draft.tax_percent !== null && draft.tax_percent !== "") {
    const value = Number(draft.tax_percent);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      errors.tax_percent = "Debe ser un porcentaje entre 0 y 100.";
    }
  }
  if (draft.quote_validity_days !== null) {
    const days = Number(draft.quote_validity_days);
    if (!Number.isInteger(days) || days < 1) {
      errors.quote_validity_days = "Debe ser un numero entero de dias mayor que cero.";
    }
  }
  const cci = draft.bank_account?.cci?.replace(/[\s-]/g, "");
  if (cci && !/^\d{20}$/.test(cci)) {
    errors.cci = "El CCI peruano tiene 20 digitos.";
  }
  return errors;
}

export function CommercialSection({ canEdit }: { canEdit: boolean }) {
  const query = useCommercialSettings();
  const update = useUpdateCommercial();
  const inicial = useMemo(
    () => (query.data ? toCommercialInput(query.data) : undefined),
    [query.data],
  );
  const { draft, setField, setDraft, reset, isDirty } = useEditableForm<CommercialSettingsInput>(
    inicial,
  );

  if (!draft) return null;

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
    // Se envia la version que el servidor confirmo por ultima vez, no la que
    // se capturo al abrir el formulario: asi guardar en otra pestana de esta
    // misma pantalla no provoca un conflicto contra uno mismo.
    update.mutate({ ...draft, version: query.data?.version ?? draft.version });
  };

  const disabled = !canEdit || update.isPending;
  const bank = draft.bank_account;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-5">
        <FormSection
          title="Moneda e impuestos"
          description="Valores por defecto de las cotizaciones. El backend es quien los aplica."
        >
          <TextField
            label="Moneda (ISO 4217)"
            value={draft.currency_code}
            onChange={(value) => setField("currency_code", value.toUpperCase())}
            disabled={disabled}
            maxLength={3}
            placeholder="PEN"
            error={errors.currency_code}
          />
          <TextField
            label="Simbolo"
            value={draft.currency_symbol}
            onChange={(value) => setField("currency_symbol", value)}
            disabled={disabled}
            maxLength={8}
            placeholder="S/"
          />
          <TextField
            label="IGV (%)"
            value={draft.tax_percent === null ? null : String(draft.tax_percent)}
            onChange={(value) => setField("tax_percent", value === "" ? null : value)}
            disabled={disabled}
            inputMode="decimal"
            placeholder="18"
            hint="Porcentaje, no fraccion: 18 significa 18 %."
            error={errors.tax_percent}
          />
          <TextField
            label="Vigencia de cotizacion (dias)"
            value={draft.quote_validity_days === null ? null : String(draft.quote_validity_days)}
            onChange={(value) =>
              setField("quote_validity_days", value === "" ? null : Number(value))
            }
            disabled={disabled}
            inputMode="numeric"
            error={errors.quote_validity_days}
          />
        </FormSection>

        <FormSection
          title="Datos bancarios"
          description="Cuenta principal para las instrucciones de pago."
        >
          <TextField
            label="Banco"
            value={bank?.bank_name ?? null}
            onChange={(value) => setBankField("bank_name", value)}
            disabled={disabled}
          />
          <TextField
            label="Titular"
            value={bank?.account_holder ?? null}
            onChange={(value) => setBankField("account_holder", value)}
            disabled={disabled}
          />
          <TextField
            label="Numero de cuenta"
            value={bank?.account_number ?? null}
            onChange={(value) => setBankField("account_number", value)}
            disabled={disabled}
          />
          <TextField
            label="CCI"
            value={bank?.cci ?? null}
            onChange={(value) => setBankField("cci", value)}
            disabled={disabled}
            inputMode="numeric"
            hint="20 digitos"
            error={errors.cci}
          />
          <TextAreaField
            label="Instrucciones de pago"
            value={bank?.notes ?? null}
            onChange={(value) => setBankField("notes", value)}
            disabled={disabled}
            rows={2}
            className="sm:col-span-2"
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
