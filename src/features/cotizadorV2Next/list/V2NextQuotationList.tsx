import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useV2Quotations } from "@/features/cotizadorV2/useQuoterV2";
import { formatDisplayDate } from "@/components/dateFormat";
import { fechaLima } from "@/features/cotizadorV2/fechaLima";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { SegmentedControl } from "@/components/SegmentedControl";
import { RUTA_V2_NEXT } from "@/features/cotizadorV2Next/shell/rutas";
import { MasterHeader } from "@/features/masters/MasterTable";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { PrimaryButton } from "@/components/form";
import { V2CreateQuotationDialog } from "@/features/cotizadorV2Next/list/V2CreateQuotationDialog";
import { useNavigate } from "react-router-dom";
import { EstadoV2 } from "@/features/cotizadorV2/V2CicloDeVida";

export function V2NextQuotationList() {
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();

  const filter: Record<string, unknown> = { limit };
  if (status !== "all") filter.status = status;
  
  const { data, isPending, isError, error } = useV2Quotations(filter);
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;

  const filteredItems = useMemo(() => {
    if (!q.trim()) return items;
    const query = q.trim().toLowerCase();
    
    // Normalize string to remove accents
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const queryNormalized = normalize(q.trim());
    
    return items.filter((item) => {
      const codeMatches = item.code.toLowerCase().includes(query);
      const nameMatches = item.name ? normalize(item.name).includes(queryNormalized) : false;
      const customerMatches = item.customer_name ? normalize(item.customer_name).includes(queryNormalized) : false;
      return codeMatches || nameMatches || customerMatches;
    });
  }, [items, q]);

  const handleShowMore = () => {
    setLimit((prev) => Math.min(prev + 50, 200));
  };

  const handleCreateSuccess = (id: number, hasCustomer: boolean) => {
    setIsDialogOpen(false);
    if (hasCustomer) {
      navigate(`${RUTA_V2_NEXT}/${id}/productos`);
    } else {
      navigate(`${RUTA_V2_NEXT}/${id}/cliente`);
    }
  };

  return (
    <div className="v2-legible-movil flex flex-col h-full w-full space-y-6">
      <MasterHeader
        title={<TypewriterTitle text="Cotizador V2." className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl" />}
        subtitle="Motor nuevo. El Cotizador anterior sigue disponible como Legacy y sus cotizaciones no se recalculan."
        actions={<div className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">Motor V2</div>}
      />
      
      <div className="mt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-[28px] leading-tight font-bold tracking-tight text-zinc-900">Cotizaciones</h2>
          <p className="mt-1 text-sm text-zinc-500">Abre una para seguir donde la dejaste, o crea una nueva.</p>
        </div>
        <PrimaryButton onClick={() => setIsDialogOpen(true)}>
          Nueva cotización
        </PrimaryButton>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full max-w-[420px]">
          <label htmlFor="search-input" className="sr-only">Buscar</label>
          <input
            id="search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, nombre o código"
            className="w-full h-10 px-3 rounded-xl border border-zinc-200 bg-white/80 backdrop-blur-sm text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 outline-none"
          />
        </div>
        
        <div className="flex flex-col gap-1 w-full sm:w-auto items-start sm:items-end">
          <SegmentedControl
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Todas" },
              { value: "DRAFT", label: "Borradores" },
              { value: "CONFIRMED", label: "Emitidas" },
              { value: "CANCELLED", label: "Anuladas" },
            ]}
          />
          {status === "CONFIRMED" && (
            <span className="text-[11px] text-zinc-500">Incluye las vencidas y las enviadas a producción.</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-0 bg-white/60 backdrop-blur-xl border border-black/[0.06] rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          {isPending ? (
            <div className="p-12 text-center text-zinc-500 flex justify-center"><Spinner className="size-6" /></div>
          ) : isError ? (
            <div role="alert" className="p-12 text-center text-red-600">{describeError(error)}</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm">No hay cotizaciones aquí. Crea una nueva o cambia el filtro.</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm">No hay cotizaciones que coincidan con la búsqueda.</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead className="bg-zinc-50/70 border-b border-black/[0.06]">
                <tr>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">Cliente y pedido</th>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">Estado</th>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">Creada</th>
                  <th className="py-3 px-4 text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">Válida hasta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredItems.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-zinc-50 group"
                  >
                    <td className="p-0 align-middle">
                      <Link to={`${RUTA_V2_NEXT}/${row.id}`} className="block py-3 px-4 focus:outline-none focus:bg-zinc-100 rounded-lg m-1">
                        <div className="font-bold text-zinc-900 text-sm">{row.customer_name || "Sin cliente"}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {row.name ?? "Sin nombre"} <span className="mx-1 font-normal opacity-50">·</span> <span className="text-[11px] font-medium text-zinc-400">{row.code}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="p-0 align-middle">
                      <div className="py-3 px-4 h-full w-full">
                        <EstadoV2 estado={row.effective_status} />
                      </div>
                    </td>
                    <td className="p-0 align-middle">
                      <div className="py-3 px-4 text-sm text-zinc-600 h-full w-full">
                        {fechaLima(row.created_at)}
                      </div>
                    </td>
                    <td className="p-0 align-middle">
                      <div className="py-3 px-4 text-sm text-zinc-600 h-full w-full">
                        {row.valid_until ? formatDisplayDate(row.valid_until) : "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {!isPending && !isError && total > items.length && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-zinc-500 font-medium">Buscando en las {items.length} más recientes de {total}.</p>
          <button
            onClick={handleShowMore}
            disabled={limit >= 200 || limit >= total}
            className="h-8 px-4 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mostrar más
          </button>
        </div>
      )}

      {isDialogOpen && (
        <V2CreateQuotationDialog
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
