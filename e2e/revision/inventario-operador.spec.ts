import { expect, test, type Locator, type Page } from "@playwright/test";

import { login, logout } from "../helpers/auth";
import { E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD, testName } from "../helpers/fixtures";

/**
 * Inventario: lo que un OPERADOR puede y no puede hacer con la existencia.
 *
 * La politica no se inventa aqui, se lee del codigo y se demuestra:
 *
 * - AJUSTAR existencia es trabajo de TALLER. En la pantalla,
 *   `ajustarInventario: esTaller` (ADMIN u OPERATOR); en el backend,
 *   `POST /api/v1/inventory/adjustments` con `WorkshopUserDep`, los mismos dos
 *   roles. El operador puede, y aqui se le ve hacerlo de verdad: el saldo se
 *   mueve y queda el movimiento que lo respalda.
 * - ABRIR un almacen es decision ADMINISTRATIVA. `crearAlmacen: esAdmin` y
 *   `POST /api/v1/inventory/locations` con `AdminUserDep`.
 *
 * Esto NO es el consumo de una orden de produccion ni tiene nada que ver con
 * cotizar: es el ajuste manual que ya existe, en una prueba propia. Que un
 * operador pueda ajustar a mano no significa que una cotizacion consuma
 * inventario, y el gate de 010H lo sigue comprobando por su lado.
 *
 * El backend de la revision no siembra almacenes ni saldos, y el operador no
 * puede crear un almacen —esa es justo la frontera—, asi que el fixture lo monta
 * el ADMIN por la API: un almacen PROPIO de la corrida y un saldo inicial
 * conocido. Asi el saldo de partida no depende de nada que otra prueba haya
 * dejado.
 */

/** La pasta sembrada por el backend de la revision: tiene unidad base (g). */
const PRODUCTO = "Arcilla Terranova";
const SALDO_INICIAL = 10;
const AJUSTE = 2;
/** Con el que el backend de la revision siembra al operador. */
const NOMBRE_OPERADOR = "Operador E2E";

async function csrf(page: Page): Promise<string> {
  const respuesta = await page.request.get("/api/v1/auth/csrf");
  expect(respuesta.ok()).toBeTruthy();
  return (await respuesta.json()).csrf_token as string;
}

