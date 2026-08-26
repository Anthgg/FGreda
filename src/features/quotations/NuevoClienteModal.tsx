/**
 * Modal para crear un nuevo cliente directamente desde el cotizador.
 *
 * Integra consulta automatica DNI/RUC con RENIEC y SUNAT a traves de la API
 * del backend (Fase 005.5), rellenando nombre, razon social y direccion si
 * estan disponibles.
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
import { useDniLookup, useRucLookup } from "@/features/identity/useIdentityLookup";
import { describeError } from "@/features/settings/messages";
import { useCreatePartner } from "@/features/masters/useMasters";
import type { DocumentType, Partner, PartnerInput } from "@/types/masters";

const DOCUMENT_TYPES: DocumentType[] = ["RUC", "DNI", "CE", "PASSPORT", "OTHER"];
const DNI_PATTERN = /^\d{8}$/;
const RUC_PATTERN = /^\d{11}$/;

interface NuevoClienteModalProps {
  initialName?: string;
  onClose: () => void;
  onCreated: (partner: Partner) => void;
}

export function NuevoClienteModal({
  initialName = "",
  onClose,
  onCreated,
}: NuevoClienteModalProps) {
  const [name, setName] = useState(initialName);
  const [documentType, setDocumentType] = useState<DocumentType | "">("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [address, setAddress] = useState("");
  const [ubigeoCode, setUbigeoCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const createPartner = useCreatePartner();
  const dniLookup = useDniLookup();
  const rucLookup = useRucLookup();

  const isDni = documentType === "DNI" && DNI_PATTERN.test(documentNumber.trim());
  const isRuc = documentType === "RUC" && RUC_PATTERN.test(documentNumber.trim());
  const canLookup = isDni || isRuc;
  const isLookingUp = dniLookup.isPending || rucLookup.isPending;

  const handleLookup = () => {
    const doc = documentNumber.trim();
    if (!canLookup) return;

    if (documentType === "DNI") {
      dniLookup.mutate(doc, {
        onSuccess: (data) => {
          if (!name.trim()) setName(data.full_name);
        },
      });
    } else if (documentType === "RUC") {
      rucLookup.mutate(doc, {
        onSuccess: (data) => {
          if (!name.trim()) setName(data.business_name);
          if (!address.trim() && data.address) setAddress(data.address);
          if (!ubigeoCode.trim() && data.ubigeo) setUbigeoCode(data.ubigeo);
        },
      });
    }
  };

  const docTypeOptions: SelectOption[] = [
    { value: "", label: "Sin documento" },
    ...DOCUMENT_TYPES.map((t) => ({ value: t, label: t })),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setValidationError("El nombre o razón social es obligatorio.");
      return;
    }
    if ((documentType && !documentNumber.trim()) || (!documentType && documentNumber.trim())) {
      setValidationError("El tipo y número de documento deben indicarse juntos.");
      return;
    }

    setValidationError(null);

    const payload: PartnerInput = {
      name: cleanName,
      role: "CLIENT",
      document_type: documentType ? (documentType as DocumentType) : null,
      document_number: documentNumber.trim() || null,
      reference: tradeName.trim() || null,
      address: address.trim() || null,
      ubigeo_code: ubigeoCode.trim() || null,
      email: email.trim() || null,
      mobile: null,
      phone: phone.trim() || null,
      active: true,
      notes: null,
    };

    createPartner.mutate(payload, {
      onSuccess: (newPartner) => {
        onCreated(newPartner);
        onClose();
      },
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo cliente"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-black text-white shadow-2xs">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
              Nuevo cliente
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full border border-black/[0.06] bg-white/60 p-1.5 text-zinc-400 shadow-2xs hover:bg-white hover:text-zinc-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField
              label="Tipo doc."
              requirement="optional"
              value={documentType}
              options={docTypeOptions}
              onChange={(val) => {
                setDocumentType(val as DocumentType | "");
                if (validationError) setValidationError(null);
              }}
            />
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Número de documento
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextField
                    label=""
                    requirement="optional"
                    value={documentNumber}
                    onChange={(val) => {
                      setDocumentNumber(val);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder={documentType === "RUC" ? "20xxxxxxxx" : "8 dígitos"}
                  />
                </div>
                {canLookup ? (
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={isLookingUp}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-3.5 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isLookingUp ? <Spinner className="size-3.5 text-white" /> : "Consultar"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <TextField
            label="Nombre / Razón Social"
            requirement="required"
            value={name}
            onChange={(val) => {
              setName(val);
              if (validationError) setValidationError(null);
            }}
            placeholder="Nombre completo o razón social"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Nombre comercial / Ref."
              requirement="optional"
              value={tradeName}
              onChange={setTradeName}
              placeholder="Ej: Taller Lima"
            />
            <TextField
              label="Teléfono / Celular"
              requirement="optional"
              value={phone}
              onChange={setPhone}
              placeholder="987654321"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <TextField
                label="Dirección fiscal / Entrega"
                requirement="optional"
                value={address}
                onChange={setAddress}
                placeholder="Av. Principal 123"
              />
            </div>
            <TextField
              label="Ubigeo"
              requirement="optional"
              value={ubigeoCode}
              onChange={setUbigeoCode}
              placeholder="150101"
            />
          </div>

          <TextField
            label="Correo electrónico"
            requirement="optional"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="cliente@ejemplo.pe"
          />

          {validationError ? (
            <p role="alert" className="text-xs text-red-600">
              {validationError}
            </p>
          ) : null}

          {createPartner.isError ? (
            <p role="alert" className="text-xs text-red-600">
              {describeError(createPartner.error)}
            </p>
          ) : null}

          <footer className="mt-6 flex items-center justify-end gap-2 border-t border-black/[0.04] pt-4">
            <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
            <PrimaryButton type="submit" disabled={!name.trim() || createPartner.isPending}>
              {createPartner.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner className="size-3 text-white" />
                  <span>Guardando…</span>
                </span>
              ) : (
                "Guardar cliente"
              )}
            </PrimaryButton>
          </footer>
        </form>
      </div>
    </div>
  );
}
