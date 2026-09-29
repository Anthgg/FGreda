import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { testName } from "../helpers/fixtures";
import { assertW3AccessibleControls, assertW3Responsive } from "../helpers/w3-accessibility";

const API = "/api/v1";

async function csrf(page: Page): Promise<Record<string, string>> {
  const cookie = (await page.context().cookies()).find((item) => item.name === "greda_csrf");
  expect(cookie, "la sesión debe tener la cookie CSRF").toBeDefined();
  return { "X-CSRF-Token": cookie?.value ?? "" };
}

async function ok<T>(response: APIResponse, label: string): Promise<T> {
  expect(response.ok(), `${label}: ${response.status()} ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

async function get<T>(page: Page, path: string): Promise<T> {
  return ok<T>(await page.request.get(`${API}${path}`), path);
}

async function post<T>(page: Page, path: string, data: unknown): Promise<T> {
  return ok<T>(await page.request.post(`${API}${path}`, { data, headers: await csrf(page) }), path);
}

function scaled(value: string): bigint {
  const [whole = "0", fractional = ""] = value.trim().split(".");
  return BigInt(whole) * 10n ** 12n + BigInt((fractional + "0".repeat(12)).slice(0, 12) || "0");
}

function scaled18(value: string): bigint {
  const [whole = "0", fractional = ""] = value.trim().split(".");
  return BigInt(whole) * 10n ** 18n + BigInt((fractional + "0".repeat(18)).slice(0, 18) || "0");
}

async function createQuote(page: Page, name: string) {
  const customers = await get<{ items: { id: number }[] }>(page, "/partners?limit=5");
  expect(customers.items.length).toBeGreaterThan(0);
  return post<{ id: number }>(page, "/quotations-v2", {
    name: testName(name),
    customer_id: customers.items[0]!.id,
  });
}

async function addTimedProduct(
  page: Page,
  quotationId: number,
  productName: string,
  minutes: number,
) {
  return post<{ id: number }>(page, `/quotations-v2/${quotationId}/products`, {
    product_name: testName(productName),
    quantity: 1,
    length_cm: "10",
    width_cm: "10",
    height_cm: "10",
    production_time_per_unit_minutes: String(minutes),
    mold_count: 1,
  });
}

function captureUiErrors(page: Page): { errors: string[]; pageErrors: string[] } {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { errors, pageErrors };
}

test("W3: externo 10 h a S/120 por jornada de 8 h = S/150 comercial, S/240 real, brecha S/90", async ({ page }) => {
  await login(page);
  const watch = captureUiErrors(page);
  const techniques = await get<{ items: { id: number; code: string }[] }>(page, "/quoter-v2/techniques?limit=100");
  const technique = techniques.items.find((item) => item.code === "E2E-A-MANO");
  expect(technique, "fixture local con técnica de taller").toBeDefined();
  if (!technique) throw new Error("No se encontró E2E-A-MANO en el catálogo local");

  const worker = await post<{ id: number }>(page, "/quoter-v2/workers", {
    name: testName("W3 worker external 120 per 8 hours"),
    worker_type: "EXTERNAL",
    daily_rate: "120",
    workday_hours: "8",
    active: true,
    technique_ids: [technique.id],
  });
  const quotation = await createQuote(page, "W3 external labor 10h");
  const product = await addTimedProduct(page, quotation.id, "W3 external 10h piece", 600);
  const process = await post<{ id: number }>(page, `/quotations-v2/${quotation.id}/processes`, {
    v2_quotation_product_id: product.id,
    technique_id: technique.id,
  });
  await post(page, `/quotations-v2/${quotation.id}/processes/${process.id}/assign`, {
    worker_id: worker.id,
  });

  const pricing = await get<{
    active_production_minutes: string;
    active_production_hours: string;
    commercial_external_labor_cost: string;
    real_external_labor_cost: string;
    labor_cost_gap: string;
  }>(page, `/quotations-v2/${quotation.id}/pricing`);
  expect(scaled(pricing.active_production_minutes)).toBe(scaled("600"));
  expect(scaled(pricing.active_production_hours)).toBe(scaled("10"));
  expect(scaled(pricing.commercial_external_labor_cost)).toBe(scaled("150"));
  expect(scaled(pricing.real_external_labor_cost)).toBe(scaled("240"));
  expect(scaled(pricing.labor_cost_gap)).toBe(scaled("90"));

  for (const step of ["piezas", "trabajo"]) {
    await page.goto(`/cotizador-v2/${quotation.id}/${step}`);
    await expect(page.locator("main")).toBeVisible();
    await assertW3AccessibleControls(page, `cotizador ${step}`);
    await assertW3Responsive(page, `cotizador ${step}`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/cotizador-v2/${quotation.id}/precio`);
  await expect(page.getByTestId("v2next-tiempo-activo")).toContainText("10 h");
  const detail = page.locator("details").filter({ hasText: "Costo comercial, costo real y quema" });
  await detail.locator("summary").click();
  const externalLaborFigures: Array<[string, string]> = [
    ["Mano de obra externa imputada", "S/ 150.00"],
    ["Mano de obra externa real", "S/ 240.00"],
    ["Diferencia de mano de obra", "S/ 90.00"],
  ];
  for (const [label, value] of externalLaborFigures) {
    const cifra = page.getByText(label, { exact: true }).locator("xpath=..");
    await expect(cifra).toContainText(value);
  }
  await assertW3AccessibleControls(page, "cotizador precio y trabajo externo");
  await assertW3Responsive(page, "cotizador precio y trabajo externo");
  expect(watch.errors).toEqual([]);
  expect(watch.pageErrors).toEqual([]);
});

