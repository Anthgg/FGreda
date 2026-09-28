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

async function put<T>(page: Page, path: string, data: unknown): Promise<T> {
  return ok<T>(await page.request.put(`${API}${path}`, { data, headers: await csrf(page) }), path);
}

function scaled(value: string): bigint {
  const [whole = "0", fractional = ""] = value.trim().split(".");
  return BigInt(whole) * 10n ** 12n + BigInt((fractional + "0".repeat(12)).slice(0, 12) || "0");
}

test("W3: consume por pantalla Lote B explícito; B baja 10 ml y A no cambia", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  await login(page);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const rawProducts = await get<{
    items: { id: number; product_category_id: number }[];
  }>(page, "/products?limit=200&active=true&product_type=RAW_MATERIAL");
  expect(rawProducts.items.length, "el backend local necesita categoría de materia prima").toBeGreaterThan(0);
  const categoryId = rawProducts.items[0]!.product_category_id;
  const raw = await post<{ id: number }>(page, "/products", {
    name: testName("W3 explicit lot raw component"),
    product_type: "RAW_MATERIAL",
    product_category_id: categoryId,
    base_uom_code: "g",
    cost: "1",
    active: true,
  });
  const prepared = await post<{ id: number; name: string }>(page, "/products", {
    name: testName("W3 explicit lot prepared material"),
    product_type: "PREPARED_MATERIAL",
    product_category_id: categoryId,
    base_uom_code: "ml",
    cost: "0.10",
    active: true,
  });
  const location = await post<{ id: number; name: string }>(page, "/inventory/locations", {
    name: testName("W3 explicit lot location"),
  });
  await post(page, "/inventory/adjustments", {
    product_id: raw.id,
    location_id: location.id,
    quantity: "200",
    reason: "Existencia aislada para crear dos lotes W3",
  });

  const recipe = await post<{ current_version_id: number | null }>(page, "/recipes", {
    product_id: prepared.id,
    name: testName("W3 explicit lot recipe"),
    lines: [{ component_product_id: raw.id, component_type: "BASE", percentage: "100", sort_order: 0 }],
  });
  expect(recipe.current_version_id).not.toBeNull();
  const lotA = await post<{ id: number; code: string }>(page, "/recipe-preparations", {
    recipe_version_id: recipe.current_version_id,
    location_id: location.id,
    total_dry_weight_g: "100",
    water_amount_ml: "0",
    final_yield_ml: "100",
    idempotency_key: `w3-explicit-lot-a-${Date.now()}`,
  });
  const lotB = await post<{ id: number; code: string }>(page, "/recipe-preparations", {
    recipe_version_id: recipe.current_version_id,
    location_id: location.id,
    total_dry_weight_g: "100",
    water_amount_ml: "0",
    final_yield_ml: "100",
    idempotency_key: `w3-explicit-lot-b-${Date.now()}`,
  });
  expect(lotA.id).not.toBe(lotB.id);

  await put(page, `/quoter-v2/materials/${prepared.id}`, {
    material_kind: "BODY",
    origin: "PURCHASE",
    purchase_quantity: "100",
    purchase_cost: "10",
    transport_cost: "0",
    ml_per_gram: "1",
  });
  const customers = await get<{ items: { id: number }[] }>(page, "/partners?limit=5");
  const techniques = await get<{ items: { id: number; code: string }[] }>(page, "/quoter-v2/techniques?limit=100");
  expect(customers.items.length).toBeGreaterThan(0);
  const technique = techniques.items.find((item) => item.code === "E2E-A-MANO");
  expect(technique, "fixture local con técnica de taller").toBeDefined();
  if (!technique) throw new Error("No se encontró E2E-A-MANO en el catálogo local");
  const worker = await post<{ id: number }>(page, "/quoter-v2/workers", {
    name: testName("W3 explicit lot internal worker"),
    worker_type: "INTERNAL",
    daily_rate: "100",
    workday_hours: "8",
    active: true,
    technique_ids: [technique.id],
  });
  const quotation = await post<{ id: number }>(page, "/quotations-v2", {
    name: testName("W3 explicit lot quotation"),
    customer_id: customers.items[0]!.id,
  });
  const line = await post<{ id: number }>(page, `/quotations-v2/${quotation.id}/products`, {
    product_name: testName("W3 explicit lot product"),
    quantity: 1,
    length_cm: "10",
    width_cm: "10",
    height_cm: "10",
    body_material_id: prepared.id,
    body_unit_weight: "10",
    production_time_per_unit_minutes: "6",
    mold_count: 1,
  });
  const process = await post<{ id: number }>(page, `/quotations-v2/${quotation.id}/processes`, {
    v2_quotation_product_id: line.id,
    technique_id: technique.id,
  });
  await post(page, `/quotations-v2/${quotation.id}/processes/${process.id}/assign`, {
    worker_id: worker.id,
  });
  await put(page, `/quotations-v2/${quotation.id}/planning`, { effective_work_days: 1 });
  const preview = await get<{ can_confirm: boolean; fingerprint: string; blockers: unknown }>(
    page,
    `/quotations-v2/${quotation.id}/confirmation-preview`,
  );
  expect(preview.can_confirm, JSON.stringify(preview.blockers)).toBe(true);
  await post(page, `/quotations-v2/${quotation.id}/confirm`, { expected_fingerprint: preview.fingerprint });

  const beforeLots = await get<{
    preparation_id: number;
    preparation_code: string;
    quantity: string;
  }[]>(page, `/inventory/lots?product_id=${prepared.id}&location_id=${location.id}`);
  expect(beforeLots.filter((lot) => [lotA.id, lotB.id].includes(lot.preparation_id))).toHaveLength(2);
  expect(scaled(beforeLots.find((lot) => lot.preparation_id === lotA.id)!.quantity)).toBe(scaled("100"));
  expect(scaled(beforeLots.find((lot) => lot.preparation_id === lotB.id)!.quantity)).toBe(scaled("100"));
  const lotBCode = beforeLots.find((lot) => lot.preparation_id === lotB.id)!.preparation_code;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/cotizador-v2/${quotation.id}/resumen`);
  const lifecycle = page.getByTestId("v2-ciclo-de-vida");
  await lifecycle.getByRole("button", { name: "Enviar a producción" }).click();
  const sendDialog = page.getByRole("dialog");
  await sendDialog.getByRole("button", { name: /enviar a producci[oó]n/i }).last().click();
  await expect(lifecycle.getByTestId("v2-lista-produccion")).toBeVisible({ timeout: 15_000 });
  await lifecycle.getByRole("button", { name: "Crear orden de producción" }).click();
  const orderDialog = page.getByRole("dialog", { name: /crear orden de producci[oó]n/i });
  await orderDialog.getByRole("combobox").click();
  const search = page.getByPlaceholder(/buscar opci[oó]n/i);
  if (await search.isVisible().catch(() => false)) await search.fill(location.name);
  await page.getByRole("option", { name: location.name }).click();
  await orderDialog.getByRole("button", { name: "Crear orden" }).click();
  const viewOrder = lifecycle.getByTestId("v2-ver-orden");
  await expect(viewOrder).toBeVisible({ timeout: 15_000 });
  const href = await viewOrder.getAttribute("href");
  const orderId = Number(/\/produccion\/(\d+)/.exec(href ?? "")?.[1]);
  expect(orderId).toBeGreaterThan(0);

  const order = await get<{ id: number; status: string; code: string }>(page, `/production-orders/${orderId}`);
  expect(order.status).toBe("CREATED");
  await page.goto(`/produccion/${orderId}`);
  await page.getByRole("button", { name: "Registrar consumo" }).click();
  const consumptionDialog = page.getByRole("dialog", { name: /registrar consumo real/i });
  const material = consumptionDialog.getByRole("combobox", { name: /^Material/ });
  await material.click();
  await page.getByRole("option", { name: new RegExp(prepared.name) }).click();
  const lotSelector = consumptionDialog.getByRole("combobox", { name: "Lote de preparado" });
  await expect(lotSelector).toBeEnabled({ timeout: 15_000 });
  await assertW3AccessibleControls(page, "diálogo y selector de lote explícito");
  await lotSelector.click();
  const lotBOption = page.getByRole("option", { name: new RegExp(lotBCode) });
  await expect(lotBOption).toBeVisible({ timeout: 15_000 });
  await lotBOption.click();
  await consumptionDialog.getByLabel(/^Cantidad/).fill("10");
  await consumptionDialog.getByRole("button", { name: "Revisar consumo" }).click();
  const confirmation = consumptionDialog.getByTestId("consumo-confirmacion");
  await expect(confirmation.getByText(lotBCode, { exact: true })).toBeVisible();
  await expect(confirmation.getByTestId("consumo-saldo-actual")).toContainText("100 ml");
  await expect(confirmation.getByTestId("consumo-saldo-despues")).toContainText("90 ml");
  await assertW3Responsive(page, "diálogo de consumo y selección de Lote B");
  await page.setViewportSize({ width: 1440, height: 900 });
  const consumptionResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/v1/production-orders/${orderId}/consumptions`) &&
    response.request().method() === "POST",
  );
  await consumptionDialog.getByRole("button", { name: "Confirmar consumo" }).click();
  const consumptionHttp = await consumptionResponse;
  expect(consumptionHttp.ok(), `consumption: ${consumptionHttp.status()}`).toBe(true);
  await expect(page.getByText(/Consumo registrado: 10 ml/)).toBeVisible({ timeout: 15_000 });

  const consumed = await get<{
    items: { preparation_id: number | null; quantity: string; product_id: number }[];
    total: number;
  }>(page, `/production-orders/${orderId}/consumptions`);
  expect(consumed.total).toBe(1);
  expect(consumed.items[0]).toMatchObject({ preparation_id: lotB.id, product_id: prepared.id });
  expect(scaled(consumed.items[0]!.quantity)).toBe(scaled("10"));
  const afterLots = await get<{
    preparation_id: number;
    quantity: string;
  }[]>(page, `/inventory/lots?product_id=${prepared.id}&location_id=${location.id}`);
  expect(scaled(afterLots.find((lot) => lot.preparation_id === lotA.id)!.quantity)).toBe(scaled("100"));
  expect(scaled(afterLots.find((lot) => lot.preparation_id === lotB.id)!.quantity)).toBe(scaled("90"));

  await page.getByRole("button", { name: "Iniciar producción" }).click();
  await expect(page.getByText("EN PROCESO", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/produccion");
  await expect(page.getByRole("heading", { level: 1, name: "Producción." })).toBeVisible();
  const wip = page.getByTestId("production-wip");
  await expect(wip).toContainText(order.code);
  await assertW3AccessibleControls(page, "trabajo en curso");
  await assertW3Responsive(page, "trabajo en curso");

  await page.goto("/inventario");
  await expect(page.getByRole("heading", { level: 1, name: "Inventario." })).toBeVisible();
  await assertW3AccessibleControls(page, "inventario y entrega");
  await assertW3Responsive(page, "inventario y entrega");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
