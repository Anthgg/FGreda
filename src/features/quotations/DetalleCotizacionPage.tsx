import { Link, useParams } from "react-router-dom";

import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/useSession";
import { QuotationDetailPanel } from "@/features/quotations/QuotationDetailPanel";
import { useQuotation } from "@/features/quotations/useQuotations";
import { describeError } from "@/features/settings/messages";

export function DetalleCotizacionPage() {
  const id = Number(useParams<{ id: string }>().id);
  const valid = Number.isInteger(id) && id > 0;
  const quote = useQuotation(valid ? id : null);
  const { data: user } = useSession();

  if (!valid) return <p role="alert" className="py-16 text-center text-sm text-red-600">Identificador de cotización inválido.</p>;
  if (quote.isPending) return <div className="flex justify-center py-24"><Spinner className="size-6" label="Cargando cotización…" /></div>;
  if (quote.isError) return <p role="alert" className="py-16 text-center text-sm text-red-600">{describeError(quote.error)}</p>;
  if (!quote.data) return null;

  return (
    <div className="w-full space-y-5">
      <Link to="/cotizaciones" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">← Volver a cotizaciones</Link>
      <div className="glass-panel rounded-2xl border border-white/60 p-5 shadow-sm sm:rounded-3xl sm:p-8">
        <QuotationDetailPanel quote={quote.data} canEdit={user?.role === "ADMIN"} />
      </div>
    </div>
  );
}
