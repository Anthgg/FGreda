import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de LA REVISION: la aplicacion construida desde esta rama, hablando con un
 * backend levantado desde la revision compatible. Fase 010G.
 *
 * Es un gate distinto del de `playwright.config.ts`, y a proposito:
 *
 * - aquel es un **smoke de produccion**: comprueba que lo desplegado sigue en pie
 *   y por eso apunta a la URL real. Sirve DESPUES de desplegar;
 * - este **valida la rama**: una pantalla nueva tiene que probarse contra el
 *   codigo que la contiene, ANTES de integrarla. Contra produccion, una prueba
 *   funcional de algo no desplegado falla por la razon equivocada o se salta y
 *   deja un verde vacio.
 *
 * ## Sin valores por defecto que apunten a ningun sitio real
 *
 * `E2E_BASE_URL` es OBLIGATORIA y tiene que ser local. Si faltara, el smoke de
 * produccion cae en la URL real; este gate se niega a arrancar. Lo mismo con las
 * credenciales: las genera el workflow en cada corrida contra una autenticacion
 * simulada, y si no estan la corrida falla en vez de saltarse.
 *
 * Sin reintentos: un gate que pasa a la segunda esconde justo la intermitencia
 * que tendria que ensenar.
 */

function obligatoria(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `[playwright.revision] ${nombre} es obligatoria. Este gate prueba la revision ` +
        "levantada en local y no tiene valor por defecto.",
    );
  }
  return valor;
}

const baseURL = obligatoria("E2E_BASE_URL");
const host = new URL(baseURL).hostname;
if (!["localhost", "127.0.0.1"].includes(host)) {
  throw new Error(
    `[playwright.revision] E2E_BASE_URL tiene que ser local y es ${host}. ` +
      "Para probar lo desplegado esta playwright.config.ts.",
  );
}
obligatoria("E2E_EMAIL");
obligatoria("E2E_PASSWORD");

export default defineConfig({
  testDir: "./e2e/revision",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never", outputFolder: "playwright-report-revision" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report-revision" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
