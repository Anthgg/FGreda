import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { expect, type APIResponse, type Page } from "@playwright/test";
import { test } from "./w4-test";

import { login } from "../helpers/auth";
import { assertW3AccessibleControls, assertW3Responsive } from "../helpers/w3-accessibility";

const API = "/api/v1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const INITIAL_AUTH_PROBE_PATHS = new Set(["/api/v1/auth/me", "/api/v1/auth/refresh"]);
const SCRAP_REASON = "Pieza dañada en prueba real de Solo Quema W3";

interface PreparedSoloQuema {
  order_id: number;
  order_code: string;
  quotation_id: number;
  line_id: number;
  handoff_id: number;
  location_id: number;
  location_name: string;
  finished_product_id: number;
  database: string;
  revision: string;
}

interface ProductPage {
  items: { id: number; name: string }[];
  total: number;
}

interface StockPage {
  items: { product_id: number; quantity: string }[];
  total: number;
}

interface MovementPage {
  items: {
    id: number;
    product_id: number;
    production_order_id: number | null;
    movement_type: string;
    quantity: string;
  }[];
  total: number;
}

interface ResultLineSource {
  line_ref: string;
  source_kind: string;
  product_name: string;
  started_quantity: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set by the isolated Solo Quema runner`);
  return value;
}

function prepareOwnCase(): PreparedSoloQuema {
  const backendRoot = requireEnv("SOLO_QUEMA_E2E_BACKEND_ROOT");
  const python = requireEnv("SOLO_QUEMA_E2E_PYTHON");
  const helper = join(backendRoot, "tests", "e2e", "preparar_solo_quema.py");
  expect(existsSync(helper), `missing test-only backend helper at ${helper}`).toBe(true);
  const output = execFileSync(python, [helper, "prepare"], {
    cwd: backendRoot,
    encoding: "utf8",
    timeout: 60_000,
    windowsHide: true,
    env: process.env,
  });
  return JSON.parse(output.trim()) as PreparedSoloQuema;
}

function frontendBaseUrl(): string {
  const baseUrl = requireEnv("E2E_BASE_URL");
  expect(LOCAL_HOSTS.has(new URL(baseUrl).hostname), "revision tests must target loopback").toBe(true);
  return baseUrl;
}

function apiUrl(path: string): string {
  return new URL(`${API}${path}`, frontendBaseUrl()).toString();
}

async function ok<T>(response: APIResponse, label: string): Promise<T> {
  expect(response.ok(), `${label}: HTTP ${response.status()} ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

async function get<T>(page: Page, path: string): Promise<T> {
  return ok<T>(await page.request.get(apiUrl(path)), path);
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

function snapshotFinishedStock(
  products: ProductPage,
  balances: StockPage,
): [number, string][] {
  expect(products.total, "all finished products must fit in this isolated snapshot").toBe(
    products.items.length,
  );
  expect(balances.total, "all workshop balances must fit in this isolated snapshot").toBe(
    balances.items.length,
  );
  const stock = new Map(balances.items.map((item) => [item.product_id, item.quantity]));
  return products.items
    .map((product) => [product.id, stock.get(product.id) ?? "0"] as [number, string])
    .sort(([left], [right]) => left - right);
}

test("W3 Solo Quema: el resultado real 10 = 8 buenas + 2 merma no crea inventario terminado", async ({ page }) => {
  const prepared = prepareOwnCase();
  expect(prepared.revision).toBe("0045");
  expect(prepared.database).toMatch(/^bgreda_test_010p_sq_[0-9a-f]{12}$/);

  const externalRequests: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const initialUnauthenticatedProbes = new WeakSet<object>();
  let loginSubmitted = false;
  let expectedAuthProbeResponses = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !LOCAL_HOSTS.has(url.hostname)) {
      externalRequests.push(request.url());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === `${API}/auth/login` && request.method() === "POST") {
      loginSubmitted = true;
      return;
    }
    if (!loginSubmitted && INITIAL_AUTH_PROBE_PATHS.has(path)) {
      initialUnauthenticatedProbes.add(request);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      let expectedAuthProbeError = false;
      try {
        expectedAuthProbeError =
          INITIAL_AUTH_PROBE_PATHS.has(new URL(location.url).pathname) &&
          message.text().includes("401 (Unauthorized)");
      } catch {
        // Keep errors without a parseable source URL in the failure evidence.
      }
      if (!expectedAuthProbeError) {
        consoleErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`);
      }
    }
  });
  page.on("response", (response) => {
    const expectedInitialProbe =
      response.status() === 401 && initialUnauthenticatedProbes.has(response.request());
    if (expectedInitialProbe) {
      expectedAuthProbeResponses += 1;
    } else if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const finishedProductsBefore = await get<ProductPage>(
    page,
    "/products?product_type=FINISHED_PRODUCT&limit=200",
  );
  const stockBefore = await get<StockPage>(
    page,
    `/inventory?location_id=${prepared.location_id}&limit=200`,
  );
  const movementsBefore = await get<MovementPage>(
    page,
    `/inventory/movements?location_id=${prepared.location_id}&limit=200`,
  );
  const finishedStockBefore = snapshotFinishedStock(finishedProductsBefore, stockBefore);
  expect(
    scaled(
      finishedStockBefore.find(([productId]) => productId === prepared.finished_product_id)?.[1] ?? "0",
    ),
    "the local workshop must have a finished-product control balance before completion",
  ).toBe(scaled("5"));
  expect(movementsBefore.total).toBe(movementsBefore.items.length);

  await page.goto("/produccion");
  await expect(page.getByRole("heading", { name: "Producción." })).toBeVisible();
  const orderRow = page.getByRole("row").filter({ hasText: prepared.order_code });
  await expect(orderRow, "the API-created Solo Quema order must appear in Producción").toHaveCount(1);
  await expect(orderRow).toContainText(/Solo Quema/i);

  const orderPath = `/production-orders/${prepared.order_id}`;
  const uiGetPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "GET" && url.pathname === `${API}${orderPath}`;
  });
  await orderRow.getByRole("link", { name: "Ver detalle" }).click();
  const uiGet = await uiGetPromise;
  expect(uiGet.status()).toBe(200);
  const detail = (await uiGet.json()) as {
    id: number;
    code: string;
    origin_type: string;
    result_lines: ResultLineSource[];
  };
  expect(detail.id).toBe(prepared.order_id);
  expect(detail.code).toBe(prepared.order_code);
  expect(detail.origin_type).toBe("SOLO_QUEMA");
  expect(detail.result_lines).toHaveLength(1);
  const source = detail.result_lines[0]!;
  expect(source.source_kind).toBe("V2F");
  expect(source.line_ref).toBe(`V2F:${prepared.line_id}`);
  expect(source.line_ref).toMatch(/^V2F:\d+$/);
  expect(scaled(source.started_quantity)).toBe(scaled("10"));
  await expect(
    page.getByRole("heading", { level: 1, name: prepared.order_code, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Orden de producción\s*·\s*Solo Quema/i),
  ).toBeVisible();

  const startResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith(`${API}${orderPath}/start`) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Arrancar producción" }).click();
  const startResponse = await startResponsePromise;
  expect(startResponse.status()).toBe(200);
  await expect(page.getByText("En proceso", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Marcar completada" }).click();
  const dialog = page.getByRole("dialog", { name: "Registrar resultados de producción" });
  const line = dialog.getByRole("group", { name: new RegExp(source.product_name, "i") });
  await expect(line).toContainText("Cantidad iniciada: 10");
  await line.getByLabel("Buenas").fill("8");
  await line.getByLabel("Merma").fill("2");
  await line.getByLabel("Motivo de merma").fill(SCRAP_REASON);
  await assertW3AccessibleControls(page, "diálogo de resultados Solo Quema");
  await assertW3Responsive(page, "diálogo de resultados Solo Quema");
  await page.setViewportSize({ width: 1440, height: 900 });

  const completePath = `${API}${orderPath}/complete`;
  const completeRequestPromise = page.waitForRequest(
    (request) => request.url().endsWith(completePath) && request.method() === "POST",
  );
  const completeResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith(completePath) && response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Completar producción" }).click();
  const [completeRequest, completeResponse] = await Promise.all([
    completeRequestPromise,
    completeResponsePromise,
  ]);
  expect(completeResponse.status()).toBe(200);

  const submitted = completeRequest.postDataJSON() as {
    results: { line_ref: string; good_quantity: string; scrap_quantity: string; scrap_reason: string }[];
  };
  expect(submitted.results).toHaveLength(1);
  expect(submitted.results[0]).toEqual({
    line_ref: source.line_ref,
    good_quantity: "8",
    scrap_quantity: "2",
    scrap_reason: SCRAP_REASON,
  });

  const completion = (await completeResponse.json()) as {
    order: { id: number; status: string };
    results: {
      line_ref: string;
      started_quantity: string;
      good_quantity: string;
      scrap_quantity: string;
      scrap_reason: string | null;
    }[];
  };
  expect(completion.order).toMatchObject({ id: prepared.order_id, status: "COMPLETED" });
  expect(completion.results).toHaveLength(1);
  expect(completion.results[0]).toMatchObject({
    line_ref: source.line_ref,
    scrap_reason: SCRAP_REASON,
  });
  expect(scaled(completion.results[0]!.started_quantity)).toBe(scaled("10"));
  expect(scaled(completion.results[0]!.good_quantity)).toBe(scaled("8"));
  expect(scaled(completion.results[0]!.scrap_quantity)).toBe(scaled("2"));

  await expect(page.getByRole("button", { name: "Marcar completada" })).toHaveCount(0);
  await expect(
    page
      .getByRole("heading", { level: 1, name: prepared.order_code, exact: true })
      .locator("xpath=.."),
  ).toContainText("Finalizado");
  await expect(page.locator("body")).not.toContainText(
    /8\s+(?:unidades|piezas)\s+(?:agregadas|añadidas|ingresadas)\s+a\s+inventario/i,
  );

  const completedDetail = await get<{ status: string; origin_type: string }>(page, orderPath);
  expect(completedDetail).toMatchObject({ status: "COMPLETED", origin_type: "SOLO_QUEMA" });
  const finishedProductsAfter = await get<ProductPage>(
    page,
    "/products?product_type=FINISHED_PRODUCT&limit=200",
  );
  const stockAfter = await get<StockPage>(
    page,
    `/inventory?location_id=${prepared.location_id}&limit=200`,
  );
  const movementsAfter = await get<MovementPage>(
    page,
    `/inventory/movements?location_id=${prepared.location_id}&limit=200`,
  );
  const finishedStockAfter = snapshotFinishedStock(finishedProductsAfter, stockAfter);
  expect(finishedProductsAfter.items.map(({ id }) => id).sort((a, b) => a - b)).toEqual(
    finishedProductsBefore.items.map(({ id }) => id).sort((a, b) => a - b),
  );
  expect(finishedStockAfter).toEqual(finishedStockBefore);
  expect(
    scaled(
      finishedStockAfter.find(([productId]) => productId === prepared.finished_product_id)?.[1] ?? "0",
    ),
  ).toBe(scaled("5"));
  expect(movementsAfter.total).toBe(movementsAfter.items.length);
  const productionInputs = movementsAfter.items.filter(
    (movement) =>
      movement.production_order_id === prepared.order_id && movement.movement_type === "PRODUCTION_IN",
  );
  expect(productionInputs).toHaveLength(0);
  expect(movementsAfter.items.map(({ id }) => id).sort((a, b) => a - b)).toEqual(
    movementsBefore.items.map(({ id }) => id).sort((a, b) => a - b),
  );

  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors, `HTTP failures: ${JSON.stringify(failedResponses)}`).toEqual([]);
  expect(failedResponses).toEqual([]);

  await test.info().attach("solo-quema-real-e2e-evidence.json", {
    body: JSON.stringify(
      {
        setup: "TEST_HELPER",
        database: prepared.database,
        alembic: prepared.revision,
        started: source.started_quantity,
        good: completion.results[0]!.good_quantity,
        scrap: completion.results[0]!.scrap_quantity,
        lineRefFromGet: source.line_ref,
        lineRefSent: submitted.results[0]!.line_ref,
        status: completion.order.status,
        productionInCount: productionInputs.length,
        finishedStockBefore,
        finishedStockAfter,
        finishedProductIdsBefore: finishedProductsBefore.items.map(({ id }) => id).sort((a, b) => a - b),
        finishedProductIdsAfter: finishedProductsAfter.items.map(({ id }) => id).sort((a, b) => a - b),
        externalRequests: externalRequests.length,
        pageErrors: pageErrors.length,
        consoleErrors: consoleErrors.length,
        expectedUnauthenticatedAuthProbeResponses: expectedAuthProbeResponses,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
