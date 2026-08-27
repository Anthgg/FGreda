import { defineConfig, devices } from "@playwright/test";

/**
 * Config de Playwright para GREDA.
 *
 * No hay staging: por diseño estos tests corren contra el entorno que
 * apunte E2E_BASE_URL (produccion por defecto en este proyecto) en modo
 * no destructivo — ver e2e/helpers/fixtures.ts para el prefijo de datos de
 * prueba y la politica de "nunca borrar datos reales".
 *
 * Nunca hardcodear la URL de produccion en un spec: todo pasa por baseURL.
 */
const baseURL = process.env.E2E_BASE_URL ?? "https://fgreda-web-303244958634.southamerica-west1.run.app";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // los specs comparten datos de produccion (cotizaciones, terceros); evitar carreras
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-ios", use: { ...devices["iPhone 14"] } },
    { name: "mobile-android", use: { ...devices["Pixel 7"] } },
  ],
});
