import { useMemo } from "react";
import type { FormEvent } from "react";

import { FormSection, TextField } from "@/components/form";
import { LogoField } from "@/features/settings/LogoField";
import { SaveBar } from "@/features/settings/SaveBar";
import { useEditableForm } from "@/features/settings/useEditableForm";
import { useCompanySettings, useUpdateCompany } from "@/features/settings/useSettings";
import type { CompanySettings, CompanySettingsInput } from "@/types/settings";

function toInput(settings: CompanySettings): CompanySettingsInput {
  const { version, updated_at: _updatedAt, logo: _logo, ...rest } = settings;
  return { ...rest, version };
}

/** Validacion de experiencia de usuario. El backend la repite entera. */
function validate(draft: CompanySettingsInput): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (draft.tax_id && !/^\d{11}$/.test(draft.tax_id)) {
    errors.tax_id = "El RUC peruano tiene 11 digitos.";
  }
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    errors.email = "Formato de correo no valido.";
  }
  if (draft.website && !/^https?:\/\//.test(draft.website)) {
    errors.website = "Debe empezar por http:// o https://";
  }
  return errors;
}

export function CompanySection({ canEdit }: { canEdit: boolean }) {
  const query = useCompanySettings();
  const update = useUpdateCompany();
  const inicial = useMemo(
    () => (query.data ? toInput(query.data) : undefined),
    [query.data],
  );
  const { draft, setField, reset, isDirty } = useEditableForm<CompanySettingsInput>(
    inicial,
  );

  if (!draft) return null;

  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || hasErrors || update.isPending) return;
    // Se envia la version que el servidor confirmo por ultima vez, no la que
    // se capturo al abrir el formulario.
    update.mutate({ ...draft, version: query.data?.version ?? draft.version });
  };

  const disabled = !canEdit || update.isPending;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-5">
        <FormSection title="Identificacion">
          <TextField
            label="Razon social"
            value={draft.legal_name}
            onChange={(value) => setField("legal_name", value)}
            disabled={disabled}
          />
          <TextField
            label="Nombre comercial"
            value={draft.trade_name}
            onChange={(value) => setField("trade_name", value)}
            disabled={disabled}
          />
          <TextField
            label="RUC"
            value={draft.tax_id}
            onChange={(value) => setField("tax_id", value)}
            disabled={disabled}
            inputMode="numeric"
            maxLength={11}
            error={errors.tax_id}
            hint="11 digitos"
          />
        </FormSection>

        <FormSection title="Domicilio">
          <TextField
            label="Direccion"
            value={draft.address_line1}
            onChange={(value) => setField("address_line1", value)}
            disabled={disabled}
            className="sm:col-span-2"
          />
          <TextField
            label="Referencia"
            value={draft.address_line2}
            onChange={(value) => setField("address_line2", value)}
            disabled={disabled}
            className="sm:col-span-2"
          />
          <TextField
            label="Distrito"
            value={draft.district}
            onChange={(value) => setField("district", value)}
            disabled={disabled}
          />
          <TextField
            label="Provincia"
            value={draft.province}
            onChange={(value) => setField("province", value)}
            disabled={disabled}
          />
          <TextField
            label="Departamento"
            value={draft.department}
            onChange={(value) => setField("department", value)}
            disabled={disabled}
          />
          <TextField
            label="Pais"
            value={draft.country}
            onChange={(value) => setField("country", value)}
            disabled={disabled}
          />
          <TextField
            label="Codigo postal"
            value={draft.postal_code}
            onChange={(value) => setField("postal_code", value)}
            disabled={disabled}
          />
        </FormSection>

        <FormSection title="Contacto">
          <TextField
            label="Telefono"
            value={draft.phone}
            onChange={(value) => setField("phone", value)}
            disabled={disabled}
            type="tel"
          />
          <TextField
            label="Celular"
            value={draft.mobile}
            onChange={(value) => setField("mobile", value)}
            disabled={disabled}
            type="tel"
          />
          <TextField
            label="Correo electronico"
            value={draft.email}
            onChange={(value) => setField("email", value)}
            disabled={disabled}
            type="email"
            error={errors.email}
          />
          <TextField
            label="Sitio web"
            value={draft.website}
            onChange={(value) => setField("website", value)}
            disabled={disabled}
            type="url"
            placeholder="https://"
            error={errors.website}
          />
          <TextField
            label="Persona de contacto"
            value={draft.contact_name}
            onChange={(value) => setField("contact_name", value)}
            disabled={disabled}
          />
          <TextField
            label="Cargo"
            value={draft.contact_role}
            onChange={(value) => setField("contact_role", value)}
            disabled={disabled}
          />
        </FormSection>

        <LogoField logo={query.data?.logo ?? null} canEdit={canEdit} />
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
