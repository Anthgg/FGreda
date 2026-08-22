/**
 * Modal para crear una nueva receta.
 *
 * Utiliza SelectField accesible con mini buscador integrado (cero selects nativos).
 */

import { useState } from "react";

import { Field, PrimaryButton, SecondaryButton, SelectField } from "@/components/form";
import { describeError } from "@/features/settings/messages";
import { useProducts } from "@/features/masters/useMasters";
import { useCreateRecipe } from "@/features/recipes/useRecipes";
import { RecipeVersionForm } from "@/features/recipes/RecipeVersionForm";
import type { RecipeCreate, RecipeVersionIn } from "@/types/recipes";

interface Props {
  onClose: () => void;
}

export function RecipeCreateModal({ onClose }: Props) {
  const [step, setStep] = useState<"header" | "version">("header");
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [headerError, setHeaderError] = useState<string | null>(null);

  const createRecipe = useCreateRecipe();

  // Productos de tipo PREPARED_MATERIAL
  const products = useProducts({ product_type: "PREPARED_MATERIAL", limit: 200 });
  const prepProducts = products.data?.items ?? [];

  const productOptions = prepProducts.map((p) => ({
    value: String(p.id),
    label: `${p.internal_reference} · ${p.name}`,
  }));

  const handleHeaderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !name.trim()) {
      setHeaderError("Producto y nombre son obligatorios.");
      return;
    }
    setHeaderError(null);
    setStep("version");
  };

  const handleVersionSubmit = async (versionPayload: RecipeVersionIn, activate: boolean) => {
    const payload: RecipeCreate = {
      product_id: Number(productId),
      name: name.trim(),
      lines: versionPayload.lines,
      ...(versionPayload.notes ? { notes: versionPayload.notes } : {}),
      active: true,
      activate_immediately: activate,
    };
    await createRecipe.mutateAsync(payload);
    onClose();
  };

  if (step === "version") {
    return (
      <RecipeVersionForm
        recipeId={0}
        onClose={onClose}
        onSubmit={handleVersionSubmit}
        isPending={createRecipe.isPending}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-900 text-xl font-bold"
          aria-label="Cerrar"
        >
          ✕
        </button>

        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Nueva receta</h2>

        <form onSubmit={handleHeaderSubmit} className="space-y-4">
          <SelectField
            label="Producto (material preparado)"
            requirement="required"
            value={productId}
            options={productOptions}
            onChange={setProductId}
            searchable={true}
            searchPlaceholder="Buscar material preparado..."
            placeholder="Seleccionar material preparado..."
          />

          <Field label="Nombre de la receta" requirement="required">
            {(id) => (
              <input
                id={id}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="Ej: Barniz mate estándar"
                required
              />
            )}
          </Field>

          {headerError && <p className="text-sm text-red-600">{headerError}</p>}

          {createRecipe.isError && (
            <p className="text-sm text-red-600">{describeError(createRecipe.error)}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <SecondaryButton onClick={onClose}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit">Siguiente: componentes →</PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
