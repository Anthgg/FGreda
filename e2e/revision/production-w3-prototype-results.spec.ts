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

async function post<T>(page: Page, path: string, data?: unknown): Promise<T> {
  return ok<T>(await page.request.post(`${API}${path}`, { data, headers: await csrf(page) }), path);
}

function scaled(value: string): bigint {
  const [mantissa = "0", exponentText = "0"] = value.trim().toLowerCase().split("e");
  const exponent = Number(exponentText);
  const sign = mantissa.startsWith("-") ? -1n : 1n;
  const unsigned = mantissa.replace(/^[+-]/, "");
  const [whole = "0", fractional = ""] = unsigned.split(".");
  const digits = BigInt(`${whole}${fractional}` || "0");
  const shift = 12 + exponent - fractional.length;
  return sign * (shift >= 0 ? digits * 10n ** BigInt(shift) : digits / 10n ** BigInt(-shift));
}

test("W3: prototipo 2 = 1 buena + 1 merma, movimiento +1 y prototipos previos intactos", async ({ page }) => {
  const externalRequests: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  await login(page);

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !new Set(["localhost", "127.0.0.1"]).has(url.hostname)) {
      externalRequests.push(request.url());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      consoleErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  const existing = await get<{ items: { id: number; status: string; approval: string }[] }>(
    page,
    "/prototypes?limit=100",
  );
  const priorHistory = existing.items.map(({ id, status, approval }) => ({ id, status, approval }));
  const products = await get<{ items: { id: number; name: string }[] }>(
    page,
    "/products?limit=200&active=true&product_type=FINISHED_PRODUCT",
  );
  expect(products.items.length, "el backend local necesita al menos un producto terminado").toBeGreaterThan(0);
  const product = products.items[0]!;
  const rawMaterials = await get<{
    items: { id: number; name: string; product_category_id: number; base_uom_code: string | null }[];
  }>(
    page,
    "/products?limit=200&active=true&product_type=RAW_MATERIAL",
  );
  expect(rawMaterials.items.length, "el backend local necesita categoría de materia prima").toBeGreaterThan(0);
  const rawMaterial = await post<{ id: number }>(page, "/products", {
    name: testName("W3 prototype body material"),
    product_type: "RAW_MATERIAL",
    product_category_id: rawMaterials.items[0]!.product_category_id,
    base_uom_code: rawMaterials.items[0]!.base_uom_code ?? "g",
    cost: "1.000000",
    active: true,
  });

  const location = await post<{ id: number; name: string }>(page, "/inventory/locations", {
    name: testName("W3-prototype-results"),
  });
  await post(page, "/inventory/adjustments", {
    product_id: rawMaterial.id,
    location_id: location.id,
    quantity: "5",
    reason: "Existencia inicial aislada para E2E W3 prototipo",
  });
  const customers = await get<{ items: { id: number }[] }>(page, "/partners?limit=5");
  expect(customers.items.length).toBeGreaterThan(0);
  const quotation = await post<{ id: number }>(page, "/prototype-quotations", {
    customer_id: customers.items[0]!.id,
    product_id: product.id,
    description: testName("W3 prototype 2 to 1 plus 1"),
    quantity: 2,
    width_cm: "20",
    height_cm: "5",
    length_cm: "20",
    materials: [{ product_id: rawMaterial.id, quantity_per_prototype: "1", is_body_material: true }],
  });
  await post(page, `/prototype-quotations/${quotation.id}/confirm`, {});
  const paid = await post<{
    payment_status: string;
    prototype_id: number | null;
    production_order_id: number | null;
    production_order_code: string | null;
  }>(page, `/prototype-quotations/${quotation.id}/mark-paid`, {
    stock_location_id: location.id,
  });
  expect(paid.payment_status).toBe("PAID");
  expect(paid.prototype_id).not.toBeNull();
  expect(paid.production_order_id).not.toBeNull();
  const prototype = await get<{ status: string; approval: string }>(page, `/prototypes/${paid.prototype_id}`);
  expect(prototype.status).toBe("CREATED");
  const order = { id: paid.production_order_id!, code: paid.production_order_code! };
  const detail = await get<{
    result_lines: { line_ref: string; product_name: string; started_quantity: string }[];
  }>(page, `/production-orders/${order.id}`);
  expect(detail.result_lines).toHaveLength(1);
  expect(scaled(detail.result_lines[0]!.started_quantity)).toBe(scaled("2"));

  const before = await get<{
    items: { product_id: number; quantity: string }[];
  }>(page, `/inventory?product_id=${product.id}&location_id=${location.id}&limit=5`);
  const initialStock = before.items.find((item) => item.product_id === product.id)?.quantity ?? "0";
  const movementPageBefore = await get<{
    items: { id: number; production_order_id: number | null; movement_type: string; quantity: string }[];
  }>(page, "/inventory/movements?limit=100");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/produccion/${order.id}`);
  await expect(page.getByRole("heading", { level: 1, name: order.code, exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Arrancar producción" }).click();
  await expect(page.getByText("En proceso", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Marcar completada" }).click();

  const resultDialog = page.getByRole("dialog", { name: "Registrar resultados de producción" });
  const line = resultDialog.getByRole("group", { name: new RegExp(product.name, "i") });
  await expect(line).toContainText("Cantidad iniciada: 2");
  await line.getByLabel("Buenas").fill("1");
  await line.getByLabel("Merma").fill("1");
  await line.getByLabel("Motivo de merma").fill("Prueba de W3");
  await assertW3AccessibleControls(page, "diálogo de resultados de prototipo");
  await assertW3Responsive(page, "diálogo de resultados de prototipo");
  await page.setViewportSize({ width: 1440, height: 900 });
  const completionResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/v1/production-orders/${order.id}/complete`) &&
    response.request().method() === "POST",
  );
  await resultDialog.getByRole("button", { name: "Completar producción" }).click();
  const completion = await completionResponse;
  expect(completion.ok(), `complete: ${completion.status()}`).toBe(true);
  const completed = (await completion.json()) as {
    order: { status: string };
    results: { line_ref: string; started_quantity: string; good_quantity: string; scrap_quantity: string; scrap_reason: string | null }[];
  };
  expect(completed.order.status).toBe("COMPLETED");
  expect(completed.results).toHaveLength(1);
  expect(completed.results[0]).toMatchObject({
    line_ref: detail.result_lines[0]!.line_ref,
    scrap_reason: "Prueba de W3",
  });
  expect(scaled(completed.results[0]!.started_quantity)).toBe(scaled("2"));
  expect(scaled(completed.results[0]!.good_quantity)).toBe(scaled("1"));
  expect(scaled(completed.results[0]!.scrap_quantity)).toBe(scaled("1"));

  const finalStock = await get<{ items: { product_id: number; quantity: string }[] }>(
    page,
    `/inventory?product_id=${product.id}&location_id=${location.id}&limit=5`,
  );
  const finalQuantity = finalStock.items.find((item) => item.product_id === product.id)?.quantity ?? "0";
  expect(scaled(finalQuantity) - scaled(initialStock)).toBe(scaled("1"));
  const movementPageAfter = await get<{
    items: { id: number; production_order_id: number | null; product_id: number; movement_type: string; quantity: string }[];
  }>(page, "/inventory/movements?limit=100");
  const newMovementIds = new Set(movementPageBefore.items.map((item) => item.id));
  const productionInputs = movementPageAfter.items.filter(
    (movement) => movement.production_order_id === order.id && movement.movement_type === "PRODUCTION_IN",
  );
  expect(productionInputs).toHaveLength(1);
  expect(scaled(productionInputs[0]!.quantity)).toBe(scaled("1"));
  expect(newMovementIds.has(productionInputs[0]!.id)).toBe(false);
  await expect(page.getByRole("button", { name: "Marcar completada" })).toHaveCount(0);

  const afterHistory = await get<{ items: { id: number; status: string; approval: string }[] }>(
    page,
    "/prototypes?limit=100",
  );
  const afterById = new Map(afterHistory.items.map(({ id, status, approval }) => [id, { status, approval }]));
  expect(priorHistory.every((item) => afterById.get(item.id)?.status === item.status && afterById.get(item.id)?.approval === item.approval)).toBe(true);

  await page.goto("/inventario");
  await expect(page.getByRole("heading", { level: 1, name: "Inventario." })).toBeVisible();
  const search = page.getByLabel("Buscar existencia");
  await search.fill(product.name);
  const productRow = page.getByRole("row")
    .filter({ hasText: product.name })
    .filter({ hasText: location.name });
  await expect(productRow).toHaveCount(1, { timeout: 15_000 });
  await productRow.getByRole("button", { name: "Entrega…" }).click();
  const delivery = page.getByRole("region", { name: "Registrar entrega" });
  await expect(delivery.getByText("Entrega de producto terminado")).toBeVisible({ timeout: 15_000 });
  await assertW3AccessibleControls(page, "entrega de producto terminado");
  await assertW3Responsive(page, "entrega de producto terminado");
  await page.setViewportSize({ width: 1440, height: 900 });
  await delivery.getByLabel("Cantidad a entregar").fill("1");
  await delivery.getByLabel("Motivo").fill("E2E W3 entrega separada de producción");
  await delivery.getByRole("button", { name: "Registrar entrega" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Entrega registrada: 1" })).toBeVisible({ timeout: 15_000 });
  const remainingFinished = await get<{ items: { product_id: number; quantity: string }[] }>(
    page,
    `/inventory?product_id=${product.id}&location_id=${location.id}&limit=5`,
  );
  expect(scaled(remainingFinished.items.find((item) => item.product_id === product.id)?.quantity ?? "0"))
    .toBe(scaled("0"));
  const deliveryMovements = await get<{
    items: { production_order_id: number | null; movement_type: string; quantity: string }[];
  }>(page, `/inventory/movements?product_id=${product.id}&limit=20`);
  expect(deliveryMovements.items.some((movement) =>
    movement.production_order_id === order.id && movement.movement_type === "PRODUCTION_IN" &&
    scaled(movement.quantity) === scaled("1")
  )).toBe(true);
  expect(deliveryMovements.items.some((movement) =>
    movement.movement_type === "DELIVERY_OUT" && scaled(movement.quantity) === scaled("-1")
  )).toBe(true);

  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors, `console errors; HTTP failures=${JSON.stringify(failedResponses)}`).toEqual([]);
});
