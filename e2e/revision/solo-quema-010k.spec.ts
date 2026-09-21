import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { testName } from "../helpers/fixtures";

/**
 * Fase 010K — SOLO QUEMA, contra LA REVISIÓN.
 *
 * El caso es el del Excel «Solo Quema»: 100 piezas de 8×8×8, con los 3 cm de
 * separación que trae la configuración, cliente externo, baja y alta, modalidad
 * compartida y horno chico. La semilla de revisión ya tiene esos hornos con esas
 * tarifas (200/250 de quema y 35/70 de gas para el chico), así que los números
 * que esta prueba comprueba son literalmente los de la hoja:
 *
 * - ocupación 782,941176 % y 8 hornadas;
 * - carga facturada 7,829412 —compartida: se cobra lo que se ocupa—;
 * - quema 3523,235294 y gas 822,088235.
 *
 * Lo que la prueba defiende, más allá de las cifras:
 *
 * 1. **el documento no lleva nada interno.** Ni ocupación, ni gas, ni factor,
 *    ni costo, ni ganancia. Se comprueba sobre el TEXTO EXTRAÍDO del PDF, no
 *    sobre sus bytes: WeasyPrint comprime los flujos y buscar palabras en el
 *    binario daría un verde vacío;
 * 2. **el comparador no elige.** Mirar lo que costaría el horno grande no
 *    cambia el horno del servicio;
 * 3. **el factor de quema es el suyo.** Un ×3 —legítimo en fabricación— aquí se
 *    rechaza: lo que se vende es horno.
 */

/**
 * Lo INTERNO, que el documento del cliente no puede llevar nunca.
 *
 * «Hornadas» no está en la lista y es deliberado: la modalidad exclusiva se
 * describe al cliente como «reserva hornadas completas», y eso es un término
 * comercial que respalda su precio. Lo que no puede aparecer es cuántas salen,
 * qué ocupan y qué cuestan.
 */
const PROHIBIDOS_PDF = [
  "ocupación",
  "ocupacion",
  "gasreal",
  "costoreal",
  "ganancia",
  "margen",
  "factor",
];

const EXTRAER_TEXTO = [
  "import sys",
  "from pypdf import PdfReader",
  "sys.stdout.reconfigure(encoding='utf-8')",
  "print(chr(10).join((p.extract_text() or '') for p in PdfReader(sys.argv[1]).pages))",
].join("\n");

/** Sin espacios ni mayúsculas: `pypdf` reparte los blancos como quiere. */
function compacto(texto: string): string {
  return texto.replace(/\s+/g, "").toLowerCase();
}

/** El id del servicio abierto, leído de la URL. */
function idDeLaUrl(page: Page): number {
  const coincidencia = /\/solo-quema\/(\d+)/.exec(page.url());
  expect(coincidencia).not.toBeNull();
  return Number(coincidencia?.[1]);
}

