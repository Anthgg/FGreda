import type { Product } from "@/types/masters";
import type {
  ProductDimension,
  QuotationBuilderDraftIn,
  QuotationBuilderItemIn,
  QuotationBuilderItemOut,
  QuotationBuilderOut,
} from "@/types/quotationBuilder";

export interface CotizadorItemDraft {
  id?: number;
  productId: string;
  productLabel: string;
  quantity: string;
  /** Medidas EFECTIVAS de la linea: las que se cotizan y se congelan. */
  dimensions: Record<ProductDimension, string>;
  /**
   * Medidas del maestro vigente. Solo para la UI: permite prellenar al
   * activar "Personalizar medidas" y restaurar exactamente al desactivarlo,
   * sin consultar el producto por separado. Nunca se envia al backend.
   */
  standardDimensions: Record<ProductDimension, string>;
  /** Fase 009B: la linea usa medidas propias en vez de las del maestro. */
  dimensionsOverridden: boolean;
  editableDimensions: ProductDimension[];
  recipeId: string;
  recipeLabel: string;
  recipeVersionId: string;
  firingLineId: string;
  firingLineLabel: string;
  materialsApplied: string;
  materialGramsPerPiece: string;
  lowKilnId: string;
  highKilnId: string;
  factorKilnId: string;
  techniqueIds: string[];
  techniqueQuantities: Record<string, string>;
  additionalIds: string[];
  additionalQuantities: Record<string, string>;
  otherCostIds: string[];
  daysAdjustment: string;
  waitingDays: string;
  markupPercent: string;
  commercialSaleUnitPrice: string;
}

export interface CotizadorDraft {
  name: string;
  customerId: string;
  customerLabel: string;
  kilnId: string;
  items: CotizadorItemDraft[];
}

export const emptyCotizadorDraft = (): CotizadorDraft => ({
  name: "",
  customerId: "",
  customerLabel: "",
  kilnId: "",
  items: [],
});

export const emptyCotizadorItem = (): CotizadorItemDraft => ({
  productId: "",
  productLabel: "",
  quantity: "",
  dimensions: { width: "", height: "", length: "", depth: "" },
  standardDimensions: { width: "", height: "", length: "", depth: "" },
  dimensionsOverridden: false,
  editableDimensions: ["width", "height", "length", "depth"],
  recipeId: "",
  recipeLabel: "",
  recipeVersionId: "",
  firingLineId: "",
  firingLineLabel: "",
  materialsApplied: "",
  materialGramsPerPiece: "",
  lowKilnId: "",
  highKilnId: "",
  factorKilnId: "",
  techniqueIds: [],
  techniqueQuantities: {},
  additionalIds: [],
  additionalQuantities: {},
  otherCostIds: [],
  daysAdjustment: "0",
  waitingDays: "0",
  markupPercent: "100",
  commercialSaleUnitPrice: "",
});

const decimal = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export function itemFromProduct(product: Product): CotizadorItemDraft {
  const fields: ProductDimension[] = ["width", "height", "length", "depth"];
  const master = {
    width: decimal(product.width),
    height: decimal(product.height),
    length: decimal(product.length),
    depth: decimal(product.depth),
  };
  return {
    productId: String(product.id),
    productLabel: `${product.internal_reference} · ${product.name}`,
    quantity: "",
    // Al elegir un producto se arranca SIEMPRE en modo estandar: efectivas
    // == maestro. Personalizar es una decision explicita posterior.
    dimensions: { ...master },
    standardDimensions: master,
    dimensionsOverridden: false,
    editableDimensions: fields.filter((field) => product[field] == null),
    recipeId: "",
    recipeLabel: "",
    recipeVersionId: "",
    firingLineId: "",
    firingLineLabel: "",
    materialsApplied: "",
    materialGramsPerPiece: "",
    lowKilnId: "",
    highKilnId: "",
    factorKilnId: "",
    techniqueIds: [],
    techniqueQuantities: {},
    additionalIds: [],
    additionalQuantities: {},
    otherCostIds: [],
    daysAdjustment: "0",
    waitingDays: "0",
    markupPercent: "100",
    commercialSaleUnitPrice: "",
  };
}

function idsFromSnapshots(values: Array<Record<string, unknown>>, key: string): string[] {
  return values
    .map((value) => value[key])
    .filter((value): value is number => typeof value === "number")
    .map(String);
}

function quantitiesFromSnapshots(
  values: Array<Record<string, unknown>>,
  idKey: string,
  quantityKey: string,
): Record<string, string> {
  return Object.fromEntries(
    values.flatMap((value) => {
      const id = value[idKey];
      const quantity = value[quantityKey];
      return typeof id === "number" && quantity !== null && quantity !== undefined
        ? [[String(id), String(quantity)]]
        : [];
    }),
  );
}

