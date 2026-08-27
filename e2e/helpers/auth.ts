/**
 * Login/logout de UI reutilizables. Nunca loguean password/cookie/CSRF.
 */

import { expect, type Page } from "@playwright/test";

import { E2E_EMAIL, E2E_PASSWORD } from "./fixtures";

export async function login(page: Page, email = E2E_EMAIL, password = E2E_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/correo electr[oó]nico/i).fill(email);
  // getByLabel(/contrase.../) tambien matchea el boton "Mostrar contraseña"
  // (su aria-label contiene la misma palabra); el input real es el unico
  // con name="password".
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /iniciar sesi[oó]n/i }).click();
  await expect(page.getByRole("heading", { name: "Inicio." })).toBeVisible({ timeout: 15_000 });
}

export async function logout(page: Page): Promise<void> {
  // En viewport mobile el sidebar esta colapsado detras de un hamburguesa
  // (AppShell.tsx): "Cerrar sesion" no existe en el DOM visible hasta abrir
  // ese menu. En desktop el boton ya esta visible y este click es un no-op.
  const menuToggle = page.getByRole("button", { name: /abrir men[uú] principal/i });
  if (await menuToggle.isVisible().catch(() => false)) {
    await menuToggle.click();
  }
  await page.getByRole("button", { name: /cerrar sesi[oó]n/i }).click();
  await expect(page.getByRole("heading", { name: /inicia sesi[oó]n/i })).toBeVisible({ timeout: 10_000 });
}
