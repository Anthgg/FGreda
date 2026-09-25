import { useState } from "react";
import { Link } from "react-router-dom";
import { useCreateV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { CustomerSelectField } from "@/components/CustomerSelectField";
import { TextField } from "@/components/form";
import { ChoiceCardGroup } from "@/components/ChoiceCardGroup";
import type { V2ProductionType } from "@/types/quoterV2";
import { describeError } from "@/features/settings/messages";

interface V2CreateQuotationDialogProps {
  onClose: () => void;
  onSuccess: (id: number, hasCustomer: boolean) => void;
}

export function V2CreateQuotationDialog({ onClose, onSuccess }: V2CreateQuotationDialogProps) {
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [productionType, setProductionType] = useState<V2ProductionType>("RETAIL");
  
  const create = useCreateV2Quotation();
  const contenedor = useDialogoAccesible<HTMLDivElement>(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;

    create.mutate(
      {
        name: name.trim() || null,
        customer_id: customerId,
        production_type: productionType,
      },
      {
        onSuccess: (data) => {
          onSuccess(data.id, customerId !== null);
        },
      }
    );
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" 
        onClick={() => !create.isPending && onClose()}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div 
          ref={contenedor}
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="dialog-title"
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto border border-black/5"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !create.isPending) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-black/[0.06] bg-zinc-50/50">
              <h2 id="dialog-title" className="text-xl font-bold tracking-tight text-zinc-900">
                Nueva cotización
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500">
                Con esto basta para empezar. Lo demás lo completas paso a paso.
              </p>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              {create.isError && (
                <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
                  {describeError(create.error)}
                </div>
              )}

              <CustomerSelectField
                label="¿Para quién es?"
                value={customerId}
                onChange={setCustomerId}
                requirement="optional"
                placeholder="Lo elijo después"
                hint={
                  <>
                    ¿No está? Regístralo en <Link to="/terceros" className="underline hover:text-zinc-700">Terceros</Link>.
                  </> as unknown as string // hint is typed as string in field, but we can pass react nodes sometimes, let's cast or wait
                }
              />

              <TextField
                label="Ponle un nombre (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                hint="Solo para encontrarla en tu lista. El cliente no lo ve."
              />

              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-3">
                  ¿Cómo es el pedido?
                </label>
                <ChoiceCardGroup<V2ProductionType>
                  value={productionType}
                  onChange={setProductionType}
                  options={[
                    {
                      value: "RETAIL",
                      title: "Pocas piezas",
                      description: "Por menor. Sugiere el horno chico.",
                    },
                    {
                      value: "WHOLESALE",
                      title: "Muchas piezas",
                      description: "Por mayor. Sugiere el horno grande.",
                    }
                  ]}
                  columns={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-black/[0.06] bg-zinc-50/50 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={create.isPending}
                className="h-10 px-4 rounded-xl border border-black/10 bg-white text-zinc-700 text-sm font-bold hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={create.isPending}
                className="h-10 px-4 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {create.isPending ? "Creando..." : "Empezar cotización"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