async function textoDelPdf(api: APIRequestContext, id: number): Promise<string> {
  const respuesta = await api.get(`/api/v1/firing-quotations-v2/${id}/pdf`);
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()["content-type"]).toContain("application/pdf");
  const cuerpo = await respuesta.body();
  expect(cuerpo.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const python = process.env.E2E_PDF_PYTHON;
  expect(python, "E2E_PDF_PYTHON tiene que apuntar al Python del backend (con pypdf)").toBeTruthy();
  const carpeta = mkdtempSync(join(tmpdir(), "greda-quema-pdf-"));
  try {
    const fichero = join(carpeta, "quema.pdf");
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

/** Un servicio de quema con cliente, horno y las 100 piezas del Excel. */
async function servicioDelExcel(page: Page, etiqueta: string): Promise<number> {
  await login(page);
  await page.goto("/solo-quema");
  // Sin anclar el final: `Field` compone el nombre accesible con la etiqueta MAS
  // su exigencia —«Nombre Opcional»—, asi que un `/^nombre$/` no encuentra nada
  // y el fallo llega noventa segundos despues, como un tiempo agotado que no
  // explica por que. El resto del fichero ya lo hacia asi.
  await page.getByLabel(/nombre/i).fill(testName(etiqueta));
  await page.getByRole("button", { name: /crear servicio de quema/i }).click();
  await expect(page.getByTestId("ficha-solo-quema")).toBeVisible({ timeout: 15_000 });
  const id = idDeLaUrl(page);

  // Cliente.
  await page.getByTestId("panel-cliente-quema").getByRole("combobox", { name: "Cliente", exact: true }).click();
  await page.getByRole("option").nth(1).click();

  // La pieza: 100 de 8x8x8.
  const piezas = page.getByTestId("panel-piezas-quema");
  await piezas.getByLabel(/nueva pieza/i).fill(testName("taza"));
  await piezas.getByRole("button", { name: /a[ñn]adir pieza/i }).click();
  await expect(page.getByTestId("pieza-quema").first()).toBeVisible({ timeout: 15_000 });

  const cantidad = piezas.getByLabel(/^cantidad/i).last();
  await cantidad.fill("100");
  await cantidad.blur();
  for (const [indice, medida] of [/largo \(cm\)/i, /ancho \(cm\)/i, /alto \(cm\)/i].entries()) {
    const campo = piezas.getByLabel(medida).last();
    await campo.fill(["8", "8", "8"][indice] as string);
    await campo.blur();
  }

  // Horno chico, compartida, baja y alta.
  const quema = page.getByTestId("panel-quema-solo");
  await quema.getByRole("combobox", { name: "Horno", exact: true }).click();
  await page.getByRole("option", { name: /Horno chico E2E/ }).click();
  await expect(quema.getByText("782.941176 %").first()).toBeVisible({ timeout: 20_000 });
  return id;
}

test.describe("Solo Quema (Fase 010K)", () => {
  test("el caso del Excel sale al céntimo y el comparador no cambia el horno", async ({ page }) => {
    await servicioDelExcel(page, "quema-excel");

    const quema = page.getByTestId("panel-quema-solo");
    await expect(quema.getByText(/7\.82941\d* hornadas/)).toBeVisible();
    await expect(quema.getByText("3523.235294").first()).toBeVisible();
    await expect(quema.getByText("822.088235").first()).toBeVisible();

    // El comparador enseña el grande; el elegido sigue siendo el chico.
    const tabla = page.getByTestId("comparacion-hornos");
    await expect(tabla.getByText(/Horno grande E2E/)).toBeVisible();
    await expect(tabla.getByRole("row", { name: /Horno chico E2E/ })).toContainText("(elegido)");

    // Y el precio, con factor x1,00: subtotal 3523,50, IGV 634,23, total 4157,73.
    const precio = page.getByTestId("panel-precio-quema");
    await expect(precio.getByText("3523.500000").first()).toBeVisible();
    await expect(precio.getByText("634.230000").first()).toBeVisible();
    await expect(precio.getByText("4157.730000").first()).toBeVisible();
  });

  test("el factor de quema no acepta el x3 de fabricación", async ({ page }) => {
    await servicioDelExcel(page, "quema-factor");

    const precio = page.getByTestId("panel-precio-quema");
    await expect(precio.getByText(/entre 1[.,]00 y 2[.,]00/i)).toBeVisible();

    const factor = precio.getByLabel(/factor del servicio/i);
    await factor.fill("3");
    await factor.blur();
    // El backend lo rechaza y el precio no se mueve: el total sigue siendo el de x1.
    await expect(precio.getByText("4157.730000").first()).toBeVisible({ timeout: 20_000 });

    // Uno legítimo sí entra: x1,50 sobre 3523,235294 son 5284,852941, que
    // redondeados al escalón dan 5285,00; con IGV, 6236,30.
    await factor.fill("1.5");
    await factor.blur();
    await expect(precio.getByText("6236.300000").first()).toBeVisible({ timeout: 20_000 });
  });

  test("el documento emitido no enseña nada interno", async ({ page }) => {
    const id = await servicioDelExcel(page, "quema-pdf");

    const emision = page.getByTestId("panel-emision-quema");
    await expect(emision.getByTestId("vista-cliente")).toBeVisible({ timeout: 20_000 });
    await emision.getByRole("button", { name: /emitir cotizaci[oó]n de quema/i }).click();
    await expect(emision.getByRole("button", { name: /descargar pdf/i })).toBeVisible({
      timeout: 30_000,
    });

    // `page.request` y no el `request` suelto de Playwright: aquel no lleva las
    // cookies de la sesion y el PDF, que va detras del login, respondia 401.
    const crudo = await textoDelPdf(page.request, id);
    const texto = compacto(crudo);
    expect(texto).toContain(compacto("COTIZACIÓN DE QUEMA"));
    for (const prohibido of PROHIBIDOS_PDF) {
      expect(texto, `el documento del cliente no puede decir «${prohibido}»`).not.toContain(
        compacto(prohibido),
      );
    }
    // Y sí lleva el total del cliente, con el separador que use la plantilla.
    expect(crudo.replace(/\s+/g, "")).toMatch(/4[.,]?157[.,]73/);
  });
});
