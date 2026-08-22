import { useMemo } from "react";
import type { FormEvent } from "react";

import { FormSection, SelectField, TextField } from "@/components/form";
import { LogoField } from "@/features/settings/LogoField";
import { SaveBar } from "@/features/settings/SaveBar";
import { useEditableForm } from "@/features/settings/useEditableForm";
import {
  useCompanySettings,
  useReferenceData,
  useUpdateCompany,
} from "@/features/settings/useSettings";
import type { CompanySettings, CompanySettingsInput, UbigeoOption } from "@/types/settings";

function toInput(settings: CompanySettings): CompanySettingsInput {
  const { version, updated_at: _updatedAt, logo: _logo, ...rest } = settings;
  return { ...rest, version };
}

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase("es-PE")
    .replace(/(^|\s)(\p{L})/gu, (_match, space: string, letter: string) =>
      `${space}${letter.toLocaleUpperCase("es-PE")}`,
    );
}

function uniqueOptions(
  rows: UbigeoOption[],
  codeField: "department_code" | "province_code",
  nameField: "department_name" | "province_name",
) {
  return Array.from(new Map(rows.map((row) => [row[codeField], row[nameField]])).entries()).map(
    ([value, name]) => ({ value, label: titleCase(name) }),
  );
}

/** Validación de experiencia de usuario. El backend la repite entera. */
function validate(draft: CompanySettingsInput): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (draft.tax_id && !/^\d{11}$/.test(draft.tax_id)) {
    errors.tax_id = "El RUC peruano tiene 11 dígitos.";
  }
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    errors.email = "Formato de correo no válido.";
  }
  if (draft.website && !/^https?:\/\//.test(draft.website)) {
    errors.website = "Debe empezar por http:// o https://";
  }
  if (draft.department && !draft.province) {
    errors.province = "Seleccione una provincia del departamento.";
  }
  if ((draft.department || draft.province || draft.district || draft.country) && !draft.ubigeo_code) {
    errors.district = "Complete la ubicación seleccionando un distrito INEI.";
  }
  return errors;
}

