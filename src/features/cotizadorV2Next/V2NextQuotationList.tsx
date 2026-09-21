import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useV2Quotations, useCreateV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { V2_EFFECTIVE_STATUS_LABEL } from "@/types/quoterV2";
import { formatDisplayDate } from "@/components/dateFormat";
import { Spinner } from "@/components/Spinner";
import { ApiError } from "@/api/client";
import { SelectField } from "@/components/SelectField";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "CONFIRMED", label: "Emitida" },
  { value: "CANCELLED", label: "Anulada" },
] as const;

export function V2NextQuotationList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const navigate = useNavigate();

  const filter: Record<string, unknown> = {};
  if (q.trim()) filter.q = q.trim();
  if (status !== "all") filter.status = status;
  const query = useV2Quotations(filter);
  const create = useCreateV2Quotation();

  const handleCreate = () => {
    create.mutate({}, {
      onSuccess: (data) => {
        navigate(`/cotizador-v2-next/${data.id}/1`);
      }
    });
  };

  return (
    <div className="flex flex-col h-full max-w-[1600px] mx-auto w-full">
      <div className="flex-none mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight text-zinc-900">Cotizaciones</h1>
            <p className="mt-1 text-xs text-zinc-500">Consulta, continúa o crea una cotización.</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={create.isPending}
            className="h-10 px-4 rounded-xl bg-zinc-900 text-white text-xs font-extrabold hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {create.isPending ? "Creando..." : "+ Nueva cotización"}
          </button>
        </div>
      </div>

      <div className="flex-none mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-[420px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, nombre o cliente…"
            className="w-full h-10 px-3 rounded-xl border border-zinc-200 bg-white/80 backdrop-blur-sm text-xs focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 outline-none"
          />
        </div>
        <SelectField
          label="Estado"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
          searchable={false}
          className="min-w-52"
        />
      </div>

      <div className="flex-1 min-h-0 bg-white/55 backdrop-blur-xl border border-black/5 rounded-[18px] shadow-sm overflow-auto">
        {query.isPending ? (
          <div className="p-12 text-center text-zinc-500"><Spinner className="mx-auto size-6" /></div>
        ) : query.isError ? (
          <div className="p-12 text-center text-red-600">{query.error instanceof ApiError && query.error.status === 404 ? "No encontrado" : "Error al cargar"}</div>
        ) : query.data.items.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">No hay cotizaciones que coincidan con la búsqueda.</div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead className="bg-zinc-50/70">
              <tr>
                <th className="py-3 px-3.5 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Cotización</th>
                <th className="py-3 px-3.5 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Cliente</th>
                <th className="py-3 px-3.5 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Estado</th>
                <th className="py-3 px-3.5 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Actualizada</th>
                <th className="py-3 px-3.5 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider text-right">Total</th>
                <th className="py-3 px-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/cotizador-v2-next/${row.id}`)}
                  className="cursor-pointer transition-colors hover:bg-white/70 border-t border-black/5"
                >
                  <td className="py-3 px-3.5 align-middle">
                    <div className="font-bold text-zinc-800 text-xs">{row.name || "Sin nombre"}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{row.code}</div>
                  </td>
                  <td className="py-3 px-3.5 align-middle text-xs text-zinc-700">{row.customer_name || "—"}</td>
                  <td className="py-3 px-3.5 align-middle">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] font-extrabold tracking-wider uppercase border ${
                      row.effective_status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      row.effective_status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-zinc-100 text-zinc-600 border-zinc-200'
                    }`}>
                      {V2_EFFECTIVE_STATUS_LABEL[row.effective_status] || row.effective_status}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 align-middle text-[11px] text-zinc-500">{formatDisplayDate(row.created_at)}</td>
                  <td className="py-3 px-3.5 align-middle text-xs font-bold text-right text-zinc-800">—</td>
                  <td className="py-3 px-3.5 align-middle text-center text-zinc-400"><span className="text-lg">•••</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
