import type { QuotationCalculateIn, QuotationOut } from "@/types/quotations";

export interface TechniqueDraft {
  techniqueId: string;
  quantity: string;
  appliedCost: string;
  appliedDays: string;
}
export interface AdditionalDraft {
  additionalId: string;
  additionalQuantity: string;
  appliedCost: string;
}
export interface OtherCostDraft {
  otherCostId: string;
  appliedUnitPrice: string;
}
export interface QuotationDraft {
  name: string;
  customerId: string;
  customerLabel: string;
  productId: string;
  productLabel: string;
  quantity: string;
  displayDate: string;
  recipeId: string;
  /** Etiqueta de la receta elegida: el selector remoto pagina y puede perderla. */
  recipeLabel: string;
  recipeVersionId: string;
  firingLineId: string;
  materialsApplied: string;
  materialGramsPerPiece: string;
  techniques: TechniqueDraft[];
  additionals: AdditionalDraft[];
  daysAdjustment: string;
  waitingDays: string;
  otherCosts: OtherCostDraft[];
  commercialFactor: string;
  markupPercent: string;
  commercialSaleUnitPrice: string;
}

const localISODate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const emptyQuotationDraft: QuotationDraft = {
  name: "",
  customerId: "",
  customerLabel: "",
  productId: "",
  productLabel: "",
  quantity: "",
  displayDate: localISODate(),
  recipeId: "",
  recipeLabel: "",
  recipeVersionId: "",
  firingLineId: "",
  materialsApplied: "",
  materialGramsPerPiece: "",
  techniques: [],
  additionals: [],
  daysAdjustment: "0",
  waitingDays: "0",
  otherCosts: [],
  commercialFactor: "",
  markupPercent: "100",
  commercialSaleUnitPrice: "",
};

const strictPositiveInt = (value: string): number | null => {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};
const strictNonNegativeInt = (value: string): number | null => {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};
const strictSignedInt = (value: string): number | null => {
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export function draftToPayload(draft: QuotationDraft): QuotationCalculateIn | null {
  const productId = strictPositiveInt(draft.productId);
  const quantity = strictPositiveInt(draft.quantity);
  const daysAdjustment = strictSignedInt(draft.daysAdjustment);
  const waitingDays = strictNonNegativeInt(draft.waitingDays);
  if (!productId || !quantity || daysAdjustment === null || waitingDays === null) return null;

  const techniques = draft.techniques.map((line, index) => {
    const techniqueId = strictPositiveInt(line.techniqueId);
    const lineQuantity = strictPositiveInt(line.quantity);
    if (!techniqueId || !lineQuantity) return null;
    return {
      technique_id: techniqueId,
      quantity: lineQuantity,
      ...(line.appliedCost ? { applied_cost: line.appliedCost } : {}),
      ...(line.appliedDays && strictNonNegativeInt(line.appliedDays) !== null
        ? { applied_days: strictNonNegativeInt(line.appliedDays)! }
        : {}),
      sort_order: index,
    };
  });
  const additionals = draft.additionals.map((line, index) => {
    const additionalId = strictPositiveInt(line.additionalId);
    if (!additionalId) return null;
    return {
      additional_id: additionalId,
      ...(line.additionalQuantity ? { additional_quantity: line.additionalQuantity } : {}),
      ...(line.appliedCost ? { applied_cost: line.appliedCost } : {}),
      sort_order: index,
    };
  });
  if (techniques.some((line) => line === null) || additionals.some((line) => line === null)) {
    return null;
  }

  const customerId = strictPositiveInt(draft.customerId);

  return {
    ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
    ...(customerId ? { customer_id: customerId } : {}),
    product_id: productId,
    quantity,
    ...(strictPositiveInt(draft.recipeId)
      ? { recipe_id: strictPositiveInt(draft.recipeId)! }
      : {}),
    ...(strictPositiveInt(draft.recipeVersionId)
      ? { recipe_version_id: strictPositiveInt(draft.recipeVersionId)! }
      : {}),
    ...(strictPositiveInt(draft.firingLineId)
      ? { firing_line_id: strictPositiveInt(draft.firingLineId)! }
      : {}),
    ...(draft.materialsApplied ? { materials_applied: draft.materialsApplied } : {}),
    ...(draft.materialGramsPerPiece
      ? { material_grams_per_piece: draft.materialGramsPerPiece }
      : {}),
    techniques: techniques.filter((line) => line !== null),
    additionals: additionals.filter((line) => line !== null),
    days_adjustment: daysAdjustment,
    waiting_days: waitingDays,
    other_costs: draft.otherCosts
      .map((line, index) => {
        const id = strictPositiveInt(line.otherCostId);
        if (!id) return null;
        return {
          other_cost_id: id,
          ...(line.appliedUnitPrice ? { unit_price: line.appliedUnitPrice } : {}),
          sort_order: index,
        };
      })
      .filter((line) => line !== null),
    ...(draft.commercialFactor ? { commercial_factor: draft.commercialFactor } : {}),
    ...(draft.markupPercent ? { markup_percent: draft.markupPercent } : {}),
    ...(draft.commercialSaleUnitPrice
      ? { commercial_sale_unit_price: draft.commercialSaleUnitPrice }
      : {}),
  };
}

export function quotationToDraft(quote: QuotationOut): QuotationDraft {
  const customerLabel = quote.customer_name_snapshot
    ? `${quote.customer_name_snapshot}${quote.customer_document_number_snapshot ? ` (${quote.customer_document_number_snapshot})` : ""}`
    : "";

  return {
    name: quote.name ?? "",
    customerId: quote.customer_id ? String(quote.customer_id) : "",
    customerLabel,
    productId: String(quote.product_id),
    productLabel: `${quote.product_internal_reference} · ${quote.product_name}`,
    quantity: String(quote.quantity),
    displayDate: quote.created_at.slice(0, 10),
    recipeId: quote.recipe_id ? String(quote.recipe_id) : "",
    recipeLabel: "",
    recipeVersionId: quote.recipe_version_id ? String(quote.recipe_version_id) : "",
    firingLineId: quote.firing_line_id ? String(quote.firing_line_id) : "",
    materialsApplied: quote.materials_applied,
    materialGramsPerPiece: quote.material_grams_per_piece ?? "",
    techniques: quote.techniques.map((line) => ({
      techniqueId: String(line.technique_id),
      quantity: String(line.quantity),
      appliedCost: line.adjusted ? line.applied_cost : "",
      appliedDays: line.adjusted ? String(line.applied_days) : "",
    })),
    additionals: quote.additionals.map((line) => ({
      additionalId: String(line.additional_id),
      additionalQuantity: line.additional_quantity ?? "",
      appliedCost: line.adjusted ? line.applied_cost : "",
    })),
    daysAdjustment: String(quote.days_adjustment),
    waitingDays: String(quote.waiting_days),
    otherCosts: quote.other_costs.map((line) => ({
      otherCostId: String(line.other_cost_id),
      appliedUnitPrice: line.adjusted ? line.unit_price_snapshot : "",
    })),
    commercialFactor: quote.commercial_factor,
    markupPercent: quote.markup_percent ?? "100",
    commercialSaleUnitPrice: quote.commercial_sale_unit_price ?? "",
  };
}
