import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./w4-test";

import { login } from "../helpers/auth";
import { E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD } from "../helpers/fixtures";
import {
  anadirPieza,
  anadirPiezaDelCatalogo,
  cabecera,
  configurarTiempoYMoldes,
  elegir,
  esperarGuardado,
  irAPaso,
  nuevoBorrador,
} from "./support/cotizadorV2Ui";

/**
 * PRE-010I, reescrita en el corte 010O.13 para la interfaz rediseñada: el caso
 * canónico del Excel armado desde la UI, las barreras de emisión y el RBAC local.
 */

/** La tarjeta de una pieza en «Arcilla y esmalte», por el nombre de su título. */
function tarjetaDeMaterial(page: Page, nombre: string): Locator {
  return page.locator("article").filter({ has: page.getByRole("heading", { name: nombre, exact: true }) });
}

async function cantidadDe(page: Page, nombre: string, cantidad: string): Promise<void> {
  // En Piezas la tarjeta más reciente es la última; se ajusta su cantidad.
  const campo = page.getByRole("textbox", { name: "Cantidad" }).last();
  await campo.fill(cantidad);
  await campo.blur();
  await esperarGuardado(page);
  await expect(page.getByText(nombre, { exact: true }).last()).toBeVisible();
}

async function configurarMaterial(page: Page, nombre: string, arcilla: string, esmalte: boolean) {
  await irAPaso(page, "Arcilla y esmalte");
  const tarjeta = tarjetaDeMaterial(page, nombre);
  await elegir(page, tarjeta.getByRole("combobox", { name: "Arcilla", exact: true }), new RegExp(`^${arcilla}`));
  await esperarGuardado(page);
  const interruptor = tarjeta.getByRole("switch", { name: /Lleva esmalte/ });
  if ((await interruptor.isChecked()) !== esmalte) {
    // El input es `sr-only`: se pulsa su etiqueta, como lo haría una persona.
    await tarjeta.getByText("Lleva esmalte", { exact: true }).click();
    await esperarGuardado(page);
  }
  await expect(interruptor).toBeChecked({ checked: esmalte });
}

async function asignarProceso(page: Page, tecnica: string | RegExp, trabajador: RegExp) {
  const fila = page.locator('[data-testid^="labor-process-"]').filter({ hasText: tecnica }).first();
  await expect(fila).toBeVisible({ timeout: 15_000 });
  await elegir(page, fila.getByRole("combobox", { name: "Lo hace" }), trabajador);
  await esperarGuardado(page);
}

/**
 * Caso A2H reconstruido con el contrato vigente de 010P y armado desde la UI.
 *
 * El total S/ 11,864.90 se conserva como LEGACY_REFERENCE_PRE_010P; este
 * documento V2 usa tiempos explícitos y valida el resultado que devuelve el
 * backend. No se exige reproducir con las reglas 010P un total histórico.
 */
function asNumber(value: unknown): number {
  return Number(String(value));
}

function close(actual: number, expected: number, tolerance = 0.01): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function numberShown(text: string): number {
  const match = text.match(/[\d,]+(?:\.\d+)?/);
  if (!match) throw new Error(`No currency amount found in: ${text}`);
  return Number(match[0].replaceAll(",", ""));
}

function amountPattern(value: number): RegExp {
  const [whole = "0", cents = "00"] = value.toFixed(2).split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",?");
  return new RegExp(`${groupedWhole}\\.${cents}`);
}

