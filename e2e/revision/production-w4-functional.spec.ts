import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { testName } from "../helpers/fixtures";
import { assertW3AccessibleControls, assertW3Responsive } from "../helpers/w3-accessibility";

const API = "/api/v1";

interface Technique {
  id: number;
  code: string;
  name: string;
}

interface Settings {
  version: number;
  workday_hours: string;
  space_service_cost_per_day: string;
  administrative_cost_per_quote: string;
  retail_kiln_id: number | null;
  wholesale_kiln_id: number | null;
  wholesale_quantity_threshold: number | null;
  retail_default_worker_id: number | null;
  wholesale_default_worker_id: number | null;
}

interface Pricing {
  active_production_minutes: string;
  active_production_hours: string;
  commercial_external_labor_cost: string;
  real_external_labor_cost: string;
  labor_cost_gap: string;
  space_cost: string;
  space_cost_per_hour_snapshot: string;
  space_cost_per_hour_override: string | null;
  effective_space_cost_per_hour: string;
  administration_cost: string;
  production_cost: string;
  real_cost: string;
  subtotal: string;
  total: string;
  passive_time_hours: string;
  passive_space_suggestion: string;
  wholesale_threshold: number | null;
  total_units: number;
  wholesale_suggested: boolean;
  wholesale_suggestion_declined: boolean;
  lines: {
    external_commercial_cost: string;
    external_real_cost: string;
    space_cost: string;
    line_active_minutes: string | null;
  }[];
}

