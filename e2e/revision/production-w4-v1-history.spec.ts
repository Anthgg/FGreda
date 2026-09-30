import { readFile } from "node:fs/promises";

import { expect, type APIResponse, type Page } from "@playwright/test";
import { test } from "./w4-test";

import { login } from "../helpers/auth";
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
  const fixture = await get<{ id: number }>(page, "/e2e/fixtures/v1-history");
  const quotationId = fixture.id;
  const builderBefore = await get<Record<string, unknown>>(page, `/quotation-builder/${quotationId}`);
  expect(builderBefore).toMatchObject({ id: quotationId, status: "CONFIRMED", workflow: "COTIZADOR" });

  const pdfBefore = await page.request.get(`${API}/quotations/${quotationId}/pdf`);
  expect(pdfBefore.status()).toBe(200);
  expect(pdfBefore.headers()["content-type"]).toContain("application/pdf");
  const pdfBytesBefore = await pdfBefore.body();
  expect(pdfBytesBefore.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  await page.goto(`/cotizador/${quotationId}`);
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

    expect(await get<Record<string, unknown>>(page, `/quotation-builder/${quotationId}`)).toEqual(builderBefore);
    const pdfAfter = await page.request.get(`${API}/quotations/${quotationId}/pdf`);
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