function itemFromOutput(item: QuotationBuilderItemOut): CotizadorItemDraft {
  return {
    ...(item.id ? { id: item.id } : {}),
    productId: String(item.product_id),
    productLabel: `${item.product_internal_reference} · ${item.product_name}`,
    quantity: decimal(item.quantity),
    dimensions: {
      width: decimal(item.width),
      height: decimal(item.height),
      length: decimal(item.length),
      depth: decimal(item.depth),
    },
    standardDimensions: {
      width: decimal(item.standard_width),
      height: decimal(item.standard_height),
      length: decimal(item.standard_length),
      depth: decimal(item.standard_depth),
    },
    dimensionsOverridden: item.dimensions_overridden,
    editableDimensions: item.editable_dimensions,
    recipeId: decimal(item.recipe_id),
    recipeLabel: item.recipe_id ? `Receta #${item.recipe_id}` : "",
    recipeVersionId: decimal(item.recipe_version_id),
    firingLineId: decimal(item.firing_line_id),
    firingLineLabel: item.firing_line_id
      ? `${item.firing_code_snapshot ?? "Quema confirmada"} · línea #${item.firing_line_id}`
      : "",
    materialsApplied: decimal(item.materials_applied_input),
    materialGramsPerPiece: decimal(item.material_grams_per_piece),
    lowKilnId: decimal(item.low_kiln_id),
    highKilnId: decimal(item.high_kiln_id),
    factorKilnId: decimal(item.factor_kiln_id),
    techniqueIds: idsFromSnapshots(item.techniques, "technique_id"),
    techniqueQuantities: quantitiesFromSnapshots(item.techniques, "technique_id", "quantity"),
    additionalIds: idsFromSnapshots(item.additionals, "additional_id"),
    additionalQuantities: quantitiesFromSnapshots(
      item.additionals,
      "additional_id",
      "additional_quantity",
    ),
    otherCostIds: idsFromSnapshots(item.other_costs, "other_cost_id"),
    daysAdjustment: String(item.days_adjustment),
    waitingDays: String(item.waiting_days),
    markupPercent: decimal(item.markup_percent) || "100",
    commercialSaleUnitPrice: decimal(item.commercial_sale_unit_price_input),
  };
}

export function cotizadorFromOutput(value: QuotationBuilderOut): CotizadorDraft {
  return {
    name: value.name ?? "",
    customerId: decimal(value.customer_id),
    customerLabel: value.customer_name_snapshot ?? "",
    kilnId: decimal(value.kiln_id),
    items: value.items.map(itemFromOutput),
  };
}

const positiveInt = (value: string) => (/^[1-9]\d*$/.test(value) ? Number(value) : undefined);
const integer = (value: string, fallback = 0) => (/^-?\d+$/.test(value) ? Number(value) : fallback);

export function cotizadorToPayload(draft: CotizadorDraft): QuotationBuilderDraftIn {
  const customerId = positiveInt(draft.customerId);
  const kilnId = positiveInt(draft.kilnId);
  const output: QuotationBuilderDraftIn = {
    ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
    ...(customerId ? { customer_id: customerId } : {}),
    ...(kilnId ? { kiln_id: kilnId } : {}),
    items: draft.items.flatMap((item, sortOrder) => {
      const productId = positiveInt(item.productId);
      if (!productId) return [];
      // Modo personalizado: viajan TODAS las medidas con valor, porque son
      // la medida efectiva de esta cotizacion y deben ganarle al maestro.
      // Modo estandar: solo viajan las que el maestro no tiene (CASO C,
      // completar un producto sin medidas); el resto las resuelve el backend
      // desde el maestro vigente, que es justamente lo que hace que volver a
      // estandar restaure el valor del maestro aunque haya cambiado.
      const dimensionFields: ProductDimension[] = item.dimensionsOverridden
        ? ["width", "height", "length", "depth"]
        : item.editableDimensions;
      const dimensions = Object.fromEntries(
        dimensionFields
          .filter((field) => item.dimensions[field].trim())
          .map((field) => [field, item.dimensions[field].trim()]),
      );
      const quantity = positiveInt(item.quantity);
      const recipeId = positiveInt(item.recipeId);
      const recipeVersionId = positiveInt(item.recipeVersionId);
      const firingLineId = positiveInt(item.firingLineId);
      const lowKilnId = positiveInt(item.lowKilnId);
      const highKilnId = positiveInt(item.highKilnId);
      const factorKilnId = positiveInt(item.factorKilnId);
      const output: QuotationBuilderItemIn = {
        ...(item.id ? { id: item.id } : {}),
        product_id: productId,
        ...(quantity ? { quantity } : {}),
        dimensions,
        dimensions_overridden: item.dimensionsOverridden,
        ...(recipeId ? { recipe_id: recipeId } : {}),
        ...(recipeVersionId
          ? { recipe_version_id: recipeVersionId }
          : {}),
        ...(firingLineId ? { firing_line_id: firingLineId } : {}),
        ...(item.materialsApplied.trim()
          ? { materials_applied: item.materialsApplied.trim() }
          : {}),
        ...(item.materialGramsPerPiece.trim()
          ? { material_grams_per_piece: item.materialGramsPerPiece.trim() }
          : {}),
        ...(lowKilnId ? { low_kiln_id: lowKilnId } : {}),
        ...(highKilnId ? { high_kiln_id: highKilnId } : {}),
        ...(factorKilnId ? { factor_kiln_id: factorKilnId } : {}),
        techniques: item.techniqueIds.map((id, index) => ({
          technique_id: Number(id),
          quantity: positiveInt(item.techniqueQuantities[id] ?? "") ?? quantity ?? 1,
          sort_order: index,
        })),
        additionals: item.additionalIds.map((id, index) => ({
          additional_id: Number(id),
          ...((item.additionalQuantities[id] ?? "").trim()
            ? { additional_quantity: (item.additionalQuantities[id] ?? "").trim() }
            : {}),
          sort_order: index,
        })),
        days_adjustment: integer(item.daysAdjustment),
        waiting_days: Math.max(0, integer(item.waitingDays)),
        other_costs: item.otherCostIds.map((id, index) => ({
          other_cost_id: Number(id),
          sort_order: index,
        })),
        markup_percent: item.markupPercent.trim() || "100",
        ...(item.commercialSaleUnitPrice.trim()
          ? { commercial_sale_unit_price: item.commercialSaleUnitPrice.trim() }
          : {}),
        sort_order: sortOrder,
      };
      return [output];
    }),
  };
  return output;
}
