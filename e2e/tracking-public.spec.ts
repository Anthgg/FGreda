import { expect, test } from "@playwright/test";

/**
 * Seguimiento público (Fase 009I.1) contra producción, SIN cuenta.
 *
 * Es el único spec de la suite que no pide credenciales, y no es una
 * casualidad: comprueba justamente que estas rutas funcionan para quien no
 * tiene ninguna. El resto de la suite se salta cuando faltan `E2E_EMAIL` /
 * `E2E_PASSWORD`; éste corre siempre, y por eso vigila lo que de verdad podría
 * romperse en silencio — que alguien devuelva `/seguimiento` detrás de
 * `ProtectedRoute` y nadie se entere hasta que un cliente escanee un papel.
 *
 * No crea ni toca ningún dato: se prueba sin token y con uno inventado, que es
 * todo lo que hace falta para saber si la puerta está abierta.
 */
test.describe("Seguimiento público de producción", () => {
  test("QR_PUBLIC_WITHOUT_LOGIN: entrar sin sesión no lleva al login", async ({ page }) => {
    await page.goto("/seguimiento");

    await expect(page).toHaveURL(/\/seguimiento$/);
    await expect(page.getByText(/no hay ning[uú]n seguimiento abierto/i)).toBeVisible();
  });

  test("QR_PUBLIC_INVALID_TOKEN: un código inventado se explica sin tecnicismos", async ({
    page,
  }) => {
    await page.goto("/seguimiento/token-que-no-corresponde-a-ninguna-orden-000");

    await expect(page.getByText(/no corresponde a ninguna orden/i)).toBeVisible();
    // Ni el código del backend ni el número de estado delante del cliente.
    await expect(page.getByText(/TRACKING_NOT_FOUND/)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("QR_PUBLIC_READ_ONLY: no se ofrece ninguna acción sobre la producción", async ({ page }) => {
    await page.goto("/seguimiento");
    await expect(page.getByText(/no hay ning[uú]n seguimiento abierto/i)).toBeVisible();

    for (const accion of [/arrancar/i, /completar/i, /anular/i, /ajustar/i, /crear orden/i]) {
      await expect(page.getByRole("button", { name: accion })).toHaveCount(0);
      await expect(page.getByRole("link", { name: accion })).toHaveCount(0);
    }
  });

  test("QR_PUBLIC_MOBILE: la pantalla cabe a lo ancho del móvil", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/seguimiento");
    await expect(page.getByText(/no hay ning[uú]n seguimiento abierto/i)).toBeVisible();

    // Nada empuja la página a lo ancho: un cliente mirando el móvil no debería
    // tener que arrastrar de lado para leer el estado de su pedido.
    const desbordaHorizontal = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(desbordaHorizontal).toBe(false);
  });
});
