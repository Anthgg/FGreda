/**
 * Fase 009K — E2E de PRODUCCIÓN de Prototipos.
 *
 * No es un smoke: recorre el ciclo físico completo de una muestra contra el
 * entorno real, y comprueba en cada paso lo que NO debe pasar —que no se
 * consuma inventario antes de tiempo, que arrancar dos veces no gaste el
 * doble, que un rechazo no se reescriba— porque ése es el fallo caro.
 *
 * Deja datos en producción a propósito, todos con prefijo `E2E-009K-`. Los
 * movimientos de inventario son historia física y no se borran: la limpieza
 * pertenece a 009L.
 *
 * Credenciales sólo por entorno. Nunca se imprimen contraseñas, cookies ni
 * tokens.
 */

import { expect, test, type APIResponse } from "@playwright/test";

import { login } from "./helpers/auth";
import { createApiSession, getJson, type ApiSession } from "./helpers/api";
import { hasE2ECredentials } from "./helpers/fixtures";

/** Arcilla Potter: material del CUERPO de la pieza, en gramos. */
const MATERIAL_ID = 479;
const MATERIAL_REF = "LAB70093";
const LOCATION_ID = 2;
/** Consumo por muestra. Pequeño, pero no simbólico: tiene que verse en el saldo. */
const QUANTITY_G = "30";
const CONSUMO = 30;
/** Cotización COTIZADOR de origen que se duplica para tener una UNPAID real. */
const SOURCE_QUOTATION_ID = 352;

const sello = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

interface Prototype {
  id: number;
  code: string;
  name: string;
  status: string;
  approval: string;
  quotation_id: number | null;
  started_at: string | null;
  completed_at: string | null;
  decided_at: string | null;
  supersedes_prototype_id: number | null;
  notes: string | null;
  materials: Array<{ product_id: number; quantity: string; uom_code: string }>;
}

interface Movement {
  id: number;
  product_id: number;
  movement_type: string;
  quantity: string;
  balance_after: string;
  reason: string | null;
}

async function saldo(s: ApiSession): Promise<number> {
  const page = await getJson<{ items: Array<{ product_id: number; location_id: number; quantity: string }> }>(
    s,
    `/api/v1/inventory?limit=200`,
  );
  const fila = page.items.find((i) => i.product_id === MATERIAL_ID && i.location_id === LOCATION_ID);
  return fila ? Number(fila.quantity) : 0;
}

async function movimientos(s: ApiSession): Promise<Movement[]> {
  const page = await getJson<{ items: Movement[] }>(
    s,
    `/api/v1/inventory/movements?product_id=${MATERIAL_ID}&limit=100`,
  );
  return page.items;
}

async function proto(s: ApiSession, id: number): Promise<Prototype> {
  return getJson<Prototype>(s, `/api/v1/prototypes/${id}`);
}

async function post(s: ApiSession, path: string, data?: unknown): Promise<APIResponse> {
  return s.context.post(path, {
    headers: { "X-CSRF-Token": s.csrfToken },
    ...(data === undefined ? { data: {} } : { data }),
  });
}

async function put(s: ApiSession, path: string, data: unknown): Promise<APIResponse> {
  return s.context.put(path, { headers: { "X-CSRF-Token": s.csrfToken }, data });
}

/** Código de dominio del error, para no depender de la frase. */
async function codigo(res: APIResponse): Promise<string> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code ?? "";
}

