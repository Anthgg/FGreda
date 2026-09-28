import { expect, test, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { testName } from "../helpers/fixtures";
import { configurarTiempoYMoldes, decidirDias } from "./support/cotizadorV2Ui";

/**
 * El Cotizador V2 rediseñado de punta a punta, contra el BACKEND REAL de la
 * revisión (010O). Sin interceptar nada: listado → alta → siete pasos →
 * emisión → PDF, con la semilla de `servidor_revision`.
 *
 * Es la contraparte del flujo que `cotizador-v2-ciclo-de-vida.spec.ts` recorre
 * en la pantalla anterior, y la que lo sustituye en el corte (010O.13).
 */

const RUTA = process.env.E2E_RUTA_V2 ?? "/cotizador-v2";

async function esperarGuardado(page: Page) {
  await expect(page.getByTestId("v2next-estado-guardado")).toHaveText("Guardado", {
    timeout: 20_000,
  });
}

async function siguiente(page: Page, titulo: string) {
  await page.getByRole("button", { name: `Siguiente: ${titulo}` }).click();
  await expect(page.getByRole("heading", { level: 2, name: titulo, exact: true })).toBeVisible();
}

async function elegirOpcion(page: Page, combobox: ReturnType<Page["getByRole"]>, texto: RegExp | string) {
  await combobox.click();
  const buscador = page.getByPlaceholder(/buscar/i).last();
  if (typeof texto === "string" && (await buscador.isVisible().catch(() => false))) {
    await buscador.fill(texto);
  }
  await page.getByRole("option", { name: texto }).first().click();
}

test.describe("Cotizador V2 rediseñado contra el backend real (010O)", () => {
  test("listado → alta → siete pasos → emitir → PDF", async ({ page }) => {
    test.setTimeout(240_000);
    const errores: string[] = [];
    page.on("pageerror", (error) => errores.push(error.message));

    await login(page);
    await page.goto(RUTA);
    // Con datos reales cada fila trae su fecha de creación (un instante).
    await expect(page.getByRole("row").nth(1).getByRole("cell").nth(2)).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);

    // Alta con cliente: lleva directo a Piezas.
    await page.getByRole("button", { name: "Nueva cotización" }).click();
    const alta = page.getByRole("dialog", { name: "Nueva cotización" });
    await alta.getByRole("combobox", { name: /¿Para quién es\?/ }).click();
    await page.getByRole("option", { name: "Cliente E2E", exact: true }).click();
    await alta.getByLabel(/Ponle un nombre/).fill(testName("rediseno"));
    await alta.getByRole("button", { name: "Empezar cotización" }).click();
    await expect(page).toHaveURL(new RegExp(`${RUTA}/\\d+/productos$`), { timeout: 20_000 });

    // Piezas: una a medida, con cantidad y medidas.
    const pieza = testName("Plato");
    await page.getByRole("button", { name: /Agregar pieza/ }).click();
    const dialogo = page.getByRole("dialog", { name: /Agregar pieza/ });
    await dialogo.getByRole("combobox").click();
    await page.getByPlaceholder(/busca/i).last().fill(pieza);
    await page.getByRole("option", { name: new RegExp(`Pieza a medida «${pieza}»`) }).click();
    await expect(page.getByLabel("Nombre de la pieza").last()).toHaveValue(pieza, { timeout: 20_000 });
    const cantidad = page.getByRole("textbox", { name: "Cantidad" }).last();
    await cantidad.fill("10");
    await cantidad.blur();
    await expect(cantidad).toHaveValue("10");
    for (const [medida, valor] of [
      ["Largo", "18"],
      ["Ancho", "12"],
      ["Alto", "4"],
    ] as const) {
      const campo = page.getByRole("textbox", { name: new RegExp(`^${medida}`) }).last();
      await campo.fill(valor);
      await campo.blur();
    }
    await esperarGuardado(page);
    await configurarTiempoYMoldes(page, { horas: "0", minutos: "45", moldes: "3" });

    // Arcilla: la primera pasta valorizada y su peso.
    await siguiente(page, "Arcilla y esmalte");
    await page.getByRole("combobox", { name: "Arcilla", exact: true }).first().click();
    await page.getByRole("option").nth(1).click();
    await esperarGuardado(page);
    const peso = page.getByLabel("Arcilla por pieza").first();
    await peso.fill("400");
    await peso.blur();
    await esperarGuardado(page);

    // Trabajo: una técnica a mano con quien la sabe hacer; las horas activas
    // ya vienen del tiempo por pieza y los moldes de 010P.
    await siguiente(page, "Trabajo");
    await elegirOpcion(page, page.getByRole("combobox", { name: "Agregar proceso" }).first(), "A mano");
    await page.getByRole("button", { name: "Agregar", exact: true }).first().click();
    await esperarGuardado(page);
    await elegirOpcion(
      page,
      page.getByRole("combobox", { name: "Lo hace" }).first(),
      /E2E-Trabajador taller/,
    );
    await esperarGuardado(page);
    await decidirDias(page, "2");

    // Horno, precio y revisión: lo que falte lo dicen los pendientes.
    await siguiente(page, "Horno");
    await siguiente(page, "Precio");
    await expect(page.getByTestId("v2next-subtotal")).not.toHaveText("—");
    // El factor: un paso con el teclado, se guarda y el backend lo devuelve.
    const factor = page.getByTestId("v2next-factor-valor");
    const antes = await factor.textContent();
    const deslizador = page.getByRole("slider", { name: "Multiplicar el costo por" });
    await deslizador.focus();
    await deslizador.press("ArrowRight");
    await deslizador.blur();
    await expect(factor).not.toHaveText(antes ?? "");
    await esperarGuardado(page);
    const despues = await factor.textContent();
    await page.reload();
    await expect(factor).toHaveText(despues ?? "");
    await siguiente(page, "Revisar y emitir");
    await expect(page.getByTestId("v2next-documento")).toContainText(pieza);

    const emitir = page.getByRole("button", { name: "Emitir cotización" });
    await expect(emitir).toBeEnabled({ timeout: 20_000 });
    await emitir.click();
    const confirmar = page.getByRole("dialog", { name: "¿Emitir la cotización?" });
    await confirmar.getByRole("button", { name: "Confirmar y emitir" }).click();

    // Emitida: solo lectura, documento congelado y PDF.
    const cabecera = page.getByTestId("v2next-cabecera");
    await expect(cabecera.getByTestId("v2-estado-efectivo")).toHaveText(/Emitida/, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("v2next-solo-lectura")).toBeVisible();
    await expect(page.getByTestId("v2-documento-emitido")).toContainText(pieza);
    const descarga = page.waitForEvent("download");
    await cabecera.getByRole("button", { name: "Descargar PDF" }).click();
    expect((await descarga).suggestedFilename()).toMatch(/\.pdf$/);

    expect(errores).toEqual([]);
  });
});
