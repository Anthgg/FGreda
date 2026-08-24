import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/features/masters/MasterTable";
import { draftToPayload, quotationToDraft, type QuotationDraft } from "@/features/quotations/draft";
import { QuotationEditor } from "@/features/quotations/QuotationEditor";
import { useQuotation, useUpdateQuotation } from "@/features/quotations/useQuotations";
import { describeError } from "@/features/settings/messages";

export function EditarCotizacionPage() {
  const id = Number(useParams<{ id: string }>().id);
  const validId = Number.isInteger(id) && id > 0;
  const navigate = useNavigate();
  const query = useQuotation(validId ? id : null);
  const update = useUpdateQuotation(id);
  const [draft, setDraft] = useState<QuotationDraft | null>(null);

  useEffect(() => {
    if (query.data && draft === null) setDraft(quotationToDraft(query.data));
  }, [draft, query.data]);

  if (!validId) return <p role="alert" className="py-16 text-center text-sm text-red-600">Identificador de cotización inválido.</p>;
  if (query.isError) return <p role="alert" className="py-16 text-center text-sm text-red-600">{describeError(query.error)}</p>;
  if (query.isPending || draft === null) return <div className="flex justify-center py-24"><Spinner className="size-6" label="Cargando cotización…" /></div>;
  const quote = query.data!;
  if (quote.status !== "DRAFT") return <p role="alert" className="py-16 text-center text-sm text-amber-700">Solo los borradores se pueden editar.</p>;
  const payload = draftToPayload(draft);
  const stale = update.error instanceof ApiError && update.error.code === "SOURCE_CHANGED";

  const save = (accept = false) => {
    if (!payload) return;
    update.mutate({ ...payload, expected_source_fingerprint: quote.source_fingerprint, accept_source_changes: accept }, { onSuccess: () => navigate(`/cotizaciones/${id}`) });
  };

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-5">
        <div><Link to={`/cotizaciones/${id}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">← Volver al detalle</Link><div className="mt-1 flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight text-zinc-900">Editar {quote.code}</h1><Badge tone="warning">Borrador</Badge></div></div>
        <div className="flex gap-3"><SecondaryButton onClick={() => navigate(`/cotizaciones/${id}`)}>Cancelar</SecondaryButton><PrimaryButton disabled={!payload || update.isPending} onClick={() => save(false)}>{update.isPending ? "Guardando…" : "Guardar cambios"}</PrimaryButton></div>
      </header>
      {update.isError ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{describeError(update.error)}</p>
          {stale ? <button type="button" className="mt-3 rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white" onClick={() => save(true)}>Aceptar cambios de fuente y recalcular</button> : null}
        </div>
      ) : null}
      <QuotationEditor value={draft} onChange={setDraft} />
    </div>
  );
}
