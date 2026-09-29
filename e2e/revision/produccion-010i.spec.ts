import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD, testName } from "../helpers/fixtures";
import { assertW3AccessibleControls, assertW3Responsive } from "../helpers/w3-accessibility";

/**
 * Fase 010I — producción real de una cotización V2, contra LA REVISIÓN.
 *
 * CTZ V2 → emitir → enviar a producción → crear la orden → consumo real →
 * iniciar → quema → nota → comunicación → finalizar, y después: inventario
 * exacto, seguimiento completo y la cotización comercial intacta.
 *
 * La cotización se arma por la API —el asistente ya lo recorren las pruebas de
 * 010G/010H— y todo lo de producción se hace por la PANTALLA, que es lo que
 * esta fase entrega. Las comprobaciones de inventario van por la API y con
 * decimales exactos: el saldo no se compara nunca como `number`.
 */

// ---------------------------------------------------------------------------
// Apoyo
// ---------------------------------------------------------------------------
const API = "/api/v1";

async function csrf(page: Page): Promise<Record<string, string>> {
  const galleta = (await page.context().cookies()).find((c) => c.name === "greda_csrf");
  expect(galleta, "la sesión tiene que llevar su cookie CSRF").toBeDefined();
  return { "X-CSRF-Token": galleta?.value ?? "" };
}

async function ok<T>(respuesta: APIResponse, que: string): Promise<T> {
  expect(respuesta.ok(), `${que}: ${respuesta.status()} ${await respuesta.text()}`).toBe(true);
  return (await respuesta.json()) as T;
}

async function post<T>(page: Page, ruta: string, data?: unknown): Promise<T> {
  return ok<T>(await page.request.post(`${API}${ruta}`, { data, headers: await csrf(page) }), ruta);
}

async function get<T>(page: Page, ruta: string): Promise<T> {
  return ok<T>(await page.request.get(`${API}${ruta}`), ruta);
}

/** Decimal exacto a escala 12, como el backend. Nada de `number`. */
function escalado(texto: string): bigint {
  const [entera = "0", fraccion = ""] = texto.trim().split(".");
  return BigInt(entera) * 10n ** 12n + BigInt((fraccion + "0".repeat(12)).slice(0, 12) || "0");
}

interface Ids {
  cliente: number;
  tecnica: number;
  trabajador: number;
  pasta: number;
}

async function maestros(page: Page): Promise<Ids> {
  const clientes = await get<{ items: { id: number }[] }>(page, "/partners?limit=5");
  const tecnicas = await get<{ items: { id: number; code: string }[] }>(
    page,
    "/quoter-v2/techniques?limit=100",
  );
  const trabajadores = await get<{ items: { id: number; name: string }[] }>(
    page,
    "/quoter-v2/workers?limit=100",
  );
  const pastas = await get<{ items: { id: number; name: string }[] }>(
    page,
    "/products?limit=200&active=true&product_type=RAW_MATERIAL",
  );
  return {
    cliente: clientes.items[0]!.id,
    tecnica: tecnicas.items.find((t) => t.code === "E2E-A-MANO")!.id,
    trabajador: trabajadores.items.find((w) => /taller/i.test(w.name))!.id,
    pasta: pastas.items.find((p) => p.name === "Arcilla Terranova")!.id,
  };
}

/** Una CTZ V2 de dos piezas, EMITIDA. Devuelve su id. */
async function cotizacionEmitida(
  page: Page,
  etiqueta: string,
  pasta?: number,
  cantidadTaza = 20,
): Promise<number> {
  const ids = await maestros(page);
  const material = pasta ?? ids.pasta;
  const ctz = await post<{ id: number }>(page, "/quotations-v2", {
    name: testName(etiqueta),
    customer_id: ids.cliente,
  });
  for (const [nombre, cantidad, peso] of [
    ["Taza", cantidadTaza, "300"],
    ["Plato", 5, "450"],
  ] as const) {
    const linea = await post<{ id: number }>(page, `/quotations-v2/${ctz.id}/products`, {
      product_name: testName(nombre),
      quantity: cantidad,
      length_cm: "20",
      width_cm: "20",
      height_cm: "5",
      body_material_id: material,
      body_unit_weight: peso,
      production_time_per_unit_minutes: "6",
    });
    const proceso = await post<{ id: number }>(page, `/quotations-v2/${ctz.id}/processes`, {
      v2_quotation_product_id: linea.id,
      technique_id: ids.tecnica,
    });
    await post(page, `/quotations-v2/${ctz.id}/processes/${proceso.id}/assign`, {
      worker_id: ids.trabajador,
    });
  }
  await ok(
    await page.request.put(`${API}/quotations-v2/${ctz.id}/planning`, {
      data: { effective_work_days: 2 },
      headers: await csrf(page),
    }),
    "planificación",
  );
  const resumen = await get<{ can_confirm: boolean; fingerprint: string; blockers: unknown }>(
    page,
    `/quotations-v2/${ctz.id}/confirmation-preview`,
  );
  expect(resumen.can_confirm, JSON.stringify(resumen.blockers)).toBe(true);
  await post(page, `/quotations-v2/${ctz.id}/confirm`, { expected_fingerprint: resumen.fingerprint });
  return ctz.id;
}

