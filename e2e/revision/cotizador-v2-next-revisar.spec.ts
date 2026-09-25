import { expect, test } from "@playwright/test";

import {
  COTIZACION,
  interceptarApi,
  RESUMEN_DE_EMISION,
  vigilarConsola,
} from "./support/cotizadorV2NextMocks";

/**
 * «Revisar y emitir» del rediseño, en Chromium (010O.11).
 *
 * Con la API interceptada. Lo que jsdom no puede: que el diálogo de emitir
 * cubra la VENTANA aunque el paso viva dentro de un panel con backdrop-filter,
 * y que un doble clic no emita dos veces.
 */

const SIN_BLOQUEOS = { ...RESUMEN_DE_EMISION, can_confirm: true, blockers: [] };

test.describe("«Revisar y emitir» del rediseño (010O.11)", () => {
  test("emitir: el diálogo cubre la ventana y sale UNA confirmación con la huella", async ({
    page,
  }) => {
    const errores = vigilarConsola(page);
    const escrituras = await interceptarApi(page, (ruta, metodo) => {
      if (ruta.includes("/confirmation-preview")) return SIN_BLOQUEOS;
      if (ruta.endsWith("/confirm") && metodo === "POST") {
        return { ...COTIZACION, status: "CONFIRMED", effective_status: "CONFIRMED" };
      }
      return undefined;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2/7/resumen");

    await expect(page.getByTestId("v2next-documento")).toBeVisible();
    await page.getByRole("button", { name: "Emitir cotización" }).click();
    const dialogo = page.getByRole("dialog", { name: "¿Emitir la cotización?" });
    await expect(dialogo).toBeVisible();
    expect(await dialogo.boundingBox()).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });

    await dialogo.getByRole("button", { name: "Confirmar y emitir" }).dblclick();
    await expect.poll(() => escrituras.filter((e) => e.ruta.endsWith("/confirm")).length).toBe(1);
    expect(escrituras.find((e) => e.ruta.endsWith("/confirm"))?.cuerpo).toEqual({
      expected_fingerprint: "a".repeat(64),
    });
    expect(errores).toEqual([]);
  });

  test("con bloqueos el botón no emite y la lista lleva al paso", async ({ page }) => {
    await interceptarApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2/7/resumen");

    await expect(page.getByRole("button", { name: "Emitir cotización" })).toBeDisabled();
    await page.getByTestId("v2next-checklist").getByRole("button", { name: /Completar/ }).click();
    await expect(page).toHaveURL(/\/7\/quema$/);
  });

  test("a 375 px el documento no desborda la página", async ({ page }) => {
    await interceptarApi(page, (ruta) =>
      ruta.includes("/confirmation-preview") ? SIN_BLOQUEOS : undefined,
    );
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/cotizador-v2/7/resumen");
    await expect(page.getByTestId("v2next-documento")).toBeVisible();
    const desborde = await page.evaluate(() => {
      const principal = document.querySelector("main") as HTMLElement;
      return principal.scrollWidth - principal.clientWidth;
    });
    expect(desborde).toBeLessThanOrEqual(0);
  });
});
