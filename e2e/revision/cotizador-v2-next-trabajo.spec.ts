import { expect, test } from "@playwright/test";

import { COTIZACION, LINEA, interceptarApi, vigilarConsola } from "./support/cotizadorV2NextMocks";

const PRODUCTOS = {
  items: [
    { ...LINEA, id: 11, product_name: "Plato palta", quantity: 20 },
    { ...LINEA, id: 12, product_name: "Taza luna", quantity: 6 },
  ],
  materials_cost: "18.000000",
};

const TRABAJADORES = {
  items: [
    {
      id: 1,
      name: "Celso",
      worker_type: "INTERNAL",
      active: true,
      daily_rate: "120.000000",
      workday_hours: null,
      effective_workday_hours: "8.000000",
      hourly_rate: "15.000000000000",
      notes: null,
      version: 1,
      technique_ids: [3],
    },
    {
      id: 2,
      name: "Refuerzo externo",
      worker_type: "EXTERNAL",
      active: true,
      daily_rate: "160.000000",
      workday_hours: null,
      effective_workday_hours: "8.000000",
      hourly_rate: "20.000000000000",
      notes: null,
      version: 1,
      technique_ids: [3, 4],
    },
  ],
};

const TECNICAS = {
  items: [
    {
      id: 3,
      code: "vidriado",
      name: "Vidriado",
      active: true,
      default_capacity_per_workday: "50.000000",
      unit: "piezas",
      requires_glaze: true,
      manual_hours: false,
      units_per_hour: "6.250000000000",
      notes: null,
      version: 1,
    },
    {
      id: 4,
      code: "pulido",
      name: "Pulido",
      active: true,
      default_capacity_per_workday: "1.000000",
      unit: "piezas",
      requires_glaze: false,
      manual_hours: true,
      units_per_hour: "0.125000000000",
      notes: null,
      version: 1,
    },
  ],
};

const MANO_DE_OBRA = {
  items: [
    {
      id: 601,
      sort_order: 0,
      v2_quotation_product_id: 11,
      worker_id: 1,
      worker_name: "Celso",
      worker_type: "INTERNAL",
      daily_rate: "120.000000",
      workday_hours: "8.000000",
      hourly_rate: "15.000000000000",
      rate_overridden: false,
      technique_id: 3,
      technique_name: "Vidriado",
      technique_unit: "piezas",
      standard_capacity: "50.000000",
      quantity: "20.000000",
      calculated_hours: "3.200000",
      final_hours: "4.000000",
      hours_overridden: true,
      is_additional_personnel: false,
      labor_cost: "0.000000",
      warnings: [],
    },
  ],
  labor_cost: "0.000000",
  workday_load: [
    {
      worker_id: 1,
      worker_name: "Celso",
      workday_hours: "8.000000",
      assigned_hours: "4.000000",
      exceeds_workday: false,
      minimum_days: 1,
    },
  ],
  suggested_work_days: 2,
  effective_work_days: null,
  warnings: [],
};

const PROCESOS = {
  warnings: [],
  items: [
    {
      id: 501,
      v2_quotation_product_id: 11,
      product_name: "Plato palta",
      technique_id: 3,
      technique_name: "Vidriado",
      technique_unit: "piezas",
      technique_active: true,
      standard_capacity: "50.000000",
      manual_hours: false,
      origin: "PRODUCT",
      quantity: "20.000000",
      quantity_overridden: false,
      calculated_hours: "3.200000",
      labor_id: 601,
      worker_id: 1,
      worker_name: "Celso",
      final_hours: "4.000000",
      labor_cost: "0.000000",
      warnings: [],
    },
  ],
};

const ILUSTRACION = {
  enabled: false,
  quantity: "0",
  notes: null,
  daily_rate: null,
  workday_hours: null,
  capacity_per_workday: null,
  hourly_rate: null,
  hours: "0",
  cost: "0",
  lines: [],
  total_hours: "0",
  total_cost: "0",
};

function respuestasTrabajo(ruta: string) {
  if (ruta.includes("/quoter-v2/workers")) return TRABAJADORES;
  if (ruta.includes("/quoter-v2/techniques")) return TECNICAS;
  if (ruta.includes("/quotations-v2/7/products")) return PRODUCTOS;
  if (ruta.includes("/quotations-v2/7/processes")) return PROCESOS;
  if (ruta.includes("/quotations-v2/7/labor") || ruta.includes("/quotations-v2/7/planning")) {
    return MANO_DE_OBRA;
  }
  if (ruta.includes("/quotations-v2/7/illustration")) return ILUSTRACION;
  if (ruta.endsWith("/quotations-v2/7")) {
    return { ...COTIZACION, space_service_cost_per_day: "140.000000" };
  }
  return undefined;
}

test.describe("Paso «Trabajo» del rediseño (010O.8)", () => {
  test("asignar trabajador manda un solo POST assign y usar sugerencia manda planning", async ({ page }) => {
    const errores = vigilarConsola(page);
    const escrituras = await interceptarApi(page, (ruta) => respuestasTrabajo(ruta));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2-next/7/mano-de-obra");

    await expect(page.getByRole("heading", { level: 2, name: "Trabajo", exact: true })).toBeVisible();
    const fila = page.getByTestId("labor-process-501");
    await fila.getByRole("combobox", { name: "Lo hace" }).click();
    await page.getByRole("option", { name: "Refuerzo externo (Externo)" }).click();

    await expect
      .poll(() => escrituras.filter((una) => una.ruta.endsWith("/processes/501/assign")).length)
      .toBe(1);
    expect(
      escrituras.filter((una) => una.ruta.endsWith("/processes/501/assign")),
    ).toEqual([
      {
        metodo: "POST",
        ruta: "/api/v1/quotations-v2/7/processes/501/assign",
        cuerpo: { worker_id: 2 },
      },
    ]);

    await page.getByRole("button", { name: "Usar sugerencia" }).click();
    await expect
      .poll(() => escrituras.some((una) => una.ruta.endsWith("/quotations-v2/7/planning")))
      .toBe(true);
    expect(escrituras.find((una) => una.ruta.endsWith("/quotations-v2/7/planning"))).toEqual({
      metodo: "PUT",
      ruta: "/api/v1/quotations-v2/7/planning",
      cuerpo: { effective_work_days: 2 },
    });
    expect(errores).toEqual([]);
  });

  test("a 375 px no desborda la página", async ({ page }) => {
    const errores = vigilarConsola(page);
    await interceptarApi(page, (ruta) => respuestasTrabajo(ruta));
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/cotizador-v2-next/7/mano-de-obra");
    await expect(page.getByTestId("v2next-paso-trabajo")).toBeVisible();

    const desborde = await page.evaluate(() => {
      const principal = document.querySelector("main") as HTMLElement;
      return {
        pagina: document.documentElement.scrollWidth - window.innerWidth,
        principal: principal.scrollWidth - principal.clientWidth,
      };
    });
    expect(desborde.pagina, JSON.stringify(desborde)).toBeLessThanOrEqual(0);
    expect(desborde.principal, JSON.stringify(desborde)).toBeLessThanOrEqual(0);
    expect(errores).toEqual([]);
  });
});
