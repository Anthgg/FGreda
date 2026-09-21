import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useV2QuotationProducts,
  useAddV2QuotationProduct,
  useUpdateV2QuotationProduct,
  useDeleteV2QuotationProduct,
} from "@/features/cotizadorV2/useQuoterV2Materials";
import { fetchProduct } from "@/api/masters";
import { DecimalField } from "@/components/DecimalField";
import { TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import type { V2Quotation } from "@/types/quoterV2";
import type { V2QuotationProduct } from "@/types/quoterV2Materials";
import { AddProductModal } from "./AddProductModal";
import { describeError } from "@/features/settings/messages";
import { ApiError } from "@/api/client";

function ObservationField({
  value,
  disabled,
  onCommit
}: {
  value: string;
  disabled: boolean;
  onCommit: (val: string) => void;
}) {
  const [local, setLocal] = useState(value);

  return (
    <TextField
      label="Observación (Cliente)"
      value={local}
      disabled={disabled}
      onChange={(val) => setLocal(val)}
      onBlur={() => {
        if (local !== value) {
          onCommit(local);
        }
      }}
    />
  );
}

function ProductLineCard({ 
  line, 
  quotationId, 
  canEdit 
}: { 
  line: V2QuotationProduct; 
  quotationId: number; 
  canEdit: boolean;
}) {
  const update = useUpdateV2QuotationProduct(quotationId);
  const remove = useDeleteV2QuotationProduct(quotationId);

  // If it has a product_id, fetch it to see if it has dimensions
  const productQuery = useQuery({
    queryKey: ["product", line.product_id],
    queryFn: () => fetchProduct(line.product_id!),
    enabled: line.product_id !== null,
  });

  const handleUpdate = (payload: Record<string, unknown>) => {
    update.mutate({ lineId: line.id, payload });
  };

  const hasMasterDimensions = productQuery.data
    ? productQuery.data.length != null &&
      productQuery.data.width != null &&
      productQuery.data.height != null
    : false;

  const showDimensionInputs = line.product_id === null || (productQuery.data && !hasMasterDimensions);

  return (
    <div className="relative rounded-2xl bg-white/55 backdrop-blur-md p-5 ring-1 ring-zinc-900/5 shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-zinc-900">
            {line.product_name || (productQuery.data ? productQuery.data.name : "Producto sin nombre")}
          </h4>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            {line.product_id ? (productQuery.data ? productQuery.data.internal_reference : "Cargando...") : "Personalizado"}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (confirm("¿Estás seguro de quitar este producto?")) {
                remove.mutate(line.id);
              }
            }}
            disabled={remove.isPending}
            className="text-[10px] uppercase tracking-wider font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
          >
            {remove.isPending ? "Quitando..." : "Quitar"}
          </button>
        )}
      </div>

      {/* Inputs */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="w-full md:w-32 flex-none">
          <DecimalField
            label="Cantidad *"
            value={String(line.quantity)}
            requirement="required"
            entero
            disabled={!canEdit}
            onCommit={(val) => handleUpdate({ quantity: Number(val) || 0 })}
          />
        </div>

        {hasMasterDimensions ? (
          <div className="w-full md:w-48 flex-none flex flex-col gap-1.5 pt-1">
            <span className="text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider">Medidas del maestro</span>
            <div className="h-10 px-3 rounded-xl border border-transparent bg-white/40 flex items-center text-xs text-zinc-700 font-medium">
              {line.length_cm} &times; {line.width_cm} &times; {line.height_cm} cm
            </div>
          </div>
        ) : showDimensionInputs ? (
          <div className="w-full flex-1 grid grid-cols-3 gap-2">
            <DecimalField
              label="Largo (cm) *"
              value={line.length_cm}
              requirement="required"
              disabled={!canEdit}
              onCommit={(val) => handleUpdate({ length_cm: val })}
            />
            <DecimalField
              label="Ancho (cm) *"
              value={line.width_cm}
              requirement="required"
              disabled={!canEdit}
              onCommit={(val) => handleUpdate({ width_cm: val })}
            />
            <DecimalField
              label="Alto (cm) *"
              value={line.height_cm}
              requirement="required"
              disabled={!canEdit}
              onCommit={(val) => handleUpdate({ height_cm: val })}
            />
          </div>
        ) : (
          <div className="w-full md:w-48 flex-none pt-1">
             {/* Carga del maestro */}
             <Spinner className="size-4" />
          </div>
        )}

        <div className="w-full flex-1">
          <ObservationField
            value={line.client_observation || ""}
            disabled={!canEdit}
            onCommit={(val) => handleUpdate({ client_observation: val })}
          />
        </div>
      </div>

      {/* Info extra */}
      <div className="mt-4 pt-3 border-t border-zinc-200/50 flex flex-wrap gap-4 text-[11px]">
        <div className="text-zinc-600">
          <span className="font-semibold text-zinc-900">Vol unitario:</span> {line.unit_volume_cm3} cm³
        </div>
        <div className="text-zinc-600">
          <span className="font-semibold text-zinc-900">Vol total:</span> {line.total_volume_cm3} cm³
        </div>
      </div>
    </div>
  );
}

export function V2NextProductsStep({ quotation }: { quotation: V2Quotation }) {
  const query = useV2QuotationProducts(quotation.id);
  const add = useAddV2QuotationProduct(quotation.id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canEdit = quotation.status === "DRAFT";

  if (query.isPending) {
    return <div className="p-12"><Spinner className="mx-auto size-6" /></div>;
  }
  if (query.isError) {
    return <div className="p-12 text-red-600">{query.error instanceof ApiError && query.error.status === 404 ? "No encontrado" : describeError(query.error)}</div>;
  }

  const items = query.data.items;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-500 m-0">Productos</h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-[11px] font-bold text-zinc-900 bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-full ring-1 ring-zinc-200 shadow-sm transition-all"
          >
            + Agregar producto
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/40 p-12 text-center flex flex-col items-center justify-center">
          <p className="text-sm text-zinc-600 font-medium mb-4">Todavía no hay productos en esta cotización.</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-bold text-zinc-900 bg-white hover:bg-zinc-50 px-4 py-2 rounded-full ring-1 ring-zinc-200 shadow-sm transition-all"
            >
              + Agregar producto
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((line) => (
            <ProductLineCard key={line.id} line={line} quotationId={quotation.id} canEdit={canEdit} />
          ))}
        </div>
      )}

      <AddProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isPending={add.isPending}
        onAddProduct={(product) => {
          add.mutate({ product_id: product.id, quantity: 1 }, {
            onSuccess: () => setIsModalOpen(false)
          });
        }}
        onAddCustomProduct={(name) => {
          add.mutate({ product_name: name, quantity: 1 }, {
            onSuccess: () => setIsModalOpen(false)
          });
        }}
      />
    </div>
  );
}
