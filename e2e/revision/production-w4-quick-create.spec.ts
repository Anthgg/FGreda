import { expect, type APIResponse, type Locator, type Page } from "@playwright/test";
import { test } from "./w4-test";

import { login, logout } from "../helpers/auth";
import {
  E2E_OPERATOR_EMAIL,
  E2E_OPERATOR_PASSWORD,
  E2E_QUICK_CREATE_OPERATOR_EMAIL,
  E2E_QUICK_CREATE_OPERATOR_PASSWORD,
  testName,
} from "../helpers/fixtures";
import { assertW3AccessibleControls, assertW3Responsive } from "../helpers/w3-accessibility";

const API = "/api/v1";

async function csrf(page: Page): Promise<Record<string, string>> {
  const cookie = (await page.context().cookies()).find((item) => item.name === "greda_csrf");
  expect(cookie).toBeDefined();
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

async function createDraft(page: Page): Promise<number> {
  const customers = await get<{ items: { id: number }[] }>(page, "/partners?limit=5");
  const quote = await post<{ id: number }>(page, "/quotations-v2", {
    name: testName("W4 alta rápida"),
    customer_id: customers.items[0]!.id,
  });
  const line = await post<{ id: number }>(page, `/quotations-v2/${quote.id}/products`, {
    product_name: testName("Pieza para mostrar el trabajo del taller"),
    quantity: 1,
    length_cm: "10",
    width_cm: "10",
    height_cm: "5",
    production_time_per_unit_minutes: "60",
    mold_count: 1,
  });
  const bodyMaterials = await get<{ items: { product_id: number }[] }>(
    page,
    "/quoter-v2/materials?kind=BODY",
  );
  expect(bodyMaterials.items.length).toBeGreaterThan(0);
  await ok(
    await page.request.put(`${API}/quotations-v2/${quote.id}/products/${line.id}`, {
      data: { body_material_id: bodyMaterials.items[0]!.product_id, body_unit_weight: "300" },
      headers: await csrf(page),
    }),
    "completar el material de la pieza para abrir Trabajo",
  );
  return quote.id;
}

async function createTechniqueInUi(page: Page, label: string): Promise<string> {
  const name = testName(label);
  const code = `W4-${Date.now()}`;
  await page.getByRole("button", { name: "Nueva técnica" }).click();
  await page.getByLabel("Código").fill(code);
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Rendimiento por jornada").fill("20");
  await page.getByLabel("Unidad").fill("piezas");
  await page.getByRole("button", { name: "Crear técnica" }).click();
  await expect(page.getByRole("status").filter({ hasText: name })).toBeVisible({ timeout: 15_000 });
  return name;
}

async function createWorkerInUi(page: Page, label: string, techniqueName: string): Promise<string> {
  const name = testName(label);
  await page.getByRole("button", { name: "Nuevo trabajador" }).click();
  const nameField = page.getByLabel("Nombre");
  if ((await nameField.count()) === 0) {
    throw new Error(`No aparece el nombre del trabajador: ${await page.locator("main").innerText()}`);
  }
  await nameField.fill(name);
  await page.getByRole("combobox", { name: "Tipo" }).click();
  await page.getByRole("option", { name: "Externo", exact: true }).click();
  await page.getByLabel("Jornal").fill("120");
  await page.getByLabel("Jornada").fill("8");
  await page.getByRole("checkbox", { name: techniqueName, exact: true }).check();
  await page.getByRole("button", { name: "Crear trabajador" }).click();
  await expect(page.getByRole("status").filter({ hasText: name })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/No se asignó al pedido/i)).toBeVisible();
  return name;
}

async function openQuickCreate(page: Page, quotationId?: number): Promise<Locator> {
  await page.goto(quotationId ? `/cotizador-v2/${quotationId}/trabajo` : "/cotizador-v2/altas-rapidas");
  const disclosure = page.locator("details").filter({
    has: page.getByText("Alta rápida de trabajador o técnica", { exact: true }),
  });
  try {
    await expect(disclosure).toBeVisible({ timeout: 15_000 });
  } catch (error) {
    throw new Error(`No se mostró la alta rápida en ${page.url()}. Página: ${await page.locator("main").innerText()}`, { cause: error });
  }
  await disclosure.locator("summary").click();
  return disclosure;
}

test("W4: ADMIN crea técnica y trabajador sin login, asignación ni movimiento de inventario", async ({ page }) => {
  await login(page);
  const quotationId = await createDraft(page);
  const movementsBefore = await get<{ total: number }>(page, "/inventory/movements?limit=1");
  const usersBefore = await get<{ total: number }>(page, "/users");
  const disclosure = await openQuickCreate(page, quotationId);

  const techniqueName = await createTechniqueInUi(page, "Técnica creada por admin");
  const workerName = await createWorkerInUi(page, "Trabajador externo admin", techniqueName);
  await expect(disclosure.getByText(/No se piden email, contraseña ni acceso/i)).toBeVisible();
  await expect(disclosure.getByLabel(/correo|contraseña/i)).toHaveCount(0);

  const techniques = await get<{ items: { name: string }[] }>(page, "/quoter-v2/techniques?limit=100");
  const workers = await get<{ items: { name: string; worker_type: string }[] }>(page, "/quoter-v2/workers?limit=100");
  expect(techniques.items.some((item) => item.name === techniqueName)).toBe(true);
  expect(workers.items.some((item) => item.name === workerName && item.worker_type === "EXTERNAL")).toBe(true);
  expect((await get<{ items: unknown[] }>(page, `/quotations-v2/${quotationId}/labor`)).items).toHaveLength(0);
  expect((await get<{ total: number }>(page, "/users")).total).toBe(usersBefore.total);
  expect((await get<{ total: number }>(page, "/inventory/movements?limit=1")).total).toBe(movementsBefore.total);
  await assertW3AccessibleControls(page, "alta rápida ADMIN");
  await assertW3Responsive(page, "alta rápida ADMIN");
});

