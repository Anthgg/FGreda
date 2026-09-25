import { useState } from "react";
import { createPortal } from "react-dom";

import { ProductSelectField } from "@/components/ProductSelectField";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { useAddV2QuotationProduct } from "@/features/cotizadorV2/useQuoterV2Materials";

export function AddPieceDialog({
  quotationId,
  onClose,
}: {
  quotationId: number;
  onClose: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const anadir = useAddV2QuotationProduct(quotationId);

  const dialogRef = useDialogoAccesible<HTMLDivElement>(isOpen);

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const handleSelect = (productId: number) => {
    anadir.mutate(
      { product_id: productId, quantity: 1 },
      {
        onSuccess: () => {
          handleClose();
          setTimeout(() => {
            const inputs = document.querySelectorAll<HTMLInputElement>('input[aria-label="Cantidad"]');
            if (inputs.length > 0) {
              inputs[inputs.length - 1]?.focus();
              inputs[inputs.length - 1]?.select();
            }
          }, 100);
        },
      },
    );
  };

  const handleCreate = (name: string) => {
    anadir.mutate(
      { product_name: name, quantity: 1 },
      {
        onSuccess: () => {
          handleClose();
          setTimeout(() => {
            const inputs = document.querySelectorAll<HTMLInputElement>('input[aria-label="Cantidad"]');
            if (inputs.length > 0) {
              inputs[inputs.length - 1]?.focus();
              inputs[inputs.length - 1]?.select();
            }
          }, 100);
        },
      },
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-piece-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") handleClose();
        }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        tabIndex={-1}
      >
        <h2 id="add-piece-title" className="mb-4 text-lg font-medium text-zinc-900">
          Agregar pieza
        </h2>

        <ProductSelectField
          label="Buscar en catálogo o escribir nombre"
          value=""
          onChange={(val) => handleSelect(Number(val))}
          productType="FINISHED_PRODUCT"
          allowCreate
          createLabel={(texto) => `Pieza a medida «${texto}»`}
          onCreateRequested={handleCreate}
          searchPlaceholder="Busca o escribe el nombre..."
        />

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
