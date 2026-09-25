import { expect, test } from "@playwright/test";

import { interceptarApi, QUEMA, vigilarConsola } from "./support/cotizadorV2NextMocks";

const QUEMA_CON_HORNOS = {
  ...QUEMA,
  kiln_id: 1,
  kiln_name: "Horno chico",
  kiln_capacity_cm3: "17000.000000",
  occupancy_percent: "85.000000",
  firing_count: 1,
  commercial_total: "350.000000",
  gas_total: "70.000000",
  difference: "280.000000",
  recommended_kiln_id: 2,
  kilns: [
    {
      kiln_id: 1,
      code: "KILN-001",
      name: "Horno chico",
      capacity_cm3: "17000.000000",
      active: true,
      occupancy_percent: "85.000000",
      firing_count: 1,
      billed_load: "0.850000",
      commercial_total: "350.000000",
      gas_total: "70.000000",
      has_rates: true,
    },
    {
      kiln_id: 2,
      code: "KILN-002",
      name: "Horno grande",
      capacity_cm3: "200000.000000",
      active: true,
      occupancy_percent: "7.225000",
      firing_count: 1,
      billed_load: "0.072250",
      commercial_total: "900.000000",
      gas_total: "120.000000",
      has_rates: true,
    },
  ],
  lines: [],
  warnings: [],
};

test.describe("Paso «Horno» del rediseño (010O.9)", () => {
  test("elegir otro horno manda un solo PUT y no desborda a 375 px", async ({ page }) => {
    const errores = vigilarConsola(page);
    const escrituras = await interceptarApi(page, (ruta, metodo, cuerpo) => {
      if (ruta.endsWith("/quotations-v2/7/firing") && metodo === "GET") return QUEMA_CON_HORNOS;
      if (ruta.endsWith("/quotations-v2/7/firing") && metodo === "PUT") {
        return {
          ...QUEMA_CON_HORNOS,
          kiln_id: (cuerpo as { kiln_id?: number }).kiln_id ?? QUEMA_CON_HORNOS.kiln_id,
        };
      }
      return undefined;
    });

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/cotizador-v2-next/7/quema");
    await expect(page.getByTestId("v2next-paso-horno")).toBeVisible();

    await page.getByRole("radio", { name: /Horno grande/ }).click();
    await expect.poll(() => escrituras.filter((e) => e.ruta.endsWith("/firing")).length).toBe(1);
    await page.waitForTimeout(600);

    const firingWrites = escrituras.filter((e) => e.ruta.endsWith("/firing"));
    expect(firingWrites).toEqual([
      { metodo: "PUT", ruta: "/api/v1/quotations-v2/7/firing", cuerpo: { kiln_id: 2 } },
    ]);

    const desborde = await page.evaluate(() => {
      const principal = document.querySelector("main") as HTMLElement;
      return {
        pagina: document.documentElement.scrollWidth - window.innerWidth,
        principal: principal.scrollWidth - principal.clientWidth,
      };
    });
    expect(desborde.pagina).toBeLessThanOrEqual(0);
    expect(desborde.principal).toBeLessThanOrEqual(0);
    expect(errores).toEqual([]);
  });
});
