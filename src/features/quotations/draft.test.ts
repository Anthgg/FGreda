import { describe, expect, it } from "vitest";

import { draftToPayload, emptyQuotationDraft } from "@/features/quotations/draft";

describe("captura decimal y cantidades del cotizador", () => {
  it.each(["1.5", "12abc", "1e3", "0", "-1", " 19"])(
    "rechaza la cantidad no entera estricta %s",
    (quantity) => {
      expect(
        draftToPayload({ ...emptyQuotationDraft, productId: "1", quantity }),
      ).toBeNull();
    },
  );

  it("conserva importes como strings y solo convierte enteros validados", () => {
    const payload = draftToPayload({
      ...emptyQuotationDraft,
      productId: "7",
      quantity: "19",
      recipeId: "3",
      recipeVersionId: "8",
      firingLineId: "11",
      materialsApplied: "11.580000000000000001",
      commercialFactor: "2.000000000000000001",
      daysAdjustment: "-5",
      waitingDays: "3",
      techniques: [
        { techniqueId: "2", quantity: "19", appliedCost: "1885.000000000000000001", appliedDays: "6" },
      ],
      additionals: [
        { additionalId: "4", additionalQuantity: "1.500000000000000001", appliedCost: "110.000000000000000001" },
      ],
      otherCosts: [{ otherCostId: "9", appliedUnitPrice: "110.000000000000000001" }],
    });

    expect(payload).not.toBeNull();
    expect(payload?.quantity).toBe(19);
    expect(payload?.days_adjustment).toBe(-5);
    expect(payload?.materials_applied).toBe("11.580000000000000001");
    expect(payload?.commercial_factor).toBe("2.000000000000000001");
    expect(payload?.techniques[0]?.applied_cost).toBe("1885.000000000000000001");
    expect(payload?.additionals[0]?.additional_quantity).toBe("1.500000000000000001");
    expect(payload?.other_costs?.[0]?.unit_price).toBe("110.000000000000000001");
  });
});
