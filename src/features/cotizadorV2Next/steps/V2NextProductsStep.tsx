import { useState } from "react";

import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import { Panel } from "@/features/masters/MasterTable";
import { PieceCard } from "./products/PieceCard";
import { AddPieceDialog } from "./products/AddPieceDialog";
import {
  useV2QuotationProducts,
  useUpdateV2QuotationProduct,
  useDeleteV2QuotationProduct,
} from "@/features/cotizadorV2/useQuoterV2Materials";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import { PlusIcon } from "@/components/icons";
import { PrimaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";

export function V2NextProductsStep({ quotationId, canEdit }: PasoDelAsistenteProps) {
  const [adding, setAdding] = useState(false);

  const query = useV2QuotationProducts(quotationId);
  const actualizar = useUpdateV2QuotationProduct(quotationId);
  const borrar = useDeleteV2QuotationProduct(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  if (query.isPending) {
    return (
      <Panel>
        <Spinner className="size-5" label="Cargando piezas..." />
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel>
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {describeError(query.error)}
        </div>
      </Panel>
    );
  }

  const lineas = query.data?.items ?? [];

  return (
    <Panel>
      <p className="mb-6 text-sm text-zinc-600">
        Indica cuántas y sus medidas. Con las medidas se calcula cuánto espacio ocupan en el horno.
      </p>
      <div className="flex flex-col gap-4">
        {lineas.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.06] bg-white/60 p-8 text-center">
            <p className="text-zinc-500">Aún no hay piezas. Agrega la primera.</p>
          </div>
        ) : (
          lineas.map((linea) => (
            <PieceCard
              key={linea.id}
              linea={linea}
              canEdit={canEdit}
              onUpdate={(payload) =>
                esperarGuardado(actualizar, "linea-editar", { lineId: linea.id, payload })
              }
              onDelete={() => borrar.mutate(linea.id)}
            />
          ))
        )}

        {canEdit && (
          <div className="mt-2">
            <PrimaryButton
              type="button"
              onClick={() => setAdding(true)}
            >
              <PlusIcon className="size-4" />
              Agregar pieza
            </PrimaryButton>
          </div>
        )}

        {adding && <AddPieceDialog quotationId={quotationId} onClose={() => setAdding(false)} />}
      </div>
    </Panel>
  );
}