async function csrf(page: Page): Promise<Record<string, string>> {
  const cookie = (await page.context().cookies()).find((item) => item.name === "greda_csrf");
  expect(cookie, "la sesión autenticada debe incluir CSRF").toBeDefined();
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

function scaled18(value: string): bigint {
  const [whole = "0", fractional = ""] = value.trim().split(".");
  return BigInt(whole) * 10n ** 18n + BigInt((fractional + "0".repeat(18)).slice(0, 18) || "0");
}

function sum(values: string[]): bigint {
  return values.reduce((total, value) => total + scaled(value), 0n);
}

function sum18(values: string[]): bigint {
  return values.reduce((total, value) => total + scaled18(value), 0n);
}

async function createQuote(page: Page, label: string): Promise<{ id: number }> {
  const customers = await get<{ items: { id: number }[] }>(page, "/partners?limit=5");
  expect(customers.items.length).toBeGreaterThan(0);
  return post(page, "/quotations-v2", {
    name: testName(label),
    customer_id: customers.items[0]!.id,
  });
}

async function createLine(
  page: Page,
  quotationId: number,
  label: string,
  quantity: number,
  minutes: number,
): Promise<{ id: number }> {
  return post(page, `/quotations-v2/${quotationId}/products`, {
    product_name: testName(label),
    quantity,
    length_cm: "10",
    width_cm: "10",
    height_cm: "10",
    production_time_per_unit_minutes: String(minutes),
    mold_count: 1,
  });
}

async function createProcess(
  page: Page,
  quotationId: number,
  productId: number,
  techniqueId: number,
): Promise<{ id: number }> {
  return post(page, `/quotations-v2/${quotationId}/processes`, {
    v2_quotation_product_id: productId,
    technique_id: techniqueId,
  });
}

async function createWorker(
  page: Page,
  label: string,
  workerType: "INTERNAL" | "EXTERNAL",
  dailyRate: string,
  techniques: number[],
): Promise<{ id: number; version: number }> {
  return post(page, "/quoter-v2/workers", {
    name: testName(label),
    worker_type: workerType,
    daily_rate: dailyRate,
    workday_hours: "8",
    active: true,
    technique_ids: techniques,
  });
}

async function settings(page: Page): Promise<Settings> {
  return (await get<{ settings: Settings }>(page, "/quoter-v2/settings")).settings;
}

async function changeSettings(page: Page, changes: Partial<Settings>): Promise<Settings> {
  const current = await settings(page);
  return (await put<{ settings: Settings }>(page, "/quoter-v2/settings", {
    expected_version: current.version,
    ...changes,
  })).settings;
}

async function techniques(page: Page): Promise<Technique[]> {
  return (await get<{ items: Technique[] }>(page, "/quoter-v2/techniques?limit=100")).items;
}

test("W4: dos externos únicos cuestan 300 comercial/480 real; 10 h pasivas solo sugieren", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const pageErrors: string[] = [];
  await login(page);
  // Ignore the expected unauthenticated /auth/me and refresh probes performed
  // before login. Start the application-error gate once the local session is
  // established.
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const skills = (await techniques(page)).slice(0, 3);
  expect(skills, "la semilla local debe tener tres técnicas activas").toHaveLength(3);
  const workerA = await createWorker(page, "W4 externo único A", "EXTERNAL", "120", skills.map((item) => item.id));
  const workerB = await createWorker(page, "W4 externo único B", "EXTERNAL", "120", skills.map((item) => item.id));
  const quotation = await createQuote(page, "W4 dos externos y tiempo pasivo");

  const lines = await Promise.all([
    createLine(page, quotation.id, "W4 externo proceso A", 1, 600),
    createLine(page, quotation.id, "W4 externo proceso B", 1, 600),
    createLine(page, quotation.id, "W4 externo proceso C", 1, 600),
  ]);
  const processes = await Promise.all(lines.map((line, index) =>
    createProcess(page, quotation.id, line.id, skills[index]!.id),
  ));
  await post(page, `/quotations-v2/${quotation.id}/processes/${processes[0]!.id}/assign`, {
    worker_id: workerA.id,
  });
  await post(page, `/quotations-v2/${quotation.id}/processes/${processes[1]!.id}/assign`, {
    worker_id: workerA.id,
  });
  await post(page, `/quotations-v2/${quotation.id}/processes/${processes[2]!.id}/assign`, {
    worker_id: workerB.id,
  });

  const before = await get<Pricing>(page, `/quotations-v2/${quotation.id}/pricing`);
  expect(scaled(before.active_production_minutes)).toBe(scaled("600"));
  expect(scaled(before.active_production_hours)).toBe(scaled("10"));
  expect(scaled(before.commercial_external_labor_cost)).toBe(scaled("300"));
  expect(scaled(before.real_external_labor_cost)).toBe(scaled("480"));
  expect(scaled(before.labor_cost_gap)).toBe(scaled("180"));
  expect(sum(before.lines.map((line) => line.external_commercial_cost))).toBe(scaled("300"));
  expect(sum(before.lines.map((line) => line.external_real_cost))).toBe(scaled("480"));
  expect(
    sum18(before.lines.map((line) => line.space_cost)),
    `line space=${JSON.stringify(before.lines.map((line) => line.space_cost))}; order space=${before.space_cost}`,
  ).toBe(scaled18(before.space_cost));
  expect(before.lines.every((line) => scaled(line.line_active_minutes ?? "0") === scaled("600"))).toBe(true);

  await page.goto(`/cotizador-v2/${quotation.id}/precio`);
  await expect(page.getByTestId("v2next-tiempo-activo")).toContainText("10 h");
  await expect(page.getByText(/No está incluida automáticamente en el total/i)).toBeVisible();
  const espacioPorHora = page.getByLabel("Costo de espacio por hora");
  const overrideEsperado = (Number(before.space_cost_per_hour_snapshot) + 7).toFixed(2);
  await espacioPorHora.fill(overrideEsperado);
  await espacioPorHora.press("Tab");
  await expect.poll(async () => {
    const pricing = await get<Pricing>(page, `/quotations-v2/${quotation.id}/pricing`);
    return scaled(pricing.space_cost_per_hour_override ?? "0");
  }).toBe(scaled(overrideEsperado));
  const afterOverride = await get<Pricing>(page, `/quotations-v2/${quotation.id}/pricing`);
  expect(scaled(afterOverride.effective_space_cost_per_hour)).toBe(scaled(overrideEsperado));
  expect(scaled(afterOverride.space_cost)).not.toBe(scaled(before.space_cost));
  expect(sum18(afterOverride.lines.map((line) => line.space_cost))).toBe(
    scaled18(afterOverride.space_cost),
  );
  const passive = page.getByLabel("Tiempo pasivo");
  await passive.fill("2");
  await passive.press("Tab");
  await expect.poll(async () => scaled((await get<Pricing>(page, `/quotations-v2/${quotation.id}/pricing`)).passive_time_hours))
    .toBe(scaled("2"));
  const after = await get<Pricing>(page, `/quotations-v2/${quotation.id}/pricing`);
  expect(scaled(after.passive_space_suggestion)).toBeGreaterThan(0n);
  expect(scaled(after.active_production_hours)).toBe(scaled("10"));
  expect(scaled(after.space_cost)).toBe(scaled(afterOverride.space_cost));
  expect(scaled(after.production_cost)).toBe(scaled(afterOverride.production_cost));
  expect(scaled(after.real_cost)).toBe(scaled(afterOverride.real_cost));
  expect(scaled(after.subtotal)).toBe(scaled(afterOverride.subtotal));
  expect(scaled(after.total)).toBe(scaled(afterOverride.total));
  await assertW3AccessibleControls(page, "precio con dos externos y horas pasivas");
  await assertW3Responsive(page, "precio con dos externos y horas pasivas");
  expect(consoleErrors, `respuestas HTTP fallidas: ${failedResponses.join("\n")}`).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("W4: sugerencia configurable por mayor, conserva manuales y congela snapshots ante cambios actuales", async ({ page }) => {
  await login(page);
  const original = await settings(page);
  const skills = await techniques(page);
  expect(skills.length).toBeGreaterThanOrEqual(2);
  const compatibleSkills = skills.slice(0, 2).map((item) => item.id);
  const external = await createWorker(page, "W4 mayorista compatible", "EXTERNAL", "120", compatibleSkills);
  const internal = await createWorker(page, "W4 trabajador manual", "INTERNAL", "200", [compatibleSkills[0]!]);

  try {
    const configured = await changeSettings(page, {
      wholesale_quantity_threshold: 2,
      wholesale_default_worker_id: external.id,
    });
    expect(configured.wholesale_quantity_threshold).toBe(2);

    const declined = await createQuote(page, "W4 rechazar por mayor");
    await createLine(page, declined.id, "W4 minorista declinado", 3, 60);
    const declinedPricing = await get<Pricing>(page, `/quotations-v2/${declined.id}/pricing`);
    expect(declinedPricing.total_units).toBe(3);
    expect(declinedPricing.wholesale_suggested).toBe(true);
    await page.goto(`/cotizador-v2/${declined.id}/precio`);
    const declinedBanner = page.getByTestId("v2next-wholesale-banner");
    await expect(declinedBanner).toContainText("3 unidades · umbral 2");
    const declineResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/v1/quotations-v2/${declined.id}/decline-wholesale-suggestion`) &&
      response.request().method() === "POST",
    );
    await declinedBanner.getByRole("button", { name: "Mantener como minorista" }).click();
    expect((await declineResponse).ok(), "rechazar la sugerencia mayorista debe guardar el estado").toBe(true);
    expect((await get<{ production_type: string }>(page, `/quotations-v2/${declined.id}`)).production_type)
      .toBe("RETAIL");
    expect((await get<Pricing>(page, `/quotations-v2/${declined.id}/pricing`)).wholesale_suggestion_declined)
      .toBe(true);
    await expect(page.getByTestId("v2next-wholesale-banner")).toHaveCount(0);

    const accepted = await createQuote(page, "W4 aceptar por mayor con trabajador manual");
    const manualLine = await createLine(page, accepted.id, "W4 línea manual mayorista", 2, 60);
    const defaultLine = await createLine(page, accepted.id, "W4 línea con default mayorista", 1, 60);
    const manualProcess = await createProcess(page, accepted.id, manualLine.id, compatibleSkills[0]!);
    await createProcess(page, accepted.id, defaultLine.id, compatibleSkills[1]!);
    await post(page, `/quotations-v2/${accepted.id}/processes/${manualProcess.id}/assign`, {
      worker_id: internal.id,
    });
    const acceptedQuoteSnapshot = await get<{
      production_type: string;
      administrative_cost: string;
      wholesale_threshold: number | null;
      space_cost_per_hour: string;
      settings_version: number;
    }>(page, `/quotations-v2/${accepted.id}`);
    expect(acceptedQuoteSnapshot.production_type).toBe("RETAIL");
    expect(acceptedQuoteSnapshot.wholesale_threshold).toBe(2);

    await page.goto(`/cotizador-v2/${accepted.id}/precio`);
    const acceptedBanner = page.getByTestId("v2next-wholesale-banner");
    await expect(acceptedBanner).toContainText("Este pedido supera el umbral configurado");
    const appliedResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/v1/quotations-v2/${accepted.id}/apply-wholesale-defaults`) &&
      response.request().method() === "POST",
    );
    await acceptedBanner.getByRole("button", { name: "Aplicar Por mayor" }).click();
    const applied = await appliedResponse;
    expect(applied.ok(), `aplicar defaults mayoristas: ${applied.status()}`).toBe(true);
    const appliedBody = (await applied.json()) as { warnings: string[] };
    expect(appliedBody.warnings.join(" ")).toMatch(/MANUAL/i);

    const acceptedAfter = await get<{
      production_type: string;
      administrative_cost: string;
      wholesale_threshold: number | null;
      space_cost_per_hour: string;
      settings_version: number;
    }>(page, `/quotations-v2/${accepted.id}`);
    expect(acceptedAfter.production_type).toBe("WHOLESALE");
    expect(acceptedAfter.administrative_cost).toBe(configured.administrative_cost_per_quote);
    expect(acceptedAfter.wholesale_threshold).toBe(2);
    expect(acceptedAfter.space_cost_per_hour).toBe(acceptedQuoteSnapshot.space_cost_per_hour);
    expect(acceptedAfter.settings_version).toBe(acceptedQuoteSnapshot.settings_version);

    const laborBeforeChange = await get<{
      items: { worker_id: number; worker_type: string; assignment_origin: string; daily_rate: string }[];
    }>(page, `/quotations-v2/${accepted.id}/labor`);
    expect(laborBeforeChange.items).toHaveLength(2);
    expect(laborBeforeChange.items).toContainEqual(expect.objectContaining({
      worker_id: internal.id,
      worker_type: "INTERNAL",
      assignment_origin: "MANUAL",
    }));
    expect(laborBeforeChange.items).toContainEqual(expect.objectContaining({
      worker_id: external.id,
      worker_type: "EXTERNAL",
      assignment_origin: "DEFAULT",
    }));

    const pricingBeforeChange = await get<Pricing>(page, `/quotations-v2/${accepted.id}/pricing`);
    const firingBeforeChange = await get<unknown>(page, `/quotations-v2/${accepted.id}/firing`);
    const currentSettings = await settings(page);
    await put(page, `/quoter-v2/workers/${external.id}`, {
      expected_version: external.version,
      daily_rate: "999",
    });
    await changeSettings(page, {
      space_service_cost_per_day: String(Number(currentSettings.space_service_cost_per_day) + 50),
      administrative_cost_per_quote: String(Number(currentSettings.administrative_cost_per_quote) + 50),
      wholesale_quantity_threshold: 1,
      wholesale_kiln_id: currentSettings.retail_kiln_id,
      wholesale_default_worker_id: null,
    });

    const acceptedStillFrozen = await get<{
      production_type: string;
      administrative_cost: string;
      wholesale_threshold: number | null;
      space_cost_per_hour: string;
      settings_version: number;
    }>(page, `/quotations-v2/${accepted.id}`);
    const pricingStillFrozen = await get<Pricing>(page, `/quotations-v2/${accepted.id}/pricing`);
    const firingStillFrozen = await get<unknown>(page, `/quotations-v2/${accepted.id}/firing`);
    const laborStillFrozen = await get<{
      items: { worker_id: number; assignment_origin: string; daily_rate: string }[];
    }>(page, `/quotations-v2/${accepted.id}/labor`);
    expect(acceptedStillFrozen).toMatchObject(acceptedAfter);
    expect(scaled(pricingStillFrozen.space_cost)).toBe(scaled(pricingBeforeChange.space_cost));
    expect(scaled(pricingStillFrozen.administration_cost)).toBe(scaled(pricingBeforeChange.administration_cost));
    expect(scaled(pricingStillFrozen.commercial_external_labor_cost))
      .toBe(scaled(pricingBeforeChange.commercial_external_labor_cost));
    expect(scaled(pricingStillFrozen.real_external_labor_cost)).toBe(scaled(pricingBeforeChange.real_external_labor_cost));
    expect(scaled(pricingStillFrozen.total)).toBe(scaled(pricingBeforeChange.total));
    expect(firingStillFrozen).toEqual(firingBeforeChange);
    expect(scaled(laborStillFrozen.items.find((item) => item.worker_id === external.id)!.daily_rate))
      .toBe(scaled("120"));

    const incompatible = await createWorker(page, "W4 mayorista sin técnica B", "EXTERNAL", "120", [compatibleSkills[0]!]);
    await changeSettings(page, {
      wholesale_quantity_threshold: 2,
      wholesale_default_worker_id: incompatible.id,
    });
    const warningQuote = await createQuote(page, "W4 aviso de técnica incompatible");
    const warningLine = await createLine(page, warningQuote.id, "W4 técnica incompatible", 3, 60);
    await createProcess(page, warningQuote.id, warningLine.id, compatibleSkills[1]!);
    await page.goto(`/cotizador-v2/${warningQuote.id}/precio`);
    const warningBanner = page.getByTestId("v2next-wholesale-banner");
    const warningResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/v1/quotations-v2/${warningQuote.id}/apply-wholesale-defaults`) &&
      response.request().method() === "POST",
    );
    await warningBanner.getByRole("button", { name: "Aplicar Por mayor" }).click();
    const warningHttp = await warningResponse;
    expect(warningHttp.ok()).toBe(true);
    const warningBody = (await warningHttp.json()) as { warnings: string[] };
    expect(warningBody.warnings.join(" ")).toMatch(/TECHNIQUE|TÉCNICA/i);
    expect((await get<{ items: unknown[] }>(page, `/quotations-v2/${warningQuote.id}/labor`)).items)
      .toHaveLength(0);
    await assertW3AccessibleControls(page, "sugerencias de mayorista y avisos de personal");
    await assertW3Responsive(page, "sugerencias de mayorista y avisos de personal");
  } finally {
    const current = await settings(page);
    await changeSettings(page, {
      wholesale_quantity_threshold: original.wholesale_quantity_threshold,
      wholesale_default_worker_id: original.wholesale_default_worker_id,
      wholesale_kiln_id: original.wholesale_kiln_id,
      retail_default_worker_id: original.retail_default_worker_id,
      administrative_cost_per_quote: original.administrative_cost_per_quote,
      space_service_cost_per_day: original.space_service_cost_per_day,
    });
    expect((await settings(page)).version).toBeGreaterThan(current.version);
  }
});