test.describe("010P: cotización con referencia Excel y RBAC local", () => {
  test("A2H-001: la referencia se arma con tiempos V2 y usa el total actual del backend", async ({ page }) => {
    await login(page);
    const { id: quotationId } = await nuevoBorrador(page, "PRE010I-Excel");

    await anadirPiezaDelCatalogo(page, "Plato palta");
    await cantidadDe(page, "Plato palta", "20");
    await anadirPiezaDelCatalogo(page, "Tasa Buho");
    await cantidadDe(page, "Tasa Buho", "50");
    await anadirPiezaDelCatalogo(page, "PLATOS HONDOS CHICOS");
    await cantidadDe(page, "PLATOS HONDOS CHICOS", "12");

    // Tiempos operativos de prueba por cotización; el catálogo histórico no se altera.
    await configurarTiempoYMoldes(page, { horas: "0", minutos: "2", moldes: "1" }, 0);
    await configurarTiempoYMoldes(page, { horas: "0", minutos: "1", moldes: "1" }, 1);
    await configurarTiempoYMoldes(page, { horas: "0", minutos: "1", moldes: "1" }, 2);

    await configurarMaterial(page, "Plato palta", "Arcilla Terranova", true);
    await configurarMaterial(page, "Tasa Buho", "Arcilla Terranova", false);
    await configurarMaterial(page, "PLATOS HONDOS CHICOS", "Arcilla reciclada del taller", true);

    await irAPaso(page, "Trabajo");
    await asignarProceso(page, "A mano", /E2E-Trabajador taller/);
    await asignarProceso(page, /Vidriado por inmersion/i, /E2E-Trabajador taller/);
    await asignarProceso(page, /Torno facil/i, /E2E-Trabajador taller/);
    await asignarProceso(page, /Torno dificil/i, /E2E-Trabajador taller/);
    await asignarProceso(page, /Vidriado a mano alzada/i, /E2E-Trabajador taller/);
    const ilustracion = page.getByRole("switch", { name: "Lleva ilustración" });
    if (!(await ilustracion.isChecked())) await ilustracion.click();
    await esperarGuardado(page);
    const ilustradas = page.getByRole("textbox", { name: /^Piezas a ilustrar · Plato palta/ });
    await ilustradas.fill("20");
    await ilustradas.blur();
    await esperarGuardado(page);
    await irAPaso(page, "Revisar y emitir");
    await expect(page.getByTestId("v2next-pendientes")).toContainText("Todo listo para emitir", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("v2next-total")).not.toHaveText("—", { timeout: 30_000 });

    // La quema en pantalla: compartida, la sugerencia del grande y nada aplicado.
    await irAPaso(page, "Horno");
    await expect(
      page.getByRole("radiogroup", { name: "¿Comparte el horno?" }).getByRole("radio", { name: "Compartido" }),
    ).toBeChecked();
    await expect(page.getByTestId("v2next-sugerencia-horno")).toContainText(/reduce la quema/i);
    await expect(
      page.getByRole("radiogroup", { name: "Horno de esta cotización" }).getByRole("radio", { checked: true }),
    ).toContainText("Horno chico E2E");

    // La pantalla de precio abre con el cálculo actual del backend.
    await irAPaso(page, "Precio");
    await expect(page.getByTestId("v2next-paso-precio")).toBeVisible({ timeout: 30_000 });
    await irAPaso(page, "Revisar y emitir");

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

    expect(Number(precioJson.pricing_rules_version)).toBe(2);
    expect(asNumber(precioJson.active_production_hours)).toBeGreaterThan(0);
    expect(asNumber(productosJson.materials_cost)).toBeGreaterThan(0);
    expect(asNumber(manoJson.labor_cost)).toBe(0);
    expect(asNumber(precioJson.commercial_external_labor_cost)).toBe(0);
    expect(asNumber(precioJson.real_external_labor_cost)).toBe(0);
    expect(asNumber(quemaJson.billed_load)).toBeGreaterThan(0);
    expect(asNumber(quemaJson.gas_total)).toBeGreaterThan(0);
    expect(asNumber(quemaJson.commercial_total)).toBeGreaterThan(0);
    expect(asNumber(precioJson.production_cost)).toBeGreaterThan(0);
    expect(asNumber(precioJson.subtotal)).toBeGreaterThan(0);
    close(asNumber(precioJson.total), asNumber(precioJson.subtotal) + asNumber(precioJson.tax));
    close(numberShown(await page.getByTestId("v2next-total").innerText()), asNumber(precioJson.total));

    // INVENTORY_GATE: cotizar, emitir y pasar a producción NO consumen existencia.
    const movimientosAntes = await page.request.get("/api/v1/inventory/movements?limit=1");
    expect(movimientosAntes.ok()).toBeTruthy();
    const totalAntes = asNumber((await movimientosAntes.json()).total);

    await page.getByRole("button", { name: "Emitir cotización" }).click();
    const dialogoEmision = page.getByRole("dialog", { name: "¿Emitir la cotización?" });
    await expect(dialogoEmision).toContainText(amountPattern(asNumber(precioJson.total)));
    await dialogoEmision.getByRole("button", { name: "Confirmar y emitir" }).click();
    await expect(page.getByTestId("v2-documento-emitido")).toBeVisible({ timeout: 30_000 });
    await expect(cabecera(page).getByTestId("v2-estado-efectivo")).toContainText(/emitida/i);

    await cabecera(page).getByRole("button", { name: /^enviar a producci[oó]n$/i }).click();
    const dialogoProduccion = page.getByRole("dialog", { name: /enviar a producci[oó]n/i });
    await dialogoProduccion.getByRole("button", { name: /^enviar a producci[oó]n$/i }).click();
    await expect(page.getByTestId("v2-lista-produccion")).toBeVisible({ timeout: 30_000 });
    await expect(cabecera(page).getByTestId("v2-estado-efectivo")).toContainText(/lista para producci[oó]n/i);

    const movimientosDespues = await page.request.get("/api/v1/inventory/movements?limit=1");
    expect(movimientosDespues.ok()).toBeTruthy();
    expect(asNumber((await movimientosDespues.json()).total)).toBe(totalAntes);
  });

  test("A2H-001 negativo: una pieza con material pendiente no se puede emitir", async ({ page }) => {
    await login(page);
    await nuevoBorrador(page, "PRE010I-Incompleta");
    await anadirPiezaDelCatalogo(page, "Plato palta");
    await cantidadDe(page, "Plato palta", "20");

    await irAPaso(page, "Revisar y emitir");
    await expect(page.getByTestId("v2next-pendientes")).toContainText(/pasta|arcilla|material|trabaj|proceso/i, {
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Emitir cotización" })).toBeDisabled();
  });

  test("FREE_PRODUCT_GATE: una línea libre sin procesos tampoco se puede emitir", async ({ page }) => {
    // Una pieza fuera del catálogo no tiene ficha con técnicas requeridas: sin
    // esta barrera se podía emitir con mano de obra 0. También la fabrica alguien.
    await login(page);
    await nuevoBorrador(page, "PRE010I-LineaLibre");
    await anadirPieza(page, "Taza personalizada", "20", ["10", "10", "10"]);

    // Con arcilla: lo único que falta son los procesos, para que el bloqueo que
    // se comprueba sea exactamente ese y no el del material.
    await configurarMaterial(page, "Taza personalizada", "Arcilla Terranova", false);

    await irAPaso(page, "Revisar y emitir");
    await expect(page.getByTestId("v2next-pendientes")).toContainText(/mano de obra|nadie la fabrica|proceso/i, {
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Emitir cotización" })).toBeDisabled();
  });

  test("A2H-002: operador local ve UI restringida y la API responde 403", async ({ page }) => {
    await login(page, E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD);
    await page.goto("/configuracion");
    await page.getByRole("tab", { name: "Cotizador V2" }).click();
    await expect(page.getByText(/su rol no permite modificar esta configuracion/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /guardar configuraci[oó]n v2/i })).toHaveCount(0);
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
  // almacenes— tiene su propia prueba en `inventario-operador.spec.ts`.
});