test("W4: operador sin capability es bloqueado; operador autorizado crea maestros y valorización inicial", async ({ page }) => {
  expect(E2E_OPERATOR_EMAIL).toBeTruthy();
  expect(E2E_OPERATOR_PASSWORD).toBeTruthy();
  expect(E2E_QUICK_CREATE_OPERATOR_EMAIL).toBeTruthy();
  expect(E2E_QUICK_CREATE_OPERATOR_PASSWORD).toBeTruthy();
  await login(page);
  await createDraft(page);
  const techniques = await get<{ items: { id: number }[] }>(page, "/quoter-v2/techniques?limit=100");
  const rawProducts = await get<{ items: { product_category_id: number }[] }>(
    page,
    "/products?limit=200&active=true&product_type=RAW_MATERIAL",
  );
  expect(techniques.items.length).toBeGreaterThan(0);
  expect(rawProducts.items.length).toBeGreaterThan(0);
  const movementsBefore = await get<{ total: number }>(page, "/inventory/movements?limit=1");
  const usersBefore = await get<{ total: number }>(page, "/users");

  await logout(page);
  await login(page, E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD);
  await page.goto("/cotizador-v2/altas-rapidas");
  await expect(page.getByRole("heading", { name: "Altas rápidas no disponibles" })).toBeVisible();
  await expect(page.getByText("Alta rápida de trabajador o técnica", { exact: true })).toHaveCount(0);
  expect((await page.request.get(`${API}/quoter-v2/techniques?active_only=true`)).status()).toBe(403);
  expect((await page.request.get(`${API}/quoter-v2/workers?active_only=true`)).status()).toBe(403);
  const deniedWorker = await page.request.post(`${API}/quoter-v2/workers`, {
    data: {
      name: testName("W4 worker bloqueado sin capability"),
      worker_type: "EXTERNAL",
      daily_rate: "120",
      workday_hours: "8",
      active: true,
      technique_ids: [techniques.items[0]!.id],
    },
    headers: await csrf(page),
  });
  expect(deniedWorker.status()).toBe(403);
  const deniedTechnique = await page.request.post(`${API}/quoter-v2/techniques`, {
    data: {
      code: `W4-${Date.now()}`,
      name: testName("W4 técnica bloqueada sin capability"),
      default_capacity_per_workday: "20",
      unit: "piezas",
      active: true,
    },
    headers: await csrf(page),
  });
  expect(deniedTechnique.status()).toBe(403);

  await logout(page);
  await login(page, E2E_QUICK_CREATE_OPERATOR_EMAIL, E2E_QUICK_CREATE_OPERATOR_PASSWORD);
  expect((await page.request.get(`${API}/quoter-v2/workers?active_only=true`)).status()).toBe(403);
  const disclosure = await openQuickCreate(page);
  const techniqueName = await createTechniqueInUi(page, "Técnica creada por operador autorizado");
  const workerName = await createWorkerInUi(page, "Trabajador creado por operador autorizado", techniqueName);
  await expect(disclosure.getByText(/No se piden email, contraseña ni acceso/i)).toBeVisible();
  await assertW3AccessibleControls(page, "alta rápida OPERATOR con capability");
  await assertW3Responsive(page, "alta rápida OPERATOR con capability");

  const initialCost = "12.50";
  const product = await post<{ id: number; cost: string; product_type: string }>(page, "/products", {
    name: testName("W4 materia prima valorizada al alta"),
    product_type: "RAW_MATERIAL",
    product_category_id: rawProducts.items[0]!.product_category_id,
    base_uom_code: "g",
    cost: initialCost,
    purchasable: true,
    active: true,
  });
  expect(product.product_type).toBe("RAW_MATERIAL");
  expect(Number(product.cost)).toBe(Number(initialCost));

  const overwrite = await page.request.put(`${API}/products/${product.id}`, {
    data: {
      name: testName("W4 intento de sobrescribir costo"),
      product_type: "RAW_MATERIAL",
      product_category_id: rawProducts.items[0]!.product_category_id,
      base_uom_code: "g",
      cost: "99.00",
      purchasable: true,
      active: true,
    },
    headers: await csrf(page),
  });
  expect(overwrite.status(), "un operador no puede sobrescribir el costo maestro").toBe(403);
  const unchangedProduct = await get<{ cost: string }>(page, `/products/${product.id}`);
  expect(Number(unchangedProduct.cost)).toBe(Number(initialCost));

  const workerListAsOperator = await page.request.get(`${API}/quoter-v2/workers?limit=100`);
  expect(workerListAsOperator.status(), "el operador no puede consultar jornales de trabajadores").toBe(403);
  await logout(page);
  await login(page);
  const savedWorkers = await get<{ items: { name: string }[] }>(page, "/quoter-v2/workers?limit=100");
  expect(savedWorkers.items.some((item) => item.name === workerName)).toBe(true);
  expect((await get<{ total: number }>(page, "/users")).total).toBe(usersBefore.total);
  expect((await get<{ total: number }>(page, "/inventory/movements?limit=1")).total).toBe(movementsBefore.total);
  const productMovements = await get<{ items: { product_id: number }[] }>(
    page,
    `/inventory/movements?product_id=${product.id}&limit=20`,
  );
  expect(productMovements.items).toHaveLength(0);
});
