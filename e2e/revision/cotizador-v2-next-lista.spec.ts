import { expect, type Page } from "@playwright/test";
import { test } from "./w4-test";

import { COTIZACION, interceptarApi, vigilarConsola } from "./support/cotizadorV2NextMocks";

/**
 * Listado y alta del Cotizador V2 rediseñado, en Chromium (010O.4).
 *
 * Con la API interceptada: sin backend ni credenciales. Lo que se protege en
 * el navegador real: la búsqueda es LOCAL (el backend no acepta `q` y la
 * ignoraría en silencio), el filtro manda `status`, el alta es UN POST y lleva
 * al paso que toca, y nada desborda en un teléfono.
 *
 * Reescrito por el orquestador al integrar: la versión original interceptaba
 * `/users/me`, que no es la ruta de sesión de la aplicación.
 */

function fila(id: number, cambios: Record<string, unknown> = {}) {
  return {
    id,
    code: `CTZ-V2-2026-00000${id}`,
    pricing_engine_version: "V2",
    status: "DRAFT",
    production_type: "RETAIL",
    customer_name: "Cliente",
    name: "Pedido",
    created_at: "2026-09-20T10:00:00Z",
    effective_status: "DRAFT",
    valid_until: null,
    ...cambios,
  };
}

const FILAS = [
  fila(7, { customer_name: "Café Tostado Norte", name: "Tazas para barra" }),
  fila(8, { customer_name: "Hotel Mirador", name: "Vajilla restaurante", effective_status: "EXPIRED" }),
  fila(9, { customer_name: null, name: null }),
];

const NUEVA = { ...COTIZACION, customer_id: null, customer_name: null, name: "Feria de octubre" };

async function preparar(page: Page) {
  const pedidas: string[] = [];
  page.on("request", (peticion) => {
    if (peticion.url().includes("/api/v1/quotations-v2")) pedidas.push(peticion.url());
  });
  const escrituras = await interceptarApi(page, (ruta, metodo) => {
    if (ruta.endsWith("/api/v1/quotations-v2") && metodo === "GET") {
      return { items: FILAS, total: FILAS.length };
    }
    if (ruta.endsWith("/api/v1/quotations-v2") && metodo === "POST") return NUEVA;
    if (ruta.endsWith("/quotations-v2/7")) return NUEVA;
    return undefined;
  });
  return { pedidas, escrituras };
}

function desbordeDelMain(page: Page) {
  return page.evaluate(() => {
    const principal = document.querySelector("main") as HTMLElement;
    return principal.scrollWidth - principal.clientWidth;
  });
}

test.describe("Listado y alta del rediseño (010O.4)", () => {
  test("buscar filtra en local y NUNCA manda q; el filtro manda status", async ({ page }) => {
    const errores = vigilarConsola(page);
    const { pedidas } = await preparar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2");

    await expect(page.getByText("Café Tostado Norte")).toBeVisible();
    await page.getByPlaceholder("Buscar por cliente, nombre o código").fill("vajilla");
    await expect(page.getByText("Hotel Mirador")).toBeVisible();
    await expect(page.getByText("Café Tostado Norte")).toHaveCount(0);

    await page.getByRole("radio", { name: /Emitidas/ }).click();
    await expect.poll(() => pedidas.some((url) => url.includes("status=CONFIRMED"))).toBe(true);
    expect(pedidas.some((url) => /[?&]q=/.test(url))).toBe(false);
    expect(errores).toEqual([]);
  });

  test("cada fila tiene un solo enlace, a la cotización", async ({ page }) => {
    await preparar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2");

    const fila = page.getByRole("row", { name: /Café Tostado Norte/ });
    await expect(fila.getByRole("link")).toHaveCount(1);
    await expect(fila.getByRole("link")).toHaveAttribute("href", "/cotizador-v2/7");
    await expect(fila.getByTestId("v2-estado-efectivo")).toHaveText(/Borrador/);
  });

  test("el alta es UN POST y, sin cliente, lleva al paso Cliente", async ({ page }) => {
    const errores = vigilarConsola(page);
    const { escrituras } = await preparar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2");

    await page.getByRole("button", { name: "Nueva cotización" }).click();
    const dialogo = page.getByRole("dialog", { name: "Nueva cotización" });
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel(/Ponle un nombre/).fill("Feria de octubre");
    await dialogo.getByRole("button", { name: "Empezar cotización" }).dblclick();

    await expect(page).toHaveURL(/\/cotizador-v2\/7\/cliente$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "Cliente", exact: true }),
    ).toBeVisible();
    const altas = escrituras.filter((e) => e.metodo === "POST" && e.ruta.endsWith("/quotations-v2"));
    expect(altas).toEqual([
      {
        metodo: "POST",
        ruta: "/api/v1/quotations-v2",
        cuerpo: { name: "Feria de octubre", customer_id: null, production_type: "RETAIL" },
      },
    ]);
    expect(errores).toEqual([]);
  });

  test("a 375 px ni el listado ni el diálogo desbordan la página", async ({ page }) => {
    await preparar(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/cotizador-v2");
    await expect(page.getByText("Café Tostado Norte")).toBeVisible();
    expect(await desbordeDelMain(page)).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Nueva cotización" }).click();
    await expect(page.getByRole("dialog", { name: "Nueva cotización" })).toBeVisible();
    expect(await desbordeDelMain(page)).toBeLessThanOrEqual(0);
  });
});
