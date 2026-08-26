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
import {
  useDniLookup,
  useRucLookup,
} from "@/features/identity/useIdentityLookup";
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
import {
  useCreatePartner,
  usePartners,
  useUpdatePartner,
} from "@/features/masters/useMasters";
import type {
  DocumentType,
  Partner,
  PartnerInput,
  PartnerRole,
} from "@/types/masters";

const PAGE_SIZE = 25;

const DOCUMENT_TYPES: DocumentType[] = [
  "RUC",
  "DNI",
  "CE",
  "PASSPORT",
  "OTHER",
];

const DNI_PATTERN = /^\d{8}$/;
const RUC_PATTERN = /^\d{11}$/;

type AutofillField = "name" | "address" | "ubigeo_code";

/** Solo rellena si el campo esta vacio: la consulta nunca pisa lo ya escrito. */
function fillIfEmpty(
  current: string | null,
  incoming: string | null,
): string | null {
  if (current !== null && current.trim() !== "") return current;
  if (incoming === null || incoming.trim() === "") return current;
  return incoming;
}

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

  // Campos cuyo contenido actual vino de una consulta, no de que el usuario
  // los haya escrito. Sirve para poder limpiarlos si el documento cambia
  // (ver clearStaleAutofill) sin tocar lo que el usuario si edito a mano.
  const [autofilled, setAutofilled] = useState<Set<AutofillField>>(new Set());

  const markAutofilled = (fields: AutofillField[]) => {
    if (fields.length === 0) return;
    setAutofilled((current) => new Set([...current, ...fields]));
  };
  const unmarkAutofilled = (field: AutofillField) => {
    setAutofilled((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

  /** Deshace el autofill vigente cuando el documento consultado cambia.
   *
   * Sin esto, buscar el documento A rellena el nombre, y si el usuario
   * corrige el numero al documento B sin volver a consultar, el formulario
   * podria guardarse con el numero de B pero el nombre de A: fillIfEmpty
   * nunca lo corrige porque el campo ya no esta vacio.
   */
  const clearStaleAutofill = () => {
    if (autofilled.size === 0) return;
    setDraft((current) => ({
      ...current,
      name: autofilled.has("name") ? "" : current.name,
      address: autofilled.has("address") ? null : current.address,
      ubigeo_code: autofilled.has("ubigeo_code") ? null : current.ubigeo_code,
    }));
    setAutofilled(new Set());
  };

  const dniLookup = useDniLookup();
  const rucLookup = useRucLookup();

  const documentNumber = draft.document_number ?? "";
  const canLookupDni =
    draft.document_type === "DNI" && DNI_PATTERN.test(documentNumber);
  const canLookupRuc =
    draft.document_type === "RUC" && RUC_PATTERN.test(documentNumber);

  const handleLookupDni = () => {
    dniLookup.mutate(documentNumber, {
      onSuccess: (result) => {
        setDraft((current) => {
          const name =
            fillIfEmpty(current.name, result.full_name) ?? current.name;
          if (name !== current.name) markAutofilled(["name"]);
          return { ...current, name };
        });
      },
    });
  };

  const handleLookupRuc = () => {
    rucLookup.mutate(documentNumber, {
      onSuccess: (result) => {
        setDraft((current) => {
          const name =
            fillIfEmpty(current.name, result.business_name) ?? current.name;
          const address = fillIfEmpty(current.address, result.address);
          const ubigeo_code = fillIfEmpty(current.ubigeo_code, result.ubigeo);
          const filled: AutofillField[] = [];
          if (name !== current.name) filled.push("name");
          if (address !== current.address) filled.push("address");
          if (ubigeo_code !== current.ubigeo_code) filled.push("ubigeo_code");
          markAutofilled(filled);
          return { ...current, name, address, ubigeo_code };
        });
      },
    });
  };

  const roleOptions: SelectOption[] = (
    Object.keys(ROLE_LABELS) as PartnerRole[]
  ).map((value) => ({ value, label: ROLE_LABELS[value] }));
  const documentOptions: SelectOption[] = [
    { value: "", label: "Sin documento" },
    ...DOCUMENT_TYPES.map((value) => ({ value, label: value })),
  ];

  const incompleteDocument =
    (draft.document_type === null) !==
    (draft.document_number === null || draft.document_number === "");

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
          onChange={(value) => {
            set("name", value);
            unmarkAutofilled("name");
          }}
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
          onChange={(value) => {
            set("document_type", value === "" ? null : (value as DocumentType));
            dniLookup.reset();
            rucLookup.reset();
            clearStaleAutofill();
          }}
          disabled={disabled}
        />
        <TextField
          label="Número de documento"
          requirement="optional"
          value={draft.document_number}
          onChange={(value) => {
            set("document_number", value === "" ? null : value);
            dniLookup.reset();
            rucLookup.reset();
            clearStaleAutofill();
          }}
          disabled={disabled}
          maxLength={20}
          error={
            incompleteDocument
              ? "El tipo y el número de documento van juntos."
              : undefined
          }
        />
        <TextField
          label="Dirección"
          requirement="optional"
          value={draft.address}
          onChange={(value) => {
            set("address", value === "" ? null : value);
            unmarkAutofilled("address");
          }}
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

      {draft.document_type === "DNI" ? (
        <div className="flex flex-wrap items-center gap-3">
          <SecondaryButton
            onClick={handleLookupDni}
            disabled={disabled || !canLookupDni || dniLookup.isPending}
          >
            {dniLookup.isPending ? "Consultando..." : "Consultar DNI"}
          </SecondaryButton>
          {dniLookup.isError ? (
            <span className="text-sm text-red-600">
              {describeError(dniLookup.error)}
            </span>
          ) : dniLookup.isSuccess ? (
            <span className="text-sm text-emerald-700">
              Encontrado: {dniLookup.data.full_name}
            </span>
          ) : null}
        </div>
      ) : null}

      {draft.document_type === "RUC" ? (
        <div className="flex flex-wrap items-center gap-3">
          <SecondaryButton
            onClick={handleLookupRuc}
            disabled={disabled || !canLookupRuc || rucLookup.isPending}
          >
            {rucLookup.isPending ? "Consultando..." : "Consultar RUC"}
          </SecondaryButton>
          {rucLookup.isError ? (
            <span className="text-sm text-red-600">
              {describeError(rucLookup.error)}
            </span>
          ) : rucLookup.isSuccess ? (
            <span className="text-sm text-emerald-700">
              Encontrado: {rucLookup.data.business_name}
              {rucLookup.data.district
                ? ` · ${rucLookup.data.district}, ${rucLookup.data.province ?? ""}, ${rucLookup.data.department ?? ""}`
                : ""}
            </span>
          ) : null}
        </div>
      ) : null}

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
        <p className="text-sm text-red-600">{describeError(error)}</p>
      ) : null}

      <div className="flex gap-2">
        <PrimaryButton
          type="submit"
          disabled={
            disabled || saving || draft.name.trim() === "" || incompleteDocument
          }
        >
          {saving
            ? "Guardando..."
            : partner === null
              ? "Crear tercero"
              : "Guardar cambios"}
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
      update.mutate(
        { id: editing.id, payload },
        { onSuccess: () => setEditing(null) },
      );
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
                            <SecondaryButton
                              onClick={() => setEditing(partner)}
                            >
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
