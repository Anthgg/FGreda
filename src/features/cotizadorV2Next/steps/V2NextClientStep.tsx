import { useUpdateV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import type { V2Quotation, V2ProductionType } from "@/types/quoterV2";
import { V2_PRODUCTION_TYPE_LABEL } from "@/types/quoterV2";
import { SelectField } from "@/components/SelectField";

// Opciones canónicas de tipo de producción. El valor que va al backend es el
// enum (RETAIL / WHOLESALE), la etiqueta es solo visual.
const TIPOS_PRODUCCION: readonly { value: V2ProductionType; label: string }[] = [
  { value: "RETAIL", label: V2_PRODUCTION_TYPE_LABEL.RETAIL },
  { value: "WHOLESALE", label: V2_PRODUCTION_TYPE_LABEL.WHOLESALE },
];

// Monedas soportadas por V2. Añadir aquí si el backend amplía el catálogo.
const MONEDAS = [
  { value: "PEN", label: "Soles (PEN)" },
  { value: "USD", label: "Dólares (USD)" },
] as const;

export function V2NextClientStep({ quotation }: { quotation: V2Quotation }) {
  const update = useUpdateV2Quotation(quotation.id);

  const handleUpdate = (payload: Record<string, unknown>) => {
    update.mutate(payload);
  };

  const canEdit = quotation.effective_status === "DRAFT";

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-500 mb-3 m-0">Datos de cotización</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr] gap-3">
          <label className="flex flex-col gap-1.5 text-[10px] font-extrabold text-zinc-600">
            Nombre de cotización *
            <input
              type="text"
              defaultValue={quotation.name || ""}
              onBlur={(e) => handleUpdate({ name: e.target.value })}
              placeholder="Ej. Vajilla Restaurante Aromas"
              disabled={!canEdit}
              className="h-10 px-3 rounded-xl border border-black/[0.08] bg-white/55 backdrop-blur-sm text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          {/* Tipo de producción — SelectField custom, NO <select> nativo */}
          <div className="relative">
            <SelectField
              label="Tipo de producción"
              requirement="required"
              value={quotation.production_type}
              options={TIPOS_PRODUCCION}
              onChange={(valor) => handleUpdate({ production_type: valor })}
              disabled={!canEdit}
              searchable={false}
            />
          </div>

          {/* Moneda — SelectField custom, NO <select> nativo */}
          <div className="relative">
            <SelectField
              label="Moneda"
              requirement="required"
              value={quotation.currency_code ?? "PEN"}
              options={MONEDAS}
              onChange={(valor) => handleUpdate({ currency_code: valor })}
              disabled={!canEdit}
              searchable={false}
            />
          </div>
        </div>
      </div>

      <div className="pt-5 mt-5 border-t border-black/5 mb-6">
        <h3 className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-500 mb-3 m-0">Cliente</h3>
        
        {!quotation.customer_id ? (
          <div className="flex flex-col sm:flex-row items-end gap-2.5">
            <label className="flex flex-col gap-1.5 text-[10px] font-extrabold text-zinc-600 flex-1 w-full">
              Buscar cliente *
              <input
                type="text"
                placeholder="Nombre, RUC o documento."
                disabled={!canEdit}
                className="h-10 px-3 rounded-xl border border-black/[0.08] bg-white/55 backdrop-blur-sm text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 w-full placeholder:text-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </label>
            {canEdit && (
              <button className="h-[38px] px-3.5 rounded-[10px] border border-zinc-200 bg-white/85 text-zinc-800 text-[11px] font-extrabold cursor-pointer w-full sm:w-auto">
                + Nuevo cliente
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 rounded-[13px] border border-black/5 bg-white/70">
            <div>
              <strong className="block text-xs font-bold text-zinc-900">{quotation.customer_name}</strong>
              <small className="block text-[10px] text-zinc-500 mt-1">Cliente seleccionado</small>
            </div>
            {canEdit && (
              <button 
                onClick={() => handleUpdate({ customer_id: null })}
                className="border-0 bg-transparent text-zinc-600 underline underline-offset-2 text-[10px] font-extrabold cursor-pointer"
              >
                Cambiar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="pt-5 mt-5 border-t border-black/5">
        <h3 className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-500 mb-3 m-0">
          Notas internas <span className="text-zinc-400 font-bold normal-case">(opcional)</span>
        </h3>
        <input
          type="text"
          defaultValue={quotation.notes || ""}
          onBlur={(e) => handleUpdate({ notes: e.target.value })}
          placeholder="Agregar una nota interna."
          disabled={!canEdit}
          className="w-full h-10 px-3 rounded-xl border border-black/[0.08] bg-white/55 backdrop-blur-sm text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
