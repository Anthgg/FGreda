import { useState } from "react";
import { createPortal } from "react-dom";

import { ProductSelectField } from "@/components/ProductSelectField";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { useAddV2QuotationProduct } from "@/features/cotizadorV2/useQuoterV2Materials";
import { SecondaryButton } from "@/components/form";
import { describeError } from "@/features/settings/messages";

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

  const enfocarCantidadNueva = () => {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[aria-label="Cantidad"]');
      inputs[inputs.length - 1]?.focus();
      inputs[inputs.length - 1]?.select();
    }, 100);
  };

  const handleSelect = (productId: number) => {
    anadir.mutate(
      { product_id: productId, quantity: 1 },
      {
        onSuccess: () => {
          handleClose();
          enfocarCantidadNueva();
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
          enfocarCantidadNueva();
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
        className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-xl"
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
          disabled={anadir.isPending}
          allowCreate
          createLabel={(texto) => `Pieza a medida «${texto}»`}
          onCreateRequested={handleCreate}
          searchPlaceholder="Busca o escribe el nombre..."
        />

        {anadir.isError ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {describeError(anadir.error)}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <SecondaryButton type="button" onClick={handleClose} disabled={anadir.isPending}>
            Cancelar
          </SecondaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
