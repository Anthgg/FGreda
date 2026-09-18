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
 * El caso canonico del Excel, con la divergencia aprobada de 010D.
 *
 * Los costos y el precio objetivo son EXACTAMENTE los del Excel: materiales,
 * mano de obra, ilustracion, espacio, administracion, quema, costo real y
 * costo de produccion coinciden cifra a cifra.
 *
 * El subtotal del documento no: el Excel carga los S/44 de ilustracion enteros
 * sobre «Plato palta» y el sistema los reparte entre las tres lineas, porque
 * «la ilustracion es una sola por cotizacion y no una tecnica mas» —regla de
 * 010D, que manda sobre la hoja—. Como la administracion se reparte por costo
 * directo y cada unitario se redondea hacia arriba al escalon de S/0,50, mover
 * esos S/44 de sitio mueve el subtotal S/2: 7691 en vez de 7693.
 *
 * Es una diferencia de redondeo acotada y conocida, no otro precio.
 */
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
  subtotal: 7691,
  tax: 1384.38,
  total: 9075.38,
};

/** Lo que el Excel muestra en H15, para dejar la diferencia por escrito. */
const TOTAL_EXCEL = 9077.74;

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
    await expect(resumen).toContainText("S/ 9075.38", { timeout: 30_000 });

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
    // La distancia con la hoja es la de los redondeos, y se fija aqui para que
    // cualquier deriva mayor salte como un fallo y no pase por diferencia
    // conocida.
    expect(Math.abs(asNumber(precioJson.total) - TOTAL_EXCEL)).toBeLessThanOrEqual(3);

    // INVENTORY_GATE: cotizar, emitir y pasar a produccion NO consumen
    // existencia. Se mide aqui, alrededor de las tres acciones, en vez de
    // comprobarlo a mano una vez.
    const movimientosAntes = await page.request.get("/api/v1/inventory/movements?limit=1");
    expect(movimientosAntes.ok()).toBeTruthy();
    const totalAntes = asNumber((await movimientosAntes.json()).total);

    await page.getByRole("button", { name: /^confirmar y emitir$/i }).click();
    const dialogoEmision = page.getByRole("dialog", { name: /confirmar y emitir/i });
    await expect(dialogoEmision).toBeVisible();
    await expect(dialogoEmision).toContainText("S/ 9075.38");
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

  test("A2H-002 inventario: el operador ajusta existencia pero no abre almacen", async ({
    page,
  }) => {
    // Cierra INVENTORY_PERMISSION_BYPASS, que estaba NOT_VERIFIED por no haber
    // una cuenta no-admin. No se inventa la politica: se lee la que hay. Ajustar
    // existencia es del TALLER —`ajustarInventario: esTaller` en la UI y
    // `WorkshopUserDep` (ADMIN u OPERATOR) en el backend—, asi que el operador
    // puede y comprobar un 403 ahi seria comprobar una regla falsa. Lo que si
    // es administrativo es abrir un almacen: `crearAlmacen: esAdmin` y
    // `AdminUserDep` en POST /inventory/locations.
    await login(page, E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD);
    await page.goto("/inventario");
    await expect(page.getByRole("heading", { name: /inventario/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    const csrf = await page.request.get("/api/v1/auth/csrf");
    expect(csrf.ok()).toBeTruthy();
    const csrfToken = (await csrf.json()).csrf_token as string;

    // Leer el inventario si le corresponde.
    const lectura = await page.request.get("/api/v1/inventory/locations");
    expect(lectura.status()).toBe(200);

    // Abrir un almacen NO: el backend es la autoridad final.
    const almacen = await page.request.post("/api/v1/inventory/locations", {
      headers: { "X-CSRF-Token": csrfToken },
      data: { name: testName("Almacen-operador"), code: "E2E-OP" },
    });
    expect(almacen.status()).toBe(403);
  });
});
