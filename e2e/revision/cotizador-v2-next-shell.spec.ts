import { expect, test, type Page } from "@playwright/test";

import { interceptarApi, vigilarConsola } from "./support/cotizadorV2NextMocks";

/**
 * Smoke de Chromium del shell del Cotizador V2 rediseñado (010O.3).
 *
 * Como `kiln-layout-map.spec.ts`, intercepta TODA la API con respuestas fijas:
 * no necesita backend, base de datos ni credenciales, y no escribe nada. Lo que
 * comprueba es lo que jsdom no puede —el maquetado real—:
 *
 * - la rejilla de tres zonas se reacomoda por consulta de CONTENEDOR en 375,
 *   768, 1024, 1280 y 1440 px, también con el menú lateral plegado;
 * - no hay desplazamiento horizontal de página a ningún ancho;
 * - un diálogo del ciclo de vida sigue cubriendo la ventana: el contenedor de
 *   consultas no puede convertirse en el bloque que contiene a lo `fixed`;
 * - la consola queda limpia.
 */

async function maquetado(page: Page) {
  return page.evaluate(() => {
    const rejilla = document.querySelector('[data-testid="v2next-rejilla"]') as HTMLElement;
    const lista = document.querySelector('[data-testid="v2next-pasos"] ol') as HTMLElement;
    const principal = document.querySelector("main") as HTMLElement;
    const asistente = document.querySelector('[data-testid="v2next-asistente"]') as HTMLElement;
    return {
      columnas: getComputedStyle(rejilla).gridTemplateColumns.split(" ").length,
      direccionPasos: getComputedStyle(lista).flexDirection,
      anchoContenedor: Math.round(asistente.getBoundingClientRect().width),
      desbordePagina: document.documentElement.scrollWidth - window.innerWidth,
      desbordePrincipal: principal.scrollWidth - principal.clientWidth,
      desbordeAsistente: asistente.scrollWidth - asistente.clientWidth,
    };
  });
}

// Con el menú desplegado (256 px) y el relleno del <main>, el ancho útil es el
// de la ventana menos ~320 px a partir de 1024; por debajo no hay menú lateral.
const ANCHOS = [
  { ancho: 375, columnas: 1, pasos: "row" },
  { ancho: 768, columnas: 1, pasos: "row" },
  { ancho: 1024, columnas: 1, pasos: "row" },
  { ancho: 1280, columnas: 2, pasos: "column" },
  { ancho: 1440, columnas: 3, pasos: "column" },
] as const;

test.describe("Shell del Cotizador V2 rediseñado (010O.3)", () => {
  for (const { ancho, columnas, pasos } of ANCHOS) {
    test(`${ancho} px: ${columnas} columna(s), pasos en ${pasos}, sin desborde`, async ({ page }, info) => {
      const errores = vigilarConsola(page);
      await interceptarApi(page);
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/cotizador-v2/7/productos");

      await expect(page.getByRole("heading", { level: 2, name: "Piezas", exact: true })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Pasos" })).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Pasos" }).getByRole("button", { name: /Paso 2: Piezas/ }),
      ).toHaveAttribute("aria-current", "step");

      const medida = await maquetado(page);
      expect(medida.columnas, JSON.stringify(medida)).toBe(columnas);
      expect(medida.direccionPasos).toBe(pasos);
      expect(medida.desbordePagina).toBeLessThanOrEqual(0);
      expect(medida.desbordePrincipal).toBeLessThanOrEqual(0);
      expect(medida.desbordeAsistente).toBeLessThanOrEqual(0);

      // El resumen compacto solo en una columna; el ancho, en las demás.
      const compacto = page.getByTestId("v2next-resumen-compacto");
      if (columnas === 1) await expect(compacto).toBeVisible();
      else await expect(compacto).toBeHidden();

      await page.screenshot({ path: info.outputPath(`shell-${ancho}.png`), fullPage: true });
      expect(errores).toEqual([]);
    });
  }

  test("1024 px con el menú plegado: el contenedor gana sitio y pasa a dos columnas", async ({ page }) => {
    await interceptarApi(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/cotizador-v2/7/cliente");
    await expect(page.getByRole("heading", { level: 2, name: "Cliente", exact: true })).toBeVisible();
    expect((await maquetado(page)).columnas).toBe(1);

    await page.getByRole("button", { name: "Colapsar barra lateral" }).click();
    await expect.poll(async () => (await maquetado(page)).columnas).toBe(2);
    expect((await maquetado(page)).desbordePrincipal).toBeLessThanOrEqual(0);
  });

  test("pasos, pendientes y resumen funcionan en el navegador real", async ({ page }) => {
    const errores = vigilarConsola(page);
    await interceptarApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2/7");

    // Sin paso: al primero que el backend bloquea.
    await expect(page.getByRole("heading", { level: 2, name: "Horno", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/cotizador-v2\/7\/quema$/);

    const resumen = page.getByRole("complementary", { name: "Resumen de la cotización" });
    await expect(resumen.getByTestId("v2next-total").last()).toHaveText("S/ 3339.40");
    await expect(resumen.getByText("Falta elegir el horno.").last()).toBeVisible();

    await page.getByRole("button", { name: "Siguiente: Precio" }).click();
    await expect(page).toHaveURL(/\/7\/precio$/);
    await expect(page.getByRole("heading", { level: 2, name: "Precio", exact: true })).toBeFocused();
    await expect(page.getByTestId("v2next-estado-guardado")).toHaveText("Guardado");
    expect(errores).toEqual([]);
  });

  test("un diálogo del ciclo de vida cubre la ventana entera", async ({ page }) => {
    await interceptarApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2/7/cliente");
    await page.getByRole("button", { name: "Anular cotización" }).click();

    const dialogo = page.getByRole("dialog", { name: "Anular cotización" });
    await expect(dialogo).toBeVisible();
    const caja = await dialogo.boundingBox();
    expect(caja).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });
  });

  test("la ruta de pruebas del rediseño lleva a la definitiva (corte 010O.13)", async ({ page }) => {
    await interceptarApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2-next/7/precio?origen=enlace");
    await expect(page).toHaveURL(/\/cotizador-v2\/7\/precio\?origen=enlace$/);
    await expect(page.getByRole("heading", { level: 2, name: "Precio", exact: true })).toBeVisible();
  });
});