/** Un almacén propio de la prueba, con existencia conocida de un material. */
async function almacenConExistencia(
  page: Page,
  etiqueta: string,
  producto: number,
  cantidad: string,
): Promise<number> {
  const almacen = await post<{ id: number }>(page, "/inventory/locations", {
    name: testName(etiqueta),
  });
  if (cantidad !== "0") {
    await post(page, "/inventory/adjustments", {
      product_id: producto,
      location_id: almacen.id,
      quantity: cantidad,
      reason: "Existencia inicial E2E 010I",
    });
  }
  return almacen.id;
}

async function saldo(page: Page, producto: number, almacen: number): Promise<string> {
  const pagina = await get<{ items: { product_id: number; quantity: string }[] }>(
    page,
    `/inventory?product_id=${producto}&location_id=${almacen}&limit=5`,
  );
  return pagina.items.find((fila) => fila.product_id === producto)?.quantity ?? "0";
}

async function movimientos(page: Page): Promise<number> {
  return (await get<{ total: number }>(page, "/inventory/movements?limit=1")).total;
}

/** Envía a producción por la pantalla y crea la orden eligiendo el almacén. */
async function crearOrdenDesdeLaCotizacion(
  page: Page,
  ctzId: number,
  nombreAlmacen: string,
): Promise<number> {
  await page.goto(`/cotizador-v2/${ctzId}/resumen`);
  const ciclo = page.getByTestId("v2-ciclo-de-vida");
  await ciclo.getByRole("button", { name: "Enviar a producción" }).click();
  const envio = page.getByRole("dialog");
  await envio.getByRole("button", { name: /enviar a producci[oó]n/i }).last().click();
  await expect(ciclo.getByTestId("v2-lista-produccion")).toBeVisible({ timeout: 15_000 });

  await ciclo.getByRole("button", { name: "Crear orden de producción" }).click();
  const dialogo = page.getByRole("dialog", { name: /crear orden de producci[oó]n/i });
  await expect(dialogo).toContainText(/No se descuenta ningún material/);
  await dialogo.getByRole("combobox").click();
  const buscador = page.getByPlaceholder(/buscar opci[oó]n/i);
  if (await buscador.isVisible().catch(() => false)) await buscador.fill(nombreAlmacen);
  await page.getByRole("option", { name: nombreAlmacen }).click();
  await dialogo.getByRole("button", { name: "Crear orden" }).click();

  const ver = ciclo.getByTestId("v2-ver-orden");
  await expect(ver).toBeVisible({ timeout: 15_000 });
  const href = await ver.getAttribute("href");
  const id = Number(/\/produccion\/(\d+)/.exec(href ?? "")?.[1]);
  expect(id).toBeGreaterThan(0);
  return id;
}

async function registrarConsumoPorPantalla(page: Page, cantidad: string) {
  await page.getByRole("button", { name: "Registrar consumo" }).click();
  const dialogo = page.getByRole("dialog", { name: /registrar consumo real/i });
  await expect(dialogo.getByRole("combobox", { name: /^Material/ })).toContainText(
    "Arcilla Terranova",
    { timeout: 15_000 },
  );
  await dialogo.getByLabel(/^Cantidad/).fill(cantidad);
  await dialogo.getByRole("button", { name: "Revisar consumo" }).click();
  return dialogo;
}

async function linea(page: Page, orden: number) {
  return get<{
    items: {
      type: string;
      status: string | null;
      occurred_at: string;
      actor_name: string | null;
      consumption: unknown;
      note: { kind: string } | null;
      communication: { message: string } | null;
    }[];
  }>(page, `/production-orders/${orden}/timeline`);
}

