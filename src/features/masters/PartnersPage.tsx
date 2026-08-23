/**
 * Maestro de terceros.
 *
 * Un solo maestro y un solo formulario: cliente, proveedor o ambos es un rol,
 * no dos sistemas paralelos.
 */

import { useState } from "react";

import {
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
  type SelectOption,
} from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import {
  Badge,
  EmptyState,
  MasterHeader,
  Pagination,
  Panel,
  SearchInput,
  TableWrapper,
  Td,
  Th,
  Toolbar,
} from "@/features/masters/MasterTable";
import { ROLE_LABELS } from "@/features/masters/labels";
import { useCreatePartner, usePartners, useUpdatePartner } from "@/features/masters/useMasters";
import type { DocumentType, Partner, PartnerInput, PartnerRole } from "@/types/masters";

const PAGE_SIZE = 25;

const DOCUMENT_TYPES: DocumentType[] = ["RUC", "DNI", "CE", "PASSPORT", "OTHER"];

function emptyDraft(): PartnerInput {
  return {
    name: "",
    role: "CLIENT",
    document_type: null,
    document_number: null,
    address: null,
    reference: null,
    ubigeo_code: null,
    email: null,
    mobile: null,
    phone: null,
    active: true,
    notes: null,
  };
}

function toDraft(partner: Partner): PartnerInput {
  const {
    id: _id,
    district: _district,
    province: _province,
    department: _department,
    country: _country,
    ...rest
  } = partner;
  return rest;
}

