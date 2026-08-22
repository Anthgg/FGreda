/**
 * Alta y edicion de producto.
 *
 * La referencia interna solo se escribe al crear: es la clave de negocio y la
 * de deduplicacion del importador, asi que editarla romperia la trazabilidad.
 */

import { useState } from "react";

import { ApiError } from "@/api/client";
import {
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
  type SelectOption,
} from "@/components/form";
import { PRODUCT_TYPE_LABELS } from "@/features/masters/labels";
import type {
  PosCategory,
  Product,
  ProductCategory,
  ProductInput,
  ProductType,
  UnitOfMeasure,
} from "@/types/masters";

interface ProductFormProps {
  product: Product | null;
  categories: ProductCategory[];
  posCategories: PosCategory[];
  units: UnitOfMeasure[];
  disabled: boolean;
  saving: boolean;
  error: unknown;
  onSubmit: (payload: ProductInput) => void;
  onCancel: () => void;
}

function emptyDraft(): ProductInput {
  return {
    internal_reference: "",
    name: "",
    product_type: "RAW_MATERIAL",
    product_category_id: 0,
    pos_category_id: null,
    base_uom_code: null,
    purchase_uom_code: null,
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
}

function toDraft(product: Product | null): ProductInput {
  if (product === null) return emptyDraft();
  const { id: _id, product_category_path: _path, pos_category_name: _pos, ...rest } = product;
  return rest;
}

export function ProductForm({
  product,
  categories,
  posCategories,
  units,
  disabled,
  saving,
  error,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [draft, setDraft] = useState<ProductInput>(() => toDraft(product));

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const categoryOptions: SelectOption[] = categories.map((item) => ({
    value: String(item.id),
    label: item.display_path,
  }));
  const posOptions: SelectOption[] = [
    { value: "", label: "Sin categoría de punto de venta" },
    ...posCategories.map((item) => ({ value: String(item.id), label: item.name })),
  ];
  const unitOptions: SelectOption[] = [
    { value: "", label: "Sin unidad" },
    ...units.map((item) => ({ value: item.code, label: `${item.name} (${item.symbol})` })),
  ];
  const typeOptions: SelectOption[] = (
    Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]
  ).map((value) => ({ value, label: PRODUCT_TYPE_LABELS[value] }));

  // El backend vuelve a validarlo; esto solo evita un viaje inútil.
  const missingUom = draft.product_type !== "SERVICE" && !draft.base_uom_code;
  const incomplete =
    draft.name.trim() === "" ||
    draft.internal_reference.trim() === "" ||
    draft.product_category_id === 0 ||
    missingUom;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="Referencia interna"
          requirement="required"
          value={draft.internal_reference}
          onChange={(value) => set("internal_reference", value)}
          disabled={disabled || product !== null}
          hint={product !== null ? "No se edita: es la clave del maestro." : undefined}
          maxLength={32}
        />
        <TextField
          label="Nombre"
          requirement="required"
          value={draft.name}
          onChange={(value) => set("name", value)}
          disabled={disabled}
          maxLength={200}
          className="sm:col-span-2"
        />
        <SelectField
          label="Tipo"
          requirement="required"
          value={draft.product_type}
          options={typeOptions}
          onChange={(value) => set("product_type", value as ProductType)}
          disabled={disabled}
        />
        <SelectField
          label="Categoría"
          requirement="required"
          value={draft.product_category_id === 0 ? "" : String(draft.product_category_id)}
          options={categoryOptions}
          onChange={(value) => set("product_category_id", Number(value))}
          disabled={disabled}
          searchPlaceholder="Buscar categoría..."
          className="lg:col-span-2"
        />
        <SelectField
          label="Categoría de punto de venta"
          requirement="optional"
          value={draft.pos_category_id === null ? "" : String(draft.pos_category_id)}
          options={posOptions}
          onChange={(value) => set("pos_category_id", value === "" ? null : Number(value))}
          disabled={disabled}
        />
        <SelectField
          label="Unidad de medida"
          requirement={draft.product_type === "SERVICE" ? "optional" : "required"}
          value={draft.base_uom_code ?? ""}
          options={unitOptions}
          onChange={(value) => set("base_uom_code", value === "" ? null : value)}
          disabled={disabled}
          hint={
            draft.product_type === "SERVICE"
              ? "Un servicio puede no tener unidad."
              : undefined
          }
          error={missingUom ? "Solo un servicio puede quedarse sin unidad." : undefined}
        />
        <SelectField
          label="Unidad de compra"
          requirement="optional"
          value={draft.purchase_uom_code ?? ""}
          options={unitOptions}
          onChange={(value) => set("purchase_uom_code", value === "" ? null : value)}
          disabled={disabled}
        />
        <TextField
          label="Costo unitario"
          requirement="optional"
          value={draft.cost}
          onChange={(value) => set("cost", value === "" ? null : value)}
          disabled={disabled}
          inputMode="decimal"
          hint="Hasta 12 decimales. Un insumo puede costar menos de S/ 0.01 por gramo."
        />
        <TextField
          label="Precio de venta"
          requirement="optional"
          value={draft.sale_price}
          onChange={(value) => set("sale_price", value === "" ? null : value)}
          disabled={disabled}
          inputMode="decimal"
        />
        <TextField
          label="IGV de venta (%)"
          requirement="optional"
          value={draft.sale_tax_rate}
          onChange={(value) => set("sale_tax_rate", value === "" ? null : value)}
          disabled={disabled}
          inputMode="decimal"
          hint="Porcentaje, no fracción: 18 significa 18 %."
        />
      </div>

      <div className="flex flex-wrap gap-5 border-t border-zinc-200 pt-4">
        {(
          [
            ["sellable", "Se vende"],
            ["purchasable", "Se compra"],
            ["available_in_pos", "Disponible en punto de venta"],
            ["active", "Activo"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={draft[key]}
              onChange={(event) => set(key, event.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-zinc-300"
            />
            {label}
          </label>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-red-600">
          {error instanceof ApiError ? error.message : "No se pudo guardar el producto."}
        </p>
      ) : null}

      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={disabled || saving || incomplete}>
          {saving ? "Guardando..." : product === null ? "Crear producto" : "Guardar cambios"}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={saving}>
          Cancelar
        </SecondaryButton>
      </div>
    </form>
  );
}
