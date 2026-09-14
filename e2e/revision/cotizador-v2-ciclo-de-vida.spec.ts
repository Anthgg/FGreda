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
});
