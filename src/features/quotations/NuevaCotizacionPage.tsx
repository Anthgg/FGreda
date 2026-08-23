import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Badge } from "@/features/masters/MasterTable";
import { emptyQuotationDraft, draftToPayload } from "@/features/quotations/draft";
import { QuotationEditor } from "@/features/quotations/QuotationEditor";
import { useCreateQuotation } from "@/features/quotations/useQuotations";
import { describeError } from "@/features/settings/messages";

export function NuevaCotizacionPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(emptyQuotationDraft);
  const create = useCreateQuotation();
  const payload = draftToPayload(draft);

  const save = () => {
    if (!payload) return;
    create.mutate(payload, { onSuccess: (quote) => navigate(`/cotizaciones/${quote.id}`) });
  };

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-col gap-3 border-b border-zinc-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link to="/cotizaciones" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">← Volver a cotizaciones</Link>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Nueva cotización</h1><Badge tone="warning">Borrador</Badge></div>
          <p className="text-xs text-zinc-500 sm:text-sm">Capture fuentes reales y revise el cálculo oficial antes de guardar.</p>
        </div>
        <div className="flex items-center gap-3"><SecondaryButton onClick={() => navigate("/cotizaciones")}>Cancelar</SecondaryButton><PrimaryButton disabled={!payload || create.isPending} onClick={save}>{create.isPending ? "Guardando…" : "Guardar borrador"}</PrimaryButton></div>
      </header>

      {create.isError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{describeError(create.error)}</p> : null}
      <QuotationEditor value={draft} onChange={setDraft} />

      <div className="glass-panel sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-lg backdrop-blur-md">
        <span className={`text-xs font-medium ${payload ? "text-emerald-700" : "text-amber-700"}`}>{payload ? "Listo para guardar el borrador" : "Revise producto, cantidad y valores enteros"}</span>
        <div className="flex gap-3"><SecondaryButton onClick={() => navigate("/cotizaciones")}>Cancelar</SecondaryButton><PrimaryButton disabled={!payload || create.isPending} onClick={save}>{create.isPending ? "Guardando…" : "Guardar borrador"}</PrimaryButton></div>
      </div>
    </div>
  );
}
