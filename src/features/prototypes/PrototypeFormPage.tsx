import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PrimaryButton, SecondaryButton, SelectField, TextAreaField, TextField } from "@/components/form";
import { useLocations, useProducts } from "@/features/masters/useMasters";
import { useQuotations } from "@/features/quotations/useQuotations";
import { Alert } from "@/features/prototypes/PrototypeUi";
import { describePrototypeError } from "@/features/prototypes/prototypeLabels";
import { useCreatePrototype } from "@/features/prototypes/usePrototypes";

export function PrototypeFormPage() {
  const navigate = useNavigate();
  const create = useCreatePrototype();
  const products = useProducts({ active: true, limit: 200 });
  const locations = useLocations();
  const quotations = useQuotations({ limit: 200 });
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [productId, setProductId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [targetDays, setTargetDays] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        name: name.trim(), quantity: Number(quantity), materials: [],
        ...(productId ? { product_id: Number(productId) } : {}),
        ...(quotationId ? { quotation_id: Number(quotationId) } : {}),
        ...(locationId ? { stock_location_id: Number(locationId) } : {}),
        ...(targetDays ? { target_days: Number(targetDays) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      { onSuccess: (prototype) => navigate(`/prototipos/${prototype.id}`, { state: { createdCode: prototype.code } }) },
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header><Link to="/prototipos" className="text-sm text-zinc-500 hover:underline">← Prototipos</Link><h1 className="mt-2 text-2xl font-semibold">Crear prototipo</h1><p className="mt-1 text-sm text-zinc-500">Puede registrarse sin producto y sin cotización. El código lo asignará el backend.</p></header>
      <form onSubmit={submit} className="glass-panel space-y-6 rounded-3xl border border-white/60 p-6 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Nombre" requirement="required" value={name} onChange={setName} maxLength={200} />
          <TextField label="Cantidad de muestra" requirement="required" type="number" inputMode="numeric" value={quantity} onChange={setQuantity} />
          <SelectField label="Producto" requirement="optional" value={productId} onChange={setProductId} placeholder="Sin producto" options={(products.data?.items ?? []).map((p) => ({ value: String(p.id), label: `${p.internal_reference} · ${p.name}` }))} />
          <SelectField label="Cotización" requirement="optional" value={quotationId} onChange={setQuotationId} placeholder="Sin cotización" options={(quotations.data?.items ?? []).map((q) => ({ value: String(q.id), label: `${q.code} · ${q.name ?? q.product_name ?? "Sin nombre"}` }))} />
          <SelectField label="Almacén" requirement="optional" value={locationId} onChange={setLocationId} placeholder="Sin almacén" options={(locations.data ?? []).filter((l) => l.active).map((l) => ({ value: String(l.id), label: l.name }))} />
          <TextField label="Días objetivo" requirement="optional" type="number" inputMode="numeric" value={targetDays} onChange={setTargetDays} />
        </div>
        <TextAreaField label="Notas" requirement="optional" value={notes} onChange={setNotes} rows={4} />
        {create.error ? <Alert>{describePrototypeError(create.error)}</Alert> : null}
        <div className="flex justify-end gap-2"><SecondaryButton onClick={() => navigate("/prototipos")}>Volver</SecondaryButton><PrimaryButton disabled={create.isPending || !name.trim() || Number(quantity) <= 0}>{create.isPending ? "Creando…" : "Crear prototipo"}</PrimaryButton></div>
      </form>
    </div>
  );
}

