import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { testName } from "../helpers/fixtures";

/**
 * Fase 010H — emitir, vencer, duplicar, PDF y paso a producción, contra LA REVISIÓN.
 *
 * Igual que el flujo de 010G, esto no corre contra producción: la base es un
 * PostgreSQL efímero que el job crea y destruye. Por eso aquí SÍ se emite y se
 * pasa a producción, cosa que el smoke de producción no hace nunca.
 *
 * La cotización vencida no se espera veinte días: el backend de revisión siembra
 * una en dólares emitida hace cuarenta, por la API y con su huella, y después
 * sube el tipo de cambio de la casa de 3,70 a 3,82
 * (`tests/e2e/servidor_revision.py::sembrar_cotizacion_vencida`).
 *
 * El texto del PDF descargado se extrae DE VERDAD: WeasyPrint comprime los
 * flujos y codifica los glifos, así que buscar palabras en los bytes daría un
 * verde vacío (revisión de Codex). Se usa el `pypdf` del entorno del backend de
 * revisión, que el job ya instaló: `E2E_PDF_PYTHON` apunta a ese intérprete, y
 * sin él la prueba falla en vez de saltarse.
 */

const NOMBRE_VENCIDA = "E2E-SEMILLA-VENCIDA-USD";
const PROHIBIDOS = /costo real|costo de producci[oó]n|gas real|ganancia|margen|tarifa por hora|diferencia de quema/i;

function paso(page: Page, numero: number, titulo: string) {
  return page.getByRole("button", { name: new RegExp(`${numero}\\.\\s*${titulo}`, "i") });
}

async function esperarGuardado(page: Page): Promise<void> {
  await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
    timeout: 30_000,
  });
}

async function csrf(page: Page): Promise<string> {
  const galleta = (await page.context().cookies()).find((c) => c.name === "greda_csrf");
  expect(galleta, "la sesión tiene que llevar su cookie CSRF").toBeDefined();
  return galleta?.value ?? "";
}

/** El id de la cotización abierta, leído de la URL. */
function idDeLaUrl(page: Page): number {
  const coincidencia = /\/cotizador-v2\/(\d+)/.exec(page.url());
  expect(coincidencia).not.toBeNull();
  return Number(coincidencia?.[1]);
}

/** Un borrador completo, listo para emitir, con una o varias piezas. */
async function borradorCompleto(page: Page, etiqueta: string, piezas: string[]): Promise<number> {
  await login(page);
  await page.goto("/cotizador-v2");
  await page.getByLabel(/referencia/i).fill(testName(etiqueta));
  await page.getByRole("button", { name: /crear cotizaci[oó]n v2/i }).click();
  await expect(page.getByTestId("pasos-cotizacion")).toBeVisible({ timeout: 15_000 });
  const id = idDeLaUrl(page);

  await paso(page, 1, "Cliente").click();
  await page.getByRole("combobox", { name: "Cliente", exact: true }).click();
  await page.getByRole("option").nth(1).click();

  await paso(page, 2, "Productos").click();
  for (const pieza of piezas) {
    const nombre = testName(pieza);
    await page.getByLabel(/nueva l[ií]nea/i).fill(nombre);
    await page.getByRole("button", { name: /a[ñn]adir l[ií]nea/i }).click();
    await expect(page.locator(`text=${nombre}`).first()).toBeVisible({ timeout: 15_000 });
    const cantidad = page.getByLabel(/^cantidad/i).last();
    await cantidad.fill("10");
    await cantidad.blur();
    for (const [indice, etiquetaMedida] of [/largo \(cm\)/i, /ancho \(cm\)/i, /alto \(cm\)/i].entries()) {
      const campo = page.getByLabel(etiquetaMedida).last();
      await campo.fill(["18", "12", "4"][indice] as string);
      await campo.blur();
    }
    await esperarGuardado(page);
  }

  await paso(page, 3, "Materiales").click();
  for (let indice = 0; indice < piezas.length; indice += 1) {
    await page.getByRole("combobox", { name: "Pasta", exact: true }).nth(indice).click();
    await page.getByRole("option").nth(1).click();
    await esperarGuardado(page);
    const peso = page.getByLabel(/pasta por pieza/i).nth(indice);
    await peso.fill("400");
    await peso.blur();
    await esperarGuardado(page);
  }

  await paso(page, 4, "Mano de obra").click();
  const dias = page.getByLabel(/d[ií]as efectivos/i);
  await dias.fill("2");
  await dias.blur();
  await esperarGuardado(page);

  await paso(page, 7, "Resumen").click();
  await expect(page.getByTestId("paso-resumen")).toBeVisible();
  await esperarGuardado(page);
  return id;
}

