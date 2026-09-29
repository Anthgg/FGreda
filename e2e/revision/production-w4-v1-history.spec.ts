import { readFile } from "node:fs/promises";

import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { testName } from "../helpers/fixtures";
import { assertW3AccessibleControls, assertW3Responsive } from "../helpers/w3-accessibility";

const API = "/api/v1";

interface V2Settings {
  version: number;
  space_service_cost_per_day: string;
  administrative_cost_per_quote: string;
  retail_kiln_id: number | null;
  wholesale_kiln_id: number | null;
  wholesale_quantity_threshold: number | null;
  retail_default_worker_id: number | null;
  wholesale_default_worker_id: number | null;
}

async function csrf(page: Page): Promise<Record<string, string>> {
  const cookie = (await page.context().cookies()).find((item) => item.name === "greda_csrf");
  expect(cookie, "la sesión de revisión debe emitir el token CSRF").toBeDefined();
  return { "X-CSRF-Token": cookie?.value ?? "" };
}

async function ok<T>(response: APIResponse, label: string): Promise<T> {
  expect(response.ok(), `${label}: HTTP ${response.status()} ${await response.text()}`).toBe(true);
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

async function readV2Settings(page: Page): Promise<V2Settings> {
  return (await get<{ settings: V2Settings }>(page, "/quoter-v2/settings")).settings;
}

async function updateV2Settings(page: Page, changes: Partial<V2Settings>): Promise<V2Settings> {
  const current = await readV2Settings(page);
  return (await put<{ settings: V2Settings }>(page, "/quoter-v2/settings", {
    expected_version: current.version,
    ...changes,
  })).settings;
}

test("W4: cotización histórica V1 permanece de solo lectura y su PDF no cambia con la configuración actual", async ({
  page,
}) => {
  await login(page);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const partners = await get<{ items: { id: number; name: string }[] }>(page, "/partners?limit=100");
  const customer = partners.items.find((item) => item.name === "Cliente E2E");
  expect(customer, "la revisión local siembra un cliente aislado").toBeDefined();

  const products = await get<{
    items: { id: number; name: string; product_type: string; product_category_id: number }[];
  }>(page, "/products?limit=200&active=true");
  const finished = products.items.find((item) => item.name === "Tasa Buho");
  const bodyMaster = products.items.find((item) => item.name === "Arcilla Terranova");
  expect(finished?.product_type).toBe("FINISHED_PRODUCT");
  expect(bodyMaster?.product_type).toBe("RAW_MATERIAL");
  const body = await post<{ id: number }>(page, "/products", {
    name: testName("W4 materia prima valorizada para histórico V1"),
    product_type: "RAW_MATERIAL",
    product_category_id: bodyMaster!.product_category_id,
    base_uom_code: "g",
    cost: "12.50",
    purchasable: true,
    active: true,
  });

  const kilns = await get<{ items: { id: number; name: string }[] }>(page, "/kilns?limit=100");
  const kiln = kilns.items.find((item) => item.name === "Horno chico E2E");
  expect(kiln, "el horno local sembrado existe").toBeDefined();

  // The local V1 fixture needs a legacy LOW firing tariff. Keep it inside the
  // disposable E2E database; the current quotation settings are not a source
  // for the historical document snapshot.
  const kilnRates = await get<{ firing_type: string }[]>(page, `/kilns/${kiln!.id}/rates`);
  if (!kilnRates.some((item) => item.firing_type === "LOW")) {
    await post(page, `/kilns/${kiln!.id}/rates`, { firing_type: "LOW", rate: "2.00" });
  }
  if (!kilnRates.some((item) => item.firing_type === "HIGH")) {
    await post(page, `/kilns/${kiln!.id}/rates`, { firing_type: "HIGH", rate: "2.00" });
  }
  await put(page, `/kilns/${kiln!.id}/occupancy-factors`, [
    { min_percentage: 1, max_percentage: 100, factor: "1" },
  ]);

  const draft = await post<{
    id: number;
    status: string;
    complete: boolean;
    updated_at: string;
    workflow: string;
    warnings: unknown[];
    items: { commercial_sale_unit_price: string | null; complete: boolean; kiln_id: number | null; warnings: unknown[] }[];
  }>(page, "/quotation-builder", {
    name: testName("histórico V1 congelado"),
    customer_id: customer!.id,
    kiln_id: kiln!.id,
    items: [
      {
        product_id: finished!.id,
        quantity: 2,
        dimensions: { width: "15", length: "1", height: "3" },
        body_material: { product_id: body.id, quantity_per_piece: "300" },
        other_costs: [],
        markup_percent: "100",
        commercial_sale_unit_price: "8.50",
        sort_order: 0,
      },
    ],
  });
  expect(draft.workflow).toBe("COTIZADOR");
  expect(draft.status).toBe("DRAFT");
  expect(draft.complete, JSON.stringify({ warnings: draft.warnings, items: draft.items })).toBe(true);

  const confirmed = await post<{
    id: number;
    status: string;
    updated_at: string;
    quotation_gross_total: string;
  }>(page, `/quotation-builder/${draft.id}/confirm`, { expected_updated_at: draft.updated_at });
  expect(confirmed.status).toBe("CONFIRMED");

  const builderBefore = await get<Record<string, unknown>>(page, `/quotation-builder/${draft.id}`);
  const pdfBefore = await page.request.get(`${API}/quotations/${draft.id}/pdf`);
  expect(pdfBefore.status()).toBe(200);
  expect(pdfBefore.headers()["content-type"]).toContain("application/pdf");
  const pdfBytesBefore = await pdfBefore.body();
  expect(pdfBytesBefore.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  await page.goto(`/cotizador/${draft.id}`);
  await expect(page.getByText("Confirmada", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Nombre / referencia")).toBeDisabled();
  await expect(page.getByRole("button", { name: /Guardar borrador|Crear borrador|Confirmar cotización/i }))
    .toHaveCount(0);
  await expect(page.getByLabel(/tiempo de producción|tiempo activo|moldes?/i)).toHaveCount(0);
  await page.getByRole("navigation", { name: "Etapas del cotizador" })
    .getByRole("button", { name: /PDF/i }).click();
  const downloadButton = page.getByRole("button", { name: /Descargar PDF/i }).last();
  await expect(downloadButton).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadEvent;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect((await readFile(downloadPath!)).equals(pdfBytesBefore)).toBe(true);
  await assertW3AccessibleControls(page, "cotización histórica V1 confirmada");
  await assertW3Responsive(page, "cotización histórica V1 confirmada");

  const settingsBefore = await readV2Settings(page);
  const workers = await get<{
    items: { id: number; version: number; worker_type: string; daily_rate: string }[];
  }>(page, "/quoter-v2/workers?limit=100");
  const external = workers.items.find((worker) => worker.worker_type === "EXTERNAL");
  expect(external).toBeDefined();

  try {
    await page.request.put(`${API}/quoter-v2/workers/${external!.id}`, {
      data: { expected_version: external!.version, daily_rate: "999" },
      headers: await csrf(page),
    }).then((response) => ok(response, "cambio de tarifa actual del trabajador"));
    await updateV2Settings(page, {
      retail_kiln_id: settingsBefore.wholesale_kiln_id,
      space_service_cost_per_day: String(Number(settingsBefore.space_service_cost_per_day) + 50),
      administrative_cost_per_quote: String(Number(settingsBefore.administrative_cost_per_quote) + 50),
      wholesale_quantity_threshold: 2,
    });

    expect(await get<Record<string, unknown>>(page, `/quotation-builder/${draft.id}`)).toEqual(builderBefore);
    const pdfAfter = await page.request.get(`${API}/quotations/${draft.id}/pdf`);
    expect(pdfAfter.status()).toBe(200);
    expect((await pdfAfter.body()).equals(pdfBytesBefore)).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    const currentSettings = await readV2Settings(page);
    await updateV2Settings(page, {
      retail_kiln_id: settingsBefore.retail_kiln_id,
      space_service_cost_per_day: settingsBefore.space_service_cost_per_day,
      administrative_cost_per_quote: settingsBefore.administrative_cost_per_quote,
      wholesale_quantity_threshold: settingsBefore.wholesale_quantity_threshold,
      retail_default_worker_id: settingsBefore.retail_default_worker_id,
      wholesale_default_worker_id: settingsBefore.wholesale_default_worker_id,
    });
    const currentWorkers = await get<{
      items: { id: number; version: number; daily_rate: string }[];
    }>(page, "/quoter-v2/workers?limit=100");
    const currentExternal = currentWorkers.items.find((worker) => worker.id === external!.id);
    expect(currentExternal).toBeDefined();
    const restored = await page.request.put(`${API}/quoter-v2/workers/${external!.id}`, {
      data: { expected_version: currentExternal!.version, daily_rate: external!.daily_rate },
      headers: await csrf(page),
    });
    await ok(restored, "restauración de tarifa de trabajador");
    expect(currentSettings.version).toBeGreaterThan(settingsBefore.version);
  }
});
