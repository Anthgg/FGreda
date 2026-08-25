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
  dimensions: Record<ProductDimension, string>;
  editableDimensions: ProductDimension[];
  recipeId: string;
  recipeLabel: string;
  recipeVersionId: string;
  materialGramsPerPiece: string;
  techniqueIds: string[];
  additionalIds: string[];
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
  editableDimensions: ["width", "height", "length", "depth"],
  recipeId: "",
  recipeLabel: "",
  recipeVersionId: "",
  materialGramsPerPiece: "",
  techniqueIds: [],
  additionalIds: [],
  otherCostIds: [],
  daysAdjustment: "0",
  waitingDays: "0",
  markupPercent: "100",
  commercialSaleUnitPrice: "",
});

const decimal = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export function itemFromProduct(product: Product): CotizadorItemDraft {
  const fields: ProductDimension[] = ["width", "height", "length", "depth"];
  return {
    productId: String(product.id),
    productLabel: `${product.internal_reference} · ${product.name}`,
    quantity: "",
    dimensions: {
      width: decimal(product.width),
      height: decimal(product.height),
      length: decimal(product.length),
      depth: decimal(product.depth),
    },
    editableDimensions: fields.filter((field) => product[field] == null),
    recipeId: "",
    recipeLabel: "",
    recipeVersionId: "",
    materialGramsPerPiece: "",
    techniqueIds: [],
    additionalIds: [],
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
    editableDimensions: item.editable_dimensions,
    recipeId: decimal(item.recipe_id),
    recipeLabel: item.recipe_id ? `Receta #${item.recipe_id}` : "",
    recipeVersionId: decimal(item.recipe_version_id),
    materialGramsPerPiece: decimal(item.material_grams_per_piece),
    techniqueIds: idsFromSnapshots(item.techniques, "technique_id"),
    additionalIds: idsFromSnapshots(item.additionals, "additional_id"),
    otherCostIds: idsFromSnapshots(item.other_costs, "other_cost_id"),
    daysAdjustment: String(item.days_adjustment),
    waitingDays: String(item.waiting_days),
    markupPercent: decimal(item.markup_percent) || "100",
    commercialSaleUnitPrice: decimal(item.commercial_sale_unit_price),
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
      const dimensions = Object.fromEntries(
        item.editableDimensions
          .filter((field) => item.dimensions[field].trim())
          .map((field) => [field, item.dimensions[field].trim()]),
      );
      const quantity = positiveInt(item.quantity);
      const recipeId = positiveInt(item.recipeId);
      const recipeVersionId = positiveInt(item.recipeVersionId);
      const output: QuotationBuilderItemIn = {
        ...(item.id ? { id: item.id } : {}),
        product_id: productId,
        ...(quantity ? { quantity } : {}),
        dimensions,
        ...(recipeId ? { recipe_id: recipeId } : {}),
        ...(recipeVersionId
          ? { recipe_version_id: recipeVersionId }
          : {}),
        ...(item.materialGramsPerPiece.trim()
          ? { material_grams_per_piece: item.materialGramsPerPiece.trim() }
          : {}),
        techniques: item.techniqueIds.map((id, index) => ({
          technique_id: Number(id),
          quantity: quantity ?? 1,
          sort_order: index,
        })),
        additionals: item.additionalIds.map((id, index) => ({
          additional_id: Number(id),
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
