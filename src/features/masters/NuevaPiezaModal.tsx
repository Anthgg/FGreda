/**
 * Modal compacto para dar de alta una nueva pieza sin salir de donde estas.
 *
 * Vive con los maestros y no en un modulo concreto porque crea un producto:
 * lo usan tanto Quemas como Cotizaciones, y duplicarlo daria dos formularios
 * que acabarian divergiendo.
 *
 * Solo pide los campos mínimos e indispensables: Nombre, Categoría y Unidad.
 * El tipo queda bloqueado como FINISHED_PRODUCT y el backend genera
 * automáticamente la referencia interna LAB50xxx.
 */

import { useEffect, useState } from "react";

import {
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
  type SelectOption,
} from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import {
  useCreateProduct,
  useProductCategories,
  useUnits,
} from "@/features/masters/useMasters";
import type { Product, ProductInput } from "@/types/masters";

interface NuevaPiezaModalProps {
  initialName: string;
  onClose: () => void;
  onCreated: (product: Product) => void;
}

export function NuevaPiezaModal({
  initialName,
  onClose,
  onCreated,
}: NuevaPiezaModalProps) {
  const [name, setName] = useState(initialName.trim());
  const [categoryId, setCategoryId] = useState("");
  const [uomCode, setUomCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const categories = useProductCategories();
  const units = useUnits();
  const createProduct = useCreateProduct();

  // Precargar unidad 'unit' (u) si está disponible en el catálogo
  useEffect(() => {
    if (!uomCode && units.data?.length) {
      const canonicalUnit = units.data.find(
        (u) => u.code.toLowerCase() === "unit" || u.code.toLowerCase() === "u",
      );
      if (canonicalUnit) {
        setUomCode(canonicalUnit.code);
      } else {
        const countUnit = units.data.find((u) => u.dimension === "COUNT");
        if (countUnit) setUomCode(countUnit.code);
      }
    }
  }, [units.data, uomCode]);

  const categoryOptions: SelectOption[] = (categories.data ?? []).map((cat) => ({
    value: String(cat.id),
    label: cat.display_path || cat.name,
  }));

  const unitOptions: SelectOption[] = (units.data ?? []).map((u) => ({
    value: u.code,
    label: `${u.name} (${u.symbol})`,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setValidationError("El nombre de la pieza es obligatorio.");
      return;
    }
    if (!categoryId) {
      setValidationError("Debe seleccionar una categoría.");
      return;
    }
    if (!uomCode) {
      setValidationError("Debe seleccionar una unidad de medida.");
      return;
    }

    setValidationError(null);

    const payload: ProductInput = {
      name: cleanName,
      product_type: "FINISHED_PRODUCT",
      product_category_id: Number(categoryId),
      base_uom_code: uomCode,
      purchase_uom_code: uomCode,
      pos_category_id: null,
      cost: null,
      sale_price: null,
      sale_tax_rate: null,
      purchase_tax_rate: null,
      sellable: false,
      purchasable: false,
      available_in_pos: false,
      active: true,
      notes: null,
    };

    createProduct.mutate(payload, {
      onSuccess: (newProduct) => {
        onCreated(newProduct);
        onClose();
      },
    });
  };

  const isFormIncomplete =
    !name.trim() || !categoryId || !uomCode || createProduct.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nueva pieza"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-zinc-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-white/60 bg-white p-6 shadow-2xl sm:p-7">
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-xs">
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-zinc-900 sm:text-lg">
              Nueva pieza
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full border border-zinc-100 bg-white p-1.5 text-zinc-400 shadow-xs hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Nombre"
            requirement="required"
            value={name}
            onChange={(val) => {
              setName(val);
              if (validationError) setValidationError(null);
            }}
            placeholder="Ej: Plato palta, Taza Dragón..."
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Tipo
              </label>
              <div className="flex h-10 w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-700 select-none">
                <span className="font-medium">Pieza terminada</span>
                <span className="font-mono text-[10px] text-zinc-400">
                  FINISHED_PRODUCT
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Referencia interna
              </label>
              <div className="flex h-10 w-full items-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-3 text-xs text-zinc-400 select-none">
                Automática (LAB50xxx)
              </div>
            </div>
          </div>

          <SelectField
            label="Categoría"
            requirement="required"
            value={categoryId}
            options={categoryOptions}
            onChange={(val) => {
              setCategoryId(val);
              if (validationError) setValidationError(null);
            }}
            placeholder="Seleccionar categoría..."
            searchPlaceholder="Buscar categoría..."
          />

          <SelectField
            label="Unidad"
            requirement="required"
            value={uomCode}
            options={unitOptions}
            onChange={(val) => {
              setUomCode(val);
              if (validationError) setValidationError(null);
            }}
            placeholder="Seleccionar unidad..."
          />

          {validationError ? (
            <p role="alert" className="text-xs text-red-600">
              {validationError}
            </p>
          ) : null}

          {createProduct.isError ? (
            <p role="alert" className="text-xs text-red-600">
              {describeError(createProduct.error)}
            </p>
          ) : null}

          <footer className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
            <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
            <PrimaryButton type="submit" disabled={isFormIncomplete}>
              {createProduct.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner className="size-3 text-white" />
                  <span>Creando…</span>
                </span>
              ) : (
                "Guardar pieza"
              )}
            </PrimaryButton>
          </footer>
        </form>
      </div>
    </div>
  );
}
