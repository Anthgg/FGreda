import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/fixtures";

/**
 * Fase 009A — basicos de performance y consola, contra el build de
 * produccion real (no dev mode: el baseURL por defecto es la Cloud Run
 * desplegada). No mide Core Web Vitals con precision de laboratorio; mide lo
 * que un E2E puede medir de forma reproducible: cuantos requests dispara
 * cada pantalla, si hay duplicados obvios, y si la consola tira errores.
 */

const PAGES: Array<{ label: string; path: string }> = [
  { label: "Inicio", path: "/" },
  { label: "Cotizador", path: "/cotizador/nuevo" },
  { label: "Cotizaciones", path: "/cotizaciones" },
  { label: "Productos", path: "/productos" },
  { label: "Inventario", path: "/inventario" },
  { label: "Recetas", path: "/recetas" },
];

// Errores conocidos y ya evaluados como no accionables en esta fase. Vacio a
// proposito: si algo aparece aqui abajo sin estar en esta lista, es una
// consola sucia real y el test debe fallar en vez de ocultarlo.
const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [];

test.describe("Performance basica + consola limpia", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  for (const { label, path } of PAGES) {
    test(`${label}: requests sin duplicados obvios y consola sin errores inesperados`, async ({ page }) => {
      // Ojo: el login en si mismo dispara un 401 esperado en GET /auth/me y
      // POST /auth/refresh (el bootstrap de la app pregunta "ya hay sesion?"
      // antes de mostrar el formulario, y como todavia no la hay, ambos
      // fallan a proposito). Eso es ruido de consola legitimo del flujo de
      // login, no del page bajo prueba, asi que los listeners se instalan
      // DESPUES de login() para medir unicamente la pantalla real.
      await login(page);

      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];
      const requestLog: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => pageErrors.push(err.message));
      page.on("requestfailed", (req) => {
        // Un abort por navegacion (SPA cambia de ruta a mitad de un fetch) no
        // es un error real de la app.
        const failure = req.failure()?.errorText ?? "";
        if (failure.includes("ERR_ABORTED")) return;
        failedRequests.push(`${req.method()} ${req.url()} (${failure})`);
      });
      page.on("request", (req) => {
        if (req.resourceType() === "xhr" || req.resourceType() === "fetch") {
          requestLog.push(`${req.method()} ${req.url()}`);
        }
      });

      const start = Date.now();
      await page.goto(path, { waitUntil: "networkidle" });
      const elapsedMs = Date.now() - start;
      console.log(`[perf] ${label} (${path}): networkidle en ${elapsedMs}ms, ${requestLog.length} requests xhr/fetch`);

      // Duplicados exactos (mismo metodo + misma URL, incluida query string)
      // disparados en la misma carga de pantalla: senal de un efecto/hook
      // re-disparando la misma peticion sin necesidad.
      const counts = new Map<string, number>();
      for (const entry of requestLog) counts.set(entry, (counts.get(entry) ?? 0) + 1);
      const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
      if (duplicates.length > 0) {
        console.log(`[perf] ${label}: requests duplicados exactos ->`, duplicates);
      }

      const unexpectedConsoleErrors = consoleErrors.filter(
        (text) => !CONSOLE_ERROR_ALLOWLIST.some((pattern) => pattern.test(text)),
      );

      expect(pageErrors, `pageerror inesperado en ${label}`).toEqual([]);
      expect(failedRequests, `requests fallidos inesperados en ${label}`).toEqual([]);
      expect(unexpectedConsoleErrors, `console.error inesperado en ${label}`).toEqual([]);
    });
  }
});
