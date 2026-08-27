import { expect, test } from "@playwright/test";

import { login, logout } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/fixtures";

test.describe("Autenticacion", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  test("LOGIN_VALID: credenciales correctas entran al dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Inicio." })).toBeVisible();
  });

  test("LOGIN_INVALID: credenciales incorrectas muestran error controlado", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo electr[oó]nico/i).fill("noexiste@example.com");
    await page.locator('input[name="password"]').fill("incorrecta-a-proposito");
    await page.getByRole("button", { name: /iniciar sesi[oó]n/i }).click();
    await expect(page.getByRole("alert")).toContainText(/correo o contrase[ñn]a incorrectos/i);
    // Sigue en /login: ninguna sesion se establecio.
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH_ME + SESSION_RELOAD: la sesion sobrevive un refresh de pagina", async ({ page }) => {
    await login(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Inicio." })).toBeVisible();
  });

  test("SESSION_NEW_TAB: una pestana nueva del mismo contexto ya esta autenticada", async ({ page, context }) => {
    await login(page);
    const secondPage = await context.newPage();
    await secondPage.goto("/");
    await expect(secondPage.getByRole("heading", { name: "Inicio." })).toBeVisible();
    await secondPage.close();
  });

  test("CSRF: una ruta protegida sin sesion redirige a login (el backend, no la UI, es la autoridad)", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/cotizador/nuevo");
    await expect(page).toHaveURL(/\/login/);
  });

  test("LOGOUT: cierra sesion y bloquea rutas protegidas", async ({ page }) => {
    await login(page);
    await logout(page);
    await page.goto("/cotizador/nuevo");
    await expect(page).toHaveURL(/\/login/);
  });
});
