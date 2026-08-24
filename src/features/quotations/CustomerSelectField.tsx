/**
 * Selector accesible de cliente con busqueda y alta rapida con consulta DNI/RUC.
 */

import { useState } from "react";

import { SelectField, type SelectOption } from "@/components/form";
import { usePartners } from "@/features/masters/useMasters";
import { NuevoClienteModal } from "@/features/quotations/NuevoClienteModal";

interface CustomerSelectFieldProps {
  value: string;
  labelValue?: string;
  onChange: (customerId: string, customerLabel: string) => void;
  disabled?: boolean;
}

export function CustomerSelectField({
  value,
  labelValue: _labelValue,
  onChange,
  disabled = false,
}: CustomerSelectFieldProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [creandoCliente, setCreandoCliente] = useState<string | null>(null);

  const partnersQuery = usePartners({
    role: "CLIENT",
    active: true,
    limit: 100,
  });

  const customers = partnersQuery.data?.items ?? [];
  const options: SelectOption[] = [
    { value: "", label: "Sin cliente asignado" },
    ...customers.map((c) => {
      const doc = c.document_number ? ` · ${c.document_number}` : "";
      return {
        value: String(c.id),
        label: `${c.name}${doc}`,
      };
    }),
  ];

  return (
    <>
      <SelectField
        label="Cliente"
        requirement="optional"
        value={value}
        options={options}
        onChange={(val) => {
          if (!val) {
            onChange("", "");
          } else {
            const found = customers.find((c) => String(c.id) === val);
            const doc = found?.document_number ? ` (${found.document_number})` : "";
            onChange(val, found ? `${found.name}${doc}` : `Cliente #${val}`);
          }
        }}
        disabled={disabled}
        placeholder="Seleccionar cliente…"
        searchPlaceholder="Buscar cliente por nombre o documento…"
        allowCreate={!disabled}
        onCreateRequested={(text) => {
          setCreandoCliente(text);
          setModalOpen(true);
        }}
        createLabel={(text) => `+ Crear cliente «${text}»`}
      />

      {modalOpen ? (
        <NuevoClienteModal
          initialName={creandoCliente ?? ""}
          onClose={() => {
            setModalOpen(false);
            setCreandoCliente(null);
          }}
          onCreated={(newCustomer) => {
            const doc = newCustomer.document_number ? ` (${newCustomer.document_number})` : "";
            onChange(String(newCustomer.id), `${newCustomer.name}${doc}`);
            setModalOpen(false);
            setCreandoCliente(null);
          }}
        />
      ) : null}
    </>
  );
}