async function abrirDialogoDeEmision(page: Page) {
  await page.getByTestId("emitir-cotizacion").getByRole("button", { name: "Confirmar y emitir" }).click();
  const dialogo = page.getByRole("dialog", { name: /confirmar y emitir/i });
  await expect(dialogo.getByTestId("emision-total")).toBeVisible({ timeout: 15_000 });
  return dialogo;
}

const EXTRAER_TEXTO = [
  "import sys",
  "from pypdf import PdfReader",
  "sys.stdout.reconfigure(encoding='utf-8')",
  "print(chr(10).join((p.extract_text() or '') for p in PdfReader(sys.argv[1]).pages))",
].join("\n");

/** El PDF de la sesión, validado como PDF, y su texto extraído. */
async function textoDelPdf(api: APIRequestContext, id: number): Promise<string> {
  const respuesta = await api.get(`/api/v1/quotations-v2/${id}/pdf`);
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()["content-type"]).toContain("application/pdf");
  const cuerpo = await respuesta.body();
  expect(cuerpo.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const python = process.env.E2E_PDF_PYTHON;
  expect(python, "E2E_PDF_PYTHON tiene que apuntar al Python del backend (con pypdf)").toBeTruthy();
  const carpeta = mkdtempSync(join(tmpdir(), "greda-pdf-"));
  try {
    const fichero = join(carpeta, "cotizacion.pdf");
    writeFileSync(fichero, cuerpo);
    const texto = execFileSync(python as string, ["-c", EXTRAER_TEXTO, fichero], {
      encoding: "utf-8",
    });
    expect(texto.trim().length, "el PDF no tiene texto extraíble").toBeGreaterThan(0);
    return texto;
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
}

/** Sin espacios ni mayúsculas: `pypdf` reparte los blancos como quiere. */
function compacto(texto: string): string {
  return texto.replace(/\s+/g, "").toLowerCase();
}

const PROHIBIDOS_PDF = [
  "costoreal",
  "costodeproducción",
  "costodeproduccion",
  "gasreal",
  "ganancia",
  "margen",
  "tarifaporhora",
  "factor",
  "rendimiento",
  "stock",
];

async function comprobarPdf(api: APIRequestContext, id: number): Promise<string> {
  const texto = compacto(await textoDelPdf(api, id));
  for (const prohibido of PROHIBIDOS_PDF) {
    expect(texto, `el PDF contiene «${prohibido}»`).not.toContain(prohibido);
  }
  return texto;
}

async function historial(page: Page): Promise<string[]> {
  const lista = page.getByTestId("v2-historial");
  await expect(lista).toBeVisible({ timeout: 15_000 });
  return lista.locator("li").allInnerTexts();
}

test.describe("Cotizador V2: vigencia, emisión, duplicación, PDF y producción (Fase 010H)", () => {
  test("CASO 1 + CASO 4 + CASO 6: borrador → confirmar (doble clic) → PDF, una sola emisión y nada interno", async ({
    page,
  }) => {
    const id = await borradorCompleto(page, "V2-Emitir", ["Plato"]);

    const dialogo = await abrirDialogoDeEmision(page);
    await expect(dialogo.getByTestId("emision-aviso-congelado")).toHaveText(
      "Al confirmar, los valores comerciales quedarán congelados.",
    );
    await expect(dialogo).not.toContainText(PROHIBIDOS);

    // Doble clic: la pantalla apaga el botón y el backend es idempotente.
    await dialogo.getByRole("button", { name: "Confirmar y emitir" }).dblclick();
    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    const ciclo = page.getByTestId("v2-ciclo-de-vida");
    await expect(ciclo.getByTestId("v2-estado-efectivo")).toHaveText(/Emitida/, { timeout: 15_000 });
    await expect(ciclo.getByTestId("v2-valida-hasta")).toContainText(/Válida hasta: \d{2}\/\d{2}\/\d{4}/);

    // Otra ronda de confirmaciones simultáneas por la API: misma emisión.
    const resumen = await (await page.request.get(`/api/v1/quotations-v2/${id}/confirmation-preview`)).json();
    const token = await csrf(page);
    const respuestas = await Promise.all(
      [1, 2, 3].map(() =>
        page.request.post(`/api/v1/quotations-v2/${id}/confirm`, {
          data: { expected_fingerprint: resumen.fingerprint },
          headers: { "X-CSRF-Token": token },
        }),
      ),
    );
    const emisiones = new Set<string>();
    for (const respuesta of respuestas) {
      expect(respuesta.status()).toBe(200);
      emisiones.add((await respuesta.json()).issued_at);
    }
    expect(emisiones.size).toBe(1);

    await page.reload();
    const eventos = await historial(page);
    expect(eventos.filter((texto) => texto.startsWith("Emitida")).length).toBe(1);

    const documento = page.getByTestId("v2-documento-emitido");
    await expect(documento.getByText("Documento emitido")).toBeVisible();
    await expect(documento).not.toContainText(PROHIBIDOS);

    const descarga = page.waitForEvent("download");
    await ciclo.getByRole("button", { name: "Descargar PDF" }).click();
    expect((await descarga).suggestedFilename()).toMatch(/\.pdf$/);
    const pdf = await comprobarPdf(page.request, id);
    const cabecera = await (await page.request.get(`/api/v1/quotations-v2/${id}`)).json();
    for (const permitido of [cabecera.code, "clientee2e", "plato", "igv", "total", "válidahasta"]) {
      expect(pdf, `el PDF no contiene «${permitido}»`).toContain(compacto(String(permitido)));
    }
  });

  test("CASO 5: doble envío a producción → una sola transición", async ({ page }) => {
    const id = await borradorCompleto(page, "V2-Produccion", ["Taza"]);
    const dialogo = await abrirDialogoDeEmision(page);
    await dialogo.getByRole("button", { name: "Confirmar y emitir" }).click();
    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    const ciclo = page.getByTestId("v2-ciclo-de-vida");
    await ciclo.getByRole("button", { name: "Enviar a producción" }).click();
    const envio = page.getByRole("dialog", { name: "Enviar a producción" });
    await expect(envio).toContainText(/no se descuenta pasta ni esmalte/i);
    await envio.getByRole("button", { name: "Enviar a producción" }).dblclick();
    await expect(ciclo.getByTestId("v2-estado-efectivo")).toHaveText(/Lista para producción/, {
      timeout: 20_000,
    });

    const token = await csrf(page);
    const respuestas = await Promise.all(
      [1, 2, 3].map(() =>
        page.request.post(`/api/v1/quotations-v2/${id}/send-to-production`, {
          headers: { "X-CSRF-Token": token },
        }),
      ),
    );
    const puentes = new Set<number>();
    for (const respuesta of respuestas) {
      expect(respuesta.status()).toBe(200);
      const cuerpo = await respuesta.json();
      expect(cuerpo.created).toBe(false);
      puentes.add(cuerpo.handoff.id);
    }
    expect(puentes.size).toBe(1);

    await page.reload();
    const eventos = await historial(page);
    expect(eventos.filter((texto) => texto.startsWith("Enviada a producción")).length).toBe(1);
    await expect(ciclo.getByRole("button", { name: "Enviar a producción" })).toHaveCount(0);
  });

  test("CASO 2 + CASO 3 + CASO 7: vencida en USD → duplicar con el TC de hoy; la antigua conserva el suyo y su PDF", async ({
    page,
  }) => {
    await login(page);
    const listado = await (await page.request.get("/api/v1/quotations-v2?limit=200")).json();
    const semilla = listado.items.find((item: { name: string | null }) => item.name === NOMBRE_VENCIDA);
    expect(semilla, "el backend de revisión tiene que haber sembrado la cotización vencida").toBeDefined();
    const antiguaId = Number(semilla.id);

    await page.goto(`/cotizador-v2/${antiguaId}`);
    const ciclo = page.getByTestId("v2-ciclo-de-vida");
    await expect(page.getByTestId("v2-banda-vencida")).toContainText("COTIZACIÓN VENCIDA", {
      timeout: 15_000,
    });
    await expect(ciclo.getByTestId("v2-estado-efectivo")).toHaveText(/Vencida/);
    await expect(ciclo.getByRole("button", { name: "Enviar a producción" })).toHaveCount(0);
    const documento = page.getByTestId("v2-documento-emitido");
    await expect(documento).toContainText("TC 3.700");
    const totalAntiguo = await documento.getByText(/^Total:/).innerText();
    const pdfAntes = await comprobarPdf(page.request, antiguaId);
    expect(pdfAntes).toContain("3.70");
    const previaAntigua = await (
      await page.request.get(`/api/v1/quotations-v2/${antiguaId}/confirmation-preview`)
    ).json();

    await ciclo.getByRole("button", { name: "Duplicar y actualizar precios" }).dblclick();
    await expect(page.getByTestId("v2-avisos-duplicacion")).toContainText(
      /se recalcularon con la configuración de hoy/i,
      { timeout: 20_000 },
    );
    const nuevaId = idDeLaUrl(page);
    expect(nuevaId).not.toBe(antiguaId);

    const nueva = await (await page.request.get(`/api/v1/quotations-v2/${nuevaId}`)).json();
    expect(nueva.status).toBe("DRAFT");
    expect(nueva.duplicated_from_id).toBe(antiguaId);
    expect(nueva.currency_code).toBe("USD");
    expect(Number(nueva.exchange_rate)).toBeCloseTo(3.82, 6);
    expect(nueva.code).not.toBe(semilla.code);
    // Precios de hoy: con el mismo costo en soles y un dólar más caro, los
    // unitarios en USD se recalculan y ya no son los de la vencida.
    const previaNueva = await (
      await page.request.get(`/api/v1/quotations-v2/${nuevaId}/confirmation-preview`)
    ).json();
    expect(previaNueva.lines).toHaveLength(previaAntigua.lines.length);
    expect(Number(previaNueva.exchange_rate)).toBeCloseTo(3.82, 6);
    expect(previaNueva.total_amount).not.toBe(previaAntigua.total_amount);

    // Un solo borrador abierto aunque se pulse otra vez.
    const otra = await page.request.post(`/api/v1/quotations-v2/${antiguaId}/duplicate`, {
      headers: { "X-CSRF-Token": await csrf(page) },
    });
    expect(otra.status()).toBe(200);
    expect((await otra.json()).quotation.id).toBe(nuevaId);

    // La antigua: vencida, con 3,70, el mismo total y su PDF.
    await page.goto(`/cotizador-v2/${antiguaId}`);
    await expect(page.getByTestId("v2-banda-vencida")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("v2-documento-emitido")).toContainText("TC 3.700");
    expect(await page.getByTestId("v2-documento-emitido").getByText(/^Total:/).innerText()).toBe(
      totalAntiguo,
    );
    await expect(
      page.getByRole("link", { name: "Abrir la cotización duplicada" }),
    ).toHaveAttribute("href", `/cotizador-v2/${nuevaId}`);
    const antigua = await (await page.request.get(`/api/v1/quotations-v2/${antiguaId}`)).json();
    expect(antigua.status).toBe("CONFIRMED");
    expect(Number(antigua.exchange_rate)).toBeCloseTo(3.7, 6);
    const pdfDespues = await comprobarPdf(page.request, antiguaId);
    expect(pdfDespues).toBe(pdfAntes);
    expect(pdfDespues).not.toContain("3.82");
    const previaDespues = await (
      await page.request.get(`/api/v1/quotations-v2/${antiguaId}/confirmation-preview`)
    ).json();
    expect(previaDespues.total_amount).toBe(previaAntigua.total_amount);
  });

  test("CATÁLOGO: una pieza del maestro trae sus medidas y gramaje, se emite y llega al PDF", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/cotizador-v2");
    await page.getByLabel(/referencia/i).fill(testName("V2-Catalogo"));
    await page.getByRole("button", { name: /crear cotizaci[oó]n v2/i }).click();
    await expect(page.getByTestId("pasos-cotizacion")).toBeVisible({ timeout: 15_000 });
    const id = idDeLaUrl(page);

    await paso(page, 1, "Cliente").click();
    await page.getByRole("combobox", { name: "Cliente", exact: true }).click();
    await page.getByRole("option").nth(1).click();

    // Una pieza del CATÁLOGO, no de encargo.
    await paso(page, 2, "Productos").click();
    await page.getByRole("combobox", { name: /pieza del cat[aá]logo/i }).click();
    await page.getByRole("option", { name: "E2E-Catalogo Plato hondo 22" }).click();
    await page.getByRole("button", { name: /a[ñn]adir l[ií]nea/i }).click();
    await expect(page.getByRole("heading", { name: "E2E-Catalogo Plato hondo 22" })).toBeVisible({
      timeout: 15_000,
    });
    // El nombre lo fija el catálogo y las medidas vienen del maestro.
    await expect(page.getByLabel(/largo \(cm\)/i).last()).toHaveValue(/^22/);
    await expect(page.getByLabel(/alto \(cm\)/i).last()).toHaveValue(/^5/);
    const cantidad = page.getByLabel(/^cantidad/i).last();
    await cantidad.fill("12");
    await cantidad.blur();
    await esperarGuardado(page);

    // La pasta se elige; el peso por pieza ya viene del gramaje del maestro.
    await paso(page, 3, "Materiales").click();
    await page.getByRole("combobox", { name: "Pasta", exact: true }).first().click();
    await page.getByRole("option").nth(1).click();
    await esperarGuardado(page);
    await expect(page.getByLabel(/pasta por pieza/i).first()).toHaveValue(/^450/);

    await paso(page, 4, "Mano de obra").click();
    const dias = page.getByLabel(/d[ií]as efectivos/i);
    await dias.fill("1");
    await dias.blur();
    await esperarGuardado(page);
    await paso(page, 7, "Resumen").click();
    await esperarGuardado(page);

    const dialogo = await abrirDialogoDeEmision(page);
    await expect(dialogo.getByTestId("emision-lineas")).toContainText("E2E-Catalogo Plato hondo 22");
    await dialogo.getByRole("button", { name: "Confirmar y emitir" }).click();
    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    const lineas = await (await page.request.get(`/api/v1/quotations-v2/${id}/products`)).json();
    expect(lineas.items).toHaveLength(1);
    expect(lineas.items[0].product_id).not.toBeNull();
    expect(Number(lineas.items[0].body_unit_weight)).toBeCloseTo(450, 6);

    const pdf = await comprobarPdf(page.request, id);
    expect(pdf).toContain(compacto("E2E-Catalogo Plato hondo 22"));
    expect(pdf).toContain("largo:22cm");
  });

  test("CASO 8: multiproducto emitido lleva todas sus líneas al documento", async ({ page }) => {
    const id = await borradorCompleto(page, "V2-Multi-Emitir", ["Taza", "Fuente"]);
    const dialogo = await abrirDialogoDeEmision(page);
    await expect(dialogo.getByTestId("emision-lineas").locator("tbody tr")).toHaveCount(2);
    await dialogo.getByRole("button", { name: "Confirmar y emitir" }).click();
    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    const documento = page.getByTestId("v2-documento-emitido");
    await expect(documento.locator("tbody tr")).toHaveCount(2, { timeout: 15_000 });
    await expect(documento).not.toContainText(PROHIBIDOS);

    const previa = await (
      await page.request.get(`/api/v1/quotations-v2/${id}/confirmation-preview`)
    ).json();
    const suma = previa.lines.reduce(
      (total: number, linea: { line_subtotal: string }) => total + Number(linea.line_subtotal),
      0,
    );
    expect(suma).toBeCloseTo(Number(previa.subtotal_amount), 6);
    const pdf = await comprobarPdf(page.request, id);
    expect(pdf).toContain("taza");
    expect(pdf).toContain("fuente");
  });

  test("TÉCNICAS: el personal adicional es una persona con su técnica, y el backend rechaza el resto", async ({
    page,
  }) => {
    const id = await borradorCompleto(page, "V2-Tecnicas", ["Taza"]);
    const api = page.request;
    const trabajadores = (await (await api.get("/api/v1/quoter-v2/workers")).json()).items as {
      id: number;
      name: string;
      technique_ids: number[];
    }[];
    const taller = trabajadores.find((worker) => worker.name === "E2E-Trabajador taller");
    // La ficha del trabajador es la que dice qué sabe hacer.
    expect(taller?.technique_ids).toHaveLength(5);
    const tecnicas = (await (await api.get("/api/v1/quoter-v2/techniques")).json()).items as {
      id: number;
      name: string;
    }[];
    const torno = tecnicas.find((una) => una.name === "Torno facil");

    await paso(page, 4, "Mano de obra").click();
    const seccion = page.getByTestId("personal-adicional");
    await expect(seccion).toContainText(/suma costo y no reduce el plazo/i, { timeout: 15_000 });

    await seccion.getByRole("combobox", { name: "Trabajador" }).click();
    await page.getByRole("option", { name: /E2E-Trabajador taller/ }).click();
    await seccion.getByRole("combobox", { name: /Técnica que viene a hacer/ }).click();
    // El torno no es suyo: no se ofrece.
    await expect(page.getByRole("option", { name: "Torno facil" })).toHaveCount(0);
    await page.getByRole("option", { name: "A mano", exact: true }).click();
    await seccion.getByRole("button", { name: "Añadir personal" }).click();
    // Se espera al DATO, no al indicador: el alta empieza con el clic y el pie
    // todavia dice «guardado» durante el instante anterior a que arranque.
    const leerTareas = async () =>
      (await (await api.get(`/api/v1/quotations-v2/${id}/labor`)).json()).items as {
        worker_id: number;
        technique_name: string;
        is_additional_personnel: boolean;
      }[];
    await expect
      .poll(async () => (await leerTareas()).filter((tarea) => tarea.is_additional_personnel).length)
      .toBe(1);

    const tareas = await leerTareas();
    const apoyo = tareas.find((tarea) => tarea.is_additional_personnel);
    expect(apoyo?.worker_id).toBe(taller?.id);
    // «Personal adicional» ya no es una técnica: la tarea lleva la técnica real.
    expect(apoyo?.technique_name).toBe("A mano");

    // Y la barrera del backend sigue en pie para una petición a mano.
    const token = await csrf(page);
    const prohibido = await api.post(`/api/v1/quotations-v2/${id}/labor`, {
      data: { worker_id: taller?.id, technique_id: torno?.id, quantity: "10" },
      headers: { "X-CSRF-Token": token },
    });
    expect(prohibido.status()).toBe(422);
    expect(JSON.stringify(await prohibido.json())).toContain("V2_LABOR_TECHNIQUE_NOT_ALLOWED");
  });

  test("PROCESOS: la taza trae torno, asa y vidriado; se quita uno, se asigna y el adicional suma", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/cotizador-v2");
    await page.getByLabel(/referencia/i).fill(testName("V2-Procesos"));
    await page.getByRole("button", { name: /crear cotizaci[oó]n v2/i }).click();
    await expect(page.getByTestId("pasos-cotizacion")).toBeVisible({ timeout: 15_000 });
    const id = idDeLaUrl(page);

    await paso(page, 1, "Cliente").click();
    await page.getByRole("combobox", { name: "Cliente", exact: true }).click();
    await page.getByRole("option").nth(1).click();

    // La taza del catálogo declara tres procesos en su ficha.
    await paso(page, 2, "Productos").click();
    await page.getByRole("combobox", { name: /pieza del cat[aá]logo/i }).click();
    await page.getByRole("option", { name: "E2E-Catalogo Taza 250 ml" }).click();
    await page.getByRole("button", { name: /a[ñn]adir l[ií]nea/i }).click();
    await expect(page.getByRole("heading", { name: "E2E-Catalogo Taza 250 ml" })).toBeVisible({
      timeout: 15_000,
    });
    const cantidad = page.getByLabel(/^cantidad/i).last();
    await cantidad.fill("20");
    await cantidad.blur();
    await esperarGuardado(page);

    await paso(page, 3, "Materiales").click();
    await page.getByRole("combobox", { name: "Pasta", exact: true }).first().click();
    await page.getByRole("option").nth(1).click();
    await esperarGuardado(page);

    // Aquí está el punto de la corrección: nadie tuvo que acordarse del asa.
    await paso(page, 4, "Mano de obra").click();
    const procesos = page.getByTestId("procesos");
    await expect(procesos).toContainText("Torno facil", { timeout: 15_000 });
    await expect(procesos).toContainText("Armado de asa");
    await expect(procesos).toContainText("Vidriado por inmersion");

    const api = page.request;
    const leerProcesos = async () =>
      (await (await api.get(`/api/v1/quotations-v2/${id}/processes`)).json()).items as {
        id: number;
        technique_name: string;
        quantity: string;
        calculated_hours: string | null;
        worker_id: number | null;
        labor_cost: string | null;
      }[];
    let filas = await leerProcesos();
    expect(filas).toHaveLength(3);
    // Piezas precargadas con la cantidad del producto y horas ya calculadas.
    for (const fila of filas) {
      expect(Number(fila.quantity)).toBe(20);
      expect(fila.worker_id).toBeNull();
      expect(fila.labor_cost).toBeNull();
    }
    // 20 piezas a 50 por jornada de 8 h son 3,2 h.
    const asa = filas.find((fila) => fila.technique_name === "Armado de asa");
    expect(Number(asa?.calculated_hours)).toBeCloseTo(3.2, 6);

    // Asignar a alguien es lo que crea el costo, y se hace DESDE LA PANTALLA.
    const trabajadores = (await (await api.get("/api/v1/quoter-v2/workers")).json()).items as {
      id: number;
      name: string;
    }[];
    const taller = trabajadores.find((worker) => worker.name === "E2E-Trabajador taller");
    const token = await csrf(page);
    const filaDelAsa = procesos.locator("li").filter({ hasText: "Armado de asa" });
    await filaDelAsa.getByRole("combobox", { name: "Trabajador" }).click();
    await page.getByRole("option", { name: /E2E-Trabajador taller/ }).click();
    await expect
      .poll(async () =>
        (await leerProcesos()).find((fila) => fila.technique_name === "Armado de asa")?.worker_id,
      )
      .toBe(taller?.id);
    filas = await leerProcesos();
    const asaAsignada = filas.find((fila) => fila.technique_name === "Armado de asa");
    expect(Number(asaAsignada?.labor_cost)).toBeGreaterThan(0);
    // Y el costo se ve en la fila, sin recargar.
    await expect(filaDelAsa).toContainText("Costo");

    // Un trabajador que no sabe la técnica sigue rechazado, también por aquí.
    const tornero = trabajadores.find((worker) => worker.name === "E2E-Tornero");
    if (tornero !== undefined) {
      const prohibido = await api.post(
        `/api/v1/quotations-v2/${id}/processes/${asa?.id}/assign`,
        { data: { worker_id: tornero.id }, headers: { "X-CSRF-Token": token } },
      );
      expect(prohibido.status()).toBe(422);
    }

    // Quitar un proceso es de ESTA cotización: el maestro de la pieza no cambia.
    // También desde la pantalla, que es donde vive la decisión.
    await page
      .getByTestId("procesos")
      .locator("li")
      .filter({ hasText: "Vidriado por inmersion" })
      .getByRole("button", { name: "Quitar de esta cotización" })
      .click();
    await expect
      .poll(async () => (await leerProcesos()).length)
      .toBe(2);
    expect((await leerProcesos()).map((fila) => fila.technique_name)).not.toContain(
      "Vidriado por inmersion",
    );
    await expect(page.getByTestId("procesos")).not.toContainText("Vidriado por inmersion");
    const piezas = (await (await api.get("/api/v1/products?product_type=FINISHED_PRODUCT")).json())
      .items as { id: number; name: string }[];
    const taza = piezas.find((pieza) => pieza.name === "E2E-Catalogo Taza 250 ml");
    const maestro = await (
      await api.get(`/api/v1/quoter-v2/products/${taza?.id}/techniques`)
    ).json();
    expect(
      (maestro.items as { technique_name: string; active: boolean }[])
        .filter((fila) => fila.active)
        .map((fila) => fila.technique_name),
    ).toContain("Vidriado por inmersion");

    // El adicional suma al costo de producción y al costo real, como el Excel.
    const antes = await (await api.get(`/api/v1/quotations-v2/${id}/pricing`)).json();
    const conceptos = (await (await api.get("/api/v1/quoter-v2/extras")).json()).items as {
      id: number;
      name: string;
    }[];
    const empaque = conceptos.find((uno) => uno.name === "E2E-Empaque especial");
    // Desde la pantalla de precio, que es donde el Excel los pone.
    await paso(page, 6, "Margen y precio").click();
    const adicionales = page.getByTestId("adicionales");
    await expect(adicionales).toBeVisible({ timeout: 15_000 });
    await adicionales.getByRole("combobox", { name: "Añadir adicional" }).click();
    await page.getByRole("option", { name: /E2E-Empaque especial/ }).click();
    await adicionales.getByRole("button", { name: "Añadir" }).click();
    await expect(adicionales).toContainText("E2E-Empaque especial");

    const cantidadAdicional = adicionales.getByLabel(/^cantidad/i).first();
    await cantidadAdicional.fill("2");
    await cantidadAdicional.blur();
    await expect
      .poll(async () =>
        Number(
          (await (await api.get(`/api/v1/quotations-v2/${id}/extras`)).json()).extras_cost_total,
        ),
      )
      .toBeCloseTo(50, 6);

    const despues = await (await api.get(`/api/v1/quotations-v2/${id}/pricing`)).json();
    expect(Number(despues.extras_cost)).toBeCloseTo(50, 6);
    expect(Number(despues.production_cost) - Number(antes.production_cost)).toBeCloseTo(50, 6);
    expect(Number(despues.real_cost) - Number(antes.real_cost)).toBeCloseTo(50, 6);
    expect(empaque).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
  });
});