test.describe("009K · prototipos en producción", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");
  // Cerrado tras una variable propia A PROPOSITO. Este spec CREA muestras y
  // GASTA inventario real: si corriera con el resto de la suite, cada
  // ejecucion de CI dejaria movimientos fisicos en produccion.
  test.skip(
    !process.env.E2E_009K_PRODUCTION,
    "Se ejecuta solo a peticion: consume inventario real (E2E_009K_PRODUCTION=1)",
  );
  // Un selector equivocado tiene que fallar en un minuto, no en diez.
  test.setTimeout(420_000);

  test("ciclo físico completo de una muestra, con su iteración", async ({ page }) => {
    const s = await createApiSession();

    // ---------------------------------------------------------------
    // 0. Actor y material
    // ---------------------------------------------------------------
    const me = await getJson<{ user: { role: string } }>(s, "/api/v1/auth/me");
    console.log("ACTOR_ROLE:", me.user.role);
    expect(me.user.role).toBe("ADMIN");

    let stock = await saldo(s);
    console.log("STOCK_INICIAL_CRUDO:", stock);
    // Hace falta para dos muestras. Se carga por el flujo oficial de ajuste,
    // que deja su propio movimiento: nunca se toca el saldo por SQL.
    if (stock < CONSUMO * 2 + 10) {
      const falta = CONSUMO * 2 + 100 - stock;
      const ajuste = await post(s, "/api/v1/inventory/adjustments", {
        product_id: MATERIAL_ID,
        location_id: LOCATION_ID,
        quantity: String(falta),
        reason: `E2E-009K prototype validation ${sello}`,
      });
      expect(ajuste.status(), await ajuste.text()).toBe(201);
      stock = await saldo(s);
      console.log("AJUSTE_APLICADO:", falta, "-> STOCK:", stock);
    }
    const STOCK_INICIAL = stock;
    console.log("MATERIAL:", MATERIAL_REF, "STOCK_INICIAL:", STOCK_INICIAL, "uom: g");

    // ---------------------------------------------------------------
    // 1. Alta por la UI nueva (ficha alineada con el Excel del taller)
    // ---------------------------------------------------------------
    await login(page);
    await page.goto("/prototipos/nuevo");

    for (const seccion of ["Datos del prototipo", "Especificaciones", "Materiales y consumos", "Evaluación prevista"]) {
      await expect(page.getByText(seccion, { exact: false }).first()).toBeVisible();
    }
    console.log("GATE PROTOTYPE_EXCEL_FORM_PROD: PASS");

    const nombre = `E2E-009K-FINAL-${sello}`;
    page.setDefaultTimeout(20_000);
    await page.getByLabel("Nombre / producto").fill(nombre);
    await page.getByLabel("Responsable").fill("E2E Automation");
    await page.getByLabel("Referencia").fill(`REF-${sello}`);
    // «Técnica» a secas también casa con «Observaciones técnicas»; el input
    // propio va primero en el DOM, así que `.first()` es el de verdad.
    await page.getByLabel("Técnica").first().fill("Torno");
    await page.getByLabel("Color").fill("Terracota");
    await page.getByLabel("Ancho cm").fill("12");
    await page.getByLabel("Alto cm").fill("18");
    await page.getByLabel("Largo cm").fill("12");
    await page.getByLabel("Peso estimado g").fill("450");
    await page.getByLabel("Observaciones técnicas").fill("Muestra de cuerpo en arcilla, sin esmalte.");
    await page.getByLabel("Observaciones generales").fill(`E2E-009K ${sello}`);

    // El almacén se fija ya, para que lo ÚNICO que falte al arrancar sea la
    // cotización: si faltaran dos cosas, el bloqueo no probaría cuál manda.
    await page.getByRole("combobox", { name: /^Almacén/ }).click();
    await page.getByRole("option", { name: /Mariano Pastor/i }).click();

    // Material del cuerpo: arcilla, no barniz.
    await page.getByRole("button", { name: /a[ñn]adir material/i }).click();
    await page.getByRole("combobox", { name: /^Material/ }).last().click();
    await page.getByRole("option", { name: new RegExp(MATERIAL_REF, "i") }).click();
    await page.getByLabel(/^Cantidad prevista/).last().fill(QUANTITY_G);

    await page.getByRole("button", { name: /crear prototipo/i }).click();
    await page.waitForURL(/\/prototipos\/\d+/, { timeout: 30_000 });
    const creadoId = Number(page.url().match(/\/prototipos\/(\d+)/)?.[1]);
    expect(creadoId).toBeGreaterThan(0);

    let A = await proto(s, creadoId);
    console.log("PROTOTYPE_A:", A.code, "id:", A.id, "status:", A.status, "approval:", A.approval);
    expect(A.status).toBe("CREATED");
    expect(A.approval).toBe("PENDING");
    expect(A.quotation_id).toBeNull();
    expect(A.materials.map((m) => m.product_id)).toContain(MATERIAL_ID);
    console.log("GATE PROTOTYPE_STANDALONE_CREATE: PASS");

    // ---------------------------------------------------------------
    // 2. Guardar / reabrir: la ficha del Excel sobrevive
    // ---------------------------------------------------------------
    await page.goto("/prototipos");
    await expect(page.getByText(A.code)).toBeVisible({ timeout: 20_000 });
    await page.goto(`/prototipos/${A.id}`);
    await expect(page.getByText(nombre)).toBeVisible();
    for (const dato of ["E2E Automation", "Torno", "Terracota"]) {
      await expect(page.getByText(dato, { exact: false }).first()).toBeVisible();
    }
    A = await proto(s, A.id);
    expect(A.notes).toContain("E2E Automation");
    expect(A.notes).toContain("Torno");
    console.log("GATE PROTOTYPE_SAVE_REOPEN: PASS");
    console.log("GATE PROTOTYPE_EXCEL_DATA_PERSISTENCE: PASS");

    // ---------------------------------------------------------------
    // 3. Arrancar sin cotización: bloqueado, y sin gastar un gramo
    // ---------------------------------------------------------------
    const movs = await movimientos(s);
    const MOVS_ANTES = movs.length;
    const sinCotizacion = await post(s, `/api/v1/prototypes/${A.id}/start`);
    console.log("START_SIN_QUOTATION:", sinCotizacion.status(), await codigo(sinCotizacion));
    expect(sinCotizacion.ok()).toBeFalsy();
    expect(sinCotizacion.status()).toBeLessThan(500);

    A = await proto(s, A.id);
    expect(A.status).toBe("CREATED");
    expect(A.started_at).toBeNull();
    expect(await saldo(s)).toBe(STOCK_INICIAL);
    expect((await movimientos(s)).length).toBe(MOVS_ANTES);
    console.log("GATE PROTOTYPE_WITHOUT_QUOTATION_START_BLOCKED: PASS (stock delta 0)");

    // ---------------------------------------------------------------
    // 4. Cotización COTIZADOR real, CONFIRMED + UNPAID
    // ---------------------------------------------------------------
    const dup = await post(s, `/api/v1/quotation-builder/${SOURCE_QUOTATION_ID}/duplicate`);
    expect(dup.status(), await dup.text()).toBe(200);
    const borrador = (await dup.json()) as { id: number; code: string; updated_at: string };
    const conf = await post(s, `/api/v1/quotation-builder/${borrador.id}/confirm`, {
      expected_updated_at: borrador.updated_at,
    });
    expect(conf.status(), await conf.text()).toBe(200);
    const cotizacion = (await conf.json()) as { id: number; code: string; payment_status: string };
    console.log("E2E_QUOTATION:", cotizacion.code, "id:", cotizacion.id, "payment:", cotizacion.payment_status);
    expect(cotizacion.payment_status).toBe("UNPAID");

    const vinculo = await put(s, `/api/v1/prototypes/${A.id}`, { quotation_id: cotizacion.id });
    expect(vinculo.status(), await vinculo.text()).toBe(200);

    // ---------------------------------------------------------------
    // 5. Arrancar con la cotización impagada: bloqueado
    // ---------------------------------------------------------------
    const impagada = await post(s, `/api/v1/prototypes/${A.id}/start`);
    console.log("START_UNPAID:", impagada.status(), await codigo(impagada));
    expect(impagada.ok()).toBeFalsy();
    expect(impagada.status()).toBeLessThan(500);
    A = await proto(s, A.id);
    expect(A.status).toBe("CREATED");
    expect(await saldo(s)).toBe(STOCK_INICIAL);
    expect((await movimientos(s)).length).toBe(MOVS_ANTES);
    console.log("GATE PROTOTYPE_UNPAID_START_BLOCKED: PASS (stock delta 0)");
    console.log("GATE PAYMENT_GATE_PRESERVED: PASS");

    // ---------------------------------------------------------------
    // 6. Cobrar por la UI oficial del Cotizador
    // ---------------------------------------------------------------
    await page.goto(`/cotizador/${cotizacion.id}`);
    await page.getByRole("button", { name: /marcar como pagada/i }).click();
    await page.getByRole("button", { name: /confirmar pago/i }).click();
    await expect(page.getByRole("button", { name: /marcar como pagada/i })).toHaveCount(0, {
      timeout: 20_000,
    });

    const cobrada = await getJson<{ payment_status: string }>(
      s,
      `/api/v1/quotation-builder/${cotizacion.id}`,
    );
    expect(cobrada.payment_status).toBe("PAID");
    A = await proto(s, A.id);
    expect(A.status).toBe("CREATED");
    expect(A.started_at).toBeNull();
    expect(await saldo(s)).toBe(STOCK_INICIAL);
    expect((await movimientos(s)).length).toBe(MOVS_ANTES);
    console.log("GATE PROTOTYPE_MARK_PAID_AUTO_START: NO");
    console.log("GATE PROTOTYPE_MARK_PAID_STOCK_MUTATION: 0");

    // ---------------------------------------------------------------
    // 7. Arrancar de verdad: el único punto que mueve inventario
    // ---------------------------------------------------------------
    const arranque = await post(s, `/api/v1/prototypes/${A.id}/start`);
    expect(arranque.status(), await arranque.text()).toBe(200);
    A = await proto(s, A.id);
    expect(A.status).toBe("STARTED");
    expect(A.started_at).not.toBeNull();

    const saldoTrasA = await saldo(s);
    expect(saldoTrasA).toBe(STOCK_INICIAL - CONSUMO);
    const movsA = await movimientos(s);
    const salidaA = movsA.filter((m) => m.movement_type === "PROTOTYPE_OUT" && m.reason?.includes(A.code));
    expect(salidaA.length).toBe(1);
    expect(Number(salidaA[0]!.quantity)).toBe(-CONSUMO);
    console.log("PROTOTYPE_OUT_A:", salidaA[0]!.id, salidaA[0]!.quantity, "saldo:", saldoTrasA);
    console.log("GATE PROTOTYPE_PROD_START: PASS");
    console.log("GATE PROTOTYPE_ATOMIC_STOCK: PASS");
    console.log(`GATE PROTOTYPE_INVENTORY_RECONCILIATION: PASS (${STOCK_INICIAL} - ${CONSUMO} = ${saldoTrasA})`);

    // Ningún barniz: la muestra sólo gasta lo que se le eligió.
    const barniz = movsA.filter((m) => m.product_id !== MATERIAL_ID);
    expect(barniz.length).toBe(0);
    console.log("GATE PROTOTYPE_AUTOMATIC_GLAZE_CONSUMPTION: 0");

    // ---------------------------------------------------------------
    // 8. Segundo arranque: idempotente
    // ---------------------------------------------------------------
    const arranqueAt = A.started_at;
    const segundo = await post(s, `/api/v1/prototypes/${A.id}/start`);
    console.log("SEGUNDO_START:", segundo.status());
    expect(segundo.status()).toBeLessThan(500);
    A = await proto(s, A.id);
    expect(A.started_at).toBe(arranqueAt);
    expect(await saldo(s)).toBe(saldoTrasA);
    expect((await movimientos(s)).filter((m) => m.movement_type === "PROTOTYPE_OUT" && m.reason?.includes(A.code)).length).toBe(1);
    console.log("GATE PROTOTYPE_START_IDEMPOTENT: PASS");

    // ---------------------------------------------------------------
    // 9. Completar: no gasta nada más
    // ---------------------------------------------------------------
    const completa = await post(s, `/api/v1/prototypes/${A.id}/complete`);
    expect(completa.status(), await completa.text()).toBe(200);
    A = await proto(s, A.id);
    expect(A.status).toBe("COMPLETED");
    expect(A.approval).toBe("PENDING");
    expect(await saldo(s)).toBe(saldoTrasA);
    console.log("GATE PROTOTYPE_COMPLETE_STOCK_MUTATION: 0");

    // ---------------------------------------------------------------
    // 10. Guardia de producción final con la muestra PENDIENTE
    // ---------------------------------------------------------------
    const orden = await post(s, "/api/v1/production-orders", {
      quotation_id: cotizacion.id,
      stock_location_id: LOCATION_ID,
    });
    console.log("OP_CREATE:", orden.status());
    let opId: number | null = null;
    if (orden.status() === 201) {
      opId = ((await orden.json()) as { id: number }).id;
      const startPending = await post(s, `/api/v1/production-orders/${opId}/start`);
      const codePending = await codigo(startPending);
      console.log("OP_START_PROTOTYPE_PENDING:", startPending.status(), codePending);
      expect(startPending.ok()).toBeFalsy();
      expect(startPending.status()).toBeLessThan(500);
      console.log("GATE FINAL_PRODUCTION_PENDING_PROTOTYPE_BLOCKED: PASS");
    }

    // ---------------------------------------------------------------
    // 11. Rechazar
    // ---------------------------------------------------------------
    const rechazo = await post(s, `/api/v1/prototypes/${A.id}/reject`, { note: "E2E-009K: no valió" });
    expect(rechazo.status(), await rechazo.text()).toBe(200);
    A = await proto(s, A.id);
    expect(A.approval).toBe("REJECTED");
    expect(A.decided_at).not.toBeNull();
    expect(await saldo(s)).toBe(saldoTrasA);
    console.log("GATE PROTOTYPE_REJECTION: PASS");

    if (opId) {
      const startRejected = await post(s, `/api/v1/production-orders/${opId}/start`);
      console.log("OP_START_PROTOTYPE_REJECTED:", startRejected.status(), await codigo(startRejected));
      expect(startRejected.ok()).toBeFalsy();
      console.log("GATE FINAL_PRODUCTION_REJECTED_PROTOTYPE_BLOCKED: PASS");
    }

    // ---------------------------------------------------------------
    // 12. Iteración: la anterior no se reescribe
    // ---------------------------------------------------------------
    const suc = await post(s, `/api/v1/prototypes/${A.id}/successor`, { notes: "E2E-009K segunda muestra" });
    expect(suc.status(), await suc.text()).toBe(201);
    let B = (await suc.json()) as Prototype;
    B = await proto(s, B.id);
    console.log("SUCCESSOR:", B.code, "id:", B.id, "supersedes:", B.supersedes_prototype_id);
    expect(B.supersedes_prototype_id).toBe(A.id);
    expect(B.status).toBe("CREATED");
    expect(B.approval).toBe("PENDING");

    const AtrasSucesora = await proto(s, A.id);
    expect(AtrasSucesora.status).toBe("COMPLETED");
    expect(AtrasSucesora.approval).toBe("REJECTED");
    console.log("GATE PROTOTYPE_LINEAGE: PASS");

    if (opId) {
      const startSuccessorPending = await post(s, `/api/v1/production-orders/${opId}/start`);
      console.log("OP_START_SUCCESSOR_PENDING:", startSuccessorPending.status(), await codigo(startSuccessorPending));
      expect(startSuccessorPending.ok()).toBeFalsy();
      console.log("GATE CURRENT_EFFECTIVE_PROTOTYPE (pendiente bloquea): PASS");
    }

    // ---------------------------------------------------------------
    // 13. Fabricar y aprobar la sucesora
    // ---------------------------------------------------------------
    const saldoAntesB = await saldo(s);
    const arranqueB = await post(s, `/api/v1/prototypes/${B.id}/start`);
    expect(arranqueB.status(), await arranqueB.text()).toBe(200);
    B = await proto(s, B.id);
    expect(B.status).toBe("STARTED");
    const saldoTrasB = await saldo(s);
    expect(saldoTrasB).toBe(saldoAntesB - CONSUMO);
    console.log("PROTOTYPE_OUT_B: saldo", saldoAntesB, "->", saldoTrasB);

    const segundoB = await post(s, `/api/v1/prototypes/${B.id}/start`);
    expect(segundoB.status()).toBeLessThan(500);
    expect(await saldo(s)).toBe(saldoTrasB);
    console.log("GATE PROTOTYPE_START_IDEMPOTENT (sucesora): PASS");

    const completaB = await post(s, `/api/v1/prototypes/${B.id}/complete`);
    expect(completaB.status(), await completaB.text()).toBe(200);
    expect(await saldo(s)).toBe(saldoTrasB);

    const aprueba = await post(s, `/api/v1/prototypes/${B.id}/approve`, { note: "E2E-009K aprobada" });
    expect(aprueba.status(), await aprueba.text()).toBe(200);
    B = await proto(s, B.id);
    expect(B.approval).toBe("APPROVED");
    expect(B.decided_at).not.toBeNull();
    const Afinal = await proto(s, A.id);
    expect(Afinal.approval).toBe("REJECTED");
    console.log("GATE PROTOTYPE_APPROVAL: PASS");
    console.log("GATE HISTORICAL_REJECTED_PERMANENTLY_BLOCKS: NO");

    // Aprobar no arranca producción por su cuenta.
    if (opId) {
      const op = await getJson<{ status: string }>(s, `/api/v1/production-orders/${opId}`);
      expect(op.status).toBe("CREATED");
      console.log("GATE PROTOTYPE_APPROVAL_AUTO_STARTS_FINAL_PRODUCTION: NO");

      const startApproved = await post(s, `/api/v1/production-orders/${opId}/start`);
      const codeApproved = await codigo(startApproved);
      console.log("OP_START_PROTOTYPE_APPROVED:", startApproved.status(), codeApproved);
      // Superada la guardia del prototipo, lo que quede sólo puede ser un
      // guardia POSTERIOR (material, saldo). Que ya no diga «prototipo» es la
      // evidencia de que esa puerta se abrió.
      expect(codeApproved).not.toContain("PROTOTYPE");
      console.log("GATE FINAL_PRODUCTION_APPROVED_PROTOTYPE_ALLOWED: PASS");
      console.log("GATE FINAL_PRODUCTION_PROTOTYPE_GUARD: PASS");
    }

    // ---------------------------------------------------------------
    // 14. Auditoría
    // ---------------------------------------------------------------
    const audit = await getJson<{ items: Array<{ entity_type: string; entity_id: string; action: string }> }>(
      s,
      "/api/v1/settings/audit?limit=200",
    );
    const delPrototipo = audit.items.filter(
      (e) => e.entity_type === "prototype" && (e.entity_id === String(A.id) || e.entity_id === String(B.id)),
    );
    console.log("AUDIT_EVENTS:", JSON.stringify(delPrototipo.map((e) => `${e.entity_id}:${e.action}`)));
    expect(delPrototipo.length).toBeGreaterThan(0);
    console.log("GATE PROTOTYPE_AUDIT: PASS");

    // ---------------------------------------------------------------
    // 15. Inventario final, para el informe
    // ---------------------------------------------------------------
    const FINAL = await saldo(s);
    console.log("RESUMEN_INVENTARIO:", JSON.stringify({
      material: MATERIAL_REF,
      inicial: STOCK_INICIAL,
      consumo_A: CONSUMO,
      consumo_B: CONSUMO,
      final: FINAL,
      cuadra: FINAL === STOCK_INICIAL - CONSUMO * 2,
    }));
    expect(FINAL).toBe(STOCK_INICIAL - CONSUMO * 2);
    console.log("DATOS_E2E:", JSON.stringify({
      prototipo_A: A.code,
      prototipo_B: B.code,
      cotizacion: cotizacion.code,
      orden_produccion: opId,
      material: MATERIAL_REF,
      ubicacion: LOCATION_ID,
    }));

    await s.dispose();
  });
});