test("W3: dos líneas activas de 5 h y 6 h suman 6 h en paralelo, no 11 h", async ({ page }) => {
  await login(page);
  const watch = captureUiErrors(page);
  const quotation = await createQuote(page, "W3 parallel 5h 6h");
  const lineA = await addTimedProduct(page, quotation.id, "W3 parallel A 5h", 300);
  const lineB = await addTimedProduct(page, quotation.id, "W3 parallel B 6h", 360);
  const techniques = await get<{ items: { id: number; code: string }[] }>(
    page,
    "/quoter-v2/techniques?limit=100",
  );
  const technique = techniques.items.find((item) => item.code === "E2E-A-MANO");
  expect(technique, "fixture local con técnica de taller").toBeDefined();
  if (!technique) throw new Error("No se encontró E2E-A-MANO en el catálogo local");
  const workerA = await post<{ id: number }>(page, "/quoter-v2/workers", {
    name: testName("W4 paralelo externo A"),
    worker_type: "EXTERNAL",
    daily_rate: "120",
    workday_hours: "8",
    active: true,
    technique_ids: [technique.id],
  });
  const workerB = await post<{ id: number }>(page, "/quoter-v2/workers", {
    name: testName("W4 paralelo externo B"),
    worker_type: "EXTERNAL",
    daily_rate: "120",
    workday_hours: "8",
    active: true,
    technique_ids: [technique.id],
  });
  for (const [line, worker] of [[lineA, workerA], [lineB, workerB]] as const) {
    const process = await post<{ id: number }>(page, `/quotations-v2/${quotation.id}/processes`, {
      v2_quotation_product_id: line.id,
      technique_id: technique.id,
    });
    await post(page, `/quotations-v2/${quotation.id}/processes/${process.id}/assign`, {
      worker_id: worker.id,
    });
  }

  const pricing = await get<{
    active_production_minutes: string;
    active_production_hours: string;
    commercial_external_labor_cost: string;
    real_external_labor_cost: string;
    space_cost: string;
    lines: {
      product_name: string;
      line_active_minutes: string | null;
      external_commercial_cost: string;
      external_real_cost: string;
      space_cost: string;
    }[];
  }>(page, `/quotations-v2/${quotation.id}/pricing`);
  expect(scaled(pricing.active_production_minutes)).toBe(scaled("360"));
  expect(scaled(pricing.active_production_hours)).toBe(scaled("6"));
  expect(pricing.lines.map((line) => scaled(line.line_active_minutes ?? "0")).sort()).toEqual(
    [scaled("300"), scaled("360")].sort(),
  );
  expect(pricing.lines.every((line) => scaled(line.external_commercial_cost) > 0n)).toBe(true);
  expect(pricing.lines.every((line) => scaled(line.external_real_cost) > 0n)).toBe(true);
  expect(pricing.lines.every((line) => scaled(line.space_cost) > 0n)).toBe(true);
  const lineSpaceTotal = pricing.lines.reduce((total, line) => total + scaled18(line.space_cost), 0n);
  expect(
    lineSpaceTotal,
    `line space=${JSON.stringify(pricing.lines.map((line) => line.space_cost))}; order space=${pricing.space_cost}`,
  ).toBe(scaled18(pricing.space_cost));
  expect(pricing.lines.reduce((total, line) => total + scaled18(line.external_commercial_cost), 0n))
    .toBe(scaled18(pricing.commercial_external_labor_cost));
  expect(pricing.lines.reduce((total, line) => total + scaled18(line.external_real_cost), 0n))
    .toBe(scaled18(pricing.real_external_labor_cost));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/cotizador-v2/${quotation.id}/precio`);
  await expect(page.getByTestId("v2next-tiempo-activo")).toContainText("6 h");
  await expect(page.getByTestId("v2next-tiempo-activo")).not.toContainText("11 h");
  await assertW3AccessibleControls(page, "cotizador precio paralelo");
  await assertW3Responsive(page, "cotizador precio paralelo");
  expect(watch.errors).toEqual([]);
  expect(watch.pageErrors).toEqual([]);
});
