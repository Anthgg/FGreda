import { expect, test, type Locator, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import {
  E2E_OPERATOR_EMAIL,
  E2E_OPERATOR_PASSWORD,
  testName,
} from "../helpers/fixtures";

function paso(page: Page, numero: number, titulo: string) {
  return page.getByRole("button", { name: new RegExp(`${numero}\\.\\s*${titulo}`, "i") });
}

async function seleccionar(
  page: Page,
  scope: Page | Locator,
  label: string | RegExp,
  option: string | RegExp,
): Promise<void> {
  await scope.getByRole("combobox", { name: label }).click();
  const search = page.getByPlaceholder(/buscar opci[oó]n/i);
  if (await search.isVisible().catch(() => false)) {
    await search.fill(typeof option === "string" ? option : "");
  }
  await page.getByRole("option", { name: option }).click();
}

async function nuevoBorrador(page: Page, etiqueta: string): Promise<number> {
  await page.goto("/cotizador-v2");
  await page.getByLabel(/referencia/i).fill(testName(etiqueta));
  await page.getByRole("button", { name: /crear cotizaci[oó]n v2/i }).click();
  await expect(page.getByTestId("pasos-cotizacion")).toBeVisible({ timeout: 15_000 });
  const match = page.url().match(/\/cotizador-v2\/(\d+)/);
  expect(match, `URL con id de cotizacion: ${page.url()}`).not.toBeNull();
  return Number(match?.[1]);
}

async function elegirCliente(page: Page): Promise<void> {
  await paso(page, 1, "Cliente").click();
  await page.getByRole("combobox", { name: "Cliente", exact: true }).click();
  await page.getByRole("option").nth(1).click();
}

function tarjetaDeProducto(page: Page, nombre: string): Locator {
  return page
    .getByRole("heading", { name: nombre, exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
}

async function agregarPiezaCatalogo(page: Page, nombre: string, cantidad: string): Promise<void> {
  await paso(page, 2, "Productos").click();
  await seleccionar(page, page, "Pieza del catálogo", nombre);
  await page.getByRole("button", { name: /a[ñn]adir l[ií]nea/i }).click();
  const card = tarjetaDeProducto(page, nombre);
  await expect(card).toBeVisible({ timeout: 15_000 });
  const campoCantidad = card.getByLabel(/^cantidad/i);
  await campoCantidad.fill(cantidad);
  await campoCantidad.blur();
}

async function configurarMaterial(
  page: Page,
  nombre: string,
  pasta: string,
  esmalte: boolean,
): Promise<void> {
  await paso(page, 3, "Materiales").click();
  const card = tarjetaDeProducto(page, nombre);
  await seleccionar(page, card, "Pasta", pasta);
  await seleccionar(page, card, "Esmalte", esmalte ? "Con esmalte" : "Sin esmalte");
}

async function asignarProceso(
  page: Page,
  tecnica: string | RegExp,
  trabajador: string | RegExp,
): Promise<void> {
  const fila = page.locator("li").filter({ hasText: tecnica }).first();
  await expect(fila).toBeVisible({ timeout: 15_000 });
  await seleccionar(page, fila, "Trabajador", trabajador);
}

async function esperarGuardado(page: Page): Promise<void> {
  await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
    timeout: 30_000,
  });
}

const esperado = {
  materials: 285.36,
  labor: 569.066667,
  illustration: 44,
  space: 560,
  admin: 200,
  gas: 210,
  commercial_firing: 900,
  real_cost: 1868.426667,
  production_cost: 2558.426667,
  subtotal: 7693,
  tax: 1384.74,
  total: 9077.74,
};

function asNumber(value: unknown): number {
  return Number(String(value));
}

function close(actual: number, expected: number, tolerance = 0.01): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

test.describe("PRE-010I: Excel UI y RBAC local", () => {
  test("A2H-001: el caso canonico del Excel se arma desde la UI y no queda incompleto", async ({
    page,
  }) => {
    await login(page);
    const quotationId = await nuevoBorrador(page, "PRE010I-Excel");
    await elegirCliente(page);

    await agregarPiezaCatalogo(page, "Plato palta", "20");
    await agregarPiezaCatalogo(page, "Tasa Buho", "50");
    await agregarPiezaCatalogo(page, "PLATOS HONDOS CHICOS", "12");
    await esperarGuardado(page);

    await configurarMaterial(page, "Plato palta", "Arcilla Terranova", true);
    await configurarMaterial(page, "Tasa Buho", "Arcilla Terranova", false);
    await configurarMaterial(page, "PLATOS HONDOS CHICOS", "Arcilla reciclada del taller", true);
    await esperarGuardado(page);

    await paso(page, 4, "Mano de obra").click();
    await expect(page.getByTestId("panel-mano-de-obra")).toBeVisible();
    await asignarProceso(page, "A mano", /E2E-Trabajador taller/);
    await asignarProceso(page, /Vidriado por inmersion/i, /E2E-Trabajador taller/);
    await asignarProceso(page, /Torno facil/i, /E2E-Tornero/);
    await asignarProceso(page, /Torno dificil/i, /E2E-Tornero/);
    await asignarProceso(page, /Vidriado a mano alzada/i, /E2E-Trabajador taller/);
    await seleccionar(page, page, "Ilustración", "Con ilustración");
    const ilustradas = page.getByLabel(/piezas a ilustrar/i);
    await ilustradas.fill("4");
    await ilustradas.blur();
    const dias = page.getByLabel(/d[ií]as efectivos/i);
    await dias.fill("4");
    await dias.blur();
    await esperarGuardado(page);

    await paso(page, 7, "Resumen").click();
    await expect(page.getByTestId("paso-resumen")).toBeVisible();
    await expect(page.getByTestId("resumen-pendientes")).toBeHidden();
    const resumen = page.getByTestId("resumen-precio");
    await expect(resumen).toContainText("S/ 9077.74", { timeout: 30_000 });

    const [productos, manoDeObra, quema, precio] = await Promise.all([
      page.request.get(`/api/v1/quotations-v2/${quotationId}/products`),
      page.request.get(`/api/v1/quotations-v2/${quotationId}/labor`),
      page.request.get(`/api/v1/quotations-v2/${quotationId}/firing`),
      page.request.get(`/api/v1/quotations-v2/${quotationId}/pricing`),
    ]);
    expect(productos.ok()).toBeTruthy();
    expect(manoDeObra.ok()).toBeTruthy();
    expect(quema.ok()).toBeTruthy();
    expect(precio.ok()).toBeTruthy();

    const productosJson = await productos.json();
    const manoJson = await manoDeObra.json();
    const quemaJson = await quema.json();
    const precioJson = await precio.json();

    close(asNumber(productosJson.materials_cost), esperado.materials);
    close(asNumber(manoJson.labor_cost), esperado.labor, 0.0001);
    close(asNumber(precioJson.illustration_cost), esperado.illustration);
    close(asNumber(precioJson.space_cost), esperado.space);
    close(asNumber(precioJson.administration_cost), esperado.admin);
    close(asNumber(quemaJson.gas_total), esperado.gas);
    close(asNumber(quemaJson.commercial_total), esperado.commercial_firing);
    close(asNumber(precioJson.real_cost), esperado.real_cost, 0.0001);
    close(asNumber(precioJson.production_cost), esperado.production_cost, 0.0001);
    close(asNumber(precioJson.subtotal), esperado.subtotal);
    close(asNumber(precioJson.tax), esperado.tax);
    close(asNumber(precioJson.total), esperado.total);

    await page.getByRole("button", { name: /^confirmar y emitir$/i }).click();
    const dialogoEmision = page.getByRole("dialog", { name: /confirmar y emitir/i });
    await expect(dialogoEmision).toBeVisible();
    await expect(dialogoEmision).toContainText("S/ 9077.74");
    await dialogoEmision.getByRole("button", { name: /^confirmar y emitir$/i }).click();
    await expect(page.getByTestId("v2-documento-emitido")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("v2-estado-efectivo")).toContainText(/emitida/i);

    await page.getByRole("button", { name: /^enviar a producci[oó]n$/i }).click();
    const dialogoProduccion = page.getByRole("dialog", { name: /enviar a producci[oó]n/i });
    await expect(dialogoProduccion).toBeVisible();
    await dialogoProduccion.getByRole("button", { name: /^enviar a producci[oó]n$/i }).click();
    await expect(page.getByTestId("v2-lista-produccion")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("v2-estado-efectivo")).toContainText(/lista para producci[oó]n/i);
  });

  test("A2H-001 negativo: una pieza con material pendiente no se puede emitir", async ({
    page,
  }) => {
    await login(page);
    await nuevoBorrador(page, "PRE010I-Incompleta");
    await elegirCliente(page);
    await agregarPiezaCatalogo(page, "Plato palta", "20");
    await paso(page, 7, "Resumen").click();
    await expect(page.getByTestId("resumen-pendientes")).toContainText(
      /pasta|material|trabajador|proceso/i,
      { timeout: 30_000 },
    );
    await expect(page.getByRole("button", { name: /emitir|confirmar/i })).toBeDisabled();
  });

  test("A2H-002: operador local ve UI restringida y la API responde 403", async ({ page }) => {
    await login(page, E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD);
    await page.goto("/configuracion");
    await page.getByRole("tab", { name: "Cotizador V2" }).click();
    await expect(page.getByText(/su rol no permite modificar esta configuracion/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /guardar configuraci[oó]n v2/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: /^editar$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^configurar$/i })).toHaveCount(0);

    const csrf = await page.request.get("/api/v1/auth/csrf");
    expect(csrf.ok()).toBeTruthy();
    const csrfToken = (await csrf.json()).csrf_token as string;
    const response = await page.request.put("/api/v1/settings/commercial", {
      headers: { "X-CSRF-Token": csrfToken },
      data: { version: 1, tax_percent: "18" },
    });
    expect(response.status()).toBe(403);
  });
});