function PartnerForm({
  partner,
  disabled,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  partner: Partner | null;
  disabled: boolean;
  saving: boolean;
  error: unknown;
  onSubmit: (payload: PartnerInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<PartnerInput>(() =>
    partner === null ? emptyDraft() : toDraft(partner),
  );
  const set = <K extends keyof PartnerInput>(key: K, value: PartnerInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const roleOptions: SelectOption[] = (Object.keys(ROLE_LABELS) as PartnerRole[]).map(
    (value) => ({ value, label: ROLE_LABELS[value] }),
  );
  const documentOptions: SelectOption[] = [
    { value: "", label: "Sin documento" },
    ...DOCUMENT_TYPES.map((value) => ({ value, label: value })),
  ];

  const incompleteDocument =
    (draft.document_type === null) !== (draft.document_number === null ||
      draft.document_number === "");

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...draft,
          document_number:
            draft.document_number === "" ? null : draft.document_number,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="Nombre o razón social"
          requirement="required"
          value={draft.name}
          onChange={(value) => set("name", value)}
          disabled={disabled}
          maxLength={200}
          className="sm:col-span-2"
        />
        <SelectField
          label="Rol"
          requirement="required"
          value={draft.role}
          options={roleOptions}
          onChange={(value) => set("role", value as PartnerRole)}
          disabled={disabled}
        />
        <SelectField
          label="Tipo de documento"
          requirement="optional"
          value={draft.document_type ?? ""}
          options={documentOptions}
          onChange={(value) =>
            set("document_type", value === "" ? null : (value as DocumentType))
          }
          disabled={disabled}
        />
        <TextField
          label="Número de documento"
          requirement="optional"
          value={draft.document_number}
          onChange={(value) => set("document_number", value === "" ? null : value)}
          disabled={disabled}
          maxLength={20}
          error={
            incompleteDocument ? "El tipo y el número de documento van juntos." : undefined
          }
        />
        <TextField
          label="Dirección"
          requirement="optional"
          value={draft.address}
          onChange={(value) => set("address", value === "" ? null : value)}
          disabled={disabled}
          maxLength={240}
        />
        <TextField
          label="Correo electrónico"
          requirement="optional"
          type="email"
          value={draft.email}
          onChange={(value) => set("email", value === "" ? null : value)}
          disabled={disabled}
        />
        <TextField
          label="Celular"
          requirement="optional"
          type="tel"
          value={draft.mobile}
          onChange={(value) => set("mobile", value === "" ? null : value)}
          disabled={disabled}
        />
        <TextField
          label="Teléfono"
          requirement="optional"
          type="tel"
          value={draft.phone}
          onChange={(value) => set("phone", value === "" ? null : value)}
          disabled={disabled}
        />
      </div>

      <label className="flex items-center gap-2 border-t border-zinc-200 pt-4 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(event) => set("active", event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Activo
      </label>

      {error ? (
        <p className="text-sm text-red-600">
          {describeError(error)}
        </p>
      ) : null}

      <div className="flex gap-2">
        <PrimaryButton
          type="submit"
          disabled={disabled || saving || draft.name.trim() === "" || incompleteDocument}
        >
          {saving ? "Guardando..." : partner === null ? "Crear tercero" : "Guardar cambios"}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={saving}>
          Cancelar
        </SecondaryButton>
      </div>
    </form>
  );
}

export function PartnersPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Partner | null | "new">(null);

  const partners = usePartners({
    ...(search.trim() !== "" ? { search: search.trim() } : {}),
    ...(role !== "" ? { role: role as PartnerRole } : {}),
    limit: PAGE_SIZE,
    offset,
  });
  const create = useCreatePartner();
  const update = useUpdatePartner();

  const handleSubmit = (payload: PartnerInput) => {
    if (editing === "new" || editing === null) {
      create.mutate(payload, { onSuccess: () => setEditing(null) });
    } else {
      update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) });
    }
  };

  return (
    <div className="w-full space-y-5">
      <MasterHeader
        title={
          <TypewriterTitle
            text="Terceros."
            className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          />
        }
        subtitle="Clientes y proveedores en un único maestro."
        actions={
          isAdmin && editing === null ? (
            <PrimaryButton type="button" onClick={() => setEditing("new")}>
              Nuevo tercero
            </PrimaryButton>
          ) : null
        }
      />

      <Panel>
        {editing !== null ? (
          <PartnerForm
            partner={editing === "new" ? null : editing}
            disabled={!isAdmin}
            saving={create.isPending || update.isPending}
            error={create.error ?? update.error}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            <Toolbar>
              <SearchInput
                label="Buscar tercero"
                placeholder="Nombre o número de documento"
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setOffset(0);
                }}
              />
              <SelectField
                label="Rol"
                value={role}
                options={[
                  { value: "", label: "Todos" },
                  { value: "CLIENT", label: "Clientes" },
                  { value: "SUPPLIER", label: "Proveedores" },
                  { value: "BOTH", label: "Cliente y proveedor" },
                ]}
                onChange={(value) => {
                  setRole(value);
                  setOffset(0);
                }}
                className="w-full sm:w-60"
              />
            </Toolbar>

            {partners.isPending ? (
              <Spinner label="Cargando terceros..." />
            ) : partners.error ? (
              <p className="py-8 text-center text-sm text-red-600">
                {describeError(partners.error)}
              </p>
            ) : (partners.data?.items.length ?? 0) === 0 ? (
              <EmptyState message="No hay terceros que coincidan con la búsqueda." />
            ) : (
              <>
                <TableWrapper>
                  <thead>
                    <tr>
                      <Th>Nombre</Th>
                      <Th>Documento</Th>
                      <Th>Rol</Th>
                      <Th>Ubicación</Th>
                      <Th>Contacto</Th>
                      <Th>Estado</Th>
                      {isAdmin ? <Th align="right">Acción</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {partners.data?.items.map((partner) => (
                      <tr key={partner.id}>
                        <Td>{partner.name}</Td>
                        <Td mono>
                          {partner.document_type
                            ? `${partner.document_type} ${partner.document_number ?? ""}`
                            : "—"}
                        </Td>
                        <Td muted>{ROLE_LABELS[partner.role]}</Td>
                        <Td muted>
                          {partner.district
                            ? `${partner.district} · ${partner.department ?? ""}`
                            : "—"}
                        </Td>
                        <Td muted>{partner.mobile ?? partner.email ?? "—"}</Td>
                        <Td>
                          {partner.active ? (
                            <Badge tone="positive">Activo</Badge>
                          ) : (
                            <Badge>Inactivo</Badge>
                          )}
                        </Td>
                        {isAdmin ? (
                          <Td align="right">
                            <SecondaryButton onClick={() => setEditing(partner)}>
                              Editar
                            </SecondaryButton>
                          </Td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </TableWrapper>
                <Pagination
                  total={partners.data?.total ?? 0}
                  limit={PAGE_SIZE}
                  offset={offset}
                  onOffsetChange={setOffset}
                />
              </>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
