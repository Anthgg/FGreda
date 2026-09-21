import { ProductSelectField } from "@/components/ProductSelectField";
import type { Product } from "@/types/masters";

export function AddProductModal({
  isOpen,
  onClose,
  onAddProduct,
  onAddCustomProduct,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Product) => void;
  onAddCustomProduct: (name: string) => void;
  isPending: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 pb-10 px-4 bg-zinc-950/20 backdrop-blur-sm">
      <div 
        className="fixed inset-0" 
        onClick={() => !isPending && onClose()}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white/95 backdrop-blur-xl p-6 shadow-2xl border border-white/50 ring-1 ring-zinc-900/5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-zinc-900">Agregar producto</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-700 transition-colors text-xl font-medium px-2"
          >
            &times;
          </button>
        </div>

        <div className="min-h-[250px]">
          <ProductSelectField
            label="Buscar pieza del catálogo"
            value=""
            placeholder="Ej: Jarra, Taza, LAB50001..."
            searchPlaceholder="Buscar por código o nombre..."
            onChange={(_, product) => {
              if (product) onAddProduct(product);
            }}
            allowCreate
            createLabel={(text) => `+ Crear pieza personalizada "${text}"`}
            onCreateRequested={(text) => onAddCustomProduct(text)}
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  );
}
