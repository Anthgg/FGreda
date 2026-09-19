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

/**
 * Fase 010J. El caso canonico del Excel FINAL, armado entero desde la UI.
 *
 * Externo, por menor, horno chico, baja + alta, quema COMPARTIDA, separacion
 * 3 cm, factor x3, 4 dias. Todo el trabajo lo hace el trabajador del taller
 * (interno: costo cero) y los 20 «Plato palta» llevan ilustracion. Ya no hay
 * divergencia con la hoja: la ilustracion se carga al producto que la lleva,
 * como en el Excel, y el documento coincide al centimo.
 */
const esperado = {
  materials: 285.36,
  labor: 0,
  illustration: 44,
  space: 560,
  admin: 200,
  gas: 526.976471,
  commercial_firing: 2258.470588,
  real_cost: 1616.336471,
  production_cost: 3347.830588,
  subtotal: 10055,
  tax: 1809.9,
  total: 11864.9,
};

function asNumber(value: unknown): number {
  return Number(String(value));
}

function close(actual: number, expected: number, tolerance = 0.01): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

test.describe("PRE-010I: Excel UI y RBAC local", () => {
  test("A2H-001: el caso canonico del Excel FINAL se arma desde la UI y no queda incompleto", async ({
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
    await asignarProceso(page, /Torno facil/i, /E2E-Trabajador taller/);
    await asignarProceso(page, /Torno dificil/i, /E2E-Trabajador taller/);
    await asignarProceso(page, /Vidriado a mano alzada/i, /E2E-Trabajador taller/);
    await seleccionar(page, page, "Ilustración", "Con ilustración");
    const ilustradas = page.getByLabel(/piezas a ilustrar · Plato palta/i);
    await ilustradas.fill("20");
    await ilustradas.blur();
    const dias = page.getByLabel(/d[ií]as efectivos/i);
    await dias.fill("4");
    await dias.blur();
    await esperarGuardado(page);

    await paso(page, 7, "Resumen").click();
    await expect(page.getByTestId("paso-resumen")).toBeVisible();
    await expect(page.getByTestId("resumen-pendientes")).toBeHidden();
    const resumen = page.getByTestId("resumen-precio");
    await expect(resumen).toContainText("S/ 11864.90", { timeout: 30_000 });

    // La quema en pantalla: compartida, la sugerencia del grande y nada aplicado.
    await paso(page, 5, "Quema").click();
    const quemaUi = page.getByTestId("panel-quema");
    await expect(quemaUi.getByRole("combobox", { name: "Modo de quema" })).toContainText(
      "Compartida",
    );
    await expect(quemaUi.getByTestId("sugerencia-horno")).toContainText(
      "reduce la quema estimada en S/ 1447.93",
    );
    await expect(
      quemaUi.getByRole("combobox", { name: "Horno de esta cotización" }),
    ).toContainText("Horno chico E2E");

    // Las reducciones del Excel, en la pantalla de precio.
    await paso(page, 6, "Margen y precio").click();
    const reducciones = page.getByTestId("panel-reducciones");
    await expect(reducciones).toContainText("5711.21", { timeout: 30_000 });
    await expect(reducciones).toContainText("6707.17");
    await expect(reducciones).toContainText("9923.00");
    await paso(page, 7, "Resumen").click();

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
    close(asNumber(quemaJson.billed_load), 5.018823529412, 1e-9);
    close(asNumber(precioJson.illustration_cost), esperado.illustration);
    close(asNumber(precioJson.space_cost), esperado.space);
    close(asNumber(precioJson.administration_cost), esperado.admin);
    close(asNumber(quemaJson.gas_total), esperado.gas, 0.000001);
    close(asNumber(quemaJson.commercial_total), esperado.commercial_firing, 0.000001);
    close(asNumber(precioJson.real_cost), esperado.real_cost, 0.000001);
    close(asNumber(precioJson.production_cost), esperado.production_cost, 0.000001);
    close(asNumber(precioJson.subtotal), esperado.subtotal);
    close(asNumber(precioJson.tax), esperado.tax);
    close(asNumber(precioJson.total), esperado.total);

    // INVENTORY_GATE: cotizar, emitir y pasar a produccion NO consumen
    // existencia. Se mide aqui, alrededor de las tres acciones, en vez de
    // comprobarlo a mano una vez.
    const movimientosAntes = await page.request.get("/api/v1/inventory/movements?limit=1");
    expect(movimientosAntes.ok()).toBeTruthy();
    const totalAntes = asNumber((await movimientosAntes.json()).total);

    await page.getByRole("button", { name: /^confirmar y emitir$/i }).click();
    const dialogoEmision = page.getByRole("dialog", { name: /confirmar y emitir/i });
    await expect(dialogoEmision).toBeVisible();
    await expect(dialogoEmision).toContainText("S/ 11864.90");
    await dialogoEmision.getByRole("button", { name: /^confirmar y emitir$/i }).click();
    await expect(page.getByTestId("v2-documento-emitido")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("v2-estado-efectivo")).toContainText(/emitida/i);

    await page.getByRole("button", { name: /^enviar a producci[oó]n$/i }).click();
    const dialogoProduccion = page.getByRole("dialog", { name: /enviar a producci[oó]n/i });
    await expect(dialogoProduccion).toBeVisible();
    await dialogoProduccion.getByRole("button", { name: /^enviar a producci[oó]n$/i }).click();
    await expect(page.getByTestId("v2-lista-produccion")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("v2-estado-efectivo")).toContainText(/lista para producci[oó]n/i);

    const movimientosDespues = await page.request.get("/api/v1/inventory/movements?limit=1");
    expect(movimientosDespues.ok()).toBeTruthy();
    expect(asNumber((await movimientosDespues.json()).total)).toBe(totalAntes);
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
    await page.getByTestId("emitir-cotizacion").getByRole("button", { name: /confirmar y emitir/i }).click();
    const dialogo = page.getByRole("dialog", { name: /confirmar y emitir/i });
    await expect(dialogo.getByTestId("emision-bloqueos")).toContainText(
      /pasta|material|trabajador|proceso/i,
      { timeout: 15_000 },
    );
    await expect(dialogo.getByRole("button", { name: /^confirmar y emitir$/i })).toBeDisabled();
  });

  test("FREE_PRODUCT_GATE: una linea libre sin procesos tampoco se puede emitir", async ({
    page,
  }) => {
    // El agujero que la auditoria dejaba abierto. Una pieza que no esta en el
    // catalogo no tiene ficha con tecnicas requeridas, asi que la comparacion
    // contra esa ficha la daba siempre por buena: se podia emitir con mano de
    // obra 0. Una pieza de encargo tambien la fabrica alguien.
    await login(page);
    await nuevoBorrador(page, "PRE010I-LineaLibre");
    await elegirCliente(page);

    await paso(page, 2, "Productos").click();
    await page.getByLabel(/nueva l[ií]nea/i).fill("Taza personalizada");
    await page.getByRole("button", { name: /a[ñn]adir l[ií]nea/i }).click();
    const card = tarjetaDeProducto(page, "Taza personalizada");
    await expect(card).toBeVisible({ timeout: 15_000 });
    const cantidad = card.getByLabel(/^cantidad/i);
    await cantidad.fill("20");
    await cantidad.blur();

    // Con pasta y gramaje: lo unico que falta son los procesos, para que el
    // bloqueo que se comprueba sea exactamente ese y no el del material.
    await configurarMaterial(page, "Taza personalizada", "Arcilla Terranova", false);
    await esperarGuardado(page);

    await paso(page, 7, "Resumen").click();
    await expect(page.getByTestId("resumen-pendientes")).toContainText(/mano de obra|proceso/i, {
      timeout: 30_000,
    });
    await page
      .getByTestId("emitir-cotizacion")
      .getByRole("button", { name: /confirmar y emitir/i })
      .click();
    const dialogo = page.getByRole("dialog", { name: /confirmar y emitir/i });
    await expect(dialogo.getByTestId("emision-bloqueos")).toContainText(/mano de obra|proceso/i, {
      timeout: 15_000,
    });
    await expect(dialogo.getByRole("button", { name: /^confirmar y emitir$/i })).toBeDisabled();
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

  // La frontera del inventario —el operador AJUSTA existencia pero no ABRE
  // almacenes— tiene su propia prueba en `inventario-operador.spec.ts`, que
  // hace el ajuste de verdad por la pantalla y comprueba el saldo y el
  // movimiento. Aqui habia una version que se llamaba «ajusta existencia» sin
  // ajustar nada, y cuyo 403 salia de un cuerpo que el esquema ya rechaza.
});
