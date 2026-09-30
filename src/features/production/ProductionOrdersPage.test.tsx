import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch, renderApp, sessionResponse } from "@/test/utils";

afterEach(() => vi.unstubAllGlobals());

describe("trabajo en curso", () => {
  it("presenta cantidades, etapa, hornada y origen entregados por W2", async () => {
    const spy = mockFetch((url) => {
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/production/wip")) {
        return jsonResponse(200, [{
          line_ref: "V2P:301",
          product_name: "Taza de café",
          production_order_id: 51,
          production_order_code: "OP-2026-000051",
          started_quantity: "20",
          stage: "PROGRAMADA_HORNO",
          kiln_batch_code: "HOR-2026-000009",
          source: "V2_QUOTATION",
        }]);
      }
      if (url.includes("/production-orders")) return jsonResponse(200, { items: [], total: 0, limit: 25, offset: 0 });
      return jsonResponse(200, { items: [], total: 0 });
    });
    renderApp(["/produccion"]);

    const wip = await screen.findByTestId("production-wip");
    expect(wip).toHaveTextContent("Taza de café");
    expect(wip).toHaveTextContent("OP-2026-000051");
    expect(wip).toHaveTextContent("20");
    expect(wip).toHaveTextContent("PROGRAMADA_HORNO");
    expect(wip).toHaveTextContent("HOR-2026-000009");
    expect(wip).toHaveTextContent("V2_QUOTATION");
    expect(spy.mock.calls.some(([url]) => String(url).includes("/production/wip"))).toBe(true);
  });
});