export function CompanySection({ canEdit }: { canEdit: boolean }) {
  const query = useCompanySettings();
  const reference = useReferenceData();
  const update = useUpdateCompany();
  const inicial = useMemo(
    () => (query.data ? toInput(query.data) : undefined),
    [query.data],
  );
  const { draft, setField, setDraft, reset, commit, isDirty } =
    useEditableForm<CompanySettingsInput>(inicial);

  if (!draft || !reference.data) return null;

  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const allDistricts = reference.data.districts;
  const departmentCode =
    draft.ubigeo_code?.slice(0, 2) ??
    allDistricts.find((item) => item.department_name === draft.department)?.department_code ??
    "";
  const provinceRows = allDistricts.filter((item) => item.department_code === departmentCode);
  const provinceCode =
    draft.ubigeo_code?.slice(0, 4) ??
    provinceRows.find((item) => item.province_name === draft.province)?.province_code ??
    "";
  const districtRows = provinceRows.filter((item) => item.province_code === provinceCode);

  const departmentOptions = [
    { value: "", label: "Seleccionar departamento" },
    ...uniqueOptions(allDistricts, "department_code", "department_name"),
  ];
  const provinceOptions = [
    { value: "", label: departmentCode ? "Seleccionar provincia" : "Primero el departamento" },
    ...uniqueOptions(provinceRows, "province_code", "province_name"),
  ];
  const districtOptions = [
    { value: "", label: provinceCode ? "Seleccionar distrito" : "Primero la provincia" },
    ...districtRows.map((item) => ({ value: item.code, label: titleCase(item.district_name) })),
  ];

  const selectDepartment = (code: string) => {
    const selected = allDistricts.find((item) => item.department_code === code);
    setDraft((current) =>
      current
        ? {
            ...current,
            ubigeo_code: null,
            department: selected?.department_name ?? null,
            province: null,
            district: null,
            country: selected ? "Perú" : null,
          }
        : current,
    );
  };

  const selectProvince = (code: string) => {
    const selected = provinceRows.find((item) => item.province_code === code);
    setDraft((current) =>
      current
        ? {
            ...current,
            ubigeo_code: null,
            province: selected?.province_name ?? null,
            district: null,
          }
        : current,
    );
  };

  const selectDistrict = (code: string) => {
    const selected = districtRows.find((item) => item.code === code);
    setDraft((current) =>
      current
        ? {
            ...current,
            ubigeo_code: selected?.code ?? null,
            department: selected?.department_name ?? current.department,
            province: selected?.province_name ?? current.province,
            district: selected?.district_name ?? null,
            country: selected ? "Perú" : current.country,
          }
        : current,
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || hasErrors || update.isPending) return;
    update.mutate(
      { ...draft, version: query.data?.version ?? draft.version },
      { onSuccess: (data) => commit(toInput(data)) },
    );
  };

  const disabled = !canEdit || update.isPending;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-8">
        {/* IDENTIFICACIÓN */}
        <FormSection title="Identificación" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Razón social"
            requirement="optional"
            value={draft.legal_name}
            onChange={(value) => setField("legal_name", value)}
            disabled={disabled}
          />
          <TextField
            label="Nombre comercial"
            requirement="optional"
            value={draft.trade_name}
            onChange={(value) => setField("trade_name", value)}
            disabled={disabled}
          />
          <TextField
            label="RUC"
            requirement="optional"
            value={draft.tax_id}
            onChange={(value) => setField("tax_id", value)}
            disabled={disabled}
            inputMode="numeric"
            maxLength={11}
            error={errors.tax_id}
            hint="11 dígitos"
          />
        </FormSection>

        {/* DOMICILIO */}
        <FormSection
          title="Domicilio"
          description="Ubicación validada con el catálogo oficial de distritos INEI."
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <TextField
            label="Dirección"
            requirement="optional"
            value={draft.address_line1}
            onChange={(value) => setField("address_line1", value)}
            disabled={disabled}
            className="sm:col-span-2 lg:col-span-2"
          />
          <TextField
            label="Referencia"
            requirement="optional"
            value={draft.address_line2}
            onChange={(value) => setField("address_line2", value)}
            disabled={disabled}
            className="sm:col-span-2 lg:col-span-1"
          />
          <SelectField
            label="Departamento"
            requirement="optional"
            value={departmentCode}
            options={departmentOptions}
            onChange={selectDepartment}
            disabled={disabled}
          />
          <SelectField
            label="Provincia"
            requirement={departmentCode ? "required" : "optional"}
            value={provinceCode}
            options={provinceOptions}
            onChange={selectProvince}
            disabled={disabled || !departmentCode}
            error={errors.province}
          />
          <SelectField
            label="Distrito"
            requirement={provinceCode ? "required" : "optional"}
            value={draft.ubigeo_code ?? ""}
            options={districtOptions}
            onChange={selectDistrict}
            disabled={disabled || !provinceCode}
            searchable={true}
            searchPlaceholder="Buscar distrito..."
            error={errors.district}
          />
          <TextField
            label="País"
            requirement="automatic"
            value={draft.country ? "Perú" : null}
            onChange={() => {}}
            disabled={disabled}
            readOnly
            hint="Se completa al seleccionar el distrito."
          />
          <TextField
            label="Código postal"
            requirement="optional"
            value={draft.postal_code}
            onChange={(value) => setField("postal_code", value)}
            disabled={disabled}
          />
        </FormSection>

        {/* CONTACTO */}
        <FormSection title="Contacto" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Teléfono"
            requirement="optional"
            value={draft.phone}
            onChange={(value) => setField("phone", value)}
            disabled={disabled}
            type="tel"
          />
          <TextField
            label="Celular"
            requirement="optional"
            value={draft.mobile}
            onChange={(value) => setField("mobile", value)}
            disabled={disabled}
            type="tel"
          />
          <TextField
            label="Correo electrónico"
            requirement="optional"
            value={draft.email}
            onChange={(value) => setField("email", value)}
            disabled={disabled}
            type="email"
            error={errors.email}
          />
          <TextField
            label="Sitio web"
            requirement="optional"
            value={draft.website}
            onChange={(value) => setField("website", value)}
            disabled={disabled}
            type="url"
            placeholder="https://"
            error={errors.website}
          />
          <TextField
            label="Persona de contacto"
            requirement="optional"
            value={draft.contact_name}
            onChange={(value) => setField("contact_name", value)}
            disabled={disabled}
          />
          <TextField
            label="Cargo"
            requirement="optional"
            value={draft.contact_role}
            onChange={(value) => setField("contact_role", value)}
            disabled={disabled}
          />
        </FormSection>

        {/* LOGO */}
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