async function seleccionar(
  page: Page,
  scope: Page | Locator,
  label: string | RegExp,
  option: string,
): Promise<void> {
  await scope.getByRole("combobox", { name: label }).click();
  const buscador = page.getByPlaceholder(/buscar opci[oó]n/i);
  if (await buscador.isVisible().catch(() => false)) {
    await buscador.fill(option);
  }
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** El id de la pasta sembrada, buscado por nombre exacto. */
async function idDelProducto(page: Page): Promise<number> {
  const respuesta = await page.request.get(
    `/api/v1/products?search=${encodeURIComponent(PRODUCTO)}`,
  );
  expect(respuesta.ok()).toBeTruthy();
  const items = (await respuesta.json()).items as { id: number; name: string }[];
  const producto = items.find((item) => item.name === PRODUCTO);
  expect(producto, `el backend de la revision tiene que sembrar «${PRODUCTO}»`).toBeDefined();
  return producto?.id ?? 0;
}

/** Como ADMIN: un almacen de esta corrida con un saldo inicial conocido. */
async function prepararAlmacen(
  page: Page,
  nombre: string,
): Promise<{ productId: number; locationId: number }> {
  await login(page);
  const token = await csrf(page);

  const almacen = await page.request.post("/api/v1/inventory/locations", {
    headers: { "X-CSRF-Token": token },
    data: { name: nombre },
  });
  expect(almacen.status(), "el ADMIN abre el almacen del fixture").toBe(201);
  const locationId = (await almacen.json()).id as number;
  const productId = await idDelProducto(page);

  const inicial = await page.request.post("/api/v1/inventory/adjustments", {
    headers: { "X-CSRF-Token": token },
    data: {
      product_id: productId,
      location_id: locationId,
      quantity: String(SALDO_INICIAL),
      reason: "E2E saldo inicial del fixture",
    },
  });
  expect(inicial.status(), "el ADMIN deja el saldo inicial").toBe(201);

  await logout(page);
  return { productId, locationId };
}

async function saldo(page: Page, productId: number, locationId: number): Promise<number> {
  const respuesta = await page.request.get(
    `/api/v1/inventory?product_id=${productId}&location_id=${locationId}`,
  );
  expect(respuesta.ok()).toBeTruthy();
  const items = (await respuesta.json()).items as { quantity: string }[];
  expect(items, "una sola fila de saldo para ese producto en ese almacen").toHaveLength(1);
  return Number(items[0]?.quantity);
}

async function movimientos(
  page: Page,
  productId: number,
  locationId: number,
): Promise<{ total: number; items: Record<string, unknown>[] }> {
  const respuesta = await page.request.get(
    `/api/v1/inventory/movements?product_id=${productId}&location_id=${locationId}&limit=5`,
  );
  expect(respuesta.ok()).toBeTruthy();
  return respuesta.json();
}

test.describe("Inventario: el operador ajusta existencia y no administra almacenes", () => {
  test("el operador ajusta existencia por la pantalla: cambia el saldo y queda el movimiento", async ({
    page,
  }) => {
    const nombreAlmacen = testName("Almacen-ajuste-operador");
    const { productId, locationId } = await prepararAlmacen(page, nombreAlmacen);

    await login(page, E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD);

    // --- antes -----------------------------------------------------------
    const antes = await saldo(page, productId, locationId);
    expect(antes, "el saldo de partida es el que dejo el fixture").toBe(SALDO_INICIAL);
    const movimientosAntes = (await movimientos(page, productId, locationId)).total;

    // --- el ajuste, como lo hace una persona ------------------------------
    await page.goto("/inventario");
    // Filtrar por el almacen de la corrida: asi la fila es unica aunque la
    // pasta tenga existencia en otros almacenes.
    await seleccionar(page, page, "Ubicación", nombreAlmacen);
    const fila = page.locator("tbody tr").filter({ hasText: nombreAlmacen });
    await expect(fila).toHaveCount(1, { timeout: 15_000 });

    // El boton existe para el operador: la pantalla no se lo esconde.
    await fila.getByRole("button", { name: "Ajustar" }).click();
    const motivo = testName("ajuste-operador");
    await page.getByLabel(/cantidad a sumar o restar/i).fill(String(AJUSTE));
    await page.getByLabel(/^motivo/i).fill(motivo);

    const guardado = page.waitForResponse(
      (respuesta) =>
        respuesta.url().endsWith("/api/v1/inventory/adjustments") &&
        respuesta.request().method() === "POST",
    );
    await page.getByRole("button", { name: /registrar ajuste/i }).click();
    const respuesta = await guardado;
    expect(respuesta.status(), "el backend acepta el ajuste del operador").toBe(201);

    // La pantalla ensena el saldo nuevo.
    await expect(fila.locator("td").nth(4)).toHaveText(
      new RegExp(`^${SALDO_INICIAL + AJUSTE}(\\.0+)?$`),
      { timeout: 15_000 },
    );

    // --- despues: el delta es exactamente el ajuste -----------------------
    const despues = await saldo(page, productId, locationId);
    expect(despues - antes, "el saldo se mueve exactamente lo ajustado").toBe(AJUSTE);
    expect(despues).toBe(SALDO_INICIAL + AJUSTE);

    // --- y queda UN movimiento que lo respalda ---------------------------
    const historial = await movimientos(page, productId, locationId);
    expect(historial.total, "el ajuste deja un movimiento, y solo uno").toBe(movimientosAntes + 1);
    const movimiento = historial.items[0] ?? {};
    expect(movimiento.movement_type).toBe("ADJUSTMENT");
    expect(movimiento.product_id).toBe(productId);
    expect(movimiento.location_id).toBe(locationId);
    expect(Number(movimiento.quantity), "el movimiento guarda el delta, no el saldo").toBe(AJUSTE);
    expect(Number(movimiento.balance_after)).toBe(SALDO_INICIAL + AJUSTE);
    expect(movimiento.reason).toBe(motivo);
    expect(movimiento.created_by_name, "el movimiento dice quien lo hizo").toBe(NOMBRE_OPERADOR);
    expect(movimiento.created_by, "y lo ata a su usuario").toBeTruthy();
    expect(movimiento.created_at).toBeTruthy();
  });

  test("abrir un almacen sigue siendo administrativo: 403 al operador con un payload valido", async ({
    page,
  }) => {
    // El control: el MISMO payload, valido, funciona como ADMIN. Sin esto, un
    // 403 al operador podria venir de un cuerpo mal formado —el esquema rechaza
    // campos de mas—, y la prueba estaria midiendo la validacion y no el rol.
    await login(page);
    const tokenAdmin = await csrf(page);
    const control = await page.request.post("/api/v1/inventory/locations", {
      headers: { "X-CSRF-Token": tokenAdmin },
      data: { name: testName("Almacen-control-admin") },
    });
    expect(control.status(), "el payload es valido: el ADMIN si abre el almacen").toBe(201);
    await logout(page);

    await login(page, E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD);
    const tokenOperador = await csrf(page);
    const nombre = testName("Almacen-operador");
    const denegado = await page.request.post("/api/v1/inventory/locations", {
      headers: { "X-CSRF-Token": tokenOperador },
      data: { name: nombre },
    });
    expect(denegado.status(), "el operador no abre almacenes").toBe(403);

    // Y no queda a medias: el almacen no existe.
    const ubicaciones = await page.request.get("/api/v1/inventory/locations");
    expect(ubicaciones.ok()).toBeTruthy();
    const nombres = ((await ubicaciones.json()) as { name: string }[]).map((item) => item.name);
    expect(nombres).not.toContain(nombre);
  });
});