/** Todas las claves de un JSON, a cualquier profundidad. */
function claves(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(claves);
  if (valor && typeof valor === "object") {
    return Object.entries(valor).flatMap(([k, v]) => [k, ...claves(v)]);
  }
  return [];
}
const ECONOMICAS = /cost|price|subtotal|tax|igv|total_amount|margin|profit|factor|fx_|exchange/i;

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------
test.describe("Producción real de una cotización V2 (Fase 010I)", () => {
  test("FLUJO COMPLETO: CTZ → orden → consumo → iniciar → quema → nota → comunicación → finalizar", async ({
    page,
  }) => {
    const externas: string[] = [];
    const errores: string[] = [];
    page.on("request", (peticion) => {
      const host = new URL(peticion.url()).hostname;
      if (!["localhost", "127.0.0.1"].includes(host)) externas.push(peticion.url());
    });
    page.on("response", (respuesta) => {
      if (respuesta.url().includes("/api/") && respuesta.status() >= 500) {
        errores.push(`${respuesta.status()} ${respuesta.url()}`);
      }
    });

    await login(page);
    const ids = await maestros(page);
    const ctzId = await cotizacionEmitida(page, "010I-Flujo", undefined, 30);
    const almacen = await almacenConExistencia(page, "Taller 010I", ids.pasta, "10000");
    const almacenes = await get<{ id: number; name: string }[]>(page, "/inventory/locations");
    const nombre = almacenes.find((a) => a.id === almacen)!.name;

    const ordenId = await crearOrdenDesdeLaCotizacion(page, ctzId, nombre);
    // La cotización comercial, DESPUÉS de enviarla y ANTES de producir.
    const ctzAntes = await get<Record<string, unknown>>(page, `/quotations-v2/${ctzId}`);
    const lineasAntes = await get<unknown>(page, `/quotations-v2/${ctzId}/products`);

    // -- ficha: origen, cliente, piezas, material planificado ----------------
    await page.goto(`/produccion/${ordenId}`);
    await expect(page.getByText("Cotización V2", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("orden-cliente")).not.toHaveText(/sin nombre/i);
    const piezas = page.getByTestId("orden-piezas");
    await expect(piezas.getByRole("row")).toHaveCount(3);
    await expect(piezas).toContainText("20 × 20 × 5 cm");
    await expect(piezas).toContainText("300 g por pieza · 9000 g en total");
    await expect(piezas).toContainText("450 g por pieza · 2250 g en total");
    await expect(page.getByTestId("orden-faltantes")).toContainText(
      "Falta registrar consumo real de: pasta",
    );
    await expect(page.getByText(/pendiente de pago|impaga/i)).toHaveCount(0);

    // -- consumo real, con doble clic, y el stock exacto ----------------------
    const antes = await saldo(page, ids.pasta, almacen);
    const movsAntes = await movimientos(page);
    const dialogo = await registrarConsumoPorPantalla(page, "1200,5");
    await expect(dialogo.getByTestId("consumo-saldo-actual")).toHaveText("10000 g");
    await expect(dialogo.getByTestId("consumo-saldo-despues")).toHaveText("8799.5 g");
    await expect(dialogo).toContainText("Este consumo generará un movimiento de inventario.");
    await dialogo.getByRole("button", { name: "Confirmar consumo" }).dblclick();
    await expect(page.getByText(/Consumo registrado: 1200\.5 g de Arcilla Terranova/)).toBeVisible({
      timeout: 15_000,
    });
    const despues = await saldo(page, ids.pasta, almacen);
    expect(escalado(despues)).toBe(escalado(antes) - escalado("1200.5"));
    expect(await movimientos(page)).toBe(movsAntes + 1);
    const consumos = await get<{ total: number }>(page, `/production-orders/${ordenId}/consumptions`);
    expect(consumos.total).toBe(1);
    await expect(page.getByTestId("orden-faltantes")).toHaveCount(0);

    // -- iniciar ----------------------------------------------------------------
    await page.getByRole("button", { name: "Iniciar producción" }).click();
    await expect(page.getByText("EN PROCESO", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    // Iniciar una orden V2 no descuenta nada.
    expect(escalado(await saldo(page, ids.pasta, almacen))).toBe(escalado(despues));

    // -- quema con la fecha propuesta: no puede quedar antes del consumo --------
    await page.getByRole("button", { name: "Registrar quema" }).click();
    const quema = page.getByRole("dialog", { name: "Registrar quema" });
    await quema.getByRole("combobox", { name: /^Horno/ }).click();
    await page.getByRole("option", { name: "Horno grande E2E" }).click();
    await quema.getByRole("combobox", { name: /Tipo de quema/ }).click();
    await page.getByRole("option", { name: "Quema alta" }).click();
    await quema.getByLabel(/Observación/).fill("Hornada compartida E2E");
    await quema.getByRole("button", { name: "Registrar quema" }).click();
    await expect(page.getByText("Quema registrada.")).toBeVisible({ timeout: 15_000 });

    // -- nota -------------------------------------------------------------------
    await page.getByRole("button", { name: "Añadir nota" }).click();
    const nota = page.getByRole("dialog", { name: "Añadir nota" });
    await nota.getByLabel(/^Nota/).fill("Revisar asas antes de esmaltar");
    await nota.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText("Nota añadida al seguimiento.")).toBeVisible({ timeout: 15_000 });

    // -- comunicación: se REGISTRA, no se envía --------------------------------
    const estadoAntes = (await get<{ status: string }>(page, `/production-orders/${ordenId}`)).status;
    const saldoAntesAviso = await saldo(page, ids.pasta, almacen);
    await page.getByRole("button", { name: "Registrar comunicación" }).click();
    const aviso = page.getByRole("dialog", { name: "Registrar comunicación" });
    await expect(aviso).toContainText("El sistema no envía ningún mensaje");
    await expect(page.getByText(/Enviar WhatsApp|Mensaje enviado/)).toHaveCount(0);
    await aviso.getByRole("button", { name: "En quema" }).click();
    const texto = aviso.getByLabel(/Mensaje que enviaste/);
    await texto.press("End");
    await texto.pressSequentially("\nTe avisamos al sacarlas.");
    await aviso.getByRole("button", { name: "Registrar comunicación" }).click();
    await expect(page.getByText("Comunicación registrada en el seguimiento.")).toBeVisible({
      timeout: 15_000,
    });
    expect((await get<{ status: string }>(page, `/production-orders/${ordenId}`)).status).toBe(
      estadoAntes,
    );
    expect(escalado(await saldo(page, ids.pasta, almacen))).toBe(escalado(saldoAntesAviso));

    // -- registrar resultado físico 30 = 27 buenas + 3 de merma ----------------
    await page.getByRole("button", { name: "Finalizar producción" }).click();
    const resultados = page.getByRole("dialog", { name: "Registrar resultados de producción" });
    const taza = resultados.getByRole("group", { name: /Taza/ });
    await expect(taza).toContainText("Cantidad iniciada: 30");
    await taza.getByLabel("Buenas").fill("27");
    await taza.getByLabel("Merma").fill("3");
    await taza.getByLabel("Motivo de merma").fill("Fisura durante el secado");
    await assertW3AccessibleControls(page, "diálogo de resultados de orden de producción");
    await assertW3Responsive(page, "diálogo de resultados de orden de producción");
    await page.setViewportSize({ width: 1440, height: 900 });
    const plato = resultados.getByRole("group", { name: /Plato/ });
    await plato.getByLabel("Buenas").fill("5");
    await plato.getByLabel("Merma").fill("0");
    const respuestaCompletar = page.waitForResponse((respuesta) =>
      respuesta.url().endsWith(`/api/v1/production-orders/${ordenId}/complete`) &&
      respuesta.request().method() === "POST",
    );
    await resultados.getByRole("button", { name: "Completar producción" }).click();
    const respuestaResultados = await respuestaCompletar;
    expect(respuestaResultados.ok(), `completar producción: ${respuestaResultados.status()}`).toBe(true);
    const completion = (await respuestaResultados.json()) as {
      results: {
        line_ref: string;
        product_id: number | null;
        started_quantity: string;
        good_quantity: string;
        scrap_quantity: string;
        scrap_reason: string | null;
      }[];
    };
    const tazaResultado = completion.results.find(
      (result) => escalado(result.started_quantity) === escalado("30"),
    );
    expect(tazaResultado).toBeDefined();
    expect(escalado(tazaResultado!.good_quantity)).toBe(escalado("27"));
    expect(escalado(tazaResultado!.scrap_quantity)).toBe(escalado("3"));
    expect(tazaResultado!.scrap_reason).toBe("Fisura durante el secado");
    expect(tazaResultado!.product_id).not.toBeNull();
    const productoPersonalizado = await get<{
      product_type: string;
      product_category_path: string | null;
    }>(page, `/products/${tazaResultado!.product_id}`);
    expect(productoPersonalizado.product_type).toBe("FINISHED_PRODUCT");
    expect(productoPersonalizado.product_category_path).toBe("Piezas personalizadas");
    const platoResultado = completion.results.find(
      (result) => escalado(result.started_quantity) === escalado("5"),
    );
    expect(platoResultado).toBeDefined();
    expect(escalado(platoResultado!.good_quantity)).toBe(escalado("5"));
    expect(escalado(platoResultado!.scrap_quantity)).toBe(escalado("0"));
    await expect(page.getByText("FINALIZADO", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Registrar consumo" })).toHaveCount(0);
    const movimientosFinales = await get<{
      items: { production_order_id: number | null; product_id: number; movement_type: string; quantity: string }[];
    }>(page, "/inventory/movements?limit=100");
    const entradasFinales = movimientosFinales.items.filter(
      (movement) => movement.production_order_id === ordenId && movement.movement_type === "PRODUCTION_IN",
    );
    expect(entradasFinales).toHaveLength(2);
    const movimientosAntesDelReintento = await movimientos(page);
    const reintentoDeCierre = await page.request.post(`${API}/production-orders/${ordenId}/complete`, {
      data: {
        results: completion.results.map((result) => ({
          line_ref: result.line_ref,
          good_quantity: result.good_quantity,
          scrap_quantity: result.scrap_quantity,
          scrap_reason: result.scrap_reason,
        })),
      },
      headers: await csrf(page),
    });
    expect(reintentoDeCierre.status()).toBe(200);
    const completionReintentada = (await reintentoDeCierre.json()) as typeof completion;
    expect(completionReintentada.results.map((result) => [
      result.line_ref,
      result.product_id,
      result.good_quantity,
      result.scrap_quantity,
    ])).toEqual(completion.results.map((result) => [
      result.line_ref,
      result.product_id,
      result.good_quantity,
      result.scrap_quantity,
    ]));
    expect(await movimientos(page)).toBe(movimientosAntesDelReintento);
    expect(entradasFinales.map((movement) => escalado(movement.quantity)).sort()).toEqual(
      [escalado("5"), escalado("27")].sort(),
    );
    expect(entradasFinales.some((movement) => escalado(movement.quantity) === escalado("30"))).toBe(false);
    const movimientoTaza = entradasFinales.find((movement) => escalado(movement.quantity) === escalado("27"));
    expect(movimientoTaza).toBeDefined();
    expect(escalado(await saldo(page, movimientoTaza!.product_id, almacen))).toBe(escalado("27"));
    const wip = await get<{ production_order_id: number }[]>(page, "/production/wip");
    expect(wip.some((line) => line.production_order_id === ordenId)).toBe(false);

    // -- entrega parcial: 27 buenas, entregar 20 y rechazar 8 con saldo 7 ----
    const productoTaza = tazaResultado!.product_id;
    expect(productoTaza).not.toBeNull();
    await page.goto("/inventario");
    await expect(page.getByRole("heading", { level: 1, name: "Inventario." })).toBeVisible();
    await page.getByLabel("Buscar existencia").fill("Taza");
    const filaTaza = page.getByRole("row").filter({ hasText: "Taza" }).filter({ hasText: nombre });
    await expect(filaTaza).toContainText("27");
    await filaTaza.getByRole("button", { name: "Entrega…" }).click();
    const entrega = page.getByRole("region", { name: "Registrar entrega" });
    await expect(entrega.getByText("Entrega de producto terminado")).toBeVisible();
    const origenProduccion = entrega.getByLabel("Origen de producción (opcional)");
    await expect(origenProduccion).toBeVisible();
    await origenProduccion.click();
    await entrega.getByRole("option", { name: new RegExp(`Orden #${ordenId}.*Cotización V2 #${ctzId}`) }).click();
    await entrega.getByLabel("Cantidad a entregar").fill("20");
    await entrega.getByLabel("Motivo").fill("E2E W4 entrega parcial de 20 unidades");
    await entrega.getByRole("button", { name: "Registrar entrega" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Entrega registrada: 20" }))
      .toBeVisible({ timeout: 15_000 });
    expect(escalado(await saldo(page, productoTaza!, almacen))).toBe(escalado("7"));

    await page.goto("/inventario");
    await page.getByLabel("Buscar existencia").fill("Taza");
    const filaSaldoSiete = page.getByRole("row").filter({ hasText: "Taza" }).filter({ hasText: nombre });
    await expect(filaSaldoSiete).toContainText("7");
    await filaSaldoSiete.getByRole("button", { name: "Entrega…" }).click();
    const intentoSobreSaldo = page.getByRole("region", { name: "Registrar entrega" });
    await intentoSobreSaldo.getByLabel("Cantidad a entregar").fill("8");
    await intentoSobreSaldo.getByLabel("Motivo").fill("E2E W4 entrega mayor al saldo disponible");
    const respuestaEntregaRechazada = page.waitForResponse((response) =>
      response.url().endsWith("/api/v1/inventory/deliveries") && response.request().method() === "POST",
    );
    await intentoSobreSaldo.getByRole("button", { name: "Registrar entrega" }).click();
    const entregaRechazada = await respuestaEntregaRechazada;
    expect(entregaRechazada.ok(), "no se pueden entregar 8 unidades cuando hay 7").toBe(false);
    await expect(intentoSobreSaldo.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    expect(escalado(await saldo(page, productoTaza!, almacen))).toBe(escalado("7"));
    const movimientosEntrega = await get<{
      items: { production_order_id: number | null; v2_quotation_id: number | null; movement_type: string; quantity: string }[];
    }>(page, `/inventory/movements?product_id=${productoTaza}&limit=20`);
    const salidas = movimientosEntrega.items.filter((movement) => movement.movement_type === "DELIVERY_OUT");
    expect(salidas).toHaveLength(1);
    expect(salidas[0]!.production_order_id).toBe(ordenId);
    expect(salidas[0]!.v2_quotation_id).toBe(ctzId);
    expect(escalado(salidas[0]!.quantity)).toBe(escalado("-20"));

    // -- seguimiento completo y en orden -----------------------------------------
    await page.goto(`/produccion/${ordenId}`);
    const eventos = (await linea(page, ordenId)).items;
    expect(eventos.map((e) => [e.type, e.status])).toEqual([
      ["STATUS", "CREATED"],
      ["CONSUMPTION", null],
      ["STATUS", "STARTED"],
      ["FIRING_NOTE", null],
      ["NOTE", null],
      ["COMMUNICATION", null],
      ["STATUS", "COMPLETED"],
    ]);
    for (const evento of eventos) {
      const detalles = [evento.consumption, evento.note, evento.communication].filter(Boolean);
      expect(detalles.length, `${evento.type} lleva solo su detalle`).toBe(
        evento.type === "STATUS" ? 0 : 1,
      );
    }
    const comunicacion = eventos.find((e) => e.type === "COMMUNICATION")!;
    expect(comunicacion.communication!.message).toBe(
      "Hola, tus piezas entraron a quema.\nTe avisamos al sacarlas.",
    );
    expect(comunicacion.actor_name).toBeTruthy();
    const instantes = eventos.map((e) => Date.parse(e.occurred_at));
    expect([...instantes].sort((a, b) => a - b)).toEqual(instantes);
    const seguimiento = page.getByTestId("seguimiento");
    await expect(seguimiento.locator("li")).toHaveCount(7);

    // -- la cotización comercial, intacta -----------------------------------------
    expect(await get(page, `/quotations-v2/${ctzId}`)).toEqual(ctzAntes);
    expect(await get(page, `/quotations-v2/${ctzId}/products`)).toEqual(lineasAntes);
    const pdf = await page.request.get(`${API}/quotations-v2/${ctzId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // -- ni un proveedor externo, ni un 5xx ---------------------------------------
    expect(externas, "WHATSAPP_EXTERNAL_API: NONE").toEqual([]);
    expect(errores).toEqual([]);
  });

  test("STOCK: insuficiente se rechaza sin tocar nada; misma clave no descuenta dos veces; 700+700 sobre 1000 gana uno", async ({
    page,
  }) => {
    await login(page);
    const ids = await maestros(page);
    const ctzId = await cotizacionEmitida(page, "010I-Stock");
    const almacen = await almacenConExistencia(page, "Taller stock 010I", ids.pasta, "1000");
    const almacenes = await get<{ id: number; name: string }[]>(page, "/inventory/locations");
    const ordenId = await crearOrdenDesdeLaCotizacion(
      page,
      ctzId,
      almacenes.find((a) => a.id === almacen)!.name,
    );

    // Insuficiente por la API: rechazo, saldo y movimientos iguales, 0 consumos.
    const movs = await movimientos(page);
    const rechazo = await page.request.post(`${API}/production-orders/${ordenId}/consumptions`, {
      data: {
        product_id: ids.pasta,
        stock_location_id: almacen,
        quantity: "5000",
        kind: "BODY",
        idempotency_key: `e2e-sin-stock-${Date.now()}`,
      },
      headers: await csrf(page),
    });
    expect(rechazo.status()).toBe(422);
    expect((await rechazo.json()).error.code).toBe("NEGATIVE_STOCK_NOT_ALLOWED");
    expect(escalado(await saldo(page, ids.pasta, almacen))).toBe(escalado("1000"));
    expect(await movimientos(page)).toBe(movs);
    expect(
      (await get<{ total: number }>(page, `/production-orders/${ordenId}/consumptions`)).total,
    ).toBe(0);

    // Insuficiente por la pantalla: se explica y no se puede confirmar.
    await page.goto(`/produccion/${ordenId}`);
    const dialogo = await registrarConsumoPorPantalla(page, "5000");
    await expect(dialogo.getByRole("alert")).toContainText(
      "No hay stock suficiente para registrar este consumo",
    );
    await expect(dialogo.getByRole("button", { name: "Confirmar consumo" })).toBeDisabled();
    await dialogo.getByRole("button", { name: "Volver a editar" }).click();
    await dialogo.getByRole("button", { name: "Cancelar" }).click();

    // Reintento idempotente: misma clave, mismo consumo, un solo movimiento.
    const clave = `e2e-reintento-${Date.now()}`;
    const cuerpo = {
      product_id: ids.pasta,
      stock_location_id: almacen,
      quantity: "100",
      kind: "BODY",
      idempotency_key: clave,
    };
    const movsReintento = await movimientos(page);
    const primero = await page.request.post(`${API}/production-orders/${ordenId}/consumptions`, {
      data: cuerpo,
      headers: await csrf(page),
    });
    const segundo = await page.request.post(`${API}/production-orders/${ordenId}/consumptions`, {
      data: cuerpo,
      headers: await csrf(page),
    });
    expect(primero.status()).toBe(201);
    expect(segundo.status()).toBe(200);
    expect((await segundo.json()).id).toBe((await primero.json()).id);
    expect(await movimientos(page)).toBe(movsReintento + 1);
    expect(escalado(await saldo(page, ids.pasta, almacen))).toBe(escalado("900"));

    // Concurrencia: 700 + 700 sobre 900. Uno gana; nunca negativo.
    const cabeceras = await csrf(page);
    const [a, b] = await Promise.all(
      ["a", "b"].map((sufijo) =>
        page.request.post(`${API}/production-orders/${ordenId}/consumptions`, {
          data: { ...cuerpo, quantity: "700", idempotency_key: `e2e-conc-${sufijo}-${Date.now()}` },
          headers: cabeceras,
        }),
      ),
    );
    expect([a!.status(), b!.status()].sort()).toEqual([201, 422]);
    expect(escalado(await saldo(page, ids.pasta, almacen))).toBe(escalado("200"));
  });

  test("CANCELAR con consumo: rechazado, sin devolución; D3 caso A bloquea y caso B finaliza sin consumos", async ({
    page,
  }) => {
    await login(page);
    const ids = await maestros(page);

    // Cancelar con consumo (D1).
    const ctzCancel = await cotizacionEmitida(page, "010I-Cancelar");
    const almacen = await almacenConExistencia(page, "Taller cancelar 010I", ids.pasta, "500");
    const almacenes = await get<{ id: number; name: string }[]>(page, "/inventory/locations");
    const nombre = almacenes.find((a) => a.id === almacen)!.name;
    const ordenCancel = await crearOrdenDesdeLaCotizacion(page, ctzCancel, nombre);
    await post(page, `/production-orders/${ordenCancel}/consumptions`, {
      product_id: ids.pasta,
      stock_location_id: almacen,
      quantity: "50",
      kind: "BODY",
      idempotency_key: `e2e-antes-de-anular-${Date.now()}`,
    });
    await page.goto(`/produccion/${ordenCancel}`);
    await expect(page.getByTestId("orden-no-anulable")).toContainText("no puede anularse", {
      timeout: 15_000,
    });
    const movs = await movimientos(page);
    const anular = await page.request.post(`${API}/production-orders/${ordenCancel}/cancel`, {
      headers: await csrf(page),
    });
    expect(anular.status()).toBe(409);
    expect((await anular.json()).error.code).toBe("PRODUCTION_ORDER_HAS_CONSUMPTIONS");
    expect(escalado(await saldo(page, ids.pasta, almacen))).toBe(escalado("450"));
    expect(await movimientos(page)).toBe(movs);

    // D3 caso A: pide pasta y no hay consumo -> no finaliza, y se dice qué falta.
    const ctzA = await cotizacionEmitida(page, "010I-D3-A");
    const ordenA = await crearOrdenDesdeLaCotizacion(page, ctzA, nombre);
    await page.goto(`/produccion/${ordenA}`);
    await page.getByRole("button", { name: "Iniciar producción" }).click();
    await expect(page.getByRole("button", { name: "Finalizar producción" })).toBeDisabled({
      timeout: 15_000,
    });
    await expect(page.getByTestId("orden-faltantes")).toContainText(
      "Falta registrar consumo real de: pasta",
    );
    const ordenAActual = await get<{
      result_lines: { line_ref: string; started_quantity: string }[];
    }>(page, `/production-orders/${ordenA}`);
    const completar = await page.request.post(`${API}/production-orders/${ordenA}/complete`, {
      data: {
        results: ordenAActual.result_lines.map((line) => ({
          line_ref: line.line_ref,
          good_quantity: line.started_quantity,
          scrap_quantity: "0",
          scrap_reason: null,
        })),
      },
      headers: await csrf(page),
    });
    expect(completar.status()).toBe(409);
    expect((await completar.json()).error.code).toBe("PRODUCTION_ORDER_CONSUMPTION_MISSING");

    // D3 caso B: el material planificado NO se inventaría (un servicio) -> finaliza
    // sin consumos. Un producto propio de la prueba, para no tocar la semilla.
    const categorias = await get<{ id: number; name: string }[]>(page, "/categories");
    const categoria = categorias.find((c) => c.name === "Pastas E2E")!.id;
    const servicio = await post<{ id: number; name: string }>(page, "/products", {
      name: testName("Modelado externo"),
      product_type: "RAW_MATERIAL",
      product_category_id: categoria,
      base_uom_code: "g",
      cost: "0.05",
      purchasable: true,
    });
    // Valorizado para el Cotizador V2, como la pasta de la semilla: sin eso no
    // se puede cotizar con él.
    await ok(
      await page.request.put(`${API}/quoter-v2/materials/${servicio.id}`, {
        data: {
          material_kind: "BODY",
          origin: "PURCHASE",
          purchase_quantity: "1000",
          purchase_cost: "50",
          transport_cost: "0",
        },
        headers: await csrf(page),
      }),
      "valorización V2 del material del caso B",
    );
    const ctzB = await cotizacionEmitida(page, "010I-D3-B", servicio.id);
    const ordenB = await crearOrdenDesdeLaCotizacion(page, ctzB, nombre);
    const ordenBActual = await get<{
      result_lines: { line_ref: string; product_name: string; started_quantity: string }[];
    }>(page, `/production-orders/${ordenB}`);
    await ok(
      await page.request.put(`${API}/products/${servicio.id}`, {
        data: {
          name: servicio.name,
          product_type: "SERVICE",
          product_category_id: categoria,
          base_uom_code: "g",
          cost: "0.05",
          purchasable: true,
        },
        headers: await csrf(page),
      }),
      "material pasa a servicio",
    );
    await page.goto(`/produccion/${ordenB}`);
    await page.getByRole("button", { name: "Iniciar producción" }).click();
    const finalizar = page.getByRole("button", { name: "Finalizar producción" });
    await expect(finalizar).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByTestId("orden-faltantes")).toHaveCount(0);
    await finalizar.click();
    const resultados = page.getByRole("dialog", { name: "Registrar resultados de producción" });
    for (const line of ordenBActual.result_lines) {
      const grupo = resultados.getByRole("group", { name: line.product_name });
      await grupo.getByLabel("Buenas").fill(line.started_quantity);
      await grupo.getByLabel("Merma").fill("0");
    }
    await resultados.getByRole("button", { name: "Completar producción" }).click();
    await expect(page.getByText("FINALIZADO", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(
      (await get<{ total: number }>(page, `/production-orders/${ordenB}/consumptions`)).total,
    ).toBe(0);
  });

  test("OPERATOR: lee la orden V2 sin datos comerciales, trabaja y registra comunicaciones; el puente no es suyo", async ({
    page,
    browser,
  }) => {
    // El ADMIN prepara una orden.
    await login(page);
    const ids = await maestros(page);
    const ctzId = await cotizacionEmitida(page, "010I-Operario");
    const almacen = await almacenConExistencia(page, "Taller operario 010I", ids.pasta, "800");
    const almacenes = await get<{ id: number; name: string }[]>(page, "/inventory/locations");
    const ordenId = await crearOrdenDesdeLaCotizacion(
      page,
      ctzId,
      almacenes.find((a) => a.id === almacen)!.name,
    );

    const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const operario = await contexto.newPage();
    // El servidor de revisión expone una identidad OPERATOR aislada en FakeSupabaseAuth.
    // Su repositorio de perfiles es intencionalmente estático; no crear otro perfil por API.
    expect(E2E_OPERATOR_EMAIL, "E2E_OPERATOR_EMAIL debe coincidir con el servidor de revisión").toBeTruthy();
    expect(E2E_OPERATOR_PASSWORD, "E2E_OPERATOR_PASSWORD debe coincidir con el servidor de revisión").toBeTruthy();
    await login(operario, E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD);

    // La cotización V2 no es suya: 403, y por tanto tampoco el puente.
    expect((await operario.request.get(`${API}/quotations-v2/${ctzId}`)).status()).toBe(403);

    // La orden sí: cliente y piezas, sin una sola clave económica.
    const ficha = await get<Record<string, unknown>>(operario, `/production-orders/${ordenId}`);
    const listado = await get<Record<string, unknown>>(
      operario,
      `/production-orders?v2_quotation_id=${ctzId}`,
    );
    for (const respuesta of [ficha, listado]) {
      expect(claves(respuesta).filter((k) => ECONOMICAS.test(k))).toEqual([]);
    }
    await operario.goto(`/produccion/${ordenId}`);
    await expect(operario.getByTestId("orden-cliente")).not.toHaveText(/sin nombre/i, {
      timeout: 15_000,
    });
    await expect(operario.getByTestId("orden-piezas").getByRole("row")).toHaveCount(3);
    await expect(operario.locator("body")).not.toContainText(/S\/\s?\d|precio|margen|factor/i);
    await expect(operario.getByRole("link", { name: /CTZ-V2/ })).toHaveCount(0);
    await expect(operario.getByRole("button", { name: "Anular orden" })).toHaveCount(0);

    // Trabaja: consume, inicia, registra una comunicación.
    const dialogo = await registrarConsumoPorPantalla(operario, "300");
    await dialogo.getByRole("button", { name: "Confirmar consumo" }).click();
    await expect(operario.getByText(/Consumo registrado: 300 g/)).toBeVisible({ timeout: 15_000 });
    await operario.getByRole("button", { name: "Iniciar producción" }).click();
    await expect(operario.getByText("EN PROCESO", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await operario.getByRole("button", { name: "Registrar comunicación" }).click();
    const aviso = operario.getByRole("dialog", { name: "Registrar comunicación" });
    await aviso.getByRole("button", { name: "En proceso" }).click();
    await aviso.getByRole("button", { name: "Registrar comunicación" }).click();
    await expect(operario.getByText("Comunicación registrada en el seguimiento.")).toBeVisible({
      timeout: 15_000,
    });
    const eventos = (await linea(operario, ordenId)).items;
    const suya = eventos.find((e) => e.type === "COMMUNICATION")!;
    const yo = await get<{ user: { display_name: string } }>(operario, "/auth/me");
    expect(suya.actor_name).toBe(yo.user.display_name);

    // Anular sigue siendo de ADMIN en el backend.
    const anular = await operario.request.post(`${API}/production-orders/${ordenId}/cancel`, {
      headers: await csrf(operario),
    });
    expect(anular.status()).toBe(403);
    await contexto.close();
  });
});
